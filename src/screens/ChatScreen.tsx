import { Markdown } from '../components/Markdown';
import { ChatCards } from './ChatCards';
import type { ChatState } from '../shared/chat';
import { useAuth } from '../Auth';
import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useStore, errorMessage } from '../Store';
import { useColors } from '../theme';
import { Banner, Button, Icon, IconButton, Label, styles } from '../ui';
import { useNav } from '../navigation';

export function ChatScreen() {
  const { state, chat, refresh, refreshCalendar } = useStore();
  const { account } = useAuth();
  const [conversation, setConversation] = useState<ChatState>({
    username: account.username || '',
    turns: [],
    busy: false,
    status: '',
  });
  const [syncing, setSyncing] = useState(true);
  const [deciding, setDeciding] = useState(false);
  const c = useColors();
  const nav = useNav();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useEffect(() => {
    const unsub = chat.subscribe(setConversation);
    void chat
      .invoke('get')
      .then((r) => {
        if (r.ok) setConversation(r.data);
        else setError(r.error);
      })
      .catch((e) => setError(errorMessage(e)));
    void Promise.allSettled([
      refresh(),
      ...(state.settings.preferences.identity === 'student'
        ? [refreshCalendar(undefined, false)]
        : []),
    ]).then((results) => {
      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => errorMessage((r as PromiseRejectedResult).reason));
      if (errors.length) setError(errors.join(' '));
      setSyncing(false);
    });
    return unsub;
  }, [chat]);
  useEffect(() => setBusy(conversation.busy), [conversation.busy]);
  async function decide(
    kind: 'action' | 'summary',
    turnId: string,
    requestId: string,
    allow: boolean,
  ) {
    setDeciding(true);
    try {
      const result = await chat.invoke('decide-' + kind, { turnId, requestId, allow });
      if (result.ok) setConversation(result.data);
      else setError(result.error);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setDeciding(false);
    }
  }

  const ready =
    state.settings.llm.enabled && !!state.settings.llm.baseUrl && !!state.settings.llm.model;
  async function send() {
    if (busy || syncing || !draft.trim()) return;
    setError('');
    try {
      const result = await chat.invoke('send', draft.trim());
      if (!result.ok) throw new Error(result.error);
      setConversation(result.data);
      setDraft('');
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.surface }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.row,
          { justifyContent: 'flex-end', paddingHorizontal: 12, paddingTop: 4, gap: 4 },
        ]}
      >
        <IconButton
          name="clean"
          label="清空聊天"
          disabled={busy || !conversation.turns.length}
          onPress={() => setConfirmClear(true)}
        />
        <IconButton
          name="settings"
          label="LLM 设置"
          onPress={() => nav.navigate('Settings', { section: 'llm' })}
        />
      </View>
      {confirmClear && (
        <View style={{ padding: 16, gap: 12 }}>
          <Label>清空聊天记录？</Label>
          <View style={styles.row}>
            <Button
              title="清空"
              onPress={() =>
                void chat
                  .invoke('clear')
                  .then((r) => {
                    if (!r.ok) throw new Error(r.error);
                    setConversation(r.data);
                  })
                  .then(() => {
                    setConfirmClear(false);
                    setError('');
                  })
                  .catch(() => {})
              }
            />
            <Button title="取消" subtle onPress={() => setConfirmClear(false)} />
          </View>
        </View>
      )}
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          padding: 20,
          gap: 20,
          maxWidth: 800,
          width: '100%',
          alignSelf: 'center',
          flexGrow: 1,
        }}
        onContentSizeChange={() => {
          if (busy) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {!conversation.turns.length ? (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 24,
              paddingVertical: 24,
            }}
          >
            <View style={{ width: 58, height: 58, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="chat" size={28} color={c.accent} />
            </View>
            <Label size={26} weight="600">
              有什么可以帮你？
            </Label>
            <View style={{ gap: 10, width: '100%', maxWidth: 340 }}>
              {['本周通知摘要', '查询今天日程', '新增待办事项'].map((q) => (
                <Pressable
                  key={q}
                  accessibilityRole="button"
                  onPress={() => setDraft(q)}
                  style={[
                    styles.row,
                    {
                      minHeight: 44,
                      paddingVertical: 12,
                      paddingHorizontal: 16,
                      borderWidth: 1,
                      borderColor: c.border,
                      borderRadius: 14,
                      justifyContent: 'center',
                      gap: 8,
                    },
                  ]}
                >
                  <Label style={{ color: c.secondary }}>{q}</Label>
                  <Icon name="chevron" size={14} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          conversation.turns.map((turn) => (
            <View key={turn.id} style={{ gap: 20 }}>
              <View
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  paddingVertical: 12,
                  paddingHorizontal: 18,
                  borderRadius: 20,
                  borderBottomRightRadius: 5,
                  backgroundColor: c.selected,
                }}
              >
                <Label size={16} selectable>
                  {turn.user}
                </Label>
              </View>
              {!!turn.reply && <Markdown>{turn.reply}</Markdown>}
              <ChatCards
                turn={turn}
                busy={busy || deciding}
                decide={(...args) => void decide(...args)}
              />
              {!!turn.error && <Banner message={turn.error} />}
            </View>
          ))
        )}
        {syncing && <Label muted>正在刷新通知和课表…</Label>}
        {busy && <Label muted>{conversation.status || '正在思考'}</Label>}
        {!!error && <Banner message={error} />}
      </ScrollView>
      <View style={{ padding: 16, paddingTop: 8 }}>
        <View
          style={{
            backgroundColor: c.elevated,
            borderRadius: 24,
            padding: 12,
            boxShadow: c.dark
              ? '0 12px 48px rgba(0,0,0,0.24), 0 2px 8px rgba(0,0,0,0.16)'
              : '0 12px 48px rgba(27,44,57,0.06), 0 2px 8px rgba(27,44,57,0.04)',
          }}
        >
          <TextInput
            accessibilityLabel="聊天消息"
            placeholder="发送消息…"
            placeholderTextColor={c.muted}
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={8000}
            style={{ color: c.text, minHeight: 64, maxHeight: 160, padding: 8, fontSize: 16 }}
          />
          <View style={{ alignItems: 'flex-end' }}>
            <IconButton
              name={busy ? 'stop' : 'send'}
              label={busy ? '停止回复' : '发送'}
              disabled={!busy && (!draft.trim() || !ready || syncing)}
              onPress={() =>
                busy
                  ? void chat.invoke('cancel').catch((e) => setError(errorMessage(e)))
                  : void send()
              }
            />
          </View>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
