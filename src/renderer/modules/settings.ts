import { state, defaultShortcuts } from './store';
import { updateCharacterTheme, updateDragShortcut, updateVisibilityShortcut, setInteractionOverride } from './character';
import { showSpeechBubble, hideSpeechBubble, updateChatShortcut } from './chat';
import { invoke } from '@tauri-apps/api/core';
import { toggleScreensaver, updateScreensaverShortcut } from './screensaver';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

// DOM Elements
const settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const closeSettingsBtn = document.getElementById('close-settings') as HTMLButtonElement;
const saveSettingsBtn = document.getElementById('save-settings') as HTMLButtonElement;

export function isSettingsOpen(): boolean {
    return !settingsPanel.classList.contains('hidden');
}

// Form Elements
const apiProvider = document.getElementById('api-provider') as HTMLSelectElement;
const apiKey = document.getElementById('api-key') as HTMLInputElement;
const geminiModel = document.getElementById('gemini-model') as HTMLSelectElement;
const customModelInput = document.getElementById('custom-model-input') as HTMLInputElement;
const characterName = document.getElementById('character-name') as HTMLInputElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const personalityCheckboxes = document.querySelectorAll('#personality-traits input') as NodeListOf<HTMLInputElement>;
const debugModeCheckbox = document.getElementById('debug-mode') as HTMLInputElement;

// Shortcut Inputs
const shortcutInputs = {
    toggleChat: document.getElementById('shortcut-toggle-chat') as HTMLInputElement,
    toggleDrag: document.getElementById('shortcut-toggle-drag') as HTMLInputElement,
    toggleVisibility: document.getElementById('shortcut-toggle-visibility') as HTMLInputElement,
    screensaver: document.getElementById('shortcut-screensaver') as HTMLInputElement
};

export function initSettings() {
    backpack.addEventListener('click', (e) => {
        e.stopPropagation();
        openSettings();
    });

    closeSettingsBtn.addEventListener('click', closeSettings);

    // Close when clicking outside
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) closeSettings();
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    geminiModel.addEventListener('change', () => {
        if (geminiModel.value === 'custom') {
            customModelInput.classList.remove('hidden');
            customModelInput.focus();
        } else {
            customModelInput.classList.add('hidden');
        }
    });

    // Listen for tray event (TODO: Implement Tray in Rust)
    // listen('open-settings', () => openSettings());

    const startScreensaverBtn = document.getElementById('start-screensaver');
    if (startScreensaverBtn) {
        startScreensaverBtn.addEventListener('click', () => {
            toggleScreensaver();
            // closeSettings(); // Handled by toggleScreensaver now
        });
    }

    // Backend Click Listener for Settings Icon (Windows Fallback)
    let backendStartPos = { x: 0, y: 0 };
    listen('mousedown', (event: any) => {
        const { button, x, y } = event.payload;
        if (button === 'left') backendStartPos = { x, y };
    });

    listen('mouseup', async (event: any) => {
        const { button, x, y } = event.payload;
        if (button !== 'left') return;

        // Check drag threshold
        const dx = Math.abs(x - backendStartPos.x);
        const dy = Math.abs(y - backendStartPos.y);
        if (dx > 5 || dy > 5) return;

        // Check intersection with backpack
        try {
            const windowPos = await getCurrentWindow().outerPosition();
            const rect = backpack.getBoundingClientRect();

            const left = windowPos.x + rect.left;
            const top = windowPos.y + rect.top;
            const right = left + rect.width;
            const bottom = top + rect.height;

            if (x >= left && x <= right && y >= top && y <= bottom) {
                console.log('[Settings] Click detected via Backend!');
                openSettings();
            }
        } catch (e) {
            console.error('[Settings] Click check failed:', e);
        }
    });
}

export function applyConfig(cfg: any) {
    console.log('[Settings] Applying config:', cfg);
    state.config = cfg; // Update shared state

    apiProvider.value = cfg.provider || 'gemini';
    apiKey.value = cfg.geminiApiKey || cfg.apiKey || ''; // Support both keys

    const savedModel = cfg.geminiModel || 'gemini-2.0-flash';
    const isCustom = !Array.from(geminiModel.options).some(opt => opt.value === savedModel);

    if (isCustom) {
        geminiModel.value = 'custom';
        customModelInput.value = savedModel;
        customModelInput.classList.remove('hidden');
    } else {
        geminiModel.value = savedModel;
        customModelInput.classList.add('hidden');
    }

    characterName.value = cfg.characterName || 'Foxy';
    themeSelect.value = cfg.theme || 'fox';

    personalityCheckboxes.forEach(cb => {
        cb.checked = (cfg.personality || ['helpful', 'quirky', 'playful']).includes(cb.value);
    });

    debugModeCheckbox.checked = cfg.debugMode || false;
    document.body.classList.toggle('debug-mode', cfg.debugMode || false);

    updateCharacterTheme(cfg.theme || 'fox');
    updateCharacterTheme(cfg.theme || 'fox');

    // Shortcuts
    const shortcuts = cfg.shortcuts || defaultShortcuts;
    updateChatShortcut(shortcuts.toggleChat || defaultShortcuts.toggleChat);
    updateDragShortcut(shortcuts.toggleDrag || defaultShortcuts.toggleDrag);
    updateVisibilityShortcut(shortcuts.toggleVisibility || defaultShortcuts.toggleVisibility);
    updateScreensaverShortcut(shortcuts.screensaver || defaultShortcuts.screensaver);

    shortcutInputs.toggleChat.value = shortcuts.toggleChat;
    shortcutInputs.toggleDrag.value = shortcuts.toggleDrag;
    shortcutInputs.toggleVisibility.value = shortcuts.toggleVisibility;
    shortcutInputs.screensaver.value = shortcuts.screensaver;

    // Update screensaver button text
    const startScreensaverBtn = document.getElementById('start-screensaver');
    if (startScreensaverBtn) {
        startScreensaverBtn.innerText = `Start Screensaver Mode (${shortcuts.screensaver})`;
    }
}

import { LogicalSize } from '@tauri-apps/api/window';
import { updateWindowSize } from './chat';

async function openSettings() {
    settingsPanel.classList.remove('hidden');
    setInteractionOverride(true);
    // Resize window to fit settings comfortably
    try {
        await getCurrentWindow().setResizable(true);
        await getCurrentWindow().setSize(new LogicalSize(550, 650));
    } catch (e) {
        console.error("Failed to resize for settings:", e);
    }
}

async function closeSettings() {
    settingsPanel.classList.add('hidden');
    setInteractionOverride(false);
    // Restore window size to character/chat mode
    await updateWindowSize();
    try {
        await getCurrentWindow().setResizable(false);
    } catch (e) {
        console.warn("Failed to lock window size:", e);
    }
}

async function saveSettings() {
    const selectedPersonality: string[] = [];
    personalityCheckboxes.forEach(cb => {
        if (cb.checked) selectedPersonality.push(cb.value);
    });

    let modelToSave = geminiModel.value;
    if (modelToSave === 'custom') {
        modelToSave = customModelInput.value.trim() || 'gemini-2.0-flash';
    }

    const newConfig = {
        provider: apiProvider.value,
        geminiApiKey: apiKey.value, // Use specific key
        geminiModel: modelToSave,
        characterName: characterName.value,
        theme: themeSelect.value,
        personality: selectedPersonality,
        debugMode: debugModeCheckbox.checked,
        shortcuts: {
            toggleChat: shortcutInputs.toggleChat.value.trim() || defaultShortcuts.toggleChat,
            toggleDrag: shortcutInputs.toggleDrag.value.trim() || defaultShortcuts.toggleDrag,
            toggleVisibility: shortcutInputs.toggleVisibility.value.trim() || defaultShortcuts.toggleVisibility,
            screensaver: shortcutInputs.screensaver.value.trim() || defaultShortcuts.screensaver
        }
    };

    try {
        await invoke('save_config', { config: newConfig });
        applyConfig(newConfig);
        closeSettings();

        showSpeechBubble("Settings saved! ✨");
        setTimeout(hideSpeechBubble, 2000);
    } catch (e) {
        console.error("Failed to save config", e);
        showSpeechBubble("Error saving settings! 😢");
    }
}
