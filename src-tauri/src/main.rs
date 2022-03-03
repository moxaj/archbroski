#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod image;
mod logic;
mod utils;

use crate::image::{process_image, Screenshot};
use crate::logic::suggest_modifier_id;
use dashmap::DashMap;
use image::{ProcessImageResult, Rectangle, Vec2};
use itertools::Itertools;
use logic::{ModifierId, Modifiers, UserSettings, MODIFIERS};
use retry::delay::Fixed;
use retry::retry;
use scrap::{Capturer, Display};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeSet, HashMap};
use std::error::Error;
use std::ffi::c_void;
use std::fs::File;
use std::io::{BufReader, BufWriter};
use std::sync::Mutex;
use tauri::{AppHandle, GlobalShortcutManager, Manager, WindowBuilder};
use thiserror::Error;
use utils::{BincodeDiscSynchronized, DiscSynchronized};
#[cfg(target_os = "windows")]
use windows::Win32::{
    Foundation::{BOOL, HWND},
    Graphics::Dwm::{DwmSetWindowAttribute, DWMWA_TRANSITIONS_FORCEDISABLED},
};

#[derive(Debug, Serialize, Deserialize)]
pub struct Cache {
    pub modified: bool,
    pub layout: Option<HashMap<u8, Vec2>>,
    pub images: DashMap<u64, Option<ModifierId>>,
    pub suggested_modifier_ids: HashMap<u64, Option<ModifierId>>,
}

impl DiscSynchronized for Cache {
    fn create_new() -> Self {
        Self {
            modified: false,
            layout: None,
            images: DashMap::new(),
            suggested_modifier_ids: HashMap::new(),
        }
    }

    fn file_name() -> &'static str {
        "archbroski\\.cache"
    }

    fn save_impl(&self, writer: &mut BufWriter<File>) -> Result<(), Box<dyn Error>> {
        <Self as BincodeDiscSynchronized>::save_impl(self, writer)
    }

    fn load_impl(reader: BufReader<File>) -> Result<Self, Box<dyn Error>> {
        <Self as BincodeDiscSynchronized>::load_impl(reader)
    }
}

impl BincodeDiscSynchronized for Cache {}

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

#[derive(Clone, Copy, Debug, Serialize)]
#[serde(tag = "type")]
enum ActivationState {
    Hidden,
    Computing { id: u64 },
    Computed(Highlight),
    DetectionError,
    LogicError,
}

#[derive(Error, Debug)]
enum ActivationError {
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
                    .inner_size(1400f64, 700f64)
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

fn set_initial_hotkey(app: &tauri::AppHandle) {
    let app_ = app.clone();
    app.global_shortcut_manager()
        .register(
            app.state::<Result<Mutex<UserSettings>, &'static str>>()
                .as_ref()
                .unwrap()
                .lock()
                .unwrap()
                .hotkey
                .as_str(),
            move || {
                activate(&app_);
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

fn activate(app: &tauri::AppHandle) {
    if let Ok(mut activation_state) = app.state::<Mutex<(u64, ActivationState)>>().try_lock() {
        if !matches!(activation_state.1, ActivationState::Hidden) {
            return;
        }

        activation_state.0 += 1;
        activation_state.1 = ActivationState::Computing {
            id: activation_state.0,
        };
        let activation_id = activation_state.0;
        app.get_window("overlay")
            .unwrap()
            .emit("update", activation_state.1)
            .unwrap();
        drop(activation_state);

        let app = app.clone();
        std::thread::spawn(move || {
            if let Err(error) = Display::primary()
                .map_err(|_| ActivationError::DetectionError)
                .and_then(|display| {
                    Capturer::new(display).map_err(|_| ActivationError::DetectionError)
                })
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
                    let mut cache = cache_state.as_ref().unwrap().lock().unwrap();
                    cache.modified = false;
                    process_image(
                        &mut cache,
                        Screenshot {
                            buffer,
                            width,
                            height,
                        },
                    )
                    .ok_or(ActivationError::DetectionError)
                })
                .and_then(
                    |ProcessImageResult {
                         stash_area,
                         stash_modifier_ids,
                         queue_modifier_ids,
                     }| {
                        if queue_modifier_ids.len() == 4 {
                            Err(ActivationError::LogicError)
                        } else {
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

                            let cache_state = app.state::<Result<Mutex<Cache>, &'static str>>();
                            let mut cache = cache_state.as_ref().unwrap().lock().unwrap();

                            let user_settings_state =
                                app.state::<Result<Mutex<UserSettings>, &'static str>>();
                            timed!(
                                "suggest modifier id",
                                suggest_modifier_id(
                                    &mut cache,
                                    &user_settings_state.as_ref().unwrap().lock().unwrap(),
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
                            .and_then(|suggested_modifier_id| {
                                if cache.modified {
                                    cache.save().map_err(|_| ActivationError::DetectionError)?;
                                    // TODO handle error
                                }

                                Ok(suggested_modifier_id)
                            })
                            .map(|suggested_modifier_id| {
                                let suggested_cell_area = *stash_by_modifier_ids
                                    [&suggested_modifier_id]
                                    .iter()
                                    .next()
                                    .unwrap();

                                let activation_state_state =
                                    app.state::<Mutex<(u64, ActivationState)>>();
                                let mut activation_state = activation_state_state.lock().unwrap();
                                if let ActivationState::Computing { id } = activation_state.1 {
                                    if id == activation_id {
                                        activation_state.1 = ActivationState::Computed(
                                            Highlight::new(stash_area, suggested_cell_area),
                                        );
                                        app.get_window("overlay")
                                            .unwrap()
                                            .emit("update", activation_state.1)
                                            .unwrap();
                                    }
                                }
                            })
                        }
                    },
                )
            {
                let activation_state_state = app.state::<Mutex<(u64, ActivationState)>>();
                let mut activation_state = activation_state_state.lock().unwrap();
                if let ActivationState::Computing { id } = activation_state.1 {
                    if id == activation_id {
                        activation_state.1 = match error {
                            ActivationError::DetectionError => ActivationState::DetectionError,
                            ActivationError::LogicError => ActivationState::LogicError,
                        };
                        app.get_window("overlay")
                            .unwrap()
                            .emit("update", activation_state.1)
                            .unwrap();
                    }
                }
            }
        });
    }
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
    app: AppHandle,
    user_settings_state: tauri::State<'_, Result<Mutex<UserSettings>, &'static str>>,
    user_settings: UserSettings,
) {
    let saved_user_settings = user_settings.clone();
    std::thread::spawn(move || {
        let _ = saved_user_settings.save(); // TODO handle error
    });

    let mut user_settings_guard = user_settings_state.as_ref().unwrap().lock().unwrap();
    let accelerator = user_settings_guard.hotkey.as_str();
    app.global_shortcut_manager()
        .unregister(accelerator)
        .unwrap();

    *user_settings_guard = user_settings;
    let accelerator = &user_settings_guard.hotkey;
    app.global_shortcut_manager()
        .register(accelerator, move || {
            activate(&app);
        })
        .unwrap();
}

#[tauri::command(async)]
fn get_modifiers() -> Modifiers {
    MODIFIERS.clone()
}

#[tauri::command(async)]
fn hide_overlay_window(app: tauri::AppHandle, overlay_window: tauri::Window) {
    overlay_window.hide().unwrap();
    app.state::<Mutex<(u64, ActivationState)>>()
        .lock()
        .unwrap()
        .1 = ActivationState::Hidden;
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
                Cache::load_or_new_saved()
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
                app.manage(Mutex::new((0u64, ActivationState::Hidden)));
                create_overlay_window(&app.handle());
                set_initial_hotkey(&app.handle());
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap();
}
