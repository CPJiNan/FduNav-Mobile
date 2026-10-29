import React, {useMemo, useState} from 'react';
import {WebView} from 'react-native-webview';
import {useColors} from '../theme';
import {richDocument} from './rich-document';

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
    const [height, setHeight] = useState(24);
    const source = useMemo(
        () => ({html: richDocument(html, colors.dark, kind)}),
        [html, colors.dark, kind],
    );
    return (
        <WebView
            originWhitelist={['about:blank']}
            source={source}
            style={{height, backgroundColor: 'transparent', flex: 0}}
            scrollEnabled={false}
            onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
            onMessage={(event) => {
                try {
                    const data = JSON.parse(event.nativeEvent.data);
                    if (data.type === 'height' && Number.isFinite(data.value))
                        setHeight(Math.max(24, Math.min(200000, data.value)));
                    if (data.type === 'retry' && typeof data.url === 'string') onRetry?.(data.url);
                } catch {
                }
            }}
            javaScriptEnabled
            setSupportMultipleWindows={false}
        />
    );
}
