import React, { useState } from 'react';
import { Modal, Platform, View } from 'react-native';
import { useStore, errorMessage } from '../Store';
import { useColors } from '../theme';
import { Banner, Button, Label, Select, Toggle, styles } from '../ui';
import {
  noticeReminderOptions,
  noticeRefreshOptions,
  type NotificationSettings,
} from '../shared/notification-settings';
import { calendarReminderOptions } from '../shared/calendar-reminders';
import { requestReminders } from '../services/reminders';
export function NotificationSettingsPanel() {
  const { state, change } = useStore();
  const c = useColors();
  const settings = state.settings.noticeSettings;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState(false);
  async function save(patch: Partial<NotificationSettings>) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      if (
        patch.autoSummary &&
        (!state.settings.llm.enabled || !state.settings.llm.model || !state.settings.llm.baseUrl)
      )
        throw new Error('请先在 LLM 设置中配置模型并启用 LLM。');
      const permission =
        (patch.reminderMode && patch.reminderMode !== 'off') ||
        (patch.calendarDefaultReminder !== undefined && patch.calendarDefaultReminder !== -1) ||
        (patch.todoDefaultReminder !== undefined && patch.todoDefaultReminder !== -1);
      if (permission && Platform.OS !== 'web') await requestReminders();
      await change((s) => ({
        ...s,
        settings: {
          ...s.settings,
          noticeSettings: { ...s.settings.noticeSettings, ...patch },
          notifications: permission && Platform.OS !== 'web' ? true : s.settings.notifications,
        },
      }));
      setConfirm(false);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 24 }}>
      <Label size={16} weight="600">
        通知
      </Label>
      <Select
        label="新通知提醒"
        value={settings.reminderMode}
        options={noticeReminderOptions}
        disabled={busy}
        onChange={(reminderMode) => void save({ reminderMode })}
      />
      <Select
        label="自动刷新通知"
        value={settings.refreshInterval}
        options={noticeRefreshOptions}
        disabled={busy}
        onChange={(refreshInterval) => void save({ refreshInterval })}
      />
      <Toggle
        title="自动 AI 摘要"
        value={settings.autoSummary}
        disabled={busy}
        onChange={(enabled) => {
          if (!enabled) void save({ autoSummary: false });
          else {
            setError('');
            setConfirm(true);
          }
        }}
      />
      {(['calendar', 'todo'] as const).map((kind) => (
        <View key={kind} style={{ gap: 12 }}>
          <Label size={16} weight="600">
            {kind === 'calendar' ? '日历' : '待办'}
          </Label>
          <Select
            label="默认提醒时间"
            value={
              kind === 'calendar' ? settings.calendarDefaultReminder : settings.todoDefaultReminder
            }
            options={calendarReminderOptions}
            disabled={busy}
            onChange={(minutes) =>
              void save(
                kind === 'calendar'
                  ? { calendarDefaultReminder: minutes }
                  : { todoDefaultReminder: minutes },
              )
            }
          />
        </View>
      ))}
      {busy && <Label muted>正在保存…</Label>}
      {!!error && !confirm && <Banner message={error} />}
      <Modal
        visible={confirm}
        transparent
        onRequestClose={() => {
          if (!busy) setConfirm(false);
        }}
      >
        <View
          style={{ flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24 }}
        >
          <View style={{ padding: 20, borderRadius: 16, backgroundColor: c.surface, gap: 20 }}>
            <Label weight="600" size={18}>
              开启自动 AI 摘要
            </Label>
            <Label>开启后，将自动为新通知生成 AI 摘要，可能产生 API 费用。确认开启？</Label>
            {!!error && <Banner message={error} />}
            <View style={[styles.row, { justifyContent: 'flex-end' }]}>
              <Button
                title="取消"
                subtle
                disabled={busy}
                onPress={() => {
                  setConfirm(false);
                  setError('');
                }}
              />
              <Button
                title={busy ? '正在开启…' : '确认开启'}
                disabled={busy}
                onPress={() => void save({ autoSummary: true })}
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
