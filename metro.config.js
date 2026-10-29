const { getDefaultConfig } = require('expo/metro-config');
const { withSchoolProxy } = require('./scripts/metro-school-proxy.cjs');

const config = getDefaultConfig(__dirname);
config.server.enhanceMiddleware = withSchoolProxy(config.server.enhanceMiddleware);
module.exports = config;
