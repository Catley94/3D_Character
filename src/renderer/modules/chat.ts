import { state, CharacterState } from './store';
import { setState } from './character';

// DOM Elements
const speechBubble = document.getElementById('speech-bubble') as HTMLDivElement;
const bubbleText = document.getElementById('bubble-text') as HTMLParagraphElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

// Constants - Dynamic sizing
const CHARACTER_HEIGHT = 180;  // Character image + padding
const INPUT_HEIGHT = 60;       // Chat input container height
const EXTRA_PADDING = 30;      // Extra padding for spacing
const MIN_WIDTH = 200;
const CONTENT_WIDTH = 320;     // Width when content is shown
const IDLE_TIMEOUT_MS = 15000;

let idleTimeout: NodeJS.Timeout | null = null;

export function initChat() {
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
}

// ===== Speech Bubble Logic =====

export function showSpeechBubble(text: string, animate = true) {
    speechBubble.classList.remove('hidden');

    if (animate) {
        typeText(text);
    } else {
        bubbleText.textContent = text;
        setTimeout(updateWindowSize, 50);
    }
}

export function hideSpeechBubble() {
    speechBubble.classList.add('hidden');
    bubbleText.textContent = '';
    updateWindowSize();
}

// ===== Window Sizing Helpers =====

function lockWindow() {
    state.isWindowLocked = true;
    window.electronAPI.setWindowLocked(true);
    document.body.classList.add('window-locked');
}

function unlockWindow() {
    state.isWindowLocked = false;
    window.electronAPI.setWindowLocked(false);
    document.body.classList.remove('window-locked');
}

function calculateWindowHeight(): number {
    let height = CHARACTER_HEIGHT;

    // Add speech bubble height if visible
    if (!speechBubble.classList.contains('hidden')) {
        height += speechBubble.offsetHeight + 10;
    }

    // Add input height if visible
    if (!chatInputContainer.classList.contains('hidden')) {
        height += INPUT_HEIGHT;
    }

    return height + EXTRA_PADDING;
}

function updateWindowSize() {
    const hasContent = !speechBubble.classList.contains('hidden') ||
        !chatInputContainer.classList.contains('hidden');

    const width = hasContent ? CONTENT_WIDTH : MIN_WIDTH;
    const height = calculateWindowHeight();

    window.electronAPI.setWindowSize(width, height);
}

async function typeText(text: string) {
    if (state.isTyping) return;
    state.isTyping = true;

    try {
        bubbleText.innerHTML = '';
        const cursor = document.createElement('span');
        cursor.className = 'typing-cursor';

        for (let i = 0; i < text.length; i++) {
            if (speechBubble.classList.contains('hidden')) break;

            bubbleText.textContent = text.substring(0, i + 1);
            bubbleText.appendChild(cursor);

            if (i % 10 === 0) updateWindowSize();

            await new Promise(r => setTimeout(r, 30 + Math.random() * 20));
        }

        updateWindowSize();
        setTimeout(() => cursor.remove(), 1000);

    } catch (e) {
        console.error('Typing error:', e);
        bubbleText.textContent = text;
    } finally {
        state.isTyping = false;
    }
}

// ===== Chat Input Logic =====

export function showChatInput() {
    chatInputContainer.classList.remove('hidden');
    chatInput.focus();
    updateWindowSize();
    clearIdleTimeout();
    idleTimeout = setTimeout(() => {
        returnToIdle("Taking a quick nap... poke me anytime! 😴");
    }, IDLE_TIMEOUT_MS);
}

export function hideChatInput() {
    chatInputContainer.classList.add('hidden');
    chatInput.value = '';
    clearIdleTimeout();
    updateWindowSize();
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

    chatInput.value = '';
    chatInput.disabled = true;
    clearIdleTimeout();

    // Lock window during AI response generation
    lockWindow();

    setState(CharacterState.LISTENING);
    showSpeechBubble('Hmm, let me think... 🤔', false);

    try {
        const result = await window.electronAPI.sendMessage(message, state.config);

        if (result.error) {
            setState(CharacterState.TALKING);
            showSpeechBubble(`Oops! ${result.error} 😅`);
        } else {
            setState(CharacterState.TALKING);
            await showSpeechBubble(result.response);
        }

        // Unlock window after response is fully displayed
        unlockWindow();

        chatInput.disabled = false;
        chatInput.focus();
        setState(CharacterState.LISTENING);

        idleTimeout = setTimeout(() => {
            returnToIdle("I'll just take a nap then! 😴");
        }, IDLE_TIMEOUT_MS);

    } catch (error) {
        console.error('Error sending message:', error);
        setState(CharacterState.TALKING);
        showSpeechBubble("Something went wrong! 😵");

        // Unlock window on error too
        unlockWindow();

        setTimeout(() => {
            chatInput.disabled = false;
            chatInput.focus();
            setState(CharacterState.LISTENING);
        }, 2000);
    }
}
