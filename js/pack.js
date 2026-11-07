/* C-Slayer · tiny pack/unpack for links and result codes: JSON -> deflate -> base64url. Nothing is uploaded anywhere. */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const b64 = {
    enc(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
    dec(t) { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  };
  async function pipe(u8, stream, cap) {
    const out = new Blob([u8]).stream().pipeThrough(stream), rd = out.getReader(), parts = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > cap) { try { rd.cancel(); } catch (e) { /* */ } throw new Error('too big'); } parts.push(value); }
    const r = new Uint8Array(n); let o = 0; for (const c of parts) { r.set(c, o); o += c.length; } return r;
  }
  CC.pack = {
    async pack(obj) {
      const raw = new TextEncoder().encode(JSON.stringify(obj));
      if (typeof CompressionStream === 'function') return 'z' + b64.enc(await pipe(raw, new CompressionStream('deflate-raw'), 1 << 20));
      return 'p' + b64.enc(raw);
    },
    async unpack(t) {
      t = String(t).trim(); let raw = b64.dec(t.slice(1));
      if (t[0] === 'z') { if (typeof DecompressionStream !== 'function') throw new Error('unsupported'); raw = await pipe(raw, new DecompressionStream('deflate-raw'), 400000); }
      else if (t[0] !== 'p') throw new Error('bad link');
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw));
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
