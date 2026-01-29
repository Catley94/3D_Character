export const CharacterState = {
    IDLE: 'idle',
    CLICKED: 'clicked',
    LISTENING: 'listening',
    TALKING: 'talking'
} as const;

export type CharacterStateValue = typeof CharacterState[keyof typeof CharacterState];

export interface AppState {
    currentState: CharacterStateValue;
    config: any;
    isTyping: boolean;
    hasDragged: boolean;
    isDragging: boolean;
    isWindowLocked: boolean;
}

export const defaultShortcuts = {
    toggleChat: 'Super+Shift+F',
    toggleDrag: 'Super+Shift+D',
    toggleVisibility: 'Super+Shift+H',
    screensaver: 'Super+Shift+S'
};

export const state: AppState = {
    currentState: CharacterState.IDLE,
    config: {
        shortcuts: defaultShortcuts
    },
    isTyping: false,
    hasDragged: false,
    isDragging: false,
    isWindowLocked: false
};

// Event emitter for state changes (simple version)
type Listener = (val: any) => void;
const listeners: Record<string, Listener[]> = {};

export function on(event: string, fn: Listener) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
}

export function emit(event: string, val: any) {
    if (listeners[event]) listeners[event].forEach(fn => fn(val));
}
