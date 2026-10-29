import React, {useMemo} from 'react';
import {RichText} from './RichText';
import {markdownHtml} from '../services/rich-content';

export function Markdown({children}: { children: string }) {
    const html = useMemo(() => markdownHtml(children), [children]);
    return <RichText html={html}/>;
}
