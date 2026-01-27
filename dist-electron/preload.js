"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Window controls
  dragWindow: (deltaX, deltaY) => electron.ipcRenderer.send("window-drag", { deltaX, deltaY }),
  getWindowBounds: () => electron.ipcRenderer.invoke("get-window-bounds"),
  setWindowPosition: (x, y, width, height) => electron.ipcRenderer.send("set-window-position", { x, y, width, height }),
  setWindowSize: (width, height) => electron.ipcRenderer.send("set-window-size", { width, height }),
  setWindowLocked: (locked) => electron.ipcRenderer.send("set-window-locked", locked),
  setWindowFocusable: (focusable) => electron.ipcRenderer.send("set-window-focusable", focusable),
  // Click-through control
  setIgnoreMouseEvents: (ignore, options) => electron.ipcRenderer.send("set-ignore-mouse-events", ignore, options),
  setWindowShape: (rects) => electron.ipcRenderer.send("set-window-shape", rects),
  getCursorScreenPoint: () => electron.ipcRenderer.invoke("get-cursor-screen-point"),
  // AI communication
  sendMessage: (message, config) => electron.ipcRenderer.invoke("send-message", { message, config }),
  // Settings
  saveConfig: (config) => electron.ipcRenderer.invoke("save-config", config),
  loadConfig: () => electron.ipcRenderer.invoke("load-config"),
  // Listen for main process events
  onOpenSettings: (callback) => electron.ipcRenderer.on("open-settings", callback),
  onCursorBoundsChanged: (callback) => {
    electron.ipcRenderer.on("cursor-bounds-changed", (event, data) => callback(data.inBounds));
  },
  onCursorPosition: (callback) => {
    electron.ipcRenderer.on("cursor-position", (event, data) => callback(data));
  },
  // Drag State Sync
  setDragging: (isDragging) => electron.ipcRenderer.send("set-dragging", isDragging),
  // Linux click fix: report when cursor is over interactive elements
  setOverInteractive: (isInteractive) => electron.ipcRenderer.send("set-over-interactive", isInteractive),
  // Activation
  onActivateChat: (callback) => electron.ipcRenderer.on("activate-chat", callback),
  onToggleDragMode: (callback) => electron.ipcRenderer.on("toggle-drag-mode", (event, isDragMode) => callback(isDragMode))
});
