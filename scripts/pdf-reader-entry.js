import { getDocument, VerbosityLevel } from 'pdfjs-dist/build/pdf.mjs';
import { WorkerMessageHandler } from 'pdfjs-dist/build/pdf.worker.mjs';
globalThis.pdfjsWorker = { WorkerMessageHandler };
globalThis.readPDF = async (base64) => {
  const data = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const task = getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: VerbosityLevel.ERRORS,
  });
  try {
    const document = await task.promise;
    if (document.numPages > 100) throw new Error('PDF 页数过多。');
    const pages = [];
    let length = 0;
    for (let number = 1; number <= document.numPages; number++) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
        .join('')
        .trim();
      length += text.length;
      if (length > 300000) throw new Error('PDF 正文过长。');
      pages.push(text);
      page.cleanup();
    }
    return pages.join('\n\n').trim();
  } finally {
    await task.destroy();
  }
};
