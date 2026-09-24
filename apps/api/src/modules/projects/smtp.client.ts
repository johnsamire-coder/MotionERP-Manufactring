import { connect as netConnect, type Socket } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

/**
 * Minimal SMTP sender (plan item 44) — no dependency. Supports smtp:// (plain, e.g. a local relay)
 * and smtps:// (implicit TLS, port 465) with optional AUTH LOGIN. URL: smtps://user:pass@host:465
 */
export async function sendMail(
  url: string,
  from: string,
  to: string[],
  subject: string,
  body: string,
  timeoutMs = 15_000,
): Promise<void> {
  const u = new URL(url);
  const secure = u.protocol === 'smtps:';
  const port = Number(u.port || (secure ? 465 : 25));
  const socket: Socket = secure
    ? tlsConnect({ host: u.hostname, port, servername: u.hostname })
    : netConnect({ host: u.hostname, port });
  socket.setEncoding('utf8');
  socket.setTimeout(timeoutMs);

  let buffer = '';
  const waiters: Array<(line: string) => void> = [];
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    let idx: number;
    // a reply ends with a line whose 4th char is a space ("250 OK"); "250-..." lines continue it
    while ((idx = buffer.search(/^\d{3} .*\r\n/m)) !== -1) {
      const end = buffer.indexOf('\r\n', idx) + 2;
      const reply = buffer.slice(0, end);
      buffer = buffer.slice(end);
      waiters.shift()?.(reply);
    }
  });
  const failed = new Promise<never>((_, reject) => {
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error('SMTP timeout'));
    });
  });
  const reply = (): Promise<string> =>
    Promise.race([new Promise<string>((res) => waiters.push(res)), failed]);
  const expect = async (code: string, send?: string): Promise<void> => {
    const pending = reply();
    if (send !== undefined) socket.write(`${send}\r\n`);
    const r = await pending;
    if (!r.split('\r\n').filter(Boolean).at(-1)!.startsWith(code))
      throw new Error(`SMTP: expected ${code}, got "${r.trim()}"`);
  };

  try {
    await expect('220');
    await expect('250', `EHLO motion-erp`);
    if (u.username) {
      await expect('334', 'AUTH LOGIN');
      await expect('334', Buffer.from(decodeURIComponent(u.username)).toString('base64'));
      await expect('235', Buffer.from(decodeURIComponent(u.password)).toString('base64'));
    }
    await expect('250', `MAIL FROM:<${from}>`);
    for (const r of to) await expect('250', `RCPT TO:<${r}>`);
    await expect('354', 'DATA');
    const headers = [
      `From: ${from}`,
      `To: ${to.join(', ')}`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      `Date: ${new Date().toUTCString()}`,
    ];
    const encoded = Buffer.from(body).toString('base64').replace(/.{76}/g, '$&\r\n');
    await expect('250', `${headers.join('\r\n')}\r\n\r\n${encoded}\r\n.`);
    socket.write('QUIT\r\n');
  } finally {
    socket.end();
  }
}
