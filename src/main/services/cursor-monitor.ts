import { screen, BrowserWindow } from 'electron';
import { windowManager } from '../managers/window-manager';

/**
 * Main-process cursor monitor that runs independently of renderer throttling.
 * This solves the issue where browser setTimeout/rAF get throttled when window loses focus.
 * 
 * LINUX FIX: Also handles forcing mouse events to be re-enabled, bypassing X11 quirks
 * where setIgnoreMouseEvents can get "stuck" when window is unfocused.
 */
export class CursorMonitor {
    private intervalId: NodeJS.Timeout | null = null;
    private lastCursorInBounds = false;
    private readonly POLL_INTERVAL = 50; // ms
    private syntheticEventsEnabled = true;
    private lastLog = 0;

    // Linux click fix: track interactive state from renderer
    private isOverInteractive = false;
    private lastForceReset = 0;
    private readonly FORCE_RESET_INTERVAL = 200; // ms - periodically force re-enable

    setSyntheticEventsEnabled(enabled: boolean) {
        this.syntheticEventsEnabled = enabled;
        console.log(`[CursorMonitor] Synthetic events ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    // Called by renderer when cursor is over an interactive element
    setOverInteractive(isInteractive: boolean) {
        this.isOverInteractive = isInteractive;
    }

    start() {
        if (this.intervalId) return;

        console.log('[CursorMonitor] Starting main-process polling (Full Screen Mode)...');

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

        // Get cursor position
        const rawCursor = screen.getCursorScreenPoint();

        const cursor = {
            x: rawCursor.x,
            y: rawCursor.y
        };

        // Debug logging every ~2 seconds
        const now = Date.now();
        if (now - this.lastLog > 2000) {
            this.lastLog = now;
            try {
                console.log(`[CursorMonitor] Heartbeat: Cursor(${cursor.x},${cursor.y}) Interactive:${this.isOverInteractive}`);
            } catch (e) {
                console.log('[CursorMonitor] Heartbeat error', e);
            }
        }

        try {
            // In full-screen mode, we're always "in bounds"
            // Calculate local coordinates
            const localX = cursor.x - bounds.x;
            const localY = cursor.y - bounds.y;

            // Always stream cursor position to renderer (full screen mode)
            win.webContents.send('cursor-position', { x: localX, y: localY });

            // LINUX CLICK FIX: Main process controls setIgnoreMouseEvents
            // Periodically force re-enable when over interactive elements
            // This combats X11 quirks where the state gets "stuck"
            if (this.isOverInteractive) {
                if (now - this.lastForceReset > this.FORCE_RESET_INTERVAL) {
                    this.lastForceReset = now;
                    // Force re-enable mouse events directly from main process
                    win.setIgnoreMouseEvents(false);
                }
            } else {
                // Not over interactive - enable click-through
                // Note: { forward: true } is NOT available on Linux, so we omit it
                win.setIgnoreMouseEvents(true);
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
            this.isOverInteractive = true;
        }
    }
}

export const cursorMonitor = new CursorMonitor();

