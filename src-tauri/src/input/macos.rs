
#[cfg(target_os = "macos")]
use crate::shared::{KeyCode, OutputEvent, SharedState};
#[cfg(target_os = "macos")]
use core_foundation::runloop::{kCFRunLoopCommonModes, CFRunLoop};
#[cfg(target_os = "macos")]
use core_graphics::display::CGDisplay;
#[cfg(target_os = "macos")]
use core_graphics::event::{
    CGEventFlags, CGEventTap, CGEventTapLocation, CGEventTapOptions, CGEventTapPlacement,
    CGEventType, CGKeyCode, EventField,
};
#[cfg(target_os = "macos")]
use std::sync::Arc;
#[cfg(target_os = "macos")]
use tauri::{AppHandle, Emitter};

#[cfg(target_os = "macos")]
pub fn detect_screen_size() -> (i32, i32) {
    let display = CGDisplay::main();
    (display.pixels_wide() as i32, display.pixels_high() as i32)
}

#[cfg(target_os = "macos")]
pub fn check_fullscreen() -> bool {
    // Basic heuristic: Check if the frontmost app has a window covering the screen
    // For MVP, we'll default to false.
    false
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFRunLoopRun();
}

#[cfg(target_os = "macos")]
fn map_keycode(code: CGKeyCode) -> Option<KeyCode> {
    // Mapping specific macOS keycodes to our shared KeyCode enum
    // Reference: https://github.com/phracker/MacOSX-SDKs/blob/master/MacOSX10.6.sdk/System/Library/Frameworks/Carbon.framework/Versions/A/Frameworks/HIToolbox.framework/Versions/A/Headers/Events.h
    match code {
        0x00 => Some(KeyCode::A),
        0x01 => Some(KeyCode::S),
        0x02 => Some(KeyCode::D),
        0x03 => Some(KeyCode::F),
        0x08 => Some(KeyCode::C),
        
        0x38 => Some(KeyCode::LeftShift),  // kVK_Shift
        0x3C => Some(KeyCode::RightShift), // kVK_RightShift
        0x3B => Some(KeyCode::LeftCtrl),   // kVK_Control
        0x3E => Some(KeyCode::RightCtrl),  // kVK_RightControl
        0x3A => Some(KeyCode::LeftAlt),    // kVK_Option
        0x3D => Some(KeyCode::RightAlt),   // kVK_RightOption
        0x37 => Some(KeyCode::LeftMeta),   // kVK_Command
        0x36 => Some(KeyCode::RightMeta),  // kVK_RightCommand
        
        _ => None,
    }
}

#[cfg(target_os = "macos")]
pub fn run_input_loop(app_handle: AppHandle, shared_state: Arc<SharedState>) {
    let (width, height) = detect_screen_size();
    
    let _ = app_handle.emit(
        "ready",
        OutputEvent::Ready {
            mice_count: 1, // macOS abstracts this
            keyboards_count: 1,
            screen_width: width,
            screen_height: height,
        },
    );

    println!("[macOS Input] Starting Input Tap...");
    println!("[macOS Input] NOTE: Accessibility Permissions are REQUIRED for this to work.");

    // Create an event tap to monitor global input

    let tap = match CGEventTap::new(
        CGEventTapLocation::HID,
        CGEventTapPlacement::HeadInsertEventTap,
        CGEventTapOptions::ListenOnly,
        vec![
            CGEventType::KeyDown,
            CGEventType::KeyUp,
            CGEventType::FlagsChanged,
            CGEventType::MouseMoved,
            CGEventType::LeftMouseDown,
            CGEventType::LeftMouseUp,
            CGEventType::RightMouseDown,
            CGEventType::RightMouseUp,
            CGEventType::OtherMouseDown,
            CGEventType::OtherMouseUp,
        ],
        move |_proxy, type_, event| {
            // Callback context
            let mut input_state = shared_state.input_state.lock().unwrap();
            
            match type_ {
                CGEventType::MouseMoved => {
                    let point = event.location();
                    let x = point.x as i32;
                    let y = point.y as i32;
                    
                    if input_state.update_cursor(0, 0) || x != input_state.cursor_x || y != input_state.cursor_y {
                        input_state.cursor_x = x;
                        input_state.cursor_y = y;
                        input_state.last_reported_x = x;
                        input_state.last_reported_y = y;
                        
                        let _ = app_handle.emit(
                            "cursor-pos",
                            OutputEvent::Cursor { x, y },
                        );
                    }
                }
                CGEventType::LeftMouseDown | CGEventType::RightMouseDown | CGEventType::OtherMouseDown => {
                     let button = match type_ {
                         CGEventType::LeftMouseDown => "left",
                         CGEventType::RightMouseDown => "right",
                         _ => "middle",
                     };
                     
                     let _ = app_handle.emit(
                         "click",
                         OutputEvent::Click {
                             button: button.into(),
                             x: input_state.cursor_x,
                             y: input_state.cursor_y,
                         },
                     );
                     let _ = app_handle.emit("activity", OutputEvent::Activity);
                }

                CGEventType::KeyDown | CGEventType::FlagsChanged => {
                    let code = event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u16;
                    
                    if let Some(key) = map_keycode(code) {
                         // Use match instead of == for CGEventType check to avoid PartialEq issues
                        let is_down = match type_ {
                            CGEventType::FlagsChanged => {
                                let flags = event.get_flags();
                                match key {
                                    KeyCode::LeftShift | KeyCode::RightShift => flags.contains(CGEventFlags::CGEventFlagShift),
                                    KeyCode::LeftCtrl | KeyCode::RightCtrl => flags.contains(CGEventFlags::CGEventFlagControl),
                                    KeyCode::LeftAlt | KeyCode::RightAlt => flags.contains(CGEventFlags::CGEventFlagAlternate),
                                    KeyCode::LeftMeta | KeyCode::RightMeta => flags.contains(CGEventFlags::CGEventFlagCommand),
                                    _ => false,
                                }
                            }
                            _ => true,
                        };
                        
                        if is_down {
                            input_state.held_modifiers.insert(key);
                            if let Some(shortcut) = input_state.check_shortcut(key) {
                                let _ = app_handle.emit(
                                    "shortcut",
                                    OutputEvent::Shortcut { name: shortcut.to_string() },
                                );
                            }
                             let _ = app_handle.emit("activity", OutputEvent::Activity);
                        } else {
                             input_state.held_modifiers.remove(&key);
                        }
                    }
                }
                CGEventType::KeyUp => {
                     let code = event.get_integer_value_field(EventField::KEYBOARD_EVENT_KEYCODE) as u16;
                     if let Some(key) = map_keycode(code) {
                         input_state.held_modifiers.remove(&key);
                     }
                }
                _ => {}
            }
            Some(event.to_owned())
        },
    ) {
        Ok(tap) => tap,
        Err(e) => {
            eprintln!("Error creating Event Tap: {:?}", e);
            eprintln!("Make sure Accessibility Permissions are granted!");
            return;
        }
    };

    let source = tap.mach_port.clone();
    let loop_source = source.create_runloop_source(0).expect("Failed to create runloop source");
    
    let current_loop = CFRunLoop::get_current();
    unsafe {
        current_loop.add_source(&loop_source, kCFRunLoopCommonModes);
    }
    
    tap.enable();
    
    unsafe { CFRunLoopRun(); }
}

