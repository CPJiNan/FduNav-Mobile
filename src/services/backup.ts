import { defaultToolDescriptions, type ChatToolName } from '../shared/llm-prompts';
import { isNoticeReminderMode, isNoticeRefreshInterval } from '../shared/notification-settings';
import { isCalendarReminderMinutes } from '../shared/calendar-reminders';
import type { MobileState } from '../model';
import { validateTodo } from '../shared/todos';
import { validateCalendarEvent } from '../shared/calendar';
import { validDate, type Timetable } from '../shared/timetable';
import { isSourceId, sourceUrl } from '../shared/sources';
import { validateMessagePreferences } from '../shared/message-preferences';
import type { NoticeBodyNode, NoticeDetail } from '../shared/notices';

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('缓存格式无效。');
  return Object.fromEntries(
    Object.entries(value).map(([key, text]) => {
      if (typeof text !== 'string') throw new Error('缓存内容无效。');
      return [key, text];
    }),
  );
}
function readDetails(value: unknown): Record<string, NoticeDetail> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('通知正文缓存无效。');
  return Object.fromEntries(
    Object.entries(value)
      .slice(-80)
      .map(([key, raw]) => {
        const detail = raw as NoticeDetail;
        let count = 0;
        function readNodes(nodes: NoticeBodyNode[], depth = 0): NoticeBodyNode[] {
          if (!Array.isArray(nodes) || depth > 64) throw new Error('通知正文结构无效。');
          return nodes.map((node) => {
            if (!node || ++count > 20000) throw new Error('通知正文结构过大。');
            if (node.type === 'text' && typeof node.text === 'string')
              return { type: 'text', text: node.text };
            if (node.type === 'image' && typeof node.alt === 'string')
              return {
                type: 'image',
                url: sourceUrl(node.url),
                alt: node.alt,
                ...(Number.isFinite(node.width) && node.width! > 0
                  ? { width: Math.min(node.width!, 8000) }
                  : {}),
                ...(Number.isFinite(node.height) && node.height! > 0
                  ? { height: Math.min(node.height!, 8000) }
                  : {}),
              };
            if (node.type === 'element' && typeof node.tag === 'string')
              return {
                type: 'element',
                tag: node.tag,
                ...(['left', 'center', 'right', 'justify'].includes(node.align || '')
                  ? { align: node.align }
                  : {}),
                ...(Number.isInteger(node.colSpan) && node.colSpan! > 0
                  ? { colSpan: Math.min(node.colSpan!, 100) }
                  : {}),
                ...(Number.isInteger(node.rowSpan) && node.rowSpan! > 0
                  ? { rowSpan: Math.min(node.rowSpan!, 100) }
                  : {}),
                children: readNodes(node.children, depth + 1),
              };
            throw new Error('通知正文节点无效。');
          });
        }
        if (!detail || typeof detail.content !== 'string' || !Array.isArray(detail.attachments))
          throw new Error('通知正文缓存无效。');
        return [
          key,
          {
            content: detail.content,
            ...(typeof detail.attachmentError === 'string'
              ? { attachmentError: detail.attachmentError }
              : {}),
            body: readNodes(detail.body),
            imageCount: Number(detail.imageCount) || 0,
            requiresLogin: detail.requiresLogin === true,
            attachments: detail.attachments.map((a) => {
              if (!a || typeof a.name !== 'string') throw new Error('通知附件无效。');
              return { name: a.name, url: sourceUrl(a.url) };
            }),
          },
        ];
      }),
  );
}

export function validateTimetable(value: unknown): Timetable {
  const t = value as Timetable;
  if (
    !t ||
    !['undergraduate', 'postgraduate'].includes(t.kind) ||
    (t.startDate !== null && !validDate(t.startDate)) ||
    (t.startDate !== null && new Date(`${t.startDate}T00:00:00Z`).getUTCDay() !== 0) ||
    !Array.isArray(t.courses) ||
    t.courses.length > 500 ||
    typeof t.semesterId !== 'string' ||
    !Array.isArray(t.semesters) ||
    typeof t.updatedAt !== 'string'
  )
    throw new Error('课表格式无效；学期起始日期需为第一周的周日。');
  for (const c of t.courses) {
    if (
      !c ||
      typeof c.id !== 'string' ||
      typeof c.name !== 'string' ||
      !c.name.trim() ||
      typeof c.room !== 'string' ||
      !Array.isArray(c.teachers) ||
      !c.teachers.every((x) => typeof x === 'string') ||
      !Number.isInteger(c.weekday) ||
      c.weekday < 1 ||
      c.weekday > 7 ||
      !Number.isInteger(c.startUnit) ||
      c.startUnit < 1 ||
      !Number.isInteger(c.endUnit) ||
      c.endUnit < c.startUnit ||
      c.endUnit > 15 ||
      !Array.isArray(c.weeks) ||
      !c.weeks.every((w) => Number.isInteger(w) && w >= 1 && w <= 60)
    )
      throw new Error('课表中的课程、节次或周次无效。');
  }
  return {
    kind: t.kind,
    startDate: t.startDate,
    semesterId: t.semesterId,
    semesters: t.semesters.filter(
      (s) => s && typeof s.id === 'string' && typeof s.name === 'string',
    ),
    updatedAt: t.updatedAt,
    courses: t.courses.map((c) => ({
      id: c.id,
      name: c.name,
      room: c.room,
      teachers: c.teachers,
      weekday: c.weekday,
      startUnit: c.startUnit,
      endUnit: c.endUnit,
      weeks: [...new Set(c.weeks)],
      lessonId: typeof c.lessonId === 'string' ? c.lessonId : undefined,
    })),
  };
}

export function readState(value: unknown): MobileState {
  const input = value as MobileState;
  const record = (value: unknown) => !!value && typeof value === 'object' && !Array.isArray(value);
  if (
    !input ||
    input.version !== 1 ||
    !record(input.settings) ||
    !Array.isArray(input.todos) ||
    !Array.isArray(input.events) ||
    !Array.isArray(input.sourceIds) ||
    !Array.isArray(input.sourceOrder) ||
    !Array.isArray(input.notices) ||
    !record(input.details) ||
    !record(input.summaries) ||
    !record(input.sourceErrors) ||
    !record(input.chatConversations) ||
    !record(input.summaryMeta) ||
    !record(input.relevanceChoices) ||
    (input.dataUsername !== undefined && typeof input.dataUsername !== 'string') ||
    (input.refreshedAt !== null &&
      (typeof input.refreshedAt !== 'string' || !Number.isFinite(Date.parse(input.refreshedAt)))) ||
    (input.timetable !== null && !record(input.timetable))
  )
    throw new Error('无法读取数据格式，原始数据仍保留在设备上。');
  if (
    input.todos.length > 10000 ||
    input.events.length > 10000 ||
    new Set(input.todos.map((t) => t?.id)).size !== input.todos.length ||
    new Set(input.events.map((e) => e?.id)).size !== input.events.length
  )
    throw new Error('待办或日程过多，或编号重复。');
  const settings = input.settings;
  const llm = settings.llm;
  const notices = settings.noticeSettings;
  if (
    !['auto', 'light', 'dark'].includes(settings.theme) ||
    typeof settings.name !== 'string' ||
    typeof settings.notifications !== 'boolean' ||
    !record(settings.accountPreferences) ||
    (settings.preferencesUsername !== undefined &&
      typeof settings.preferencesUsername !== 'string') ||
    !Array.isArray(settings.widgets) ||
    !settings.widgets.every((w) => ['agenda', 'todos', 'news', 'card', 'library'].includes(w)) ||
    !record(notices) ||
    !isCalendarReminderMinutes(notices.calendarDefaultReminder) ||
    !isCalendarReminderMinutes(notices.todoDefaultReminder) ||
    !isNoticeReminderMode(notices.reminderMode) ||
    !isNoticeRefreshInterval(notices.refreshInterval) ||
    typeof notices.autoSummary !== 'boolean' ||
    !record(llm) ||
    typeof llm.baseUrl !== 'string' ||
    typeof llm.model !== 'string' ||
    typeof llm.enabled !== 'boolean' ||
    typeof llm.hasApiKey !== 'boolean' ||
    !['summaryPrompt', 'chatPrompt', 'connectionTestPrompt'].every((key) => {
      const text = llm[key as 'summaryPrompt' | 'chatPrompt' | 'connectionTestPrompt'];
      return typeof text === 'string' && !!text.trim() && text.length <= 8000;
    }) ||
    !record(llm.toolDescriptions) ||
    !(Object.keys(defaultToolDescriptions) as ChatToolName[]).every((key) => {
      const text = llm.toolDescriptions[key];
      return typeof text === 'string' && !!text.trim() && text.length <= 2000;
    })
  )
    throw new Error('设置数据校验失败。');
  const preferences = validateMessagePreferences(settings.preferences);
  if (!preferences.ok) throw new Error(preferences.error);
  return {
    version: 1,
    dataUsername: input.dataUsername,
    sourceOrder: [...new Set(input.sourceOrder.filter(isSourceId))],
    sourceIds: [...new Set(input.sourceIds.filter(isSourceId))],
    todos: input.todos.map((t) => {
      const result = validateTodo(t);
      if (
        !result.ok ||
        typeof t.id !== 'string' ||
        !t.id ||
        typeof t.createdAt !== 'string' ||
        typeof t.updatedAt !== 'string'
      )
        throw new Error('待办数据校验失败。');
      return { ...result.data, id: t.id, createdAt: t.createdAt, updatedAt: t.updatedAt };
    }),
    events: input.events.map((e) => {
      const result = validateCalendarEvent(e);
      if (!result.ok || typeof e.id !== 'string' || !e.id) throw new Error('日程数据校验失败。');
      return { ...result.data, id: e.id };
    }),
    details: readDetails(input.details),
    summaries: stringRecord(input.summaries),
    sourceErrors: stringRecord(input.sourceErrors),
    refreshedAt: input.refreshedAt,
    timetable: input.timetable === null ? null : validateTimetable(input.timetable),
    notices: input.notices
      .filter((n) => {
        try {
          return (
            isSourceId(n.sourceId) &&
            typeof n.title === 'string' &&
            typeof n.sourceName === 'string' &&
            typeof n.published === 'string' &&
            sourceUrl(n.url) === n.url
          );
        } catch {
          return false;
        }
      })
      .slice(0, 2000)
      .map((n) => ({
        sourceId: n.sourceId,
        sourceName: n.sourceName,
        title: n.title,
        published: n.published,
        url: n.url,
        read: n.read === true,
        relevance: n.relevance === 'related' || n.relevance === 'maybe' ? n.relevance : null,
      })),
    chatConversations: Object.fromEntries(
      Object.entries(stringRecord(input.chatConversations)).filter(([, v]) => v.length <= 500000),
    ),
    summaryMeta: Object.fromEntries(
      Object.entries(input.summaryMeta)
        .filter(([, v]) => v && typeof v.context === 'string' && typeof v.model === 'string')
        .map(([k, v]) => [k, { context: v.context, model: v.model }]),
    ),
    relevanceChoices: Object.fromEntries(
      Object.entries(input.relevanceChoices).filter(([, v]) =>
        ['related', 'maybe', 'none'].includes(v),
      ),
    ) as MobileState['relevanceChoices'],
    settings: {
      name: settings.name.slice(0, 24),
      theme: settings.theme,
      preferences: preferences.data,
      preferencesUsername: settings.preferencesUsername?.slice(0, 128),
      accountPreferences: Object.fromEntries(
        Object.entries(settings.accountPreferences).map(([username, value]) => {
          const checked = validateMessagePreferences(value);
          if (!checked.ok || username.length > 128) throw new Error('设置数据校验失败。');
          return [username, checked.data];
        }),
      ),
      notifications: settings.notifications,
      widgets: [...new Set(settings.widgets)],
      noticeSettings: {
        calendarDefaultReminder: notices.calendarDefaultReminder,
        todoDefaultReminder: notices.todoDefaultReminder,
        reminderMode: notices.reminderMode,
        refreshInterval: notices.refreshInterval,
        autoSummary: notices.autoSummary,
      },
      llm: {
        enabled: llm.enabled,
        hasApiKey: llm.hasApiKey,
        baseUrl: llm.baseUrl,
        model: llm.model,
        summaryPrompt: llm.summaryPrompt,
        chatPrompt: llm.chatPrompt,
        connectionTestPrompt: llm.connectionTestPrompt,
        toolDescriptions: Object.fromEntries(
          (Object.keys(defaultToolDescriptions) as ChatToolName[]).map((key) => [
            key,
            llm.toolDescriptions[key],
          ]),
        ) as typeof llm.toolDescriptions,
      },
    },
  };
}

export function parseBackup(text: string) {
  if (text.length > 10_000_000) throw new Error('备份文件过大。');
  return readState(JSON.parse(text));
}
