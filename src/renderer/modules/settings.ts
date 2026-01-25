import { state } from './store';
import { updateCharacterTheme } from './character';
import { showSpeechBubble, hideSpeechBubble } from './chat';

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

    // Listen for tray event
    window.electronAPI.onOpenSettings(() => openSettings());
}

export function applyConfig(cfg: any) {
    state.config = cfg; // Update shared state

    apiProvider.value = cfg.provider || 'gemini';
    apiKey.value = cfg.apiKey || '';

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

function openSettings() {
    settingsPanel.classList.remove('hidden');
}

function closeSettings() {
    settingsPanel.classList.add('hidden');
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
        apiKey: apiKey.value,
        geminiModel: modelToSave,
        characterName: characterName.value,
        theme: themeSelect.value,
        personality: selectedPersonality,
        debugMode: debugModeCheckbox.checked
    };

    await window.electronAPI.saveConfig(newConfig);
    applyConfig(newConfig); // Re-apply to update UI/State
    closeSettings();

    showSpeechBubble("Settings saved! ✨");
    setTimeout(hideSpeechBubble, 2000);
}
