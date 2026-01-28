import { state, CharacterState, CharacterStateValue } from './store';
import { showSpeechBubble, showChatInput } from './chat';
import { getCurrentWindow } from '@tauri-apps/api/window';

// DOM Elements
const character = document.getElementById('character') as HTMLDivElement;
const characterContainer = document.getElementById('character-container') as HTMLDivElement;
const characterImg = document.getElementById('character-img') as HTMLImageElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;

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

export function initCharacter() {
    character.addEventListener('mousedown', onCharacterMouseDown);
    character.addEventListener('click', onCharacterClick);

    updateCharacterTheme(state.config.theme || 'fox');

    // Initialize position logic (handled by OS/Tauri mostly)
}

function onCharacterMouseDown() {
    getCurrentWindow().innerPosition().then(pos => {
        startPos = pos;
    });
}

async function onCharacterClick(e: MouseEvent) {
    console.log('[Character] Clicked');

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
