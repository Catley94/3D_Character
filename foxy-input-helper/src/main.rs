// =============================================================================
// Foxy Input Helper - Main Entry Point
// =============================================================================
//
// This program reads directly from Linux input devices (/dev/input/event*)
// to provide global mouse cursor position and keyboard shortcut detection.
//
// WHY DO WE NEED THIS?
// --------------------
// On Wayland, applications cannot access global cursor position due to
// security restrictions. The compositor intentionally hides this information
// to prevent apps from spying on each other.
//
// However, we can bypass this by reading directly from the kernel's input
// subsystem. The kernel exposes all input devices as "event devices" in
// /dev/input/. By reading these raw events, we can track the mouse position
// ourselves!
//
// PERMISSIONS REQUIRED
// --------------------
// The user must be in the 'input' group to read from /dev/input/:
//   sudo usermod -a -G input $USER
//   (then log out and back in)
//
// HOW IT WORKS
// ------------
// 1. Scan /dev/input/ for mouse and keyboard devices
// 2. Open each device and poll for events
// 3. For mouse: accumulate REL_X and REL_Y events to track position
// 4. For keyboard: track modifier keys and detect our shortcut combo
// 5. Output events as JSON lines to stdout for Electron to read
//
// =============================================================================

// -----------------------------------------------------------------------------
// Standard Library Imports
// -----------------------------------------------------------------------------
use std::collections::HashSet;
use std::fs;
use std::io::{self, Write};
use std::os::fd::{AsRawFd, BorrowedFd};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

// -----------------------------------------------------------------------------
// External Crate Imports
// -----------------------------------------------------------------------------
use evdev::{Device, InputEventKind, Key, RelativeAxisType};
use nix::libc;
use nix::poll::{poll, PollFd, PollFlags};
use serde::Serialize;
use signal_hook::consts::signal::*;
use signal_hook::flag as signal_flag;

// =============================================================================
// Data Structures
// =============================================================================

/// Represents an event that we send to Electron via stdout.
/// The #[derive(Serialize)] tells serde to auto-generate JSON conversion code.
/// The #[serde(tag = "type")] means the "type" field will indicate which variant.
#[derive(Serialize, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
enum OutputEvent {
    /// Cursor position update - sent whenever the mouse moves
    Cursor { x: i32, y: i32 },

    /// A configured keyboard shortcut was pressed
    Shortcut { name: String },

    /// Mouse button was clicked
    Click { button: String, x: i32, y: i32 },

    /// Heartbeat to let Electron know we're still alive
    Heartbeat,

    /// Error message for debugging
    Error { message: String },

    /// Initial startup message with device info
    Ready {
        mice_count: usize,
        keyboards_count: usize,
        screen_width: i32,
        screen_height: i32,
    },
}

/// Tracks the current state of the cursor and input devices
struct InputState {
    /// Current cursor X position (accumulated from relative movements)
    cursor_x: i32,

    /// Current cursor Y position (accumulated from relative movements)  
    cursor_y: i32,

    /// Screen width in pixels - used to clamp cursor position
    screen_width: i32,

    /// Screen height in pixels - used to clamp cursor position
    screen_height: i32,

    /// Set of currently held modifier keys (Meta, Shift, Ctrl, Alt)
    /// We use Key (from evdev) as the type - it represents keyboard keys
    held_modifiers: HashSet<Key>,

    /// Last reported cursor position - we only send updates when it changes
    last_reported_x: i32,
    last_reported_y: i32,
}

impl InputState {
    /// Create a new InputState with the given screen dimensions
    fn new(screen_width: i32, screen_height: i32) -> Self {
        Self {
            // Start cursor in the center of the screen
            cursor_x: screen_width / 2,
            cursor_y: screen_height / 2,
            screen_width,
            screen_height,
            held_modifiers: HashSet::new(),
            last_reported_x: -1, // -1 means "never reported"
            last_reported_y: -1,
        }
    }

    /// Update cursor position from relative mouse movement.
    /// Returns true if the position actually changed.
    fn update_cursor(&mut self, delta_x: i32, delta_y: i32) -> bool {
        // Add the relative movement to our tracked position
        self.cursor_x += delta_x;
        self.cursor_y += delta_y;

        // Clamp to screen bounds (don't let cursor go off-screen)
        // This is important because we're tracking position ourselves,
        // so we need to enforce boundaries that the compositor normally handles
        self.cursor_x = self.cursor_x.clamp(0, self.screen_width - 1);
        self.cursor_y = self.cursor_y.clamp(0, self.screen_height - 1);

        // Check if position actually changed from last report
        let changed =
            self.cursor_x != self.last_reported_x || self.cursor_y != self.last_reported_y;

        if changed {
            self.last_reported_x = self.cursor_x;
            self.last_reported_y = self.cursor_y;
        }

        changed
    }

    /// Check if a specific modifier key is currently held down
    fn is_modifier_held(&self, key: Key) -> bool {
        self.held_modifiers.contains(&key)
    }

    /// Check if our target shortcut (Meta+Shift+F) is being pressed.
    /// Called when 'F' key is pressed - we check if modifiers are held.
    fn check_shortcut(&self, trigger_key: Key) -> Option<&'static str> {
        // Our target shortcut: Meta (Super/Windows key) + Shift + F
        // You can easily add more shortcuts here!

        if trigger_key == Key::KEY_F {
            // Check if both Meta (left or right) and Shift (left or right) are held
            let meta_held = self.is_modifier_held(Key::KEY_LEFTMETA)
                || self.is_modifier_held(Key::KEY_RIGHTMETA);
            let shift_held = self.is_modifier_held(Key::KEY_LEFTSHIFT)
                || self.is_modifier_held(Key::KEY_RIGHTSHIFT);

            if meta_held && shift_held {
                return Some("toggle_chat");
            }
        } else if trigger_key == Key::KEY_D {
            // Check if both Meta (left or right) and Shift (left or right) are held
            let meta_held = self.is_modifier_held(Key::KEY_LEFTMETA)
                || self.is_modifier_held(Key::KEY_RIGHTMETA);
            let shift_held = self.is_modifier_held(Key::KEY_LEFTSHIFT)
                || self.is_modifier_held(Key::KEY_RIGHTSHIFT);

            if meta_held && shift_held {
                return Some("toggle_drag");
            }
        }

        None
    }
}

// =============================================================================
// Device Discovery
// =============================================================================

/// Represents a type of input device we're interested in
#[derive(Debug, Clone, Copy, PartialEq)]
enum DeviceType {
    Mouse,
    Keyboard,
}

/// Holds an opened input device along with its type
struct OpenDevice {
    device: Device,
    device_type: DeviceType,
    path: String,
}

/// Scan /dev/input/ and find all mouse and keyboard devices.
///
/// How device detection works:
/// - Each device has "capabilities" that describe what events it can produce
/// - Mice have REL_X and REL_Y (relative axis) capabilities
/// - Keyboards have key capabilities for the alphabet keys
///
/// Returns a vector of opened devices ready for reading.
fn discover_devices() -> Vec<OpenDevice> {
    let mut devices = Vec::new();

    // The input devices are in /dev/input/
    let input_dir = Path::new("/dev/input");

    // Read all entries in the directory
    let entries = match fs::read_dir(input_dir) {
        Ok(entries) => entries,
        Err(e) => {
            eprintln!("[foxy-input-helper] ERROR: Cannot read /dev/input/: {}", e);
            eprintln!("[foxy-input-helper] Make sure you're in the 'input' group!");
            eprintln!("[foxy-input-helper] Run: sudo usermod -a -G input $USER");
            return devices;
        }
    };

    // Check each file in /dev/input/
    for entry in entries.flatten() {
        let path = entry.path();

        // We only care about "event" devices (event0, event1, etc.)
        // There are also "mouse" and "js" devices, but event devices
        // give us the most detailed information
        if let Some(name) = path.file_name() {
            if !name.to_string_lossy().starts_with("event") {
                continue;
            }
        }

        // Try to open the device
        let device = match Device::open(&path) {
            Ok(d) => d,
            Err(e) => {
                // Permission denied is common for devices we don't need
                // Only log if it's a different error
                if !e.to_string().contains("Permission denied") {
                    eprintln!("[foxy-input-helper] Could not open {:?}: {}", path, e);
                }
                continue;
            }
        };

        // Determine what type of device this is based on its capabilities
        let device_type = classify_device(&device);

        // DEBUG: Log everything we find
        let path_str = path.to_string_lossy().to_string();
        let name = device.name().unwrap_or("Unknown").to_string();

        match device_type {
            Some(dtype) => {
                eprintln!(
                    "[foxy-input-helper] ACCEPTED {:?}: {} ({})",
                    dtype, name, path_str
                );
                devices.push(OpenDevice {
                    device,
                    device_type: dtype,
                    path: path_str,
                });
            }
            None => {
                // Check why it was rejected
                let supported = device.supported_keys();
                let rel_axes = device.supported_relative_axes();
                let abs_axes = device.supported_absolute_axes();

                eprintln!("[foxy-input-helper] SKIPPED: {} ({})", name, path_str);
                if let Some(rel) = rel_axes {
                    eprintln!("  -> Rel Axes: {:?}", rel);
                }
                if let Some(abs) = abs_axes {
                    eprintln!("  -> Abs Axes: {:?}", abs);
                }
                if supported.is_none() && rel_axes.is_none() && abs_axes.is_none() {
                    eprintln!("  -> No capabilities detected");
                }
            }
        }
    }

    devices
}

/// Classify a device as Mouse, Keyboard, or None (if we don't care about it).
///
/// We check the device's "capabilities" - what types of events it can produce.
fn classify_device(device: &Device) -> Option<DeviceType> {
    // Get the supported event types
    let supported = device.supported_keys();
    let rel_axes = device.supported_relative_axes();

    // Check for mouse: needs to have relative X and Y axes
    // (REL_X and REL_Y are how mice report movement)
    if let Some(axes) = rel_axes {
        if axes.contains(RelativeAxisType::REL_X) && axes.contains(RelativeAxisType::REL_Y) {
            return Some(DeviceType::Mouse);
        }
    }

    // Check for keyboard: needs to have letter keys
    // We check for a few common keys to confirm it's a real keyboard
    if let Some(keys) = supported {
        // Check for A, S, D, F keys (home row on QWERTY)
        let has_keyboard_keys = keys.contains(Key::KEY_A)
            && keys.contains(Key::KEY_S)
            && keys.contains(Key::KEY_D)
            && keys.contains(Key::KEY_F);

        if has_keyboard_keys {
            return Some(DeviceType::Keyboard);
        }
    }

    // Not a device type we're interested in
    None
}

// =============================================================================
// Event Processing
// =============================================================================

/// Process events from a single device.
/// This is called when poll() tells us a device has events ready.
///
/// # Arguments
/// * `open_device` - The device to read from
/// * `state` - Our cursor/keyboard state to update
/// * `stdout` - Where to write JSON output
fn process_device_events(
    open_device: &mut OpenDevice,
    state: &mut InputState,
    stdout: &mut io::StdoutLock,
) {
    // fetch_events() returns an iterator over available events
    // We need to collect them because the iterator borrows the device
    let events: Vec<_> = match open_device.device.fetch_events() {
        Ok(events) => events.collect(),
        Err(e) => {
            // EAGAIN means "no events available" - this is normal
            if e.raw_os_error() != Some(libc::EAGAIN) {
                eprintln!(
                    "[foxy-input-helper] Error reading {}: {}",
                    open_device.path, e
                );
            }
            return;
        }
    };

    eprintln!(
        "[foxy-input-helper] Fetched {} events from {}",
        events.len(),
        open_device.path
    );

    // Accumulate mouse movement before sending update
    // (we might get multiple move events per read)
    let mut total_dx = 0i32;
    let mut total_dy = 0i32;

    for event in events {
        // DEBUG: Print all events to understand what the device is doing
        eprintln!("RAW EVENT: {:?}", event);

        match event.kind() {
            // -----------------------------------------------------------------
            // Relative axis events (mouse movement)
            // -----------------------------------------------------------------
            InputEventKind::RelAxis(axis) => {
                eprintln!("REL EVENT: {:?} val={}", axis, event.value());
                match axis {
                    RelativeAxisType::REL_X => {
                        // Horizontal mouse movement
                        total_dx += event.value();
                    }
                    RelativeAxisType::REL_Y => {
                        // Vertical mouse movement
                        total_dy += event.value();
                    }
                    _ => {
                        // Other axes like scroll wheel - we ignore for now
                    }
                }
            }
            InputEventKind::AbsAxis(_axis) => {
                // DEBUG: Log absolute events too, just in case
                eprintln!("ABS EVENT: {:?} val={}", _axis, event.value());
            }

            // -----------------------------------------------------------------
            // Key events (keyboard presses and mouse buttons)
            // -----------------------------------------------------------------
            InputEventKind::Key(key) => {
                // event.value(): 0 = released, 1 = pressed, 2 = repeat
                let is_pressed = event.value() == 1;
                let is_released = event.value() == 0;

                // Check if this is a modifier key we need to track
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

                if is_modifier {
                    if is_pressed {
                        state.held_modifiers.insert(key);
                    } else if is_released {
                        state.held_modifiers.remove(&key);
                    }
                }

                // Check for mouse buttons
                match key {
                    Key::BTN_LEFT if is_pressed => {
                        send_event(
                            stdout,
                            &OutputEvent::Click {
                                button: "left".to_string(),
                                x: state.cursor_x,
                                y: state.cursor_y,
                            },
                        );
                    }
                    Key::BTN_RIGHT if is_pressed => {
                        send_event(
                            stdout,
                            &OutputEvent::Click {
                                button: "right".to_string(),
                                x: state.cursor_x,
                                y: state.cursor_y,
                            },
                        );
                    }
                    Key::BTN_MIDDLE if is_pressed => {
                        send_event(
                            stdout,
                            &OutputEvent::Click {
                                button: "middle".to_string(),
                                x: state.cursor_x,
                                y: state.cursor_y,
                            },
                        );
                    }
                    _ => {}
                }

                // Check for keyboard shortcuts (only on key press, not release)
                if is_pressed && !is_modifier {
                    if let Some(shortcut_name) = state.check_shortcut(key) {
                        eprintln!("[foxy-input-helper] Shortcut detected: {}", shortcut_name);
                        send_event(
                            stdout,
                            &OutputEvent::Shortcut {
                                name: shortcut_name.to_string(),
                            },
                        );
                    }
                }
            }

            // Ignore other event types (sync events, etc.)
            _ => {}
        }
    }

    // If mouse moved, update cursor position and send update
    if total_dx != 0 || total_dy != 0 {
        if state.update_cursor(total_dx, total_dy) {
            send_event(
                stdout,
                &OutputEvent::Cursor {
                    x: state.cursor_x,
                    y: state.cursor_y,
                },
            );
        }
    }
}

/// Send an event to stdout as a JSON line.
/// Each event is on its own line, making it easy to parse.
fn send_event(stdout: &mut io::StdoutLock, event: &OutputEvent) {
    // Serialize to JSON
    if let Ok(json) = serde_json::to_string(event) {
        // Write JSON followed by newline
        let _ = writeln!(stdout, "{}", json);
        // Flush immediately so Electron receives it right away
        let _ = stdout.flush();
    }
}

// =============================================================================
// Screen Size Detection
// =============================================================================

/// Try to detect the screen size.
///
/// We try multiple methods since Wayland makes this tricky:
/// 1. Environment variables (some compositors set these)
/// 2. Parse output of wlr-randr or xrandr
/// 3. Default to 1920x1080 if all else fails
fn detect_screen_size() -> (i32, i32) {
    // Try environment variables first
    if let (Ok(w), Ok(h)) = (
        std::env::var("SCREEN_WIDTH"),
        std::env::var("SCREEN_HEIGHT"),
    ) {
        if let (Ok(width), Ok(height)) = (w.parse(), h.parse()) {
            eprintln!(
                "[foxy-input-helper] Screen size from env: {}x{}",
                width, height
            );
            return (width, height);
        }
    }

    // Try running wlr-randr (works on wlroots-based compositors)
    if let Ok(output) = std::process::Command::new("wlr-randr").output() {
        if let Some(size) = parse_randr_output(&String::from_utf8_lossy(&output.stdout)) {
            eprintln!(
                "[foxy-input-helper] Screen size from wlr-randr: {}x{}",
                size.0, size.1
            );
            return size;
        }
    }

    // Try xrandr (works on X11 and some Wayland with XWayland)
    if let Ok(output) = std::process::Command::new("xrandr").output() {
        if let Some(size) = parse_randr_output(&String::from_utf8_lossy(&output.stdout)) {
            eprintln!(
                "[foxy-input-helper] Screen size from xrandr: {}x{}",
                size.0, size.1
            );
            return size;
        }
    }

    // Default fallback
    eprintln!("[foxy-input-helper] Using default screen size: 1920x1080");
    (1920, 1080)
}

/// Parse output from xrandr or wlr-randr to find screen resolution.
/// Looks for patterns like "1920x1080" in the output.
fn parse_randr_output(output: &str) -> Option<(i32, i32)> {
    // Look for the first line with a resolution pattern
    for line in output.lines() {
        // Look for " connected" lines which show the active resolution
        if line.contains(" connected") || line.contains("current") {
            // Find resolution pattern like "1920x1080"
            for word in line.split_whitespace() {
                if let Some((w, h)) = word.split_once('x') {
                    // Try to parse both parts as numbers
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
// Main Entry Point
// =============================================================================

fn main() {
    eprintln!("===========================================");
    eprintln!(" Foxy Input Helper v0.1.0");
    eprintln!(" Reading from /dev/input for Wayland support");
    eprintln!("===========================================");

    // -------------------------------------------------------------------------
    // Set up signal handling for graceful shutdown
    // -------------------------------------------------------------------------
    // When the user presses Ctrl+C or Electron terminates us,
    // we want to exit cleanly rather than just dying.
    let running = Arc::new(AtomicBool::new(true));

    // Register signal handlers
    // These will set 'running' to false when SIGINT or SIGTERM is received
    signal_flag::register(SIGINT, Arc::clone(&running)).ok();
    signal_flag::register(SIGTERM, Arc::clone(&running)).ok();

    // -------------------------------------------------------------------------
    // Detect screen size for cursor bounds
    // -------------------------------------------------------------------------
    let (screen_width, screen_height) = detect_screen_size();

    // -------------------------------------------------------------------------
    // Discover and open input devices
    // -------------------------------------------------------------------------
    let mut devices = discover_devices();

    // Count device types for the ready message
    let mice_count = devices
        .iter()
        .filter(|d| d.device_type == DeviceType::Mouse)
        .count();
    let keyboards_count = devices
        .iter()
        .filter(|d| d.device_type == DeviceType::Keyboard)
        .count();

    if devices.is_empty() {
        eprintln!("[foxy-input-helper] ERROR: No input devices found!");
        eprintln!("[foxy-input-helper] Make sure you're in the 'input' group.");
        std::process::exit(1);
    }

    eprintln!(
        "[foxy-input-helper] Found {} mice and {} keyboards",
        mice_count, keyboards_count
    );

    // -------------------------------------------------------------------------
    // Initialize state and output
    // -------------------------------------------------------------------------
    // -------------------------------------------------------------------------
    // Open /dev/input/mice for aggregated relative motion (handles touchpads too)
    // -------------------------------------------------------------------------
    // We store it as Option<File> so we can easily check existence and borrow mutably
    let mut mice_file: Option<std::fs::File> = match std::fs::File::open("/dev/input/mice") {
        Ok(f) => {
            eprintln!("[foxy-input-helper] Successfully opened /dev/input/mice");
            Some(f)
        }
        Err(e) => {
            eprintln!(
                "[foxy-input-helper] WARNING: Could not open /dev/input/mice: {}",
                e
            );
            eprintln!("[foxy-input-helper] Cursor tracking might not work for touchpads.");
            None
        }
    };
    let has_mice_file = mice_file.is_some();

    // -------------------------------------------------------------------------
    // Initialize state and output
    // -------------------------------------------------------------------------
    let mut state = InputState::new(screen_width, screen_height);
    let stdout = io::stdout();
    let mut stdout_lock = stdout.lock();

    // Send ready message
    send_event(
        &mut stdout_lock,
        &OutputEvent::Ready {
            mice_count: if has_mice_file { 1 } else { 0 },
            keyboards_count,
            screen_width,
            screen_height,
        },
    );

    eprintln!("[foxy-input-helper] Starting event loop...");

    while running.load(Ordering::Relaxed) {
        let mut poll_fds = Vec::new();

        // 1. Add evdev devices (Keyboards + specific mice)
        for d in &devices {
            // SAFETY: devices owned by us
            let borrowed = unsafe { BorrowedFd::borrow_raw(d.device.as_raw_fd()) };
            poll_fds.push(PollFd::new(borrowed, PollFlags::POLLIN));
        }

        // 2. Add /dev/input/mice if available
        if let Some(ref f) = mice_file {
            let borrowed = unsafe { BorrowedFd::borrow_raw(f.as_raw_fd()) };
            poll_fds.push(PollFd::new(borrowed, PollFlags::POLLIN));
        }

        // Wait for events
        match poll(&mut poll_fds, nix::poll::PollTimeout::from(1000u16)) {
            Ok(n) if n > 0 => {
                // Check normal evdev devices
                for (i, d) in devices.iter_mut().enumerate() {
                    if let Some(revents) = poll_fds[i].revents() {
                        if revents.contains(PollFlags::POLLIN) {
                            process_device_events(d, &mut state, &mut stdout_lock);
                        }
                    }
                }

                // Check /dev/input/mice (last defined FD)
                if has_mice_file {
                    let mice_fd_idx = poll_fds.len() - 1;
                    if let Some(revents) = poll_fds[mice_fd_idx].revents() {
                        if revents.contains(PollFlags::POLLIN) {
                            // Read 3-byte PS/2 packet
                            // Byte 0: Yovfl Xovfl Ysign Xsign 1 Mid Right Left
                            // Byte 1: X movement
                            // Byte 2: Y movement
                            let mut buf = [0u8; 3];
                            if let Some(ref mut f) = mice_file {
                                use std::io::Read;
                                if let Ok(3) = f.read(&mut buf) {
                                    // Parse X (byte 1)
                                    let rel_x = buf[1] as i8 as i32;
                                    // Parse Y (byte 2) - Standard PS/2: Y increases upwards.
                                    // Screen Y increases downwards. So we typically negate Y.
                                    let rel_y = -(buf[2] as i8 as i32);

                                    // Update cursor
                                    if state.update_cursor(rel_x, rel_y) {
                                        send_event(
                                            &mut stdout_lock,
                                            &OutputEvent::Cursor {
                                                x: state.cursor_x,
                                                y: state.cursor_y,
                                            },
                                        );
                                    }

                                    // Handle clicks from Byte 0
                                    // Bit 0: Left, Bit 1: Right, Bit 2: Middle
                                    let _left = (buf[0] & 0x1) != 0;
                                    let _right = (buf[0] & 0x2) != 0;
                                    let _middle = (buf[0] & 0x4) != 0;
                                }
                            }
                        }
                    }
                }
            }
            Ok(_) => {
                send_event(&mut stdout_lock, &OutputEvent::Heartbeat);
            }
            Err(e) if e != nix::errno::Errno::EINTR => {
                eprintln!("[foxy-input-helper] Poll error: {}", e);
            }
            _ => {}
        }
    }

    eprintln!("[foxy-input-helper] Shutting down gracefully...");
}
