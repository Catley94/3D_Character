import { state, defaultShortcuts } from './store';
import { THEME_NICKNAMES, DEFAULT_OLLAMA_URL, DEFAULT_OLLAMA_MODEL } from '../constants';
import { OllamaService } from '../services/ollama';

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

// Provider-specific setting containers
const geminiSettings = document.getElementById('gemini-settings') as HTMLDivElement;
const ollamaSettings = document.getElementById('ollama-settings') as HTMLDivElement;

// Ollama-specific form elements
const ollamaUrl = document.getElementById('ollama-url') as HTMLInputElement;
const ollamaModel = document.getElementById('ollama-model') as HTMLSelectElement;
const ollamaCustomModel = document.getElementById('ollama-custom-model') as HTMLInputElement;
const refreshOllamaModelsBtn = document.getElementById('refresh-ollama-models') as HTMLButtonElement;
const testOllamaConnectionBtn = document.getElementById('test-ollama-connection') as HTMLButtonElement;
const ollamaConnectionStatus = document.getElementById('ollama-connection-status') as HTMLParagraphElement;

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

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isSettingsOpen()) {
            closeSettings();
        }
    });

    // Close when clicking outside
    settingsPanel.addEventListener('click', (e) => {
        if (e.target === settingsPanel) closeSettings();
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    // Provider change: toggle Gemini vs Ollama settings visibility
    apiProvider.addEventListener('change', () => {
        updateProviderUI(apiProvider.value);
    });

    geminiModel.addEventListener('change', () => {
        if (geminiModel.value === 'custom') {
            customModelInput.classList.remove('hidden');
            customModelInput.focus();
        } else {
            customModelInput.classList.add('hidden');
        }
    });

    // Ollama: Refresh models button
    refreshOllamaModelsBtn.addEventListener('click', () => {
        fetchOllamaModels(ollamaUrl.value || DEFAULT_OLLAMA_URL);
    });

    // Ollama: Test connection button
    testOllamaConnectionBtn.addEventListener('click', async () => {
        ollamaConnectionStatus.textContent = 'Testing...';
        ollamaConnectionStatus.style.color = '#aaa';
        const result = await OllamaService.testConnection(ollamaUrl.value || DEFAULT_OLLAMA_URL);
        ollamaConnectionStatus.textContent = result.message;
        ollamaConnectionStatus.style.color = result.success ? '#10b981' : '#ef4444';
    });

    // Theme Change Listener - Auto-update name if it's generic
    themeSelect.addEventListener('change', () => {
        const newTheme = themeSelect.value;
        const currentName = characterName.value.trim();

        // Check if current name matches ANY known theme nickname
        const isGenericName = Object.values(THEME_NICKNAMES).includes(currentName);

        if (isGenericName || currentName === '') {
            const newName = THEME_NICKNAMES[newTheme];
            if (newName) {
                characterName.value = newName;
            }
        }
    });

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

    // Load External Themes
    loadExternalThemes();
}

async function loadExternalThemes() {
    try {
        const externalThemes = await invoke<string[]>('list_external_themes');
        console.log('[Settings] Loaded external themes:', externalThemes);

        // Keep built-in themes (first 4 options)
        const builtInValues = ['fox', 'dragon', 'cat', 'wolf'];

        // Remove old external options if any
        Array.from(themeSelect.options).forEach(opt => {
            if (!builtInValues.includes(opt.value)) {
                themeSelect.removeChild(opt);
            }
        });

        externalThemes.forEach(theme => {
            const opt = document.createElement('option');
            opt.value = theme;
            opt.textContent = `📂 ${theme}`; // Distinguish with icon
            themeSelect.appendChild(opt);
        });

    } catch (e) {
        console.error('[Settings] Failed to load external themes:', e);
    }
}

/**
 * Toggle the visibility of provider-specific settings sections.
 * Shows Gemini fields when 'gemini' is selected, Ollama fields when 'ollama'.
 *
 * @param provider - The selected provider value ('gemini' or 'ollama')
 */
function updateProviderUI(provider: string) {
    if (provider === 'ollama') {
        geminiSettings.classList.add('hidden');
        ollamaSettings.classList.remove('hidden');
        // Auto-fetch models when switching to Ollama
        fetchOllamaModels(ollamaUrl.value || DEFAULT_OLLAMA_URL);
    } else {
        geminiSettings.classList.remove('hidden');
        ollamaSettings.classList.add('hidden');
    }
}

/**
 * Fetch available models from the Ollama instance and populate the dropdown.
 *
 * @param url - The base URL of the Ollama instance
 */
async function fetchOllamaModels(url: string) {
    refreshOllamaModelsBtn.textContent = '⏳';
    const models = await OllamaService.listModels(url);
    refreshOllamaModelsBtn.textContent = '🔄';

    // Preserve current selection
    const currentValue = ollamaModel.value;

    // Clear existing options
    ollamaModel.innerHTML = '';

    if (models.length > 0) {
        // Add discovered models
        models.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            ollamaModel.appendChild(opt);
        });
    } else {
        // Fallback if no models found
        const opt = document.createElement('option');
        opt.value = DEFAULT_OLLAMA_MODEL;
        opt.textContent = `${DEFAULT_OLLAMA_MODEL} (default)`;
        ollamaModel.appendChild(opt);
    }

    // Add "Custom..." option at the end
    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Custom Model ID...';
    ollamaModel.appendChild(customOpt);

    // Restore previous selection if still available
    if (Array.from(ollamaModel.options).some(opt => opt.value === currentValue)) {
        ollamaModel.value = currentValue;
    }

    // Handle custom model input toggle
    ollamaModel.addEventListener('change', () => {
        if (ollamaModel.value === 'custom') {
            ollamaCustomModel.classList.remove('hidden');
            ollamaCustomModel.focus();
        } else {
            ollamaCustomModel.classList.add('hidden');
        }
    });
}

export function applyConfig(cfg: any) {
    console.log('[Settings] Applying config:', cfg);
    state.config = cfg; // Update shared state

    // Provider selection
    const provider = cfg.provider || 'gemini';
    apiProvider.value = provider;
    updateProviderUI(provider);

    // Gemini settings
    apiKey.value = cfg.geminiApiKey || cfg.apiKey || ''; // Support both keys

    const savedModel = cfg.geminiModel || DEFAULT_GEMINI_MODEL;
    const isCustom = !Array.from(geminiModel.options).some(opt => opt.value === savedModel);

    if (isCustom) {
        geminiModel.value = 'custom';
        customModelInput.value = savedModel;
        customModelInput.classList.remove('hidden');
    } else {
        geminiModel.value = savedModel;
        customModelInput.classList.add('hidden');
    }

    // Ollama settings
    ollamaUrl.value = cfg.ollamaUrl || DEFAULT_OLLAMA_URL;
    // Set Ollama model (if available in dropdown, otherwise treat as custom)
    const savedOllamaModel = cfg.ollamaModel || DEFAULT_OLLAMA_MODEL;
    if (Array.from(ollamaModel.options).some(opt => opt.value === savedOllamaModel)) {
        ollamaModel.value = savedOllamaModel;
    } else {
        // Add it as an option and select it
        const opt = document.createElement('option');
        opt.value = savedOllamaModel;
        opt.textContent = savedOllamaModel;
        ollamaModel.insertBefore(opt, ollamaModel.firstChild);
        ollamaModel.value = savedOllamaModel;
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
import { DEFAULT_GEMINI_MODEL } from '../constants';

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

    // Resolve Gemini model (handle custom input)
    let geminiModelToSave = geminiModel.value;
    if (geminiModelToSave === 'custom') {
        geminiModelToSave = customModelInput.value.trim() || 'gemini-2.0-flash';
    }

    // Resolve Ollama model (handle custom input)
    let ollamaModelToSave = ollamaModel.value;
    if (ollamaModelToSave === 'custom') {
        ollamaModelToSave = ollamaCustomModel.value.trim() || DEFAULT_OLLAMA_MODEL;
    }

    const newConfig = {
        provider: apiProvider.value,
        // Gemini config
        geminiApiKey: apiKey.value,
        geminiModel: geminiModelToSave,
        // Ollama config
        ollamaUrl: ollamaUrl.value.trim() || DEFAULT_OLLAMA_URL,
        ollamaModel: ollamaModelToSave,
        // Shared config
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
