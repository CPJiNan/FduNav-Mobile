import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import type { TabName } from './model';
export type TabsParamList = Record<Exclude<TabName, 'Calendar'>, undefined> & {
  Calendar:
    | { view?: import('./shared/calendar').CalendarView; date?: string; courseKey?: string }
    | undefined;
};
export type RootParamList = {
  Setup: undefined;
  Main: NavigatorScreenParams<TabsParamList>;
  Settings: { section?: string } | undefined;
  Notice: { key: string };
  TodoEditor: { id?: string; title?: string } | undefined;
  EventEditor: { id?: string; date?: string; title?: string; startMinute?: number } | undefined;
  Campus: { url: string; title: string };
};
export const useNav = () => useNavigation<NativeStackNavigationProp<RootParamList>>();
export type ScreenProps<T extends keyof RootParamList> = NativeStackScreenProps<RootParamList, T>;
