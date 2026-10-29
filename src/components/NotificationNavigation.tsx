import {useEffect} from 'react';
import {useAuth} from '../Auth';
import {useNav} from '../navigation';
import {listenReminderClicks} from '../services/reminders';

export function NotificationNavigation() {
    const {account} = useAuth();
    const nav = useNav();
    useEffect(
        () =>
            listenReminderClicks((data) => {
                if (data.owner !== account.username) return;
                if (data.kind === 'notice') nav.navigate('Main', {screen: 'Notices'});
                else if (data.kind === 'todo') nav.navigate('Main', {screen: 'Todos'});
                else if (data.kind === 'event') nav.navigate('Main', {screen: 'Calendar'});
            }),
        [account.username, nav],
    );
    return null;
}
