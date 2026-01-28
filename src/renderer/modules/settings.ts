import { state } from './store';
import { updateCharacterTheme } from './character';
import { showSpeechBubble, hideSpeechBubble } from './chat';
import { invoke } from '@tauri-apps/api/core';
import { toggleScreensaver } from './screensaver';

// DOM Elements
const settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const closeSettingsBtn = document.getElementById('close-settings') as HTMLButtonElement;
const saveSettingsBtn = document.getElementById('save-settings') as HTMLButtonElement;

// Form Elements
const apiProvider = document.getElementById('api-provider') as HTMLSelectElement;
const apiKey = document.getElementById('api-key') as HTMLInputElement;
const geminiModel = document.getElementById('gemini-model') as HTMLSelectElement;
const customModelInput = document.getElementById('custom-model-input') as HTMLInputElement;
const characterName = document.getElementById('character-name') as HTMLInputElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const personalityCheckboxes = document.querySelectorAll('#personality-traits input') as NodeListOf<HTMLInputElement>;
const debugModeCheckbox = document.getElementById('debug-mode') as HTMLInputElement;

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
            closeSettings();
        });
    }
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
}

import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { updateWindowSize } from './chat';

async function openSettings() {
    settingsPanel.classList.remove('hidden');
    // Resize window to fit settings comfortably
    try {
        await getCurrentWindow().setSize(new LogicalSize(500, 600));
    } catch (e) {
        console.error("Failed to resize for settings:", e);
    }
}

async function closeSettings() {
    settingsPanel.classList.add('hidden');
    // Restore window size to character/chat mode
    await updateWindowSize();
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
        debugMode: debugModeCheckbox.checked
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
