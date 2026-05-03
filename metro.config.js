const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const defaultConfig = getDefaultConfig(__dirname);

// Node.js built-ins that must be shimmed for React Native / Hermes
const NODE_SHIMS = {
  crypto: path.resolve(__dirname, 'shims/crypto.js'),
  url:    path.resolve(__dirname, 'shims/url.js'),
  stream: require.resolve('stream-browserify'),
  http:   path.resolve(__dirname, 'shims/empty.js'),
  https:  path.resolve(__dirname, 'shims/empty.js'),
  http2:  path.resolve(__dirname, 'shims/empty.js'),
  zlib:   path.resolve(__dirname, 'shims/empty.js'),
  net:    path.resolve(__dirname, 'shims/empty.js'),
  tls:    path.resolve(__dirname, 'shims/empty.js'),
  fs:     path.resolve(__dirname, 'shims/empty.js'),
  os:     path.resolve(__dirname, 'shims/empty.js'),
  path:   path.resolve(__dirname, 'shims/empty.js'),
  child_process: path.resolve(__dirname, 'shims/empty.js'),
};


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
    unstable_enablePackageExports: true,
    assetExts: [...defaultConfig.resolver.assetExts, 'json'],
    sourceExts: [...defaultConfig.resolver.sourceExts, 'ts', 'tsx'],
    extraNodeModules: {
      ...NODE_SHIMS,
    },
    resolveRequest: (context, moduleName, platform) => {
      // Shim Node.js built-ins wherever they appear
      if (NODE_SHIMS[moduleName]) {
        return { filePath: NODE_SHIMS[moduleName], type: 'sourceFile' };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
