const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Share the repository's pure validation/math modules, not server code or React.
config.watchFolders = [path.resolve(__dirname, "..")];
module.exports = config;
