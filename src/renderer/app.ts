/// <reference path="../vite-env.d.ts" />

// ===== State Management =====
const CharacterState = {
    IDLE: 'idle',
    CLICKED: 'clicked',
    LISTENING: 'listening',
    TALKING: 'talking'
} as const;

type CharacterStateValue = typeof CharacterState[keyof typeof CharacterState];

let currentState: CharacterStateValue = CharacterState.IDLE;
let config: any = {};
let idleTimeout: NodeJS.Timeout | null = null;
const IDLE_TIMEOUT_MS = 15000; // Return to idle after 15 seconds of no input
let isTyping = false;
let hasDragged = false;

// ===== DOM Elements =====
const character = document.getElementById('character') as HTMLDivElement;
const characterImg = document.getElementById('character-img') as HTMLImageElement;
const speechBubble = document.getElementById('speech-bubble') as HTMLDivElement;
const bubbleText = document.getElementById('bubble-text') as HTMLParagraphElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const settingsPanel = document.getElementById('settings-panel') as HTMLDivElement;

// Settings form elements
const apiProvider = document.getElementById('api-provider') as HTMLSelectElement;
const apiKey = document.getElementById('api-key') as HTMLInputElement;
const geminiModel = document.getElementById('gemini-model') as HTMLSelectElement;
const customModelInput = document.getElementById('custom-model-input') as HTMLInputElement;
const characterName = document.getElementById('character-name') as HTMLInputElement;
const themeSelect = document.getElementById('theme-select') as HTMLSelectElement;
const personalityCheckboxes = document.querySelectorAll('#personality-traits input') as NodeListOf<HTMLInputElement>;
const saveSettingsBtn = document.getElementById('save-settings') as HTMLButtonElement;
const closeSettingsBtn = document.getElementById('close-settings') as HTMLButtonElement;
const debugModeCheckbox = document.getElementById('debug-mode') as HTMLInputElement;

// ===== Initialization =====
async function init() {
    config = await window.electronAPI.loadConfig();
    applyConfig(config);

    // Listen for settings open from tray
    window.electronAPI.onOpenSettings(() => openSettings());

    // Setup click-through: enable clicking when mouse enters interactive elements
    // setupClickThrough();
}

function applyConfig(cfg: any) {
    apiProvider.value = cfg.provider || 'gemini';
    apiKey.value = cfg.apiKey || '';

    // Handle custom model
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

    // Set personality checkboxes
    personalityCheckboxes.forEach(cb => {
        cb.checked = (cfg.personality || ['helpful', 'quirky', 'playful']).includes(cb.value);
    });

    // Debug mode
    debugModeCheckbox.checked = cfg.debugMode || false;
    document.body.classList.toggle('debug-mode', cfg.debugMode || false);

    // Update character image based on theme
    updateCharacterTheme(cfg.theme || 'fox');
}

// Toggle custom model input
geminiModel.addEventListener('change', () => {
    if (geminiModel.value === 'custom') {
        customModelInput.classList.remove('hidden');
        customModelInput.focus();
    } else {
        customModelInput.classList.add('hidden');
    }
});

function updateCharacterTheme(theme: string) {
    const basePath = `assets/themes/${theme}`;
    characterImg.src = `${basePath}/idle.png`;
}

// ===== State Machine =====
function setState(newState: CharacterStateValue) {
    currentState = newState;
    character.className = `state-${newState}`;

    // Update character image based on state and theme
    const theme = config.theme || 'fox';
    const basePath = `assets/themes/${theme}`;

    switch (newState) {
        case CharacterState.CLICKED:
            characterImg.src = `${basePath}/clicked.png`;
            break;
        case CharacterState.LISTENING:
            characterImg.src = `${basePath}/listening.png`;
            break;
        case CharacterState.TALKING:
            characterImg.src = `${basePath}/talking.png`;
            break;
        default:
            characterImg.src = `${basePath}/idle.png`;
    }
}

// ===== Character Interactions =====
const clickReactions = [
    "Oh! I felt that! 😊 How're you doing?",
    "Hey there! *wiggles ears* What's up?",
    "Ooh, a poke! Got something on your mind?",
    "*blinks* Hello, friend! Need me?",
    "Ah! You found me! 🦊 What can I do for you?"
];

function getRandomReaction() {
    return clickReactions[Math.floor(Math.random() * clickReactions.length)];
}

character.addEventListener('click', (e) => {
    // Ignore clicks on backpack
    if (e.target === backpack || backpack.contains(e.target as Node)) return;

    // If already showing input or typing, don't react again
    if (!chatInputContainer.classList.contains('hidden') || isTyping || hasDragged) return;

    console.log('Character clicked');

    handleCharacterClick();
});

function handleCharacterClick() {
    setState(CharacterState.CLICKED);

    // Show reaction
    showSpeechBubble(getRandomReaction());

    // After reaction, show chat input
    setTimeout(() => {
        showChatInput();
        setState(CharacterState.LISTENING);
    }, 1500);
}

// ===== Speech Bubble =====
const BASE_HEIGHT = 450;
const EXTRA_PADDING = 50;

function updateWindowHeight() {
    const bubbleHeight = speechBubble.offsetHeight;
    if (!speechBubble.classList.contains('hidden') && bubbleHeight > 100) {
        // Calculate new total height required (base height + extra bubble height)
        // Base window is set for roughly 100px bubble. If bigger, grow window.
        // Or simply: 300px (character) + bubbleHeight + padding
        const newHeight = 350 + bubbleHeight + EXTRA_PADDING;
        window.electronAPI.setWindowSize(350, Math.max(BASE_HEIGHT, newHeight));
    } else {
        window.electronAPI.setWindowSize(350, BASE_HEIGHT);
    }
}

function showSpeechBubble(text: string, animate = true) {
    speechBubble.classList.remove('hidden');

    if (animate) {
        typeText(text);
    } else {
        bubbleText.textContent = text;
        // Update size immediately for static text
        setTimeout(updateWindowHeight, 50);
    }
}

function hideSpeechBubble() {
    speechBubble.classList.add('hidden');
    bubbleText.textContent = '';
    window.electronAPI.setWindowSize(350, BASE_HEIGHT);
}

async function typeText(text: string) {
    if (isTyping) return;
    isTyping = true;

    try {
        bubbleText.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';

        for (let i = 0; i < text.length; i++) {
            // Stop typing if bubble was hidden or state changed
            if (speechBubble.classList.contains('hidden')) break;

            bubbleText.textContent = text.substring(0, i + 1);
            bubbleText.appendChild(cursor);

            // Check if height changed and resize window if needed
            if (i % 10 === 0) updateWindowHeight();

            await sleep(30 + Math.random() * 20);
        }

        updateWindowHeight(); // Final update

        // Remove cursor after typing
        setTimeout(() => {
            if (cursor.parentNode) cursor.remove();
        }, 1000);
    } catch (e) {
        console.error('Typing error:', e);
        bubbleText.textContent = text; // Fallback to full text
    } finally {
        isTyping = false;
    }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== Chat Input =====
function showChatInput() {
    chatInputContainer.classList.remove('hidden');
    chatInput.focus();

    // Start idle timeout - return to idle if user doesn't respond
    clearIdleTimeout();
    idleTimeout = setTimeout(() => {
        returnToIdle("Taking a quick nap... poke me anytime! 😴");
    }, IDLE_TIMEOUT_MS);
}

function hideChatInput() {
    chatInputContainer.classList.add('hidden');
    chatInput.value = '';
    clearIdleTimeout();
}

function clearIdleTimeout() {
    if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
    }
}

function returnToIdle(message: string | null) {
    hideChatInput();
    hideSpeechBubble();
    if (message) {
        showSpeechBubble(message);
        setTimeout(hideSpeechBubble, 3000);
    }
    setState(CharacterState.IDLE);
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    // Clear input but keep visible
    chatInput.value = '';
    chatInput.disabled = true; // Disable while thinking

    // Reset idle timeout so we don't disappear while thinking
    clearIdleTimeout();

    setState(CharacterState.LISTENING);
    showSpeechBubble('Hmm, let me think... 🤔', false);

    try {
        const result = await window.electronAPI.sendMessage(message, config);

        if (result.error) {
            setState(CharacterState.TALKING);
            showSpeechBubble(`Oops! ${result.error} 😅`);
        } else {
            setState(CharacterState.TALKING);
            await showSpeechBubble(result.response);
        }

        // Re-enable input for next message
        chatInput.disabled = false;
        chatInput.focus();

        // Return to listening state for next input
        setState(CharacterState.LISTENING);

        // Start new idle timeout
        idleTimeout = setTimeout(() => {
            returnToIdle("I'll just take a nap then! 😴");
        }, IDLE_TIMEOUT_MS);

    } catch (error) {
        console.error('Error sending message:', error);
        setState(CharacterState.TALKING);
        showSpeechBubble("Something went wrong! 😵");

        // Re-enable even on error
        setTimeout(() => {
            chatInput.disabled = false;
            chatInput.focus();
            setState(CharacterState.LISTENING);
        }, 2000);
    }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// Reset idle timeout while typing
chatInput.addEventListener('input', () => {
    if (idleTimeout) {
        clearIdleTimeout();
        idleTimeout = setTimeout(() => {
            returnToIdle("Still there? I'm going to nap! 😴");
        }, IDLE_TIMEOUT_MS);
    }
});

// ===== Window Dragging =====
let isDragging = false;
let dragStartMouseX: number, dragStartMouseY: number;
let dragStartWinX: number, dragStartWinY: number;
let dragStartWidth: number, dragStartHeight: number;

// Start drag from character
async function startDrag(e: MouseEvent) {
    // Don't start drag if clicking on backpack/settings button
    if (e.target === backpack || backpack.contains(e.target as Node)) return;

    isDragging = true;
    hasDragged = false;
    dragStartMouseX = e.screenX;
    dragStartMouseY = e.screenY;

    // Get initial window position AND size
    const bounds = await window.electronAPI.getWindowBounds();
    dragStartWinX = bounds.x;
    dragStartWinY = bounds.y;
    dragStartWidth = bounds.width;
    dragStartHeight = bounds.height;

    e.preventDefault();
}

character.addEventListener('mousedown', startDrag);

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Calculate absolute target position based on initial position + mouse movement
    const targetX = dragStartWinX + (e.screenX - dragStartMouseX);
    const targetY = dragStartWinY + (e.screenY - dragStartMouseY);

    if (Math.abs(e.screenX - dragStartMouseX) > 3 || Math.abs(e.screenY - dragStartMouseY) > 3) {
        hasDragged = true;
    }

    // Force strict size maintenance during drag
    window.electronAPI.setWindowPosition(targetX, targetY, dragStartWidth, dragStartHeight);
});

document.addEventListener('mouseup', () => {
    isDragging = false;
});

// ===== Settings =====
function openSettings() {
    settingsPanel.classList.remove('hidden');
}

function closeSettings() {
    settingsPanel.classList.add('hidden');
}

backpack.addEventListener('click', (e) => {
    e.stopPropagation();
    openSettings();
});

closeSettingsBtn.addEventListener('click', closeSettings);

saveSettingsBtn.addEventListener('click', async () => {
    // Gather settings
    const selectedPersonality: string[] = [];
    personalityCheckboxes.forEach(cb => {
        if (cb.checked) selectedPersonality.push(cb.value);
    });

    // Determine model to save
    let modelToSave = geminiModel.value;
    if (modelToSave === 'custom') {
        modelToSave = customModelInput.value.trim() || 'gemini-2.0-flash';
    }

    config = {
        provider: apiProvider.value,
        apiKey: apiKey.value,
        geminiModel: modelToSave,
        characterName: characterName.value,
        theme: themeSelect.value,
        personality: selectedPersonality,
        debugMode: debugModeCheckbox.checked
    };

    await window.electronAPI.saveConfig(config);
    updateCharacterTheme(config.theme);
    document.body.classList.toggle('debug-mode', config.debugMode);
    closeSettings();

    // Confirm save with speech bubble
    showSpeechBubble("Settings saved! ✨");
    setTimeout(hideSpeechBubble, 2000);
});

// Close settings when clicking outside
settingsPanel.addEventListener('click', (e) => {
    if (e.target === settingsPanel) closeSettings();
});

// ===== Start =====
init();
