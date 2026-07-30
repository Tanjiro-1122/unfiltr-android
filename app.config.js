const { execSync } = require('child_process');

// Runs on the EAS build server (where the git repo is actually checked
// out) as part of prebuild config evaluation -- not something a device
// ever executes. Embeds the exact commit this specific build was made
// from into extra.gitCommitSha, so a physical-device build can always be
// correlated back to source (see src/lib/build/buildInfo.ts). Expo merges
// this function's return value with app.json's static "expo" config,
// passed in here as `config` -- nothing in app.json needs to change.
function getGitCommitSha() {
  try {
    return execSync('git rev-parse HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
}

module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    gitCommitSha: getGitCommitSha(),
  },
});
