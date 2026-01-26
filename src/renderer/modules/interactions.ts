import { state } from './store';

export function setupClickThrough() {
    console.log('[Interactions] Setting up click-through (Manual CSS Hover Mode)...');

    // ARCHITECTURE:
    // 1. MAIN PROCESS: Polls cursor position every 50ms and streams {x, y} coordinates.
    // 2. RENDERER: Receives coordinates, calculates hits, and MANUALLY toggles .manual-hover classes.
    //    - This bypasses the browser's failure to trigger pseudo-classes on inactive windows.

    const character = document.getElementById('character');
    const backpack = document.getElementById('backpack');
    const speechBubble = document.getElementById('speech-bubble');
    const chatInputContainer = document.getElementById('chat-input-container');
    const settingsPanel = document.getElementById('settings-panel');
    const dragHandle = document.getElementById('drag-handle');
    const closeBtn = document.getElementById('close-settings');
    const saveBtn = document.getElementById('save-settings');
    const characterContainer = document.getElementById('character-container');

    // Elements to track for manual hover
    const hoverElements = [
        { el: character, id: 'character' },
        { el: backpack, id: 'backpack' },
        { el: speechBubble, id: 'speech-bubble' },
        { el: chatInputContainer, id: 'chat-input-container' },
        { el: dragHandle, id: 'drag-handle' },
        { el: closeBtn, id: 'close-settings' },
        { el: saveBtn, id: 'save-settings' }
    ].filter(item => !!item.el);

    console.log(`[Interactions] Tracking ${hoverElements.length} elements for manual hover`);

    // Helper to check if point is in element rect
    function isPointInRect(x: number, y: number, el: HTMLElement | null): boolean {
        if (!el || el.classList.contains('hidden')) return false;
        if (el.id === 'settings-panel' && !el.classList.contains('hidden')) return true;
        const rect = el.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    // ========================================
    // MAIN PROCESS COORDINATE STREAM (The Engine)
    // ========================================
    window.electronAPI.onCursorPosition((pos: { x: number, y: number }) => {
        const { x, y } = pos;
        let anyInteractive = false;

        // Settings panel override
        if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
            anyInteractive = true;
        }

        // Check each element
        hoverElements.forEach(item => {
            const el = item.el!;
            const isHovered = isPointInRect(x, y, el);

            if (isHovered) {
                if (!el.classList.contains('manual-hover')) {
                    el.classList.add('manual-hover');
                }
                anyInteractive = true;
            } else {
                if (el.classList.contains('manual-hover')) {
                    el.classList.remove('manual-hover');
                }
            }
        });

        // Update Ignore State based on hit test
        // note: checks are fine-grained
        if (!state.isDragging) {
            if (anyInteractive) {
                window.electronAPI.setIgnoreMouseEvents(false);
            } else {
                window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
            }
        }
    });

    // ========================================
    // RENDERER FALLBACK
    // ========================================
    window.addEventListener('mousemove', (e) => {
        // We trust the stream.
    });

    console.log('[Interactions] Setup complete - listening for cursor-position');
}
