import { describe, expect, it, vi } from 'vitest';

import { stopMeditationPlayer } from './playerCleanup';

describe('stopMeditationPlayer', () => {
  it('pauses and rewinds without destroying the hook-managed player', async () => {
    const player = {
      pause: vi.fn(),
      seekTo: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn(),
    };

    stopMeditationPlayer(player as never, 'test');
    await Promise.resolve();

    expect(player.pause).toHaveBeenCalledTimes(1);
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.remove).not.toHaveBeenCalled();
  });
});
