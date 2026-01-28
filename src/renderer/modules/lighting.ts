import { getCurrentWindow, currentMonitor } from '@tauri-apps/api/window';

let updateLoopId: number | null = null;

export async function initLighting() {
    console.log('[Lighting] Initializing dynamic shadows...');

    // Start the loop
    startUpdateLoop();
}

async function startUpdateLoop() {
    if (updateLoopId) return;

    // We use a polling approach to keep it smooth and simple without reacting to every single move event payload if unnecessary.
    // However, for best performance, rAF (requestAnimationFrame) is better for animation updates.

    // We need to get the monitor size once (or occasionally) 
    // and the window position every frame.

    let monitor = await currentMonitor();
    if (!monitor) {
        console.warn('[Lighting] No monitor found, skipping lighting.');
        return;
    }

    let screenW = monitor.size.width;
    let screenH = monitor.size.height;

    // Fallback or re-check logic could be added here if the user moves monitors.

    const update = async () => {
        try {
            const win = getCurrentWindow();
            const pos = await win.innerPosition();
            const size = await win.innerSize();

            // Calculate center of the window
            const winCenterX = pos.x + size.width / 2;
            const winCenterY = pos.y + size.height / 2;

            // Calculate center of the screen
            const screenCenterX = screenW / 2;
            const screenCenterY = screenH / 2;

            // Vector from Light (Screen Center) to Object (Window Center)
            // Light source is assumed to be at Screen Center.
            // If window is to the Left of Grid (-X), Shadow should point Left (-X).
            // Wait, if light is in middle and I am on the left, the light hits my right side, so shadow falls to the left.
            // Yes. Vector = Object - Light.

            const vecX = winCenterX - screenCenterX;
            const vecY = winCenterY - screenCenterY;

            // Scale the shadow
            // Adjust this scale factor to control "height" of the floating object relative to the light
            const scaleFactor = 0.02;

            // Limit the shadow distance so it doesn't look ridiculous at edges
            const maxShadow = 20;

            let shadowX = vecX * scaleFactor;
            let shadowY = vecY * scaleFactor;

            // Clamping (optional, creates a "spotlight" feel vs sun feel)
            shadowX = Math.max(-maxShadow, Math.min(maxShadow, shadowX));
            shadowY = Math.max(-maxShadow, Math.min(maxShadow, shadowY));

            // Apply to CSS
            document.documentElement.style.setProperty('--shadow-x', `${shadowX}px`);
            document.documentElement.style.setProperty('--shadow-y', `${shadowY}px`);

            // Dynamic blur based on distance from center? (Closer to light = sharper, Further = softer? Or opposite?)
            // Usually further away = softer shadow.
            const dist = Math.sqrt(vecX * vecX + vecY * vecY);
            const blurBase = 4;
            const blurAdded = dist * 0.01;
            const blur = Math.min(15, blurBase + blurAdded);

            document.documentElement.style.setProperty('--shadow-blur', `${blur}px`);

        } catch (e) {
            console.error('[Lighting] Error updating:', e);
        }

        updateLoopId = requestAnimationFrame(update);
    };

    update();
}
