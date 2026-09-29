module.exports = {
  preset: '@react-native/jest-preset',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@op-engineering|react-native-app-auth|@react-navigation|react-native-screens|react-native-safe-area-context)/)',
  ],
};
