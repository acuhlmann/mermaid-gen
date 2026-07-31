import { useCallback, useState } from 'react';
import DeskOsMenu, { DeskOsMenuItem, DeskOsMenuSection } from './DeskOsMenu.jsx';
import IntroLocaleToggle from './IntroLocaleToggle.jsx';
import OutboxDock from './OutboxDock.jsx';
import { useUiCopy } from '../i18n/useUiLocale.js';
import { officeChromeCopy } from '../utils/officeCast.js';

/**
 * What this deliverable *is*, and the shredder that ends it. This is the
 * dismantled `DeskDrawer`, moved up: docs/office-parody.md already called that
 * row's function "Deliverable format", and a drawer violates ADR-0011's
 * clean-desk policy on screen.
 */
function DeliverableMenu({ menu, copy, controls, actions, options }) {
  const { modes, currentMode, onPickMode, modeDisabled, onClearDiagram, clearDisabled } = options;
  return (
    <DeskOsMenu
      {...menu}
      label={copy.deliverable ?? 'Deliverable'}
      emoji="📄"
      title={copy.deliverableTitle ?? copy.deliverable}
      menuAria={copy.deliverableAria ?? copy.deliverable}
    >
      {(close) => (
        <>
          <DeskOsMenuSection label={copy.formatSection ?? copy.deliverable}>
            {modes.map((mode) => {
              const isCurrent = mode.id === currentMode;
              return (
                <DeskOsMenuItem
                  key={mode.id}
                  label={mode.label}
                  subtitle={mode.techLabel ?? mode.subtitle ?? null}
                  current={isCurrent}
                  tag={isCurrent ? (controls.radial?.currentMode ?? 'Current') : null}
                  disabled={modeDisabled || isCurrent}
                  onSelect={() => {
                    close();
                    onPickMode?.(mode.id);
                  }}
                />
              );
            })}
          </DeskOsMenuSection>
          <DeskOsMenuSection>
            <DeskOsMenuItem
              emoji="🗑️"
              danger
              label={actions.demolish ?? actions.clear ?? 'Shredder'}
              title={actions.clearTitle}
              disabled={clearDisabled}
              testId="menubar-shredder"
              onSelect={() => {
                close();
                onClearDiagram?.();
              }}
            />
          </DeskOsMenuSection>
        </>
      )}
    </DeskOsMenu>
  );
}

/**
 * Shipping it out. The 11 export formats were two clicks deep — an expandable
 * row inside a menu you had to know to open.
 */
function MailroomMenu({ menu, settings, options }) {
  return (
    <DeskOsMenu
      {...menu}
      label={settings.outboxLabel ?? 'Mailroom'}
      emoji="📤"
      title={settings.outboxTitle ?? settings.outboxLabel}
      menuAria={settings.outboxRegion ?? settings.outboxLabel}
    >
      {() => (
        <div className="desk-os-menu-panel">
          <OutboxDock
            embedded
            controls={settings}
            contentType={options.contentType}
            diagramSource={options.diagramSource}
            popoverMode={false}
            showTrigger={false}
          />
        </div>
      )}
    </DeskOsMenu>
  );
}

/**
 * The docked panes and the screen itself. Editor and Thinking stay *docked*
 * panes — this is a toggle list, not a window manager.
 */
function ViewMenu({ menu, copy, controls, desk, options }) {
  const {
    editorOpen,
    onToggleEditor,
    canToggleEditor,
    notebookOpen,
    onToggleNotebook,
    canToggleNotebook,
    fullscreenSupported,
    isFullscreen,
    fullscreenDisabled,
    onToggleFullscreen
  } = options;
  return (
    <DeskOsMenu
      {...menu}
      label={copy.view ?? 'View'}
      emoji="🖥️"
      title={copy.viewTitle ?? copy.view}
      menuAria={copy.viewAria ?? copy.view}
    >
      {(close) => (
        <>
          <DeskOsMenuItem
            emoji="</>"
            label={controls.editor?.code ?? 'Code'}
            title={controls.editor?.codeTitle}
            pressed={editorOpen}
            disabled={!canToggleEditor}
            testId="menubar-editor-toggle"
            onSelect={() => {
              close();
              onToggleEditor?.();
            }}
          />
          <DeskOsMenuItem
            emoji="📓"
            label={desk.thinkingShort ?? desk.thinking}
            title={desk.thinkingTitle}
            pressed={notebookOpen}
            disabled={!canToggleNotebook}
            testId="menubar-notebook-toggle"
            onSelect={() => {
              close();
              onToggleNotebook?.();
            }}
          />
          {fullscreenSupported ? (
            <DeskOsMenuItem
              emoji="⛶"
              label={
                isFullscreen
                  ? (controls.fullscreen?.exit ?? 'Exit fullscreen')
                  : (controls.fullscreen?.enter ?? 'Enter fullscreen')
              }
              pressed={isFullscreen}
              disabled={fullscreenDisabled}
              testId="menubar-fullscreen"
              onSelect={() => {
                close();
                void onToggleFullscreen?.();
              }}
            />
          ) : null}
        </>
      )}
    </DeskOsMenu>
  );
}

/**
 * The rare, boring, once-a-session verbs. "Onboard a contractor" is the single
 * doorway to external agents (docs/multi-human-office.md), so the presence
 * panel sits next to it rather than in a settings cluster of its own.
 */
function AdminMenu({ menu, copy, controls, settings, desk, locale, setLocale, options }) {
  const languagePack = controls.languagePack ?? {};
  return (
    <DeskOsMenu
      {...menu}
      label={copy.admin ?? 'Admin'}
      emoji="🏢"
      title={copy.adminTitle ?? copy.admin}
      menuAria={copy.adminAria ?? copy.admin}
    >
      {(close) => (
        <>
          <DeskOsMenuItem
            emoji="🤝"
            label={desk.onboardContractor}
            title={desk.onboardContractorTitle}
            testId="menubar-contractor"
            onSelect={() => {
              close();
              options.onOpenContractor?.();
            }}
          />
          <DeskOsMenuItem
            emoji="🛰️"
            label={settings.externalAgents ?? 'External agents'}
            title={settings.title}
            testId="menubar-external-agents"
            onSelect={() => {
              close();
              options.onOpenExternalAgents?.();
            }}
          />
          <DeskOsMenuItem
            emoji="📈"
            label={desk.hrProgress}
            title={desk.hrProgressTitle}
            testId="menubar-hr"
            onSelect={() => {
              close();
              options.onOpenHrProgression?.();
            }}
          />
          <DeskOsMenuItem
            emoji="⌨️"
            label={copy.hotkeys ?? controls.hotkeys?.title ?? 'Keyboard shortcuts'}
            title={controls.hotkeys?.title}
            testId="menubar-hotkeys"
            onSelect={() => {
              close();
              options.onOpenHotkeys?.();
            }}
          />
          {/* Language stays a "raise a ticket with IT" gag — it just stopped
              being a footer on a menu nobody opened for that reason. */}
          <div
            className="desk-language-pack"
            role="group"
            aria-label={languagePack.aria ?? languagePack.label}
            title={languagePack.title}
            data-testid="menubar-language-pack"
          >
            <span className="desk-language-pack-label">
              <span className="desk-language-pack-emoji" aria-hidden="true">
                🌐
              </span>
              {languagePack.label ?? 'Language pack'}
              <span className="desk-language-pack-tag" aria-hidden="true">
                {languagePack.tag ?? 'IT TICKET'}
              </span>
            </span>
            <IntroLocaleToggle
              variant="inline"
              locale={locale}
              copy={controls.introLocale}
              onSelectLocale={setLocale}
            />
          </div>
        </>
      )}
    </DeskOsMenu>
  );
}

/**
 * The parody-OS menu bar (ADR-0011 rule 3; docs/office-isometric-mode.md §4).
 *
 * It exists to answer the question the old layout could not: *which verb goes
 * where*. The rule is frequency, not category — anything you reach for on most
 * runs stays on the composer band at the bottom; anything you reach for a few
 * times a session lives up here, one click deep, like a real menu bar.
 *
 * Behaviour-only props: App owns every handler and copy comes from the bundle.
 * Nothing here is office state, so the bar never needs the office layer.
 *
 * @param {object} props
 */
export default function DeskOsMenuBar({
  // Deliverable
  modes = [],
  currentMode = null,
  onPickMode,
  modeDisabled = false,
  onClearDiagram,
  clearDisabled = false,
  // Mailroom
  contentType = null,
  diagramSource = '',
  // View
  editorOpen = false,
  onToggleEditor,
  canToggleEditor = true,
  notebookOpen = false,
  onToggleNotebook,
  canToggleNotebook = true,
  fullscreenSupported = false,
  isFullscreen = false,
  fullscreenDisabled = false,
  onToggleFullscreen,
  // Admin
  onOpenContractor,
  onOpenExternalAgents,
  onOpenHrProgression,
  onOpenHotkeys,
  /** First-run tour: which menu the coach tip is pointing at. */
  tourHighlight = null
}) {
  const { locale, setLocale, controls } = useUiCopy();
  const desk = officeChromeCopy().desk;
  const copy = controls.menuBar ?? {};
  const [openId, setOpenId] = useState(/** @type {string | null} */ (null));

  const openChangeFor = useCallback(
    (id) => (next) => setOpenId((current) => (next ? id : current === id ? null : current)),
    []
  );

  // Hover only *switches* between menus; it never opens the first one.
  const hoverOpenFor = useCallback(
    (id) => () => setOpenId((current) => (current == null ? current : id)),
    []
  );

  const menuFor = (id) => ({
    id,
    open: openId === id,
    onOpenChange: openChangeFor(id),
    onHoverOpen: hoverOpenFor(id),
    highlight: tourHighlight === id
  });

  const shared = { copy, controls, desk, settings: controls.settings ?? {} };

  return (
    <div
      className="desk-os-menubar"
      data-testid="desk-os-menubar"
      role="menubar"
      aria-label={copy.aria ?? 'Workstation menu bar'}
    >
      <DeliverableMenu
        menu={menuFor('deliverable')}
        copy={copy}
        controls={controls}
        actions={controls.actions ?? {}}
        options={{
          modes: Array.isArray(modes) ? modes.filter((m) => m && m.id && m.label) : [],
          currentMode,
          onPickMode,
          modeDisabled,
          onClearDiagram,
          clearDisabled
        }}
      />
      <MailroomMenu
        menu={menuFor('mailroom')}
        settings={shared.settings}
        options={{ contentType, diagramSource }}
      />
      <ViewMenu
        menu={menuFor('view')}
        copy={copy}
        controls={controls}
        desk={desk}
        options={{
          editorOpen,
          onToggleEditor,
          canToggleEditor,
          notebookOpen,
          onToggleNotebook,
          canToggleNotebook,
          fullscreenSupported,
          isFullscreen,
          fullscreenDisabled,
          onToggleFullscreen
        }}
      />
      <AdminMenu
        menu={menuFor('admin')}
        copy={copy}
        controls={controls}
        settings={shared.settings}
        desk={desk}
        locale={locale}
        setLocale={setLocale}
        options={{
          onOpenContractor,
          onOpenExternalAgents,
          onOpenHrProgression,
          onOpenHotkeys
        }}
      />
    </div>
  );
}
