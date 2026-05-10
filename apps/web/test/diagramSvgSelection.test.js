import { describe, expect, it } from 'vitest';
import { parseFlowchartEdgeDataId } from '../src/utils/diagramSvgSelection.js';

describe('parseFlowchartEdgeDataId', () => {
  it('parses L_<from>_<to>_<index>', () => {
    expect(parseFlowchartEdgeDataId('L_A_B_0')).toEqual({
      from: 'A',
      to: 'B',
      index: 0,
      raw: 'L_A_B_0'
    });
  });

  it('parses numeric suffix for parallel edges', () => {
    expect(parseFlowchartEdgeDataId('L_X_Y_2')).toEqual({
      from: 'X',
      to: 'Y',
      index: 2,
      raw: 'L_X_Y_2'
    });
  });

  it('returns null for user-defined or unknown ids', () => {
    expect(parseFlowchartEdgeDataId('myCustomEdge')).toBeNull();
    expect(parseFlowchartEdgeDataId('')).toBeNull();
    expect(parseFlowchartEdgeDataId(null)).toBeNull();
  });
});
