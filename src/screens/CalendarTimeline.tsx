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

const color = (item: CalendarOccurrence) =>
    item.course ? courseColor(item.course) : calendarEventColor(item.event?.id ?? item.key);
export const eventTime = (item: CalendarOccurrence) =>
    item.allDay ? '全天' : timeLabel(item.startMinute) + '–' + timeLabel(item.endMinute);

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
    const {width, height} = useWindowDimensions();
    const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
    const week = Array.from({length: 7}, (_, i) => dateAfter(weekStartDate(date), i));
    const days = mode === 'week' ? week : [date];
    const contentWidth = mode === 'week' ? Math.max(width - 34, 690) : Math.min(width - 34, 766);
    const axis = mode === 'week' ? 52 : 36;
    useEffect(() => {
        scroll.current?.scrollTo({y: 7 * 64, animated: false});
    }, [date, mode]);
    const event = (item: CalendarOccurrence, timed = false, lane = 0, lanes = 1) => (
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
                    padding: 5,
                    paddingLeft: 9,
                },
                timed
                    ? {
                        position: 'absolute',
                        top: (item.startMinute / 60) * 64,
                        height: ((item.endMinute - item.startMinute) / 60) * 64,
                        left: ((lane / lanes) * 100 + '%') as any,
                        width: (100 / lanes + '%') as any,
                    }
                    : {},
            ]}
        >
            <View
                pointerEvents="none"
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: 4,
                    right: 0,
                    backgroundColor: 'rgba(255,255,255,0.3)',
                }}
            />
            <Label size={12} weight="600" numberOfLines={timed ? 3 : 1} style={{color: '#252c32'}}>
                {item.title}
            </Label>
            {timed && (
                <>
                    <Label size={12} style={{color: '#252c32'}}>
                        {eventTime(item)}
                    </Label>
                    {!!item.location && (
                        <Label size={12} style={{color: '#252c32'}}>
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
        </Pressable>
    );
    return (
        <View
            style={{
                height: Math.max(320, height - 250),
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 8,
                overflow: 'hidden',
            }}
        >
            <ScrollView
                horizontal
                nestedScrollEnabled
                scrollEnabled={mode === 'week'}
                showsHorizontalScrollIndicator={mode === 'week'}
            >
                <ScrollView
                    ref={scroll}
                    nestedScrollEnabled
                    stickyHeaderIndices={[0]}
                    style={{width: contentWidth}}
                    accessibilityLabel={mode === 'week' ? '每周课表' : '当天时间轴'}
                >
                    <View style={{backgroundColor: c.surface, zIndex: 5}}>
                        <View style={{flexDirection: 'row', paddingLeft: axis}}>
                            {week.map((day) => (
                                <Pressable
                                    key={day}
                                    accessibilityRole="button"
                                    accessibilityLabel={day}
                                    accessibilityState={{selected: date === day}}
                                    onPress={() => onDate(day)}
                                    style={{
                                        flex: 1,
                                        minHeight: 84,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 2,
                                    }}
                                >
                                    <Label muted size={11}>
                                        {calendarWeekdays[new Date(day + 'T00:00:00Z').getUTCDay()]}
                                    </Label>
                                    <View
                                        style={{
                                            width: 28,
                                            height: 28,
                                            borderRadius: 99,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: day === today ? c.accent : 'transparent',
                                            borderWidth: day === date ? 1 : 0,
                                            borderColor: c.accent,
                                        }}
                                    >
                                        <Label size={16} style={{color: day === today ? c.onAccent : c.text}}>
                                            {Number(day.slice(8))}
                                        </Label>
                                    </View>
                                    <Label muted size={11}>
                                        {lunarDate(day)}
                                    </Label>
                                </Pressable>
                            ))}
                        </View>
                        <View style={[styles.row, {justifyContent: 'space-between'}]}>
                            <IconButton
                                name="arrow"
                                label="上一周"
                                disabled={date === '1900-01-01'}
                                onPress={() => onNavigate(-1)}
                            />
                            <IconButton
                                name="chevron"
                                label="下一周"
                                disabled={date === '2100-12-31'}
                                onPress={() => onNavigate(1)}
                            />
                        </View>
                        <View
                            style={{
                                flexDirection: 'row',
                                minHeight: 40,
                                borderBottomWidth: 1,
                                borderColor: c.border,
                            }}
                        >
                            <View style={{width: axis, justifyContent: 'center', alignItems: 'center'}}>
                                <Label muted size={12}>
                                    全天
                                </Label>
                            </View>
                            {days.map((day) => (
                                <ScrollView
                                    key={day}
                                    style={{flex: 1, maxHeight: 110}}
                                    contentContainerStyle={{gap: 3, padding: 4}}
                                >
                                    {items
                                        .filter((item) => item.date === day && item.allDay)
                                        .map((item) => event(item))}
                                </ScrollView>
                            ))}
                        </View>
                    </View>
                    <View style={{flexDirection: 'row'}}>
                        <View style={{width: axis}}>
                            {Array.from({length: 24}, (_, hour) => (
                                <View
                                    key={hour}
                                    style={{
                                        height: 64,
                                        borderBottomWidth: 1,
                                        borderColor: c.border,
                                        paddingTop: 4,
                                        alignItems: 'center',
                                    }}
                                >
                                    <Label muted size={11}>
                                        {timeLabel(hour * 60)}
                                    </Label>
                                </View>
                            ))}
                        </View>
                        {days.map((day) => (
                            <View
                                key={day}
                                style={{flex: 1, height: 24 * 64, borderLeftWidth: 1, borderColor: c.border}}
                            >
                                {Array.from({length: 24}, (_, hour) => (
                                    <Pressable
                                        key={hour}
                                        accessibilityRole="button"
                                        accessibilityLabel={day + ' ' + timeLabel(hour * 60) + ' 新建日程'}
                                        disabled={!calendarDate(day)}
                                        onPress={() => onCreate(day, hour * 60)}
                                        style={{height: 64, borderBottomWidth: 1, borderColor: c.border}}
                                    />
                                ))}
                                {layoutCalendarDay(items.filter((item) => item.date === day && !item.allDay)).map(
                                    ({item, lane, lanes}) => event(item, true, lane, lanes),
                                )}
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </ScrollView>
        </View>
    );
}
