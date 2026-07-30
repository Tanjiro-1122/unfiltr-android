import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * The one place that answers "which build is this?" -- exists specifically
 * so a physical-device report can always be correlated back to an exact
 * commit, rather than inferred from when a build was started or which APK
 * file a tester thinks they installed. versionCode/buildNumber comes from
 * the platform-specific manifest field EAS actually embeds; gitCommitSha
 * comes from app.config.js, which shells out to `git rev-parse HEAD` on
 * the EAS build server at config-evaluation time.
 */
export function getBuildLabel(): string {
  const buildNumber =
    Platform.OS === 'android'
      ? Constants.expoConfig?.android?.versionCode
      : Constants.expoConfig?.ios?.buildNumber;
  const sha = getShortGitCommitSha();
  return `v${Constants.expoConfig?.version ?? '?'} (${buildNumber ?? '?'}) · ${sha}`;
}

export function getShortGitCommitSha(): string {
  const sha = Constants.expoConfig?.extra?.gitCommitSha;
  return typeof sha === 'string' && sha.length >= 7 ? sha.slice(0, 7) : 'unknown';
}
