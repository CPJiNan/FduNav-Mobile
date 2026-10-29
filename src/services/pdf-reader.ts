import forge from 'node-forge';
import { pdfReaderScript } from '../generated/pdf-reader';
type Job = { id: number; base64: string; resolve: (v: string) => void; reject: (e: Error) => void };
let current: Job | null = null;
let pending = Promise.resolve();
let id = 0;
const listeners = new Set<() => void>();
export const pdfSnapshot = () => current;
export const subscribePdf = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function finishPdf(jobId: number, text?: string) {
  if (current?.id !== jobId) return;
  const job = current;
  current = null;
  for (const listener of listeners) listener();
  if (typeof text === 'string' && text.length <= 300000) job.resolve(text);
  else job.reject(new Error('部分 PDF 正文未能提取，请打开附件查看。'));
}
export function extractPdfText(bytes: Uint8Array): Promise<string> {
  const run = pending
    .catch(() => {})
    .then(
      () =>
        new Promise<string>((resolve, reject) => {
          const jobId = ++id;
          const timer = setTimeout(() => finishPdf(jobId), 30000);
          current = {
            id: jobId,
            base64: forge.util.binary.base64.encode(bytes),
            resolve: (v) => {
              clearTimeout(timer);
              resolve(v);
            },
            reject: (e) => {
              clearTimeout(timer);
              reject(e);
            },
          };
          for (const listener of listeners) listener();
        }),
    );
  pending = run.then(
    () => {},
    () => {},
  );
  return run;
}
export function pdfDocument(job: Job) {
  const script = pdfReaderScript.replace(/<\/script/gi, '<\\/script');
  return (
    '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;;script-src &apos;unsafe-inline&apos;;style-src &apos;unsafe-inline&apos;"></head><body><script>' +
    script +
    '</script><script>const send=text=>{const data={id:' +
    job.id +
    ',text};if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(data));else parent.postMessage(data,"*");};readPDF(' +
    JSON.stringify(job.base64) +
    ').then(send,()=>send(null));</script></body></html>'
  );
}
