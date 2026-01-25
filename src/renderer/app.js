// ===== State Management =====
const CharacterState = {
    IDLE: 'idle',
    CLICKED: 'clicked',
    LISTENING: 'listening',
    TALKING: 'talking'
};

let currentState = CharacterState.IDLE;
let config = {};
let conversationHistory = [];
let idleTimeout = null;
const IDLE_TIMEOUT_MS = 15000; // Return to idle after 15 seconds of no input

// ===== DOM Elements =====
const character = document.getElementById('character');
const characterImg = document.getElementById('character-img');
const speechBubble = document.getElementById('speech-bubble');
const bubbleText = document.getElementById('bubble-text');
const chatInputContainer = document.getElementById('chat-input-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const backpack = document.getElementById('backpack');
const settingsPanel = document.getElementById('settings-panel');

// Settings form elements
const apiProvider = document.getElementById('api-provider');
const apiKey = document.getElementById('api-key');
const geminiModel = document.getElementById('gemini-model');
const characterName = document.getElementById('character-name');
const themeSelect = document.getElementById('theme-select');
const personalityCheckboxes = document.querySelectorAll('#personality-traits input');
const saveSettingsBtn = document.getElementById('save-settings');
const closeSettingsBtn = document.getElementById('close-settings');
const debugModeCheckbox = document.getElementById('debug-mode');

// ===== Initialization =====
async function init() {
    config = await window.electronAPI.loadConfig();
    applyConfig(config);

    // Listen for settings open from tray
    window.electronAPI.onOpenSettings(() => openSettings());
}

function applyConfig(cfg) {
    apiProvider.value = cfg.provider || 'gemini';
    apiKey.value = cfg.apiKey || '';
    geminiModel.value = cfg.geminiModel || 'gemini-2.0-flash';
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

function updateCharacterTheme(theme) {
    const basePath = `../../assets/themes/${theme}`;
    characterImg.src = `${basePath}/idle.png`;
}

// ===== State Machine =====
function setState(newState) {
    currentState = newState;
    character.className = `state-${newState}`;

    // Update character image based on state and theme
    const theme = config.theme || 'fox';
    const basePath = `../../assets/themes/${theme}`;

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
    if (e.target === backpack || backpack.contains(e.target)) return;

    // If already showing input, don't react again
    if (!chatInputContainer.classList.contains('hidden')) return;

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
function showSpeechBubble(text, animate = true) {
    speechBubble.classList.remove('hidden');

    if (animate) {
        typeText(text);
    } else {
        bubbleText.textContent = text;
    }
}

function hideSpeechBubble() {
    speechBubble.classList.add('hidden');
    bubbleText.textContent = '';
}

async function typeText(text) {
    bubbleText.innerHTML = '';
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';

    for (let i = 0; i < text.length; i++) {
        bubbleText.textContent = text.substring(0, i + 1);
        bubbleText.appendChild(cursor);
        await sleep(30 + Math.random() * 20);
    }

    // Remove cursor after typing
    setTimeout(() => cursor.remove(), 1000);
}

function sleep(ms) {
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

function returnToIdle(message) {
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

    hideChatInput();
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

        // Return to idle after showing response
        setTimeout(() => {
            setState(CharacterState.IDLE);
            // Keep bubble visible for reading, hide after delay
            setTimeout(() => {
                hideSpeechBubble();
            }, 5000);
        }, 2000);

    } catch (error) {
        console.error('Error sending message:', error);
        setState(CharacterState.TALKING);
        showSpeechBubble("Something went wrong! 😵");
        setTimeout(() => setState(CharacterState.IDLE), 2000);
    }
}

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

// ===== Window Dragging =====
let isDragging = false;
let dragStartMouseX, dragStartMouseY;
let dragStartWinX, dragStartWinY;

// Start drag from character
async function startDrag(e) {
    // Don't start drag if clicking on backpack/settings button
    if (e.target === backpack || backpack.contains(e.target)) return;

    isDragging = true;
    dragStartMouseX = e.screenX;
    dragStartMouseY = e.screenY;
    // Get initial window position
    const bounds = await window.electronAPI.getWindowBounds();
    dragStartWinX = bounds.x;
    dragStartWinY = bounds.y;
    e.preventDefault();
}

character.addEventListener('mousedown', startDrag);

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    // Calculate absolute target position based on initial position + mouse movement
    const targetX = dragStartWinX + (e.screenX - dragStartMouseX);
    const targetY = dragStartWinY + (e.screenY - dragStartMouseY);

    window.electronAPI.setWindowPosition(targetX, targetY);
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
    const selectedPersonality = [];
    personalityCheckboxes.forEach(cb => {
        if (cb.checked) selectedPersonality.push(cb.value);
    });

    config = {
        provider: apiProvider.value,
        apiKey: apiKey.value,
        geminiModel: geminiModel.value,
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
