import {fetch as expoFetch} from 'expo/fetch';
import * as Crypto from 'expo-crypto';
import {AccountSession} from './session';
import {sessionStorage} from './secure-session';
import {rsaEncryptPassword} from './rsa';
import {schoolBrowser} from './browser-bridge';
import {clearSchoolCookies} from './web-cookies';

export const accountSession = new AccountSession({
    fetch: expoFetch,
    storage: sessionStorage,
    encrypt: (password, key) => rsaEncryptPassword(password, key, Crypto.getRandomBytes),
    browser: {...schoolBrowser, clear: clearSchoolCookies},
});
