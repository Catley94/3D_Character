const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Window controls
    dragWindow: (deltaX, deltaY) => ipcRenderer.send('window-drag', { deltaX, deltaY }),
    getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
    setWindowPosition: (x, y) => ipcRenderer.send('set-window-position', { x, y }),

    // Click-through control
    setIgnoreMouseEvents: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

    // AI communication
    sendMessage: (message, config) => ipcRenderer.invoke('send-message', { message, config }),

    // Settings
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    loadConfig: () => ipcRenderer.invoke('load-config'),

    // Listen for main process events
    onOpenSettings: (callback) => ipcRenderer.on('open-settings', callback)
});
