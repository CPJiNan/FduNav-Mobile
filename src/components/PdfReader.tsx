import React, {useSyncExternalStore} from 'react';
import {View} from 'react-native';
import {WebView} from 'react-native-webview';
import {finishPdf, pdfDocument, pdfSnapshot, subscribePdf} from '../services/pdf-reader';

export function PdfReader() {
    const job = useSyncExternalStore(subscribePdf, pdfSnapshot, pdfSnapshot);
    return job ? (
        <View pointerEvents="none" style={{position: 'absolute', width: 1, height: 1, opacity: 0}}>
            <WebView
                key={job.id}
                source={{html: pdfDocument(job)}}
                originWhitelist={['about:blank']}
                onShouldStartLoadWithRequest={(r) => r.url === 'about:blank'}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.id === job.id) finishPdf(job.id, data.text);
                    } catch {
                        finishPdf(job.id);
                    }
                }}
                onError={() => finishPdf(job.id)}
                javaScriptEnabled
            />
        </View>
    ) : null;
}
