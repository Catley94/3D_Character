import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    dragWindow: (deltaX: number, deltaY: number) => ipcRenderer.send('window-drag', { deltaX, deltaY }),
    getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
    setWindowPosition: (x: number, y: number, width: number, height: number) => ipcRenderer.send('set-window-position', { x, y, width, height }),
    setWindowSize: (width: number, height: number) => ipcRenderer.send('set-window-size', { width, height }),
    setWindowLocked: (locked: boolean) => ipcRenderer.send('set-window-locked', locked),

    // Click-through control
    setIgnoreMouseEvents: (ignore: boolean, options?: any) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
    getCursorScreenPoint: () => ipcRenderer.invoke('get-cursor-screen-point'),

    // AI communication
    sendMessage: (message: string, config: any) => ipcRenderer.invoke('send-message', { message, config }),

    // Settings
    saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
    loadConfig: () => ipcRenderer.invoke('load-config'),

    // Listen for main process events
    onOpenSettings: (callback: () => void) => ipcRenderer.on('open-settings', callback)
});
