import type {MessageSource} from './sources';

export interface ParsedNotice {
    url: string;
    title: string;
    published: string;
}

export interface NoticeRef {
    sourceId: string;
    url: string;
}

export interface Notice extends ParsedNotice, NoticeRef {
    sourceName: string;
    read: boolean;
    relevance?: NoticeRelevance | null;
}

export interface NoticeList {
    items: Notice[];
    updatedAt: string | null;
    sources: MessageSource[];
}

export type NoticeBodyTag =
    | 'p'
    | 'div'
    | 'span'
    | 'br'
    | 'hr'
    | 'strong'
    | 'b'
    | 'em'
    | 'i'
    | 'u'
    | 's'
    | 'sub'
    | 'sup'
    | 'ul'
    | 'ol'
    | 'li'
    | 'table'
    | 'thead'
    | 'tbody'
    | 'tfoot'
    | 'tr'
    | 'td'
    | 'th'
    | 'blockquote'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'figure'
    | 'figcaption'
    | 'pre';

export type NoticeBodyNode =
    | { type: 'text'; text: string }
    | { type: 'image'; url: string; alt: string; width?: number; height?: number }
    | {
    type: 'element';
    tag: NoticeBodyTag;
    children: NoticeBodyNode[];
    align?: 'left' | 'center' | 'right' | 'justify';
    colSpan?: number;
    rowSpan?: number;
};

export interface NoticeDetail {
    content: string;
    body: NoticeBodyNode[];
    imageCount: number;
    requiresLogin: boolean;
    attachments: { name: string; url: string }[];
    attachmentError?: string;
}

export type NoticeRelevance = 'related' | 'maybe';
export type NoticeRelevanceChoice = NoticeRelevance | 'none';

export interface NoticeSummary {
    content: string;
    model: string;
    cached: boolean;
    relevance: NoticeRelevance | null;
}

export interface SummaryTask extends NoticeRef {
    id: string;
    title: string;
    status: 'queued' | 'reading' | 'generating' | 'saving' | 'completed' | 'failed' | 'cancelled';
    error?: string;
}

export function summaryTaskFinished(task: SummaryTask): boolean {
    return task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled';
}
