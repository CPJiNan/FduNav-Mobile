import { randomUUID } from 'expo-crypto';
import type { MobileState } from '../model';
import { noticeKey } from '../model';
import type { CalendarEvent } from '../shared/calendar';
import { validateCalendarEvent } from '../shared/calendar';
import type { Todo } from '../shared/todos';
import { validateTodo } from '../shared/todos';
import type { Notice, NoticeRef, NoticeDetail, NoticeSummary } from '../shared/notices';
import type { Timetable } from '../shared/timetable';
import { accountSession } from './auth/runtime';
import { getApiKey } from './secrets';
import { getLlmSignal } from './llm';
import { fetchDetail } from './network';
import type { SummaryService } from './summary-service';
import { createChatEngine } from './chat-engine';
export interface ChatDatabase {
  getCalendarEvents(user: string): CalendarEvent[];
  getTodo(user: string, id: string): Todo | undefined;
  getTodos(user: string): Todo[];
  getMessagePreferences(): MobileState['settings']['preferences'];
  getTimetable(user: string, kind: string): Timetable | null;
  getCalendarDefaultReminder(): number;
  getTodoDefaultReminder(): number;
  getAccount(): { username: string } | null;
  getLlmSettings(): MobileState['settings']['llm'];
  getChatConversation(user: string): string | undefined;
  saveChatConversation(user: string, value: string): void;
}
export interface ChatNotices {
  list(): { items: Notice[] };
  detail(ref: NoticeRef): Promise<NoticeDetail>;
  summarize(ref: NoticeRef): Promise<NoticeSummary>;
}
export interface ChatLlm {
  get(): MobileState['settings']['llm'];
  getRequestSignal(): AbortSignal;
  getConnection(): Promise<{ baseUrl: string; model: string; apiKey: string }>;
}
export interface ChatMutations {
  save(user: string, input: unknown): Promise<CalendarEvent | Todo>;
}
export function createMobileChat(
  state: () => MobileState,
  save: (update: (s: MobileState) => MobileState) => Promise<void>,
  owner: () => string | null,
  summaries: SummaryService,
) {
  const conversations = new Map<string, string>();
  let writes = Promise.resolve();
  let persistenceError: unknown;
  const assert = (user: string) => {
    if (owner() !== user) throw new Error('账号已变化，已停止回复。');
  };
  const db: ChatDatabase = {
    getCalendarEvents: (user) => {
      assert(user);
      return state().events;
    },
    getTodo: (user, id) => {
      assert(user);
      return state().todos.find((t) => t.id === id);
    },
    getTodos: (user) => {
      assert(user);
      return state().todos;
    },
    getMessagePreferences: () => state().settings.preferences,
    getTimetable: (user, kind) => {
      assert(user);
      return state().timetable?.kind === kind ? state().timetable : null;
    },
    getCalendarDefaultReminder: () => state().settings.noticeSettings.calendarDefaultReminder,
    getTodoDefaultReminder: () => state().settings.noticeSettings.todoDefaultReminder,
    getAccount: () => (owner() ? { username: owner()! } : null),
    getLlmSettings: () => state().settings.llm,
    getChatConversation: (user) => {
      assert(user);
      return conversations.get(user) ?? state().chatConversations[user];
    },
    saveChatConversation: (user, value) => {
      conversations.set(user, value);
      writes = writes
        .catch(() => {})
        .then(() =>
          save((s) => ({ ...s, chatConversations: { ...s.chatConversations, [user]: value } })),
        )
        .catch((e) => {
          persistenceError = e;
        });
    },
  };
  const find = (ref: NoticeRef) => {
    const notice = state().notices.find(
      (n) => noticeKey(n) === noticeKey(ref) && state().sourceIds.includes(n.sourceId as never),
    );
    if (!notice) throw new Error('未找到这条通知，请刷新列表。');
    return notice;
  };
  const notices: ChatNotices = {
    list: () => ({
      items: state().notices.filter((n) => state().sourceIds.includes(n.sourceId as never)),
    }),
    detail: (ref) => fetchDetail(find(ref)),
    summarize: (ref) => summaries.summarize(find(ref)),
  };
  const llm: ChatLlm = {
    get: () => state().settings.llm,
    getRequestSignal: () => {
      if (!state().settings.llm.enabled) throw new Error('LLM 已停用，请先启用。');
      return getLlmSignal();
    },
    getConnection: async () => {
      if (!state().settings.llm.enabled) throw new Error('LLM 已停用，请先启用。');
      const { baseUrl, model } = state().settings.llm;
      return { baseUrl, model, apiKey: await getApiKey() };
    },
  };
  const calendar: ChatMutations = {
    save: async (user, input) => {
      assert(user);
      const check = validateCalendarEvent(input);
      if (!check.ok) throw new Error(check.error);
      const event = { ...check.data, id: randomUUID() };
      await save((s) => {
        assert(user);
        return { ...s, events: [...s.events, event] };
      });
      return event;
    },
  };
  const todos: ChatMutations = {
    save: async (user, input) => {
      assert(user);
      const check = validateTodo(input);
      if (!check.ok) throw new Error(check.error);
      const now = new Date().toISOString();
      const todo = { ...check.data, id: randomUUID(), createdAt: now, updatedAt: now };
      await save((s) => {
        assert(user);
        return { ...s, todos: [todo, ...s.todos] };
      });
      return todo;
    },
  };
  const engine = createChatEngine(
    db,
    { getState: () => accountSession.state },
    llm,
    notices,
    calendar,
    todos,
  );
  return {
    ...engine,
    invoke: async (name: string, input?: unknown) => {
      const result = await engine.invoke(name, input);
      await writes;
      if (persistenceError) {
        const error = persistenceError;
        persistenceError = undefined;
        throw error;
      }
      return result;
    },
  };
}
