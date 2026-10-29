import type {LibraryCrowding} from '../shared/library';

export function parseLibraryCrowding(value: unknown): LibraryCrowding['items'] {
    if (!value || typeof value !== 'object') throw new Error('图书馆返回的数据格式无效。');
    const response = value as Record<string, unknown>;
    if (
        String(response.code) !== '1' ||
        !Array.isArray(response.data) ||
        response.data.length > 100
    ) {
        throw new Error('图书馆人数暂不可用，请稍后重试。');
    }
    const seen = new Set<string>();
    return response.data.map((value) => {
        if (!value || typeof value !== 'object') throw new Error('图书馆返回的数据格式无效。');
        const item = value as Record<string, unknown>;
        const name = typeof item.campusName === 'string' ? item.campusName.trim() : '';
        if (!name || name.length > 100) throw new Error('无法识别图书馆名称，请稍后重试。');
        const id =
            typeof item.campusId === 'string' || typeof item.campusId === 'number'
                ? String(item.campusId)
                : name;
        if (!id || id.length > 100 || seen.has(id)) throw new Error('图书馆返回的数据格式无效。');
        seen.add(id);
        const raw =
            typeof item.inNum === 'string' || typeof item.inNum === 'number'
                ? String(item.inNum).trim()
                : '';
        const count = /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
        return {id, name, count};
    });
}

export async function fetchLibrary(): Promise<LibraryCrowding> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch('https://mlibrary.fudan.edu.cn/api/common/h5/getspaceseat', {
            method: 'POST',
            credentials: 'omit',
            headers: {Accept: 'application/json'},
            signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        return {
            items: parseLibraryCrowding(await response.json()),
            updatedAt: new Date().toISOString(),
        };
    } catch {
        throw new Error('无法获取图书馆人数，请检查网络或稍后刷新重试。');
    } finally {
        clearTimeout(timeout);
    }
}
