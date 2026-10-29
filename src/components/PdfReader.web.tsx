import React, {useEffect, useRef, useSyncExternalStore} from 'react';
import {finishPdf, pdfDocument, pdfSnapshot, subscribePdf} from '../services/pdf-reader';

export function PdfReader() {
    const job = useSyncExternalStore(subscribePdf, pdfSnapshot, pdfSnapshot);
    const frame = useRef<HTMLIFrameElement>(null);
    useEffect(() => {
        const receive = (event: MessageEvent) => {
            if (job && event.source === frame.current?.contentWindow && event.data?.id === job.id)
                finishPdf(job.id, event.data.text);
        };
        window.addEventListener('message', receive);
        return () => window.removeEventListener('message', receive);
    }, [job]);
    return job ? (
        <iframe
            ref={frame}
            title="PDF"
            sandbox="allow-scripts"
            style={{position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none'}}
            srcDoc={pdfDocument(job)}
        />
    ) : null;
}
