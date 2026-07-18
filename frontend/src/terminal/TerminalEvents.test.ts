import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listenMock } = vi.hoisted(() => ({ listenMock: vi.fn() }));

vi.mock('@tauri-apps/api/event', () => ({ listen: listenMock }));

import { startTerminalEventStream } from './TerminalEvents';

describe('terminal event listener setup', () => {
  beforeEach(() => {
    listenMock.mockReset();
  });

  it('cleans up a partial registration and permits a retry', async () => {
    const removeOutputListener = vi.fn();
    listenMock.mockResolvedValueOnce(removeOutputListener).mockRejectedValueOnce(new Error('exit listener failed'));

    await expect(startTerminalEventStream(vi.fn(), vi.fn())).rejects.toThrow('exit listener failed');
    expect(removeOutputListener).toHaveBeenCalledOnce();

    listenMock.mockResolvedValue(vi.fn());
    await expect(startTerminalEventStream(vi.fn(), vi.fn())).resolves.toBeUndefined();
    expect(listenMock).toHaveBeenCalledTimes(4);
  });
});
