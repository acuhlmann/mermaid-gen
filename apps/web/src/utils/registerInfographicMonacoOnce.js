/**
 * Registers a Monaco language for the AntV Infographic DSL.
 *
 * The DSL is indentation-driven and looks roughly like YAML, but uses a fixed
 * header line `infographic <template>` and a curated set of structural keys
 * (data fields like `nodes`, `lists`, `sequences`, `compares`, `values`, `root`;
 * per-item keys like `label`, `desc`, `icon`, `value`, `from`, `to`, `palette`).
 * We expose enough tokens to colour template names, keys, strings, hyphen
 * bullets, and HTML-ish inline markup that often appears inside labels.
 */

let registered = false;

const TOP_LEVEL_KEYS = [
  'data',
  'title',
  'desc',
  'theme',
  'palette',
  'lists',
  'sequences',
  'compares',
  'values',
  'nodes',
  'relations',
  'edges',
  'root',
  'children',
  'items'
];

const ITEM_KEYS = [
  'label',
  'desc',
  'value',
  'icon',
  'from',
  'to',
  'color',
  'href',
  'image',
  'image-src',
  'tag',
  'badge',
  'priority',
  'note',
  'category'
];

export default function registerInfographicMonacoOnce(monaco) {
  if (registered) return;
  if (!monaco?.languages?.register) return;
  registered = true;

  monaco.languages.register({ id: 'infographic' });

  monaco.languages.setLanguageConfiguration('infographic', {
    comments: { lineComment: '#' },
    brackets: [['<', '>']],
    autoClosingPairs: [
      { open: '"', close: '"' },
      { open: '<', close: '>' }
    ],
    surroundingPairs: [
      { open: '"', close: '"' },
      { open: '<', close: '>' }
    ],
    onEnterRules: [
      {
        beforeText: /^(\s*)(- .*|[A-Za-z][\w-]*)\s*$/,
        action: { indentAction: monaco.languages.IndentAction.Indent }
      }
    ]
  });

  monaco.languages.setMonarchTokensProvider('infographic', {
    defaultToken: '',
    tokenPostfix: '.infographic',
    topLevelKeys: TOP_LEVEL_KEYS,
    itemKeys: ITEM_KEYS,
    tokenizer: {
      root: [
        // Header line: `infographic <template-name>`
        [/^\s*(infographic)(\s+)([a-z][\w-]*)/, ['keyword.control', 'white', 'type.identifier']],
        // Comments — DSL doesn't natively support them, but agents sometimes emit them; render dimly.
        [/#.*$/, 'comment'],
        // List bullets
        [/^\s*-(?=\s)/, 'keyword.operator'],
        // Indented key: value pairs (key may carry hyphens, then optional value)
        [
          /^(\s*)([A-Za-z][\w-]*)(\s+)/,
          [
            'white',
            {
              cases: {
                '@topLevelKeys': 'keyword',
                '@itemKeys': 'attribute.name',
                '@default': 'identifier'
              }
            },
            'white'
          ]
        ],
        // Bare key with no value on the line
        [
          /^(\s*)([A-Za-z][\w-]*)(\s*)$/,
          [
            'white',
            {
              cases: {
                '@topLevelKeys': 'keyword',
                '@itemKeys': 'attribute.name',
                '@default': 'identifier'
              }
            },
            'white'
          ]
        ],
        { include: '@values' }
      ],
      values: [
        // Quoted strings
        [/"([^"\\]|\\.)*"/, 'string'],
        // Hex colour literals (palette entries)
        [/#[0-9A-Fa-f]{3,8}\b/, 'constant.numeric.hex'],
        // Numbers
        [/-?\d+(?:\.\d+)?%?/, 'number'],
        // HTML-ish tags inside labels (e.g. <br>, <i>...</i>)
        [/<\/?[A-Za-z][\w-]*\s*\/?>/, 'tag'],
        // Bare tokens — leave them with the default colour
        [/[^\s<#"-]+/, '']
      ]
    }
  });
}
