import { ActionPersonaIcon } from './ActionPersonaBits.jsx';
import { RenderModeIcon } from './AppIcons.jsx';
import {
  actionPersonaEmoji,
  actionPersonaName,
  actionPersonaTitle
} from '../utils/appActionPersonas.js';
import { goMadShapeLabel, selectableRenderModes } from '../utils/renderModeAction.js';

/**
 * Radial menu action definitions for the diagram node toolbar.
 *
 * @param {{
 *   controls: import('../i18n/useUiLocale.js').UiControls;
 *   slopitect: { PROMPT_ACTION_COPY: { label: string, roleTag: string, roleEmoji: string, title: string } };
 *   goMadStreak: number;
 *   contentMode: string;
 *   contentModeOptions: Array<{ id: string, label: string }>;
 *   canFixFromCritique: boolean;
 * }} params
 */
export function buildRadialActions({
  controls,
  slopitect,
  goMadStreak,
  contentMode,
  contentModeOptions,
  canFixFromCritique
}) {
  const a = controls.actions;
  const promptCopy = slopitect.PROMPT_ACTION_COPY;
  return [
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
      id: 'erlich',
      label: a.erlich,
      icon: <ActionPersonaIcon variant="erlich" />,
      variant: 'erlich',
      persona: actionPersonaName('erlich'),
      personaEmoji: actionPersonaEmoji('erlich'),
      personaTitle: actionPersonaTitle('erlich')
    },
    {
      id: 'goMad',
      label: goMadShapeLabel(goMadStreak, a),
      icon: <ActionPersonaIcon variant="goMad" />,
      variant: 'go-mad',
      persona: actionPersonaName('goMad'),
      personaEmoji: actionPersonaEmoji('goMad'),
      personaTitle: actionPersonaTitle('goMad')
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
      id: 'critique',
      label: a.critique,
      icon: <ActionPersonaIcon variant="critique" />,
      variant: 'critique',
      persona: actionPersonaName('critique'),
      personaEmoji: actionPersonaEmoji('critique'),
      personaTitle: actionPersonaTitle('critique')
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
      id: 'explain',
      label: a.explain,
      icon: <ActionPersonaIcon variant="explain" />,
      variant: 'explain',
      persona: actionPersonaName('explain'),
      personaEmoji: actionPersonaEmoji('explain'),
      personaTitle: actionPersonaTitle('explain')
    }
  ];
}
