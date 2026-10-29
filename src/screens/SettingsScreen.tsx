import {SourcesPanel} from './SourcesPanel';
import {NotificationSettingsPanel} from './NotificationSettingsPanel';
import {LlmPanel} from './LlmPanel';
import {useAuth} from '../Auth';
import {settingsAllowed} from '../auth-gate';
import {AccountPanel} from './AccountPanel';
import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Platform, Pressable, ScrollView, View} from 'react-native';
import {errorMessage, useStore} from '../Store';
import {dark, light, useColors} from '../theme';
import {Banner, Button, Field, Icon, IconButton, type IconName, Label, Page, Select, styles,} from '../ui';
import {useNav} from '../navigation';
import {
    campusOptions,
    departments,
    educationLevelOptions,
    genderOptions,
    identityOptions,
    validateMessagePreferences,
    validateRequiredMessagePreferences,
} from '../shared/message-preferences';
import type {MobileState} from '../model';

const sections: { id: string; title: string; icon: IconName }[] = [
    {id: 'general', title: '通用', icon: 'settings'},
    {id: 'notifications', title: '通知', icon: 'notices'},
    {id: 'account', title: '账号', icon: 'user'},
    {id: 'preferences', title: '消息偏好', icon: 'tag'},
    {id: 'sources', title: '消息来源', icon: 'folder'},
    {id: 'llm', title: 'LLM', icon: 'processor'},
    {id: 'about', title: '关于', icon: 'info'},
];

export function SettingsScreen({route}: { route?: { params?: { section?: string } } }) {
    const {state, change} = useStore();
    const c = useColors();
    const auth = useAuth();
    const navigation = useNav();
    const [selectedSection, setSection] = useState(
        auth.needsLogin
            ? 'account'
            : auth.needsPreferences
                ? 'preferences'
                : route?.params?.section || 'general',
    );
    const section = auth.busy ? 'account' : selectedSection;
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [preferences, setPreferences] = useState(state.settings.preferences);
    const [fieldError, setFieldError] = useState<{ field: string; error: string } | null>(null);
    useEffect(() => setFieldError(null), [preferences]);
    useEffect(() => {
        if (auth.needsLogin) setSection('account');
        else if (auth.needsPreferences) setSection('preferences');
    }, [auth.needsLogin, auth.needsPreferences, auth.account.username]);
    useEffect(() => setPreferences(state.settings.preferences), [state.settings.preferences]);
    useEffect(() => {
        if (
            route?.params?.section &&
            settingsAllowed(route.params.section, auth.needsLogin, auth.needsPreferences)
        )
            setSection(route.params.section);
    }, [route?.params?.section]);

    async function run(action: () => Promise<void>) {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await action();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    function saveSettings(patch: Partial<MobileState['settings']>) {
        return change((s) => ({...s, settings: {...s.settings, ...patch}}));
    }

    return (
        <KeyboardAvoidingView
            style={{flex: 1, backgroundColor: c.surface}}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <View style={{flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border}}>
                {route?.params?.section && auth.canUseApp && (
                    <IconButton name="arrow" label="返回" onPress={() => navigation.goBack()}/>
                )}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{gap: 4, padding: 8}}
                >
                    {sections.map((item) => (
                        <Pressable
                            key={item.id}
                            accessibilityRole="tab"
                            accessibilityState={{
                                selected: section === item.id,
                                disabled: !settingsAllowed(item.id, auth.needsLogin, auth.needsPreferences),
                            }}
                            disabled={!settingsAllowed(item.id, auth.needsLogin, auth.needsPreferences)}
                            onPress={() => {
                                setSection(item.id);
                                setError('');
                            }}
                            style={[
                                styles.row,
                                {
                                    opacity: settingsAllowed(item.id, auth.needsLogin, auth.needsPreferences)
                                        ? 1
                                        : 0.4,
                                    gap: 8,
                                    minHeight: 44,
                                    paddingHorizontal: 12,
                                    borderRadius: 8,
                                    backgroundColor: section === item.id ? c.accentSoft : 'transparent',
                                },
                            ]}
                        >
                            <Icon name={item.icon} color={section === item.id ? c.onAccentSoft : c.secondary}/>
                            <Label style={{color: section === item.id ? c.onAccentSoft : c.secondary}}>
                                {item.title}
                            </Label>
                        </Pressable>
                    ))}
                </ScrollView>
            </View>
            {section === 'sources' ? (
                <SourcesPanel/>
            ) : (
                <Page contentContainerStyle={{padding: 20, gap: 20}}>
                    {section === 'general' && (
                        <>
                            <Label weight="600" size={16}>
                                主题
                            </Label>
                            <View style={{flexDirection: 'row', gap: 12}}>
                                {(
                                    [
                                        {value: 'light', title: '浅色主题', colors: light, icon: 'sun'},
                                        {value: 'dark', title: '深色主题', colors: dark, icon: 'moon'},
                                        {value: 'auto', title: '跟随系统', colors: c, icon: 'monitor'},
                                    ] as const
                                ).map((item) => (
                                    <Pressable
                                        key={item.value}
                                        accessibilityRole="radio"
                                        accessibilityState={{checked: state.settings.theme === item.value}}
                                        onPress={() => void run(() => saveSettings({theme: item.value}))}
                                        style={{flex: 1, gap: 10}}
                                    >
                                        <View
                                            style={{
                                                height: 92,
                                                backgroundColor: item.colors.canvas,
                                                borderWidth: state.settings.theme === item.value ? 2 : 1,
                                                borderColor: state.settings.theme === item.value ? c.accent : c.border,
                                                borderRadius: 12,
                                                padding: 10,
                                                flexDirection: 'row',
                                                gap: 6,
                                            }}
                                        >
                                            <View
                                                style={{
                                                    width: 12,
                                                    borderRadius: 4,
                                                    backgroundColor: item.colors.sidebar
                                                }}
                                            />
                                            <View
                                                style={{
                                                    flex: 1,
                                                    backgroundColor: item.colors.surface,
                                                    borderRadius: 6,
                                                    padding: 7,
                                                    gap: 6,
                                                }}
                                            >
                                                <View
                                                    style={{
                                                        height: 4,
                                                        width: '70%',
                                                        backgroundColor: item.colors.selected,
                                                        borderRadius: 2,
                                                    }}
                                                />
                                                <View
                                                    style={{
                                                        height: 4,
                                                        width: '90%',
                                                        backgroundColor: item.colors.selected,
                                                        borderRadius: 2,
                                                    }}
                                                />
                                            </View>
                                        </View>
                                        <View style={[styles.row, {gap: 4, justifyContent: 'center'}]}>
                                            <Icon name={item.icon} size={16}/>
                                            <Label size={12}>{item.title}</Label>
                                        </View>
                                    </Pressable>
                                ))}
                            </View>
                        </>
                    )}
                    {section === 'notifications' && <NotificationSettingsPanel/>}
                    {section === 'account' && <AccountPanel/>}
                    {section === 'preferences' && (
                        <>
                            <Select
                                label="身份"
                                required
                                error={fieldError?.field === 'identity' ? fieldError.error : undefined}
                                value={preferences.identity}
                                options={[{value: '', label: ''}, ...identityOptions]}
                                onChange={(identity) => setPreferences((p) => ({...p, identity}))}
                            />
                            <Select
                                label="性别"
                                required
                                error={fieldError?.field === 'gender' ? fieldError.error : undefined}
                                value={preferences.gender}
                                options={[{value: '', label: ''}, ...genderOptions]}
                                onChange={(gender) => setPreferences((p) => ({...p, gender}))}
                            />
                            <Select
                                label="院系"
                                required
                                error={fieldError?.field === 'department' ? fieldError.error : undefined}
                                value={preferences.department}
                                options={[
                                    {value: '', label: ''},
                                    ...departments.map((value) => ({value, label: value})),
                                ]}
                                onChange={(department) => setPreferences((p) => ({...p, department}))}
                            />
                            <Select
                                label="学历阶段"
                                required
                                error={fieldError?.field === 'educationLevel' ? fieldError.error : undefined}
                                value={preferences.educationLevel}
                                options={[{value: '', label: ''}, ...educationLevelOptions]}
                                onChange={(educationLevel) => setPreferences((p) => ({...p, educationLevel}))}
                            />
                            <Select
                                label="年级"
                                required
                                error={fieldError?.field === 'grade' ? fieldError.error : undefined}
                                value={preferences.grade ?? 0}
                                options={[
                                    {value: 0, label: ''},
                                    ...[
                                        ...new Set([
                                            ...Array.from({length: 21}, (_, i) => new Date().getFullYear() + 1 - i),
                                            ...(preferences.grade ? [preferences.grade] : []),
                                        ]),
                                    ]
                                        .sort((a, b) => b - a)
                                        .map((value) => ({value, label: value + '级'})),
                                ]}
                                onChange={(grade) => setPreferences((p) => ({...p, grade: grade || null}))}
                            />
                            <Field
                                label="专业"
                                required
                                error={fieldError?.field === 'major' ? fieldError.error : undefined}
                                value={preferences.major}
                                onChangeText={(major) => setPreferences((p) => ({...p, major}))}
                                maxLength={100}
                            />
                            <Select
                                label="校区"
                                required
                                error={fieldError?.field === 'campus' ? fieldError.error : undefined}
                                value={preferences.campus}
                                options={[
                                    {value: '', label: ''},
                                    ...campusOptions.map((value) => ({value, label: value})),
                                ]}
                                onChange={(campus) => setPreferences((p) => ({...p, campus}))}
                            />
                            <Button
                                title={busy ? '正在保存…' : '保存偏好'}
                                disabled={busy}
                                onPress={() =>
                                    void run(async () => {
                                        const result = (
                                            auth.account.status === 'signed-in'
                                                ? validateRequiredMessagePreferences
                                                : validateMessagePreferences
                                        )(preferences);
                                        if (!result.ok) {
                                            setFieldError(result);
                                            return;
                                        }
                                        await saveSettings({
                                            preferences: result.data,
                                            preferencesUsername: auth.account.username || undefined,
                                            accountPreferences: {
                                                ...state.settings.accountPreferences,
                                                ...(auth.account.username ? {[auth.account.username]: result.data} : {}),
                                            },
                                        });
                                    })
                                }
                            />
                        </>
                    )}
                    {section === 'llm' && <LlmPanel/>}
                    {section === 'about' && (
                        <>
                            <View style={styles.row}>
                                <Label muted style={{width: 60}}>
                                    版本
                                </Label>
                                <Label>1.0.0</Label>
                            </View>
                            <View style={[styles.row, {alignItems: 'flex-start'}]}>
                                <Label muted style={{width: 60}}>
                                    GitHub
                                </Label>
                                <Pressable
                                    onPress={() =>
                                        navigation.navigate('Campus', {
                                            title: 'GitHub',
                                            url: 'https://github.com/CPJiNan/FduNav',
                                        })
                                    }
                                    style={{flex: 1}}
                                >
                                    <Label>https://github.com/CPJiNan/FduNav</Label>
                                </Pressable>
                            </View>
                        </>
                    )}
                    {!!error && <Banner message={error}/>}
                </Page>
            )}
        </KeyboardAvoidingView>
    );
}
