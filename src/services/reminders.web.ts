import type { MobileState } from '../model';
export async function requestReminders(): Promise<void> {
  throw new Error('本地提醒请在 iOS / Android App 中开启。');
}
export async function syncReminders(_state: MobileState): Promise<void> {}

export async function notifyNotice(_notice: import('../shared/notices').Notice, _owner?: string) {}

export const listenReminderClicks = (_onClick: (data: Record<string, unknown>) => void) => () => {};
