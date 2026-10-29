import React from 'react';
import {useColors} from '../theme';
import {richStyles} from './rich-document';

export function RichText({
                             html,
                             kind = 'markdown',
                             onRetry,
                         }: {
    html: string;
    kind?: 'notice' | 'markdown';
    onRetry?: (url: string) => void;
}) {
    const colors = useColors();
    return (
        <div
            style={{
                color: colors.text,
                fontSize: 14,
                lineHeight: 1.6,
                overflowWrap: 'anywhere',
                minWidth: 0,
            }}
            onClick={(event) => {
                const target = (event.target as HTMLElement).closest('[data-retry]');
                if (target) onRetry?.(target.getAttribute('data-retry') || '');
            }}
        >
            <style>{richStyles(colors.dark).replace(/body{/g, '.fdunav-rich-root{')}</style>
            <div
                className={
                    'fdunav-rich-root ' +
                    (kind === 'notice' ? 'notice-body notice-body--rich' : 'chat-markdown')
                }
                dangerouslySetInnerHTML={{__html: html}}
            />
        </div>
    );
}
