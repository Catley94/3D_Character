import { screen, BrowserWindow } from 'electron';
import { windowManager } from '../managers/window-manager';

/**
 * Main-process cursor monitor that runs independently of renderer throttling.
 * This solves the issue where browser setTimeout/rAF get throttled when window loses focus.
 */
export class CursorMonitor {
    private intervalId: NodeJS.Timeout | null = null;
    private lastCursorInBounds = false;
    private readonly POLL_INTERVAL = 50; // ms
    private syntheticEventsEnabled = true;
    private lastLog = 0;

    setSyntheticEventsEnabled(enabled: boolean) {
        this.syntheticEventsEnabled = enabled;
        console.log(`[CursorMonitor] Synthetic events ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    start() {
        if (this.intervalId) return;

        console.log('[CursorMonitor] Starting main-process polling...');

        this.intervalId = setInterval(() => {
            this.checkCursor();
        }, this.POLL_INTERVAL);
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[CursorMonitor] Stopped polling');
        }
    }

    private checkCursor() {
        const win = windowManager.getMainWindow();
        if (!win || win.isDestroyed()) return;

        // Get window bounds (Logical Pixels / DIPs)
        const bounds = win.getBounds();

        // Get cursor position (Physical Pixels on Linux usually)
        const rawCursor = screen.getCursorScreenPoint();

        // Find which display the window is primarily on
        const display = screen.getDisplayMatching(bounds);
        const scaleFactor = display.scaleFactor;

        // Apply scaling correction: Physical -> Logical
        // CALIBRATION RESULT: User saw Raw(865) matching Window(859).
        // This means getCursorScreenPoint is ALREADY returning logical pixels matching getBounds.
        // Dividing by scaleFactor (1.125) caused an error (865 -> 769).
        // So we use rawCursor directly.
        const cursor = {
            x: rawCursor.x,
            y: rawCursor.y
        };

        // Debug logging every ~100 calls (5 seconds) to avoid spam but confirm life
        const now = Date.now();
        if (now - this.lastLog > 2000) {
            this.lastLog = now;
            try {
                console.log(`[CursorMonitor] Heartbeat: Raw(${rawCursor.x},${rawCursor.y}) Scale(${scaleFactor}) Logical(${cursor.x},${cursor.y}) Win(${bounds.x},${bounds.y}) Focused:${win.isFocused()}`);
            } catch (e) {
                console.log('[CursorMonitor] Heartbeat error', e);
            }
        }

        try {
            // Simple bounds check - is cursor within the window?
            const inBounds =
                cursor.x >= bounds.x &&
                cursor.x <= bounds.x + bounds.width &&
                cursor.y >= bounds.y &&
                cursor.y <= bounds.y + bounds.height;

            // 1. Send cursor-bounds-changed event (for renderer logic)
            if (inBounds !== this.lastCursorInBounds) {
                this.lastCursorInBounds = inBounds;

                console.log(`[CursorMonitor] Cursor ${inBounds ? 'ENTERED' : 'LEFT'} window bounds`);

                // Notify renderer of cursor bounds change
                win.webContents.send('cursor-bounds-changed', { inBounds });

                // Basic interactive state control - DISABLED for Fullscreen Overlay Mode
                // Renderer now handles this based on element intersection
                /*
                if (inBounds) {
                    win.setIgnoreMouseEvents(false);
                } else {
                    win.setIgnoreMouseEvents(true, { forward: true });
                }
                */
            }

            // 2. Stream Coordinates for Manual Hover (Fallback Plan)
            // Send LOCAL logical coordinates
            if (inBounds) {
                const localX = cursor.x - bounds.x;
                const localY = cursor.y - bounds.y;

                win.webContents.send('cursor-position', { x: localX, y: localY });
            }
        } catch (err) {
            console.error('[CursorMonitor] Error:', err);
        }
    }

    // Force a reset (useful for recovery)
    forceInteractive() {
        const win = windowManager.getMainWindow();
        if (win && !win.isDestroyed()) {
            console.log('[CursorMonitor] Forcing interactive mode');
            win.setIgnoreMouseEvents(false);
            this.lastCursorInBounds = true;
        }
    }
}

export const cursorMonitor = new CursorMonitor();
