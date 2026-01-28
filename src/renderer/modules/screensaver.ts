import { getCurrentWindow, LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, currentMonitor } from '@tauri-apps/api/window';
import { showSpeechBubble } from './chat';

const appWindow = getCurrentWindow();
let isScreensaverActive = false;
let wanderInterval: NodeJS.Timeout | null = null;
let savedPosition: LogicalPosition | PhysicalPosition | null = null;
let savedSize: LogicalSize | PhysicalSize | null = null;

const CHARACTER_SIZE = 150; // Approximation

export function initScreensaver() {
    // Keyboard Shortcut: Ctrl + Alt + `
    window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        if (e.ctrlKey && e.altKey && e.key === '`') {
            toggleScreensaver();
        }
    });
}

export async function toggleScreensaver() {
    if (isScreensaverActive) {
        stopScreensaver();
    } else {
        startScreensaver();
    }
}

async function startScreensaver() {
    if (isScreensaverActive) return;
    isScreensaverActive = true;
    console.log('[Screensaver] Starting...');

    try {
        // Save current state
        savedPosition = await appWindow.outerPosition();
        savedSize = await appWindow.outerSize();

        // Must be resizable to fullscreen
        await appWindow.setResizable(true);

        // Get Monitor Size for Robust Fullscreen
        const monitor = await currentMonitor();
        if (monitor) {
            const size = monitor.size;
            // Explicitly set size to monitor size to force "fullscreen" effect
            // even if setFullscreen is flaky on some WMs
            await appWindow.setSize(new PhysicalSize(size.width, size.height));

            // Also clamp position to 0,0 just in case
            await appWindow.setPosition(new PhysicalPosition(0, 0));
        }

        // Enter Fullscreen & Privacy Mode
        document.body.classList.add('screensaver-mode');
        await appWindow.setFullscreen(true);

        // Ensure we capture all mouse events by disabling click-through
        await appWindow.setIgnoreCursorEvents(false);

        // Start Wandering
        startWanderLoop();

        // Exit trigger (Click/Key/Mouse)
        // We add a longer delay (1s) to avoid immediate exit from button click or jitter
        setTimeout(() => {
            window.addEventListener('click', stopScreensaver, { once: true });
            window.addEventListener('keydown', handleExitKey);

            // Capture current mouse pos to compare against for threshold
            // We use the first mouse move event to set the reference
            window.addEventListener('mousemove', handleMouseMoveExit);
        }, 1000);

        showSpeechBubble("Wander Mode Active! 🌙", false);
        setTimeout(() => {
            const bubble = document.getElementById('speech-bubble');
            if (bubble) bubble.classList.add('hidden');
        }, 2000);

    } catch (e) {
        console.error("Failed to start screensaver:", e);
        isScreensaverActive = false;
    }
}

async function stopScreensaver() {
    if (!isScreensaverActive) return;
    isScreensaverActive = false;
    console.log('[Screensaver] Stopping...');

    // Clean up listeners
    window.removeEventListener('click', stopScreensaver);
    window.removeEventListener('keydown', handleExitKey);
    window.removeEventListener('mousemove', handleMouseMoveExit);
    lastMousePos = null; // Clear saved mouse position

    // Stop Wandering
    if (wanderInterval) {
        clearInterval(wanderInterval);
        wanderInterval = null;
    }

    // Restore UI
    document.body.classList.remove('screensaver-mode');

    // Reset Character Position (remove inline styles from wandering)
    const char = document.getElementById('character');
    if (char) {
        char.style.transform = '';
        char.style.top = '';
        char.style.left = '';
    }

    try {
        await appWindow.setFullscreen(false);
        await appWindow.setResizable(false); // Restore non-resizable state
        // Restore size/pos if we have them
        if (savedSize && savedPosition) {
            // We can pass Physical types back to setSize/setPosition often, or convert if needed.
            // But actually, setSize likely expects LogicalSize or PhysicalSize.
            // Let's coerce to any to avoid strict TS issues for now as likely the API supports both or we rely on duck typing.
            await appWindow.setSize(savedSize as any);
            await appWindow.setPosition(savedPosition as any);
        }
    } catch (e) {
        console.error("Failed to restore window:", e);
    }
}

function handleExitKey(e: KeyboardEvent) {
    // Ignore the toggle shortcut itself if it was pressed to start
    // But actually, toggle shortcut keys should logically toggle it OFF too.
    // So we can probably just call stopScreensaver() on ANY key.
    stopScreensaver();
}

let lastMousePos: { x: number; y: number } | null = null;
const MOUSE_MOVE_THRESHOLD = 50; // Pixels

function handleMouseMoveExit(e: MouseEvent) {
    // Check threshold (e.g. 50px) to prevent jitter exit
    // We can use e.screenX/Y or e.clientX/Y. 
    // Since we are in fullscreen, clientX/Y roughly equals screen.
    // We don't have the previous event easily without storing it, 
    // but we can check movement magnitude if we stored the start pos.

    // Actually simpler: just track if we moved significantly from start
    // But since we can't easily get global mouse pos synchronously in var,
    // let's just rely on the 1000ms delay being enough for the user to let go of the mouse.
    // AND check e.movementX/Y if available, or just rely on a counter?

    // Better: Just stopScreensaver. The 1s delay and threshold is key.
    // Let's implement strict threshold if possible, but for now increasing delay is safer.

    if (lastMousePos) {
        const currentX = e.screenX;
        const currentY = e.screenY;

        const deltaX = Math.abs(currentX - lastMousePos.x);
        const deltaY = Math.abs(currentY - lastMousePos.y);

        if (deltaX > MOUSE_MOVE_THRESHOLD || deltaY > MOUSE_MOVE_THRESHOLD) {
            stopScreensaver();
        }
    } else {
        // First event: set reference and ignore
        lastMousePos = { x: e.screenX, y: e.screenY };
    }
}

function startWanderLoop() {
    // Initial Move
    moveCharacterRandomly();

    // Move every 5-10 seconds
    wanderInterval = setInterval(moveCharacterRandomly, 8000);
}

function moveCharacterRandomly() {
    if (!isScreensaverActive) return;

    const char = document.getElementById('character');
    if (!char) return;

    const maxWidth = window.innerWidth - CHARACTER_SIZE;
    const maxHeight = window.innerHeight - CHARACTER_SIZE;

    const randomX = Math.max(0, Math.random() * maxWidth);
    const randomY = Math.max(0, Math.random() * maxHeight);

    // We use CSS transforms for smooth movement (defined in style.css)
    // Or we can use top/left. Let's use top/left with absolute positioning.
    char.style.left = `${randomX}px`;
    char.style.top = `${randomY}px`;

    // Random direction flip?
    // If moving right, scaleX(1), if left scaleX(-1) could be cool, but let's stick to simple first.
}
