// =============================================================================
// Tauri Main Process - AI Character Assistant (Rust Backend)
// =============================================================================
//
// Hello! If you're coming from JavaScript or C#, Welcome to Rust! 🦀
//
// key differences to look out for:
// 1. **Ownership & Borrowing**: Rust doesn't have a Garbage Collector (like JS/C#).
//    Instead, it tracks who "owns" memory at compile time.
//    - `&` means "borrowing" (read-only access, like passing by reference).
//    - `&mut` means "mutable borrowing" (exclusive write access).
// 2. **Option & Result**: Rust has no `null` or `undefined`.
//    - `Option<T>` is `Some(value)` or `None`.
//    - `Result<T, E>` is `Ok(value)` or `Err(error)`.
//    You *must* handle these cases, which makes Rust very safe!
// 3. **Threads**: We use real system threads here, not just an event loop like Node.js.
//
// =============================================================================

// Standard Library Imports
// `use` is like `import` in JS or `using` in C#.
use std::collections::HashSet;
use std::fs;
use std::io::{self, Read};
use std::os::fd::{AsRawFd, BorrowedFd}; // Linux-specific file descriptor stuff
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering}; // Thread-safe booleans
use std::sync::Arc; // "Atomic Reference Count" - safest way to share memory between threads
use std::thread; // For spawning real OS threads

// External Crates (Libraries)
// These are defined in Cargo.toml
use evdev::{Device, InputEventKind, Key, RelativeAxisType}; // For Linux input events
use nix::libc;
use nix::poll::{poll, PollFd, PollFlags}; // "Nix" provides Unix system calls
use serde::Serialize; // "Serde" is the standard for Serialization (like JSON.stringify)
use tauri::{AppHandle, Emitter, Manager}; // Tauri API

// =============================================================================
// Data Structures
// =============================================================================

// #[derive(...)] is an "Attribute" (like Decorators in TS/C#).
// It automatically generates code for us.
// - Serialize: Allows this struct/enum to be turned into JSON automatically.
// - Debug: Allows us to print it to the console with `{:?}`.
// - Clone: Allows us to make copies of it easily.
#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")] // JSON config: { "type": "cursor", ... }
enum OutputEvent {
    // Enum Variants can hold data! This is more powerful than C# Enums.
    // In TS, this is like a Discriminated Union.
    Cursor {
        x: i32,
        y: i32,
    },
    Shortcut {
        name: String,
    },
    Click {
        button: String,
        x: i32,
        y: i32,
    },
    Heartbeat,
    Error {
        message: String,
    },
    Ready {
        mice_count: usize, // `usize` is an unsigned integer the size of your CPU architecture (64-bit)
        keyboards_count: usize,
        screen_width: i32,
        screen_height: i32,
    },
}

// Structs are like Objects in JS or Classes in C#, but data-only.
struct InputState {
    cursor_x: i32,
    cursor_y: i32,
    screen_width: i32,
    screen_height: i32,
    held_modifiers: HashSet<Key>, // A Set of unique keys currently held down
    last_reported_x: i32,
    last_reported_y: i32,
}

// `impl` blocks are where we define methods for our Structs.
// This is where the "Class" behavior lives.
impl InputState {
    // `new` is the convention for constructors in Rust (not a keyword).
    // `Self` refers to the type `InputState`.
    fn new(screen_width: i32, screen_height: i32) -> Self {
        Self {
            cursor_x: screen_width / 2,
            cursor_y: screen_height / 2,
            screen_width,
            screen_height,
            held_modifiers: HashSet::new(),
            last_reported_x: -1,
            last_reported_y: -1,
        }
    }

    // `&mut self` means "I need to modify the data in this struct".
    // If it was just `&self`, it would be read-only.
    fn update_cursor(&mut self, delta_x: i32, delta_y: i32) -> bool {
        self.cursor_x += delta_x;
        self.cursor_y += delta_y;

        // .clamp() is a handy helper method on numbers
        self.cursor_x = self.cursor_x.clamp(0, self.screen_width - 1);
        self.cursor_y = self.cursor_y.clamp(0, self.screen_height - 1);

        let changed =
            self.cursor_x != self.last_reported_x || self.cursor_y != self.last_reported_y;
        if changed {
            self.last_reported_x = self.cursor_x;
            self.last_reported_y = self.cursor_y;
        }
        changed // The last expression in a block is the return value (no `return` keyword needed!)
    }

    fn is_modifier_held(&self, key: Key) -> bool {
        self.held_modifiers.contains(&key)
    }

    // Returns `Option<&'static str>`:
    // - Option: Might receive a string, might receive None.
    // - &'static str: A string literal that lives for the entire program lifetime (like "toggle_chat").
    fn check_shortcut(&self, trigger_key: Key) -> Option<&'static str> {
        // Match expressions are like Switch statements on steroids.
        // We aren't using match here, but `matches!` macro is similar.

        if trigger_key == Key::KEY_F {
            // Meta + Shift + F
            let meta_held = self.is_modifier_held(Key::KEY_LEFTMETA)
                || self.is_modifier_held(Key::KEY_RIGHTMETA);
            let shift_held = self.is_modifier_held(Key::KEY_LEFTSHIFT)
                || self.is_modifier_held(Key::KEY_RIGHTSHIFT);

            if meta_held && shift_held {
                // Return Some(...) to indicate success.
                return Some("toggle_chat");
            }
        }

        if trigger_key == Key::KEY_D {
            // Meta + Shift + D
            let meta_held = self.is_modifier_held(Key::KEY_LEFTMETA)
                || self.is_modifier_held(Key::KEY_RIGHTMETA);
            let shift_held = self.is_modifier_held(Key::KEY_LEFTSHIFT)
                || self.is_modifier_held(Key::KEY_RIGHTSHIFT);

            if meta_held && shift_held {
                return Some("toggle_drag");
            }
        }

        None // Implicit return of None
    }
}

// =============================================================================
// Device Discovery
// =============================================================================

#[derive(Debug, Clone, Copy, PartialEq)]
enum DeviceType {
    Mouse,
    Keyboard,
}

struct OpenDevice {
    device: Device,
    device_type: DeviceType,
    path: String,
}

// Returns a Vector (resizable array) of OpenDevice structs
fn discover_devices() -> Vec<OpenDevice> {
    let mut devices = Vec::new();
    let input_dir = Path::new("/dev/input");

    println!("[Input] Scanning /dev/input/ for devices...");

    let entries = match fs::read_dir(input_dir) {
        Ok(entries) => entries,
        Err(e) => {
            eprintln!("[Input] Error reading /dev/input/: {}", e);
            return devices;
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();

        // Check if filename starts with "event"
        if let Some(name) = path.file_name() {
            if !name.to_string_lossy().starts_with("event") {
                continue;
            }
        }

        print!("[Input] Checking {:?}... ", path);

        // Try to open the device
        match Device::open(&path) {
            Ok(device) => match classify_device(&device) {
                Some(dtype) => {
                    println!("VALID ({:?})", dtype);
                    devices.push(OpenDevice {
                        device,
                        device_type: dtype,
                        path: path.to_string_lossy().to_string(),
                    });
                }
                None => {
                    println!("IGNORED (Not Mouse/Keyboard)");
                }
            },
            Err(e) => {
                println!("FAILED to open: {}", e);
            }
        }
    }

    println!(
        "[Input] Discovery complete. Found {} devices.",
        devices.len()
    );
    devices
}

fn classify_device(device: &Device) -> Option<DeviceType> {
    // Check what capabilities the device reports
    let supported_keys = device.supported_keys();
    let supported_axes = device.supported_relative_axes();

    // If it has REL_X and REL_Y, it's a mouse
    if let Some(axes) = supported_axes {
        if axes.contains(RelativeAxisType::REL_X) && axes.contains(RelativeAxisType::REL_Y) {
            return Some(DeviceType::Mouse);
        }
    }

    // If it has keys A and S, it's probably a keyboard
    if let Some(keys) = supported_keys {
        if keys.contains(Key::KEY_A) && keys.contains(Key::KEY_S) {
            return Some(DeviceType::Keyboard);
        }
    }
    None
}

// =============================================================================
// Event Processing
// =============================================================================

fn process_device_events(
    open_device: &mut OpenDevice, // Mutable reference because reading might change internal buffer state
    state: &mut InputState,       // Mutable reference to update cursor pos
    app_handle: &AppHandle,       // Read-only reference to Tauri app (to send events)
) {
    // Collect all pending events from the kernel
    let events: Vec<_> = match open_device.device.fetch_events() {
        Ok(events) => events.collect(),
        Err(e) if e.raw_os_error() == Some(libc::EAGAIN) => return, // EAGAIN means "no data right now", which is fine
        Err(e) => {
            eprintln!("Error reading {}: {}", open_device.path, e);
            return;
        }
    };

    let mut total_dx = 0;
    let mut total_dy = 0;

    for event in events {
        // Identify the kind of event (Axis move? Key press?)
        match event.kind() {
            InputEventKind::RelAxis(axis) => match axis {
                RelativeAxisType::REL_X => total_dx += event.value(),
                RelativeAxisType::REL_Y => total_dy += event.value(),
                _ => {}
            },
            InputEventKind::Key(key) => {
                // event.value(): 1=Press, 0=Release, 2=Repeat
                let is_pressed = event.value() == 1;
                let is_released = event.value() == 0;

                // Use a macro to check if the key matches any of these modifiers
                let is_modifier = matches!(
                    key,
                    Key::KEY_LEFTSHIFT
                        | Key::KEY_RIGHTSHIFT
                        | Key::KEY_LEFTCTRL
                        | Key::KEY_RIGHTCTRL
                        | Key::KEY_LEFTALT
                        | Key::KEY_RIGHTALT
                        | Key::KEY_LEFTMETA
                        | Key::KEY_RIGHTMETA
                );

                // Update modifier state
                if is_modifier {
                    if is_pressed {
                        state.held_modifiers.insert(key);
                    } else if is_released {
                        state.held_modifiers.remove(&key);
                    }
                }

                if is_pressed {
                    // Check for Mouse Clicks
                    match key {
                        Key::BTN_LEFT => {
                            // .emit() sends the event to the JavaScript frontend!
                            let _ = app_handle.emit(
                                "click",
                                OutputEvent::Click {
                                    button: "left".into(),
                                    x: state.cursor_x,
                                    y: state.cursor_y,
                                },
                            );
                        }
                        Key::BTN_RIGHT => {
                            let _ = app_handle.emit(
                                "click",
                                OutputEvent::Click {
                                    button: "right".into(),
                                    x: state.cursor_x,
                                    y: state.cursor_y,
                                },
                            );
                        }
                        Key::BTN_MIDDLE => {
                            let _ = app_handle.emit(
                                "click",
                                OutputEvent::Click {
                                    button: "middle".into(),
                                    x: state.cursor_x,
                                    y: state.cursor_y,
                                },
                            );
                        }
                        _ => {}
                    }

                    // Check for Shortcuts (if not just pressing a modifier alone)
                    if !is_modifier {
                        if let Some(shortcut) = state.check_shortcut(key) {
                            let _ = app_handle.emit(
                                "shortcut",
                                OutputEvent::Shortcut {
                                    name: shortcut.to_string(),
                                },
                            );
                        }
                    }
                }
            }
            _ => {}
        }
    }

    // After processing all events in this batch, update cursor if it moved
    if total_dx != 0 || total_dy != 0 {
        if state.update_cursor(total_dx, total_dy) {
            let _ = app_handle.emit(
                "cursor-pos",
                OutputEvent::Cursor {
                    x: state.cursor_x,
                    y: state.cursor_y,
                },
            );
        }
    }
}

// =============================================================================
// Screen Size Detection
// =============================================================================
// Tries to find screen size by running generic linux commands (wlr-randr or xrandr)

fn detect_screen_size() -> (i32, i32) {
    // Try Wayland-specific tool first
    if let Ok(output) = std::process::Command::new("wlr-randr").output() {
        if let Some(size) = parse_randr_output(&String::from_utf8_lossy(&output.stdout)) {
            return size;
        }
    }
    // Try X11 tool (sometimes works on Wayland via XWayland)
    if let Ok(output) = std::process::Command::new("xrandr").output() {
        if let Some(size) = parse_randr_output(&String::from_utf8_lossy(&output.stdout)) {
            return size;
        }
    }
    // Fallback
    (1920, 1080)
}

fn parse_randr_output(output: &str) -> Option<(i32, i32)> {
    // Parse "1920x1080" from existing text logic
    for line in output.lines() {
        if line.contains(" connected") || line.contains("current") {
            for word in line.split_whitespace() {
                if let Some((w, h)) = word.split_once('x') {
                    // Try to parse integers
                    if let (Ok(width), Ok(height)) = (
                        w.trim_matches(|c: char| !c.is_ascii_digit()).parse::<i32>(),
                        h.trim_matches(|c: char| !c.is_ascii_digit()).parse::<i32>(),
                    ) {
                        if width > 0 && height > 0 {
                            return Some((width, height));
                        }
                    }
                }
            }
        }
    }
    None
}

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

// =============================================================================
// Main Application Entry Point
// =============================================================================

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_log::Builder::default().build()) // Enable logging
        .invoke_handler(tauri::generate_handler![save_config, load_config]) // Register commands
        // .setup is where we initialize things when the app starts.
        .setup(|app| {
            // We need a handle to the app to send events from our background thread.
            // app.handle().clone() creates a lightweight copy we can pass around.
            let app_handle = app.handle().clone();

            // SPAWN A BACKGROUND THREAD 🧵
            // Rust threads are real OS threads. This runs in parallel to the UI.
            thread::spawn(move || {
                // Initialize state
                let (screen_width, screen_height) = detect_screen_size();
                let mut state = InputState::new(screen_width, screen_height);
                let mut devices = discover_devices();

                // Special file that aggregates all mice (useful fallback)
                let mut mice_file = std::fs::File::open("/dev/input/mice").ok();

                // Identify connected devices for logging
                let mice_count = devices
                    .iter()
                    .filter(|d| d.device_type == DeviceType::Mouse)
                    .count();
                let keyboards_count = devices
                    .iter()
                    .filter(|d| d.device_type == DeviceType::Keyboard)
                    .count();

                // Tell Frontend we are ready
                let _ = app_handle.emit(
                    "ready",
                    OutputEvent::Ready {
                        mice_count: mice_count + if mice_file.is_some() { 1 } else { 0 },
                        keyboards_count,
                        screen_width,
                        screen_height,
                    },
                );

                println!(
                    "[Tauri Input] Thread started. Monitor: {}x{}",
                    screen_width, screen_height
                );

                // THE EVENT LOOP 🔄
                // fast loop that waits for input events
                loop {
                    // Create a list of file descriptors to "poll" (watch)
                    let mut poll_fds = Vec::new();

                    // Add all individual devices
                    for d in &devices {
                        // UNSAFE BLOCK: "Trust me, I know what I'm doing"
                        // We need raw access to the file descriptor for the `poll` system call.
                        // This is standard when interfacing with C libraries or Kernel APIs.
                        let borrowed = unsafe { BorrowedFd::borrow_raw(d.device.as_raw_fd()) };
                        poll_fds.push(PollFd::new(borrowed, PollFlags::POLLIN));
                    }

                    // Add legacy mouse file
                    if let Some(ref f) = mice_file {
                        let borrowed = unsafe { BorrowedFd::borrow_raw(f.as_raw_fd()) };
                        poll_fds.push(PollFd::new(borrowed, PollFlags::POLLIN));
                    }

                    // WAIT for an event (Timeout: 1000ms)
                    // This pauses the thread until data is available, so we don't use 100% CPU.
                    if let Ok(n) = poll(&mut poll_fds, nix::poll::PollTimeout::from(1000u16)) {
                        if n > 0 {
                            // Check which device has data
                            for (i, d) in devices.iter_mut().enumerate() {
                                if let Some(revents) = poll_fds[i].revents() {
                                    if revents.contains(PollFlags::POLLIN) {
                                        // Process it!
                                        process_device_events(d, &mut state, &app_handle);
                                    }
                                }
                            }

                            // Check legacy mouse file
                            if mice_file.is_some() {
                                let idx = poll_fds.len() - 1;
                                if let Some(revents) = poll_fds[idx].revents() {
                                    if revents.contains(PollFlags::POLLIN) {
                                        // PS/2 Protocol parsing (Legacy stuff)
                                        let mut buf = [0u8; 3];
                                        if let Some(ref mut f) = mice_file {
                                            if let Ok(3) = f.read(&mut buf) {
                                                let rel_x = buf[1] as i8 as i32;
                                                let rel_y = -(buf[2] as i8 as i32);
                                                if state.update_cursor(rel_x, rel_y) {
                                                    let _ = app_handle.emit(
                                                        "cursor-pos",
                                                        OutputEvent::Cursor {
                                                            x: state.cursor_x,
                                                            y: state.cursor_y,
                                                        },
                                                    );
                                                }
                                                // Check clicks (Byte 0 bitmask)
                                                if (buf[0] & 1) != 0 {
                                                    let _ = app_handle.emit(
                                                        "click",
                                                        OutputEvent::Click {
                                                            button: "left".into(),
                                                            x: state.cursor_x,
                                                            y: state.cursor_y,
                                                        },
                                                    );
                                                }
                                                if (buf[0] & 2) != 0 {
                                                    let _ = app_handle.emit(
                                                        "click",
                                                        OutputEvent::Click {
                                                            button: "right".into(),
                                                            x: state.cursor_x,
                                                            y: state.cursor_y,
                                                        },
                                                    );
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
