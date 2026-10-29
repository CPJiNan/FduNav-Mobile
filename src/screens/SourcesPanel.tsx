import React, {useEffect, useMemo, useRef, useState} from 'react';
import {PanResponder, Platform, Pressable, ScrollView, View, type ViewStyle} from 'react-native';
import {errorMessage, useStore} from '../Store';
import {useColors} from '../theme';
import {Banner, Field, Icon, Label, Page, styles, Toggle} from '../ui';
import {defaultSources, type SourceId} from '../shared/sources';
import {useNav} from '../navigation';

type Drop = { id: SourceId; after: boolean };
type Drag = {
    id: SourceId;
    startY: number;
    startScroll: number;
    y: number;
    dy: number;
    drop: Drop | null;
};

export function reorderSources(order: SourceId[], id: SourceId, drop: Drop): SourceId[] {
    if (id === drop.id || !order.includes(id) || !order.includes(drop.id)) return order;
    const next = order.filter((value) => value !== id);
    next.splice(next.indexOf(drop.id) + Number(drop.after), 0, id);
    return next.every((value, index) => value === order[index]) ? order : next;
}

function DragHandle(props: {
    name: string;
    disabled: boolean;
    active: boolean;
    start: (y: number) => void;
    move: (y: number) => void;
    finish: (save: boolean) => void;
    step: (amount: number) => void;
}) {
    const c = useColors();
    const current = useRef(props);
    current.current = props;
    const responder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => !current.current.disabled,
                onPanResponderGrant: (event) => current.current.start(event.nativeEvent.pageY),
                onPanResponderMove: (_, gesture) => current.current.move(gesture.moveY),
                onPanResponderRelease: () => current.current.finish(true),
                onPanResponderTerminate: () => current.current.finish(false),
                onPanResponderTerminationRequest: () => false,
            }),
        [],
    );
    return (
        <View
            {...responder.panHandlers}
            accessible
            focusable={!props.disabled}
            tabIndex={props.disabled ? -1 : 0}
            accessibilityRole="adjustable"
            accessibilityLabel={'排序 ' + props.name}
            accessibilityState={{disabled: props.disabled}}
            accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
            onAccessibilityAction={(event) => {
                if (!props.disabled) props.step(event.nativeEvent.actionName === 'increment' ? 1 : -1);
            }}
            onKeyDown={(event) => {
                if (event.nativeEvent.key === 'Escape') props.finish(false);
                if (props.disabled || !['ArrowUp', 'ArrowDown'].includes(event.nativeEvent.key)) return;
                event.preventDefault();
                props.step(event.nativeEvent.key === 'ArrowDown' ? 1 : -1);
            }}
            style={{
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                backgroundColor: props.active ? c.accentSoft : 'transparent',
                opacity: props.disabled ? 0.4 : 1,
                ...(Platform.OS === 'web'
                    ? ({
                        touchAction: 'none',
                        cursor: props.active ? 'grabbing' : 'grab',
                    } as unknown as ViewStyle)
                    : {}),
            }}
        >
            <Icon name="grip" color={props.active ? c.accent : c.secondary}/>
        </View>
    );
}

export function SourcesPanel() {
    const {state, change} = useStore();
    const c = useColors();
    const navigation = useNav();
    const [query, setQuery] = useState('');
    const [busy, setBusy] = useState(false);
    const saving = useRef(false);
    const [error, setError] = useState('');
    const [drag, setDrag] = useState<Drag | null>(null);
    const active = useRef<Drag | null>(null);
    const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const viewport = useRef<React.ComponentRef<typeof View>>(null);
    const bounds = useRef({y: 0, height: 0});
    const scrollY = useRef(0);
    const contentHeight = useRef(0);
    const listY = useRef(0);
    const layouts = useRef(new Map<SourceId, { y: number; height: number }>());
    const frame = useRef<number | null>(null);
    const visible = state.sourceOrder
        .map((id) => defaultSources.find((source) => source.id === id)!)
        .filter((source) =>
            (source.name + ' ' + source.url).toLowerCase().includes(query.trim().toLowerCase()),
        );
    const currentVisible = useRef(visible);
    currentVisible.current = visible;

    async function save(work: () => Promise<void>) {
        if (saving.current) return;
        saving.current = true;
        setBusy(true);
        setError('');
        try {
            await work();
        } catch (error) {
            setError(errorMessage(error));
        } finally {
            saving.current = false;
            setBusy(false);
        }
    }

    function commit(id: SourceId, drop: Drop) {
        void save(() =>
            change((s) => ({...s, sourceOrder: reorderSources(s.sourceOrder, id, drop)})),
        );
    }

    function update(y: number) {
        const value = active.current;
        if (!value) return;
        const localY = y - bounds.current.y + scrollY.current - listY.current;
        const others = currentVisible.current.filter((source) => source.id !== value.id);
        let drop: Drop | null = null;
        for (const source of others) {
            const layout = layouts.current.get(source.id);
            if (!layout) continue;
            drop = {id: source.id, after: localY >= layout.y + layout.height / 2};
            if (!drop.after) break;
        }
        active.current = {
            ...value,
            y,
            dy: y - value.startY + scrollY.current - value.startScroll,
            drop,
        };
        setDrag(active.current);
    }

    function autoScroll() {
        const value = active.current;
        if (!value) return;
        const {y, height} = bounds.current;
        const distance =
            value.y < y + 56
                ? value.y - y - 56
                : value.y > y + height - 56
                    ? value.y - y - height + 56
                    : 0;
        if (distance) {
            const next = Math.max(
                0,
                Math.min(
                    contentHeight.current - height,
                    scrollY.current + Math.max(-10, Math.min(10, distance / 5)),
                ),
            );
            if (next !== scrollY.current) {
                scrollY.current = next;
                scroll.current?.scrollTo({y: next, animated: false});
                update(value.y);
            }
        }
        frame.current = requestAnimationFrame(autoScroll);
    }

    function finish(persist: boolean) {
        const value = active.current;
        active.current = null;
        setDrag(null);
        if (frame.current !== null) cancelAnimationFrame(frame.current);
        frame.current = null;
        if (persist && value?.drop && Math.abs(value.dy) > 4) commit(value.id, value.drop);
    }

    useEffect(
        () => () => {
            active.current = null;
            if (frame.current !== null) cancelAnimationFrame(frame.current);
        },
        [],
    );

    return (
        <View
            ref={viewport}
            style={{flex: 1}}
            onLayout={() => {
                finish(false);
                viewport.current?.measureInWindow((_x, y, _width, height) => {
                    bounds.current = {y, height};
                });
            }}
        >
            <Page
                scrollRef={scroll}
                scrollEnabled={!drag}
                scrollEventThrottle={16}
                onScroll={(event) => {
                    scrollY.current = event.nativeEvent.contentOffset.y;
                    if (active.current) update(active.current.y);
                }}
                onContentSizeChange={(_width, height) => {
                    contentHeight.current = height;
                }}
                contentContainerStyle={{padding: 20, gap: 20}}
            >
                <Field
                    label=""
                    accessibilityLabel="搜索消息来源"
                    placeholder="搜索名称或网址"
                    value={query}
                    onChangeText={(value) => {
                        finish(false);
                        setQuery(value);
                    }}
                />
                {!!query.trim() && !visible.length && <Label muted>未找到匹配的消息来源</Label>}
                <View
                    onLayout={(event) => {
                        listY.current = event.nativeEvent.layout.y;
                    }}
                    style={{gap: 20}}
                >
                    {visible.map((source, index) => {
                        const moving = drag?.id === source.id;
                        const marker = drag?.drop?.id === source.id ? drag.drop : null;
                        return (
                            <View
                                key={source.id}
                                onLayout={(event) => {
                                    layouts.current.set(source.id, event.nativeEvent.layout);
                                }}
                                style={{
                                    borderBottomWidth: 1,
                                    borderColor: c.border,
                                    paddingBottom: 12,
                                    gap: 4,
                                    backgroundColor: c.surface,
                                    zIndex: moving ? 1 : 0,
                                    opacity: moving ? 0.8 : 1,
                                    transform: [{translateY: moving ? drag.dy : 0}],
                                }}
                            >
                                {marker && (
                                    <View
                                        pointerEvents="none"
                                        style={{
                                            position: 'absolute',
                                            left: 0,
                                            right: 0,
                                            height: 2,
                                            backgroundColor: c.accent,
                                            ...(marker.after ? {bottom: -10} : {top: -10}),
                                        }}
                                    />
                                )}
                                <View style={styles.row}>
                                    <DragHandle
                                        name={source.name}
                                        disabled={busy}
                                        active={moving}
                                        start={(y) => {
                                            if (saving.current) return;
                                            active.current = {
                                                id: source.id,
                                                startY: y,
                                                startScroll: scrollY.current,
                                                y,
                                                dy: 0,
                                                drop: null,
                                            };
                                            setDrag(active.current);
                                            frame.current = requestAnimationFrame(autoScroll);
                                        }}
                                        move={update}
                                        finish={finish}
                                        step={(amount) => {
                                            if (active.current) return;
                                            const target = visible[index + amount];
                                            if (target) commit(source.id, {id: target.id, after: amount > 0});
                                        }}
                                    />
                                    <Label style={{flex: 1}}>{source.name}</Label>
                                </View>
                                <Toggle
                                    title="启用"
                                    disabled={busy || !!drag}
                                    value={state.sourceIds.includes(source.id)}
                                    onChange={(enabled) =>
                                        void save(() =>
                                            change((s) => ({
                                                ...s,
                                                sourceIds: enabled
                                                    ? [...new Set([...s.sourceIds, source.id])]
                                                    : s.sourceIds.filter((id) => id !== source.id),
                                            })),
                                        )
                                    }
                                />
                                <Pressable
                                    disabled={!!drag}
                                    onPress={() =>
                                        navigation.navigate('Campus', {url: source.url, title: source.name})
                                    }
                                >
                                    <Label muted size={12}>
                                        {source.url}
                                    </Label>
                                </Pressable>
                                {!!state.sourceErrors[source.id] && (
                                    <Label size={12} style={{color: c.danger}}>
                                        {state.sourceErrors[source.id]}
                                    </Label>
                                )}
                            </View>
                        );
                    })}
                </View>
                {!!error && <Banner message={error}/>}
            </Page>
        </View>
    );
}
