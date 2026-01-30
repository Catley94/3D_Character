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

    // Backend Click Listener (Ensures clicks work even on transparent areas)
    listen('click', async (event: any) => {
        const { button, x: globalX, y: globalY } = event.payload;
        if (button !== 'left') return;

        // Check if click is inside our window
        const pos = await appWindow.innerPosition();
        const size = await appWindow.innerSize();

        const isInside =
            globalX >= pos.x && globalX <= pos.x + size.width &&
            globalY >= pos.y && globalY <= pos.y + size.height;

        if (isInside) {
            console.log('[Backend Event] Internal Click detected');
            // Trigger character interaction
            handleCharacterClick();
        }
    });

    console.log('[Renderer] Ready!');
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
