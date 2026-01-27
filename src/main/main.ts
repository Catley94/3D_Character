import { app, globalShortcut } from 'electron';
import { windowManager } from './managers/window-manager';
import { trayManager } from './managers/tray-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { cursorMonitor } from './services/cursor-monitor';

/**
 * =============================================================================
 * Foxy - AI Character Assistant - Main Entry Point
 * =============================================================================
 * 
 * This is the main Electron process entry point. It:
 * - Creates the main window
 * - Sets up the tray icon
 * - Registers IPC handlers for renderer communication
 * - Starts the cursor monitor for click-through functionality
 * - Sets up global shortcuts (works on X11 and via helper on Wayland)
 */

// =============================================================================
// Session Type Detection
// =============================================================================

/**
 * Detect if we're running on Wayland or X11.
 * Used to decide whether to force X11 compatibility mode.
 */
function detectSessionType(): 'wayland' | 'x11' | 'unknown' {
  const sessionType = process.env.XDG_SESSION_TYPE?.toLowerCase();
  if (sessionType === 'wayland') return 'wayland';
  if (sessionType === 'x11') return 'x11';
  if (process.env.WAYLAND_DISPLAY) return 'wayland';
  if (process.platform === 'linux') return 'x11';
  return 'unknown';
}

const sessionType = detectSessionType();
console.log(`[Main] Detected session type: ${sessionType}`);

// =============================================================================
// Platform Workarounds
// =============================================================================

// On Wayland WITHOUT our Rust helper, fall back to X11 via XWayland
// But if we detect Wayland and the helper is available, run natively!
// For now, we'll try native Wayland first since we have the helper.
// Uncomment the next line to force X11 mode on Wayland:
// if (sessionType === 'wayland') {
//     app.commandLine.appendSwitch('ozone-platform-hint', 'x11');
// }

// =============================================================================
// Chat Activation Handler
// =============================================================================

/**
 * Activate the chat interface.
 * Called from global shortcut (X11) or from Rust helper (Wayland).
 */
function activateChat() {
  const win = windowManager.getMainWindow();
  if (win) {
    // Force wake and bring to front
    win.show();
    win.setAlwaysOnTop(true);
    win.setIgnoreMouseEvents(false); // Ensure clickable immediately
    win.focus();
    win.webContents.send('activate-chat');
    console.log('[Main] Activating Chat');
  }
}

// =============================================================================
// Application Lifecycle
// =============================================================================

// State for Drag Mode
let isDragMode = false;

app.whenReady().then(() => {
  console.log('[Main] App ready, initializing...');

  // A. Create Main Window
  windowManager.createMainWindow();

  // B. Create Tray Icon (delayed slightly to ensure resources are ready)
  setTimeout(() => trayManager.createTray(), 500);

  // C. Register IPC Handlers for renderer communication
  registerIpcHandlers();

  // D. Start Cursor Monitor (main-process based, not affected by browser throttling)
  // On Wayland, this also spawns the Rust helper for global input tracking
  cursorMonitor.start();

  // E. Set up shortcut callback from Rust helper (for Wayland global shortcuts)
  // The helper detects Meta+Shift+F globally, even when other apps are focused
  cursorMonitor.setShortcutCallback((name) => {
    if (name === 'toggle_chat') {
      activateChat();

      // ... (inside callback) ...
    } else if (name === 'toggle_drag') {
      const win = windowManager.getMainWindow();
      if (win) {
        // Toggle drag mode state
        isDragMode = !isDragMode;

        // Apply state: 
        // If Drag Mode is ON: IgnoreMouseEvents = FALSE (clickable/draggable)
        // If Drag Mode is OFF: IgnoreMouseEvents = TRUE (ghost)
        // CRITICAL: Tell cursorMonitor about this so it doesn't auto-reset it!
        cursorMonitor.setDragMode(isDragMode);

        win.setIgnoreMouseEvents(!isDragMode);

        if (isDragMode) {
          console.log('[Main] Drag Mode ENABLED - Window is clickable/moveable');
          win.setAlwaysOnTop(true);
          win.focus();
        } else {
          console.log('[Main] Drag Mode DISABLED - Window is ghost (click-through)');
          win.setAlwaysOnTop(true);
        }

        // Notify renderer to show "Drag Mode" UI
        win.webContents.send('toggle-drag-mode', isDragMode);
      }
    }
  });

  // F. Electron's Global Shortcut (works on X11, may not work on Wayland)
  // We register it anyway as a fallback - on Wayland the helper takes over
  try {
    const registered = globalShortcut.register('Meta+Shift+F', () => {
      activateChat();
    });
    if (registered) {
      console.log('[Main] Global shortcut Meta+Shift+F registered (Electron)');
    } else {
      console.warn('[Main] Global shortcut registration failed (Wayland?)');
    }
  } catch (err) {
    console.warn('[Main] Could not register global shortcut:', err);
  }

  // G. Activation (macOS/Dock)
  app.on('activate', () => {
    windowManager.createMainWindow();
  });
});

// =============================================================================
// Cleanup
// =============================================================================

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cursorMonitor.stop();
    globalShortcut.unregisterAll();
    app.quit();
  }
});

app.on('will-quit', () => {
  // Clean up global shortcuts
  globalShortcut.unregisterAll();
  cursorMonitor.stop();
});
