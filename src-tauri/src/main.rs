// =============================================================================
// Tauri Main Process - AI Character Assistant (Rust Backend)
// =============================================================================
//
// This is the main entry point for the Tauri application backend.
//
// KEY RESPONSIBILITIES:
// - Initialize the Tauri app and register IPC commands
// - Manage persistent configuration (saved to ~/.config/)
// - Launch the input monitoring thread for global mouse/keyboard tracking
// - Handle window setup and platform-specific workarounds
//
// ARCHITECTURE:
// - Uses a shared state (Arc<Mutex<InputState>>) for thread-safe communication
//   between the input monitoring thread and the main Tauri event loop
// - Exposes Tauri commands (via #[tauri::command]) that the frontend can call
// - Delegates OS-specific input handling to the `input` module
//
// =============================================================================

use std::fs;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::{AppHandle, Manager, State};

// =============================================================================
// Module Imports
// =============================================================================

/// Shared types and state structures used across modules
mod shared;

/// OS-agnostic input handling module (dispatches to linux/windows backends)
mod input;

use shared::{InputState, SharedState};

// =============================================================================
// Configuration Management (IPC Commands)
// =============================================================================
// These functions are exposed to the frontend via Tauri's IPC mechanism.
// The frontend can call them using `invoke('save_config', {...})`.
//
// Configs are stored in the platform-specific app config directory:
// - Linux: ~/.config/com.sam.ai-character-assistant/config.json
// - Windows: %APPDATA%\com.sam.ai-character-assistant\config.json
// =============================================================================

/// Saves user configuration to disk as JSON.
///
/// # Frontend Usage
/// ```javascript
/// await invoke('save_config', { config: { theme: 'fox', geminiApiKey: '...' } });
/// ```
#[tauri::command]
fn save_config(app_handle: AppHandle, config: serde_json::Value) -> bool {
    // Resolve the app config directory path (platform-specific)
    let config_path = app_handle
        .path()
        .app_config_dir()
        .unwrap()
        .join("config.json");

    // Ensure the parent directory exists
    if let Some(parent) = config_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // Serialize and write the config as pretty-printed JSON
    if let Ok(json) = serde_json::to_string_pretty(&config) {
        if fs::write(&config_path, json).is_ok() {
            println!("[Config] Saved to {:?}", config_path);
            return true;
        }
    }
    false
}

/// Loads user configuration from disk.
/// Returns default config if the file doesn't exist.
///
/// # Frontend Usage
/// ```javascript
/// const config = await invoke('load_config');
/// ```
#[tauri::command]
fn load_config(app_handle: AppHandle) -> serde_json::Value {
    // Resolve the app config directory path
    let config_path = app_handle
        .path()
        .app_config_dir()
        .unwrap()
        .join("config.json");

    // Try to read and parse the config file
    if config_path.exists() {
        if let Ok(content) = fs::read_to_string(&config_path) {
            if let Ok(json) = serde_json::from_str(&content) {
                println!("[Config] Loaded from {:?}", config_path);
                return json;
            }
        }
    }

    // Return default config if file doesn't exist or parsing fails
    serde_json::json!({
        "theme": "fox",
        "geminiApiKey": ""
    })
}

/// Updates the cursor position in shared state.
/// This is called from the frontend to sync the frontend's cursor tracking
/// with the backend's global cursor tracking.
///
/// # Note
/// This is currently used for debugging/fallback, but the primary cursor
/// tracking happens in the input monitoring thread.
#[tauri::command]
fn sync_cursor(state: State<Arc<SharedState>>, x: i32, y: i32) {
    let mut input = state.input_state.lock().unwrap();
    input.cursor_x = x;
    input.cursor_y = y;
}

/// Updates the interactive bounds of UI elements.
/// The frontend tells the backend which screen regions should respond to clicks.
/// This allows the backend to distinguish between clicks on the character vs
/// clicks on empty space (which should pass through to the desktop).
///
/// # Frontend Usage
/// ```javascript
/// await invoke('update_interactive_bounds', {
///     rects: [{ x: 10, y: 20, width: 100, height: 150 }]
/// });
/// ```
#[tauri::command]
fn update_interactive_bounds(state: State<Arc<SharedState>>, rects: Vec<shared::Rect>) {
    let mut input_guard = state.input_state.lock().unwrap();
    input_guard.interactive_rects = rects;
}

/// Updates the specific bounds of the character for click detection.
/// This corresponds to the `update_character_bounds` command called by the frontend.
///
/// # Frontend Usage
/// ```javascript
/// await invoke('update_character_bounds', { x: 100, y: 100, w: 50, h: 50 });
/// ```
#[tauri::command]
fn update_character_bounds(state: State<Arc<SharedState>>, x: i32, y: i32, w: i32, h: i32) {
    let mut input_guard = state.input_state.lock().unwrap();
    // For now, we just replace the interactive rects with this single character rect.
    // In the future, we might want to support multiple rects via `update_interactive_bounds`
    // combined with this, or store them separately.
    // Based on the frontend logic, `update_character_bounds` is the primary way the character receives clicks.
    input_guard.interactive_rects = vec![shared::Rect {
        x,
        y,
        width: w,
        height: h,
    }];
}

/// Returns the path to the external themes directory.
/// Creates it if it doesn't exist.
#[tauri::command]
fn get_themes_dir(app_handle: AppHandle) -> String {
    let config_dir = app_handle.path().app_config_dir().unwrap();
    let themes_dir = config_dir.join("themes");
    if !themes_dir.exists() {
        let _ = fs::create_dir_all(&themes_dir);
    }
    themes_dir.to_string_lossy().to_string()
}

/// Lists all subdirectories in the external themes directory.
#[tauri::command]
fn list_external_themes(app_handle: AppHandle) -> Vec<String> {
    let config_dir = app_handle.path().app_config_dir().unwrap();
    let themes_dir = config_dir.join("themes");

    let mut themes = Vec::new();

    if themes_dir.exists() {
        if let Ok(entries) = fs::read_dir(themes_dir) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_dir() {
                        if let Ok(name) = entry.file_name().into_string() {
                            themes.push(name);
                        }
                    }
                }
            }
        }
    }
    themes
}

// =============================================================================
// Window Management (IPC Commands)
// =============================================================================

/// Checks if any application is currently running in fullscreen mode.
/// Used by the frontend to adjust behavior (e.g., hiding the character).
///
/// # Platform Support
/// - Linux: Uses X11 to query window states
/// - Windows: Uses Win32 API to check for fullscreen windows
#[tauri::command]
fn check_fullscreen() -> bool {
    input::check_fullscreen()
}

// =============================================================================
// Main Application Entry Point
// =============================================================================
// This is where the Tauri app is configured and started.
//
// FLOW:
// 1. Register plugins (global shortcuts, logging)
// 2. Register IPC command handlers
// 3. In setup():
//    a. Detect screen size
//    b. Create shared state for input tracking
//    c. Launch background input monitoring thread
//    d. Apply platform-specific window settings
// 4. Start the event loop
// =============================================================================

fn main() {
    // =========================================================
    // Wayland Fallback: Force XWayland if layer-shell unsupported
    // =========================================================
    // On Wayland, `set_always_on_top` is silently ignored. The proper fix
    // is gtk-layer-shell, but not all compositors support it (e.g. Pantheon's
    // Gala). In those cases, we force the X11/XWayland backend where
    // `set_always_on_top` works reliably. This MUST run before GTK init.
    #[cfg(target_os = "linux")]
    {
        if std::env::var("GDK_BACKEND").is_err() {
            // Only override if the user hasn't explicitly set GDK_BACKEND
            let session_type = std::env::var("XDG_SESSION_TYPE").unwrap_or_default();
            if session_type == "wayland" {
                println!("[Backend] Wayland session detected. Forcing X11 backend for always-on-top support.");
                println!("[Backend] (Set GDK_BACKEND=wayland to override if your compositor supports layer-shell)");
                std::env::set_var("GDK_BACKEND", "x11");
            }
        }
    }

    tauri::Builder::default()
        // Plugin: Global keyboard shortcuts (Meta+Shift+F, etc.)
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Plugin: Logging to stdout/file
        .plugin(tauri_plugin_log::Builder::default().build())
        // Register all IPC commands that the frontend can invoke
        .invoke_handler(tauri::generate_handler![
            save_config,
            load_config,
            check_fullscreen,
            sync_cursor,
            update_interactive_bounds,
            update_character_bounds,
            get_themes_dir,
            list_external_themes
        ])
        // Setup hook: Runs once before the main window is created
        .setup(|app| {
            let app_handle = app.handle().clone();

            // =========================================================
            // Initialize Input Tracking State
            // =========================================================
            // Detect the screen resolution and create a shared state
            // that both the main thread and input thread can access.
            let (screen_width, screen_height) = input::detect_screen_size();
            let shared_state = Arc::new(SharedState {
                input_state: Mutex::new(InputState::new(screen_width, screen_height)),
            });

            // =========================================================
            // Enforce Always-on-Top
            // =========================================================
            // On Wayland, the XWayland fallback at the top of main() ensures
            // we're running with GDK_BACKEND=x11, where this API works.
            // On native X11 sessions, it works out of the box.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_always_on_top(true);
            }

            // Register the shared state with Tauri so IPC commands can access it
            app.manage(shared_state.clone());

            // =========================================================
            // Launch Input Monitoring Thread
            // =========================================================
            // This background thread reads raw input from /dev/input on Linux
            // or the Win32 API on Windows. It tracks the global cursor position
            // and detects global keyboard shortcuts, then emits events to the frontend.
            let app_handle_clone = app_handle.clone();
            thread::spawn(move || {
                input::run_input_loop(app_handle_clone, shared_state);
            });

            // =========================================================
            // Platform-Specific Settings
            // =========================================================
            // On Windows and macOS, we disable the window shadow for a cleaner overlay look
            #[cfg(target_os = "windows")]
            {
                use tauri::Manager;
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(false);
                }
            }

            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(false);
                }
            }

            Ok(())
        })
        // Start the Tauri event loop
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
