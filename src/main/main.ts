import { app } from 'electron';
import { windowManager } from './managers/window-manager';
import { trayManager } from './managers/tray-manager';
import { registerIpcHandlers } from './ipc-handlers';

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

  // D. Activation (macOS/Dock)
  app.on('activate', () => {
    windowManager.createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
