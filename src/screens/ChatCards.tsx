import { Markdown } from '../components/Markdown';
import React from 'react';
import { Pressable, View } from 'react-native';
import { Banner, Button, Label, styles } from '../ui';
import { useColors } from '../theme';
import { useNav } from '../navigation';
import { noticeKey } from '../model';
import type { ChatTurn } from '../shared/chat';
import { calendarReminderOptions } from '../shared/calendar-reminders';
import { courseSyllabusUrl } from '../shared/timetable';
const actionStatuses = {
  pending: '等待允许',
  executing: '正在执行',
  completed: '已完成',
  rejected: '已拒绝',
  failed: '未完成',
};
const summaryStatuses = {
  pending: '等待允许',
  generating: '正在生成',
  completed: '已完成',
  rejected: '已拒绝',
  failed: '生成失败',
};
export function ChatCards({
  turn,
  busy,
  decide,
}: {
  turn: ChatTurn;
  busy: boolean;
  decide: (kind: 'action' | 'summary', turnId: string, id: string, allow: boolean) => void;
}) {
  const c = useColors();
  const nav = useNav();
  const cardStyle = {
    padding: 16,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    gap: 12,
  };
  return (
    <View style={{ gap: 12 }}>
      {turn.cards.map((card, i) => (
        <Pressable
          key={i}
          accessibilityRole="button"
          disabled={card.kind === 'event' && card.deleted}
          onPress={() => {
            if (card.kind === 'notice') nav.navigate('Notice', { key: noticeKey(card.notice) });
            else if (card.kind === 'event') nav.navigate('EventEditor', { id: card.event.id });
            else
              nav.navigate('Main', {
                screen: 'Calendar',
                params: { view: 'day', date: card.occurrence.date, courseKey: card.occurrence.key },
              });
          }}
          style={cardStyle}
        >
          <Label weight="600">
            {card.kind === 'notice'
              ? card.notice.title
              : card.kind === 'event'
                ? card.event.title
                : card.occurrence.title}
          </Label>
          <Label muted>
            {card.kind === 'notice'
              ? card.notice.sourceName + ' · ' + card.notice.published
              : card.kind === 'event'
                ? card.event.startDate +
                  ' ' +
                  (card.event.allDay ? '全天' : card.event.startTime) +
                  ' — ' +
                  card.event.endDate +
                  ' ' +
                  (card.event.allDay ? '' : card.event.endTime)
                : card.occurrence.date + ' ' + card.occurrence.location}
          </Label>
          {card.kind === 'notice' && !!card.notice.relevance && (
            <Label style={{ color: card.notice.relevance === 'related' ? c.danger : c.muted }}>
              {card.notice.relevance === 'related' ? '@与我有关' : '@可能有关'}
            </Label>
          )}
          {card.kind === 'event' && !!card.event.location && (
            <Label muted>{card.event.location}</Label>
          )}
          {card.kind === 'event' && card.deleted && <Label muted>已删除</Label>}
        </Pressable>
      ))}
      {(turn.actionRequests || []).map((request) => {
        const value =
          request.action.kind === 'create_todo' ? request.action.todo : request.action.after;
        const todo = 'dueDate' in value;
        return (
          <View key={request.id} style={cardStyle}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Label weight="600">{todo ? '新增待办' : '新增日程'}</Label>
              <Label muted>{actionStatuses[request.status]}</Label>
            </View>
            <Label weight="600">{value.title}</Label>
            {todo ? (
              <Label>
                截止时间　{value.dueDate ? value.dueDate + ' ' + value.dueTime : '无截止日期'}
              </Label>
            ) : (
              <>
                <Label>
                  开始　{value.startDate} {value.allDay ? '全天' : value.startTime}
                </Label>
                <Label>
                  结束　{value.endDate} {value.allDay ? '全天' : value.endTime}
                </Label>
                <Label>地点　{value.location || '无'}</Label>
              </>
            )}
            <Label>
              提醒　
              {todo && !value.dueDate
                ? '无'
                : calendarReminderOptions.find((o) => o.value === value.reminderMinutes)?.label ||
                  '无'}
            </Label>
            <Label>备注　{value.notes || '无'}</Label>
            {request.status === 'pending' && (
              <View style={styles.row}>
                <Button
                  title="允许"
                  disabled={busy}
                  onPress={() => decide('action', turn.id, request.id, true)}
                />
                <Button
                  title="拒绝"
                  subtle
                  disabled={busy}
                  onPress={() => decide('action', turn.id, request.id, false)}
                />
              </View>
            )}
            {!!request.error && <Banner message={request.error} />}
          </View>
        );
      })}
      {(turn.summaryRequests || []).map((request) => (
        <View key={request.id} style={cardStyle}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Label weight="600">AI 通知摘要</Label>
            <Label muted>{summaryStatuses[request.status]}</Label>
          </View>
          <Pressable onPress={() => nav.navigate('Notice', { key: noticeKey(request.notice) })}>
            <Label weight="600">{request.notice.title}</Label>
            <Label muted>
              {request.notice.sourceName} · {request.notice.published}
            </Label>
          </Pressable>
          {(request.status === 'pending' || request.status === 'failed') && (
            <View style={styles.row}>
              <Button
                title={request.status === 'failed' ? '允许重试' : '允许'}
                disabled={busy}
                onPress={() => decide('summary', turn.id, request.id, true)}
              />
              <Button
                title="拒绝"
                subtle
                disabled={busy}
                onPress={() => decide('summary', turn.id, request.id, false)}
              />
            </View>
          )}
          {request.status === 'rejected' && <Label>未生成摘要。</Label>}
          {!!request.error && <Banner message={request.error} />}
          {request.status === 'completed' && request.summary && (
            <>
              {request.summary.cached && <Label>已读取已有摘要。</Label>}
              <Markdown>{request.summary.content}</Markdown>
            </>
          )}
        </View>
      ))}
    </View>
  );
}
