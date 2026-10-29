import forge from 'node-forge';
import {AuthError} from './protocol';

export function rsaEncryptPassword(
    password: string,
    encodedKey: string,
    random: (size: number) => Uint8Array,
): string {
    const original = forge.random.getBytesSync;
    try {
        const key = forge.pki.publicKeyFromAsn1(forge.asn1.fromDer(forge.util.decode64(encodedKey)));
        forge.random.getBytesSync = (size: number) =>
            Array.from(random(size), (b) => String.fromCharCode(b)).join('');
        return forge.util.encode64(key.encrypt(forge.util.encodeUtf8(password), 'RSAES-PKCS1-V1_5'));
    } catch {
        throw new AuthError('认证公钥无效或密码超过加密长度限制。');
    } finally {
        forge.random.getBytesSync = original;
    }
}
