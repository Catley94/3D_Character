import { unregister, register } from '@tauri-apps/plugin-global-shortcut';
import { getRandomReaction } from '../data/reactions';
import { state, defaultShortcuts, CharacterState, CharacterStateValue } from './store';
import { showSpeechBubble, showChatInput, hideSpeechBubble, isSpeechBubbleVisible } from './chat';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

// DOM Elements
const character = document.getElementById('character') as HTMLDivElement;
const characterContainer = document.getElementById('character-container') as HTMLDivElement;
const characterImg = document.getElementById('character-img') as HTMLImageElement;
const backpack = document.getElementById('backpack') as HTMLDivElement;
const chatInputContainer = document.getElementById('chat-input-container') as HTMLDivElement;

let currentToggleShortcut = '';

// Constants
// clickReactions moved to data/reactions.ts

// Drag Tracking
let startPos = { x: 0, y: 0 };

// Wiggle Detection
let lastWiggleCheck = 0;
let wiggleHistory: number[] = [];
let lastMouseX = 0;
let speechBubbleTimeout: number | undefined; // Store timeout ID
const WIGGLE_THRESHOLD = 4; // Number of direction flips
const WIGGLE_TIMEOUT = 500; // ms to reset
const WIGGLE_MIN_SPEED = 5; // Minimum px movement to count as a "move"
import { LogicalPosition } from '@tauri-apps/api/window';



export async function initCharacter() {
    character.addEventListener('mousedown', onCharacterMouseDown);
    character.addEventListener('click', onCharacterClick);
    character.addEventListener('mousemove', onCharacterMouseMove);

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

let overrideInteraction = false;

export function setInteractionOverride(active: boolean) {
    overrideInteraction = active;
    updateBounds(); // Immediate update
}

export async function updateBounds() {
    try {
        if (overrideInteraction) {
            // Send large bounds to cover everything (or just window size)
            // Since backend checks global mouse vs global bounds:
            // We can send a large rect, or ideally, fetch current window size.
            // For simplicity, let's fetch current window size.
            const win = getCurrentWindow();
            const size = await win.outerSize();
            // We set bounds to be 0,0 relative to window, with full size.
            await invoke('update_character_bounds', {
                x: 0,
                y: 0,
                w: size.width,
                h: size.height
            });
            // console.log(`[Character] Override Interaction: Full Window`);
            return;
        }

        const rect = character.getBoundingClientRect();
        // Send integer bounds
        await invoke('update_character_bounds', {
            x: Math.round(rect.x + 20),
            y: Math.round(rect.y),
            w: Math.round(rect.width - 20),
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

export function setVisible(visible: boolean) {
    if (visible) {
        console.log('[Character] Visibility: SHOW');
        characterContainer.style.opacity = '1';
        characterContainer.style.pointerEvents = 'auto';
    } else {
        console.log('[Character] Visibility: HIDE');
        characterContainer.style.opacity = '0';
        characterContainer.style.pointerEvents = 'none';
    }
}

export function toggleVisibility() {
    const isVisible = characterContainer.style.opacity !== '0';
    setVisible(!isVisible);
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
    const reaction = getRandomReaction(state.config.theme || 'fox', state.config.personality || []);
    showSpeechBubble(reaction);

    // After reaction, show chat input
    setTimeout(() => {
        showChatInput();
        setState(CharacterState.LISTENING);
    }, 1500);
}

import { convertFileSrc } from '@tauri-apps/api/core';

// ...

export async function setState(newState: CharacterStateValue) {
    state.currentState = newState;
    character.className = `state-${newState}`;

    // Update character image based on state and theme
    const theme = state.config.theme || 'fox';
    const builtInThemes = ['fox', 'dragon', 'cat', 'wolf'];

    let basePath = '';

    if (builtInThemes.includes(theme)) {
        // Internal Asset
        basePath = `themes/${theme}`;
        const timestamp = new Date().getTime(); // Cache buster

        switch (newState) {
            case CharacterState.CLICKED:
                characterImg.src = `${basePath}/clicked.png?t=${timestamp}`;
                break;
            case CharacterState.LISTENING:
                characterImg.src = `${basePath}/listening.png?t=${timestamp}`;
                break;
            case CharacterState.TALKING:
                characterImg.src = `${basePath}/talking.png?t=${timestamp}`;
                break;
            case CharacterState.TRANSITION:
                characterImg.src = `${basePath}/transition.png?t=${timestamp}`;
                break;
            default:
                characterImg.src = `${basePath}/idle.png`;
        }
    } else {
        // External Asset
        try {
            const themesDir = await invoke<string>('get_themes_dir');
            // Construct absolute path then convert to asset URL
            // Linux: /home/user/.config/.../themes/mytheme/idle.png
            // Windows: C:\Users\...\themes\mytheme\idle.png

            // We need to handle path joining properly. 
            // Since we are in frontend, we can't use node's path module easily without polyfills/IPC.
            // A simple slash join works for asset URLs usually, but let's be safe.
            // Actually, convertFileSrc expects an absolute path.
            // We can ask backend to give us the full path to the specific image?
            // Or just manually join since we know themesDir comes from backend with OS separators.
            // Let's assume standard forward slashes for URL purposes or let backend helper handle it?
            // Simpler: use the slash, Tauri handles it.

            // Better approach: just use the theme name and ask backend for the full path?
            // "themes_dir" -> /path/to/themes
            // Image -> /path/to/themes/theme/idle.png

            // Note: On Windows, path separators are backslashes.
            // JS strings like `${dir}/${theme}` might mix slashes.
            // `convertFileSrc` handles this generally.

            // We need to know the separator or just try both?
            // Let's rely on a helper or just append with a slash, browsers/tauri usually normalize.
            // But to be robust, let's normalize the separator to / for the URL generation if needed,
            // or just trust Tauri's convertFileSrc takes whatever.

            const separator = navigator.userAgent.includes('Windows') ? '\\' : '/';
            const themePath = `${themesDir}${separator}${theme}`;

            let filename = 'idle.png';
            switch (newState) {
                case CharacterState.CLICKED: filename = 'clicked.png'; break;
                case CharacterState.LISTENING: filename = 'listening.png'; break;
                case CharacterState.TALKING: filename = 'talking.png'; break;
                case CharacterState.TRANSITION: filename = 'transition.png'; break;
            }

            const fullPath = `${themePath}${separator}${filename}`;
            const assetUrl = convertFileSrc(fullPath);

            // console.log(`[Character] Loading external: ${fullPath} -> ${assetUrl}`);
            characterImg.src = `${assetUrl}?t=${Date.now()}`;

        } catch (e) {
            console.error('[Character] Failed to load external theme image:', e);
            // Fallback to fox
            characterImg.src = `themes/fox/idle.png`;
        }
    }
}

export async function updateCharacterTheme(theme: string) {
    const builtInThemes = ['fox', 'dragon', 'cat', 'wolf'];
    if (builtInThemes.includes(theme)) {
        characterImg.src = `themes/${theme}/idle.png`;
    } else {
        try {
            const themesDir = await invoke<string>('get_themes_dir');
            const separator = navigator.userAgent.includes('Windows') ? '\\' : '/';
            const fullPath = `${themesDir}${separator}${theme}${separator}idle.png`;
            characterImg.src = convertFileSrc(fullPath);
        } catch (e) {
            console.error('[Character] Failed to load external theme:', e);
        }
    }
}

function onCharacterMouseMove(e: MouseEvent) {
    const now = Date.now();
    const dx = e.clientX - lastMouseX;
    lastMouseX = e.clientX;

    // Reset if too slow or stopped
    if (now - lastWiggleCheck > WIGGLE_TIMEOUT) {
        wiggleHistory = [];
    }
    lastWiggleCheck = now;

    if (Math.abs(dx) > WIGGLE_MIN_SPEED) {
        // Sign of movement: 1 for right, -1 for left
        const sign = Math.sign(dx);

        // If history is empty, add current sign
        if (wiggleHistory.length === 0) {
            wiggleHistory.push(sign);
        } else {
            const lastSign = wiggleHistory[wiggleHistory.length - 1];
            // If direction changed (flipped sign)
            if (lastSign !== sign) {
                wiggleHistory.push(sign);
            }
        }
    }

    // Check Trigger
    if (wiggleHistory.length >= WIGGLE_THRESHOLD) {
        console.log('[Character] Wiggle Detected! Shooo!');
        wiggleHistory = []; // Reset
        moveToRandomLocation();
    }
}

async function moveToRandomLocation() {
    // Basic Speech
    if (!isSpeechBubbleVisible()) {
        showSpeechBubble("Whoa! What's over here? 💨");
        setTimeout(hideSpeechBubble, 2000);
    } else {
        console.log('[Character] Wiggle move, but preserving existing speech bubble.');
    }

    try {
        // Get Screen Size
        const screenW = window.screen.availWidth;
        const screenH = window.screen.availHeight;

        // Pad from edges
        const padding = 50;
        const maxW = screenW - 300;
        const maxH = screenH - 350;

        // Target Random X/Y
        const targetX = Math.floor(Math.random() * (maxW - padding)) + padding;
        const targetY = Math.floor(Math.random() * (maxH - padding)) + padding;

        // Animation Param
        const startX = window.screenX;
        const startY = window.screenY;
        const duration = 800; // ms
        const startTime = Date.now();
        const win = getCurrentWindow();

        console.log(`[Character] Jumping to ${targetX}, ${targetY} from ${startX},${startY}`);

        function animate() {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing: EaseOutCubic (Fast start, slow end)
            // 1 - (1 - t)^3
            const ease = 1 - Math.pow(1 - progress, 3);

            const currentX = Math.round(startX + (targetX - startX) * ease);
            const currentY = Math.round(startY + (targetY - startY) * ease);

            win.setPosition(new LogicalPosition(currentX, currentY)).catch(console.error);

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                console.log('[Character] Move Complete');
            }
        }

        requestAnimationFrame(animate);

    } catch (e) {
        console.error("Failed to move window:", e);
    }
}

