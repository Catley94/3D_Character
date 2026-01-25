import { state, CharacterState, CharacterStateValue } from './store';
import { showSpeechBubble, showChatInput } from './chat';

// DOM Elements
const character = document.getElementById('character') as HTMLDivElement;
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

// Drag State
let dragStartMouseX: number, dragStartMouseY: number;
let dragStartWinX: number, dragStartWinY: number;
let dragStartWidth: number, dragStartHeight: number;

export function initCharacter() {
    character.addEventListener('click', onCharacterClick);
    character.addEventListener('mousedown', startDrag);

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', () => { state.isDragging = false; });

    updateCharacterTheme(state.config.theme || 'fox');
}

export function setState(newState: CharacterStateValue) {
    state.currentState = newState;
    character.className = `state-${newState}`;

    // Update character image based on state and theme
    const theme = state.config.theme || 'fox';
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

export function updateCharacterTheme(theme: string) {
    const basePath = `assets/themes/${theme}`;
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

    console.log('[Character] Clicked');
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

async function startDrag(e: MouseEvent) {
    // Don't start drag if clicking on backpack
    if (e.target === backpack || backpack.contains(e.target as Node)) return;

    // Don't allow dragging when window is locked (during AI response)
    if (state.isWindowLocked) return;

    state.isDragging = true;
    state.hasDragged = false;
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

function onDragMove(e: MouseEvent) {
    if (!state.isDragging) return;

    // Calculate absolute target position based on initial position + mouse movement
    const targetX = dragStartWinX + (e.screenX - dragStartMouseX);
    const targetY = dragStartWinY + (e.screenY - dragStartMouseY);

    if (Math.abs(e.screenX - dragStartMouseX) > 3 || Math.abs(e.screenY - dragStartMouseY) > 3) {
        state.hasDragged = true;
    }

    // Force strict size maintenance during drag
    window.electronAPI.setWindowPosition(targetX, targetY, dragStartWidth, dragStartHeight);
}
