// =============================================================================
// Tauri Main Process - AI Character Assistant (Rust Backend)
// =============================================================================

use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Manager, State};

// Modules
mod shared;
#[cfg(target_os = "linux")]
mod linux_input;
#[cfg(target_os = "windows")]
mod windows_input;

use shared::{InputState, SharedState};

#[cfg(target_os = "linux")]
use linux_input as input;
#[cfg(target_os = "windows")]
use windows_input as input;

// =============================================================================
// Config Management
// =============================================================================

#[tauri::command]
fn save_config(app_handle: AppHandle, config: serde_json::Value) -> bool {
    // We save to the App Config directory (standard across OS)
    let config_path = app_handle
        .path()
        .app_config_dir()
        .unwrap()
        .join("config.json");

    // Ensure directory exists
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Write to file
    if let Ok(json) = serde_json::to_string_pretty(&config) {
        if fs::write(&config_path, json).is_ok() {
            println!("[Config] Saved to {:?}", config_path);
            return true;
        }
    }
    false
}

#[tauri::command]
fn load_config(app_handle: AppHandle) -> serde_json::Value {
    // Try to load from App Config directory
    let config_path = app_handle
        .path()
        .app_config_dir()
        .unwrap()
        .join("config.json");

    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str(&content) {
                println!("[Config] Loaded from {:?}", config_path);
                return json;
            }
        }
    }

    // Default Config if file doesn't exist
    serde_json::json!({
        "theme": "fox",
        "geminiApiKey": ""
    })
}

#[tauri::command]
fn sync_cursor(state: State<Arc<SharedState>>, x: i32, y: i32) {
    let mut input = state.input_state.lock().unwrap();
    input.cursor_x = x;
    input.cursor_y = y;
}

#[tauri::command]
fn update_interactive_bounds(state: State<Arc<SharedState>>, rects: Vec<shared::Rect>) {
    // eprintln!("[Main] Received {} interactive rects", rects.len());
    if !rects.is_empty() {
        // eprintln!("[Main] Rect 0: {:?} (Screen Scale?)", rects[0]);
    }
    let mut input = state.input_state.lock().unwrap();
    input.interactive_rects = rects;
}

// =============================================================================
// Window Management
// =============================================================================

#[tauri::command]
fn check_fullscreen() -> bool {
    input::check_fullscreen()
}

// =============================================================================
// Main Application Entry Point
// =============================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::default().build()) 
        .invoke_handler(tauri::generate_handler![
            save_config,
            load_config,
            check_fullscreen,
            check_fullscreen,
            sync_cursor,
            update_interactive_bounds
        ]) 
        .setup(|app| {
            let app_handle = app.handle().clone();

            // Initialize state
            let (screen_width, screen_height) = input::detect_screen_size();
            let shared_state = Arc::new(SharedState {
                input_state: Mutex::new(InputState::new(screen_width, screen_height)),
            });

            // Register global state with Tauri
            app.manage(shared_state.clone());

            let app_handle_clone = app_handle.clone();
            thread::spawn(move || {
                input::run_input_loop(app_handle_clone, shared_state);
            });

            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(false);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
