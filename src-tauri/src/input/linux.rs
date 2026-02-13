#[cfg(target_os = "linux")]
use crate::shared::{InputState, KeyCode, OutputEvent, SharedState};
#[cfg(target_os = "linux")]
use evdev::{Device, InputEventKind, Key, RelativeAxisType};
#[cfg(target_os = "linux")]
use nix::libc;
#[cfg(target_os = "linux")]
use nix::poll::{poll, PollFd, PollFlags};
#[cfg(target_os = "linux")]
use std::fs;
#[cfg(target_os = "linux")]
use std::io::Read;
#[cfg(target_os = "linux")]
use std::os::fd::{AsRawFd, BorrowedFd};
#[cfg(target_os = "linux")]
use std::path::Path;
#[cfg(target_os = "linux")]
use std::sync::Arc;
#[cfg(target_os = "linux")]
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "linux")]
#[derive(Debug, Clone, Copy, PartialEq)]
enum DeviceType {
    Mouse,
    Keyboard,
}

#[cfg(target_os = "linux")]
struct OpenDevice {
    device: Device,
    device_type: DeviceType,
    path: String,
}

#[cfg(target_os = "linux")]
pub fn detect_screen_size() -> (i32, i32) {
    if let Ok(output) = std::process::Command::new("wlr-randr").output() {
        if let Some(size) = parse_randr_output(&String::from_utf8_lossy(&output.stdout)) {
            return size;
        }
    }
    if let Ok(output) = std::process::Command::new("xrandr").output() {
        if let Some(size) = parse_randr_output(&String::from_utf8_lossy(&output.stdout)) {
            return size;
        }
    }
    (1920, 1080)
}

#[cfg(target_os = "linux")]
fn parse_randr_output(output: &str) -> Option<(i32, i32)> {
    for line in output.lines() {
        if line.contains(" connected") || line.contains("current") {
            for word in line.split_whitespace() {
                if let Some((w, h)) = word.split_once('x') {
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

#[cfg(target_os = "linux")]
pub fn check_fullscreen() -> bool {
    let active_window_output = std::process::Command::new("xprop")
        .args(&["-root", "_NET_ACTIVE_WINDOW"])
        .output();

    let window_id = match active_window_output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(pos) = stdout.find("window id # ") {
                let id_part = &stdout[pos + 12..];
                id_part.trim().to_string()
            } else {
                return false;
            }
        }
        Err(_) => return false,
    };

    let state_output = std::process::Command::new("xprop")
        .args(&["-id", &window_id, "_NET_WM_STATE"])
        .output();

    match state_output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            stdout.contains("_NET_WM_STATE_FULLSCREEN")
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "linux")]
fn map_key_code(key: Key) -> Option<KeyCode> {
    match key {
        Key::KEY_LEFTSHIFT => Some(KeyCode::LeftShift),
        Key::KEY_RIGHTSHIFT => Some(KeyCode::RightShift),
        Key::KEY_LEFTCTRL => Some(KeyCode::LeftCtrl),
        Key::KEY_RIGHTCTRL => Some(KeyCode::RightCtrl),
        Key::KEY_LEFTALT => Some(KeyCode::LeftAlt),
        Key::KEY_RIGHTALT => Some(KeyCode::RightAlt),
        Key::KEY_LEFTMETA => Some(KeyCode::LeftMeta),
        Key::KEY_RIGHTMETA => Some(KeyCode::RightMeta),
        Key::KEY_F => Some(KeyCode::F),
        Key::KEY_D => Some(KeyCode::D),
        Key::KEY_S => Some(KeyCode::S),
        Key::KEY_C => Some(KeyCode::C),
        Key::KEY_A => Some(KeyCode::A),
        _ => None,
    }
}

#[cfg(target_os = "linux")]
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
        if let Some(name) = path.file_name() {
            if !name.to_string_lossy().starts_with("event") {
                continue;
            }
        }

        print!("[Input] Checking {:?}... ", path);
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
    devices
}

#[cfg(target_os = "linux")]
fn classify_device(device: &Device) -> Option<DeviceType> {
    let supported_keys = device.supported_keys();
    let supported_axes = device.supported_relative_axes();

    if let Some(axes) = supported_axes {
        if axes.contains(RelativeAxisType::REL_X) && axes.contains(RelativeAxisType::REL_Y) {
            return Some(DeviceType::Mouse);
        }
    }

    if let Some(keys) = supported_keys {
        if keys.contains(Key::KEY_A) && keys.contains(Key::KEY_S) {
            return Some(DeviceType::Keyboard);
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn process_device_events(
    open_device: &mut OpenDevice,
    state: &mut InputState,
    app_handle: &AppHandle,
) {
    let events: Vec<_> = match open_device.device.fetch_events() {
        Ok(events) => events.collect(),
        Err(e) if e.raw_os_error() == Some(libc::EAGAIN) => return,
        Err(e) => {
            eprintln!("Error reading {}: {}", open_device.path, e);
            return;
        }
    };

    let mut total_dx = 0;
    let mut total_dy = 0;

    for event in events {
        match event.kind() {
            InputEventKind::RelAxis(axis) => match axis {
                RelativeAxisType::REL_X => total_dx += event.value(),
                RelativeAxisType::REL_Y => total_dy += event.value(),
                _ => {}
            },
            InputEventKind::Key(key) => {
                let is_pressed = event.value() == 1;
                let is_released = event.value() == 0;

                // Modifiers
                if let Some(shared_key) = map_key_code(key) {
                    if is_pressed {
                        state.held_modifiers.insert(shared_key);
                    } else if is_released {
                        state.held_modifiers.remove(&shared_key);
                    }
                    // Shortcuts
                    if is_pressed {
                        if let Some(shortcut) = state.check_shortcut(shared_key) {
                            let _ = app_handle.emit(
                                "shortcut",
                                OutputEvent::Shortcut {
                                    name: shortcut.to_string(),
                                },
                            );
                        }
                    }
                }

                if is_pressed {
                    // Clicks
                    match key {
                        Key::BTN_LEFT => {
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
                    let _ = app_handle.emit("activity", OutputEvent::Activity);
                }
            }
            _ => {}
        }
    }

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

#[cfg(target_os = "linux")]
pub fn run_input_loop(app_handle: AppHandle, shared_state: Arc<SharedState>) {
    let mut devices = discover_devices();
    let mut mice_file = std::fs::File::open("/dev/input/mice").ok();

    let mice_count = devices
        .iter()
        .filter(|d| d.device_type == DeviceType::Mouse)
        .count();
    let keyboards_count = devices
        .iter()
        .filter(|d| d.device_type == DeviceType::Keyboard)
        .count();

    let screen_width = shared_state.input_state.lock().unwrap().screen_width;
    let screen_height = shared_state.input_state.lock().unwrap().screen_height;

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

    loop {
        let mut poll_fds = Vec::new();

        for d in &devices {
            let borrowed = unsafe { BorrowedFd::borrow_raw(d.device.as_raw_fd()) };
            poll_fds.push(PollFd::new(borrowed, PollFlags::POLLIN));
        }

        if let Some(ref f) = mice_file {
            let borrowed = unsafe { BorrowedFd::borrow_raw(f.as_raw_fd()) };
            poll_fds.push(PollFd::new(borrowed, PollFlags::POLLIN));
        }

        if let Ok(n) = poll(&mut poll_fds, nix::poll::PollTimeout::from(1000u16)) {
            if n > 0 {
                for (i, d) in devices.iter_mut().enumerate() {
                    if let Some(revents) = poll_fds[i].revents() {
                        if revents.contains(PollFlags::POLLIN) {
                            let mut input_state = shared_state.input_state.lock().unwrap();
                            process_device_events(d, &mut input_state, &app_handle);
                        }
                    }
                }

                if mice_file.is_some() {
                    let idx = poll_fds.len() - 1;
                    if let Some(revents) = poll_fds[idx].revents() {
                        if revents.contains(PollFlags::POLLIN) {
                            let mut buf = [0u8; 3];
                            if let Some(ref mut f) = mice_file {
                                if let Ok(3) = f.read(&mut buf) {
                                    let rel_x = buf[1] as i8 as i32;
                                    let rel_y = -(buf[2] as i8 as i32);

                                    let mut input_state = shared_state.input_state.lock().unwrap();
                                    if input_state.update_cursor(rel_x, rel_y) {
                                        let _ = app_handle.emit(
                                            "cursor-pos",
                                            OutputEvent::Cursor {
                                                x: input_state.cursor_x,
                                                y: input_state.cursor_y,
                                            },
                                        );
                                    }
                                    if (buf[0] & 1) != 0 {
                                        let _ = app_handle.emit(
                                            "click",
                                            OutputEvent::Click {
                                                button: "left".into(),
                                                x: input_state.cursor_x,
                                                y: input_state.cursor_y,
                                            },
                                        );
                                    }

                                    if (buf[0] & 2) != 0 {
                                        let _ = app_handle.emit(
                                            "click",
                                            OutputEvent::Click {
                                                button: "right".into(),
                                                x: input_state.cursor_x,
                                                y: input_state.cursor_y,
                                            },
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                let _ = app_handle.emit("heartbeat", OutputEvent::Heartbeat);
            }
        }
    }
}
