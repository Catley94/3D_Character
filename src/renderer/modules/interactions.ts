// =============================================================================
// Interactions Module (interactions.ts)
// =============================================================================
//
// This module previously contained a duplicate wiggle-detection and evasion
// system based on global cursor tracking. That logic has been consolidated
// into character.ts (onCharacterMouseMove + moveToRandomLocation), which
// uses direct mousemove events on the character element for more accurate
// wiggle detection and a smooth animated slide instead of teleportation.
//
// This stub remains so that app.ts can still call setupClickThrough()
// without breaking. If you need global cursor-based interactions in the
// future (e.g. proximity-aware reactions), this is the place to add them.
//
// =============================================================================

/**
 * Initializes click-through / interaction detection.
 * Currently a no-op — wiggle detection is handled by character.ts.
 */
export function setupClickThrough() {
    console.log('[Interactions] Module loaded (wiggle detection handled by character.ts)');
}
