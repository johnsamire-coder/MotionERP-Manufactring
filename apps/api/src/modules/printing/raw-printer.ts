import { connect } from 'node:net';

/** HTML → plain text for RAW text printers (pure). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|tr|header|footer|li)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, '\t')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Sends a payload to a printer over RAW / JetDirect (TCP 9100). Form feed between documents is the caller's job. */
export function sendRaw(
  host: string,
  port: number,
  payload: Buffer,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = connect({ host, port });
    socket.setTimeout(timeoutMs);
    socket.on('connect', () => socket.end(payload));
    socket.on('close', (hadError) => {
      if (!hadError) resolve();
    });
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`printer ${host}:${port} timed out`));
    });
    socket.on('error', (e) => reject(new Error(`printer ${host}:${port}: ${e.message}`)));
  });
}
