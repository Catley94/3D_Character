// =============================================================================
// Input Handling Module (OS-Agnostic Interface)
// =============================================================================
//
// This module provides a unified interface for input handling across different
// operating systems. It conditionally compiles and re-exports the appropriate
// backend (linux or windows) based on the compilation target.
//
// DESIGN PATTERN: OS Dispatch
// - Generic functions (detect_screen_size, check_fullscreen, run_input_loop)
//   are defined here and dispatch to the active backend
// - OS-specific implementations are in linux.rs and windows.rs
// - The main.rs file doesn't need to know which OS it's running on
//
// BENEFITS:
// - Clean separation of concerns
// - Easy to add new OS support (just add macos.rs and update this file)
// - Main application code remains OS-agnostic
// - Each OS module can use native APIs without polluting other modules
//
// REQUIRED INTERFACE:
// Each OS module (linux.rs, windows.rs) must implement:
// - detect_screen_size() -> (i32, i32)
// - check_fullscreen() -> bool
// - run_input_loop(app_handle: AppHandle, shared_state: Arc<SharedState>)
//
// =============================================================================

// =============================================================================
// OS-Specific Module Imports
// =============================================================================
// Only one of these will be compiled based on the target OS

/// Linux backend: Uses evdev for raw input and X11 for screen queries
#[cfg(target_os = "linux")]
pub mod linux;

/// Windows backend: Uses Win32 Raw Input API
#[cfg(target_os = "windows")]
pub mod windows;

/// macOS backend: Uses CoreGraphics Event Taps
#[cfg(target_os = "macos")]
pub mod macos;

// =============================================================================
// Backend Selection
// =============================================================================
// Create an alias 'backend' that points to the active OS module=

#[cfg(target_os = "linux")]
use linux as backend;

#[cfg(target_os = "windows")]
use windows as backend;

#[cfg(target_os = "macos")]
use macos as backend;

// Re-export types needed by main.rs
use crate::shared::SharedState;
use std::sync::Arc;
use tauri::AppHandle;

// =============================================================================
// Unified Public API
// =============================================================================
// These functions are called by main.rs and dispatch to the OS backend

/// Detects the primary screen resolution.
///
/// # Platform Specific Behavior
/// - **Linux**: Queries X11 using `xrandr` command
/// - **Windows**: Uses `GetSystemMetrics` Win32 API
///
/// # Returns
/// A tuple (width, height) in pixels
pub fn detect_screen_size() -> (i32, i32) {
    backend::detect_screen_size()
}

/// Checks if any application is currently running in full-screen mode.
///
/// # Platform Specific Behavior
/// - **Linux**: Checks X11 window properties for `_NET_WM_STATE_FULLSCREEN`
/// - **Windows**: Queries foreground window and compares size to screen size
///
/// # Returns
/// `true` if a fullscreen app is detected, `false` otherwise
pub fn check_fullscreen() -> bool {
    backend::check_fullscreen()
}

/// Starts the main input event loop on a background thread.
/// This loop continuously monitors mouse and keyboard input and emits
/// events to the frontend via Tauri's event system.
///
/// # Platform Specific Behavior
/// - **Linux**: Opens /dev/input devices and polls for events using select()
/// - **Windows**: Creates a hidden message window and registers for Raw Input
///
/// # Arguments
/// * `app_handle` - Tauri application handle for emitting events
/// * `shared_state` - Thread-safe shared state for cursor tracking
///
/// # Note
/// This function blocks indefinitely and should be called from a spawned thread.
pub fn run_input_loop(app_handle: AppHandle, shared_state: Arc<SharedState>) {
    backend::run_input_loop(app_handle, shared_state)
}
