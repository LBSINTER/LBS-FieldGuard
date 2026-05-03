/**
 * LBS FieldGuard — Root Navigator
 * Bottom tab bar with stack sub-navigators per section.
 * Light theme matching lbs-int.com.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import DashboardScreen from './screens/DashboardScreen';
import ScannerScreen from './screens/ScannerScreen';
import PDUBuilderScreen from './screens/PDUBuilderScreen';
import AlertsScreen from './screens/AlertsScreen';
import ProbeScreen from './screens/ProbeScreen';
import PCBridgeScreen from './screens/PCBridgeScreen';
import SettingsScreen from './screens/SettingsScreen';
import SMSDocScreen from './screens/SMSDocScreen';
import CommsRootScreen from './screens/CommsRootScreen';
import Icon from './components/Icon';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function DashStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    </Stack.Navigator>
  );
}

function ScanStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Scanner" component={ScannerScreen} />
    </Stack.Navigator>
  );
}

function PDUStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PDUBuilder" component={PDUBuilderScreen} />
    </Stack.Navigator>
  );
}

function AlertStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Alerts" component={AlertsScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#ffffff', borderTopColor: '#e2e8f0' },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, string> = {
            DashTab:     'pulse',
            ScanTab:     'shield-search',
            PDUTab:      'code-braces',
            AlertsTab:   'alert-circle',
            ProbeTab:    'antenna',
            BridgeTab:   'laptop',
            CommsTab:    'shield-lock',
            SettingsTab: 'cog',
            SMSDocTab:   'book-open-variant',
          };
          return <Icon name={icons[route.name] ?? 'help'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="DashTab"     component={DashStack}     options={{ title: 'Dashboard' }} />
      <Tab.Screen name="ScanTab"     component={ScanStack}     options={{ title: 'Scanner' }} />
      <Tab.Screen name="PDUTab"      component={PDUStack}      options={{ title: 'PDU Builder' }} />
      <Tab.Screen name="AlertsTab"   component={AlertStack}    options={{ title: 'Alerts' }} />
      <Tab.Screen name="ProbeTab"    component={ProbeScreen}      options={{ title: 'Probe' }} />
      <Tab.Screen name="BridgeTab"   component={PCBridgeScreen}   options={{ title: 'PC Bridge' }} />
      <Tab.Screen name="CommsTab"    component={CommsRootScreen}  options={{ title: 'Comms' }} />
      <Tab.Screen name="SMSDocTab"   component={SMSDocScreen}     options={{ title: 'Documentation' }} />
      <Tab.Screen name="SettingsTab" component={SettingsScreen}   options={{ title: 'Settings' }} />
    </Tab.Navigator>
  );
}
