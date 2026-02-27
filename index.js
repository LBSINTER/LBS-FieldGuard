/**
 * LBS FieldGuard
 * Entry point — React Native app
 */

// gesture-handler MUST be imported before any navigation code
import 'react-native-gesture-handler';

import { AppRegistry, LogBox } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// Suppress non-fatal warnings that can mask real issues in release
LogBox.ignoreLogs([
  'NativeEventEmitter',
  'new NativeEventEmitter',
  'Require cycle:',
]);

// Global error handler — prevents silent crashes
const originalHandler = ErrorUtils.getGlobalHandler();
ErrorUtils.setGlobalHandler((error, isFatal) => {
  console.error('[FieldGuard] Global error:', error?.message, 'fatal:', isFatal);
  if (originalHandler) originalHandler(error, isFatal);
});

AppRegistry.registerComponent(appName, () => App);
