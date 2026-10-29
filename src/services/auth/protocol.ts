import { load } from 'cheerio/slim';
import { parseNotices } from '../notice-parser';

const ID_BASE = 'https://id.fudan.edu.cn';
const LIST_URL = 'https://jwc.fudan.edu.cn/9397/list.htm';

export class AuthError extends Error {}

export class AdditionalAuthenticationRequired extends AuthError {
  readonly loginUrl: string;
  readonly target: string;

  constructor(loginUrl: string, target: string) {
    super('请在学校认证窗口完成验证。');
    this.loginUrl = validateUrl(loginUrl);
    this.target = validateUrl(target);
  }
}

export function validateUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthError('认证服务返回了无效地址。');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    !(url.hostname === 'fudan.edu.cn' || url.hostname.endsWith('.fudan.edu.cn'))
  ) {
    throw new AuthError('已拒绝访问非 HTTPS 复旦地址。');
  }
  return url.href;
}

export function isAuthUrl(value: string) {
  return ['id.fudan.edu.cn', 'uis.fudan.edu.cn'].includes(new URL(value).hostname);
}

export function authParameters(value: string) {
  const url = new URL(validateUrl(value));
  if (url.hostname !== 'id.fudan.edu.cn')
    throw new AuthError('当前仅支持学校的 Neo 认证，登录方式可能已更新。');
  const params = new URLSearchParams(url.hash.split('?').slice(1).join('?'));
  const lck = params.get('lck'),
    entityId = params.get('entityId');
  if (!lck || !entityId) throw new AuthError('无法解析登录参数，学校登录页面可能已更新。');
  return { lck, entityId };
}

export function ticketUrl(html: string, base: string) {
  const $ = load(html);
  const form = $('form#logon').first();
  const action = form.attr('action');
  const ticket = form.find('input#ticket, input[name="ticket"]').first().attr('value');
  if (!action || !ticket) throw new AuthError('登录票据解析失败，学校页面可能已更新。');
  const url = new URL(validateUrl(new URL(action, base).href));
  url.searchParams.set('ticket', ticket);
  return url.href;
}

function checkPage(html: string) {
  const title = load(html)('title').text().toLowerCase();
  if (title.includes('under maintenance') || title.includes('网络维护'))
    throw new AuthError('学校网站正在维护，请稍后重试。');
}

export interface Page {
  text: string;
  url: string;
}

export interface Transport {
  request(url: string, payload?: Record<string, unknown>, form?: boolean): Promise<Page>;

  post(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

export async function findLogin(transport: Transport) {
  const list = await transport.request(LIST_URL);
  checkPage(list.text);
  if (isAuthUrl(list.url)) return { loginUrl: list.url, target: LIST_URL };
  const targets = parseNotices(list.text, list.url, 'jwc')
    .slice(0, 8)
    .map((notice) => notice.url);
  for (const target of targets) {
    const page = await transport.request(target);
    checkPage(page.text);
    if (isAuthUrl(page.url)) return { loginUrl: page.url, target };
  }
  throw new AuthError('未找到需要认证的教务通知，无法建立登录流程。请稍后重试。');
}

export async function authenticate(
  transport: Transport,
  username: string,
  password: string,
  encryptPassword: (password: string, key: string) => string,
) {
  const { loginUrl, target } = await findLogin(transport);
  const additionalAuthentication = () => new AdditionalAuthenticationRequired(loginUrl, target);
  let params: ReturnType<typeof authParameters>;
  try {
    params = authParameters(loginUrl);
  } catch (error) {
    if (error instanceof AuthError) throw additionalAuthentication();
    throw error;
  }
  const methods = await transport.post('/idp/authn/queryAuthMethods', params);
  if (methods.second) throw additionalAuthentication();
  const entries = Array.isArray(methods.data) ? methods.data : [];
  const chain = entries.find(
    (item: any) => item && item.moduleCode === 'userAndPwd',
  )?.authChainCode;
  if (typeof chain !== 'string' || !chain) throw additionalAuthentication();
  const key = (await transport.post('/idp/authn/getJsPublicKey', {})).data;
  if (typeof key !== 'string') throw new AuthError('认证服务未返回有效公钥。');
  const result = await transport.post('/idp/authn/authExecute', {
    ...params,
    authModuleCode: 'userAndPwd',
    authChainCode: chain,
    requestType: 'chain_type',
    authPara: { loginName: username, password: encryptPassword(password, key), verifyCode: '' },
  });
  const message = typeof result.message === 'string' ? result.message : '';
  if (result.second || /验证码|二次验证|二次认证/.test(message)) throw additionalAuthentication();
  if (typeof result.loginToken !== 'string' || !result.loginToken) {
    if (
      /(?:密码|用户名|账号|帐号).*(?:错误|不正确|有误|不存在)|invalid credentials/i.test(message)
    ) {
      throw new AuthError('学号或密码不正确，请检查后重试。');
    }
    throw additionalAuthentication();
  }
  const page = await transport.request(
    `${ID_BASE}/idp/authCenter/authnEngine`,
    { loginToken: result.loginToken },
    true,
  );
  let ticket: string;
  try {
    ticket = ticketUrl(page.text, page.url);
  } catch (error) {
    if (error instanceof AuthError && isAuthUrl(page.url)) throw additionalAuthentication();
    throw error;
  }
  await transport.request(ticket);
  if (!(await verifySession(transport, target))) throw additionalAuthentication();
  return target;
}

export async function verifySession(transport: Transport, target: string) {
  const page = await transport.request(validateUrl(target));
  checkPage(page.text);
  if (isAuthUrl(page.url)) return false;
  if (new URL(page.url).hostname !== 'jwc.fudan.edu.cn')
    throw new AuthError('会话验证返回了非预期页面。');
  const $ = load(page.text);
  if (
    !$('.wp_articlecontent, #vsb_content, .v_news_content, article, a[href*="page.htm"]').length
  ) {
    throw new AuthError('无法确认目标页面权限，学校页面可能已更新。');
  }
  return true;
}
