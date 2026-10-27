// Client SMTP minimal pentru Cloudflare Workers (fără biblioteci și fără servicii externe).
// Trimite prin contul tău de email (Yahoo, Gmail etc.) cu o „parolă de aplicație".
// Port 465 = TLS direct (recomandat); port 587 = STARTTLS.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function getConnect() {
  if (globalThis.__smtpConnect) return globalThis.__smtpConnect; // folosit doar la testele locale
  const mod = await import('cloudflare:sockets');
  return mod.connect;
}

class Conn {
  constructor(socket) { this.attach(socket); this.buf = ''; }
  attach(socket) {
    this.socket = socket;
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }
  async readResponse() {
    // un răspuns SMTP poate avea mai multe linii: "250-..." continuă, "250 ..." se termină
    for (;;) {
      const lines = this.buf.split('\r\n');
      for (let i = 0; i < lines.length - 1; i++) {
        if (/^\d{3} /.test(lines[i]) || /^\d{3}$/.test(lines[i])) {
          const text = lines.slice(0, i + 1).join('\n');
          this.buf = lines.slice(i + 1).join('\r\n');
          return { code: Number(lines[i].slice(0, 3)), text };
        }
      }
      const { value, done } = await this.reader.read();
      if (done) throw new Error('Serverul de email a închis conexiunea.');
      this.buf += dec.decode(value, { stream: true });
    }
  }
  async write(s) { await this.writer.write(enc.encode(s)); }
  async cmd(line, expect, label) {
    await this.write(line + '\r\n');
    const r = await this.readResponse();
    if (expect && !expect.includes(r.code)) {
      // „label" ascunde datele sensibile (utilizator/parolă) din mesajele de eroare
      throw new Error(`SMTP ${label || line.split(' ')[0]}: ${r.text.slice(0, 200)}`);
    }
    return r;
  }
  async close() {
    try { this.reader.releaseLock(); this.writer.releaseLock(); } catch {}
    try { await this.socket.close(); } catch {}
  }
}

const b64 = (s) => {
  const bytes = enc.encode(s);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/**
 * Trimite unul sau mai multe mesaje într-o singură conexiune.
 * @param cfg { host, port, user, pass, heloName }
 * @param messages [{ from, to: [..], raw }]  raw = mesajul MIME complet
 */
export async function smtpSend(cfg, messages) {
  const connect = await getConnect();
  const port = Number(cfg.port) || 465;
  const implicitTls = port === 465;
  const socket = connect({ hostname: cfg.host, port }, { secureTransport: implicitTls ? 'on' : 'starttls', allowHalfOpen: false });
  const c = new Conn(socket);
  const timer = setTimeout(() => { try { socket.close(); } catch {} }, 25000);
  try {
    let r = await c.readResponse();
    if (r.code !== 220) throw new Error(`SMTP salut: ${r.text}`);
    const helo = cfg.heloName || 'chimag.ro';
    r = await c.cmd(`EHLO ${helo}`, [250]);
    if (!implicitTls) {
      await c.cmd('STARTTLS', [220]);
      c.reader.releaseLock(); c.writer.releaseLock();
      c.attach(socket.startTls());
      await c.cmd(`EHLO ${helo}`, [250]);
    }
    await c.cmd('AUTH LOGIN', [334]);
    await c.cmd(b64(cfg.user), [334], 'utilizator');
    await c.cmd(b64(cfg.pass), [235], 'parolă (verifică parola de aplicație)');
    for (const m of messages) {
      await c.cmd(`MAIL FROM:<${m.from}>`, [250]);
      for (const to of m.to) await c.cmd(`RCPT TO:<${to}>`, [250, 251]);
      await c.cmd('DATA', [354]);
      // „dot-stuffing": o linie care începe cu punct primește încă un punct
      const body = m.raw.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
      await c.write(body + '\r\n.\r\n');
      const d = await c.readResponse();
      if (d.code !== 250) throw new Error(`SMTP trimitere: ${d.text.slice(0, 200)}`);
    }
    try { await c.cmd('QUIT'); } catch {}
  } finally {
    clearTimeout(timer);
    await c.close();
  }
}

// ---------- construire mesaj MIME (text + HTML, UTF-8) ----------
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = (s) => s.replace(/(.{76})/g, '$1\r\n');

export function buildMime({ fromName, fromAddr, to, subject, text, html, replyTo, attachments = [] }) {
  const boundary = 'chimag-' + crypto.randomUUID();
  const domain = fromAddr.split('@')[1] || 'chimag.ro';
  const headers = [
    `From: ${encodeHeader(fromName)} <${fromAddr}>`,
    `To: ${to.map((t) => `<${t}>`).join(', ')}`,
    ...(replyTo ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    'MIME-Version: 1.0',
  ];
  const mixed = 'chimag-m-' + crypto.randomUUID();
  headers.push(attachments.length ? `Content-Type: multipart/mixed; boundary="${mixed}"` : `Content-Type: multipart/alternative; boundary="${boundary}"`);
  const part = (type, content) => [
    `--${boundary}`,
    `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(content)),
  ].join('\r\n');
  const alt = [part('text/plain', text || ''), part('text/html', html || `<pre>${text || ''}</pre>`), `--${boundary}--`, ''].join('\r\n');
  if (!attachments.length) return headers.join('\r\n') + '\r\n\r\n' + alt;
  const binB64 = (bytes) => { let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };
  const files = attachments.map((a) => [
    `--${mixed}`,
    `Content-Type: ${a.type || 'application/octet-stream'}; name="${a.name}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${a.name}"`,
    '',
    wrap76(binB64(a.content)),
  ].join('\r\n'));
  return headers.join('\r\n') + '\r\n\r\n' +
    [`--${mixed}`, `Content-Type: multipart/alternative; boundary="${boundary}"`, '', alt, ...files, `--${mixed}--`, ''].join('\r\n');
}
