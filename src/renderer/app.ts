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
// 3. Restore saved window position (if any)
// 4. Initialize all UI modules (character, chat, settings, etc.)
// 5. Apply loaded configuration
// 6. Set up event listeners for backend events (shortcuts, cursor sync)
// 7. Register beforeunload handler to save window position on close
//
// KEY RESPONSIBILITIES:
// - Module initialization and coordination
// - Configuration loading/saving
// - Backend event handling (shortcuts detected by Rust)
// - Cursor position synchronization with Rust backend
// - Window position persistence (save on close, restore on startup)
// - Recenter character shortcut (Meta+Shift+C)
//
// =============================================================================

import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow, PhysicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { setupClickThrough } from './modules/interactions';
import { initCharacter } from './modules/character';
import { initChat } from './modules/chat';
import { initSettings, applyConfig } from './modules/settings';
import { initLighting } from './modules/lighting';
import { initScreensaver } from './modules/screensaver';
import { unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { listen } from '@tauri-apps/api/event';
import { state } from './modules/store';
import { historyService } from './services/history';
import { geminiService } from './services/gemini';
import { ollamaService } from './services/ollama';
import { toggleDragMode, handleCharacterClick, setVisible } from './modules/character';
import { activateChat } from './modules/chat';
import { toggleScreensaver } from './modules/screensaver';

const appWindow = getCurrentWindow();

// =============================================================================
// Window Position Helpers
// =============================================================================

/**
 * Saves the current window position into the persisted config.
 * Merges windowX/windowY into the existing config so other settings
 * are preserved. Called after drags, on recentering, and before close.
 */
export async function saveWindowPosition() {
    try {
        const pos = await appWindow.outerPosition();
        // Merge position into the existing config object
        const updatedConfig = { ...state.config, windowX: pos.x, windowY: pos.y };
        await invoke('save_config', { config: updatedConfig });
        console.log(`[Renderer] Saved window position: (${pos.x}, ${pos.y})`);
    } catch (e) {
        console.warn('[Renderer] Failed to save window position:', e);
    }
}

/**
 * Centers the character window on the current monitor.
 * Calculates the centre based on monitor size and current window dimensions.
 */
async function centerCharacterOnScreen() {
    try {
        const monitor = await currentMonitor();
        if (!monitor) {
            console.warn('[Renderer] Could not detect current monitor for centering');
            return;
        }

        const windowSize = await appWindow.outerSize();
        const monitorPos = monitor.position;   // Top-left corner of the monitor
        const monitorSize = monitor.size;       // Monitor dimensions

        // Calculate centre position, accounting for monitor offset (multi-monitor setups)
        const centerX = monitorPos.x + Math.round((monitorSize.width - windowSize.width) / 2);
        const centerY = monitorPos.y + Math.round((monitorSize.height - windowSize.height) / 2);

        await appWindow.setPosition(new PhysicalPosition(centerX, centerY));
        console.log(`[Renderer] Centered character at (${centerX}, ${centerY})`);

        // Save the new centred position to config
        await saveWindowPosition();
    } catch (e) {
        console.error('[Renderer] Failed to center character:', e);
    }
}

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
    // Step 3: Restore saved window position
    // -------------------------------------------------------------------------
    // If the config has saved window coordinates, move the window there.
    // This ensures the character appears where the user last left it.
    const cfg = config as any;
    if (cfg.windowX !== undefined && cfg.windowY !== undefined) {
        try {
            await appWindow.setPosition(new PhysicalPosition(cfg.windowX, cfg.windowY));
            console.log(`[Renderer] Restored window position: (${cfg.windowX}, ${cfg.windowY})`);
        } catch (e) {
            console.warn('[Renderer] Failed to restore window position:', e);
        }
    }

    // -------------------------------------------------------------------------
    // Step 4: Initialize all modules
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
    // Step 5: Apply loaded configuration
    // -------------------------------------------------------------------------
    // This updates the UI to match the saved settings (theme, shortcuts, etc.)
    applyConfig(config);

    // Now show character
    setTimeout(() => setVisible(true), 100);

    // -------------------------------------------------------------------------
    // Step 6: Platform-specific window setup
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
    // Step 7: Listen for backend shortcut events
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
        if (name === 'center_character') centerCharacterOnScreen();
    });

    // -------------------------------------------------------------------------
    // Step 8: Set up cursor synchronization
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

    // -------------------------------------------------------------------------
    // Step 9: Save window position after drags and on close
    // -------------------------------------------------------------------------
    // Save position whenever the user finishes dragging the character.
    // We detect drag-end via mouseup after the window has moved.
    let lastSavedPos = { x: 0, y: 0 };
    try {
        const initialPos = await appWindow.outerPosition();
        lastSavedPos = { x: initialPos.x, y: initialPos.y };
    } catch (_) { /* ignore */ }

    window.addEventListener('mouseup', async () => {
        // After a mouseup, check if the window moved since last save
        try {
            const currentPos = await appWindow.outerPosition();
            if (currentPos.x !== lastSavedPos.x || currentPos.y !== lastSavedPos.y) {
                lastSavedPos = { x: currentPos.x, y: currentPos.y };
                await saveWindowPosition();
            }
        } catch (_) { /* ignore */ }
    });

    // Also save position when the window is closed (Alt+F4, X button, etc.).
    // Tauri's close-requested event fires before the window is destroyed,
    // giving us time to await async operations (unlike beforeunload).
    appWindow.onCloseRequested(async (event) => {
        // Prevent default close immediately so we can finish async saves
        event.preventDefault();
        console.log('\n[Renderer] =======================================');
        console.log('[Renderer] 🛑 Window close requested by user (Alt+F4 / Close Button)');
        console.log('[Renderer] =======================================\n');

        console.log('[Renderer] Step 1: Saving window position...');
        await saveWindowPosition();

        console.log('[Renderer] Step 2: Triggering memory consolidation (End of Session)...');
        // Choose the correct AI provider to perform the final summarization

        let provider;
        switch (state.config.provider) {
            case 'ollama':
                provider = ollamaService;
                break;
            case 'gemini':
            default:
                // Defaulting to Gemini as the primary robust provider
                provider = geminiService;
                break;
        }

        console.log(`[Renderer] Selected AI Provider for summarization: ${state.config.provider || 'gemini'}`);

        try {
            console.log('[Renderer] Calling historyService.endSession()...');
            const saved = await historyService.endSession(state.config, provider.summarize.bind(provider));
            if (saved) {
                console.log('[Renderer] ✅ Session memory successfully summarized and saved to long-term storage.');
            } else {
                console.log('[Renderer] ℹ️ No short-term memory to save (buffer was empty).');
            }
        } catch (e) {
            console.error('[Renderer] ❌ Failed to save session memory during shutdown:', e);
        }

        console.log('[Renderer] Step 3: All shutdown tasks complete. Destroying window...');
        appWindow.destroy();
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

