module.exports = {
  plugins: [
    'react-native-reanimated/plugin',
    ['@tamagui/babel-plugin', {
      components: ['tamagui'],
      config: './tamagui.config.ts',
    }],
  ],
};