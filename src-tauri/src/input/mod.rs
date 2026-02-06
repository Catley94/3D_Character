// =============================================================================
// Input Handling Module
// =============================================================================
//
// This module provides a unified interface for input handling across different
// operating systems. It conditionally re-exports the appropriate backend
// (linux or windows) based on the compilation target.
//
// The `InputBackend` trait (or implied interface) that each OS module must implement:
// - detect_screen_size() -> (i32, i32)
// - check_fullscreen() -> bool
// - run_input_loop(app_handle, shared_state)
//
// =============================================================================

// OS-Specific Modules
#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;

// =============================================================================
// Unified Interface
// =============================================================================

#[cfg(target_os = "linux")]
use linux as backend;

#[cfg(target_os = "windows")]
use windows as backend;

// Re-exports for types used in main
// We might need to make sure these are available from the submodules
// or define common types here if they aren't already in `shared.rs`.

use crate::shared::SharedState;
use std::sync::Arc;
use tauri::AppHandle;

/// Detects the primary screen resolution.
/// Dispatches to the OS-specific implementation.
pub fn detect_screen_size() -> (i32, i32) {
    backend::detect_screen_size()
}

/// Checks if any application is currently running in full-screen mode.
/// Dispatches to the OS-specific implementation.
pub fn check_fullscreen() -> bool {
    backend::check_fullscreen()
}

/// Starts the main input event loop.
/// This runs on a separate thread and handles mouse/keyboard monitoring.
pub fn run_input_loop(app_handle: AppHandle, shared_state: Arc<SharedState>) {
    backend::run_input_loop(app_handle, shared_state)
}
