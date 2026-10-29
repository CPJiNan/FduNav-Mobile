import forge from 'node-forge';
import {fetch as expoFetch} from 'expo/fetch';
import {accountSession} from './auth/runtime';
import {sourceUrl} from '../shared/sources';

export async function fetchNoticeBinary(value: string, referer?: string) {
    const url = sourceUrl(value);
    if (accountSession.state.status !== 'signed-in') throw new Error('请先登录账号。');
    if (new URL(url).hostname.endsWith('.fudan.edu.cn'))
        return accountSession.readBinary(url, referer);
    const response = await expoFetch(url, {signal: AbortSignal.timeout(25000)});
    sourceUrl(response.url);
    if (!response.ok) throw new Error('来源网站返回 HTTP ' + response.status + '。');
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length > 20 * 1024 * 1024) throw new Error('来源文件过大。');
    return {bytes, type: response.headers.get('content-type') || '', url: response.url};
}

export async function fetchNoticeImage(url: string, referer: string) {
    const {bytes} = await fetchNoticeBinary(url, referer);
    const ascii = (a: number, b: number) => String.fromCharCode(...bytes.subarray(a, b));
    const type =
        bytes.slice(0, 8).every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]) &&
        bytes.length >= 8
            ? 'png'
            : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
                ? 'jpeg'
                : /^GIF8[79]a$/.test(ascii(0, 6))
                    ? 'gif'
                    : ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP'
                        ? 'webp'
                        : ascii(0, 2) === 'BM'
                            ? 'bmp'
                            : null;
    if (!type || bytes.length > 12 * 1024 * 1024) throw new Error('图片格式不支持或文件过大。');
    return 'data:image/' + type + ';base64,' + forge.util.binary.base64.encode(bytes);
}
