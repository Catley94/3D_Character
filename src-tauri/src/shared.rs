use serde::{Serialize, Deserialize};
use std::collections::HashSet;
use std::sync::Mutex;


// Re-export Key from a common place or use a wrapper?
// For now, let's use a platform-agnostic key representation or just raw codes if possible, 
// OR simpler: InputState logic uses `evdev::Key` which is Linux specific. 
// We need to abstract `Key` or make `held_modifiers` handling platform agnostic.
// 
// ISSUE: `InputState` uses `evdev::Key`. `evdev` is now linux-only.
// We need a common Enum for keys or just use standard mapping.
// 
// For this iteration, I will define a simple enum for Modifiers and essential keys used in `InputState`.

#[derive(Debug, Hash, Eq, PartialEq, Clone, Copy)]
pub enum KeyCode {
    LeftShift,
    RightShift,
    LeftCtrl,
    RightCtrl,
    LeftAlt,
    RightAlt,
    LeftMeta,
    RightMeta,
    F,
    D,
    S,
    A, 
    SKey, // Disambiguate S?
    Unknown,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, Default)]
pub struct Rect {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Rect {
    pub fn contains(&self, x: i32, y: i32) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }
}

#[derive(Serialize, Debug, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum OutputEvent {
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
    Ready {
        mice_count: usize,
        keyboards_count: usize,
        screen_width: i32,
        screen_height: i32,
    },
    Activity,
}

pub struct InputState {
    pub cursor_x: i32,
    pub cursor_y: i32,
    pub screen_width: i32,
    pub screen_height: i32,
    pub held_modifiers: HashSet<KeyCode>, 
    pub last_reported_x: i32,
    pub last_reported_y: i32,
    // Store bounds relative to window
    pub interactive_rects: Vec<Rect>,
}

pub struct SharedState {
    pub input_state: Mutex<InputState>,
}

impl InputState {
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

    pub fn update_cursor(&mut self, delta_x: i32, delta_y: i32) -> bool {
        self.cursor_x += delta_x;
        self.cursor_y += delta_y;

        self.cursor_x = self.cursor_x.clamp(0, self.screen_width - 1);
        self.cursor_y = self.cursor_y.clamp(0, self.screen_height - 1);

        let changed =
            self.cursor_x != self.last_reported_x || self.cursor_y != self.last_reported_y;
        if changed {
            self.last_reported_x = self.cursor_x;
            self.last_reported_y = self.cursor_y;
        }
        changed
    }

    pub fn is_modifier_held(&self, key: KeyCode) -> bool {
        self.held_modifiers.contains(&key)
    }

    pub fn check_shortcut(&self, trigger_key: KeyCode) -> Option<&'static str> {
        let meta_held =
            self.is_modifier_held(KeyCode::LeftMeta) || self.is_modifier_held(KeyCode::RightMeta);
        let shift_held =
            self.is_modifier_held(KeyCode::LeftShift) || self.is_modifier_held(KeyCode::RightShift);

        if meta_held && shift_held {
            match trigger_key {
                KeyCode::F => return Some("toggle_chat"),
                KeyCode::D => return Some("toggle_drag"),
                KeyCode::S => return Some("toggle_screensaver"),
                _ => {}
            }
        }
        None
    }
}
