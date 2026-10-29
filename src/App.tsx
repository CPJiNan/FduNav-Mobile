import { NotificationNavigation } from './components/NotificationNavigation';
import { PdfReader } from './components/PdfReader';
import { SummaryQueuePanel } from './screens/SummaryQueuePanel';
import { AuthProvider, useAuth } from './Auth';
import { SchoolBrowser } from './SchoolBrowser';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, View, useColorScheme } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { StoreProvider, useStore } from './Store';
import { dark, light, ThemeContext, useColors } from './theme';
import { Banner, Button, Icon, IconButton, Label } from './ui';
import type { RootParamList, TabsParamList } from './navigation';
import { HomeScreen } from './screens/HomeScreen';
import { NoticesScreen, NoticeScreen } from './screens/NoticesScreen';
import { TodosScreen, TodoEditor } from './screens/TodosScreen';
import { CalendarScreen, EventEditor } from './screens/CalendarScreen';
import { ChatScreen } from './screens/ChatScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { CampusScreen } from './screens/CampusScreen';

const Tabs = createBottomTabNavigator<TabsParamList>();
const Stack = createNativeStackNavigator<RootParamList>();
function MainTabs() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: c.text,
        tabBarInactiveTintColor: c.secondary,
        tabBarStyle: {
          backgroundColor: c.sidebar,
          borderTopColor: c.border,
          elevation: 0,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
        },
        tabBarItemStyle: { height: 44 },
        tabBarHideOnKeyboard: true,
      }}
    >
      {(
        [
          ['Home', '仪表盘', 'dashboard', HomeScreen],
          ['Notices', '通知', 'notices', NoticesScreen],
          ['Chat', '聊天', 'chat', ChatScreen],
          ['Calendar', '日历', 'calendar', CalendarScreen],
          ['Todos', '待办', 'todo', TodosScreen],
          ['SettingsTab', '设置', 'settings', SettingsScreen],
        ] as const
      ).map(([name, title, icon, component]) => (
        <Tabs.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title,
            tabBarAccessibilityLabel: title,
            tabBarIcon: ({ color, focused }) => (
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: focused ? c.selected : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Icon name={icon} color={color} />
              </View>
            ),
          }}
        />
      ))}
    </Tabs.Navigator>
  );
}
function Application() {
  const { state, loaded, loadError, error, clearError, reload } = useStore();
  const scheme = useColorScheme();
  const auth = useAuth();
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => listener.remove();
  }, []);
  const c =
    state.settings.theme === 'dark' || (state.settings.theme === 'auto' && scheme === 'dark')
      ? dark
      : light;
  const base = c.dark ? DarkTheme : DefaultTheme;
  return (
    <ThemeContext.Provider value={c}>
      <StatusBar style={c.dark ? 'light' : 'dark'} />
      <SchoolBrowser />
      <PdfReader />
      {!loaded || !auth.ready ? (
        <View
          style={{
            flex: 1,
            backgroundColor: c.canvas,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            gap: 20,
          }}
        >
          <Label size={28} weight="600">
            FduNav
          </Label>
          {loadError ? (
            <>
              <Banner message={loadError} />
              <Button title="重新读取" onPress={() => void reload()} />
            </>
          ) : (
            <ActivityIndicator color={c.accent} />
          )}
        </View>
      ) : (
        <SafeAreaView
          edges={['top', 'left', 'right']}
          style={{ flex: 1, backgroundColor: c.canvas }}
        >
          <NavigationContainer<RootParamList>
            key={(auth.canUseApp ? 'main:' : 'setup:') + (auth.account.username || '')}
            theme={{
              ...base,
              colors: {
                ...base.colors,
                primary: c.accent,
                background: c.canvas,
                card: c.surface,
                text: c.text,
                border: c.border,
                notification: c.dot,
              },
            }}
            linking={
              auth.canUseApp
                ? {
                    prefixes: ['fdunav://'],
                    config: {
                      screens: {
                        Main: {
                          screens: {
                            Home: '',
                            Notices: 'notices',
                            Chat: 'chat',
                            Calendar: 'calendar',
                            Todos: 'todos',
                            SettingsTab: 'settings',
                          },
                        },
                        Settings: 'settings/detail',
                        TodoEditor: 'todo',
                        EventEditor: 'event',
                        Notice: 'notice',
                      },
                    },
                  }
                : undefined
            }
          >
            <Stack.Navigator
              screenOptions={{
                animation: reducedMotion ? 'none' : 'default',
                headerShown: false,
                contentStyle: { backgroundColor: c.canvas },
                headerStyle: { backgroundColor: c.canvas },
                headerTintColor: c.text,
                headerShadowVisible: false,
                headerBackButtonDisplayMode: 'minimal',
              }}
            >
              {!auth.canUseApp ? (
                <Stack.Screen name="Setup" component={SettingsScreen} options={{ title: '设置' }} />
              ) : (
                <>
                  <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
                  <Stack.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{ title: '设置' }}
                  />
                  <Stack.Screen
                    name="Notice"
                    component={NoticeScreen}
                    options={{ title: '通知详情' }}
                  />
                  <Stack.Screen
                    name="TodoEditor"
                    component={TodoEditor}
                    options={{ title: '待办事项' }}
                  />
                  <Stack.Screen
                    name="EventEditor"
                    component={EventEditor}
                    options={{ title: '日程' }}
                  />
                </>
              )}
              <Stack.Screen
                name="Campus"
                component={CampusScreen}
                options={({ route }) => ({ title: route.params.title })}
              />
            </Stack.Navigator>
            {auth.canUseApp && (
              <>
                <SummaryQueuePanel />
                <NotificationNavigation />
              </>
            )}
          </NavigationContainer>
          {error ? (
            <SafeAreaView edges={['bottom']} style={{ paddingHorizontal: 12, paddingTop: 8 }}>
              <Banner message={error} onDismiss={clearError} />
            </SafeAreaView>
          ) : null}
        </SafeAreaView>
      )}
    </ThemeContext.Provider>
  );
}
export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AuthProvider>
          <Application />
        </AuthProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
