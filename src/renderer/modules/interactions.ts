import { state, CharacterState } from './store';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow, PhysicalPosition, currentMonitor } from '@tauri-apps/api/window';
import { setState } from './character';
import { showSpeechBubble } from './chat';

// Wiggle Detection Params
const WIGGLE_HISTORY_SIZE = 20;
const WIGGLE_THRESHOLD = 8; // Number of direction changes to count as a wiggle
const WIGGLE_TIME_WINDOW = 1000; // ms
const EVASION_COOLDOWN = 5000; // ms
const PROXIMITY_THRESHOLD = 300; // px radius around character

let cursorHistory: { x: number, y: number, t: number }[] = [];
let lastEvasionTime = 0;

export function setupClickThrough() {
    console.log('[Interactions] Initializing Wiggle Detection...');

    listen('cursor-pos', async (event: any) => {
        const { x, y } = event.payload;

        // Track history
        const now = Date.now();
        cursorHistory.push({ x, y, t: now });

        // Prune old history
        cursorHistory = cursorHistory.filter(p => now - p.t < WIGGLE_TIME_WINDOW);
        if (cursorHistory.length > WIGGLE_HISTORY_SIZE) {
            cursorHistory.shift();
        }

        // Only check for wiggle if we have enough data
        if (cursorHistory.length > 10) {
            checkWiggleAndEvade(x, y, now);
        }
    });
}

async function checkWiggleAndEvade(currentX: number, currentY: number, now: number) {
    if (now - lastEvasionTime < EVASION_COOLDOWN) return;
    if (state.isWindowLocked) return; // Don't evade if locked (e.g. typing)
    if (document.body.classList.contains('screensaver-mode')) return; // Don't evade in screensaver
    if (document.body.classList.contains('drag-mode-active')) return; // Don't evade while user is trying to drag things

    // 1. Check Proximity
    const appWindow = getCurrentWindow();
    const windowPos = await appWindow.outerPosition();
    const windowSize = await appWindow.outerSize(); // Use center

    const centerX = windowPos.x + windowSize.width / 2;
    const centerY = windowPos.y + windowSize.height / 2;

    const dx = currentX - centerX;
    const dy = currentY - centerY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > PROXIMITY_THRESHOLD) return;

    // 2. Check Wiggle (Direction Changes)
    let directionChanges = 0;
    let lastDirX = 0;

    for (let i = 1; i < cursorHistory.length; i++) {
        const deltaX = cursorHistory[i].x - cursorHistory[i - 1].x;

        // Ignore tiny jitters
        if (Math.abs(deltaX) < 5) continue;

        const currentDirX = Math.sign(deltaX);
        if (lastDirX !== 0 && currentDirX !== lastDirX) {
            directionChanges++;
        }
        lastDirX = currentDirX;
    }

    if (directionChanges >= WIGGLE_THRESHOLD) {
        console.log(`[Interactions] Wiggle Detected! Intensity: ${directionChanges}`);
        performEvasion();
    }
}

async function performEvasion() {
    lastEvasionTime = Date.now();
    console.log('[Interactions] Evading!');

    // Reaction
    setState(CharacterState.CLICKED); // Use 'surprised' face
    showSpeechBubble("Wah! You scared me! 💨", false);

    const appWindow = getCurrentWindow();
    const monitor = await currentMonitor();

    if (!monitor) return;

    // Teleport Sequence
    // 1. Fade out
    document.body.style.transition = 'opacity 0.2s ease';
    document.body.style.opacity = '0';

    setTimeout(async () => {
        // 2. Move (while invisible)
        const screenWidth = monitor.size.width;
        const screenHeight = monitor.size.height;
        const padding = 100;

        const maxX = screenWidth - 300 - padding; // box width approx 300
        const maxY = screenHeight - 300 - padding;

        const newX = padding + Math.random() * (maxX - padding);
        const newY = padding + Math.random() * (maxY - padding);

        try {
            await appWindow.setPosition(new PhysicalPosition(Math.round(newX), Math.round(newY)));

            // 3. Fade in
            setTimeout(() => {
                document.body.style.opacity = '1';
                setState(CharacterState.IDLE);

                // Hide bubble after a bit
                setTimeout(() => {
                    const bubble = document.getElementById('speech-bubble');
                    if (bubble) bubble.classList.add('hidden');
                }, 2000);
            }, 300);
        } catch (e) {
            console.error("Failed to teleport:", e);
            document.body.style.opacity = '1';
        }
    }, 250);
}
