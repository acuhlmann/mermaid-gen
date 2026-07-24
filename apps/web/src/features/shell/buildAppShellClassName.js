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
  showDeskChrome,
  officeBootPending
}) {
  return `app-shell${editorOpen ? ' is-editor-open' : ''}${insightsOpen ? ' is-insights-open' : ''}${narrowLayout ? ' is-narrow-layout' : ''}${phoneLayout ? ' is-phone-layout' : ''}${wideMobileLayout ? ' is-wide-mobile' : ''}${foldableDualScreen ? ' is-foldable-dual' : ''}${hasCanvasContent || editorOpen ? ' has-edit-control' : ''}${showDeskChrome ? ' has-bottom-brand' : ''}${officeBootPending ? ' is-office-boot' : ''}`;
}
