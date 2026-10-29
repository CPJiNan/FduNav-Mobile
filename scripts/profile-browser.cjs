const { spawn } = require('node:child_process');
const path = require('node:path');

function electronExecutable() {
  return require('electron');
}

function readProfileInBrowser(input, signal, launch = spawn, executable = electronExecutable) {
  return new Promise((resolve, reject) => {
    const env = { ...process.env };
    delete env.ELECTRON_RUN_AS_NODE;
    const child = launch(executable(), [path.join(__dirname, 'profile-browser-host.cjs')], {
      env,
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      child.kill();
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new Error('已取消学校身份验证。'));
    const timer = setTimeout(
      () => finish(new Error('学校身份验证超时，请重新登录。')),
      input.kind === 'challenge' ? 300000 : 30000,
    );
    signal?.addEventListener('abort', abort, { once: true });
    child.on('error', () => finish(new Error('无法连接消息偏好服务，请重试或重启应用。')));
    child.on('exit', () => finish(new Error('已取消学校身份验证。')));
    child.on('message', (message) => {
      if (message?.ready) child.send(input);
      else if (message?.ok === true) finish(null, message.data);
      else if (message?.ok === false)
        finish(
          Object.assign(new Error(message.error || '无法连接消息偏好服务，请重试或重启应用。'), {
            loginUrl: message.loginUrl,
          }),
        );
    });
    if (signal?.aborted) abort();
  });
}
module.exports = { readProfileInBrowser };
