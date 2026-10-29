import { createMobileChat } from './services/chat-adapter';
import { fetchTimetable, fetchExams } from './services/school-services';
import { SummaryService } from './services/summary-service';
import { shouldRemindNotice } from './shared/notification-settings';
import { notifyNotice } from './services/reminders';
import { setLlmEnabled } from './services/llm';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { initialState, mergeNotices, noticeKey, type MobileState } from './model';
import { readState } from './services/backup';
import { fetchSource } from './services/network';
import { syncReminders } from './services/reminders';
import { defaultSources } from './shared/sources';

const STORAGE_KEY = 'fdunav.mobile.v1';
type Change = (update: (previous: MobileState) => MobileState) => Promise<void>;
interface Store {
  state: MobileState;
  loaded: boolean;
  loadError: string;
  error: string;
  clearError: () => void;
  change: Change;
  refreshing: boolean;
  refresh: () => Promise<void>;
  reload: () => Promise<void>;
  setAccess: (username: string | null) => void;
  prepareAccount: (username: string) => Promise<void>;
  summaries: SummaryService;
  chat: ReturnType<typeof createMobileChat>;
  refreshCalendar: (semesterId?: string, exams?: boolean) => Promise<void>;
}
const Context = createContext<Store | null>(null);
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : '操作失败，请重试。';

export function StoreProvider({ children }: React.PropsWithChildren) {
  const [state, setState] = useState(initialState);
  const current = useRef(state);
  const access = useRef<string | null>(null);
  const pendingReminders = useRef(new Map<string, { owner: string; receivedAt: number }>());
  const [activeAccount, setActiveAccount] = useState<string | null>(null);
  const changeRef = useRef<Change>(async () => {
    throw new Error('数据尚未加载，请稍候。');
  });
  const summaryRef = useRef<SummaryService | null>(null);
  if (!summaryRef.current)
    summaryRef.current = new SummaryService(
      () => current.current,
      (update) => changeRef.current(update),
      () => access.current,
    );
  const chatRef = useRef<ReturnType<typeof createMobileChat> | null>(null);
  if (!chatRef.current)
    chatRef.current = createMobileChat(
      () => current.current,
      (update) => changeRef.current(update),
      () => access.current,
      summaryRef.current,
    );
  const [loaded, setLoaded] = useState(false);
  const ready = useRef(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const queue = useRef(Promise.resolve());
  const reminderQueue = useRef(Promise.resolve());
  const sync = useCallback((next: MobileState) => {
    reminderQueue.current = reminderQueue.current
      .catch(() => {})
      .then(() =>
        syncReminders(
          access.current && next.dataUsername === access.current
            ? next
            : { ...next, settings: { ...next.settings, notifications: false } },
        ),
      )
      .catch((e) => setError(errorMessage(e)));
  }, []);
  const setAccess = useCallback(
    (username: string | null) => {
      if (access.current && access.current !== username)
        summaryRef.current!.queue.cancel(
          summaryRef.current!.queue.snapshot(access.current).map((t) => t.id),
          access.current,
        );
      if (access.current !== username) {
        chatRef.current?.dispose();
        pendingReminders.current.clear();
      }
      access.current = username && current.current.dataUsername === username ? username : null;
      setActiveAccount(username);
      sync(current.current);
    },
    [sync],
  );
  const reload = useCallback(async () => {
    setLoadError('');
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const next = raw ? readState(JSON.parse(raw)) : initialState();
      current.current = next;
      setState(next);
      ready.current = true;
      setLoaded(true);
      sync(next);
    } catch (e) {
      setLoadError(errorMessage(e));
    }
  }, [sync]);
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active' && ready.current) sync(current.current);
    });
    return () => listener.remove();
  }, [sync]);
  const change: Change = useCallback(
    (update) => {
      const owner = access.current;
      const operation = queue.current
        .catch(() => {})
        .then(async () => {
          if (!ready.current) throw new Error('数据尚未加载，请稍候。');
          const previous = current.current;
          const next = update(previous);
          const protectedChange =
            next.todos !== previous.todos ||
            next.events !== previous.events ||
            next.timetable !== previous.timetable ||
            next.notices !== previous.notices ||
            next.details !== previous.details ||
            next.chatConversations !== previous.chatConversations ||
            next.summaries !== previous.summaries;
          if (protectedChange && (!owner || owner !== access.current))
            throw new Error('请先登录账号。');
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          current.current = next;
          setState(next);
          if (
            next.todos !== previous.todos ||
            next.events !== previous.events ||
            next.settings.notifications !== previous.settings.notifications
          )
            sync(next);
        });
      queue.current = operation;
      return operation.catch((e) => {
        setError(errorMessage(e));
        throw e;
      });
    },
    [sync],
  );
  const prepareAccount = useCallback((username: string) => {
    const operation = queue.current
      .catch(() => {})
      .then(async () => {
        if (!ready.current) throw new Error('数据尚未加载，请稍候。');
        const previous = current.current;
        if (previous.dataUsername === username) return;
        const privateData = (s: MobileState) => ({
          todos: s.todos,
          events: s.events,
          timetable: s.timetable,
          notices: s.notices,
          details: s.details,
          summaries: s.summaries,
          summaryMeta: s.summaryMeta,
          relevanceChoices: s.relevanceChoices,
          refreshedAt: s.refreshedAt,
        });
        if (previous.dataUsername)
          await AsyncStorage.setItem(
            STORAGE_KEY + '.account.' + encodeURIComponent(previous.dataUsername),
            JSON.stringify(privateData(previous)),
          );
        const raw = await AsyncStorage.getItem(
          STORAGE_KEY + '.account.' + encodeURIComponent(username),
        );
        const data = raw ? JSON.parse(raw) : privateData(initialState());
        const next = readState({ ...previous, ...data, dataUsername: username });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        current.current = next;
        setState(next);
      });
    queue.current = operation;
    return operation;
  }, []);
  function deliverPending() {
    const s = current.current;
    for (const [key, pending] of pendingReminders.current) {
      const notice = s.notices.find((n) => noticeKey(n) === key);
      if (
        pending.owner !== access.current ||
        !notice ||
        notice.read ||
        !s.sourceIds.includes(notice.sourceId as never) ||
        s.settings.noticeSettings.reminderMode === 'off' ||
        Date.now() - pending.receivedAt > 86400000
      ) {
        pendingReminders.current.delete(key);
        continue;
      }
      if (shouldRemindNotice(s.settings.noticeSettings.reminderMode, notice.relevance ?? null)) {
        pendingReminders.current.delete(key);
        void notifyNotice(notice, access.current!).catch(() => {});
      } else if (s.summaryMeta[key] || s.relevanceChoices[key] !== undefined)
        pendingReminders.current.delete(key);
    }
  }
  useEffect(
    () => deliverPending(),
    [
      state.notices,
      state.summaryMeta,
      state.relevanceChoices,
      state.settings.noticeSettings.reminderMode,
      state.sourceIds,
    ],
  );
  const refresh = useCallback(async () => {
    if (!access.current) {
      setError('请先登录账号。');
      return;
    }
    const owner = access.current;
    if (refreshingRef.current || !ready.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      const known = new Set(current.current.notices.map(noticeKey));
      const autoSummary = current.current.settings.noticeSettings.autoSummary;
      const ids = [...current.current.sourceIds];
      if (!ids.length) {
        setError('请先在设置 → 消息来源中选择至少一个来源。');
        return;
      }
      const incoming: MobileState['notices'] = [];
      const failures: Record<string, string> = {};
      for (let start = 0; start < ids.length; start += 4) {
        await Promise.all(
          ids.slice(start, start + 4).map(async (id) => {
            try {
              incoming.push(...(await fetchSource(id)));
            } catch (e) {
              failures[id] = errorMessage(e);
            }
          }),
        );
      }
      if (owner !== access.current) return;
      await change((s) => {
        if (owner !== access.current || s.dataUsername !== owner) return s;
        return {
          ...s,
          notices: mergeNotices(s.notices, incoming),
          sourceErrors: failures,
          refreshedAt: incoming.length ? new Date().toISOString() : s.refreshedAt,
        };
      });
      if (owner !== access.current) return;
      const fresh = incoming.filter((n) => !known.has(noticeKey(n)));
      if (current.current.settings.noticeSettings.reminderMode !== 'off')
        for (const notice of fresh)
          pendingReminders.current.set(noticeKey(notice), { owner, receivedAt: Date.now() });
      if (autoSummary && current.current.settings.noticeSettings.autoSummary)
        summaryRef.current!.enqueueAutomatic(fresh);
      deliverPending();
      if (Object.keys(failures).length)
        setError(
          `${Object.keys(failures).length} 个来源未更新，已保留缓存。${defaultSources.find((s) => s.id === Object.keys(failures)[0])?.name}：${Object.values(failures)[0]}`,
        );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [change]);
  const refreshCalendar = useCallback(
    async (semesterId?: string, exams = true) => {
      const owner = access.current;
      if (!owner) throw new Error('请先登录账号。');
      const preferences = current.current.settings.preferences;
      const check = () => {
        if (
          access.current !== owner ||
          current.current.settings.preferences.educationLevel !== preferences.educationLevel
        )
          throw new Error('账号或消息偏好已变更，请重新获取课表。');
      };
      const results = await Promise.allSettled([
        fetchTimetable(preferences, current.current.timetable, semesterId).then(
          async (timetable) => {
            check();
            await change((s) => {
              check();
              return { ...s, timetable };
            });
          },
        ),
        ...(exams
          ? [
              fetchExams().then(async (events) => {
                check();
                await change((s) => {
                  check();
                  return {
                    ...s,
                    events: [
                      ...s.events,
                      ...events.filter((e) => !s.events.some((old) => old.id === e.id)),
                    ],
                  };
                });
              }),
            ]
          : []),
      ]);
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => errorMessage((r as PromiseRejectedResult).reason));
      if (errors.length) throw new Error([...new Set(errors)].join(' '));
    },
    [change],
  );
  changeRef.current = change;
  useEffect(() => {
    setLlmEnabled(state.settings.llm.enabled);
  }, [state.settings.llm.enabled]);
  useEffect(() => {
    const minutes = state.settings.noticeSettings.refreshInterval;
    if (!activeAccount || !minutes) return;
    const timer = setInterval(() => {
      if (AppState.currentState === 'active' || AppState.currentState === null) void refresh();
    }, minutes * 60000);
    const listener = AppState.addEventListener('change', (value) => {
      if (
        value === 'active' &&
        (!current.current.refreshedAt ||
          Date.now() - Date.parse(current.current.refreshedAt) >= minutes * 60000)
      )
        void refresh();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, [activeAccount, state.settings.noticeSettings.refreshInterval, refresh]);
  return (
    <Context.Provider
      value={{
        state,
        loaded,
        loadError,
        error,
        clearError: () => setError(''),
        change,
        refresh,
        refreshing,
        reload,
        setAccess,
        prepareAccount,
        summaries: summaryRef.current!,
        chat: chatRef.current!,
        refreshCalendar,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error('StoreProvider missing');
  return store;
}
