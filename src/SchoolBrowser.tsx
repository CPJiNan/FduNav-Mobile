import {schoolRenderScript} from './services/auth/render-script';
import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, Modal, useWindowDimensions, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';
import {type BrowserJob, registerSchoolBrowser} from './services/auth/browser-bridge';
import {clearSchoolCookies, collectSchoolCookies, seedSchoolCookies,} from './services/auth/web-cookies';
import {AdditionalAuthenticationRequired, AuthError, isAuthUrl, validateUrl,} from './services/auth/protocol';
import {DialogHeader} from './ui';
import {useColors} from './theme';

export function SchoolBrowser() {
    const c = useColors();
    const {width, height} = useWindowDimensions();
    const [job, setJob] = useState<BrowserJob | null>(null);
    const [ready, setReady] = useState(false);
    const active = useRef<BrowserJob | null>(null);
    const visited = useRef(new Set<string>());
    const finishing = useRef(false);
    const collecting = useRef<number | null>(null);
    useEffect(
        () =>
            registerSchoolBrowser((next) => {
                active.current = next;
                finishing.current = false;
                collecting.current = null;
                visited.current = new Set([
                    next.url,
                    next.target,
                    'https://id.fudan.edu.cn/',
                    'https://uis.fudan.edu.cn/',
                    'https://my.fudan.edu.cn/',
                    'https://jwc.fudan.edu.cn/',
                ]);
                setReady(false);
                setJob(next);
                void seedSchoolCookies(next.jar)
                    .then(() => {
                        if (active.current === next) setReady(true);
                    })
                    .catch(() => {
                        if (active.current === next) finish(new AuthError('无法同步学校登录会话，请重试。'));
                    });
            }),
        [],
    );

    function finish(error?: Error, value?: Parameters<BrowserJob['resolve']>[0]) {
        const current = active.current;
        if (!current || finishing.current) return;
        finishing.current = true;
        active.current = null;
        setJob(null);
        setReady(false);
        void clearSchoolCookies()
            .catch(() => {
            })
            .finally(() => {
                if (error) current.reject(error);
                else current.resolve(value ?? null);
            });
    }

    useEffect(() => {
        if (!job) return;
        const abort = () => finish(new AuthError('已取消学校身份验证。'));
        const timer =
            job.kind === 'page'
                ? undefined
                : setTimeout(
                    () =>
                        job.kind === 'render'
                            ? finish(undefined, null)
                            : finish(new AuthError('学校身份验证超时，请重新登录。')),
                    job.kind === 'render' ? 30000 : 300000,
                );
        job.signal.addEventListener('abort', abort);
        if (job.signal.aborted) abort();
        return () => {
            clearTimeout(timer);
            job.signal.removeEventListener('abort', abort);
        };
    }, [job]);
    useEffect(
        () => () => {
            active.current?.reject(new AuthError('已取消学校身份验证。'));
            active.current = null;
        },
        [],
    );
    if (!job) return null;
    const script = job.kind === 'render' ? schoolRenderScript(job.id, job.url) : 'true;';
    const desktop = job.kind === 'render';
    const web = ready ? (
        <WebView
            source={{uri: job.url}}
            style={{flex: 1, backgroundColor: c.surface}}
            originWhitelist={['https://*.fudan.edu.cn', 'https://fudan.edu.cn']}
            cacheEnabled={job.kind === 'page'}
            userAgent={
                desktop
                    ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
                    : undefined
            }
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            allowsBackForwardNavigationGestures
            javaScriptCanOpenWindowsAutomatically={false}
            injectedJavaScript={script}
            onShouldStartLoadWithRequest={(request) => {
                try {
                    validateUrl(request.url);
                    visited.current.add(request.url);
                    return true;
                } catch {
                    finish(new AuthError('认证跳转到了非 HTTPS 复旦地址，已停止登录。'));
                    return false;
                }
            }}
            onNavigationStateChange={(nav) => {
                try {
                    validateUrl(nav.url);
                    visited.current.add(nav.url);
                    if (active.current?.kind === 'render' && isAuthUrl(nav.url)) {
                        finish(new AdditionalAuthenticationRequired(nav.url, active.current.target));
                    }
                } catch {
                    finish(new AuthError('认证跳转到了非 HTTPS 复旦地址，已停止登录。'));
                }
            }}
            onLoadEnd={(event) => {
                const current = active.current;
                const url = event.nativeEvent.url;
                if (
                    !current ||
                    current.kind !== 'challenge' ||
                    finishing.current ||
                    collecting.current === current.id
                )
                    return;
                try {
                    validateUrl(url);
                    if (!isAuthUrl(url) && new URL(url).origin === new URL(current.target).origin) {
                        collecting.current = current.id;
                        void collectSchoolCookies(current.jar, [...visited.current])
                            .then((jar) => {
                                if (active.current !== current) return;
                                finishing.current = false;
                                finish(undefined, jar);
                            })
                            .catch(() => {
                                if (active.current !== current) return;
                                finishing.current = false;
                                finish(new AuthError('无法同步学校登录会话，请重试。'));
                            });
                    }
                } catch {
                    finish(new AuthError('无法加载学校认证页面，请检查网络后重试。'));
                }
            }}
            onMessage={(event) => {
                const current = active.current;
                if (!current || current.kind !== 'render') return;
                try {
                    if (new URL(event.nativeEvent.url).origin !== new URL(current.target).origin) return;
                    const result = JSON.parse(event.nativeEvent.data);
                    if (
                        result.id === current.id &&
                        new URL(validateUrl(result.url)).origin === new URL(current.target).origin &&
                        typeof result.html === 'string' &&
                        result.html.length <= 4000000
                    )
                        finish(undefined, result.html);
                } catch {
                    finish(undefined, null);
                }
            }}
            onError={() => finish(new AuthError('无法加载学校认证页面，请检查网络后重试。'))}
            onContentProcessDidTerminate={() => finish(new AuthError('认证窗口异常退出，请重试。'))}
        />
    ) : (
        <ActivityIndicator color={c.accent}/>
    );
    return job.kind !== 'render' ? (
        <Modal
            onRequestClose={() =>
                finish(job.kind === 'page' ? undefined : new AuthError('已取消学校身份验证。'))
            }
        >
            <SafeAreaView style={{flex: 1, backgroundColor: c.surface}}>
                <View style={{paddingHorizontal: 16}}>
                    <DialogHeader
                        title={
                            job.kind === 'page'
                                ? job.title || new URL(job.url).hostname
                                : '复旦统一身份认证'
                        }
                        onClose={() => finish(new AuthError('已取消学校身份验证。'))}
                    />
                </View>
                {web}
            </SafeAreaView>
        </Modal>
    ) : (
        <View
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: desktop ? 1100 : width,
                height: desktop ? 820 : height,
                opacity: 0,
                zIndex: -1,
            }}
        >
            {web}
        </View>
    );
}
