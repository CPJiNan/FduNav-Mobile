import type {NoticeDetail} from '../shared/notices';
import {extractPdfText} from './pdf-reader';
import {fetchNoticeBinary} from './notice-assets';

export async function readNoticePdfs(detail: NoticeDetail, referer?: string): Promise<NoticeDetail> {
    const contents = [detail.content];
    const attachments = detail.attachments.filter((attachment) =>
        !/\.(?:docx?|xlsx?|pptx?|zip|rar|7z|jpe?g|png|gif)(?:$|[?#])/i.test(attachment.name + '?' + attachment.url),
    );
    if (!attachments.length) return detail;
    let failed = attachments.length > 3;
    const deadline = Date.now() + 25000;
    for (const attachment of attachments.slice(0, 3)) {
        if (Date.now() > deadline) {
            failed = true;
            break;
        }
        try {
            const {bytes} = await fetchNoticeBinary(attachment.url, referer);
            if (!new TextDecoder().decode(bytes.subarray(0, 1024)).includes('%PDF-')) throw new Error();
            const text = await extractPdfText(bytes);
            if (text) contents.push(detail.attachments.length > 1 ? attachment.name + '\n' + text : text);
            else failed = true;
        } catch {
            failed = true;
        }
    }
    return {
        ...detail,
        content: contents.filter(Boolean).join('\n\n'),
        body: [
            ...detail.body,
            ...contents.slice(1).map((text) => ({
                type: 'element' as const,
                tag: 'pre' as const,
                children: [{type: 'text' as const, text}],
            })),
        ],
        ...(failed ? {attachmentError: '部分 PDF 正文未能提取，请打开附件查看。'} : {}),
    };
}
