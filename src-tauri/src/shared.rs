// =============================================================================
// Shared State and Data Types
// =============================================================================
//
// This module defines the shared data structures used across the application.
// These types are shared between the main thread, the input monitoring thread,
// and are serialized for IPC communication with the frontend.
//
// KEY COMPONENTS:
// - KeyCode: Platform-agnostic representation of keyboard keys
// - Rect: Rectangle for UI element bounds checking
// - OutputEvent: Events emitted from backend to frontend
// - InputState: Mutable state tracking cursor, modifiers, and shortcuts
// - SharedState: Thread-safe wrapper around InputState
//
// =============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;

// =============================================================================
// KeyCode Enumeration
// =============================================================================
//
// Platform-agnostic representation of keyboard keys.
// This allows the OS-specific input modules (linux.rs, windows.rs) to map
// their native key codes to a common format.
//
// Why we need this:
// - Linux uses evdev::Key enum
// - Windows uses VIRTUAL_KEY enum
// - We need a common representation for shortcut detection
//
// =============================================================================

#[derive(Debug, Hash, Eq, PartialEq, Clone, Copy)]
pub enum KeyCode {
    // Modifier keys
    LeftShift,
    RightShift,
    LeftCtrl,
    RightCtrl,
    LeftAlt,
    RightAlt,
    LeftMeta, // Super/Windows key
    RightMeta,

    // Letter keys used in shortcuts
    F, // Toggle chat (Meta+Shift+F)
    D, // Toggle drag mode (Meta+Shift+D)
    S, // Toggle screensaver (Meta+Shift+S)
    C, // Center character on screen (Meta+Shift+C)
    A, // Reserved for future use

    // Legacy/unused variants (kept for compatibility)
    #[allow(dead_code)]
    SKey, // Duplicate of S (kept to avoid breaking changes)
    #[allow(dead_code)]
    Unknown, // Fallback for unmapped keys
}

// =============================================================================
// Rectangle (UI Bounds)
// =============================================================================
//
// Represents a rectangular region on screen.
// Used to track which parts of the UI are "interactive" (should capture clicks)
// vs which parts should be click-through (let clicks pass to desktop below).
//
// The frontend sends these bounds to the backend via `update_interactive_bounds`.
// The backend uses them to determine if a click should trigger an action.
//
// =============================================================================

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default)]
pub struct Rect {
    pub x: i32,      // Top-left X coordinate (screen space)
    pub y: i32,      // Top-left Y coordinate (screen space)
    pub width: i32,  // Width in pixels
    pub height: i32, // Height in pixels
}

impl Rect {
    /// Checks if a point (x, y) is inside this rectangle
    #[allow(dead_code)] // May be used in future for click detection
    pub fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }
}

// =============================================================================
// Output Events (Backend → Frontend)
// =============================================================================
//
// Events emitted from the Rust backend to the TypeScript frontend.
// These are sent via Tauri's event system using `app_handle.emit()`.
//
// The frontend listens for these events using:
// ```typescript
// await listen('cursor-pos', (event) => { ... });
// ```
//
// =============================================================================

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OutputEvent {
    /// Emitted when the global cursor position changes
    /// Frontend uses this for hover effects and tracking
    Cursor { x: i32, y: i32 },

    /// Emitted when a global keyboard shortcut is detected
    /// Examples: "toggle_chat", "toggle_drag", "toggle_screensaver"
    Shortcut { name: String },

    /// Emitted when a click is detected on an interactive region
    /// The frontend uses this as a fallback for click detection
    Click {
        button: String, // "left", "right", "middle"
        x: i32,
        y: i32,
    },

    /// Periodic heartbeat to indicate the input thread is alive
    Heartbeat,

    /// Emitted once when the input monitoring thread starts
    /// Tells the frontend the screen resolution and device counts
    Ready {
        mice_count: usize,
        keyboards_count: usize,
        screen_width: i32,
        screen_height: i32,
    },

    /// Emitted when any input activity is detected
    /// Can be used by the frontend to prevent screensavers
    Activity,
}

// =============================================================================
// Input State (Mutable Tracking)
// =============================================================================
//
// Tracks the current state of input devices.
// This is shared between threads using Arc<Mutex<InputState>>.
//
// THREAD SAFETY:
// - The input monitoring thread updates this state when it detects events
// - The main thread reads it when handling IPC commands
// - Access is protected by a Mutex to prevent race conditions
//
// =============================================================================

pub struct InputState {
    /// Current global cursor X position (screen coordinates)
    pub cursor_x: i32,

    /// Current global cursor Y position (screen coordinates)
    pub cursor_y: i32,

    /// Screen width in pixels (detected at startup)
    pub screen_width: i32,

    /// Screen height in pixels (detected at startup)
    pub screen_height: i32,

    /// Set of currently held modifier keys (Shift, Ctrl, Alt, Meta)
    /// Used for detecting keyboard shortcuts like Meta+Shift+F
    pub held_modifiers: HashSet<KeyCode>,

    /// Last cursor position that was reported to the frontend
    /// Used to avoid spamming events when cursor hasn't moved
    pub last_reported_x: i32,
    pub last_reported_y: i32,

    /// Interactive regions defined by the frontend
    /// These are the UI elements that should respond to clicks
    pub interactive_rects: Vec<Rect>,
}

/// Thread-safe wrapper around InputState
pub struct SharedState {
    pub input_state: Mutex<InputState>,
}

impl InputState {
    /// Creates a new InputState with the given screen dimensions
    pub fn new(screen_width: i32, screen_height: i32) -> Self {
        Self {
            cursor_x: screen_width / 2,
            cursor_y: screen_height / 2,
            screen_width,
            screen_height,
            held_modifiers: HashSet::new(),
            last_reported_x: -1,
            last_reported_y: -1,
            interactive_rects: Vec::new(),
        }
    }

    /// Updates the cursor position by a delta (relative movement).
    /// Clamps to screen bounds and returns true if the position changed.
    pub fn update_cursor(&mut self, delta_x: i32, delta_y: i32) -> bool {
        self.cursor_x += delta_x;
        self.cursor_y += delta_y;

        // Clamp to screen bounds
        self.cursor_x = self.cursor_x.clamp(0, self.screen_width - 1);
        self.cursor_y = self.cursor_y.clamp(0, self.screen_height - 1);

        // Check if position changed since last report
        let changed =
            self.cursor_x != self.last_reported_x || self.cursor_y != self.last_reported_y;
        if changed {
            self.last_reported_x = self.cursor_x;
            self.last_reported_y = self.cursor_y;
        }
        changed
    }

    /// Checks if a specific modifier key is currently held down
    pub fn is_modifier_held(&self, key: KeyCode) -> bool {
        self.held_modifiers.contains(&key)
    }

    /// Checks if a key press triggers a global shortcut.
    /// Returns the shortcut name if matched, or None.
    ///
    /// Current shortcuts:
    /// - Meta+Shift+F: "toggle_chat"
    /// - Meta+Shift+D: "toggle_drag"
    /// - Meta+Shift+S: "toggle_screensaver"
    /// - Meta+Shift+C: "center_character"
    pub fn check_shortcut(&self, trigger_key: KeyCode) -> Option<&'static str> {
        // Check if Meta (Super/Windows) key is held
        let meta_held =
            self.is_modifier_held(KeyCode::LeftMeta) || self.is_modifier_held(KeyCode::RightMeta);
        // Check if Shift key is held
        let shift_held =
            self.is_modifier_held(KeyCode::LeftShift) || self.is_modifier_held(KeyCode::RightShift);

        // Shortcuts require Meta+Shift+Key
        if meta_held && shift_held {
            match trigger_key {
                KeyCode::F => return Some("toggle_chat"),
                KeyCode::D => return Some("toggle_drag"),
                KeyCode::S => return Some("toggle_screensaver"),
                KeyCode::C => return Some("center_character"),
                _ => {}
            }
        }
        None
    }
}
