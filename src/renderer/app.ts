// =============================================================================
// Main Application Entry Point (app.ts)
// =============================================================================
//
// This is the frontend's main entry point. It orchestrates the initialization
// of all modules and sets up the core event listeners.
//
// INITIALIZATION FLOW:
// 1. Clear previous shortcuts (important for hot reload during development)
// 2. Load saved configuration from Rust backend
// 3. Initialize all UI modules (character, chat, settings, etc.)
// 4. Apply loaded configuration
// 5. Set up event listeners for backend events (shortcuts, cursor sync)
//
// KEY RESPONSIBILITIES:
// - Module initialization and coordination
// - Configuration loading/saving
// - Backend event handling (shortcuts detected by Rust)
// - Cursor position synchronization with Rust backend
//
// =============================================================================

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { setupClickThrough } from './modules/interactions';
import { initCharacter } from './modules/character';
import { initChat } from './modules/chat';
import { initSettings, applyConfig } from './modules/settings';
import { initLighting } from './modules/lighting';
import { initScreensaver } from './modules/screensaver';
import { unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { listen } from '@tauri-apps/api/event';
import { state } from './modules/store';
import { toggleDragMode, handleCharacterClick, setVisible } from './modules/character';
import { activateChat } from './modules/chat';
import { toggleScreensaver } from './modules/screensaver';

const appWindow = getCurrentWindow();

// =============================================================================
// Initialization Function
// =============================================================================
/// This is the core initialization routine that runs once when the page loads

async function init() {
    console.log('[Renderer] Initializing (Tauri)...');

    // Hide character initially to prevent "foxy" flash if theme is different
    setVisible(false);

    // -------------------------------------------------------------------------
    // Step 1: Clean up previous shortcuts
    // -------------------------------------------------------------------------
    // This is especially important during development when hot-reloading.
    // Without this, shortcuts can accumulate and fire multiple times.
    try {
        await unregisterAll();
        console.log('[Renderer] Cleared previous shortcuts');
    } catch (e) {
        console.warn('[Renderer] Failed to clear shortcuts:', e);
    }

    // -------------------------------------------------------------------------
    // Step 2: Load saved configuration
    // -------------------------------------------------------------------------
    // Configuration is stored via the Rust backend in:
    // ~/.config/com.sam.ai-character-assistant/config.json (Linux)
    // %APPDATA%\com.sam.ai-character-assistant\config.json (Windows)
    let config;
    try {
        // Calling Rust function to load config
        config = await invoke('load_config');
        console.log('[Renderer] Loaded config:', config);
    } catch (e) {
        console.error('[Renderer] Failed to load config:', e);
        config = { theme: 'fox' };  // Fallback to default
    }

    // -------------------------------------------------------------------------
    // Step 3: Initialize all modules
    // -------------------------------------------------------------------------
    // Each module sets up its own DOM event listeners and internal state.
    // Order matters slightly (e.g., character should init before chat).
    setupClickThrough();    // Sets up click-through regions
    initCharacter();        // Character animations and interactions
    initChat();             // Chat bubble and input handling
    initSettings();         // Settings panel UI
    initLighting();         // Lighting effects (day/night cycle)
    await initScreensaver(); // Screensaver mode

    // -------------------------------------------------------------------------
    // Step 4: Apply loaded configuration
    // -------------------------------------------------------------------------
    // This updates the UI to match the saved settings (theme, shortcuts, etc.)
    applyConfig(config);

    // Now show character
    setTimeout(() => setVisible(true), 100);

    // -------------------------------------------------------------------------
    // Step 5: Platform-specific window setup
    // -------------------------------------------------------------------------
    // On Linux/Wayland, the "always on top" property sometimes gets lost.
    // We re-enforce it here to ensure the character stays visible.
    try {
        await appWindow.setAlwaysOnTop(true);
        console.log('[Renderer] Enforced Always on Top');
    } catch (e) {
        console.warn('[Renderer] Failed to enforce Always on Top:', e);
    }

    // -------------------------------------------------------------------------
    // Step 6: Listen for backend shortcut events
    // -------------------------------------------------------------------------
    // On Wayland, the Tauri global shortcut plugin doesn't work reliably.
    // Instead, the Rust backend detects shortcuts via raw input and emits
    // events that we listen for here.
    listen('shortcut', (event: any) => {
        const { name } = event.payload;
        console.log(`[Backend Event] Shortcut triggered: ${name}`);

        // Dispatch to appropriate handlers
        if (name === 'toggle_chat') activateChat();
        if (name === 'toggle_drag') toggleDragMode();
        if (name === 'toggle_screensaver') toggleScreensaver();
    });

    // -------------------------------------------------------------------------
    // Step 7: Set up cursor synchronization
    // -------------------------------------------------------------------------
    // The Rust backend tracks the global cursor position for shortcut detection.
    // We sync our local cursor position to the backend so it knows where clicks
    // are happening relative to the window.
    window.addEventListener('mousemove', async (e) => {
        // Convert window-relative coordinates to screen-global coordinates
        const pos = await appWindow.outerPosition();
        const globalX = pos.x + e.clientX;
        const globalY = pos.y + e.clientY;

        // Send to backend (fire-and-forget for performance)
        invoke('sync_cursor', { x: Math.round(globalX), y: Math.round(globalY) });
    });

    console.log('[Renderer] Ready!');
}

// =============================================================================
// Application Bootstrap
// =============================================================================
// Wait for the DOM to be ready, then start initialization

window.addEventListener('DOMContentLoaded', () => {
    init();
});
