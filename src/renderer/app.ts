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
import { toggleDragMode, handleCharacterClick } from './modules/character';
import { activateChat } from './modules/chat';
import { toggleScreensaver } from './modules/screensaver';

const appWindow = getCurrentWindow();

async function init() {
    console.log('[Renderer] Initializing (Tauri)...');

    try {
        await unregisterAll();
        console.log('[Renderer] Cleared previous shortcuts');
    } catch (e) {
        console.warn('[Renderer] Failed to clear shortcuts:', e);
    }

    // Load initial config from Rust
    let config;
    try {
        config = await invoke('load_config');
        console.log('[Renderer] Loaded config:', config);
    } catch (e) {
        console.error('[Renderer] Failed to load config:', e);
        config = { theme: 'fox' };
    }

    // Initialize Modules
    setupClickThrough();
    initCharacter();
    initChat();
    initSettings();
    initLighting();
    await initScreensaver();

    // Apply config (updates UI, State, Theme)
    applyConfig(config);

    // Enforce Always on Top for Linux/Wayland reliability
    try {
        await appWindow.setAlwaysOnTop(true);
        console.log('[Renderer] Enforced Always on Top');
    } catch (e) {
        console.warn('[Renderer] Failed to enforce Always on Top:', e);
    }

    // Backend Shortcut Listener (Raw Input Fallback for Wayland)
    listen('shortcut', (event: any) => {
        const { name } = event.payload;
        console.log(`[Backend Event] Shortcut triggered: ${name}`);
        if (name === 'toggle_chat') activateChat();
        if (name === 'toggle_drag') toggleDragMode();
        if (name === 'toggle_screensaver') toggleScreensaver();
    });

    // Cursor Synchronization (Ensures Rust backend is aligned for shortcuts)
    window.addEventListener('mousemove', async (e) => {
        // Calculate global coordinates
        const pos = await appWindow.outerPosition();
        const globalX = pos.x + e.clientX;
        const globalY = pos.y + e.clientY;

        // Sync to backend (don't await for performance)
        invoke('sync_cursor', { x: Math.round(globalX), y: Math.round(globalY) });
    });

    console.log('[Renderer] Ready!');
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
