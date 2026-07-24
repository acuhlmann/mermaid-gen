import { useEffect } from 'react';
import { splitCritiqueActionableSections } from '@archislop/shared';

/**
 * Reset actionable critique checkbox mask when critique text changes.
 */
export function useCritiqueActionableSelection({ latestCritique, setCritiqueActionableSelected }) {
  useEffect(() => {
    if (!latestCritique?.text) {
      setCritiqueActionableSelected([]);
      return;
    }
    const { items } = splitCritiqueActionableSections(latestCritique.text);
    setCritiqueActionableSelected(items.map(() => false));
  }, [latestCritique?.createdAt, latestCritique?.text, setCritiqueActionableSelected]);
}
