import type {MobileState} from '../model';
import {getApiKey} from './secrets';
import {type LlmSettingsInput, validateLlmSettings} from '../shared/llm';
import {completeLlm, type Connection, fetchLlmModels, testLlmConnection} from './llm-connection';

let enabledController = new AbortController();
export const getLlmSignal = () => enabledController.signal;

export function setLlmEnabled(enabled: boolean) {
    if (!enabled) enabledController.abort();
    else if (enabledController.signal.aborted) enabledController = new AbortController();
}

export function completionUrl(baseUrl: string) {
    const url = new URL(baseUrl.trim());
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
        (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
    )
        throw new Error(
            '接口地址须使用 HTTPS；本机服务可使用 HTTP。网址不能包含账号、密码或查询参数。',
        );
    if (/\/(chat\/completions|responses)\/?$/i.test(url.pathname))
        throw new Error('请输入基础接口地址，不要包含 /chat/completions 或 /responses。');
    return url.href.replace(/\/+$/, '') + '/chat/completions';
}

export async function draftConnection(
    saved: MobileState['settings']['llm'],
    input: LlmSettingsInput,
    requireModel = true,
): Promise<Connection> {
    if (!saved.enabled) throw new Error('LLM 已停用，请先启用。');
    const checked = validateLlmSettings(input, requireModel);
    if (!checked.ok) throw new Error(checked.error);
    const value = checked.data;
    const key = await getApiKey();
    if (
        key &&
        !value.apiKey &&
        !value.clearApiKey &&
        (!saved.baseUrl || new URL(saved.baseUrl).origin !== new URL(value.baseUrl).origin)
    )
        throw new Error('更换接口站点时，请重新输入 API Key 或勾选清除已保存的密钥。');
    return {
        baseUrl: value.baseUrl,
        model: value.model,
        apiKey: value.clearApiKey ? '' : value.apiKey || key,
    };
}

export async function complete(
    settings: MobileState['settings']['llm'],
    messages: { role: 'user' | 'assistant'; content: string }[],
    signal?: AbortSignal,
    system = settings.chatPrompt,
) {
    if (!settings.enabled) throw new Error('LLM 已停用，请先启用。');
    if (!settings.baseUrl || !settings.model) throw new Error('请先配置 LLM。');
    completionUrl(settings.baseUrl);
    const connection = {
        baseUrl: settings.baseUrl,
        model: settings.model,
        apiKey: await getApiKey(),
    };
    try {
        return await completeLlm(
            connection,
            [{role: 'system', content: system}, ...messages] as any,
            signal ? AbortSignal.any([enabledController.signal, signal]) : enabledController.signal,
        );
    } finally {
        connection.apiKey = '';
    }
}

export {fetchLlmModels, testLlmConnection};
