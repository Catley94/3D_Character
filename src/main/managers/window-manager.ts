import { BrowserWindow, screen, app } from 'electron';
import path from 'path';

export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private readonly FIXED_WIDTH = 350;
    private readonly FIXED_HEIGHT = 450;
    private readonly DIST: string;
    private readonly VITE_DEV_SERVER_URL: string | undefined;

    constructor() {
        this.DIST = path.join(__dirname, '../../dist');
        this.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
    }

    public createMainWindow() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.show();
            return;
        }

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;

        this.mainWindow = new BrowserWindow({
            width: this.FIXED_WIDTH,
            height: this.FIXED_HEIGHT,
            x: width - 340,
            y: height - 300,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            hasShadow: false,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        if (this.VITE_DEV_SERVER_URL) {
            this.mainWindow.loadURL(this.VITE_DEV_SERVER_URL);
        } else {
            this.mainWindow.loadFile(path.join(this.DIST, 'index.html'));
        }

        this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

        this.setupEventListeners();
    }

    public getMainWindow(): BrowserWindow | null {
        return this.mainWindow;
    }

    public show() {
        this.mainWindow?.show();
    }

    public openSettings() {
        this.mainWindow?.webContents.send('open-settings');
    }

    private setupEventListeners() {
        if (!this.mainWindow) return;

        // Open devtools after everything is loaded (useful for debugging)
        this.mainWindow.webContents.on('did-finish-load', () => {
            console.log('[Main] Page finished loading');
        });

        // Redirect renderer console to main terminal
        this.mainWindow.webContents.on('console-message', (event, ...args: any[]) => {
            let message = '';
            if (args.length === 1 && typeof args[0] === 'object') {
                message = args[0].message;
            } else if (args.length > 1) {
                message = args[1];
            }
            console.log(`[Renderer] ${message}`);
        });
    }
}

export const windowManager = new WindowManager();
