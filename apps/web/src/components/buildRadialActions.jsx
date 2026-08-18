import { ActionPersonaIcon } from './ActionPersonaBits.jsx';
import { RenderModeIcon } from './AppIcons.jsx';
import {
  actionPersonaEmoji,
  actionPersonaName,
  actionPersonaTitle
} from '../utils/appActionPersonas.js';
import { russShapeLabel, selectableRenderModes } from '../utils/renderModeAction.js';

/**
 * Radial menu action definitions for the diagram node toolbar.
 *
 * @param {{
 *   controls: import('../i18n/useUiLocale.js').UiControls;
 *   slopitect: { PROMPT_ACTION_COPY: { label: string, roleTag: string, roleEmoji: string, title: string } };
 *   russStreak: number;
 *   contentMode: string;
 *   contentModeOptions: Array<{ id: string, label: string }>;
 *   canFixFromCritique: boolean;
 *   graphEdit?: { enabled?: boolean, kind?: string | null, busy?: boolean } | null;
 *   touchGraphEdit?: boolean;
 * }} params
 */
export function buildRadialActions({
  controls,
  slopitect,
  russStreak,
  contentMode,
  contentModeOptions,
  canFixFromCritique,
  graphEdit = null,
  touchGraphEdit = false
}) {
  const a = controls.actions;
  const promptCopy = slopitect.PROMPT_ACTION_COPY;
  const editOn = Boolean(graphEdit?.enabled);
  const kind = graphEdit?.kind;
  const editBusy = Boolean(graphEdit?.busy);
  const graphActions = [
    {
      id: 'connect',
      label: a.connect,
      icon: (
        <span className="action-persona-icon is-connect" aria-hidden="true">
          +
        </span>
      ),
      variant: 'connect',
      group: 'primary',
      persona: a.connect,
      personaTitle: a.connectTitle,
      hidden: !editOn || kind !== 'node',
      disabled: editBusy
    },
    {
      id: 'link',
      label: a.link,
      icon: (
        <span className="action-persona-icon is-link" aria-hidden="true">
          ⇢
        </span>
      ),
      variant: 'link',
      group: 'primary',
      persona: a.link,
      personaTitle: a.linkTitle,
      hidden: !editOn || kind !== 'node' || !touchGraphEdit,
      disabled: editBusy
    },
    {
      id: 'delete',
      label: a.delete,
      icon: (
        <span className="action-persona-icon is-delete" aria-hidden="true">
          ×
        </span>
      ),
      variant: 'delete',
      group: 'primary',
      persona: a.delete,
      personaTitle: a.deleteTitle,
      hidden: !editOn || (kind !== 'node' && kind !== 'edge'),
      disabled: editBusy
    },
    {
      id: 'rename',
      label: a.rename,
      icon: (
        <span className="action-persona-icon is-rename" aria-hidden="true">
          ✎
        </span>
      ),
      variant: 'rename',
      group: 'primary',
      persona: a.rename,
      personaTitle: a.renameTitle,
      hidden: !editOn || (kind !== 'node' && kind !== 'edge'),
      disabled: editBusy
    }
  ];
  return [
    ...graphActions,
    {
      id: 'definition',
      label: a.definition,
      icon: (
        <span className="action-persona-icon is-definition" aria-hidden="true">
          ?
        </span>
      ),
      variant: 'definition',
      group: 'primary',
      behavior: 'showExplanation',
      persona: a.definitionPersona,
      personaTitle: a.definitionTitle
    },
    {
      id: 'stakeholders',
      label: a.stakeholders,
      icon: (
        <span className="action-persona-icon is-stakeholders" aria-hidden="true">
          👥
        </span>
      ),
      variant: 'stakeholders',
      group: 'primary',
      behavior: 'expandStakeholders',
      persona: a.stakeholders,
      personaTitle: a.stakeholdersTitle
    },
    {
      id: 'prompt',
      label: promptCopy.label,
      icon: (
        <span className="action-persona-icon is-prompt" aria-hidden="true">
          💬
        </span>
      ),
      variant: 'prompt',
      group: 'primary',
      persona: promptCopy.roleTag,
      personaEmoji: promptCopy.roleEmoji,
      personaTitle: promptCopy.title
    },
    {
      id: 'renderMode',
      label: a.renderMode,
      icon: (
        <span className="action-persona-icon is-render-mode" aria-hidden="true">
          <RenderModeIcon />
        </span>
      ),
      variant: 'render-mode',
      group: 'primary',
      behavior: 'expandRenderModes',
      persona: a.renderModePersona,
      personaTitle: a.renderModeTitle,
      modeOptions: selectableRenderModes(contentMode, contentModeOptions)
    },
    {
      id: 'gilfoyle',
      label: a.gilfoyle,
      icon: <ActionPersonaIcon variant="gilfoyle" />,
      variant: 'gilfoyle',
      persona: actionPersonaName('gilfoyle'),
      personaEmoji: actionPersonaEmoji('gilfoyle'),
      personaTitle: actionPersonaTitle('gilfoyle')
    },
    {
      id: 'dinesh',
      label: a.dinesh,
      icon: <ActionPersonaIcon variant="dinesh" />,
      variant: 'dinesh',
      persona: actionPersonaName('dinesh'),
      personaEmoji: actionPersonaEmoji('dinesh'),
      personaTitle: actionPersonaTitle('dinesh')
    },
    {
      id: 'erlich',
      label: a.erlich,
      icon: <ActionPersonaIcon variant="erlich" />,
      variant: 'erlich',
      persona: actionPersonaName('erlich'),
      personaEmoji: actionPersonaEmoji('erlich'),
      personaTitle: actionPersonaTitle('erlich')
    },
    {
      id: 'russ',
      label: russShapeLabel(russStreak, a),
      icon: <ActionPersonaIcon variant="russ" />,
      variant: 'russ',
      persona: actionPersonaName('russ'),
      personaEmoji: actionPersonaEmoji('russ'),
      personaTitle: actionPersonaTitle('russ')
    },
    {
      id: 'barker',
      label: a.prepForCeo ?? a.coDesign,
      icon: <ActionPersonaIcon variant="barker" />,
      variant: 'barker',
      persona: actionPersonaName('barker'),
      personaEmoji: actionPersonaEmoji('barker'),
      personaTitle: actionPersonaTitle('barker')
    },
    {
      id: 'jared',
      label: a.jared,
      icon: <ActionPersonaIcon variant="jared" />,
      variant: 'jared',
      persona: actionPersonaName('jared'),
      personaEmoji: actionPersonaEmoji('jared'),
      personaTitle: actionPersonaTitle('jared')
    },
    {
      id: 'fix',
      label: a.fix,
      icon: (
        <span className="action-persona-icon is-fix" aria-hidden="true">
          🛠️
        </span>
      ),
      variant: 'fix',
      persona: a.fixPersona,
      personaEmoji: '🛠️',
      personaTitle: a.fixTitle,
      hidden: !canFixFromCritique,
      disabled: !canFixFromCritique
    },
    {
      id: 'richard',
      label: a.richard,
      icon: <ActionPersonaIcon variant="richard" />,
      variant: 'richard',
      persona: actionPersonaName('richard'),
      personaEmoji: actionPersonaEmoji('richard'),
      personaTitle: actionPersonaTitle('richard')
    }
  ];
}
