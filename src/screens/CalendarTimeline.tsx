import React, {useEffect, useRef} from 'react';
import {Pressable, ScrollView, useWindowDimensions, View} from 'react-native';
import {IconButton, Label, styles} from '../ui';
import {useColors} from '../theme';
import {
    calendarDate,
    type CalendarOccurrence,
    calendarWeekdays,
    layoutCalendarDay,
    lunarDate,
    timeLabel,
    weekStartDate,
} from '../shared/calendar';
import {dateAfter} from '../shared/timetable';
import {calendarEventColor, courseColor} from '../design/timetable-colors';

const HOUR = 104;
const AXIS = 26;

const color = (item: CalendarOccurrence) =>
    item.course ? courseColor(item.course) : calendarEventColor(item.event?.id ?? item.key);
export const eventTime = (item: CalendarOccurrence) =>
    item.allDay ? '全天' : timeLabel(item.startMinute) + '–' + timeLabel(item.endMinute);

const weekdayOf = (day: string) => '周' + calendarWeekdays[new Date(day + 'T00:00:00Z').getUTCDay()];

export function CalendarTimeline({
                                     date,
                                     today,
                                     items,
                                     mode,
                                     onDate,
                                     onOpen,
                                     onCreate,
                                     onNavigate,
                                 }: {
    date: string;
    today: string;
    items: CalendarOccurrence[];
    mode: 'week' | 'day';
    onDate: (date: string) => void;
    onOpen: (item: CalendarOccurrence) => void;
    onCreate: (date: string, minute: number) => void;
    onNavigate: (amount: number) => void;
}) {
    const c = useColors();
    const {height} = useWindowDimensions();
    const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const week = Array.from({length: 7}, (_, i) => dateAfter(weekStartDate(date), i));
    const days = mode === 'week' ? week : [date];
    const allDay = items.filter((item) => item.allDay);
    useEffect(() => {
        scroll.current?.scrollTo({y: 6 * HOUR, animated: false});
    }, [date, mode]);

    const header = (day: string) => (
        <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={day}
            accessibilityState={{selected: date === day}}
            onPress={() => onDate(day)}
            style={{flex: 1, alignItems: 'center', paddingVertical: 4, gap: 1}}
        >
            <Label muted size={9} style={{lineHeight: 12}} numberOfLines={1}>
                {weekdayOf(day)}
            </Label>
            <View
                style={{
                    width: 20,
                    height: 20,
                    borderRadius: 10,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: day === today ? c.accent : 'transparent',
                    borderWidth: day === date ? 1 : 0,
                    borderColor: c.accent,
                }}
            >
                <Label
                    size={11}
                    weight="500"
                    style={{lineHeight: 14, color: day === today ? c.onAccent : c.text}}
                >
                    {Number(day.slice(8))}
                </Label>
            </View>
            <Label muted size={8} style={{lineHeight: 10}} numberOfLines={1}>
                {lunarDate(day)}
            </Label>
        </Pressable>
    );

    const card = (item: CalendarOccurrence, timed = false, lane = 0, lanes = 1) => (
        <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.title + '，' + eventTime(item) + '，' + item.location}
            onPress={() => onOpen(item)}
            style={[
                {
                    backgroundColor: color(item),
                    borderWidth: 1,
                    borderColor: c.border,
                    borderRadius: 4,
                    overflow: 'hidden',
                },
                timed
                    ? {
                        position: 'absolute',
                        top: (item.startMinute / 60) * HOUR,
                        height: Math.max(24, ((item.endMinute - item.startMinute) / 60) * HOUR),
                        left: ((lane / lanes) * 100 + '%') as any,
                        width: (100 / lanes + '%') as any,
                        paddingHorizontal: mode === 'week' ? 3 : 6,
                        paddingVertical: mode === 'week' ? 3 : 6,
                        paddingLeft: mode === 'week' ? 5 : 10,
                    }
                    : {paddingHorizontal: 3, paddingVertical: 2},
            ]}
        >
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: mode === 'week' ? 3 : 4,
                    right: 0,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                }}
            />
            {mode === 'week' ? (
                <>
                    <Label
                        size={10}
                        weight="600"
                        numberOfLines={4}
                        style={{color: '#252c32', lineHeight: 13}}
                    >
                        {item.title}
                    </Label>
                    {!!item.location && (
                        <Label size={9} numberOfLines={2} style={{color: '#252c32', lineHeight: 11}}>
                            {item.location}
                        </Label>
                    )}
                </>
            ) : (
                <>
                    <Label size={12} weight="600" numberOfLines={3} style={{color: '#252c32'}}>
                        {item.title}
                    </Label>
                    {timed && (
                        <>
                            <Label size={12} style={{color: '#252c32'}}>
                                {eventTime(item)}
                            </Label>
                            {!!item.location && (
                                <Label size={12} numberOfLines={2} style={{color: '#252c32'}}>
                                    {item.location}
                                </Label>
                            )}
                            {item.course && (
                                <Label size={12} style={{color: '#252c32'}}>
                                    第 {item.course.startUnit}–{item.course.endUnit} 节
                                </Label>
                            )}
                        </>
                    )}
                </>
            )}
        </Pressable>
    );

    return (
        <View
            style={{
                height: Math.max(360, height - 250),
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 8,
                overflow: 'hidden',
            }}
        >
            <ScrollView ref={scroll} nestedScrollEnabled stickyHeaderIndices={[0]}>
                <View style={{backgroundColor: c.surface, zIndex: 5}}>
                    <View style={[styles.row, {justifyContent: 'space-between', paddingHorizontal: 4}]}>
                        <IconButton
                            name="arrow"
                            label={mode === 'week' ? '上一周' : '上一天'}
                            disabled={date === '1900-01-01'}
                            onPress={() => onNavigate(-1)}
                        />
                        <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                            <Label weight="600" size={13} numberOfLines={1}>
                                {mode === 'week'
                                    ? `${Number(week[0].slice(5, 7))}/${Number(week[0].slice(8))} – ${Number(week[6].slice(5, 7))}/${Number(week[6].slice(8))}`
                                    : `${weekdayOf(date)} ${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`}
                            </Label>
                        </View>
                        <IconButton
                            name="chevron"
                            label={mode === 'week' ? '下一周' : '下一天'}
                            disabled={date === '2100-12-31'}
                            onPress={() => onNavigate(1)}
                        />
                    </View>
                    {mode === 'week' && (
                        <View style={{flexDirection: 'row', paddingLeft: AXIS}}>
                            {days.map((day) => header(day))}
                        </View>
                    )}
                    {!!allDay.length && (
                        <View
                            style={{
                                flexDirection: 'row',
                                paddingLeft: AXIS,
                                borderTopWidth: 1,
                                borderBottomWidth: 1,
                                borderColor: c.border,
                            }}
                        >
                            <View
                                style={{
                                    position: 'absolute',
                                    left: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: AXIS,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Label muted size={8} numberOfLines={1}>
                                    全天
                                </Label>
                            </View>
                            {days.map((day) => (
                                <View
                                    key={day}
                                    style={{
                                        flex: 1,
                                        gap: 2,
                                        padding: 2,
                                        minHeight: 18,
                                        borderLeftWidth: 1,
                                        borderColor: c.border,
                                    }}
                                >
                                    {allDay
                                        .filter((item) => item.date === day)
                                        .map((item) => card(item))}
                                </View>
                            ))}
                        </View>
                    )}
                </View>
                <View style={{flexDirection: 'row'}}>
                    <View style={{width: AXIS}}>
                        {Array.from({length: 24}, (_, hour) => (
                            <View
                                key={hour}
                                style={{
                                    height: HOUR,
                                    borderBottomWidth: 1,
                                    borderColor: c.border,
                                    paddingTop: 3,
                                    alignItems: 'center',
                                }}
                            >
                                <Label muted size={8} numberOfLines={1} style={{lineHeight: 10}}>
                                    {timeLabel(hour * 60)}
                                </Label>
                            </View>
                        ))}
                    </View>
                    {days.map((day) => (
                        <View
                            key={day}
                            style={{
                                flex: 1,
                                height: 24 * HOUR,
                                borderLeftWidth: 1,
                                borderColor: c.border,
                            }}
                        >
                            {Array.from({length: 24}, (_, hour) => (
                                <Pressable
                                    key={hour}
                                    accessibilityRole="button"
                                    accessibilityLabel={day + ' ' + timeLabel(hour * 60) + ' 新建日程'}
                                    disabled={!calendarDate(day)}
                                    onPress={() => onCreate(day, hour * 60)}
                                    style={{height: HOUR, borderBottomWidth: 1, borderColor: c.border}}
                                />
                            ))}
                            {layoutCalendarDay(
                                items.filter((item) => item.date === day && !item.allDay),
                            ).map(({item, lane, lanes}) => card(item, true, lane, lanes))}
                        </View>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
}
