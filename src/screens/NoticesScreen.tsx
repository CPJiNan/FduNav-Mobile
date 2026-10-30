import {NoticeBody} from '../components/NoticeBody';
import {Markdown} from '../components/Markdown';
import React, {useEffect, useRef, useState} from 'react';
import {FlatList, Modal, Pressable, RefreshControl, TextInput, View} from 'react-native';
import {errorMessage, useStore} from '../Store';
import {useColors} from '../theme';
import {Banner, Button, Chips, DateField, Icon, IconButton, Label, Page, Select, styles,} from '../ui';
import {type ScreenProps, useNav} from '../navigation';
import {noticeKey} from '../model';
import {defaultSources} from '../shared/sources';
import {fetchDetail} from '../services/network';
import type {NoticeRelevanceChoice} from '../shared/notices';
import {shareBinary} from '../services/files';
import {fetchNoticeBinary} from '../services/notice-assets';
import type {NoticeDetail} from '../shared/notices';

const relevanceText = (value: string | null | undefined) =>
    value === 'related' ? '[@与我有关]' : value === 'maybe' ? '[@可能有关]' : '';

function RelevanceTag({value, size = 12}: { value: string | null | undefined; size?: number }) {
    const c = useColors();
    const text = relevanceText(value);
    if (!text) return null;
    return (
        <Label
            size={size}
            weight="600"
            style={{color: value === 'related' ? c.danger : c.muted, marginRight: 8}}
        >
            {text}
        </Label>
    );
}

export function NoticesScreen() {
    const {state, change, refreshing, refresh, summaries} = useStore();
    const c = useColors();
    const nav = useNav();
    const [query, setQuery] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [source, setSource] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [readConfirm, setReadConfirm] = useState(false);
    const [multi, setMulti] = useState(false);
    const [checked, setChecked] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const items = state.notices.filter(
        (n) =>
            state.sourceIds.includes(n.sourceId as never) &&
            (!source || n.sourceId === source) &&
            (!from || n.published >= from) &&
            (!to || n.published <= to) &&
            n.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
    const unread = items.filter((n) => !n.read);

    async function markRead() {
        const keys = new Set(unread.map(noticeKey));
        setBusy(true);
        try {
            await change((s) => ({
                ...s,
                notices: s.notices.map((n) => (keys.has(noticeKey(n)) ? {...n, read: true} : n)),
            }));
            setReadConfirm(false);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    async function summarizeSelected() {
        setBusy(true);
        setError('');
        try {
            for (const notice of items.filter((n) => checked.includes(noticeKey(n))))
                void summaries.summarize(notice).catch(() => {
                });
            setChecked([]);
            setMulti(false);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <View style={{flex: 1, backgroundColor: c.surface}}>
            <FlatList
                data={items}
                keyExtractor={noticeKey}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => void refresh()}
                        tintColor={c.accent}
                    />
                }
                contentContainerStyle={{
                    padding: 16,
                    paddingBottom: 24,
                    width: '100%',
                    maxWidth: 800,
                    alignSelf: 'center',
                }}
                ListHeaderComponent={
                    <View style={{gap: 12}}>
                        <View style={[styles.row, {gap: 8, minHeight: 44}]}>
                            <Icon name="search"/>
                            <TextInput
                                accessibilityLabel="搜索通知标题"
                                placeholder="搜索通知标题"
                                placeholderTextColor={c.muted}
                                value={query}
                                onChangeText={setQuery}
                                style={{minWidth: 0, flex: 1, minHeight: 44, color: c.text, fontSize: 14}}
                            />
                            <IconButton
                                name="filter"
                                label="筛选通知"
                                onPress={() => setFilterOpen(!filterOpen)}
                            />
                            <IconButton
                                name="clean"
                                label="一键已读"
                                disabled={!unread.length || busy}
                                onPress={() => setReadConfirm(true)}
                            />
                            <IconButton
                                name="sparkles"
                                label="AI 摘要"
                                onPress={() => {
                                    setMulti(!multi);
                                    setChecked([]);
                                }}
                            />
                            <IconButton
                                name="refresh"
                                label={refreshing ? '正在刷新通知' : '刷新通知'}
                                disabled={refreshing}
                                onPress={() => void refresh()}
                            />
                        </View>
                        {filterOpen && (
                            <View style={{gap: 12, padding: 12, backgroundColor: c.subtle, borderRadius: 8}}>
                                <Select
                                    label="来源"
                                    value={source}
                                    onChange={setSource}
                                    options={[
                                        {value: '', label: '全部来源'},
                                        ...defaultSources
                                            .filter((s) => state.sourceIds.includes(s.id))
                                            .map((s) => ({value: s.id, label: s.name})),
                                    ]}
                                />
                                <Label>发布时间</Label>
                                <View style={styles.row}>
                                    <View style={{flex: 1}}>
                                        <DateField label="开始日期" value={from} onChange={setFrom}/>
                                    </View>
                                    <Label>至</Label>
                                    <View style={{flex: 1}}>
                                        <DateField label="结束日期" value={to} onChange={setTo}/>
                                    </View>
                                </View>
                                <Button
                                    title="重置筛选"
                                    subtle
                                    onPress={() => {
                                        setSource('');
                                        setFrom('');
                                        setTo('');
                                    }}
                                />
                            </View>
                        )}
                        {multi && (
                            <View style={[styles.row, {flexWrap: 'wrap', gap: 8}]}>
                                <Button
                                    title="全选"
                                    subtle
                                    onPress={() =>
                                        setChecked(checked.length === items.length ? [] : items.map(noticeKey))
                                    }
                                />
                                <Label muted>已选 {checked.length} 条</Label>
                                <Button
                                    title={busy ? '加入中…' : '加入摘要队列'}
                                    subtle
                                    disabled={busy || !checked.length}
                                    onPress={() => void summarizeSelected()}
                                />
                            </View>
                        )}
                        {!!error && <Banner message={error}/>}
                        {defaultSources
                            .filter(
                                (s) =>
                                    state.sourceIds.includes(s.id) &&
                                    state.sourceErrors[s.id] &&
                                    (!source || source === s.id),
                            )
                            .map((s) => (
                                <Banner key={s.id} message={s.name + '：' + state.sourceErrors[s.id]}/>
                            ))}
                    </View>
                }
                ListEmptyComponent={
                    <Label size={16} weight="500" muted style={{paddingVertical: 48, textAlign: 'center'}}>
                        {refreshing
                            ? '正在获取最新通知…'
                            : query || source || from || to
                                ? '没有匹配的通知'
                                : '暂无通知'}
                    </Label>
                }
                ListFooterComponent={
                    state.refreshedAt ? (
                        <Label muted size={12} style={{paddingTop: 16}}>
                            上次更新：{new Date(state.refreshedAt).toLocaleString('zh-CN')}
                        </Label>
                    ) : undefined
                }
                renderItem={({item}) => (
                    <View style={[styles.row, {gap: 4, borderBottomWidth: 1, borderColor: c.border}]}>
                        {multi && (
                            <Pressable
                                accessibilityRole="checkbox"
                                accessibilityLabel={'选择通知：' + item.title}
                                accessibilityState={{checked: checked.includes(noticeKey(item))}}
                                onPress={() =>
                                    setChecked((v) =>
                                        v.includes(noticeKey(item))
                                            ? v.filter((k) => k !== noticeKey(item))
                                            : [...v, noticeKey(item)],
                                    )
                                }
                                style={{width: 44, height: 44, alignItems: 'center', justifyContent: 'center'}}
                            >
                                <Icon name={checked.includes(noticeKey(item)) ? 'check' : 'plus'}/>
                            </Pressable>
                        )}
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => nav.navigate('Notice', {key: noticeKey(item)})}
                            style={({pressed}) => ({
                                flex: 1,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 16,
                                paddingVertical: 24,
                                paddingHorizontal: 4,
                                backgroundColor: pressed ? c.hover : 'transparent',
                            })}
                        >
                            <View style={{width: 52, alignItems: 'center'}}>
                                <Label size={18} weight="500">
                                    {item.published.slice(5)}
                                </Label>
                                <Label muted size={12}>
                                    {item.published.slice(0, 4)}
                                </Label>
                            </View>
                            <View style={{flex: 1, gap: 8}}>
                                <Label
                                    size={12}
                                    style={{
                                        alignSelf: 'flex-start',
                                        paddingHorizontal: 8,
                                        paddingVertical: 2,
                                        borderRadius: 4,
                                        backgroundColor: c.selected,
                                        color: c.secondary,
                                    }}
                                >
                                    {item.sourceName}
                                </Label>
                                <Label size={16} weight="500">
                                    <RelevanceTag value={item.relevance}/>
                                    {item.title}
                                    {!item.read && <Label style={{color: c.dot}}> ●</Label>}
                                </Label>
                            </View>
                            <Icon name="chevron" size={16}/>
                        </Pressable>
                    </View>
                )}
            />
            <Modal
                transparent
                visible={readConfirm}
                onRequestClose={() => {
                    if (!busy) setReadConfirm(false);
                }}
            >
                <View
                    style={{flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24}}
                >
                    <View style={{backgroundColor: c.surface, padding: 24, borderRadius: 16, gap: 20}}>
                        <Label weight="600" size={18}>
                            一键已读
                        </Label>
                        <Label>确认将当前 {unread.length} 条未读通知标记为已读？</Label>
                        <View style={[styles.row, {justifyContent: 'flex-end'}]}>
                            <Button title="取消" subtle disabled={busy} onPress={() => setReadConfirm(false)}/>
                            <Button
                                title={busy ? '正在标记…' : '确认已读'}
                                disabled={busy}
                                onPress={() => void markRead()}
                            />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

export function NoticeScreen({route, navigation}: ScreenProps<'Notice'>) {
    const {state, change, summaries} = useStore();
    const c = useColors();
    const notice = state.notices.find((n) => noticeKey(n) === route.params.key);
    const detail = state.details[route.params.key];
    const summary = notice ? summaries.cached(notice)?.content : undefined;
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [summarizing, setSummarizing] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [relevanceOpen, setRelevanceOpen] = useState(false);
    const [opening, setOpening] = useState('');
    const controller = useRef<AbortController | null>(null);
    useEffect(() => () => controller.current?.abort(), []);
    useEffect(() => {
        if (!notice) return;
        let active = true;
        void change((s) => ({
            ...s,
            notices: s.notices.map((n) => (noticeKey(n) === route.params.key ? {...n, read: true} : n)),
        })).catch(() => {
        });
        if (!detail) {
            setLoading(true);
            setError('');
            const showDetail = async (result: NoticeDetail) => {
                if (active)
                    await change((s) => ({
                        ...s,
                        details: Object.fromEntries([
                            ...Object.entries(s.details)
                                .filter(([key]) => key !== route.params.key)
                                .slice(-79),
                            [route.params.key, result],
                        ]),
                    }));
                if (active) setLoading(false);
            };
            void fetchDetail(notice, showDetail)
                .then(showDetail)
                .catch((e) => {
                    if (active) setError(errorMessage(e));
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }
        return () => {
            active = false;
        };
    }, [route.params.key, attempt, change]);

    async function summarize() {
        if (!notice || !detail) return;
        setSummarizing(true);
        setError('');
        controller.current = new AbortController();
        try {
            await summaries.summarize(notice, true);
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setSummarizing(false);
        }
    }

    if (!notice)
        return (
            <Page>
                <Button title="返回通知列表" icon="arrow" subtle onPress={() => navigation.goBack()}/>
            </Page>
        );

    function relevance(value: NoticeRelevanceChoice) {
        void change((s) => ({
            ...s,
            relevanceChoices: {...s.relevanceChoices, [route.params.key]: value},
            notices: s.notices.map((n) =>
                noticeKey(n) === route.params.key
                    ? {...n, relevance: value === 'none' ? null : value}
                    : n,
            ),
        })).catch(() => {
        });
        setRelevanceOpen(false);
    }

    return (
        <Page>
            <Pressable
                accessibilityRole="button"
                onPress={() => navigation.goBack()}
                style={[styles.row, {minHeight: 44, gap: 8}]}
            >
                <Icon name="arrow"/>
                <Label>返回通知列表</Label>
            </Pressable>
            <Label size={24} weight="600" selectable>
                <RelevanceTag value={notice.relevance} size={14}/>
                {notice.title}
            </Label>
            <View style={[styles.row, {flexWrap: 'wrap', gap: 8}]}>
                <Label muted>{notice.published}</Label>
                <Label muted>{notice.sourceName}</Label>
            </View>
            <View style={[styles.row, {gap: 8}]}>
                <IconButton
                    name="tag"
                    label="通知相关性"
                    onPress={() => setRelevanceOpen(!relevanceOpen)}
                />
                <IconButton
                    name="sparkles"
                    label="AI 摘要"
                    onPress={() => {
                        setSummaryOpen(!summaryOpen);
                        if (!summary && !summaryOpen) void summarize();
                    }}
                />
            </View>
            <Button
                title="查看原文"
                icon="external"
                subtle
                style={{alignSelf: 'flex-start'}}
                onPress={() =>
                    navigation.navigate('Campus', {url: notice.url, title: notice.sourceName})
                }
            />
            {relevanceOpen && (
                <Chips
                    value={notice.relevance ?? 'none'}
                    onChange={relevance}
                    options={[
                        {value: 'related', label: '与我有关'},
                        {value: 'maybe', label: '可能有关'},
                        {value: 'none', label: '与我无关'},
                    ]}
                />
            )}
            {summaryOpen && (
                <View style={{gap: 12, padding: 16, backgroundColor: c.subtle, borderRadius: 12}}>
                    <View style={[styles.row, {flexWrap: 'wrap'}]}>
                        <Label weight="600" style={{flex: 1}}>
                            AI 摘要
                        </Label>
                        <Button
                            title="重新摘要"
                            subtle
                            disabled={!detail || summarizing}
                            onPress={() => void summarize()}
                        />
                        <Button title="收起" subtle onPress={() => setSummaryOpen(false)}/>
                    </View>
                    {summary ? (
                        <Markdown>{summary}</Markdown>
                    ) : (
                        <Label muted>{summarizing ? '正在生成摘要…' : ''}</Label>
                    )}
                </View>
            )}
            {!!error && <Banner message={error}/>}
            {loading && <Label muted>正在读取通知正文…</Label>}
            {detail ? (
                <View style={{gap: 16}}>
                    <NoticeBody detail={detail} notice={notice}/>
                    {!!detail.attachmentError && <Banner message={detail.attachmentError}/>}
                    {detail.attachments.map((file) => (
                        <Button
                            key={file.url}
                            title={file.name}
                            icon="external"
                            subtle
                            disabled={!!opening}
                            onPress={() => {
                                setOpening(file.url);
                                setError('');
                                void fetchNoticeBinary(file.url, notice.url)
                                    .then(({bytes}) => shareBinary(file.name, bytes))
                                    .catch((e) => setError(errorMessage(e)))
                                    .finally(() => setOpening(''));
                            }}
                        />
                    ))}
                </View>
            ) : (
                !loading && <Button title="重试" subtle onPress={() => setAttempt((v) => v + 1)}/>
            )}
        </Page>
    );
}
