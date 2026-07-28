#!/usr/bin/env node

/**
 * Sync the repaired shared React Native source into this Android repository.
 *
 * Dry-run is the default. Pass --apply to write files.
 * Example:
 *   node scripts/sync-native-source.mjs --source ../unfiltr-native --apply
 *
 * The source checkout must be on repair/post-build67-fixes at or after
 * babbcf6ab55c297bd391a576e0f4c8733c7bc8b1.
 */

import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const REQUIRED_SOURCE_SHA = 'babbcf6ab55c297bd391a576e0f4c8733c7bc8b1';
const COPY_PATHS = ['app', 'src', 'tests'];
const OPTIONAL_COPY_PATHS = ['assets/brand', 'assets/meditation'];
const ANDROID_OVERLAY_PATHS = ['src/platform/android'];

function parseArgs(argv) {
  const args = { source: null, apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--source') args.source = argv[++index];
    else if (value === '--apply') args.apply = true;
    else if (value === '--help' || value === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function assertSourceCheckout(sourceRoot) {
  if (!(await exists(path.join(sourceRoot, '.git')))) {
    throw new Error(`Source is not a Git checkout: ${sourceRoot}`);
  }

  const head = git(sourceRoot, 'rev-parse', 'HEAD');
  const branch = git(sourceRoot, 'branch', '--show-current');
  execFileSync('git', ['merge-base', '--is-ancestor', REQUIRED_SOURCE_SHA, head], {
    cwd: sourceRoot,
    stdio: 'ignore',
  });

  if (branch !== 'repair/post-build67-fixes') {
    throw new Error(`Source branch must be repair/post-build67-fixes; found ${branch || '(detached)'}`);
  }

  const status = git(sourceRoot, 'status', '--porcelain');
  if (status) throw new Error('Source checkout has uncommitted changes. Refusing to sync.');

  return { head, branch };
}

async function copyDirectory(sourceRoot, destinationRoot, relativePath, apply) {
  const source = path.join(sourceRoot, relativePath);
  const destination = path.join(destinationRoot, relativePath);
  if (!(await exists(source))) return { relativePath, skipped: true };

  if (!apply) return { relativePath, skipped: false, dryRun: true };

  await rm(destination, { recursive: true, force: true });
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, force: true });
  return { relativePath, skipped: false, dryRun: false };
}

async function snapshotAndroidOverlays(destinationRoot, temporaryRoot, apply) {
  const snapshots = [];
  for (const relativePath of ANDROID_OVERLAY_PATHS) {
    const source = path.join(destinationRoot, relativePath);
    if (!(await exists(source))) continue;
    snapshots.push(relativePath);
    if (!apply) continue;

    const destination = path.join(temporaryRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await cp(source, destination, { recursive: true, force: true });
  }
  return snapshots;
}

async function restoreAndroidOverlays(destinationRoot, temporaryRoot, snapshots, apply) {
  if (!apply) return;
  for (const relativePath of snapshots) {
    const source = path.join(temporaryRoot, relativePath);
    const destination = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await rm(destination, { recursive: true, force: true });
    await cp(source, destination, { recursive: true, force: true });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.source) {
    console.log('Usage: node scripts/sync-native-source.mjs --source <path-to-unfiltr-native> [--apply]');
    process.exit(args.help ? 0 : 2);
  }

  const destinationRoot = process.cwd();
  const sourceRoot = path.resolve(args.source);
  const sourceState = await assertSourceCheckout(sourceRoot);

  const destinationBranch = git(destinationRoot, 'branch', '--show-current');
  if (destinationBranch !== 'android/sync-ios-repair') {
    throw new Error(`Run only on android/sync-ios-repair; found ${destinationBranch || '(detached)'}`);
  }
  if (git(destinationRoot, 'status', '--porcelain')) {
    throw new Error('Android checkout has uncommitted changes. Refusing to sync.');
  }

  const temporaryRoot = path.join(destinationRoot, '.sync-native-overlay-backup');
  await rm(temporaryRoot, { recursive: true, force: true });
  const preservedAndroidOverlays = await snapshotAndroidOverlays(
    destinationRoot,
    temporaryRoot,
    args.apply,
  );

  const results = [];
  try {
    for (const relativePath of [...COPY_PATHS, ...OPTIONAL_COPY_PATHS]) {
      results.push(await copyDirectory(sourceRoot, destinationRoot, relativePath, args.apply));
    }
    await restoreAndroidOverlays(
      destinationRoot,
      temporaryRoot,
      preservedAndroidOverlays,
      args.apply,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  const report = {
    mode: args.apply ? 'apply' : 'dry-run',
    sourceRoot,
    sourceBranch: sourceState.branch,
    sourceHead: sourceState.head,
    requiredSourceSha: REQUIRED_SOURCE_SHA,
    destinationBranch,
    copied: results.filter((item) => !item.skipped).map((item) => item.relativePath),
    absentOptionalPaths: results.filter((item) => item.skipped).map((item) => item.relativePath),
    preservedAndroidFiles: [
      'app.json',
      'eas.json',
      'google-services.json',
      'package.json',
      '.github/workflows',
      ...preservedAndroidOverlays,
    ],
  };

  await mkdir(path.join(destinationRoot, 'scratchpad'), { recursive: true });
  if (args.apply) {
    await readFile(path.join(destinationRoot, 'package.json'), 'utf8');
  }
  console.log(JSON.stringify(report, null, 2));
  if (!args.apply) console.log('\nDry run only. Re-run with --apply after reviewing the report.');
}

main().catch((error) => {
  console.error(`[sync-native-source] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});