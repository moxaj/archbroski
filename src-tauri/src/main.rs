#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod image;
mod logic;
mod utils;

use crate::image::process_image;
use crate::logic::suggest_modifier_id;
use image::{Cache, ProcessImageResult, Rectangle};
use itertools::Itertools;
use logic::{Hotkey, ModifierId, Modifiers, UserSettings, MODIFIERS};
use opencv::core::{Mat, MatTraitConst};
use opencv::imgproc::{cvt_color, COLOR_BGRA2BGR};
use retry::delay::Fixed;
use retry::retry;
use scrap::{Capturer, Display};
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::error::Error;
use std::ffi::c_void;
use std::sync::Mutex;
use tauri::{GlobalShortcutManager, Manager, WindowBuilder};
use thiserror::Error;
use utils::DiscSynchronized;
#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{BOOL, HWND},
    Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED},
};

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Highlight {
    stash_area: Rectangle,
    suggested_cell_area: Rectangle,
}

impl Highlight {
    fn new(stash_area: Rectangle, suggested_cell_area: Rectangle) -> Self {
        Self {
            stash_area,
            suggested_cell_area,
        }
    }
}

struct GlobalComputationId(u64);

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(tag = "type")]
enum State {
    Hidden,
    Computing { id: u64 },
    Computed(Highlight),
    DetectionError,
    LogicError,
}

struct Screenshot {
    buffer: Vec<u8>,
    size: (usize, usize),
}

impl Screenshot {
    fn new(buffer: Vec<u8>, size: (usize, usize)) -> Self {
        Self { buffer, size }
    }

    fn into_mat(self) -> Result<Mat, Box<dyn Error>> {
        let mat1 = Mat::from_slice(&self.buffer).unwrap();
        let mat1 = mat1.reshape(4, self.size.1 as i32).unwrap();
        let mut mat2 = Mat::default();
        cvt_color(&mat1, &mut mat2, COLOR_BGRA2BGR, 0).unwrap();
        Ok(mat2)
    }
}

#[derive(Error, Debug)]
pub enum ActivationError {
    #[error("failed to parse the taken screenshot")]
    DetectionError,
    #[error("failed to suggest a modifier")]
    LogicError,
}

fn create_settings_window(app: &tauri::AppHandle) {
    app.create_window(
        "settings",
        tauri::WindowUrl::App("index.html".into()),
        move |window_builder, attributes| {
            (
                window_builder
                    .title("Archbroski")
                    .inner_size(1300f64, 700f64)
                    .decorations(false)
                    .resizable(false)
                    .visible(false)
                    .center(),
                attributes,
            )
        },
    )
    .unwrap();
}

fn create_overlay_window(app: &tauri::AppHandle) {
    let overlay_window = app
        .create_window(
            "overlay",
            tauri::WindowUrl::App("index.html".into()),
            move |window_builder, attributes| {
                (
                    window_builder
                        .resizable(false)
                        .decorations(false)
                        .transparent(true)
                        .visible(false)
                        .always_on_top(true)
                        .position(0f64, 0f64)
                        .skip_taskbar(true),
                    attributes,
                )
            },
        )
        .unwrap();

    if cfg!(target_os = "windows") {
        if let Ok(hwnd) = overlay_window.hwnd() {
            unsafe {
                let _ = DwmSetWindowAttribute(
                    std::mem::transmute::<*mut c_void, HWND>(hwnd),
                    DWMWA_TRANSITIONS_FORCEDISABLED,
                    &mut BOOL::from(true) as *mut _ as *mut c_void,
                    std::mem::size_of::<BOOL>() as u32,
                );
            }
        }
    }
}

fn create_error_window(app: &tauri::AppHandle) {
    app.create_window(
        "error",
        tauri::WindowUrl::App("index.html".into()),
        move |window_builder, attributes| {
            (
                window_builder
                    .decorations(false)
                    .resizable(false)
                    .visible(false)
                    .inner_size(500f64, 250f64)
                    .center(),
                attributes,
            )
        },
    )
    .unwrap();
}

fn show_settings_window(app: &tauri::AppHandle) {
    if let Some(settings_window) = app.get_window("settings") {
        settings_window.unminimize().unwrap();
        settings_window.set_focus().unwrap();
    } else {
        create_settings_window(app);
    }
}

fn get_state(app: &tauri::AppHandle) -> State {
    *app.state::<Mutex<State>>().lock().unwrap()
}

fn set_state(app: &tauri::AppHandle, state: State) {
    *app.state::<Mutex<State>>().lock().unwrap() = state;
}

fn set_initial_hotkey(app: &tauri::AppHandle) {
    if let Ok(user_settings) = &*app.state::<Result<Mutex<UserSettings>, &'static str>>() {
        let app_ = app.clone();
        app.global_shortcut_manager()
            .register(user_settings.lock().unwrap().hotkey.as_str(), move || {
                activate(&app_);
            })
            .unwrap();
    }
}

fn update_overlay(app: &tauri::AppHandle, state: State) {
    let app_ = app.clone();
    app.run_on_main_thread(move || {
        set_state(&app_, state);
        app_.get_window("overlay")
            .unwrap()
            .emit("update", state)
            .unwrap();
    })
    .unwrap();
}

fn activate(app: &tauri::AppHandle) {
    if !matches!(get_state(app), State::Hidden) {
        return;
    }

    let global_computation_id_state = app.state::<Mutex<GlobalComputationId>>();
    let mut global_computation_id_mutex = global_computation_id_state.lock().unwrap();
    global_computation_id_mutex.0 += 1;
    let current_computation_id = global_computation_id_mutex.0;
    update_overlay(
        app,
        State::Computing {
            id: current_computation_id,
        },
    );
    drop(global_computation_id_mutex);

    let app = app.clone();
    std::thread::spawn(move || {
        if let Err(error) = Display::primary()
            .map_err(|_| ActivationError::DetectionError)
            .and_then(|display| Capturer::new(display).map_err(|_| ActivationError::DetectionError))
            .and_then(|mut capturer| {
                retry(Fixed::from_millis(20).take(10), || {
                    let capturer_width = capturer.width();
                    let capturer_height = capturer.height();
                    capturer
                        .frame()
                        .map(|frame| (frame.to_vec(), capturer_width, capturer_height))
                })
                .map_err(|_| ActivationError::DetectionError)
            })
            .and_then(|(buffer, width, height)| {
                let cache_state = app.state::<Result<Mutex<Cache>, &'static str>>();
                let cache_state = cache_state.as_ref();
                let mut cache = cache_state.unwrap().lock().unwrap();
                timed!(
                    "process_image",
                    process_image(
                        &mut cache,
                        Screenshot::new(buffer, (width, height)).into_mat().unwrap(),
                    )
                )
                .ok_or_else(|| ActivationError::DetectionError)
                .and_then(|process_image_result| {
                    if process_image_result.cache_modified {
                        cache.save().map_err(|_| ActivationError::DetectionError)?;
                    }

                    Ok(process_image_result)
                })
            })
            .and_then(
                |ProcessImageResult {
                     stash_area,
                     stash_modifier_ids,
                     queue_modifier_ids,
                     ..
                 }| {
                    let stash_by_modifier_ids = stash_modifier_ids.iter().fold(
                        HashMap::<ModifierId, BTreeSet<Rectangle>>::new(),
                        |mut stash_by_modifier_ids, (&cell_area, &modifier_id)| {
                            if let Some(modifier_id) = modifier_id {
                                stash_by_modifier_ids
                                    .entry(modifier_id)
                                    .or_default()
                                    .insert(cell_area);
                            }

                            stash_by_modifier_ids
                        },
                    );
                    let user_settings_state =
                        app.state::<Result<Mutex<UserSettings>, &'static str>>();
                    let user_settings_state = user_settings_state.as_ref();
                    let user_settings = &mut *user_settings_state.unwrap().lock().unwrap();
                    timed!(
                        "logic",
                        suggest_modifier_id(
                            user_settings,
                            stash_modifier_ids
                                .values()
                                .filter_map(|modifier_id| modifier_id.as_ref())
                                .copied()
                                .counts()
                                .into_iter()
                                .collect(),
                            queue_modifier_ids
                                .iter()
                                .filter_map(|modifier_id| modifier_id.as_ref())
                                .copied()
                                .collect_vec()
                        )
                    )
                    .ok_or_else(|| ActivationError::LogicError)
                    .map(|suggested_modifier_id| {
                        let suggested_cell_area = *stash_by_modifier_ids[&suggested_modifier_id]
                            .iter()
                            .next()
                            .unwrap();
                        if let State::Computing { id } = get_state(&app) {
                            if id == current_computation_id {
                                update_overlay(
                                    &app,
                                    State::Computed(Highlight::new(
                                        stash_area,
                                        suggested_cell_area,
                                    )),
                                );
                            }
                        }
                    })
                },
            )
        {
            if let State::Computing { id } = get_state(&app) {
                if id == current_computation_id {
                    update_overlay(
                        &app,
                        match error {
                            ActivationError::DetectionError => State::DetectionError,
                            ActivationError::LogicError => State::LogicError,
                        },
                    );
                }
            }
        }
    });
}

#[tauri::command(async)]
fn get_monitor_size(window: tauri::Window) -> (u32, u32, f64) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        (
            monitor.size().width,
            monitor.size().height,
            monitor.scale_factor(),
        )
    } else {
        (0, 0, 1.0)
    }
}

#[tauri::command(async)]
fn get_error_message(
    user_settings_state: tauri::State<'_, Result<Mutex<UserSettings>, &'static str>>,
    cache_state: tauri::State<'_, Result<Mutex<Cache>, &'static str>>,
) -> Option<&'static str> {
    user_settings_state
        .as_ref()
        .err()
        .copied()
        .or_else(|| cache_state.as_ref().err().copied())
}

#[tauri::command(async)]
fn get_user_settings(
    user_settings_state: tauri::State<'_, Result<Mutex<UserSettings>, &'static str>>,
) -> UserSettings {
    user_settings_state
        .as_ref()
        .unwrap()
        .lock()
        .unwrap()
        .clone()
}

#[tauri::command(async)]
fn set_user_settings(
    user_settings_state: tauri::State<'_, Result<Mutex<UserSettings>, &'static str>>,
    user_settings: UserSettings,
) {
    let saved_user_settings = user_settings.clone();
    std::thread::spawn(move || {
        let _ = saved_user_settings.save(); // TODO handle error
    });
    *user_settings_state.as_ref().unwrap().lock().unwrap() = user_settings;
}

#[tauri::command(async)]
fn get_modifiers() -> Modifiers {
    MODIFIERS.clone()
}

#[tauri::command(async)]
fn set_hotkey(
    app: tauri::AppHandle,
    user_settings_state: tauri::State<'_, Result<Mutex<UserSettings>, &'static str>>,
    hotkey: Hotkey,
) {
    let user_settings_state = user_settings_state.as_ref().unwrap();
    let mut user_settings = user_settings_state.lock().unwrap();
    let accelerator = user_settings.hotkey.as_str();
    app.global_shortcut_manager()
        .unregister(accelerator)
        .unwrap();

    let app_ = app.clone();
    app.global_shortcut_manager()
        .register(accelerator, move || {
            activate(&app_);
        })
        .unwrap();

    user_settings.hotkey = hotkey;
}

#[tauri::command(async)]
fn hide_overlay_window(app: tauri::AppHandle, overlay_window: tauri::Window) {
    overlay_window.hide().unwrap();
    set_state(&app, State::Hidden);
}

#[tauri::command(async)]
fn exit(app: tauri::AppHandle) {
    app.exit(0);
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_monitor_size,
            get_error_message,
            get_user_settings,
            set_user_settings,
            get_modifiers,
            set_hotkey,
            hide_overlay_window,
            exit,
        ])
        .system_tray(
            tauri::SystemTray::new()
                .with_icon(tauri::Icon::Raw(
                    include_bytes!("../icons/icon.ico").to_vec(),
                ))
                .with_menu(
                    tauri::SystemTrayMenu::new()
                        .add_item(tauri::CustomMenuItem::new("settings", "Settings"))
                        .add_item(tauri::CustomMenuItem::new("quit", "Quit")),
                ),
        )
        .on_system_tray_event(move |app, event| {
            if let tauri::SystemTrayEvent::MenuItemClick { id, .. } = event {
                match id.as_str() {
                    "settings" => show_settings_window(app),
                    "quit" => {
                        let app = app.clone();
                        std::thread::spawn(move || app.exit(0));
                    }
                    _ => {}
                }
            }
        })
        .setup(|app| {
            app.manage(
                UserSettings::load_or_new_saved()
                    .map(Mutex::new)
                    .map_err(|_| "failed_to_load_user_settings"),
            );
            app.manage(
                Cache::load()
                    .map(Mutex::new)
                    .map_err(|_| "failed_to_load_cache"),
            );
            if get_error_message(
                app.state::<Result<Mutex<UserSettings>, &'static str>>(),
                app.state::<Result<Mutex<Cache>, &'static str>>(),
            )
            .is_some()
            {
                create_error_window(&app.handle());
            } else {
                app.manage(Mutex::new(GlobalComputationId(0)));
                app.manage(Mutex::new(State::Hidden));
                create_overlay_window(&app.handle());
                set_initial_hotkey(&app.handle());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap();
}
