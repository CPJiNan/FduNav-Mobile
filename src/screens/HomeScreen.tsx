import { fetchCard } from '../services/school-services';
import type { CampusCardBalance } from '../shared/campus-card';
import React, { useEffect, useState } from 'react';
import { PanResponder, Pressable, RefreshControl, View } from 'react-native';
import { useStore } from '../Store';
import { useColors } from '../theme';
import { Button, Icon, IconButton, Label, Page, Section, styles, type IconName } from '../ui';
import { useNav } from '../navigation';
import { calendarOccurrences, localToday, timeLabel } from '../shared/calendar';
import { noticeKey, type Widget } from '../model';
import { fetchLibrary } from '../services/library';
import type { LibraryCrowding } from '../shared/library';
export const widgetNames: Record<Widget, string> = {
  agenda: '今日安排',
  todos: '待办事项',
  news: '通知速览',
  card: '校园卡余额',
  library: '图书馆人数',
};
const widgetIcons: Record<Widget, IconName> = {
  agenda: 'calendar',
  todos: 'todo',
  news: 'notices',
  card: 'card',
  library: 'book',
};
function WidgetFrame({
  children,
  editing,
  name,
  onRemove,
  onMove,
}: React.PropsWithChildren<{
  editing: boolean;
  name: string;
  onRemove: () => void;
  onMove: (delta: number) => void;
}>) {
  const c = useColors();
  const [height, setHeight] = useState(230);
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dy) > 40)
        onMove(Math.sign(g.dy) * Math.max(1, Math.round(Math.abs(g.dy) / (height + 12))));
    },
  });
  return (
    <View
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      style={{
        minHeight: 210,
        padding: 18,
        borderRadius: 22,
        backgroundColor: c.surface,
        borderWidth: 1,
        borderColor: editing
          ? c.control
          : c.dark
            ? 'rgba(255,255,255,0.06)'
            : 'rgba(255,255,255,0.8)',
        borderStyle: editing ? 'dashed' : 'solid',
        boxShadow: c.dark ? '0 6px 24px rgba(0,0,0,0.12)' : '0 6px 24px rgba(29,48,85,0.05)',
      }}
    >
      {editing && (
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View
            {...responder.panHandlers}
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={'拖动排序' + name + '，可使用方向键移动'}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => onMove(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="grip" />
          </View>
          <IconButton name="close" label={'删除' + name} onPress={onRemove} />
        </View>
      )}
      {children}
    </View>
  );
}
export function HomeScreen() {
  const { state, change, refresh, refreshing, refreshCalendar } = useStore();
  const c = useColors();
  const nav = useNav();
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [card, setCard] = useState<CampusCardBalance | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardError, setCardError] = useState('');
  async function loadCard(refresh = false) {
    if (cardBusy) return;
    setCardBusy(true);
    setCardError('');
    try {
      setCard(await fetchCard(refresh));
    } catch (e) {
      setCardError((e as Error).message);
    } finally {
      setCardBusy(false);
    }
  }
  useEffect(() => {
    if (state.settings.widgets.includes('card')) void loadCard();
  }, [state.settings.widgets.includes('card')]);
  const [library, setLibrary] = useState<LibraryCrowding | null>(null);
  const [libBusy, setLibBusy] = useState(false);
  const [libError, setLibError] = useState('');
  const today = localToday();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const agenda = calendarOccurrences(state.timetable, state.events, today, today)
    .filter((o) => !o.allDay && o.startMinute > now.getHours() * 60 + now.getMinutes())
    .slice(0, 3);
  const pending = state.todos
    .filter((t) => !t.completed)
    .sort(
      (a, b) =>
        (a.dueDate || '9999').localeCompare(b.dueDate || '9999') ||
        a.dueTime.localeCompare(b.dueTime),
    );
  const completed = state.todos.length - pending.length;
  const overdue = pending.filter(
    (t) => t.dueDate && new Date(t.dueDate + 'T' + t.dueTime).getTime() < Date.now(),
  ).length;
  const notices = state.notices
    .filter((n) => state.sourceIds.includes(n.sourceId as never))
    .sort(
      (a, b) =>
        Number(!!b.relevance) - Number(!!a.relevance) || b.published.localeCompare(a.published),
    )
    .slice(0, 3);
  async function loadLibrary() {
    setLibBusy(true);
    setLibError('');
    try {
      setLibrary(await fetchLibrary());
    } catch (e) {
      setLibError((e as Error).message);
    } finally {
      setLibBusy(false);
    }
  }
  useEffect(() => {
    if (state.settings.widgets.includes('library')) void loadLibrary();
  }, [state.settings.widgets.includes('library')]);
  function layout(widgets: Widget[]) {
    void change((s) => ({ ...s, settings: { ...s.settings, widgets } })).catch(() => {});
  }
  useEffect(() => {
    if (!state.timetable) void refreshCalendar(undefined, false).catch(() => {});
  }, []);
  const refreshAll = () => {
    void refresh();
    void refreshCalendar().catch(() => {});
    void loadLibrary();
    void loadCard(true);
  };
  const empty = (text: string) => (
    <Label muted size={12} style={{ paddingVertical: 24 }}>
      {text}
    </Label>
  );
  return (
    <Page
      style={{ backgroundColor: c.surface }}
      contentContainerStyle={{ paddingTop: 8, paddingHorizontal: 14, gap: 12 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refreshAll} tintColor={c.accent} />
      }
    >
      <View style={[styles.row, { justifyContent: 'flex-end', gap: 8 }]}>
        {editing ? (
          <>
            <Button title="添加小组件" icon="plus" subtle onPress={() => setPicker(!picker)} />
            <Button
              title="完成"
              subtle
              onPress={() => {
                setEditing(false);
                setPicker(false);
              }}
            />
          </>
        ) : (
          <IconButton name="pencil" label="编辑小组件" onPress={() => setEditing(true)} />
        )}
        <IconButton name="refresh" label="刷新仪表盘" onPress={refreshAll} />
      </View>
      {editing && picker && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(widgetNames) as Widget[]).map((w) => (
            <Button
              key={w}
              title={widgetNames[w]}
              subtle
              disabled={state.settings.widgets.includes(w)}
              onPress={() => layout([...state.settings.widgets, w])}
            />
          ))}
        </View>
      )}
      {!state.settings.widgets.length &&
        empty('暂无小组件，点击' + (editing ? '“添加小组件”' : '“编辑”') + '添加')}
      {state.settings.widgets.map((widget, index) => (
        <WidgetFrame
          key={widget}
          name={widgetNames[widget]}
          editing={editing}
          onRemove={() => layout(state.settings.widgets.filter((w) => w !== widget))}
          onMove={(delta) => {
            const next = [...state.settings.widgets];
            next.splice(index, 1);
            next.splice(Math.max(0, Math.min(next.length, index + delta)), 0, widget);
            layout(next);
          }}
        >
          <Section
            title={widgetNames[widget]}
            disabled={widget === 'card' ? cardBusy : widget === 'library' ? libBusy : false}
            icon={widgetIcons[widget]}
            action={
              widget === 'card'
                ? cardBusy
                  ? '查询中…'
                  : '刷新'
                : widget === 'library'
                  ? libBusy
                    ? '查询中…'
                    : '刷新'
                  : '全部'
            }
            onPress={() => {
              if (widget === 'card') void loadCard(true);
              else if (widget === 'library') void loadLibrary();
              else if (widget === 'agenda')
                nav.navigate('Main', { screen: 'Calendar', params: { view: 'agenda' } });
              else
                nav.navigate('Main', {
                  screen: widget === 'todos' ? 'Todos' : 'Notices',
                });
            }}
          />
          {widget === 'agenda' &&
            (agenda.length
              ? agenda.map((item, i) => (
                  <Pressable
                    key={item.key}
                    onPress={() =>
                      item.event
                        ? nav.navigate('EventEditor', { id: item.event.id })
                        : nav.navigate('Main', { screen: 'Calendar', params: { view: 'agenda' } })
                    }
                    style={{
                      flexDirection: 'row',
                      gap: 14,
                      paddingVertical: 12,
                      borderTopWidth: i ? 1 : 0,
                      borderColor: c.border,
                    }}
                  >
                    <Label size={12} style={{ color: c.accent, width: 42 }}>
                      {timeLabel(item.startMinute)}
                    </Label>
                    <View
                      style={{
                        flex: 1,
                        gap: 3,
                        borderLeftWidth: 3,
                        borderLeftColor: c.accent,
                        paddingLeft: 12,
                      }}
                    >
                      <Label weight="500">{item.title}</Label>
                      <Label muted size={12}>
                        {item.location || (item.course ? '课程' : '日程')}
                      </Label>
                    </View>
                  </Pressable>
                ))
              : empty('暂无安排'))}
          {widget === 'todos' && (
            <>
              <View style={[styles.row, { alignItems: 'baseline', marginTop: 8, gap: 8 }]}>
                <Label size={38} weight="500">
                  {pending.length}
                </Label>
                <Label muted size={12}>
                  项待完成
                </Label>
                {!!overdue && (
                  <Label size={12} style={{ color: c.danger, marginLeft: 'auto' }}>
                    {overdue} 项已逾期
                  </Label>
                )}
              </View>
              <View
                style={{
                  height: 5,
                  borderRadius: 9999,
                  backgroundColor: c.hover,
                  marginTop: 8,
                  overflow: 'hidden',
                  flexDirection: 'row',
                }}
              >
                <View style={{ height: 5, flex: completed, backgroundColor: c.success }} />
                <View style={{ flex: pending.length || (!completed ? 1 : 0) }} />
              </View>
              {pending.length
                ? pending.slice(0, 3).map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => nav.navigate('TodoEditor', { id: t.id })}
                      style={[styles.row, { paddingVertical: 12, gap: 10 }]}
                    >
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          borderWidth: 1,
                          borderColor: c.control,
                          borderRadius: 7,
                        }}
                      />
                      <Label numberOfLines={2} style={{ flex: 1 }}>
                        {t.title}
                      </Label>
                      {!!t.dueDate && (
                        <Label muted size={12}>
                          {t.dueDate === today ? '今天' : t.dueDate.slice(5)}
                        </Label>
                      )}
                    </Pressable>
                  ))
                : empty(completed ? '待办已全部完成' : '暂无待办')}
            </>
          )}
          {widget === 'news' &&
            (notices.length
              ? notices.map((n, i) => (
                  <Pressable
                    key={noticeKey(n)}
                    onPress={() => nav.navigate('Notice', { key: noticeKey(n) })}
                    style={{
                      paddingVertical: 12,
                      gap: 6,
                      borderTopWidth: i ? 1 : 0,
                      borderColor: c.border,
                    }}
                  >
                    <Label muted size={12}>
                      {n.sourceName} · {n.published}
                    </Label>
                    <View style={[styles.row, { gap: 8 }]}>
                      {!n.read && (
                        <View
                          style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.dot }}
                        />
                      )}
                      <Label weight="500" numberOfLines={2} style={{ flex: 1 }}>
                        {n.title}
                      </Label>
                    </View>
                  </Pressable>
                ))
              : empty(refreshing ? '正在读取通知…' : '暂无通知'))}
          {widget === 'card' && (
            <>
              <Label size={38} weight="500" style={{ marginTop: 14 }}>
                {card ? '¥ ' + card.balance : '—'}
              </Label>
              {cardBusy && (
                <Label muted size={12}>
                  正在查询校园卡余额…
                </Label>
              )}
              {card && (
                <Label muted size={12}>
                  上次查询：
                  {new Date(card.updatedAt).toLocaleString('zh-CN', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Label>
              )}
              {!!cardError && (
                <Label size={12} style={{ color: c.danger, marginTop: 10 }}>
                  {cardError}
                </Label>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  nav.navigate('Campus', {
                    title: '校园卡消费记录',
                    url: 'https://ecard.fudan.edu.cn/epay/consume/index',
                  })
                }
                style={{ minHeight: 44, justifyContent: 'center', marginTop: 8 }}
              >
                <Label muted size={12}>
                  查看消费记录
                </Label>
              </Pressable>
            </>
          )}
          {widget === 'library' && (
            <>
              {libBusy && !library ? (
                empty('正在查询在馆人数…')
              ) : library ? (
                <>
                  <View
                    style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 18, marginTop: 12 }}
                  >
                    {library.items.map((item) => (
                      <View key={item.id} style={{ width: '50%', gap: 4 }}>
                        <Label muted size={12}>
                          {item.name}
                        </Label>
                        <View style={[styles.row, { gap: 4, alignItems: 'baseline' }]}>
                          <Label size={26} weight="500">
                            {item.count ?? '—'}
                          </Label>
                          <Label muted size={12}>
                            人
                          </Label>
                        </View>
                      </View>
                    ))}
                  </View>
                  <Label muted size={12} style={{ marginTop: 12 }}>
                    上次查询：{new Date(library.updatedAt).toLocaleString('zh-CN')}
                  </Label>
                </>
              ) : !libError ? (
                empty('暂无图书馆人数数据')
              ) : null}
              {!!libError && (
                <Label size={12} style={{ color: c.danger, marginTop: 10 }}>
                  {libError}
                </Label>
              )}
            </>
          )}
        </WidgetFrame>
      ))}
    </Page>
  );
}
