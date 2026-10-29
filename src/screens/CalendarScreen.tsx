import {CalendarTimeline} from './CalendarTimeline';
import React, {useEffect, useState} from 'react';
import {KeyboardAvoidingView, Modal, Platform, Pressable, View} from 'react-native';
import * as Crypto from 'expo-crypto';
import {errorMessage, useStore} from '../Store';
import {useColors} from '../theme';
import {Banner, Button, DateField, DialogHeader, Field, IconButton, Label, Page, Select, styles, Toggle,} from '../ui';
import {type ScreenProps, useNav} from '../navigation';
import {
    calendarDate,
    type CalendarEventInput,
    type CalendarOccurrence,
    calendarOccurrences,
    calendarRange,
    type CalendarView,
    calendarViews,
    calendarWeekdays,
    dayDifference,
    localToday,
    lunarDate,
    monthDates,
    shiftCalendarDate,
    timeLabel,
    validateCalendarEvent,
    weekStartDate,
} from '../shared/calendar';
import {courseSyllabusUrl, dateAfter} from '../shared/timetable';
import {calendarReminderOptions} from '../shared/calendar-reminders';
import {calendarEventColor, courseColor} from '../design/timetable-colors';

const occurrenceColor = (o: CalendarOccurrence) =>
    o.course ? courseColor(o.course) : calendarEventColor(o.event!.id);

export function CalendarScreen({
                                   route,
                               }: {
    route?: { params?: { view?: CalendarView; date?: string; courseKey?: string } };
}) {
    const {state, change, refreshCalendar} = useStore();
    const [loadError, setLoadError] = useState('');
    const [loading, setLoading] = useState(false);

    async function load(semesterId?: string) {
        if (loading) return;
        setLoading(true);
        setLoadError('');
        try {
            await refreshCalendar(semesterId);
            if (semesterId)
                setDate(
                    state.timetable?.semesters.find((s) => s.id === semesterId)?.startDate || localToday(),
                );
        } catch (e) {
            setLoadError(errorMessage(e));
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (!state.timetable) void load();
    }, []);
    const c = useColors();
    const nav = useNav();
    const [date, setDate] = useState(localToday);
    const [view, setView] = useState<CalendarView>(route?.params?.view || 'week');
    const [settings, setSettings] = useState(false);
    const [chooseDate, setChooseDate] = useState(false);
    const [agendaDays, setAgendaDays] = useState(30);
    const [course, setCourse] = useState<CalendarOccurrence | null>(null);
    useEffect(() => setAgendaDays(30), [date, view]);
    const days =
        view === 'week'
            ? Array.from({length: 7}, (_, i) => dateAfter(weekStartDate(date), i))
            : view === 'day'
                ? [date]
                : monthDates(date);
    const occurrences = calendarOccurrences(
        state.timetable,
        state.events,
        view === 'agenda' ? date : calendarRange(date, view)[0],
        view === 'agenda' ? dateAfter(date, agendaDays - 1) : calendarRange(date, view)[1],
    );
    useEffect(() => {
        if (route?.params?.view) setView(route.params.view);
        if (route?.params?.date) setDate(route.params.date);
        if (route?.params?.courseKey) {
            const targetDate = route.params.date || date;
            const item = calendarOccurrences(state.timetable, state.events, targetDate, targetDate).find(
                (o) => o.key === route.params?.courseKey,
            );
            if (item) setCourse(item);
        }
    }, [route?.params, state.timetable]);
    const weekCount = Math.max(18, ...(state.timetable?.courses.flatMap((c) => c.weeks) || []));
    const teachingWeek = state.timetable?.startDate
        ? Math.floor(dayDifference(weekStartDate(date), state.timetable.startDate) / 7) + 1
        : 0;
    const open = (item: CalendarOccurrence) =>
        item.event ? nav.navigate('EventEditor', {id: item.event.id}) : setCourse(item);
    const dateButton = (day: string, mini = false) => (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={day}
            accessibilityState={{selected: day === date}}
            onPress={() => {
                setDate(day);
                setView(day.slice(0, 7) === date.slice(0, 7) ? 'day' : 'month');
            }}
            style={{minHeight: mini ? 24 : 44, alignItems: 'center', justifyContent: 'center'}}
        >
            <View
                style={{
                    width: mini ? 20 : 32,
                    height: mini ? 20 : 32,
                    borderRadius: 9999,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: day === localToday() ? c.accent : 'transparent',
                    borderWidth: day === date ? 1 : 0,
                    borderColor: c.accent,
                }}
            >
                <Label size={mini ? 10 : 18} style={{color: day === localToday() ? c.onAccent : c.text}}>
                    {Number(day.slice(-2))}
                </Label>
            </View>
            {!mini && (
                <Label muted size={11}>
                    {lunarDate(day)}
                </Label>
            )}
        </Pressable>
    );
    return (
        <Page contentContainerStyle={{padding: 16, gap: 12}}>
            <View style={[styles.row, {gap: 0}]}>
                <Pressable
                    onPress={() => setChooseDate(!chooseDate)}
                    accessibilityRole="button"
                    accessibilityLabel="选择日期"
                    style={{flex: 1, minHeight: 44, justifyContent: 'center'}}
                >
                    <Label size={18} weight="600">
                        {date.slice(0, 4)}年{view !== 'year' ? Number(date.slice(5, 7)) + '月' : ''}
                    </Label>
                </Pressable>
                <IconButton name="settings" label="课表设置" onPress={() => setSettings(!settings)}/>
                <IconButton name="map-pin" label="今天" onPress={() => setDate(localToday())}/>
                <IconButton
                    name="refresh"
                    label="刷新日历"
                    disabled={loading}
                    onPress={() => void load(state.timetable?.semesterId || undefined)}
                />
                <IconButton
                    name="plus"
                    label="新建日程"
                    onPress={() => nav.navigate('EventEditor', {date})}
                />
            </View>
            {!!loadError && <Banner message={loadError}/>}
            {loading && <Label muted>正在同步…</Label>}
            {chooseDate && (
                <DateField
                    label="选择日期"
                    value={date}
                    onChange={(value) => {
                        if (calendarDate(value)) setDate(value);
                    }}
                />
            )}
            {settings && state.timetable && (
                <View style={{padding: 16, backgroundColor: c.subtle, borderRadius: 8, gap: 12}}>
                    {!!state.timetable.semesters.length && (
                        <Select
                            label="学期"
                            value={state.timetable.semesterId}
                            options={state.timetable.semesters.map((s) => ({value: s.id, label: s.name}))}
                            disabled={loading}
                            onChange={(id) => void load(id)}
                        />
                    )}
                    <DateField
                        label="开学日期"
                        value={state.timetable.startDate || ''}
                        onChange={(startDate) => {
                            if (
                                !calendarDate(startDate) ||
                                new Date(startDate + 'T00:00:00Z').getUTCDay() !== 0
                            ) {
                                setLoadError('请选择第一周的星期日。');
                                return;
                            }
                            setDate(startDate);
                            void change((s) => ({
                                ...s,
                                timetable: s.timetable ? {...s.timetable, startDate} : null,
                            })).catch((e) => setLoadError(errorMessage(e)));
                        }}
                    />
                </View>
            )}
            {state.timetable && !state.timetable.startDate && (
                <Banner message="请设置开学日期以显示课程。"/>
            )}
            {settings && !state.timetable && <Label muted>请先获取课表。</Label>}
            <View style={{flexDirection: 'row', borderBottomWidth: 1, borderColor: c.border}}>
                {calendarViews.map((item) => (
                    <Pressable
                        key={item.id}
                        accessibilityRole="tab"
                        accessibilityState={{selected: view === item.id}}
                        onPress={() => setView(item.id)}
                        style={{flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center'}}
                    >
                        <Label
                            weight={view === item.id ? '600' : '400'}
                            style={{color: view === item.id ? c.accent : c.muted}}
                        >
                            {item.label}
                        </Label>
                        {view === item.id && (
                            <View
                                style={{
                                    position: 'absolute',
                                    bottom: 0,
                                    left: '20%',
                                    right: '20%',
                                    height: 3,
                                    borderRadius: 9999,
                                    backgroundColor: c.accent,
                                }}
                            />
                        )}
                    </Pressable>
                ))}
            </View>
            <View
                style={[
                    styles.row,
                    {
                        justifyContent: 'space-between',
                        display: view === 'week' || view === 'day' ? 'none' : 'flex',
                    },
                ]}
            >
                <IconButton
                    name="arrow"
                    label="上一周"
                    onPress={() => setDate(shiftCalendarDate(date, view, -1))}
                />
                <IconButton
                    name="chevron"
                    label="下一周"
                    onPress={() => setDate(shiftCalendarDate(date, view, 1))}
                />
            </View>
            {view === 'week' && state.timetable?.startDate && (
                <Select
                    label="教学周"
                    value={teachingWeek >= 1 && teachingWeek <= weekCount ? teachingWeek : 0}
                    options={[
                        {value: 0, label: '非教学周'},
                        ...Array.from({length: weekCount}, (_, i) => ({
                            value: i + 1,
                            label: '第 ' + (i + 1) + ' 周',
                        })),
                    ]}
                    onChange={(week) => {
                        if (week) setDate(dateAfter(state.timetable!.startDate!, (week - 1) * 7));
                    }}
                />
            )}
            {view === 'year' && (
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                    {Array.from({length: 12}, (_, i) => {
                        const first = date.slice(0, 4) + '-' + String(i + 1).padStart(2, '0') + '-01';
                        return (
                            <Pressable
                                key={first}
                                onPress={() => {
                                    setDate(first);
                                    setView('month');
                                }}
                                style={{
                                    width: '47%',
                                    padding: 8,
                                    gap: 8,
                                    borderRadius: 8,
                                    borderWidth: 1,
                                    borderColor:
                                        first.slice(0, 7) === localToday().slice(0, 7) ? c.accent : 'transparent',
                                }}
                            >
                                <Label size={20} weight="600">
                                    {i + 1}月
                                </Label>
                                <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                                    {calendarWeekdays.map((d) => (
                                        <View key={d} style={{width: '14.2857%', alignItems: 'center'}}>
                                            <Label muted size={10}>
                                                {d}
                                            </Label>
                                        </View>
                                    ))}
                                    {monthDates(first).map((day) => (
                                        <View key={day} style={{width: '14.2857%', height: 22, alignItems: 'center'}}>
                                            <Label
                                                size={10}
                                                style={{
                                                    opacity: day.slice(0, 7) === first.slice(0, 7) ? 1 : 0,
                                                    color: day === localToday() ? c.onAccent : c.text,
                                                    backgroundColor: day === localToday() ? c.accent : 'transparent',
                                                    borderRadius: 10,
                                                    minWidth: 20,
                                                    textAlign: 'center',
                                                }}
                                            >
                                                {Number(day.slice(-2))}
                                            </Label>
                                            {day.slice(0, 7) === first.slice(0, 7) &&
                                                occurrences.some((o) => o.date === day) && (
                                                    <View
                                                        style={{
                                                            width: 3,
                                                            height: 3,
                                                            borderRadius: 2,
                                                            backgroundColor: c.accent,
                                                        }}
                                                    />
                                                )}
                                        </View>
                                    ))}
                                </View>
                            </Pressable>
                        );
                    })}
                </View>
            )}
            {view === 'month' && (
                <View>
                    <View style={{flexDirection: 'row'}}>
                        {calendarWeekdays.map((d) => (
                            <View key={d} style={{width: '14.2857%', alignItems: 'center', paddingBottom: 12}}>
                                <Label muted>{d}</Label>
                            </View>
                        ))}
                    </View>
                    <View style={{flexDirection: 'row', flexWrap: 'wrap'}}>
                        {days.map((day) => (
                            <View
                                key={day}
                                style={{
                                    width: '14.2857%',
                                    minHeight: 118,
                                    borderBottomWidth: 1,
                                    borderColor: c.border,
                                    paddingHorizontal: 2,
                                    opacity: day.slice(0, 7) === date.slice(0, 7) ? 1 : 0.45,
                                }}
                            >
                                {dateButton(day)}
                                {occurrences
                                    .filter((o) => o.date === day && o.event)
                                    .slice(0, 3)
                                    .map((item) => (
                                        <Pressable
                                            key={item.key}
                                            onPress={() => open(item)}
                                            style={{
                                                borderRadius: 4,
                                                backgroundColor: occurrenceColor(item),
                                                padding: 3,
                                                marginBottom: 3,
                                            }}
                                        >
                                            <Label size={10} numberOfLines={1} style={{color: '#252c32'}}>
                                                {item.title}
                                            </Label>
                                        </Pressable>
                                    ))}
                                {occurrences.filter((o) => o.date === day && o.event).length > 3 && (
                                    <Pressable
                                        onPress={() => {
                                            setDate(day);
                                            setView('day');
                                        }}
                                        style={{minHeight: 30}}
                                    >
                                        <Label muted size={11}>
                                            +{occurrences.filter((o) => o.date === day && o.event).length - 3} 项
                                        </Label>
                                    </Pressable>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            )}
            {(view === 'week' || view === 'day') && (
                <CalendarTimeline
                    date={date}
                    today={localToday()}
                    items={occurrences}
                    mode={view}
                    onDate={(value) => {
                        setDate(value);
                        if (view === 'week') setView('day');
                    }}
                    onOpen={open}
                    onCreate={(day, startMinute) => nav.navigate('EventEditor', {date: day, startMinute})}
                    onNavigate={(amount) => setDate(shiftCalendarDate(date, 'week', amount))}
                />
            )}
            {view === 'agenda' && (
                <>
                    {!occurrences.length && <Label muted>暂无日程</Label>}
                    {[...new Set(occurrences.map((o) => o.date))].map((day) => (
                        <View key={day} style={{gap: 12}}>
                            <Label weight="600">
                                {Number(day.slice(5, 7))}月{Number(day.slice(8))}日 星期
                                {calendarWeekdays[new Date(day + 'T00:00:00Z').getUTCDay()]}
                                <Label muted> 农历{lunarDate(day, true)}</Label>
                            </Label>
                            <View
                                style={{
                                    borderWidth: 1,
                                    borderColor: c.border,
                                    backgroundColor: c.surface,
                                    borderRadius: 12,
                                    paddingHorizontal: 12,
                                }}
                            >
                                {occurrences
                                    .filter((o) => o.date === day)
                                    .map((item) => (
                                        <Pressable
                                            key={item.key}
                                            onPress={() => open(item)}
                                            style={[styles.row, {paddingVertical: 16}]}
                                        >
                                            <View style={{width: 44}}>
                                                <Label size={12}>
                                                    {item.allDay ? '全天' : timeLabel(item.startMinute)}
                                                </Label>
                                                {!item.allDay && (
                                                    <Label muted size={12}>
                                                        {timeLabel(item.endMinute)}
                                                    </Label>
                                                )}
                                            </View>
                                            <View
                                                style={{
                                                    width: 3,
                                                    alignSelf: 'stretch',
                                                    borderRadius: 9999,
                                                    backgroundColor: occurrenceColor(item),
                                                }}
                                            />
                                            <View style={{flex: 1, gap: 4}}>
                                                <Label weight="500">{item.title}</Label>
                                                {!!item.location && (
                                                    <Label muted size={12}>
                                                        {item.location}
                                                    </Label>
                                                )}
                                            </View>
                                        </Pressable>
                                    ))}
                            </View>
                        </View>
                    ))}
                    {agendaDays < 360 && (
                        <Button title="显示更多" subtle onPress={() => setAgendaDays((d) => d + 30)}/>
                    )}
                </>
            )}
            <Modal visible={!!course} transparent onRequestClose={() => setCourse(null)}>
                <View
                    style={{flex: 1, backgroundColor: c.overlay, justifyContent: 'center', padding: 24}}
                >
                    <View style={{backgroundColor: c.surface, padding: 20, borderRadius: 16, gap: 16}}>
                        <DialogHeader title={course?.title || ''} onClose={() => setCourse(null)}/>
                        {course && (
                            <>
                                <Label>日期 {course.date}</Label>
                                <Label>
                                    时间 {timeLabel(course.startMinute)}–{timeLabel(course.endMinute)}
                                </Label>
                                <Label>地点 {course.location || '未设置'}</Label>
                                <Label>教师 {course.course?.teachers.join('、') || '未提供'}</Label>
                                <Label>
                                    <Label>节次</Label>
                                    <Label>
                                        第 {course.course?.startUnit}–{course.course?.endUnit} 节
                                    </Label>
                                </Label>
                                <Label>周次 {course.course?.weeks.filter((w) => w > 0).join('、')} 周</Label>
                                <Button
                                    title="查看教学大纲"
                                    subtle
                                    onPress={() => {
                                        const url = course.course && courseSyllabusUrl(course.course);
                                        if (url) nav.navigate('Campus', {title: course.title, url});
                                    }}
                                />
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </Page>
    );
}

export function EventEditor({route, navigation}: ScreenProps<'EventEditor'>) {
    const {state, change} = useStore();
    const existing = state.events.find((e) => e.id === route.params?.id);
    const [form, setForm] = useState<CalendarEventInput>(
        () =>
            existing ?? {
                title: route.params?.title ?? '',
                startDate: route.params?.date || localToday(),
                endDate: dateAfter(
                    route.params?.date || localToday(),
                    (route.params?.startMinute ?? 540) + 60 >= 1440 ? 1 : 0,
                ),
                startTime: timeLabel(route.params?.startMinute ?? 540),
                endTime: timeLabel(((route.params?.startMinute ?? 540) + 60) % 1440),
                allDay: false,
                reminderMinutes: state.settings.noticeSettings.calendarDefaultReminder,
                location: '',
                notes: '',
            },
    );
    const [editing, setEditing] = useState(!existing);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    function patch(update: Partial<CalendarEventInput>) {
        setForm((f) => ({...f, ...update}));
        setError('');
    }

    async function save() {
        const result = validateCalendarEvent(form);
        if (!result.ok) {
            setError(result.error);
            return;
        }
        setBusy(true);
        try {
            const event = {...result.data, id: existing?.id ?? Crypto.randomUUID()};
            await change((s) => ({
                ...s,
                events: [...s.events.filter((e) => e.id !== event.id), event],
            }));
            navigation.goBack();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        setBusy(true);
        try {
            await change((s) => ({...s, events: s.events.filter((e) => e.id !== existing?.id)}));
            navigation.goBack();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setBusy(false);
        }
    }

    return (
        <KeyboardAvoidingView
            style={{flex: 1}}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <Page>
                <DialogHeader
                    title={editing ? (existing ? '编辑日程' : '新建日程') : existing?.title || '日程详情'}
                    onClose={() => navigation.goBack()}
                />
                {editing ? (
                    <>
                        <Field
                            label="名称"
                            value={form.title}
                            onChangeText={(title) => patch({title})}
                            maxLength={200}
                        />
                        <Toggle title="全天" value={form.allDay} onChange={(allDay) => patch({allDay})}/>
                        <DateField
                            label="开始日期"
                            value={form.startDate}
                            onChange={(startDate) =>
                                patch({startDate, endDate: form.endDate < startDate ? startDate : form.endDate})
                            }
                        />
                        {!form.allDay && (
                            <DateField
                                label="开始时间"
                                value={form.startTime}
                                time
                                onChange={(startTime) => patch({startTime})}
                            />
                        )}
                        <DateField
                            label="结束日期"
                            value={form.endDate}
                            onChange={(endDate) => patch({endDate})}
                        />
                        {!form.allDay && (
                            <DateField
                                label="结束时间"
                                value={form.endTime}
                                time
                                onChange={(endTime) => patch({endTime})}
                            />
                        )}
                        <Select
                            label="提醒时间"
                            value={form.reminderMinutes}
                            onChange={(reminderMinutes) => patch({reminderMinutes})}
                            options={calendarReminderOptions}
                        />
                        <Field
                            label="地点"
                            value={form.location}
                            onChangeText={(location) => patch({location})}
                            maxLength={500}
                        />
                        <Field
                            label="备注"
                            value={form.notes}
                            onChangeText={(notes) => patch({notes})}
                            multiline
                            maxLength={5000}
                            style={{minHeight: 100}}
                        />
                        {!!error && <Banner message={error}/>}
                        <View style={[styles.row, {justifyContent: 'flex-end'}]}>
                            <Button title="取消" subtle disabled={busy} onPress={() => navigation.goBack()}/>
                            <Button
                                title={busy ? '正在保存…' : '保存'}
                                disabled={busy}
                                onPress={() => void save()}
                            />
                        </View>
                    </>
                ) : (
                    existing && (
                        <View style={{gap: 16}}>
                            <Label>
                                日期 {existing.startDate}
                                {existing.endDate !== existing.startDate ? ' — ' + existing.endDate : ''}
                            </Label>
                            <Label>
                                时间 {existing.allDay ? '全天' : existing.startTime + '–' + existing.endTime}
                            </Label>
                            <Label>
                                提醒
                                {calendarReminderOptions.find((o) => o.value === existing.reminderMinutes)?.label ||
                                    '无'}
                            </Label>
                            <Label>地点 {existing.location || '未设置'}</Label>
                            {!!existing.notes && <Label>备注 {existing.notes}</Label>}
                            {!!error && <Banner message={error}/>}
                            <Button title="编辑" onPress={() => setEditing(true)}/>
                        </View>
                    )
                )}
                {existing && !editing && (
                    <Button
                        title={confirmDelete ? '确认删除' : '删除'}
                        danger
                        disabled={busy}
                        onPress={() => (confirmDelete ? void remove() : setConfirmDelete(true))}
                    />
                )}
                {confirmDelete && (
                    <Button title="取消删除" subtle onPress={() => setConfirmDelete(false)}/>
                )}
            </Page>
        </KeyboardAvoidingView>
    );
}
