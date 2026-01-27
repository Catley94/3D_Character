import { listen } from '@tauri-apps/api/event';
import { state } from './modules/store';
import { setupClickThrough } from './modules/interactions';
import { initCharacter } from './modules/character';
import { initChat, activateChat } from './modules/chat';
import { initSettings, applyConfig } from './modules/settings';

async function init() {
    console.log('[Renderer] Initializing (Tauri)...');

    // Load initial config (TODO: Implement config loading via Tauri Command)
    const config = { theme: 'fox' }; // Placeholder until we reimplement config loading
    // const config = await invoke('load_config'); 

    // Initialize Modules
    setupClickThrough();
    initCharacter();
    initChat();
    initSettings();

    // Apply config (updates UI, State, Theme)
    applyConfig(config);

    // Listen for Global Shortcut (Emitted from Rust)
    await listen('shortcut', (event: any) => {
        if (event.payload.name === 'toggle_chat') {
            activateChat();
        } else if (event.payload.name === 'toggle_drag') {
            const isDragMode = document.body.classList.toggle('drag-mode-active');
            console.log(`[Renderer] Drag Mode: ${isDragMode ? 'ON' : 'OFF'}`);
            // TODO: Notify Rust to change window pass-through behavior if needed
        }
    });

    console.log('[Renderer] Ready!');
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});
