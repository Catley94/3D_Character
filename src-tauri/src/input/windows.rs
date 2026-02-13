#[cfg(target_os = "windows")]
use crate::shared::{KeyCode, OutputEvent, SharedState};
#[cfg(target_os = "windows")]
#[cfg(target_os = "windows")]
use std::sync::Arc;
#[cfg(target_os = "windows")]
use tauri::{AppHandle, Emitter, Manager};
#[cfg(target_os = "windows")]
use windows::core::s;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::POINT;
#[cfg(target_os = "windows")]
use windows::Win32::Foundation::{HWND, LPARAM, LRESULT, RECT, WPARAM};
#[cfg(target_os = "windows")]
use windows::Win32::System::LibraryLoader::GetModuleHandleA;
use windows::Win32::UI::Input::KeyboardAndMouse::{
    VIRTUAL_KEY, VK_A, VK_C, VK_CONTROL, VK_D, VK_F, VK_LCONTROL, VK_LMENU, VK_LSHIFT, VK_LWIN,
    VK_MENU, VK_RCONTROL, VK_RMENU, VK_RSHIFT, VK_RWIN, VK_S, VK_SHIFT,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::Input::{
    GetRawInputData, RegisterRawInputDevices, HRAWINPUT, RAWINPUT, RAWINPUTDEVICE, RAWINPUTHEADER,
    RIDEV_INPUTSINK, RID_INPUT, RIM_TYPEKEYBOARD, RIM_TYPEMOUSE,
};
#[cfg(target_os = "windows")]
use windows::Win32::UI::WindowsAndMessaging::{
    CreateWindowExA, DefWindowProcA, DispatchMessageA, GetCursorPos, GetForegroundWindow,
    GetMessageA, GetSystemMetrics, GetWindowLongPtrA, GetWindowRect, RegisterClassA,
    SetWindowLongPtrA, TranslateMessage, GWLP_USERDATA, HMENU, HWND_MESSAGE, MSG, SM_CXSCREEN,
    SM_CYSCREEN, WM_DESTROY, WM_INPUT, WNDCLASSA,
};

#[cfg(target_os = "windows")]
pub fn detect_screen_size() -> (i32, i32) {
    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);
        (width, height)
    }
}

#[cfg(target_os = "windows")]
pub fn check_fullscreen() -> bool {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0 == 0 {
            return false;
        }

        let mut rect = RECT::default();
        if GetWindowRect(hwnd, &mut rect).is_err() {
            return false;
        }

        let scr_w = GetSystemMetrics(SM_CXSCREEN);
        let scr_h = GetSystemMetrics(SM_CYSCREEN);

        (rect.right - rect.left) >= scr_w && (rect.bottom - rect.top) >= scr_h
    }
}

#[cfg(target_os = "windows")]
struct ThreadContext {
    app: AppHandle,
    state: Arc<SharedState>,
}

#[cfg(target_os = "windows")]
fn map_vkey(vkey: VIRTUAL_KEY) -> Option<KeyCode> {
    match vkey {
        VK_SHIFT | VK_LSHIFT => Some(KeyCode::LeftShift),
        VK_RSHIFT => Some(KeyCode::RightShift),
        VK_CONTROL | VK_LCONTROL => Some(KeyCode::LeftCtrl),
        VK_RCONTROL => Some(KeyCode::RightCtrl),
        VK_MENU | VK_LMENU => Some(KeyCode::LeftAlt),
        VK_RMENU => Some(KeyCode::RightAlt),
        VK_LWIN => Some(KeyCode::LeftMeta),
        VK_RWIN => Some(KeyCode::RightMeta),
        VK_F => Some(KeyCode::F),
        VK_D => Some(KeyCode::D),
        VK_S => Some(KeyCode::S),
        VK_C => Some(KeyCode::C),
        VK_A => Some(KeyCode::A),
        _ => None,
    }
}

#[cfg(target_os = "windows")]
unsafe extern "system" fn wnd_proc(
    hwnd: HWND,
    msg: u32,
    wparam: WPARAM,
    lparam: LPARAM,
) -> LRESULT {
    let ptr = GetWindowLongPtrA(hwnd, GWLP_USERDATA) as *mut ThreadContext;

    // Only process logic if we have context
    // Check for WM_DESTROY to free memory?
    // In this app, thread lives forever, so simple drop is fine. But for correctness:
    if msg == WM_DESTROY && !ptr.is_null() {
        let _ = Box::from_raw(ptr); // Drop
        return LRESULT(0);
    }

    if msg == WM_INPUT && !ptr.is_null() {
        let context = &*ptr; // Borrow context
        let _header = RAWINPUTHEADER::default();
        let mut size = std::mem::size_of::<RAWINPUT>() as u32;
        let mut raw = RAWINPUT::default();

        let hrawinput = HRAWINPUT(lparam.0);

        // Get Data
        if GetRawInputData(
            hrawinput,
            RID_INPUT,
            Some(&mut raw as *mut _ as *mut std::ffi::c_void),
            &mut size,
            std::mem::size_of::<RAWINPUTHEADER>() as u32,
        ) != u32::MAX
        {
            if raw.header.dwType == RIM_TYPEMOUSE.0 {
                let mouse = raw.data.mouse;
                // MOUSE_MOVE_RELATIVE = 0, MOUSE_MOVE_ABSOLUTE = 1
                // we want relative usually, unless MOUSE_MOVE_ABSOLUTE is set.
                // raw.data.mouse.usFlags & 0x01 == MOUSE_MOVE_ABSOLUTE

                let rel_x = mouse.lLastX;
                let rel_y = mouse.lLastY;

                if rel_x != 0 || rel_y != 0 {
                    let mut point = POINT::default();
                    unsafe { GetCursorPos(&mut point).ok() }; // Check result?

                    let mut input_state = context.state.input_state.lock().unwrap();
                    // Use absolute OS cursor position
                    input_state.cursor_x = point.x;
                    input_state.cursor_y = point.y;
                    let interactive_rects = input_state.interactive_rects.clone();

                    // Release lock before window operations to avoid deadlocks
                    drop(input_state);

                    // Click-Through Logic
                    if !interactive_rects.is_empty() {
                        if let Some(window) = context.app.get_webview_window("main") {
                            // Get Main Window HWND
                            if let Ok(hwnd_main) = window.hwnd() {
                                let mut win_rect = RECT::default();
                                unsafe {
                                    let _ =
                                        GetWindowRect(HWND(hwnd_main.0 as isize), &mut win_rect);
                                };

                                let win_x = win_rect.left;
                                let win_y = win_rect.top;
                                let cursor_x = point.x;
                                let cursor_y = point.y;

                                let mut is_over_anything = false;

                                for rect in &interactive_rects {
                                    let global_x = win_x + rect.x;
                                    let global_y = win_y + rect.y;

                                    if cursor_x >= global_x
                                        && cursor_x <= global_x + rect.width
                                        && cursor_y >= global_y
                                        && cursor_y <= global_y + rect.height
                                    {
                                        is_over_anything = true;
                                        break;
                                    }
                                }

                                // REVERTED: Click-through disabled per user request due to stability issues.
                                // Forcing window to be interactive at all times.
                                // To re-enable, uncomment logic below and ensure frontend sends correct bounds.

                                /*
                                // Debug logging - Use eprintln to ensure it bypasses stdout buffers if any
                                eprintln!("[Windows Input] Cursor: {},{} | Global Rect: {},{} {}x{} | Hit: {}",
                                   cursor_x, cursor_y, win_x + interactive_rects[0].x, win_y + interactive_rects[0].y,
                                   interactive_rects[0].width, interactive_rects[0].height, is_over_anything);

                                // Update Ignore State
                                if let Err(e) = window.set_ignore_cursor_events(!is_over_anything) {
                                    eprintln!("[Windows Input] Failed to set ignore events: {}", e);
                                }
                                */
                                let _ = window.set_ignore_cursor_events(false);
                            }
                        }
                    } else {
                        // Default to Interactive during revert
                        if let Some(window) = context.app.get_webview_window("main") {
                            let _ = window.set_ignore_cursor_events(false);
                        }
                    }

                    // Re-acquire lock for event emission
                    let mut input_state = context.state.input_state.lock().unwrap();

                    // Only emit if changed?

                    // Only emit if changed?
                    if input_state.cursor_x != input_state.last_reported_x
                        || input_state.cursor_y != input_state.last_reported_y
                    {
                        input_state.last_reported_x = input_state.cursor_x;
                        input_state.last_reported_y = input_state.cursor_y;

                        let _ = context.app.emit(
                            "cursor-pos",
                            OutputEvent::Cursor {
                                x: input_state.cursor_x,
                                y: input_state.cursor_y,
                            },
                        );
                    }
                }

                // Buttons
                let buttons = mouse.Anonymous.Anonymous.usButtonFlags;

                if buttons != 0 {
                    if (buttons & 0x0001) != 0 {
                        // Down
                        let input_state = context.state.input_state.lock().unwrap();
                        let _ = context.app.emit(
                            "mousedown",
                            OutputEvent::Click {
                                button: "left".into(),
                                x: input_state.cursor_x,
                                y: input_state.cursor_y,
                            },
                        );
                    }
                    if (buttons & 0x0002) != 0 {
                        // Up
                        let input_state = context.state.input_state.lock().unwrap();
                        let _ = context.app.emit(
                            "mouseup",
                            OutputEvent::Click {
                                button: "left".into(),
                                x: input_state.cursor_x,
                                y: input_state.cursor_y,
                            },
                        );
                    }

                    if (buttons & 0x0004) != 0 {
                        // Right Down
                        let input_state = context.state.input_state.lock().unwrap();
                        let _ = context.app.emit(
                            "mousedown",
                            OutputEvent::Click {
                                button: "right".into(),
                                x: input_state.cursor_x,
                                y: input_state.cursor_y,
                            },
                        );
                    }
                    if (buttons & 0x0008) != 0 {
                        // Right Up
                        let input_state = context.state.input_state.lock().unwrap();
                        let _ = context.app.emit(
                            "mouseup",
                            OutputEvent::Click {
                                button: "right".into(),
                                x: input_state.cursor_x,
                                y: input_state.cursor_y,
                            },
                        );
                    }

                    if (buttons & 0x0010) != 0 {
                        // Middle Down
                        let input_state = context.state.input_state.lock().unwrap();
                        let _ = context.app.emit(
                            "mousedown",
                            OutputEvent::Click {
                                button: "middle".into(),
                                x: input_state.cursor_x,
                                y: input_state.cursor_y,
                            },
                        );
                    }
                    // Middle Up is 0x0020 if needed

                    let _ = context.app.emit("activity", OutputEvent::Activity);
                }
            } else if raw.header.dwType == RIM_TYPEKEYBOARD.0 {
                let kb = raw.data.keyboard;
                let vkey = VIRTUAL_KEY(kb.VKey);
                let flags = kb.Flags;
                let is_break = (flags & 1) != 0; // RI_KEY_BREAK (Key Up)
                let is_make = !is_break; // RI_KEY_MAKE (Key Down)

                if let Some(shared_key) = map_vkey(vkey) {
                    let mut input_state = context.state.input_state.lock().unwrap();
                    if is_make {
                        input_state.held_modifiers.insert(shared_key);
                        // Check Shortcut
                        if let Some(shortcut) = input_state.check_shortcut(shared_key) {
                            let _ = context.app.emit(
                                "shortcut",
                                OutputEvent::Shortcut {
                                    name: shortcut.to_string(),
                                },
                            );
                        }
                    } else {
                        input_state.held_modifiers.remove(&shared_key);
                    }
                }

                if is_make {
                    let _ = context.app.emit("activity", OutputEvent::Activity);
                }
            }
        }
    }

    DefWindowProcA(hwnd, msg, wparam, lparam)
}

#[cfg(target_os = "windows")]
pub fn run_input_loop(app_handle: AppHandle, shared_state: Arc<SharedState>) {
    let (width, height) = detect_screen_size();

    // Initial Ready Call
    let _ = app_handle.emit(
        "ready",
        OutputEvent::Ready {
            mice_count: 1,
            keyboards_count: 1,
            screen_width: width,
            screen_height: height,
        },
    );
    println!("[Windows Input] Starting Input Loop");

    unsafe {
        let instance = GetModuleHandleA(None).unwrap();
        let class_name = s!("TauriInputHiddenWindow");

        let wnd_class = WNDCLASSA {
            lpfnWndProc: Some(wnd_proc),
            hInstance: instance.into(),
            lpszClassName: class_name,
            ..Default::default()
        };

        if RegisterClassA(&wnd_class) == 0 {
            eprintln!("[Windows Input] Failed to register window class.");
            return;
        }

        let hwnd = CreateWindowExA(
            Default::default(),
            class_name,
            s!("InputListener"),
            Default::default(),
            0,
            0,
            0,
            0,
            HWND_MESSAGE,
            HMENU::default(),
            instance,
            None, // lpParam
        );

        if hwnd.0 == 0 {
            eprintln!("[Windows Input] Failed to create window.");
            return;
        }

        // Store context in Window
        let context = Box::new(ThreadContext {
            app: app_handle,
            state: shared_state,
        });
        SetWindowLongPtrA(hwnd, GWLP_USERDATA, Box::into_raw(context) as isize);

        // Register Raw Input
        let devices = [
            RAWINPUTDEVICE {
                usUsagePage: 0x01,        // Generic Desktop Controls
                usUsage: 0x02,            // Mouse
                dwFlags: RIDEV_INPUTSINK, // Receive input even when not in foreground
                hwndTarget: hwnd,
            },
            RAWINPUTDEVICE {
                usUsagePage: 0x01,
                usUsage: 0x06, // Keyboard
                dwFlags: RIDEV_INPUTSINK,
                hwndTarget: hwnd,
            },
        ];

        if RegisterRawInputDevices(&devices, std::mem::size_of::<RAWINPUTDEVICE>() as u32).is_err()
        {
            eprintln!("[Windows Input] Failed to register raw input devices.");
        }

        // Message Loop
        let mut msg = MSG::default();
        while GetMessageA(&mut msg, HWND::default(), 0, 0).into() {
            TranslateMessage(&msg);
            DispatchMessageA(&msg);
        }
    }
}
