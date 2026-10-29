import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import type { SavedSession, SessionStorage } from './session';
const manifestKey = 'fdunav.auth.session';
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
type Manifest = { id: string; count: number };
function parseManifest(raw: string | null): Manifest | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (
    !/^[a-f0-9-]{36}$/.test(value.id) ||
    !Number.isInteger(value.count) ||
    value.count < 1 ||
    value.count > 256
  )
    throw new Error('Invalid session manifest');
  return value;
}
const key = (id: string, index: number) => 'fdunav.auth.' + id + '.' + index;
async function remove(value: Manifest | null) {
  if (value)
    await Promise.all(
      Array.from({ length: value.count }, (_, i) => SecureStore.deleteItemAsync(key(value.id, i))),
    );
}
export const sessionStorage: SessionStorage = {
  available: SecureStore.isAvailableAsync,
  async load() {
    const manifest = parseManifest(await SecureStore.getItemAsync(manifestKey));
    if (!manifest) return null;
    const pieces = await Promise.all(
      Array.from({ length: manifest.count }, (_, i) =>
        SecureStore.getItemAsync(key(manifest.id, i)),
      ),
    );
    if (pieces.some((p) => p === null)) throw new Error('Incomplete session');
    return JSON.parse(pieces.join('')) as SavedSession;
  },
  async save(value) {
    if (!(await SecureStore.isAvailableAsync()))
      throw new Error('系统安全存储不可用，暂时无法安全保存登录会话。');
    const previous = parseManifest(await SecureStore.getItemAsync(manifestKey));
    const text = JSON.stringify(value);
    const next = { id: Crypto.randomUUID(), count: Math.ceil(text.length / 450) };
    if (next.count > 256) throw new Error('无法同步学校登录会话，请重试。');
    try {
      for (let i = 0; i < next.count; i++)
        await SecureStore.setItemAsync(
          key(next.id, i),
          text.slice(i * 450, (i + 1) * 450),
          options,
        );
      await SecureStore.setItemAsync(manifestKey, JSON.stringify(next), options);
    } catch (error) {
      await remove(next).catch(() => {});
      throw error;
    }
    await remove(previous).catch(() => {});
  },
  async clear() {
    const previous = parseManifest(await SecureStore.getItemAsync(manifestKey));
    await SecureStore.deleteItemAsync(manifestKey);
    await remove(previous);
  },
};
