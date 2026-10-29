import tokens from '../design/desktop-tokens.json';
import { richTextCss } from '../design/rich-text-css';
export function richStyles(dark: boolean) {
  return (
    ':root{' +
    Object.entries(tokens)
      .map(([key, value]) => '--' + key + ':' + value[dark ? 'dark' : 'light'] + ';')
      .join('') +
    '}*{box-sizing:border-box}body{margin:0;background:transparent;color:var(--color-text-primary);font-family:var(--font-family-sans);font-size:14px;line-height:1.6}.fdunav-rich-root p{margin:0}.fdunav-rich-root button{color:var(--color-accent);background:transparent;border:0;min-height:44px;padding:8px;font:inherit}' +
    richTextCss
  );
}
export function richDocument(html: string, dark: boolean, kind: string) {
  return (
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;;img-src data:;style-src &apos;unsafe-inline&apos;;script-src &apos;unsafe-inline&apos;"><style>' +
    richStyles(dark) +
    '</style></head><body><div id="content" class="fdunav-rich-root ' +
    (kind === 'notice' ? 'notice-body notice-body--rich' : 'chat-markdown') +
    '">' +
    html +
    '</div><script>const send=d=>window.ReactNativeWebView.postMessage(JSON.stringify(d));new ResizeObserver(()=>send({type:"height",value:document.getElementById("content").getBoundingClientRect().height+2})).observe(document.getElementById("content"));document.addEventListener("click",e=>{const button=e.target.closest("[data-retry]");if(button)send({type:"retry",url:button.dataset.retry});});</script></body></html>'
  );
}
