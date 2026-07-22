// Monorepo-aware Metro config for a pnpm workspace.
// Sabd's workspace packages (@sabd/tokens, @sabd/contracts, @sabd/elo, @sabd/wordbank)
// ship as TypeScript source, so Metro must watch and transpile them from packages/*.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so edits to @sabd/* trigger reloads.
config.watchFolders = [workspaceRoot];

// Add the workspace root as a fallback module path. We deliberately keep Metro's
// *hierarchical* lookup ON: pnpm nests each package's deps under its own node_modules
// (the .pnpm store), and Metro must walk into them to resolve transitive deps like
// @expo/metro-runtime. (Do NOT set disableHierarchicalLookup — that is a hoisted-layout
// optimization and breaks pnpm.)
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// expo-sqlite's web build imports its wa-sqlite `.wasm` worker as an asset; Metro must
// treat `.wasm` as a bundled asset or the web export fails to resolve it.
config.resolver.assetExts.push('wasm');

module.exports = config;
