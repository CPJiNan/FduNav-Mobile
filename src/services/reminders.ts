import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { MobileState } from '../model';
import { calendarReminderSchedule } from '../shared/calendar-reminders';
import { todoReminderSchedule } from '../shared/todos';

export async function requestReminders() {
  if (Platform.OS === 'web') throw new Error('本地提醒请在 iOS / Android App 中开启。');
  if (Platform.OS === 'android')
    await Notifications.setNotificationChannelAsync('reminders', {
      name: '日程和待办',
      importance: Notifications.AndroidImportance.HIGH,
    });
  const permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error('尚未获得通知权限，请在系统设置中允许 FduNav 发送通知。');
}

export async function syncReminders(state: MobileState) {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!state.settings.notifications) return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) throw new Error('系统通知权限已关闭，日程仍已保存。');
  const owner = state.dataUsername || '';
  const delivered: Record<string, number> = JSON.parse(
    (await AsyncStorage.getItem('fdunav.reminders.' + encodeURIComponent(owner))) || '{}',
  );
  const reminders = [
    ...state.events.map((e) => ({
      id: e.id,
      title: e.title,
      body:
        e.startDate +
        ' ' +
        (e.allDay ? '全天' : e.startTime) +
        (e.location ? ' · ' + e.location : ''),
      kind: 'event',
      schedule: calendarReminderSchedule(e),
    })),
    ...state.todos.map((t) => ({
      id: t.id,
      title: t.title,
      body: '截止时间：' + t.dueDate + ' ' + t.dueTime,
      kind: 'todo',
      schedule: todoReminderSchedule(t),
    })),
  ]
    .filter(
      (r) =>
        r.schedule &&
        r.schedule.startAt + 60000 > Date.now() &&
        (r.schedule.remindAt > Date.now() || delivered[r.id] !== r.schedule.remindAt),
    )
    .sort((a, b) => a.schedule!.remindAt - b.schedule!.remindAt)
    .slice(0, 60);
  for (const reminder of reminders) {
    await Notifications.scheduleNotificationAsync({
      identifier: reminder.id,
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: true,
        data: { owner, kind: reminder.kind, id: reminder.id },
      },
      trigger:
        reminder.schedule!.remindAt <= Date.now()
          ? null
          : {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: new Date(reminder.schedule!.remindAt),
              channelId: 'reminders',
            },
    });
    delivered[reminder.id] = reminder.schedule!.remindAt;
  }
  await AsyncStorage.setItem(
    'fdunav.reminders.' + encodeURIComponent(owner),
    JSON.stringify(delivered),
  );
}

export async function notifyNotice(notice: import('../shared/notices').Notice, owner?: string) {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  await Notifications.scheduleNotificationAsync({
    content: {
      title: notice.sourceName,
      body: notice.title,
      data: { owner, kind: 'notice', sourceId: notice.sourceId, url: notice.url },
      sound: true,
    },
    trigger: null,
  });
}

export function listenReminderClicks(onClick: (data: Record<string, unknown>) => void) {
  const receive = (r: Notifications.NotificationResponse) =>
    onClick(r.notification.request.content.data || {});
  const sub = Notifications.addNotificationResponseReceivedListener(receive);
  void Notifications.getLastNotificationResponseAsync()
    .then((r) => {
      if (r) receive(r);
    })
    .catch(() => {});
  return () => sub.remove();
}
