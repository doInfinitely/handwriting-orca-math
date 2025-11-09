// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add .jsonl as an asset extension
config.resolver.assetExts.push('jsonl');

module.exports = config;

