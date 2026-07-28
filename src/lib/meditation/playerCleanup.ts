import type { AudioPlayer } from 'expo-audio';

/**
 * Stops playback without destroying a hook-managed AudioPlayer.
 *
 * `useAudioPlayer` owns the player lifecycle and releases it on unmount.
 * Calling `remove()` during a session permanently destroys the instance and
 * can leave later play/exit actions stuck. Use this helper for tab changes,
 * sound changes, session completion, and navigation.
 */
export function stopMeditationPlayer(player: AudioPlayer, context: string) {
  try {
    player.pause();
    void player.seekTo(0).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Meditation] Audio rewind failed during ${context}: ${message}`);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[Meditation] Audio cleanup failed during ${context}: ${message}`);
  }
}
