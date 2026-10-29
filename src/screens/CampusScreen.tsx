import { accountSession } from '../services/auth/runtime';
import { Platform } from 'react-native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { Banner, Button, Page } from '../ui';
import { useColors } from '../theme';
import { sourceUrl } from '../shared/sources';
import type { ScreenProps } from '../navigation';
export function CampusScreen({ route, navigation }: ScreenProps<'Campus'>) {
  const c = useColors();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    void (
      Platform.OS !== 'web' &&
      new URL(route.params.url).hostname.endsWith('.fudan.edu.cn') &&
      accountSession.state.status === 'signed-in'
        ? accountSession.openPage(sourceUrl(route.params.url))
        : WebBrowser.openBrowserAsync(sourceUrl(route.params.url))
    )
      .then(() => {
        if (active) navigation.goBack();
      })
      .catch(() => {
        if (active) setError('操作失败，请重试。');
      });
    return () => {
      active = false;
    };
  }, [route.params.url]);
  return (
    <Page>
      {error ? (
        <>
          <Banner message={error} />
          <Button title="返回" subtle onPress={() => navigation.goBack()} />
        </>
      ) : (
        <ActivityIndicator color={c.accent} />
      )}
    </Page>
  );
}
