import React, {useEffect, useState} from 'react';
import {View} from 'react-native';
import {useAuth} from '../Auth';
import {errorMessage} from '../Store';
import {Banner, Button, Field, Icon, Label, styles} from '../ui';

const statusLabels = {
    'signed-out': '未登录',
    'signed-in': '已登录',
    unverified: '待验证会话',
    expired: '登录已过期',
};

export function AccountPanel() {
    const {account, busy, login, verify, logout} = useAuth();
    const [username, setUsername] = useState(account.username || '');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    useEffect(() => {
        setUsername(account.username || '');
        setError(
            account.status === 'expired' || account.status === 'unverified' ? account.message : '',
        );
    }, [account]);

    async function perform(label: string, action: () => Promise<void>) {
        setStatus(label);
        setError('');
        try {
            await action();
        } catch (e) {
            setError(errorMessage(e));
        } finally {
            setStatus('');
        }
    }

    return (
        <View style={{gap: 16}}>
            {!!account.username && (
                <View style={styles.row}>
                    <Icon name="user" size={28}/>
                    <View>
                        <Label weight="600">{account.username}</Label>
                        <Label muted>{statusLabels[account.status]}</Label>
                    </View>
                </View>
            )}
            {!!error && <Banner message={error}/>}
            {account.status !== 'signed-in' && account.status !== 'unverified' && (
                <>
                    <Field
                        label="学号 / 工号"
                        placeholder="请输入学号或工号"
                        autoComplete="username"
                        autoCapitalize="none"
                        autoCorrect={false}
                        maxLength={128}
                        editable={!busy && !status}
                        value={username}
                        onChangeText={setUsername}
                    />
                    <Field
                        label="统一身份认证密码"
                        placeholder="请输入密码"
                        autoComplete="current-password"
                        secureTextEntry
                        maxLength={1024}
                        editable={!busy && !status}
                        value={password}
                        onChangeText={setPassword}
                    />
                    <Button
                        title="登录"
                        disabled={busy || !!status || !username.trim() || !password}
                        onPress={() => {
                            const input = {username: username.trim(), password};
                            setPassword('');
                            void perform('正在登录，请稍候…', () =>
                                login(input).finally(() => {
                                    input.password = '';
                                }),
                            );
                        }}
                    />
                </>
            )}
            {!!account.username && (
                <>
                    <View style={styles.row}>
                        {account.status === 'unverified' && (
                            <Button
                                title="验证会话"
                                subtle
                                disabled={busy || !!status}
                                onPress={() => void perform('正在验证会话…', verify)}
                            />
                        )}
                        <Button
                            title="退出登录"
                            subtle
                            disabled={busy || !!status}
                            onPress={() => void perform('正在退出…', logout)}
                        />
                    </View>
                    {account.status !== 'unverified' && !!account.lastLogin && (
                        <Label muted size={12}>
                            上次登录：{new Date(account.lastLogin).toLocaleString('zh-CN')}
                        </Label>
                    )}
                </>
            )}
            {(!!status || busy) && <Label muted>{status || '正在登录，请稍候…'}</Label>}
        </View>
    );
}
