export interface ElectronAPI {
    dragWindow: (deltaX: number, deltaY: number) => void;
    getWindowBounds: () => Promise<{ x: number, y: number, width: number, height: number }>;
    setWindowPosition: (x: number, y: number, width: number, height: number) => void;
    setWindowSize: (width: number, height: number) => void;
    setWindowLocked: (locked: boolean) => void;
    setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => void;
    // setWindowShape: (rects: { x: number, y: number, width: number, height: number }[]) => void; // REMOVED
    getCursorScreenPoint: () => Promise<{ x: number, y: number }>;
    sendMessage: (message: string, config: any) => Promise<any>;
    saveConfig: (config: any) => Promise<{ success: boolean }>;
    loadConfig: () => Promise<any>;
    onOpenSettings: (callback: () => void) => void;
    onCursorBoundsChanged: (callback: (data: { inBounds: boolean }) => void) => void;
    onCursorPosition: (callback: (data: { x: number, y: number }) => void) => void;
    setDragging: (isDragging: boolean) => void;
    onActivateChat: (callback: () => void) => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
