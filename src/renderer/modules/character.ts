import { unregister, register } from '@tauri-apps/plugin-global-shortcut';
import { state, defaultShortcuts, CharacterState, CharacterStateValue } from './store';
import { showSpeechBubble, showChatInput } from './chat';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// DOM Elements

// DOM Elements
const character = document.getElementById('character') as HTMLDivElement;
const characterContainer = document.getElementById('character-container') as HTMLDivElement;
const characterImg = document.getElementById('character-img') as HTMLImageElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;

let currentToggleShortcut = '';

// Constants
const clickReactions = [
    "Oh! I felt that! 😊 How're you doing?",
    "Hey there! *wiggles ears* What's up?",
    "Ooh, a poke! Got something on your mind?",
    "*blinks* Hello, friend! Need me?",
    "Ah! You found me! 🦊 What can I do for you?"
];

// Drag Tracking
let startPos = { x: 0, y: 0 };

export async function initCharacter() {
    character.addEventListener('mousedown', onCharacterMouseDown);
    character.addEventListener('click', onCharacterClick);

    updateCharacterTheme(state.config.theme || 'fox');

    // Initialize position logic (handled by OS/Tauri mostly)

    // Listen for Backend Mouse Events (Windows Fallback)
    let backendStartPos = { x: 0, y: 0 };

    // Track Mousedown
    listen('mousedown', async (event: any) => {
        const { button, x, y } = event.payload;
        if (button === 'left') {
            backendStartPos = { x, y };
        }
    });

    // Track Mouseup
    listen('mouseup', async (event: any) => {
        const { button, x, y } = event.payload;
        if (button !== 'left') return;

        // Calculate distance
        const dx = Math.abs(x - backendStartPos.x);
        const dy = Math.abs(y - backendStartPos.y);

        // Debug
        // console.log(`[Character] MouseUp at ${x},${y}. Moved: ${dx},${dy}`);

        if (dx > 5 || dy > 5) {
            console.log('[Character] Ignored click due to drag (Backend Event)');
            return;
        }

        // Check bounds
        try {
            const windowPos = await getCurrentWindow().outerPosition();
            const rect = character.getBoundingClientRect(); // Relative to viewport

            // Global Bounds of Character
            const left = windowPos.x + rect.left;
            const top = windowPos.y + rect.top;
            const right = left + rect.width;
            const bottom = top + rect.height;

            // Check intersection (with some padding/tolerance)
            if (x >= left && x <= right && y >= top && y <= bottom) {
                console.log('[Character] Hit detected via Backend Event!');
                // Directly trigger handler to bypass DOM-based drag checks which might fail
                // if mousedown didn't fire.
                handleCharacterClick();
            }
        } catch (e) {
            console.error('[Character] Click check failed:', e);
        }
    });

    // Initialize Bounds Tracking
    updateBounds();
    window.addEventListener('resize', () => {
        updateBounds();
    });

    // Periodically update bounds just in case of layout shifts?
    setInterval(updateBounds, 1000);
}

export async function updateBounds() {
    try {
        const rect = character.getBoundingClientRect();
        // Send integer bounds
        await invoke('update_character_bounds', {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height)
        });
        // console.log(`[Character] Updated Bounds: ${rect.x}, ${rect.y}, ${rect.width}x${rect.height}`);
    } catch (e) {
        console.warn(`[Character] Failed to update bounds:`, e);
    }
}

export async function updateVisibilityShortcut(newShortcut: string) {
    if (currentToggleShortcut === newShortcut) return;

    if (currentToggleShortcut) {
        try {
            await unregister(currentToggleShortcut);
            console.log(`[Character] Unregistered: ${currentToggleShortcut}`);
        } catch (e) {
            console.warn(`[Character] Failed to unregister: ${currentToggleShortcut}`, e);
        }
    }

    try {
        await register(newShortcut, (event) => {
            if (event.state === 'Pressed') {
                toggleVisibility();
            }
        });
        currentToggleShortcut = newShortcut;
        console.log(`[Character] Toggle shortcut registered: ${newShortcut}`);
    } catch (e) {
        console.error(`[Character] Failed to register toggle shortcut: ${newShortcut}`, e);
    }
}

let currentDragShortcut = '';

export async function updateDragShortcut(newShortcut: string) {
    if (currentDragShortcut === newShortcut) return;

    if (currentDragShortcut) {
        try {
            await unregister(currentDragShortcut);
            console.log(`[Character] Unregistered Drag: ${currentDragShortcut}`);
        } catch (e) {
            console.warn(`[Character] Failed to unregister drag: ${currentDragShortcut}`, e);
        }
    }

    try {
        await register(newShortcut, (event) => {
            if (event.state === 'Pressed') {
                toggleDragMode();
            }
        });
        currentDragShortcut = newShortcut;
        console.log(`[Character] Registered Drag: ${newShortcut}`);
    } catch (e) {
        console.error(`[Character] Failed to register drag shortcut: ${newShortcut}`, e);
    }
}

export function toggleDragMode() {
    const isDragMode = document.body.classList.toggle('drag-mode-active');
    console.log(`[Character] Drag Mode: ${isDragMode ? 'ON' : 'OFF'}`);
    return isDragMode;
}

export function toggleVisibility() {
    const isVisible = characterContainer.style.opacity !== '0';

    if (isVisible) {
        console.log('[Character] Manual Toggle: HIDDEN');
        characterContainer.style.opacity = '0';
        characterContainer.style.pointerEvents = 'none';
    } else {
        console.log('[Character] Manual Toggle: VISIBLE');
        characterContainer.style.opacity = '1';
        characterContainer.style.pointerEvents = 'auto';
    }
}

function onCharacterMouseDown(e: MouseEvent) {
    // Save position for click vs drag detection
    getCurrentWindow().innerPosition().then(pos => {
        startPos = pos;
    });

    // Universal Drag: Allow moving the window anytime
    getCurrentWindow().startDragging();
}

async function onCharacterClick(e: MouseEvent) {
    console.log('[Character] Clicked');

    // Ignore clicks if in screensaver mode (privacy/wander mode)
    if (document.body.classList.contains('screensaver-mode')) {
        return;
    }

    // Check if we moved (dragged)
    const currentPos = await getCurrentWindow().innerPosition();
    const dx = Math.abs(currentPos.x - startPos.x);
    const dy = Math.abs(currentPos.y - startPos.y);

    // If moved more than 5px, assume it was a drag, not a click
    if (dx > 5 || dy > 5) {
        console.log('[Character] Ignored click due to drag');
        return;
    }

    // Ignore clicks on backpack
    if (e.target === backpack || backpack.contains(e.target as Node)) return;

    // If already showing input or typing, don't react again
    if (!chatInputContainer.classList.contains('hidden') || state.isTyping) return;

    handleCharacterClick();
}

export function handleCharacterClick() {
    // Basic guard: don't double-trigger if already acting
    if (state.currentState !== CharacterState.IDLE) return;

    setState(CharacterState.CLICKED);

    // Show reaction
    showSpeechBubble(getRandomReaction());

    // After reaction, show chat input
    setTimeout(() => {
        showChatInput();
        setState(CharacterState.LISTENING);
    }, 1500);
}

export function setState(newState: CharacterStateValue) {
    state.currentState = newState;
    character.className = `state-${newState}`;

    // Update character image based on state and theme
    const theme = state.config.theme || 'fox';
    const basePath = `themes/${theme}`;

    const timestamp = new Date().getTime(); // Cache buster
    switch (newState) {
        case CharacterState.CLICKED:
            characterImg.src = `${basePath}/clicked.png?t=${timestamp}`;
            break;
        case CharacterState.LISTENING:
            characterImg.src = `${basePath}/listening.png?t=${timestamp}`;
            break;
        case CharacterState.TALKING:
            console.log(`¬ [Character] Updating image to TALKING: ${basePath}/talking.png`);
            characterImg.src = `${basePath}/talking.png?t=${timestamp}`;
            break;
        default:
            console.log("¬ State: " + newState);
            console.log(`¬ [Character] Updating image to IDLE: ${basePath}/idle.png`);
            characterImg.src = `${basePath}/idle.png`;
    }
}

export function updateCharacterTheme(theme: string) {
    const basePath = `themes/${theme}`;
    characterImg.src = `${basePath}/idle.png`;
}

function getRandomReaction() {
    return clickReactions[Math.floor(Math.random() * clickReactions.length)];
}
