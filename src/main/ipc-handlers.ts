import { ipcMain, IpcMainInvokeEvent, BrowserWindow, screen } from 'electron';
import { geminiService } from './services/gemini';
import { configService } from './services/config-store';
import { windowManager } from './managers/window-manager';
import { cursorMonitor } from './services/cursor-monitor';

export function registerIpcHandlers() {

    // AI & Config
    ipcMain.handle('send-message', async (event: IpcMainInvokeEvent, { message, config }: { message: string, config: any }) => {
        return await geminiService.generateResponse(message, config);
    });

    ipcMain.handle('save-config', async (event: IpcMainInvokeEvent, config: any) => {
        return { success: configService.save(config) };
    });

    ipcMain.handle('load-config', async () => {
        return configService.load();
    });

    // Window Management
    ipcMain.handle('get-window-bounds', () => {
        const win = windowManager.getMainWindow();
        if (win) {
            return win.getBounds();
        }
        return { x: 0, y: 0, width: 350, height: 450 }; // Fallback defaults
    });

    ipcMain.handle('get-cursor-screen-point', () => {
        return screen.getCursorScreenPoint();
    });

    ipcMain.on('set-window-size', (event, { width, height }) => {
        const win = windowManager.getMainWindow();
        if (win) {
            win.setSize(width || 200, height || 200);
        }
    });

    ipcMain.on('set-window-locked', (event, locked: boolean) => {
        const win = windowManager.getMainWindow();
        if (win) {
            // When locked, we disable moving but keep window interactive
            win.setMovable(!locked);
        }
    });

    ipcMain.on('set-window-position', (event, { x, y, width, height }) => {
        const win = windowManager.getMainWindow();
        if (win) {
            const currentBounds = win.getBounds();
            const w = width || currentBounds.width;
            const h = height || currentBounds.height;

            win.setBounds({
                x: Math.round(x),
                y: Math.round(y),
                width: w,
                height: h
            });
        }
    });

    // Mouse Events (Click-through)
    ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        win?.setIgnoreMouseEvents(ignore, options);
    });

    ipcMain.on('set-dragging', (event, isDragging: boolean) => {
        // When dragging, we MUST disable synthetic events to prevent coordinate conflicts
        // that cause the window to jump.
        cursorMonitor.setSyntheticEventsEnabled(!isDragging);
    });

    ipcMain.on('window-drag', (event, payload) => {
        const { deltaX, deltaY } = payload || {};
        if (typeof deltaX !== 'number' || typeof deltaY !== 'number' || isNaN(deltaX) || isNaN(deltaY)) {
            return; // Ignore invalid Input
        }

        const win = windowManager.getMainWindow();
        if (win) {
            const bounds = win.getBounds();
            const newX = Math.round(bounds.x + deltaX);
            const newY = Math.round(bounds.y + deltaY);

            win.setBounds({
                x: newX,
                y: newY,
                width: bounds.width,
                height: bounds.height
            });
        }
    });

}
