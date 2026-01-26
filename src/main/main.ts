import { app } from 'electron';
import { windowManager } from './managers/window-manager';
import { trayManager } from './managers/tray-manager';
import { registerIpcHandlers } from './ipc-handlers';
import { cursorMonitor } from './services/cursor-monitor';

// Solution for Linux Wayland mouse forwarding issues
app.commandLine.appendSwitch('ozone-platform-hint', 'x11');

// 1. Lifecycle Events
app.whenReady().then(() => {
  // A. Init Window
  windowManager.createMainWindow();

  // B. Init Tray (delayed slightly to ensure resources are ready)
  setTimeout(() => trayManager.createTray(), 500);

  // C. Register IPC Handlers
  registerIpcHandlers();

  // D. Start Cursor Monitor (main-process based, not affected by browser throttling)
  cursorMonitor.start();

  // E. Global Shortcut (Meta+Shift+F)
  const { globalShortcut } = require('electron');
  globalShortcut.register('Meta+Shift+F', () => {
    const win = windowManager.getMainWindow();
    if (win) {
      // Force wake
      win.show();
      win.setAlwaysOnTop(true);
      win.setIgnoreMouseEvents(false); // Ensure clickable immediately
      win.focus();
      win.webContents.send('activate-chat');
      console.log('[Main] Global Shortcut triggered: Activating Chat');
    }
  });

  // F. Activation (macOS/Dock)
  app.on('activate', () => {
    windowManager.createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cursorMonitor.stop();
    app.quit();
  }
});
