import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron';
import { geminiService } from './services/gemini';
import { configService } from './services/config-store';
import { windowManager } from './managers/window-manager';

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

    ipcMain.on('set-window-size', (event, { width, height }) => {
        const win = windowManager.getMainWindow();
        if (win) {
            win.setSize(width || 350, height || 450);
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
}
