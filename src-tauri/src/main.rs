#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod image;
mod logic;
mod utils;

use image::{Cache, ProcessImageResult, Rectangle};
use itertools::Itertools;
use logic::{Hotkey, ModifierId, UserSettings};
use opencv::core::{Mat, MatTraitConst};
use opencv::imgproc::{cvt_color, COLOR_BGRA2BGR};
use retry::delay::Fixed;
use retry::retry;
use scrap::{Capturer, Display};
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::error::Error;
use std::sync::Mutex;
use tauri::{
    generate_context, AppHandle, Builder, CustomMenuItem, GlobalShortcutManager, Icon, Manager,
    SystemTray, SystemTrayEvent, SystemTrayMenu, Window, WindowBuilder, WindowUrl,
};
use thiserror::Error;

use crate::image::process_image;
use crate::logic::suggest_modifier_id;

#[derive(Clone, Copy, Debug, Serialize)]
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

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(tag = "type")]
enum InnerState {
    Hidden,
    Computing,
    Computed(Highlight),
    DetectionError,
    LogicError,
}

#[derive(Clone, Copy, Debug, Serialize)]
struct State(InnerState);

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

fn create_settings_window(app: &AppHandle) {
    app.create_window(
        "settings",
        WindowUrl::App("index.html".into()),
        move |window_builder, attributes| {
            (
                window_builder
                    .title("Archbro")
                    .inner_size(1000f64, 600f64)
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

fn create_overlay_window(app: &AppHandle) {
    app.create_window(
        "overlay",
        WindowUrl::App("index.html".into()),
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
}

fn create_error_window(app: &AppHandle) {
    app.create_window(
        "error",
        WindowUrl::App("index.html".into()),
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

fn show_settings_window(app: &AppHandle) {
    if let Some(settings_window) = app.get_window("settings") {
        settings_window.unminimize().unwrap();
        settings_window.set_focus().unwrap();
    } else {
        create_settings_window(app);
    }
}

fn set_initial_hotkey(app: &AppHandle) {
    if let Ok(user_settings) = &*app.state::<Result<Mutex<UserSettings>, &'static str>>() {
        let app_ = app.clone();
        app.global_shortcut_manager()
            .register(user_settings.lock().unwrap().hotkey.as_str(), move || {
                activate(&app_);
            })
            .unwrap();
    }
}

fn get_state(app: &AppHandle) -> InnerState {
    app.state::<Mutex<State>>().lock().unwrap().0
}

fn set_state(app: &AppHandle, inner_state: InnerState) {
    app.state::<Mutex<State>>().lock().unwrap().0 = inner_state;
}

fn update_overlay(app: &AppHandle, inner_state: InnerState) {
    let app_ = app.clone();
    app.run_on_main_thread(move || {
        set_state(&app_, inner_state);
        app_.get_window("overlay")
            .unwrap()
            .emit("update", inner_state)
            .unwrap();
    })
    .unwrap();
}

fn activate(app: &AppHandle) {
    if !matches!(get_state(app), InnerState::Hidden) {
        return;
    }

    let app_ = app.clone();
    std::thread::spawn(move || {
        update_overlay(&app_, InnerState::Computing);
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
                let cache_state = app_.state::<Result<Mutex<Cache>, &'static str>>();
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
                        app_.state::<Result<Mutex<UserSettings>, &'static str>>();
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
                        if matches!(get_state(&app_), InnerState::Computing) {
                            update_overlay(
                                &app_,
                                InnerState::Computed(Highlight::new(
                                    stash_area,
                                    suggested_cell_area,
                                )),
                            );
                        }
                    })
                },
            )
        {
            update_overlay(
                &app_,
                match error {
                    ActivationError::DetectionError => InnerState::DetectionError,
                    ActivationError::LogicError => InnerState::LogicError,
                },
            );
        }
    });
}

#[tauri::command]
fn get_monitor_size(window: Window) -> (u32, u32) {
    if let Ok(Some(monitor)) = window.primary_monitor() {
        (monitor.size().width, monitor.size().height)
    } else {
        (0, 0)
    }
}

#[tauri::command]
fn get_error_message(app: AppHandle) -> Option<&'static str> {
    app.state::<Result<Mutex<UserSettings>, &'static str>>()
        .as_ref()
        .err()
        .copied()
        .or_else(|| {
            app.state::<Result<Mutex<Cache>, &'static str>>()
                .as_ref()
                .err()
                .copied()
        })
}

#[tauri::command]
fn exit(app: AppHandle) {
    app.exit(0);
}

#[tauri::command]
fn hide_overlay_window(app: AppHandle, overlay_window: Window) {
    overlay_window.hide().unwrap();
    set_state(&app, InnerState::Hidden);
}

#[tauri::command]
fn set_hotkey(app: AppHandle, hotkey: Hotkey) {
    let user_settings_state = app.state::<Result<Mutex<UserSettings>, &'static str>>();
    let user_settings_state = user_settings_state.as_ref();
    let mut user_settings = user_settings_state.unwrap().lock().unwrap();
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

#[tauri::command]
fn get_user_settings(app: AppHandle) -> UserSettings {
    app.state::<Result<Mutex<UserSettings>, &'static str>>()
        .as_ref()
        .unwrap()
        .lock()
        .unwrap()
        .clone()
}

fn main() {
    Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_monitor_size,
            get_error_message,
            exit,
            hide_overlay_window,
            set_hotkey,
            get_user_settings
        ])
        .system_tray(
            SystemTray::new()
                .with_icon(Icon::Raw(include_bytes!("../icons/icon.ico").to_vec()))
                .with_menu(
                    SystemTrayMenu::new()
                        .add_item(CustomMenuItem::new("settings", "Settings"))
                        .add_item(CustomMenuItem::new("quit", "Quit")),
                ),
        )
        .on_system_tray_event(move |app, event| {
            if let SystemTrayEvent::MenuItemClick { id, .. } = event {
                match id.as_str() {
                    "settings" => show_settings_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                }
            }
        })
        .setup(|app| {
            app.manage(
                UserSettings::load()
                    .map(Mutex::new)
                    .map_err(|_| "failed_to_load_user_settings"),
            );
            app.manage(
                Cache::load()
                    .map(Mutex::new)
                    .map_err(|_| "failed_to_load_cache"),
            );
            if get_error_message(app.handle()).is_some() {
                create_error_window(&app.handle());
            } else {
                app.manage(Mutex::new(State(InnerState::Hidden)));

                create_overlay_window(&app.handle());
                set_initial_hotkey(&app.handle());
            }

            Ok(())
        })
        .run(generate_context!())
        .unwrap();
}
