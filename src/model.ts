import {emptyLlmSettings, type LlmSettings} from './shared/llm';
import type {NotificationSettings} from './shared/notification-settings';
import {emptyMessagePreferences, type MessagePreferences} from './shared/message-preferences';
import {defaultSources, type SourceId} from './shared/sources';
import type {Todo} from './shared/todos';
import type {CalendarEvent} from './shared/calendar';
import type {Notice, NoticeDetail} from './shared/notices';
import type {Timetable} from './shared/timetable';

export type TabName = 'Home' | 'Notices' | 'Chat' | 'Calendar' | 'Todos' | 'SettingsTab';
export type Widget = 'agenda' | 'todos' | 'news' | 'card' | 'library';

export interface MobileState {
    version: 1;
    dataUsername?: string;
    sourceOrder: SourceId[];
    todos: Todo[];
    events: CalendarEvent[];
    timetable: Timetable | null;
    notices: Notice[];
    details: Record<string, NoticeDetail>;
    summaries: Record<string, string>;
    summaryMeta: Record<string, { context: string; model: string }>;
    relevanceChoices: Record<string, import('./shared/notices').NoticeRelevanceChoice>;
    sourceIds: SourceId[];
    sourceErrors: Record<string, string>;
    refreshedAt: string | null;
    chatConversations: Record<string, string>;
    settings: {
        theme: 'auto' | 'light' | 'dark';
        name: string;
        preferences: MessagePreferences;
        preferencesUsername?: string;
        accountPreferences: Record<string, MessagePreferences>;
        widgets: Widget[];
        notifications: boolean;
        llm: LlmSettings;
        noticeSettings: NotificationSettings;
    };
}

export const initialState = (): MobileState => ({
    version: 1,
    dataUsername: undefined,
    sourceOrder: defaultSources.map((s) => s.id),
    todos: [],
    events: [],
    timetable: null,
    notices: [],
    details: {},
    summaries: {},
    summaryMeta: {},
    relevanceChoices: {},
    sourceIds: defaultSources.filter((s) => s.enabled).map((s) => s.id),
    sourceErrors: {},
    refreshedAt: null,
    chatConversations: {},
    settings: {
        theme: 'auto',
        name: '',
        preferences: emptyMessagePreferences(),
        preferencesUsername: undefined,
        accountPreferences: {},
        widgets: ['agenda', 'todos', 'news', 'card', 'library'],
        notifications: false,
        llm: emptyLlmSettings(),
        noticeSettings: {
            calendarDefaultReminder: 30,
            todoDefaultReminder: 120,
            reminderMode: 'all',
            refreshInterval: 0,
            autoSummary: false,
        },
    },
});
export const noticeKey = (notice: Pick<Notice, 'sourceId' | 'url'>) =>
    `${notice.sourceId}:${notice.url}`;

export function mergeNotices(previous: Notice[], incoming: Notice[]) {
    const items = new Map(previous.map((n) => [noticeKey(n), n]));
    for (const notice of incoming) {
        const old = items.get(noticeKey(notice));
        items.set(noticeKey(notice), {
            ...notice,
            read: old?.read ?? false,
            relevance: old?.relevance ?? null,
        });
    }
    return [...items.values()].sort((a, b) => b.published.localeCompare(a.published)).slice(0, 2000);
}
