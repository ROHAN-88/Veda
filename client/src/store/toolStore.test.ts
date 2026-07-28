import { beforeEach, describe, expect, it } from 'vitest';
import { useToolStore } from './toolStore';

const INITIAL = useToolStore.getState();

describe('toolStore', () => {
  beforeEach(() => {
    useToolStore.setState(INITIAL, true);
  });

  it('defaults to the select tool', () => {
    expect(useToolStore.getState().tool).toBe('select');
  });

  it('switches the active tool', () => {
    useToolStore.getState().setTool('pan');
    expect(useToolStore.getState().tool).toBe('pan');
    useToolStore.getState().setTool('select');
    expect(useToolStore.getState().tool).toBe('select');
  });
});
