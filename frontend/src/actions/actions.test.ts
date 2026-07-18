import { describe, expect, it, vi } from 'vitest';

import { ActionRegistry } from './actions';

describe('ActionRegistry failure handling', () => {
  it('reports a rejected action without leaking the rejection', async () => {
    const reportError = vi.fn();
    const registry = new ActionRegistry(reportError);
    const failure = new Error('clipboard denied');
    registry.register({
      id: 'copy',
      title: 'Copy selection',
      run: async () => Promise.reject(failure)
    });

    await expect(registry.run('copy')).resolves.toBeUndefined();

    expect(reportError).toHaveBeenCalledWith('Failed to run Copy selection', failure);
  });

  it('ignores an unknown action id', async () => {
    const reportError = vi.fn();
    const registry = new ActionRegistry(reportError);

    await expect(registry.run('missing')).resolves.toBeUndefined();
    expect(reportError).not.toHaveBeenCalled();
  });
});
