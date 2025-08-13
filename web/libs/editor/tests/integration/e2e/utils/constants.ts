/**
 * Constants for tests
 */

/**
 * Wait time for processing a single animation frame (in ms)
 * Used for waiting for fast renders and DOM updates
 */
export const SINGLE_FRAME_TIMEOUT = 16;

/**
 * Wait time for processing two animation frames (in ms)
 * Used for waiting for fast renders which could be done in two steps for some reason
 */
export const TWO_FRAMES_TIMEOUT = SINGLE_FRAME_TIMEOUT * 2;
