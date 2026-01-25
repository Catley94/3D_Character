import { Tray, Menu, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { windowManager } from './window-manager';

export class TrayManager {
    private tray: Tray | null = null;

    public createTray() {
        try {
            // Robust path resolution for dev vs prod
            const assetPath = app.isPackaged
                ? path.join(process.resourcesPath, 'app.asar', 'assets')
                : path.join(app.getAppPath(), 'assets');

            const trayIcon = path.join(assetPath, 'tray-icon.png');

            if (fs.existsSync(trayIcon)) {
                this.tray = new Tray(trayIcon);
            } else {
                console.warn('Tray icon not found at:', trayIcon);
                return;
            }

            const contextMenu = Menu.buildFromTemplate([
                {
                    label: 'Show Character',
                    click: () => windowManager.show()
                },
                {
                    label: 'Settings',
                    click: () => windowManager.openSettings()
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    click: () => app.quit()
                }
            ]);

            this.tray.setToolTip('AI Character Assistant');
            this.tray.setContextMenu(contextMenu);

        } catch (e) {
            console.error('Tray icon creation failed', e);
        }
    }
}

export const trayManager = new TrayManager();
