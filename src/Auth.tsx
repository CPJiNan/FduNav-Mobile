import React, {
    createContext,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import {Platform} from 'react-native';
import {requestReminders} from './services/reminders';
import {accountSession} from './services/auth/runtime';
import {errorMessage, useStore} from './Store';
import {emptyMessagePreferences, type MessagePreferences} from './shared/message-preferences';
import {setupState} from './auth-gate';
import type {AccountState, LoginInput} from './shared/accounts';

type AuthContextValue = {
    account: AccountState;
    ready: boolean;
    busy: boolean;
    needsLogin: boolean;
    needsPreferences: boolean;
    canUseApp: boolean;
    preferencesLoading: boolean;
    preferencesError: string;
    reloadPreferences: () => Promise<void>;
    login: (input: LoginInput) => Promise<void>;
    verify: () => Promise<void>;
    logout: () => Promise<void>;
};
const Context = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: React.PropsWithChildren) {
    const {state, loaded, change, setAccess, prepareAccount, clearError} = useStore();
    const current = useRef(state);
    current.current = state;
    const account = useSyncExternalStore(
        accountSession.subscribe,
        accountSession.snapshot,
        accountSession.snapshot,
    );
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [preferencesLoading, setPreferencesLoading] = useState(false);
    const [preferencesError, setPreferencesError] = useState('');
    const working = useRef(false);
    useEffect(() => {
        let active = true;
        void accountSession.initialize().finally(() => {
            if (active) setReady(true);
        });
        return () => {
            active = false;
        };
    }, []);
    const gate = setupState(account, state.settings.preferences, state.settings.preferencesUsername);
    const canUseApp =
        ready && loaded && !busy && gate.canUseApp && state.dataUsername === account.username;
    useLayoutEffect(() => {
        setAccess(canUseApp ? account.username : null);
        return () => setAccess(null);
    }, [canUseApp, account.username, setAccess]);

    async function loadPreferences(username: string) {
        setPreferencesLoading(true);
        setPreferencesError('');
        const settings = current.current.settings;
        const existing =
            settings.preferencesUsername === username
                ? settings.preferences
                : settings.accountPreferences?.[username] || emptyMessagePreferences();
        let preferences: MessagePreferences = existing;
        try {
            preferences = await accountSession.preferences(existing);
        } catch (error) {
            if (accountSession.state.username === username) setPreferencesError(errorMessage(error));
        } finally {
            setPreferencesLoading(false);
        }
        if (accountSession.state.status !== 'signed-in' || accountSession.state.username !== username)
            return;
        await change((s) =>
            accountSession.state.username !== username || accountSession.state.status !== 'signed-in'
                ? s
                : {
                    ...s,
                    settings: {
                        ...s.settings,
                        preferences,
                        preferencesUsername: username,
                        accountPreferences: {...s.settings.accountPreferences, [username]: preferences},
                    },
                },
        );
    }

    async function perform(action: () => Promise<AccountState>) {
        if (working.current) return;
        working.current = true;
        setBusy(true);
        setAccess(null);
        clearError();
        try {
            const result = await action();
            if (result.status === 'signed-in' && result.username) {
                await prepareAccount(result.username);
                await loadPreferences(result.username);
                if (Platform.OS !== 'web') {
                    try {
                        await requestReminders();
                        await change((s) => ({...s, settings: {...s.settings, notifications: true}}));
                    } catch {
                    }
                }
            }
        } finally {
            working.current = false;
            setBusy(false);
        }
    }

    return (
        <Context.Provider
            value={{
                account,
                ready,
                busy,
                ...gate,
                canUseApp,
                preferencesLoading,
                preferencesError,
                reloadPreferences: async () => {
                    if (
                        working.current ||
                        accountSession.state.status !== 'signed-in' ||
                        !accountSession.state.username
                    )
                        return;
                    working.current = true;
                    try {
                        await loadPreferences(accountSession.state.username);
                    } finally {
                        working.current = false;
                    }
                },
                login: (input) => perform(() => accountSession.login(input)),
                verify: () => perform(() => accountSession.verify()),
                logout: async () => {
                    setPreferencesError('');
                    setAccess(null);
                    clearError();
                    await accountSession.logout();
                },
            }}
        >
            {children}
        </Context.Provider>
    );
}

export function useAuth() {
    const value = useContext(Context);
    if (!value) throw new Error('AuthProvider missing');
    return value;
}
