import { createServer, type Server } from 'node:net';
import { sendMail } from './smtp.client';

describe('Minimal SMTP client (plan item 44)', () => {
  let server: Server;
  let port = 0;
  let transcript: string[] = [];

  beforeAll(async () => {
    server = createServer((s) => {
      s.setEncoding('utf8');
      s.write('220 fake ready\r\n');
      let data = false;
      let buf = '';
      s.on('data', (chunk: string) => {
        buf += chunk;
        let i: number;
        while ((i = buf.indexOf('\r\n')) !== -1) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          transcript.push(line);
          if (data) {
            if (line === '.') {
              data = false;
              s.write('250 queued\r\n');
            }
            continue;
          }
          if (line.startsWith('EHLO')) s.write('250-fake\r\n250 AUTH LOGIN\r\n');
          else if (line === 'AUTH LOGIN') s.write('334 VXNlcm5hbWU6\r\n');
          else if (transcript.at(-2) === 'AUTH LOGIN') s.write('334 UGFzc3dvcmQ6\r\n');
          else if (transcript.at(-3) === 'AUTH LOGIN') s.write('235 ok\r\n');
          else if (line === 'DATA') {
            data = true;
            s.write('354 go\r\n');
          } else if (line === 'QUIT') {
            s.write('221 bye\r\n');
            s.end();
          } else s.write('250 ok\r\n');
        }
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    port = (server.address() as { port: number }).port;
  });
  afterAll(() => server.close());
  beforeEach(() => {
    transcript = [];
  });

  it('1. speaks SMTP with AUTH LOGIN and a base64 UTF-8 body', async () => {
    await sendMail(
      `smtp://user%40x.com:secret@127.0.0.1:${port}`,
      'erp@x.com',
      ['a@x.com', 'b@x.com'],
      'تقرير المشروع',
      'نسبة الإنجاز 50%',
    );
    expect(transcript).toContain('AUTH LOGIN');
    expect(transcript).toContain(Buffer.from('user@x.com').toString('base64'));
    expect(transcript).toContain('RCPT TO:<b@x.com>');
    expect(transcript.join('\n')).toContain(Buffer.from('نسبة الإنجاز 50%').toString('base64'));
  });

  it('2. a refused recipient surfaces as an error', async () => {
    const bad = createServer((s) => {
      s.write('220 x\r\n');
      s.on('data', (c) => {
        const l = String(c);
        s.write(l.startsWith('RCPT') ? '550 no such user\r\n' : '250 ok\r\n');
      });
    });
    await new Promise<void>((r) => bad.listen(0, '127.0.0.1', () => r()));
    const p = (bad.address() as { port: number }).port;
    await expect(
      sendMail(`smtp://127.0.0.1:${p}`, 'erp@x.com', ['z@x.com'], 's', 'b'),
    ).rejects.toThrow(/550/);
    bad.close();
  });
});
