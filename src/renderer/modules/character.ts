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
    characterContainer.addEventListener('pointerdown', startDrag);
    characterContainer.addEventListener('pointermove', onDragMove);
    characterContainer.addEventListener('pointerup', (e) => {
        if (state.isDragging) {
            state.isDragging = false;
            window.electronAPI.setDragging(false);
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
            window.electronAPI.setDragging(false);
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

// Track if we're using custom position (dragged) vs CSS default
let isCustomPosition = false;

function startDrag(e: PointerEvent) {
    // Don't start drag if clicking on backpack
    if (e.target === backpack || backpack.contains(e.target as Node)) return;

    // Don't allow dragging when window is locked
    if (state.isWindowLocked) return;

    state.isDragging = true;
    state.hasDragged = false;
    dragStartMouseX = e.clientX;
    dragStartMouseY = e.clientY;

    // Get current position
    const rect = characterContainer.getBoundingClientRect();
    dragStartLeft = rect.left;
    dragStartTop = rect.top;

    // Capture pointer to ensure we receive events
    characterContainer.setPointerCapture(e.pointerId);

    // Tell main process dragging started
    window.electronAPI.setDragging(true);
    document.body.classList.add('is-dragging'); // Visual override

    // Ensure we are interactive
    window.electronAPI.setIgnoreMouseEvents(false);
}

function onDragMove(e: PointerEvent) {
    if (!state.isDragging) return;

    const deltaX = e.clientX - dragStartMouseX;
    const deltaY = e.clientY - dragStartMouseY;

    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        state.hasDragged = true;
    }

    // Calculate new position
    let newLeft = dragStartLeft + deltaX;
    let newTop = dragStartTop + deltaY;

    // Get container size for boundary constraints
    const containerRect = characterContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Boundary constraints - keep within viewport
    const maxLeft = window.innerWidth - containerWidth;
    const maxTop = window.innerHeight - containerHeight;

    newLeft = Math.max(0, Math.min(newLeft, maxLeft));
    newTop = Math.max(0, Math.min(newTop, maxTop));

    // Switch to absolute positioning from default (right/bottom)
    if (!isCustomPosition) {
        isCustomPosition = true;
        characterContainer.style.right = 'auto';
        characterContainer.style.bottom = 'auto';
    }

    // Apply new position
    characterContainer.style.left = `${newLeft}px`;
    characterContainer.style.top = `${newTop}px`;
}

