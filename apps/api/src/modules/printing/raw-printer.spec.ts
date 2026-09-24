import { createServer } from 'node:net';
import { htmlToText, sendRaw } from './raw-printer';

describe('Network printing (plan item 50)', () => {
  it('1. HTML becomes readable plain text', () => {
    const t = htmlToText(
      '<style>x{}</style><h1>فاتورة</h1><table><tr><td>سرير</td><td>2</td></tr></table><p>a &amp; b</p>',
    );
    expect(t).toBe('فاتورة\nسرير\t2\na & b');
  });

  it('2. sends the bytes to a RAW 9100-style socket', async () => {
    let got = '';
    const server = createServer((s) => {
      s.on('data', (c) => {
        got += c.toString('utf8');
      });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const port = (server.address() as { port: number }).port;
    await sendRaw('127.0.0.1', port, Buffer.from('hello\f', 'utf8'));
    await new Promise((r) => setTimeout(r, 50));
    server.close();
    expect(got).toBe('hello\f');
  });

  it('3. an unreachable printer is an error', async () => {
    await expect(sendRaw('127.0.0.1', 1, Buffer.from('x'), 2000)).rejects.toThrow(
      /printer 127.0.0.1:1/,
    );
  });
});
