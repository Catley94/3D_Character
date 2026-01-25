export interface ElectronAPI {
    dragWindow: (deltaX: number, deltaY: number) => void;
    getWindowBounds: () => Promise<{ x: number, y: number, width: number, height: number }>;
    setWindowPosition: (x: number, y: number, width: number, height: number) => void;
    setWindowSize: (width: number, height: number) => void;
    setWindowLocked: (locked: boolean) => void;
    setIgnoreMouseEvents: (ignore: boolean, options?: any) => void;
    getCursorScreenPoint: () => Promise<{ x: number, y: number }>;
    sendMessage: (message: string, config: any) => Promise<any>;
    saveConfig: (config: any) => Promise<{ success: boolean }>;
    loadConfig: () => Promise<any>;
    onOpenSettings: (callback: () => void) => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
