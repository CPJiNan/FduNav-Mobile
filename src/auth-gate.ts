import type { AccountState } from './shared/accounts';
import {
  validateRequiredMessagePreferences,
  type MessagePreferences,
} from './shared/message-preferences';
export function setupState(
  account: AccountState,
  preferences: MessagePreferences,
  username?: string,
) {
  const needsLogin = account.status !== 'signed-in';
  const needsPreferences =
    !needsLogin &&
    (username !== account.username || !validateRequiredMessagePreferences(preferences).ok);
  return { needsLogin, needsPreferences, canUseApp: !needsLogin && !needsPreferences };
}
export function settingsAllowed(section: string, needsLogin: boolean, needsPreferences: boolean) {
  return needsLogin
    ? section === 'account' || section === 'about'
    : needsPreferences
      ? ['account', 'about', 'preferences'].includes(section)
      : true;
}
