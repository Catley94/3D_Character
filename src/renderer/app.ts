import { invoke } from '@tauri-apps/api/core';
import { setupClickThrough } from './modules/interactions';
import { initCharacter } from './modules/character';
import { initChat } from './modules/chat';
import { initSettings, applyConfig } from './modules/settings';
import { initLighting } from './modules/lighting';
import { initScreensaver } from './modules/screensaver';
import { unregisterAll } from '@tauri-apps/plugin-global-shortcut';
import { state } from './modules/store';

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

    console.log('[Renderer] Ready!');
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
