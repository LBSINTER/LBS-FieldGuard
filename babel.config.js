module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: {
          '@scanner': './src/scanner',
          '@network': './src/network',
          '@probe': './src/probe',
          '@android': './src/android',
          '@ss7': './src/ss7',
          '@ui': './src/ui',
          '@store': './src/store',
          '@types': './src/types',
          '@utils': './src/utils',
        },
      },
    ],
  ],
};
