// ESLint 10 removed context.getFilename(); @factory/eslint-plugin@0.1.0 still
// calls it. Wrap each rule so legacy rules keep working until upstream fixes land.

import factory from '@factory/eslint-plugin';

function compatContext(context) {
  if (typeof context.getFilename === 'function') return context;
  return new Proxy(context, {
    get(target, prop, receiver) {
      if (prop === 'getFilename') {
        return () => target.filename ?? target.physicalFilename ?? '';
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

function wrapRule(rule) {
  if (!rule?.create) return rule;
  return {
    ...rule,
    create(context) {
      return rule.create(compatContext(context));
    }
  };
}

const compatRules = Object.fromEntries(
  Object.entries(factory.rules ?? {}).map(([name, rule]) => [name, wrapRule(rule)])
);

/** @factory/eslint-plugin with ESLint 10 getFilename compatibility. */
export default {
  ...factory,
  rules: compatRules
};
