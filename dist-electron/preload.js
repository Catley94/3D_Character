"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  dragWindow: (deltaX, deltaY) => electron.ipcRenderer.send("window-drag", { deltaX, deltaY }),
  getWindowBounds: () => electron.ipcRenderer.invoke("get-window-bounds"),
  setWindowPosition: (x, y, width, height) => electron.ipcRenderer.send("set-window-position", { x, y, width, height }),
  setWindowSize: (width, height) => electron.ipcRenderer.send("set-window-size", { width, height }),
  // Click-through control
  setIgnoreMouseEvents: (ignore, options) => electron.ipcRenderer.send("set-ignore-mouse-events", ignore, options),
  // AI communication
  sendMessage: (message, config) => electron.ipcRenderer.invoke("send-message", { message, config }),
  // Settings
  saveConfig: (config) => electron.ipcRenderer.invoke("save-config", config),
  loadConfig: () => electron.ipcRenderer.invoke("load-config"),
  // Listen for main process events
  onOpenSettings: (callback) => electron.ipcRenderer.on("open-settings", callback)
});
