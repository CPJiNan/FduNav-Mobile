import React, { useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { useStore, errorMessage } from '../Store';
import { useColors } from '../theme';
import {
  Banner,
  Button,
  Chips,
  DateField,
  DialogHeader,
  Empty,
  Field,
  Icon,
  IconButton,
  Label,
  Page,
  Select,
  styles,
} from '../ui';
import { useNav, type ScreenProps } from '../navigation';
import { localToday } from '../shared/calendar';
import { validateTodo, type TodoInput } from '../shared/todos';
import { calendarReminderOptions } from '../shared/calendar-reminders';
export function TodosScreen() {
  const { state, change } = useStore();
  const c = useColors();
  const nav = useNav();
  const [filter, setFilter] = useState('pending');
  const [busyId, setBusyId] = useState('');
  const pending = state.todos.filter((t) => !t.completed).length;
  const items = state.todos
    .filter((t) => filter === 'all' || (filter === 'done' ? t.completed : !t.completed))
    .sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
        a.dueTime.localeCompare(b.dueTime) ||
        b.createdAt.localeCompare(a.createdAt),
    );
  async function toggle(id: string) {
    setBusyId(id);
    try {
      await change((s) => ({
        ...s,
        todos: s.todos.map((t) =>
          t.id === id ? { ...t, completed: !t.completed, updatedAt: new Date().toISOString() } : t,
        ),
      }));
    } catch {
    } finally {
      setBusyId('');
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <FlatList
        data={items}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ padding: 16, width: '100%', maxWidth: 800, alignSelf: 'center' }}
        ListHeaderComponent={
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <View style={[styles.row, { justifyContent: 'space-between', gap: 0 }]}>
              <Chips
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'pending', label: '待完成 ' + pending },
                  { value: 'done', label: '已完成 ' + (state.todos.length - pending) },
                  { value: 'all', label: '全部 ' + state.todos.length },
                ]}
              />
              <IconButton name="plus" label="新增待办" onPress={() => nav.navigate('TodoEditor')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <Empty
            icon="todo"
            title={
              filter === 'done'
                ? '暂无已完成的待办'
                : filter === 'pending'
                  ? '暂无待完成的待办'
                  : '暂无待办'
            }
          />
        }
        renderItem={({ item }) => {
          const overdue =
            !item.completed &&
            !!item.dueDate &&
            new Date(item.dueDate + 'T' + item.dueTime).getTime() < Date.now();
          return (
            <View
              style={[
                styles.row,
                { gap: 8, paddingVertical: 16, borderBottomWidth: 1, borderColor: c.border },
              ]}
            >
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={
                  '标记为' + (item.completed ? '待完成' : '已完成') + '：' + item.title
                }
                accessibilityState={{ checked: item.completed, disabled: !!busyId }}
                disabled={!!busyId}
                onPress={() => void toggle(item.id)}
                style={{ width: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}
              >
                <Icon name="check" color={item.completed ? c.accent : c.muted} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={'编辑待办：' + item.title}
                onPress={() => nav.navigate('TodoEditor', { id: item.id })}
                style={{ flex: 1, minHeight: 44, gap: 4, justifyContent: 'center' }}
              >
                <Label
                  weight="500"
                  style={{
                    textDecorationLine: item.completed ? 'line-through' : 'none',
                    color: item.completed ? c.muted : c.text,
                  }}
                >
                  {item.title}
                </Label>
                {!!item.notes && <Label muted>{item.notes}</Label>}
                {!!item.dueDate && (
                  <View style={[styles.row, { gap: 4, flexWrap: 'wrap' }]}>
                    <Icon name="calendar" size={14} />
                    <Label muted size={12}>
                      {item.dueDate} {item.dueTime}
                    </Label>
                    {(overdue || item.dueDate === localToday()) && (
                      <Label size={12} style={{ color: overdue ? c.danger : c.muted }}>
                        {overdue ? '已逾期' : '今天截止'}
                      </Label>
                    )}
                  </View>
                )}
              </Pressable>
              <IconButton
                name="close"
                label={'删除待办：' + item.title}
                onPress={() =>
                  void change((s) => ({
                    ...s,
                    todos: s.todos.filter((t) => t.id !== item.id),
                  })).catch(() => {})
                }
              />
            </View>
          );
        }}
      />
    </View>
  );
}
export function TodoEditor({ route, navigation }: ScreenProps<'TodoEditor'>) {
  const { state, change } = useStore();
  const existing = state.todos.find((t) => t.id === route.params?.id);
  const [form, setForm] = useState<TodoInput>(
    () =>
      existing ?? {
        title: route.params?.title ?? '',
        notes: '',
        dueDate: '',
        dueTime: '23:59',
        reminderMinutes: state.settings.noticeSettings.todoDefaultReminder,
        completed: false,
      },
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  function patch(update: Partial<TodoInput>) {
    setForm((f) => ({ ...f, ...update }));
    setError('');
  }
  async function save() {
    const result = validateTodo(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBusy(true);
    try {
      const now = new Date().toISOString();
      const todo = {
        ...result.data,
        id: existing?.id ?? Crypto.randomUUID(),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      await change((s) => ({ ...s, todos: [todo, ...s.todos.filter((t) => t.id !== todo.id)] }));
      navigation.goBack();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Page>
        <DialogHeader
          title={existing ? '编辑待办' : '新建待办'}
          onClose={() => navigation.goBack()}
        />
        <Field
          label="名称"
          value={form.title}
          onChangeText={(title) => patch({ title })}
          maxLength={200}
        />
        <DateField
          label="截止日期"
          value={form.dueDate}
          onChange={(dueDate) => patch({ dueDate })}
          optional
        />
        <DateField
          label="截止时间"
          disabled={busy || !form.dueDate}
          value={form.dueTime}
          onChange={(dueTime) => patch({ dueTime })}
          time
        />
        <Select
          label="提醒时间"
          disabled={busy || !form.dueDate}
          value={form.reminderMinutes}
          onChange={(reminderMinutes) => patch({ reminderMinutes })}
          options={calendarReminderOptions}
        />
        <Field
          label="备注"
          value={form.notes}
          onChangeText={(notes) => patch({ notes })}
          multiline
          maxLength={5000}
          style={{ minHeight: 110 }}
        />
        {!!error && <Banner message={error} />}
        <View style={[styles.row, { justifyContent: 'flex-end' }]}>
          <Button title="取消" subtle disabled={busy} onPress={() => navigation.goBack()} />
          <Button title={busy ? '正在保存…' : '保存'} disabled={busy} onPress={() => void save()} />
        </View>
      </Page>
    </KeyboardAvoidingView>
  );
}
