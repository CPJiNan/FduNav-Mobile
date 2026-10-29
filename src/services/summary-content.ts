import type {Notice, NoticeRelevance} from '../shared/notices';
import type {ChatMessage} from './llm-connection';
import {
    educationLevelOptions,
    genderOptions,
    identityOptions,
    type MessagePreferences,
} from '../shared/message-preferences';

function normalizeRelevance(value: unknown): NoticeRelevance | null {
    if (value === 'related') return 'related';
    if (value === 'maybe') return 'maybe';
    return null;
}

export function parseSummaryOutput(text: string): {
    content: string;
    relevance: NoticeRelevance | null;
} {
    const cleaned = text
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();
    const object = cleaned.match(/\{[\s\S]*\}/)?.[0];
    const candidates = object && object !== cleaned ? [cleaned, object] : [cleaned];
    for (const candidate of candidates) {
        try {
            const value = JSON.parse(candidate) as Record<string, unknown> | null;
            if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
            if (typeof value.summary !== 'string' || !value.summary.trim()) continue;
            return {content: value.summary.trim(), relevance: normalizeRelevance(value.relevance)};
        } catch {
        }
    }
    throw new Error('模型未返回有效的结构化摘要。');
}

export function summaryMessages(
    notice: Notice,
    content: string,
    preferences: MessagePreferences,
    prompt: string,
): ChatMessage[] {
    return [
        {role: 'system', content: prompt},
        {
            role: 'user',
            content: JSON.stringify({
                messagePreferences: {
                    身份:
                        identityOptions.find((option) => option.value === preferences.identity)?.label ??
                        '未填写',
                    性别:
                        genderOptions.find((option) => option.value === preferences.gender)?.label ?? '未填写',
                    院系: preferences.department || '未填写',
                    学历阶段:
                        educationLevelOptions.find((option) => option.value === preferences.educationLevel)
                            ?.label ?? '未填写',
                    年级: preferences.grade === null ? '未填写' : `${preferences.grade}级`,
                    专业: preferences.major || '未填写',
                    校区: preferences.campus || '未填写',
                },
                notice: {
                    title: notice.title,
                    source: notice.sourceName,
                    published: notice.published,
                    content: content.slice(0, 24_000),
                },
            }),
        },
    ];
}
