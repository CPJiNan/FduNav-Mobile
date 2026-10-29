import React, {useSyncExternalStore} from 'react';
import {View} from 'react-native';
import {WebView} from 'react-native-webview';
import {finishPdf, pdfDocument, pdfSnapshot, subscribePdf} from '../services/pdf-reader';

export function PdfReader() {
    const job = useSyncExternalStore(subscribePdf, pdfSnapshot, pdfSnapshot);
    return job ? (
        <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0}}
        >
            <WebView
                key={job.id}
                source={{html: pdfDocument(job)}}
                originWhitelist={['*']}
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
                domStorageEnabled
            />
        </View>
    ) : null;
}
