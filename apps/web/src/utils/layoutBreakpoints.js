export const MOBILE_MAX_WIDTH_PX = 1024;
export const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_MAX_WIDTH_PX}px)`;

/** True phone layout — fullscreen overlays, not split-pane tablet/foldable inner screen. */
export const PHONE_MAX_WIDTH_PX = 639;
export const PHONE_MEDIA_QUERY = `(max-width: ${PHONE_MAX_WIDTH_PX}px)`;

/**
 * Unfolded foldables and small tablets: enough width/height for a side-by-side
 * canvas + Thinking pane instead of a fullscreen overlay.
 */
export const WIDE_MOBILE_MIN_WIDTH_PX = 640;
export const WIDE_MOBILE_MIN_HEIGHT_PX = 480;
export const WIDE_MOBILE_MEDIA_QUERY = `(min-width: ${WIDE_MOBILE_MIN_WIDTH_PX}px) and (max-width: ${MOBILE_MAX_WIDTH_PX}px) and (min-height: ${WIDE_MOBILE_MIN_HEIGHT_PX}px)`;

/** Dual-screen foldables spanning two viewport segments (hinge between panels). */
export const FOLDABLE_DUAL_SCREEN_MEDIA_QUERY = '(horizontal-viewport-segments: 2)';

/**
 * Threshold below which the brand chip can no longer fit the inline XP bar
 * alongside the prestige badge — at or above this, the XP bar renders expanded.
 */
export const COMPACT_BRAND_MAX_WIDTH_PX = 540;
export const COMPACT_BRAND_MEDIA_QUERY = `(max-width: ${COMPACT_BRAND_MAX_WIDTH_PX}px)`;

/** Bottom chrome reserve for radial menu clamping — mirrors --mobile-bottom-chrome-est (8.75rem). */
export const MOBILE_BOTTOM_CHROME_RESERVE_PX = 140;

/** Thinking pane header: shorten controls when the pane column is this narrow or less. */
export const INSIGHTS_HEADER_COMPACT_MAX_PX = 400;
