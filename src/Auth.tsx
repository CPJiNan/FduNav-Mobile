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
import {useStore} from './Store';
import {setupState} from './auth-gate';
import type {AccountState, LoginInput} from './shared/accounts';

type AuthContextValue = {
    account: AccountState;
    ready: boolean;
    busy: boolean;
    needsLogin: boolean;
    needsPreferences: boolean;
    canUseApp: boolean;
    login: (input: LoginInput) => Promise<void>;
    verify: () => Promise<void>;
    logout: () => Promise<void>;
};
const Context = createContext<AuthContextValue | null>(null);

export function AuthProvider({children}: React.PropsWithChildren) {
    const {state, loaded, change, setAccess, prepareAccount, clearError} = useStore();
    const account = useSyncExternalStore(
        accountSession.subscribe,
        accountSession.snapshot,
        accountSession.snapshot,
    );
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
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
                login: (input) => perform(() => accountSession.login(input)),
                verify: () => perform(() => accountSession.verify()),
                logout: async () => {
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
