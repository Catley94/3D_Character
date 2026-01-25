import { state } from './store';

export function setupClickThrough() {
    console.log('[Interactions] Setting up click-through...');

    // Re-fetch elements inside the function to ensure they exist
    const character = document.getElementById('character');
    const backpack = document.getElementById('backpack');
    const speechBubble = document.getElementById('speech-bubble');
    const chatInputContainer = document.getElementById('chat-input-container');
    const settingsPanel = document.getElementById('settings-panel');

    console.log('[Interactions] Elements found:', JSON.stringify({
        character: !!character,
        backpack: !!backpack,
        bubble: !!speechBubble,
        input: !!chatInputContainer
    }));

    window.addEventListener('mousemove', (e) => {
        // If drag is active, we must capture
        if (state.isDragging) return;

        // If settings panel is open, always capture
        if (settingsPanel && !settingsPanel.classList.contains('hidden')) {
            window.electronAPI.setIgnoreMouseEvents(false);
            return;
        }

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el) return;

        // Check if element is interactive
        const isInteractive =
            (character && character.contains(el)) ||
            (backpack && backpack.contains(el)) ||
            (speechBubble && speechBubble.contains(el)) ||
            (chatInputContainer && chatInputContainer.contains(el));

        // Debug log
        console.log('[Interactions] Mouse:', e.clientX, e.clientY,
            'El:', el?.tagName, el?.id, el?.className,
            'Interactive:', isInteractive);

        // TEMPORARILY DISABLED: Always capture mouse to debug "unclickable" issue
        window.electronAPI.setIgnoreMouseEvents(false);
        /*
        if (isInteractive) {
            window.electronAPI.setIgnoreMouseEvents(false);
        } else {
            window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        }
        */
    });

    // Ensure we reset if mouse flies out
    document.body.addEventListener('mouseleave', () => {
        // window.electronAPI.setIgnoreMouseEvents(true, { forward: true });
        // Keep active for debug
        window.electronAPI.setIgnoreMouseEvents(false);
    });
}
