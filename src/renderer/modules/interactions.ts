import { state } from './store';
import { listen } from '@tauri-apps/api/event';

export function setupClickThrough() {
    console.log('[Interactions] Standard CSS Hover Mode (Windowed)');

    // In "Windowed" mode (small box), we don't need to manually toggle 
    // ignoreCursorEvents based on coordinates, because the window only 
    // exists where content is. The OS handles click-through for us 
    // (by not having a window there!).

    // We still listen to cursor-pos just for debug or advanced features if needed later,
    // but for now, standard :hover CSS works because the window is under the mouse.
    listen('cursor-pos', (event: any) => {
        // payload: { x: 123, y: 456 }
        // We can keep this for future "eye tracking" or similar features
        const { x, y } = event.payload;
        if (Math.random() < 0.05) console.log(`[Interactions] Cursor: ${x}, ${y}`);
    });
}
