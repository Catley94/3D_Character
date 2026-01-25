import { state } from './store';

export function setupClickThrough() {
    console.log('[Interactions] Setting up click-through (Polling Mode)...');

    const character = document.getElementById('character');
    const backpack = document.getElementById('backpack');
    const speechBubble = document.getElementById('speech-bubble');
    const chatInputContainer = document.getElementById('chat-input-container');
    const settingsPanel = document.getElementById('settings-panel');

    console.log('[Interactions] Init. Char matching:', !!character);

    // Helper to check if point is in rect
    function isPointInRect(x: number, y: number, el: HTMLElement | null): boolean {
        if (!el || el.classList.contains('hidden')) return false;

        // Settings panel is special
        if (el.id === 'settings-panel' && !el.classList.contains('hidden')) return true;

        const rect = el.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    }

    // POLL LOOP: Maintained in a variable to avoid "mouse leaving" logic
    let isTracking = true;

    async function checkMousePosition() {
        if (!isTracking) return;

        try {
            // Get Global Cursor and Window Bounds from Main Process
            const cursor = await window.electronAPI.getCursorScreenPoint();
            const winBounds = await window.electronAPI.getWindowBounds();

            // Calculate Local Coordinates (relative to window top-left)
            const localX = cursor.x - winBounds.x;
            const localY = cursor.y - winBounds.y;

            // Check if dragging (always capture)
            if (state.isDragging) {
                // if dragging, we don't interfere with ignore settings (drag controls them)
                requestAnimationFrame(checkMousePosition);
                return;
            }

            // Check Settings Panel
            if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
                window.electronAPI.setIgnoreMouseEvents(false);
                requestAnimationFrame(checkMousePosition);
                return;
            }

            // Hit Test
            const isInteractive =
                isPointInRect(localX, localY, character) ||
                isPointInRect(localX, localY, backpack) ||
                isPointInRect(localX, localY, speechBubble) ||
                isPointInRect(localX, localY, chatInputContainer);

            if (isInteractive) {
                // Force Capture
                window.electronAPI.setIgnoreMouseEvents(false);
            } else {
                // Force Pass-Through
                window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
            }

        } catch (err) {
            console.error('Polling error:', err);
        }

        // Poll every 100ms (balanced for performance/responsiveness)
        setTimeout(checkMousePosition, 100);
    }

    // Start Polling
    checkMousePosition();

    // Standard Window Events (Optional fallback/hybrid)
    window.addEventListener('mousemove', (e) => {
        // e.clientX is trustworthy IF we receive it.
        // We can use it for INSTANT reaction if forwarding works
        // But we rely on polling for the "I am stuck in ignore mode" catch.
    });
}
