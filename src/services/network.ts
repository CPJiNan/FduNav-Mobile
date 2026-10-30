import {collectSource} from './source-service';
import {readNoticePdfs} from './notice-pdf';
import {accountSession} from './auth/runtime';
import {Platform} from 'react-native';
import type {SourceId} from '../shared/sources';
import {defaultSources} from '../shared/sources';
import type {Notice, NoticeDetail} from '../shared/notices';
import {parseNoticeDetail} from './notice-parser';

export async function fetchHtml(url: string) {
    if (accountSession.state.status !== 'signed-in') throw new Error('请先登录账号。');
    const host = new URL(url).hostname;
    if (host === 'fudan.edu.cn' || host.endsWith('.fudan.edu.cn')) {
        const page = await accountSession.readPage(url);
        return {html: page.text, url: page.url};
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {Accept: 'text/html'},
        });
        if (!response.ok) throw new Error(`网站返回 HTTP ${response.status}`);
        const text = await response.text();
        if (text.length > 4_000_000) throw new Error('页面过大，请在原网站查看。');
        return {html: text, url: response.url || url};
    } catch (error) {
        if (controller.signal.aborted) throw new Error('连接超时，请检查校园网络后重试。');
        if (Platform.OS === 'web')
            throw new Error('浏览器可能限制跨域读取，请在手机 App 中刷新，或打开来源网站。');
        throw error;
    } finally {
        clearTimeout(timeout);
    }
}

export async function fetchSource(id: SourceId): Promise<Notice[]> {
    const source = defaultSources.find((s) => s.id === id)!;
    const {items} = await collectSource(source, async (url) => {
        const page = await fetchHtml(url);
        return {text: page.html, url: page.url};
    });
    return items.map((n) => ({...n, sourceId: id, sourceName: source.name, read: false}));
}

export async function fetchDetail(notice: Notice, onLoaded?: (detail: NoticeDetail) => Promise<void>) {
    const page = await fetchHtml(notice.url);
    const detail = parseNoticeDetail(page.html, page.url, notice.sourceId as SourceId);
    if (!detail) throw new Error('正文暂时无法读取，请打开原文；部分通知需要校园登录。');
    if (onLoaded) await onLoaded(detail);
    return detail.attachments.length ? readNoticePdfs(detail, page.url) : detail;
}
