const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Share pure validation/math modules. Resolve their dependencies from the app too.
config.watchFolders = [path.resolve(__dirname, "..")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
module.exports = config;
