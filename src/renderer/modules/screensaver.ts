import { getCurrentWindow, LogicalPosition, LogicalSize, PhysicalPosition, PhysicalSize, currentMonitor } from '@tauri-apps/api/window';
import { register } from '@tauri-apps/plugin-global-shortcut';
import { showSpeechBubble, hideSpeechBubble, hideChatInput } from './chat';
import { setState } from './character';
import { CharacterState } from './store';

const appWindow = getCurrentWindow();
let isScreensaverActive = false;
let wanderInterval: NodeJS.Timeout | null = null;
let savedPosition: LogicalPosition | PhysicalPosition | null = null;
let savedSize: LogicalSize | PhysicalSize | null = null;

const CHARACTER_SIZE = 150; // Approximation
const INACTIVITY_LIMIT = 20000; // 20 seconds
let inactivityTimer: NodeJS.Timeout | null = null;

export async function initScreensaver() {
    // Global Shortcut: Ctrl + Alt + `
    console.log('[Screensaver] Attempting to register global shortcut: CommandOrControl+Alt+Backquote');
    try {
        await register('CommandOrControl+Alt+Backquote', (event) => {
            console.log('[Screensaver] Shortcut triggered:', event);
            if (event.state === 'Pressed') {
                toggleScreensaver();
            }
        });
        console.log('[Screensaver] Global shortcut registered successfully');
    } catch (error) {
        console.error('[Screensaver] Failed to register global shortcut:', error);
    }

    // Initialize Inactivity Timer
    setupInactivityListener();
    resetInactivityTimer();
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

    // Clear inactivity timer so we don't trigger again while active
    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
        inactivityTimer = null;
    }

    isScreensaverActive = true;
    console.log('[Screensaver] Starting...');

    try {
        // Save current state
        savedPosition = await appWindow.outerPosition();
        savedSize = await appWindow.outerSize();

        console.log(`[Screensaver] Saved Pos: ${savedPosition.x}, ${savedPosition.y}`);

        // Reset Character State (Stop talking/listening)
        setState(CharacterState.IDLE);
        hideSpeechBubble();
        hideChatInput();

        // 1. FADE OUT before resize
        document.body.style.opacity = '0';
        document.body.style.transition = 'opacity 0.2s ease';
        await new Promise(r => setTimeout(r, 200));

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

        // 2. POSITION CHARACTER AT START (No Transition)
        const char = document.getElementById('character');
        if (char && savedPosition) {
            // Temporarily disable transition
            char.style.transition = 'none';
            char.style.left = `${savedPosition.x}px`;
            char.style.top = `${savedPosition.y}px`;

            // Force reflow
            void char.offsetHeight;
        }

        // 3. FADE IN
        document.body.style.opacity = '1';

        // Wait for fade in, then enable smooth movement
        setTimeout(() => {
            if (char) {
                // Re-enable CSS transition (managed by class, so just clearing inline style works if class has it)
                // But we set 'none' inline, so we must clear it.
                char.style.transition = '';
            }

            // Start Wandering after a moment
            startWanderLoop();

            // Exit trigger setup
            setTimeout(() => {
                window.addEventListener('click', stopScreensaver, { once: true });
                window.addEventListener('keydown', handleExitKey);
                window.addEventListener('mousemove', handleMouseMoveExit);
            }, 1000); // 1s delay before exit allowed

        }, 300);

        showSpeechBubble("Wander Mode Active! 🌙", false);
        setTimeout(() => {
            const bubble = document.getElementById('speech-bubble');
            if (bubble) bubble.classList.add('hidden');
        }, 2000);

    } catch (e) {
        console.error("Failed to start screensaver:", e);
        isScreensaverActive = false;
        document.body.style.opacity = '1';
    }
}

async function stopScreensaver() {
    if (!isScreensaverActive) return;
    isScreensaverActive = false;
    console.log('[Screensaver] Stopping...');

    // FADE OUT to hide resize glitches
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.2s ease';

    // Wait for fade out
    await new Promise(r => setTimeout(r, 200));

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
        await appWindow.setIgnoreCursorEvents(false); // Enable events for windowed mode (standard behavior)

        // Restore size/pos if we have them
        if (savedSize && savedPosition) {
            console.log(`[Screensaver] Restoring Pos: ${savedPosition.x}, ${savedPosition.y}`);

            // Wait for OS window manager to process fullscreen exit (increased delay)
            await new Promise(r => setTimeout(r, 300));

            // First attempt
            await appWindow.setSize(savedSize as any);
            await appWindow.setPosition(savedPosition as any);

            // Second attempt (safety net for some WMs)
            setTimeout(async () => {
                if (!isScreensaverActive && savedPosition) {
                    await appWindow.setPosition(savedPosition as any);
                }
            }, 300);

        } else {
            // Fallback if no saved state
            console.warn("[Screensaver] No saved state found, resetting to default.");
            await appWindow.setSize(new LogicalSize(250, 250));
        }

        // FADE IN after everything is settled
        setTimeout(() => {
            document.body.style.opacity = '1';
            // Clean up inline styles after transition
            setTimeout(() => {
                document.body.style.transition = '';
                document.body.style.opacity = '';
            }, 300);
        }, 300); // Wait a bit more for window resize to finish painting

    } catch (e) {
        console.error("Failed to restore window:", e);
        // Ensure we are visible even if error
        document.body.style.opacity = '1';
    }

    // Restart inactivity timer
    resetInactivityTimer();
}

function handleExitKey(e: KeyboardEvent) {
    // Ignore the toggle shortcut itself if it was pressed to start
    stopScreensaver();
}

let lastMousePos: { x: number; y: number } | null = null;
const MOUSE_MOVE_THRESHOLD = 50; // Pixels

function handleMouseMoveExit(e: MouseEvent) {
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
    char.style.left = `${randomX}px`;
    char.style.top = `${randomY}px`;
}

function resetInactivityTimer() {
    if (isScreensaverActive) return; // Don't reset if already active (handled by start/stop)

    if (inactivityTimer) {
        clearTimeout(inactivityTimer);
    }

    inactivityTimer = setTimeout(() => {
        console.log('[Screensaver] Inactivity detected, starting screensaver...');
        startScreensaver();
    }, INACTIVITY_LIMIT);
}

function setupInactivityListener() {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => {
        window.addEventListener(event, resetInactivityTimer, { passive: true });
    });
}
