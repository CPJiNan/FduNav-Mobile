import type {MessageSource} from '../shared/sources';
import type {ParsedNotice} from '../shared/notices';
import {discoverNoticeLists, parseNoticeDate, parseNotices} from './notice-parser.ts';
import {sourceReadingRules} from './source-reading-rules.ts';

interface SourcePage {
    text: string;
    url: string;
}

type RequestPage = (url: string) => Promise<SourcePage>;

export async function collectSource(
    source: Pick<MessageSource, 'id' | 'url'>,
    requestPage: RequestPage,
) {
    const rule = sourceReadingRules[source.id];
    const page = await requestPage(source.url);
    let error = '';
    const parseList = async (text: string, url: string) => {
        const items = parseNotices(text, url, source.id, !!rule.detailDate);
        return rule.detailDate && items.length
            ? fillMissingDates(items, rule.detailDate, requestPage)
            : items;
    };

    const items = await parseList(page.text, page.url);
    if (items.length) return {items, listUrl: page.url};

    const candidates = discoverNoticeLists(page.text, page.url);
    for (const candidate of candidates) {
        try {
            const list = await requestPage(candidate);
            const parsed = await parseList(list.text, list.url);
            if (parsed.length) return {items: parsed, listUrl: list.url};
        } catch (cause) {
            error = cause instanceof Error ? cause.message : '来源加载失败。';
        }
    }
    throw new Error(error || '未解析到通知，请检查来源网址或改用通知列表页。');
}

async function fillMissingDates(
    items: ParsedNotice[],
    selector: string,
    requestPage: RequestPage,
): Promise<ParsedNotice[]> {
    const pending = items.filter((item) => !item.published);
    await Promise.all(
        Array.from({length: Math.min(4, pending.length)}, async () => {
            while (pending.length) {
                const item = pending.shift()!;
                try {
                    const detail = await requestPage(item.url);
                    item.published = parseNoticeDate(detail.text, selector) ?? '';
                } catch {
                    item.published = '';
                }
            }
        }),
    );
    return items
        .filter((item) => !!item.published)
        .sort(
            (a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title, 'zh-CN'),
        );
}
