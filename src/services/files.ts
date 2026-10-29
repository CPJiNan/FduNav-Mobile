import {Platform} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import {File, Paths} from 'expo-file-system';

export async function pickJson(): Promise<string | null> {
    const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain'],
        copyToCacheDirectory: true,
        multiple: false,
    });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (asset.size && asset.size > 10_000_000) throw new Error('文件不能超过 10 MB。');
    const text =
        Platform.OS === 'web'
            ? await (await fetch(asset.uri)).text()
            : await new File(asset.uri).text();
    if (text.length > 10_000_000) throw new Error('文件不能超过 10 MB。');
    return text;
}

export async function exportJson(name: string, value: unknown) {
    const text = JSON.stringify(value, null, 2);
    if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
    }
    const file = new File(Paths.cache, name);
    file.create({overwrite: true});
    file.write(text);
    if (!(await Sharing.isAvailableAsync())) throw new Error('此设备不支持文件分享。');
    await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        UTI: 'public.json',
        dialogTitle: '保存 FduNav 备份',
    });
}
