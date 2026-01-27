import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    dragWindow: (deltaX: number, deltaY: number) => ipcRenderer.send('window-drag', { deltaX, deltaY }),
    getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
    setWindowPosition: (x: number, y: number, width: number, height: number) => ipcRenderer.send('set-window-position', { x, y, width, height }),
    setWindowSize: (width: number, height: number) => ipcRenderer.send('set-window-size', { width, height }),
    setWindowLocked: (locked: boolean) => ipcRenderer.send('set-window-locked', locked),
    setWindowFocusable: (focusable: boolean) => ipcRenderer.send('set-window-focusable', focusable),

    // Click-through control
    setIgnoreMouseEvents: (ignore: boolean, options?: any) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),
    setWindowShape: (rects: { x: number, y: number, width: number, height: number }[]) => ipcRenderer.send('set-window-shape', rects),
    getCursorScreenPoint: () => ipcRenderer.invoke('get-cursor-screen-point'),

    // AI communication
    sendMessage: (message: string, config: any) => ipcRenderer.invoke('send-message', { message, config }),

    // Settings
    saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
    loadConfig: () => ipcRenderer.invoke('load-config'),

    // Listen for main process events
    onOpenSettings: (callback: () => void) => ipcRenderer.on('open-settings', callback),
    onCursorBoundsChanged: (callback: (inBounds: boolean) => void) => {
        ipcRenderer.on('cursor-bounds-changed', (event, data) => callback(data.inBounds));
    },
    onCursorPosition: (callback: (data: { x: number, y: number }) => void) => {
        ipcRenderer.on('cursor-position', (event, data) => callback(data));
    },

    // Drag State Sync
    setDragging: (isDragging: boolean) => ipcRenderer.send('set-dragging', isDragging),

    // Linux click fix: report when cursor is over interactive elements
    setOverInteractive: (isInteractive: boolean) => ipcRenderer.send('set-over-interactive', isInteractive),

    // Activation
    onActivateChat: (callback: () => void) => ipcRenderer.on('activate-chat', callback),
    onToggleDragMode: (callback: (isDragMode: boolean) => void) => ipcRenderer.on('toggle-drag-mode', (event, isDragMode) => callback(isDragMode))
});
