import { screen, BrowserWindow, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import { windowManager } from '../managers/window-manager';

/**
 * =============================================================================
 * Cursor Monitor Service
 * =============================================================================
 * 
 * Main-process cursor monitor that runs independently of renderer throttling.
 * This solves the issue where browser setTimeout/rAF get throttled when window loses focus.
 * 
 * WAYLAND FIX: On Wayland, Electron cannot get global cursor position due to
 * security restrictions. We spawn a Rust helper (foxy-input-helper) that reads
 * directly from /dev/input devices to track the cursor globally.
 * 
 * The helper also provides global keyboard shortcut detection, which works
 * even when other applications are focused.
 */

// =============================================================================
// Types for Rust Helper Events
// =============================================================================

/** Events received from the Rust helper via stdout */
interface HelperEvent {
    type: 'cursor' | 'shortcut' | 'click' | 'heartbeat' | 'ready' | 'error';
    x?: number;
    y?: number;
    name?: string;
    button?: string;
    message?: string;
    mice_count?: number;
    keyboards_count?: number;
    screen_width?: number;
    screen_height?: number;
}

// =============================================================================
// Session Type Detection
// =============================================================================

/**
 * Detect if we're running on Wayland or X11.
 * This determines whether we need the Rust helper for cursor tracking.
 */
function detectSessionType(): 'wayland' | 'x11' | 'unknown' {
    const sessionType = process.env.XDG_SESSION_TYPE?.toLowerCase();
    if (sessionType === 'wayland') return 'wayland';
    if (sessionType === 'x11') return 'x11';

    // Fallback: check for Wayland display
    if (process.env.WAYLAND_DISPLAY) return 'wayland';

    // Default to X11 on Linux
    if (process.platform === 'linux') return 'x11';

    return 'unknown';
}

// =============================================================================
// Cursor Monitor Class
// =============================================================================

export class CursorMonitor {
    private intervalId: NodeJS.Timeout | null = null;
    private lastCursorInBounds = false;
    private readonly POLL_INTERVAL = 50; // ms
    private syntheticEventsEnabled = true;
    private lastLog = 0;

    // Linux click fix: track interactive state from renderer
    private isOverInteractive = false;
    private lastForceReset = 0;
    private readonly FORCE_RESET_INTERVAL = 200; // ms

    // Wayland support: Rust helper process
    private helperProcess: ChildProcess | null = null;
    private helperCursorX = 0;
    private helperCursorY = 0;
    private isWayland = false;
    private helperReady = false;

    // Callback for shortcut events
    private onShortcut: ((name: string) => void) | null = null;

    constructor() {
        // Detect session type on construction
        const sessionType = detectSessionType();
        this.isWayland = sessionType === 'wayland';
        console.log(`[CursorMonitor] Session type: ${sessionType}`);
    }

    /**
     * Set a callback for when keyboard shortcuts are detected by the helper.
     * This works globally on Wayland, unlike Electron's globalShortcut.
     */
    setShortcutCallback(callback: (name: string) => void) {
        this.onShortcut = callback;
    }

    setSyntheticEventsEnabled(enabled: boolean) {
        this.syntheticEventsEnabled = enabled;
        console.log(`[CursorMonitor] Synthetic events ${enabled ? 'ENABLED' : 'DISABLED'}`);
    }

    // Called by renderer when cursor is over an interactive element
    setOverInteractive(isInteractive: boolean) {
        this.isOverInteractive = isInteractive;
    }

    /**
     * Start the cursor monitor.
     * On Wayland, this also spawns the Rust helper for input tracking.
     */
    start() {
        if (this.intervalId) return;

        console.log('[CursorMonitor] Starting main-process polling...');

        // On Wayland, spawn the Rust helper for global input tracking
        if (this.isWayland) {
            this.startHelper();
        }

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

        // Stop the Rust helper
        this.stopHelper();
    }

    // =========================================================================
    // Rust Helper Management
    // =========================================================================

    /**
     * Find the path to the Rust helper binary.
     * Checks multiple locations: dev build, packaged app, etc.
     */
    private findHelperPath(): string | null {
        const possiblePaths = [
            // Development: built in the project directory
            path.join(app.getAppPath(), 'foxy-input-helper', 'target', 'release', 'foxy-input-helper'),
            // Development: relative to dist-electron
            path.join(app.getAppPath(), '..', 'foxy-input-helper', 'target', 'release', 'foxy-input-helper'),
            // Packaged: in resources directory
            path.join(process.resourcesPath, 'foxy-input-helper'),
            // Packaged: alongside the app
            path.join(path.dirname(app.getPath('exe')), 'foxy-input-helper'),
        ];

        for (const p of possiblePaths) {
            console.log(`[CursorMonitor] Checking for helper at: ${p}`);
            if (fs.existsSync(p)) {
                console.log(`[CursorMonitor] Found helper at: ${p}`);
                return p;
            }
        }

        console.warn('[CursorMonitor] Rust helper not found in any expected location');
        return null;
    }

    /**
     * Start the Rust helper process.
     * The helper reads from /dev/input and streams JSON events to stdout.
     */
    private startHelper() {
        if (this.helperProcess) return;

        const helperPath = this.findHelperPath();
        if (!helperPath) {
            console.warn('[CursorMonitor] Cannot start helper: binary not found');
            console.warn('[CursorMonitor] Falling back to Electron cursor API (may not work on Wayland)');
            return;
        }

        console.log('[CursorMonitor] Starting Rust input helper...');

        try {
            // Spawn the helper process
            this.helperProcess = spawn(helperPath, [], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });

            // Handle stdout: parse JSON events line by line
            if (this.helperProcess.stdout) {
                const readline = require('readline');
                const rl = readline.createInterface({
                    input: this.helperProcess.stdout,
                    crlfDelay: Infinity,
                });

                rl.on('line', (line: string) => {
                    console.log(`[CursorMonitor] RAW: ${line}`);
                    this.handleHelperEvent(line);
                });
            }

            // Handle stderr: log helper debug messages
            if (this.helperProcess.stderr) {
                this.helperProcess.stderr.on('data', (data: Buffer) => {
                    console.log(`[Helper] ${data.toString().trim()}`);
                });
            }

            // Handle process exit
            this.helperProcess.on('exit', (code, signal) => {
                console.log(`[CursorMonitor] Helper exited: code=${code}, signal=${signal}`);
                this.helperProcess = null;
                this.helperReady = false;
            });

            this.helperProcess.on('error', (err) => {
                console.error('[CursorMonitor] Helper error:', err);
                this.helperProcess = null;
                this.helperReady = false;
            });

        } catch (err) {
            console.error('[CursorMonitor] Failed to start helper:', err);
        }
    }

    /**
     * Stop the Rust helper process.
     */
    private stopHelper() {
        if (this.helperProcess) {
            console.log('[CursorMonitor] Stopping Rust helper...');
            this.helperProcess.kill('SIGTERM');
            this.helperProcess = null;
            this.helperReady = false;
        }
    }

    /**
     * Handle a JSON event from the Rust helper.
     */
    private handleHelperEvent(line: string) {
        try {
            const event: HelperEvent = JSON.parse(line);

            switch (event.type) {
                case 'ready':
                    console.log(`[CursorMonitor] Helper ready: ${event.mice_count} mice, ${event.keyboards_count} keyboards`);
                    this.helperReady = true;
                    break;

                case 'cursor':
                    // Update our tracked cursor position
                    if (event.x !== undefined && event.y !== undefined) {
                        this.helperCursorX = event.x;
                        this.helperCursorY = event.y;
                    }
                    break;

                case 'shortcut':
                    // Fire shortcut callback
                    if (event.name && this.onShortcut) {
                        console.log(`[CursorMonitor] Shortcut detected: ${event.name}`);
                        this.onShortcut(event.name);
                    }
                    break;

                case 'click':
                    // Could handle global clicks here if needed
                    // For now, we let the window manager handle clicks
                    break;

                case 'heartbeat':
                    // Helper is alive - nothing to do
                    break;

                case 'error':
                    console.warn(`[CursorMonitor] Helper error: ${event.message}`);
                    break;
            }
        } catch (err) {
            // Ignore parse errors (might be partial lines)
        }
    }

    // =========================================================================
    // Cursor Position Tracking
    // =========================================================================

    /**
     * Get the current cursor position.
     * On Wayland with helper running, uses helper's tracked position.
     * Otherwise, falls back to Electron's screen API.
     */
    private getCursorPosition(): { x: number; y: number } {
        if (this.isWayland && this.helperReady) {
            // Use the position from Rust helper
            return { x: this.helperCursorX, y: this.helperCursorY };
        } else {
            // Use Electron's native API
            const cursor = screen.getCursorScreenPoint();
            return { x: cursor.x, y: cursor.y };
        }
    }

    private checkCursor() {
        const win = windowManager.getMainWindow();
        if (!win || win.isDestroyed()) return;

        // Get window bounds (Logical Pixels / DIPs)
        const bounds = win.getBounds();

        // Get cursor position (from helper on Wayland, or Electron on X11)
        const cursor = this.getCursorPosition();

        // Debug logging every ~2 seconds
        const now = Date.now();
        if (now - this.lastLog > 2000) {
            this.lastLog = now;
            const source = (this.isWayland && this.helperReady) ? 'Helper' : 'Electron';
            try {
                console.log(`[CursorMonitor] Heartbeat: Cursor(${cursor.x},${cursor.y}) Interactive:${this.isOverInteractive} Source:${source}`);
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
            if (this.isOverInteractive) {
                if (now - this.lastForceReset > this.FORCE_RESET_INTERVAL) {
                    this.lastForceReset = now;
                    // Force re-enable mouse events directly from main process
                    win.setIgnoreMouseEvents(false);
                }
            } else {
                // Not over interactive - enable click-through
                // Note: { forward: true } is NOT available on Linux
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
