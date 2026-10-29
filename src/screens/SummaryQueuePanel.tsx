import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Modal, Pressable, ScrollView, View} from 'react-native';
import {useStore} from '../Store';
import {useAuth} from '../Auth';
import {useNav} from '../navigation';
import {useColors} from '../theme';
import {Button, DialogHeader, IconButton, Label, styles} from '../ui';
import {noticeKey} from '../model';
import {type SummaryTask, summaryTaskFinished} from '../shared/notices';

const labels = {
    queued: '等待中',
    reading: '读取正文',
    generating: '生成摘要',
    saving: '保存摘要',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
};

export function SummaryQueuePanel() {
    const {summaries} = useStore();
    const {account} = useAuth();
    const nav = useNav();
    const c = useColors();
    const [tasks, setTasks] = useState<SummaryTask[]>([]);
    const [open, setOpen] = useState(false);
    useEffect(() => {
        const update = () => setTasks(summaries.queue.snapshot(account.username || ''));
        update();
        return summaries.queue.subscribe(update);
    }, [summaries, account.username]);
    useEffect(() => {
        if (!tasks.length) setOpen(false);
    }, [tasks]);
    if (!tasks.length) return null;
    const pending = tasks.filter((t) => !summaryTaskFinished(t));
    const ordered = [...pending, ...tasks.filter(summaryTaskFinished).reverse()];
    return (
        <View style={{position: 'absolute', right: 12, bottom: 68}}>
            <IconButton
                name="sparkles"
                label={'摘要队列，' + pending.length + ' 项待完成'}
                onPress={() => setOpen(true)}
            />
            <Modal visible={open} transparent onRequestClose={() => setOpen(false)}>
                <View
                    style={{flex: 1, backgroundColor: c.overlay, justifyContent: 'flex-end', padding: 16}}
                >
                    <View
                        style={{
                            maxHeight: '80%',
                            backgroundColor: c.surface,
                            padding: 16,
                            borderRadius: 16,
                            gap: 12,
                        }}
                    >
                        <DialogHeader title="摘要队列" onClose={() => setOpen(false)}/>
                        <ScrollView>
                            {ordered.map((task) => (
                                <View
                                    key={task.id}
                                    style={[
                                        styles.row,
                                        {borderBottomWidth: 1, borderColor: c.border, paddingVertical: 12},
                                    ]}
                                >
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={'打开通知：' + task.title}
                                        style={{flex: 1, gap: 8}}
                                        onPress={() => {
                                            setOpen(false);
                                            nav.navigate('Notice', {key: noticeKey(task)});
                                        }}
                                    >
                                        <Label muted>{labels[task.status]}</Label>
                                        <Label>{task.title}</Label>
                                        {!summaryTaskFinished(task) && task.status !== 'queued' && (
                                            <ActivityIndicator color={c.accent}/>
                                        )}
                                        {!!task.error && <Label style={{color: c.danger}}>{task.error}</Label>}
                                    </Pressable>
                                    <IconButton
                                        name="close"
                                        label={'删除卡片：' + task.title}
                                        onPress={() => summaries.queue.remove([task.id], account.username || '')}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                        <Button
                            title="全部清除"
                            subtle
                            disabled={!tasks.some((t) => t.status === 'completed')}
                            onPress={() => summaries.queue.clear(account.username || '')}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}
