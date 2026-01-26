/// <reference path="../vite-env.d.ts" />
import { state } from './modules/store';
import { setupClickThrough } from './modules/interactions';
import { initCharacter } from './modules/character';
import { initChat, activateChat } from './modules/chat';
import { initSettings, applyConfig } from './modules/settings';

async function init() {
    console.log('[Renderer] Initializing...');

    // Load initial config
    const config = await window.electronAPI.loadConfig();

    // Initialize Modules
    setupClickThrough();
    initCharacter();
    initChat();
    initSettings();

    // Apply config (updates UI, State, Theme)
    applyConfig(config);

    // Listen for Global Shortcut
    window.electronAPI.onActivateChat(() => {
        activateChat();
    });

    console.log('[Renderer] Ready!');
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
