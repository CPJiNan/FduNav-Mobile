import React, {useEffect, useRef, useState} from 'react';
import {Pressable, View} from 'react-native';
import {errorMessage, useStore} from '../Store';
import {Banner, Button, Field, IconButton, Label, Select, styles, Toggle} from '../ui';
import {emptyLlmSettings, type LlmSettingsInput, validateLlmSettings} from '../shared/llm';
import {type ChatToolName, defaultToolDescriptions} from '../shared/llm-prompts';
import {getApiKey, setApiKey} from '../services/secrets';
import {draftConnection, fetchLlmModels, setLlmEnabled, testLlmConnection} from '../services/llm';

const fields = [
    ['chatPrompt', '聊天提示词'],
    ['summaryPrompt', '通知摘要提示词'],
    ['connectionTestPrompt', '测试连接提示词'],
] as const;

export function LlmPanel() {
    const {state, change} = useStore();
    const [settings, setSettings] = useState(state.settings.llm);
    const [apiKey, setKey] = useState('');
    const [hasKey, setHasKey] = useState(false);
    const [clearKey, setClearKey] = useState(false);
    const [models, setModels] = useState<string[] | null>(null);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const [expanded, setExpanded] = useState<string[]>([]);
    const first = useRef(false);
    const request = useRef<AbortController | null>(null);
    useEffect(() => () => request.current?.abort(), []);
    useEffect(() => {
        void getApiKey()
            .then((v) => setHasKey(!!v))
            .catch((e) => setError(errorMessage(e)));
    }, []);
    useEffect(() => {
        if (settings.enabled && settings.baseUrl && !first.current) {
            first.current = true;
            void run('models');
        }
    }, [settings.enabled]);
    const input = (): LlmSettingsInput => ({...settings, apiKey, clearApiKey: clearKey});

    function edited() {
        setError('');
        setStatus('');
    }

    async function run(kind: 'save' | 'models' | 'test') {
        if (busy || !settings.enabled) return;
        edited();
        setBusy(kind);
        request.current = new AbortController();
        let connection;
        try {
            const checked = validateLlmSettings(input(), kind !== 'models');
            if (!checked.ok) throw new Error(checked.error);
            connection = await draftConnection(state.settings.llm, checked.data, kind !== 'models');
            if (kind === 'models') {
                const list = await fetchLlmModels(connection, undefined, 30000, request.current.signal);
                setModels(list);
                setSettings((s) => ({...s, model: list.includes(s.model) ? s.model : ''}));
                setStatus('已获取 ' + list.length + ' 个模型');
            } else if (kind === 'test') {
                const result = await testLlmConnection(
                    connection,
                    undefined,
                    30000,
                    request.current.signal,
                    checked.data.connectionTestPrompt,
                );
                setStatus('连接成功 · ' + result.elapsedMs + ' ms');
            } else {
                const {apiKey: key, clearApiKey, ...value} = checked.data;
                const previous = await getApiKey();
                if (clearApiKey || key) await setApiKey(clearApiKey ? '' : key);
                try {
                    await change((s) => ({
                        ...s,
                        settings: {
                            ...s.settings,
                            llm: {...value, enabled: s.settings.llm.enabled, hasApiKey: false},
                        },
                    }));
                } catch (e) {
                    if (clearApiKey || key) await setApiKey(previous);
                    throw e;
                }
                setHasKey(clearApiKey ? false : !!key || hasKey);
                setKey('');
                setClearKey(false);
            }
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            if (connection) connection.apiKey = '';
            setBusy('');
        }
    }

    async function toggle(enabled: boolean) {
        if (busy === 'toggle') return;
        if (!enabled) request.current?.abort();
        setBusy('toggle');
        edited();
        try {
            await change((s) => ({
                ...s,
                settings: {...s.settings, llm: {...s.settings.llm, enabled}},
            }));
            setLlmEnabled(enabled);
            setSettings((s) => ({...s, enabled}));
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy('');
        }
    }

    function expand(key: string) {
        setExpanded((v) => (v.includes(key) ? v.filter((k) => k !== key) : [...v, key]));
    }

    const disabled = !settings.enabled || !!busy;
    return (
        <View style={{gap: 20}}>
            <Toggle
                title="启用"
                value={settings.enabled}
                disabled={busy === 'toggle'}
                onChange={(v) => void toggle(v)}
            />
            <View
                pointerEvents={disabled ? 'none' : 'auto'}
                style={{gap: 20, opacity: settings.enabled ? 1 : 0.5}}
            >
                <Field
                    label="接口地址"
                    placeholder="https://example.com/v1"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!disabled}
                    value={settings.baseUrl}
                    maxLength={2048}
                    onChangeText={(baseUrl) => {
                        setSettings((s) => ({...s, baseUrl, model: ''}));
                        setModels(null);
                        edited();
                    }}
                />
                <Field
                    label="API Key"
                    placeholder={hasKey ? '已配置密钥' : '可选'}
                    secureTextEntry
                    autoCapitalize="none"
                    autoComplete="new-password"
                    value={apiKey}
                    editable={!disabled && !clearKey}
                    maxLength={4096}
                    onChangeText={(v) => {
                        setKey(v);
                        setModels(null);
                        edited();
                    }}
                />
                {hasKey && (
                    <Toggle
                        title="清除已保存的密钥"
                        disabled={disabled}
                        value={clearKey}
                        onChange={(v) => {
                            setClearKey(v);
                            setKey('');
                            setModels(null);
                            edited();
                        }}
                    />
                )}
                <Select
                    label="模型名称"
                    value={settings.model}
                    disabled={disabled}
                    options={[
                        {value: '', label: '请选择模型'},
                        ...(models ?? (settings.model ? [settings.model] : [])).map((value) => ({
                            value,
                            label: value,
                        })),
                    ]}
                    onChange={(model) => {
                        setSettings((s) => ({...s, model}));
                        edited();
                    }}
                />
                <Button
                    title={busy === 'models' ? '获取中…' : '获取模型'}
                    subtle
                    disabled={disabled}
                    onPress={() => void run('models')}
                />
                <Label size={16} weight="600">
                    提示词
                </Label>
                {fields.map(([key, label]) => (
                    <View key={key} style={{gap: 8}}>
                        <View style={styles.row}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{expanded: expanded.includes(key), disabled}}
                                disabled={disabled}
                                onPress={() => expand(key)}
                                style={{flex: 1, minHeight: 44, justifyContent: 'center'}}
                            >
                                <Label weight="500">{label}</Label>
                            </Pressable>
                            <IconButton
                                name="reset"
                                label={'恢复默认' + label}
                                disabled={disabled}
                                onPress={() => {
                                    setSettings((s) => ({...s, [key]: emptyLlmSettings()[key]}));
                                    edited();
                                }}
                            />
                        </View>
                        {expanded.includes(key) && (
                            <Field
                                label=""
                                accessibilityLabel={label}
                                multiline
                                editable={!disabled}
                                style={{minHeight: 180}}
                                maxLength={8000}
                                value={settings[key]}
                                onChangeText={(v) => {
                                    setSettings((s) => ({...s, [key]: v}));
                                    edited();
                                }}
                            />
                        )}
                    </View>
                ))}
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{expanded: expanded.includes('tools'), disabled}}
                    disabled={disabled}
                    onPress={() => expand('tools')}
                    style={{minHeight: 44, justifyContent: 'center'}}
                >
                    <Label weight="500">工具提示词</Label>
                </Pressable>
                {expanded.includes('tools') &&
                    (Object.keys(defaultToolDescriptions) as ChatToolName[]).map((name) => (
                        <View key={name} style={{gap: 8}}>
                            <View style={styles.row}>
                                <Label style={{flex: 1}}>{name}</Label>
                                <IconButton
                                    name="reset"
                                    label={'恢复默认' + name + ' 提示词'}
                                    disabled={disabled}
                                    onPress={() => {
                                        setSettings((s) => ({
                                            ...s,
                                            toolDescriptions: {
                                                ...s.toolDescriptions,
                                                [name]: defaultToolDescriptions[name],
                                            },
                                        }));
                                        edited();
                                    }}
                                />
                            </View>
                            <Field
                                label=""
                                accessibilityLabel={name}
                                multiline
                                editable={!disabled}
                                maxLength={2000}
                                style={{minHeight: 120}}
                                value={settings.toolDescriptions[name]}
                                onChangeText={(v) => {
                                    setSettings((s) => ({
                                        ...s,
                                        toolDescriptions: {...s.toolDescriptions, [name]: v},
                                    }));
                                    edited();
                                }}
                            />
                        </View>
                    ))}
                <View style={styles.row}>
                    <Button
                        title={busy === 'save' ? '保存中…' : '保存'}
                        disabled={disabled}
                        onPress={() => void run('save')}
                    />
                    <Button
                        title={busy === 'test' ? '测试中…' : '测试连接'}
                        subtle
                        disabled={disabled}
                        onPress={() => void run('test')}
                    />
                </View>
            </View>
            {!!status && <Label muted>{status}</Label>}
            {!!error && <Banner message={error}/>}
        </View>
    );
}
