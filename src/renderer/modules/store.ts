// =============================================================================
// Global State Management (store.ts)
// =============================================================================
//
// This module defines the application's global state and provides a simple
// event emitter for state changes.
//
// KEY COMPONENTS:
// - CharacterState: Enum of possible character animation states
// - AppState: The main state object shared across modules
// - defaultShortcuts: Default keyboard shortcut configuration
// - Event emitter: Simple pub/sub for state change notifications
//
// USAGE:
// ```typescript
// import { state, CharacterState, on, emit } from './store';
//
// // Read state
// console.log(state.currentState);
//
// // Modify state
// state.currentState = CharacterState.TALKING;
//
// // Listen for changes
// on('state-changed', (newState) => { ... });
// emit('state-changed', CharacterState.IDLE);
// ```
//
// =============================================================================

// =============================================================================
// Character State Enum
// =============================================================================
// Defines all possible visual/animation states for the character

export const CharacterState = {
    IDLE: 'idle',           // Character is doing nothing, waiting for interaction
    CLICKED: 'clicked',     // Character was just clicked, showing reaction
    LISTENING: 'listening', // Character is waiting for user input
    TALKING: 'talking'      // Character is speaking/typing a response
} as const;

export type CharacterStateValue = typeof CharacterState[keyof typeof CharacterState];

// =============================================================================
// Application State Interface
// =============================================================================
// The main state object that tracks the application's current status

export interface AppState {
    /** Current animation/interaction state of the character */
    currentState: CharacterStateValue;

    /** User configuration (API key, shortcut mappings, theme, etc.) */
    config: any;  // TODO: Define a proper Config interface

    /** Flag indicating if the character is currently typing a message */
    isTyping: boolean;

    /** Flag indicating if the user has dragged the window since mousedown */
    hasDragged: boolean;

    /** Flag indicating if a drag operation is currently in progress */
    isDragging: boolean;

    /** Flag indicating if window movement is locked (during AI response) */
    isWindowLocked: boolean;
}

// =============================================================================
// Default Configuration
// =============================================================================

/** Default keyboard shortcut mappings (can be customized by user) */
export const defaultShortcuts = {
    toggleChat: 'Super+Shift+F',        // Open/close chat panel
    toggleDrag: 'Super+Shift+D',        // Enable/disable drag mode
    toggleVisibility: 'Super+Shift+H',  // Show/hide character
    screensaver: 'Super+Shift+S'        // Activate screensaver mode
};

// =============================================================================
// Global State Instance
// =============================================================================
// This is the single source of truth for application state

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

// =============================================================================
// Simple Event Emitter
// =============================================================================
// Provides a lightweight pub/sub mechanism for state change notifications
// This allows different modules to react to state changes without tight coupling

type Listener = (val: any) => void;
const listeners: Record<string, Listener[]> = {};

/**
 * Register a listener for a specific event
 * @param event - Event name to listen for
 * @param fn - Callback function to invoke when event is emitted
 */
export function on(event: string, fn: Listener) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
}

/**
 * Emit an event to all registered listeners
 * @param event - Event name to emit
 * @param val - Value to pass to listeners
 */
export function emit(event: string, val: any) {
    if (listeners[event]) listeners[event].forEach(fn => fn(val));
}
