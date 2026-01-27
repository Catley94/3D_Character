import { state, CharacterState, CharacterStateValue } from './store';
import { showSpeechBubble, showChatInput } from './chat';

// DOM Elements
const character = document.getElementById('character') as HTMLDivElement;
const characterContainer = document.getElementById('character-container') as HTMLDivElement;
const characterImg = document.getElementById('character-img') as HTMLImageElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;

// ... (constants are fine)



// Constants
const clickReactions = [
    "Oh! I felt that! 😊 How're you doing?",
    "Hey there! *wiggles ears* What's up?",
    "Ooh, a poke! Got something on your mind?",
    "*blinks* Hello, friend! Need me?",
    "Ah! You found me! 🦊 What can I do for you?"
];

// Drag State
let dragStartMouseX: number, dragStartMouseY: number;
// Store initial element position
let dragStartLeft: number, dragStartTop: number;

export function initCharacter() {
    character.addEventListener('click', onCharacterClick);

    updateCharacterTheme(state.config.theme || 'fox');

    // Dragging (Pointer Events + Capture)
    // Removed JS drag listeners to avoid conflict with data-tauri-drag-region
    characterContainer.addEventListener('pointerup', (e) => {
        if (state.isDragging) {
            state.isDragging = false;
            // window.electronAPI.setDragging(false);
            document.body.classList.remove('is-dragging'); // Clear visual override
            characterContainer.releasePointerCapture(e.pointerId);

            // MANUALLY TRIGGER CLICK if we didn't drag
            if (!state.hasDragged) {
                onCharacterClick(e as unknown as MouseEvent);
            }
        }
    });
    // lostpointercapture handles alt-tab or system interruptions
    characterContainer.addEventListener('lostpointercapture', () => {
        if (state.isDragging) {
            state.isDragging = false;
            // window.electronAPI.setDragging(false); // Removed for Tauri
            document.body.classList.remove('is-dragging'); // Clear visual override
        }
    });

    // Initialize position if saved (TODO: Load from config)
    // For now, respect CSS default (bottom-right)
}

export function setState(newState: CharacterStateValue) {
    state.currentState = newState;
    character.className = `state-${newState}`;

    // Update character image based on state and theme
    const theme = state.config.theme || 'fox';
    const basePath = `themes/${theme}`;

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

export function updateCharacterTheme(theme: string) {
    const basePath = `themes/${theme}`;
    characterImg.src = `${basePath}/idle.png`;
}

function getRandomReaction() {
    return clickReactions[Math.floor(Math.random() * clickReactions.length)];
}

function onCharacterClick(e: MouseEvent) {
    console.log('[Character] Clicked');
    // Ignore clicks on backpack
    if (e.target === backpack || backpack.contains(e.target as Node)) return;

    // If already showing input or typing, don't react again
    if (!chatInputContainer.classList.contains('hidden') || state.isTyping || state.hasDragged) return;

    handleCharacterClick();
}

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

// ===== Drag Logic =====

// We rely on data-tauri-drag-region in HTML for native window dragging.
// This is much smoother and handles the window movement automatically.

// End of file

