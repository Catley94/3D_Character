import { BrowserWindow, screen, app } from 'electron';
import path from 'path';

export class WindowManager {
    private mainWindow: BrowserWindow | null = null;
    private readonly MIN_WIDTH = 200;
    private readonly MIN_HEIGHT = 200;
    private readonly VITE_DEV_SERVER_URL: string | undefined;

    constructor() {
        this.VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
    }

    private getDistPath(): string {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'app.asar', 'dist');
        }
        return path.join(__dirname, '../../dist');
    }

    private getPreloadPath(): string {
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'app.asar', 'dist-electron', 'preload.js');
        }
        return path.join(__dirname, 'preload.js');
    }

    public createMainWindow() {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.show();
            return;
        }

        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.workAreaSize;

        this.mainWindow = new BrowserWindow({
            width: this.MIN_WIDTH,
            height: this.MIN_HEIGHT,
            x: width - this.MIN_WIDTH - 20,
            y: height - this.MIN_HEIGHT - 20,
            frame: false,
            transparent: true,
            backgroundColor: '#00000000',
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: true,  // Allow dynamic resizing
            hasShadow: false,
            minWidth: this.MIN_WIDTH,
            minHeight: this.MIN_HEIGHT,
            webPreferences: {
                preload: this.getPreloadPath(),
                contextIsolation: true,
                nodeIntegration: false
            }
        });

        if (this.VITE_DEV_SERVER_URL) {
            this.mainWindow.loadURL(this.VITE_DEV_SERVER_URL);
        } else {
            this.mainWindow.loadFile(path.join(this.getDistPath(), 'index.html'));
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
