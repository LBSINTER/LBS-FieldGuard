const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

const config = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'json'],
    sourceExts: [...defaultConfig.resolver.sourceExts, 'ts', 'tsx'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
