import { state, CharacterState, defaultShortcuts } from './store';
import { setState } from './character';
import { geminiService } from '../services/gemini';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { unregister, register } from '@tauri-apps/plugin-global-shortcut';


// DOM Elements
const speechBubble = document.getElementById('speech-bubble') as HTMLDivElement;
const bubbleText = document.getElementById('bubble-text') as HTMLParagraphElement;
const bubbleDismiss = document.getElementById('bubble-dismiss') as HTMLButtonElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;
const chatInput = document.getElementById('chat-input') as HTMLInputElement;
const sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

// Constants - Dynamic sizing
const CHARACTER_HEIGHT = 180;
const INPUT_HEIGHT = 60;
const EXTRA_PADDING = 30;
const MIN_WIDTH = 200;
const CONTENT_WIDTH = 320;

// Timeout constants
const TYPING_TIMEOUT_MS = 15000;
const RESPONSE_TIMEOUT_MS = 60000;

let idleTimeout: NodeJS.Timeout | null = null;
let bubbleTimeout: NodeJS.Timeout | null = null;

const appWindow = getCurrentWindow();

export function initChat() {
    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Prevent global shortcuts from typing characters
    chatInput.addEventListener('keydown', (e) => {
        if ((e.key.toLowerCase() === 'd') && e.shiftKey && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            console.log('[Chat] Prevented Drag Mode shortcut input');
        }
    });

    // Dismiss button handler
    bubbleDismiss.addEventListener('click', () => {
        dismissBubble();
    });

    // Ensure window is focusable when user clicks/focuses the input
    chatInput.addEventListener('click', () => {
        appWindow.setFocus();
        appWindow.setIgnoreCursorEvents(false);
        setTimeout(() => chatInput.focus(), 50);
    });

    chatInput.addEventListener('focus', () => {
        console.log('[Chat] Input received focus event');
    });

    chatInput.addEventListener('input', () => {
        if (idleTimeout) {
            clearIdleTimeout();
            idleTimeout = setTimeout(() => {
                returnToIdle("Still there? I'm going to nap! 😴");
            }, TYPING_TIMEOUT_MS);
        }
    });
}

// ===== Shortcuts Logic =====

let currentChatShortcut = '';

export async function updateChatShortcut(newShortcut: string) {
    if (currentChatShortcut === newShortcut) return;

    if (currentChatShortcut) {
        try {
            await unregister(currentChatShortcut);
            console.log(`[Chat] Unregistered: ${currentChatShortcut}`);
        } catch (e) {
            console.warn(`[Chat] Failed to unregister: ${currentChatShortcut}`, e);
        }
    }

    try {
        await register(newShortcut, (event) => {
            if (event.state === 'Pressed') {
                activateChat();
            }
        });
        currentChatShortcut = newShortcut;
        console.log(`[Chat] Registered: ${newShortcut}`);
    } catch (e) {
        console.error(`[Chat] Failed to register: ${newShortcut}`, e);
    }
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
    // Window movement logic handle in renderer now (interactions.ts)
    // Just need to ensure we don't process drags
    document.body.classList.add('window-locked');
}

function unlockWindow() {
    state.isWindowLocked = false;
    document.body.classList.remove('window-locked');
}

function calculateWindowHeight(): number {
    let height = CHARACTER_HEIGHT;

    if (!speechBubble.classList.contains('hidden')) {
        height += speechBubble.offsetHeight + 10;
    }

    if (!chatInputContainer.classList.contains('hidden')) {
        height += INPUT_HEIGHT;
    }

    return height + EXTRA_PADDING;
}

// Helper to get current window info
import { LogicalPosition } from '@tauri-apps/api/window';

import { isSettingsOpen } from './settings';

export async function updateWindowSize() {
    // PREVENT RESIZE IN SCREENSAVER MODE
    if (document.body.classList.contains('screensaver-mode')) {
        console.log('[Resize] Blocked due to Screensaver Mode');
        return;
    }

    // PREVENT RESIZE IF SETTINGS OPEN
    if (isSettingsOpen()) {
        console.log('[Resize] Blocked due to Settings Panel');
        return;
    }

    const hasContent = !speechBubble.classList.contains('hidden') ||
        !chatInputContainer.classList.contains('hidden');

    // Base size for just the character
    const baseWidth = 250;
    const baseHeight = 250;

    // Expanded size for chat/bubble
    const expandedWidth = CONTENT_WIDTH; // 320
    const expandedHeight = calculateWindowHeight(); // Dynamic based on content

    const targetWidth = hasContent ? expandedWidth : baseWidth;
    const targetHeight = hasContent ? expandedHeight : baseHeight;

    // ANCHOR LOGIC: Grow Downwards (Standard)
    // We align content to Top-Left. Window expands down.
    // Fox stays at Top-Left (or Top-Center) of the window.
    // Bubble appears below Fox.

    try {
        const currentSize = await appWindow.outerSize();

        console.log(`[Resize] Target Size: ${targetWidth}x${targetHeight}`);

        // Only resize, don't move. Top-Left stays fixed.
        if (currentSize.width !== targetWidth || currentSize.height !== targetHeight) {
            await appWindow.setSize(new LogicalSize(targetWidth, targetHeight));
        }

    } catch (e) {
        console.error("Failed to resize window:", e);
    }
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

export function activateChat() {
    setState(CharacterState.LISTENING);
    showSpeechBubble("Hi there! What's up?");
    showChatInput();
}

export function showChatInput() {
    chatInputContainer.classList.remove('hidden');
    appWindow.setFocus();
    appWindow.setIgnoreCursorEvents(false);
    setTimeout(() => {
        chatInput.focus();
        console.log('[Chat] Input focused after focusable delay');
    }, 100);
    updateWindowSize();
    clearIdleTimeout();
    idleTimeout = setTimeout(() => {
        returnToIdle("Taking a quick nap... poke me anytime! 😴");
    }, TYPING_TIMEOUT_MS);
}

export function hideChatInput() {
    chatInputContainer.classList.add('hidden');
    chatInput.value = '';
    clearIdleTimeout();
    // In overlay mode, we don't "disable focus" explicitly, 
    // interactions.ts handles the ignoreCursorEvents based on hover.
    updateWindowSize();
}

function clearIdleTimeout() {
    if (idleTimeout) {
        clearTimeout(idleTimeout);
        idleTimeout = null;
    }
}

function clearBubbleTimeout() {
    if (bubbleTimeout) {
        clearTimeout(bubbleTimeout);
        bubbleTimeout = null;
    }
}

function dismissBubble() {
    // If we dismiss manually, we should probably reset everything to idle
    // so the character isn't stuck in "Listening" or "Talking"
    returnToIdle(null);
}

function returnToIdle(message: string | null) {
    hideChatInput();
    hideSpeechBubble();
    clearBubbleTimeout();
    if (message) {
        showSpeechBubble(message);
        bubbleTimeout = setTimeout(hideSpeechBubble, 3000);
    }
    setState(CharacterState.IDLE);
}

function goIdleKeepBubble() {
    setState(CharacterState.IDLE);
    clearBubbleTimeout();
    bubbleTimeout = setTimeout(() => {
        hideSpeechBubble();
        hideChatInput();
    }, RESPONSE_TIMEOUT_MS);
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    chatInput.value = '';
    chatInput.disabled = true;
    clearIdleTimeout();

    lockWindow();

    setState(CharacterState.LISTENING);
    showSpeechBubble('Hmm, let me think... 🤔', false);

    try {
        const result = await geminiService.generateResponse(message, state.config);

        if (result.error) {
            setState(CharacterState.TALKING);
            showSpeechBubble(`Oops! ${result.error} 😅`);
        } else {
            setState(CharacterState.TALKING);
            await showSpeechBubble(result.response || '');
        }

        unlockWindow();

        chatInput.disabled = false;
        chatInput.focus();

        goIdleKeepBubble();

    } catch (error) {
        console.error('Error sending message:', error);
        setState(CharacterState.TALKING);
        showSpeechBubble("Something went wrong! 😵");

        unlockWindow();

        setTimeout(() => {
            chatInput.disabled = false;
            chatInput.focus();
            setState(CharacterState.LISTENING);
        }, 2000);
    }
}
