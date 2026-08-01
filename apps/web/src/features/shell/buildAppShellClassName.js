/**
 * Compose the root app-shell layout class list from chrome flags.
 */
export function buildAppShellClassName({
  editorOpen,
  insightsOpen,
  narrowLayout,
  phoneLayout,
  wideMobileLayout,
  foldableDualScreen,
  hasCanvasContent,
  // Kept for call-site stability; the helmet brand mark lives on the top chip
  // again (desk slot is mail / chat / meeting icons, not the stamp).
  showDeskChrome: _showDeskChrome,
  officeBootPending
}) {
  return `app-shell${editorOpen ? ' is-editor-open' : ''}${insightsOpen ? ' is-insights-open' : ''}${narrowLayout ? ' is-narrow-layout' : ''}${phoneLayout ? ' is-phone-layout' : ''}${wideMobileLayout ? ' is-wide-mobile' : ''}${foldableDualScreen ? ' is-foldable-dual' : ''}${hasCanvasContent || editorOpen ? ' has-edit-control' : ''}${officeBootPending ? ' is-office-boot' : ''}`;
}
