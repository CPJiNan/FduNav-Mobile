import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';

let webKey = '';
export const getApiKey = async () =>
    Platform.OS === 'web' ? webKey : ((await SecureStore.getItemAsync('fdunav.llm.key')) ?? '');

export async function setApiKey(key: string) {
    if (Platform.OS === 'web') {
        webKey = key;
        return;
    }
    if (key)
        await SecureStore.setItemAsync('fdunav.llm.key', key, {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    else await SecureStore.deleteItemAsync('fdunav.llm.key');
}
