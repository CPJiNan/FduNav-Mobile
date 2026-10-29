import {unified} from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type {NoticeBodyNode} from '../shared/notices';

export const escapeHtml = (value: string) =>
    value.replace(
        /[&<>"']/g,
        (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]!,
    );
const processor = unified().use(remarkParse).use(remarkGfm).use(remarkBreaks);

export function markdownHtml(value: string) {
    const tree = processor.runSync(processor.parse(value));

    function render(n: any): string {
        const children = () => n.children?.map(render).join('') || '';
        switch (n.type) {
            case 'text':
                return escapeHtml(n.value);
            case 'break':
                return '<br>';
            case 'paragraph':
                return '<p>' + children() + '</p>';
            case 'heading':
                return '<h' + n.depth + '>' + children() + '</h' + n.depth + '>';
            case 'strong':
                return '<strong>' + children() + '</strong>';
            case 'emphasis':
                return '<em>' + children() + '</em>';
            case 'delete':
                return '<del>' + children() + '</del>';
            case 'inlineCode':
                return '<code>' + escapeHtml(n.value) + '</code>';
            case 'code':
                return '<pre><code>' + escapeHtml(n.value) + '</code></pre>';
            case 'blockquote':
                return '<blockquote>' + children() + '</blockquote>';
            case 'list':
                return (
                    '<' +
                    (n.ordered ? 'ol start="' + (n.start || 1) + '"' : 'ul') +
                    '>' +
                    children() +
                    '</' +
                    (n.ordered ? 'ol' : 'ul') +
                    '>'
                );
            case 'listItem':
                return (
                    '<li>' +
                    (n.checked == null
                        ? ''
                        : '<input type="checkbox" disabled ' + (n.checked ? 'checked' : '') + '>') +
                    children() +
                    '</li>'
                );
            case 'table':
                return (
                    '<div class="notice-table-scroll"><table>' +
                    n.children
                        .map((row: any, index: number) => {
                            const tag = index === 0 ? 'th' : 'td';
                            return (
                                (index === 0 ? '<thead>' : index === 1 ? '<tbody>' : '') +
                                '<tr>' +
                                row.children
                                    .map(
                                        (cell: any, column: number) =>
                                            '<' +
                                            tag +
                                            (n.align?.[column] ? ' style="text-align:' + n.align[column] + '"' : '') +
                                            '>' +
                                            cell.children.map(render).join('') +
                                            '</' +
                                            tag +
                                            '>',
                                    )
                                    .join('') +
                                '</tr>' +
                                (index === 0 ? '</thead>' : '') +
                                (index > 0 && index === n.children.length - 1 ? '</tbody>' : '')
                            );
                        })
                        .join('') +
                    '</table></div>'
                );
            case 'tableRow':
                return '<tr>' + children() + '</tr>';
            case 'tableCell':
                return '<td>' + children() + '</td>';
            case 'thematicBreak':
                return '<hr>';
            case 'image':
            case 'imageReference':
                return escapeHtml(n.alt || '');
            case 'html':
                return escapeHtml(n.value);
            default:
                return children();
        }
    }

    return render(tree);
}

const tags = new Set(
    'p div span br hr strong b em i u s sub sup ul ol li table thead tbody tfoot tr td th blockquote h2 h3 h4 figure figcaption pre'.split(
        ' ',
    ),
);

export function noticeHtml(
    nodes: NoticeBodyNode[],
    images: Record<string, string | false>,
): string {
    return nodes
        .map((n) => {
            if (n.type === 'text') return escapeHtml(n.text);
            if (n.type === 'image') {
                const src = images[n.url];
                return src
                    ? '<img style="max-width:100%;height:auto" src="' +
                    escapeHtml(src) +
                    '" alt="' +
                    escapeHtml(n.alt || '通知图片') +
                    '">'
                    : src === false
                        ? '<span>图片加载失败 <button data-retry="' +
                        escapeHtml(n.url) +
                        '">重试</button></span>'
                        : '<span aria-label="正在加载图片" style="display:block;min-height:80px"></span>';
            }
            if (!tags.has(n.tag)) return noticeHtml(n.children, images);
            const attrs =
                (n.align ? ' style="text-align:' + n.align + '"' : '') +
                (n.colSpan ? ' colspan="' + n.colSpan + '"' : '') +
                (n.rowSpan ? ' rowspan="' + n.rowSpan + '"' : '');
            const html =
                '<' +
                n.tag +
                attrs +
                '>' +
                noticeHtml(n.children, images) +
                (n.tag === 'br' || n.tag === 'hr' ? '' : '</' + n.tag + '>');
            return n.tag === 'table' ? '<div class="notice-table-scroll">' + html + '</div>' : html;
        })
        .join('');
}
