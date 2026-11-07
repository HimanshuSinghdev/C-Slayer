/* C-Slayer · class results page: collects result links from students and shows them as a sortable table. All data stays in this browser. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const KEY = 'cs.class';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* */ } }
  };
  try { const t = LS.get('cs.theme', null); if (t === 'paper' || t === 'slate') document.documentElement.setAttribute('data-theme', t); } catch (e) { /* */ }
  let rows = LS.get(KEY, []); if (!Array.isArray(rows)) rows = [];
  let sel = null;
  const probTitle = (id) => { const p = (window.PROBLEMS || []).find(x => x.id === id); return p ? p.title : (id ? id : 'Free coding'); };
  const msg = (t, bad) => { const m = $('#msg'); m.textContent = t; m.style.color = bad ? 'var(--err)' : 'var(--dim)'; };
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
  function normalise(o) {
    if (!o || o.v !== 1 || o.k !== 'r' || typeof o.c !== 'string' || o.c.length > 300000) throw new Error('bad');
    const s = Number(o.s); if (!(s >= 1 && s <= 10)) throw new Error('bad');
    return {
      n: clean(o.n, 40) || 'Student', p: clean(o.p, 24), f: clean(o.f, 40), s: Math.round(s * 2) / 2, g: clean(o.g, 20),
      pt: Array.isArray(o.pt) ? o.pt.slice(0, 12).map(a => [clean(a[0], 16), Number(a[1]) || 0, Number(a[2]) || 0]) : [],
      t: Array.isArray(o.t) && o.t.length === 2 ? [Number(o.t[0]) || 0, Number(o.t[1]) || 0] : null, c: o.c, ts: Number(o.ts) || Date.now()
    };
  }
  async function addText(text) {
    let ok = 0, fail = 0;
    for (const tok of String(text).split(/\s+/).filter(Boolean)) {
      const m = /#r=([A-Za-z0-9_-]+)/.exec(tok) || (/^[zp][A-Za-z0-9_-]{10,}$/.test(tok) ? [0, tok] : null);
      if (!m) { fail++; continue; }
      try {
        const r = normalise(await CC.pack.unpack(m[1]));
        const dup = rows.find(x => x.n === r.n && x.p === r.p && x.ts === r.ts);
        if (!dup) { rows.push(r); ok++; }
      } catch (e) { fail++; }
    }
    rows = rows.slice(-500); LS.set(KEY, rows);
    msg(ok + ' result' + (ok === 1 ? '' : 's') + ' added' + (fail ? ', ' + fail + ' could not be read' : '') + '.', !ok && fail > 0);
    render();
  }
  const fmtTime = (ts) => { try { return new Date(ts).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
  function render() {
    const pf = $('#probFilter'), cur = pf.value;
    const ids = [...new Set(rows.map(r => r.p))];
    pf.textContent = ''; { const o = document.createElement('option'); o.value = '*'; o.textContent = 'All problems'; pf.appendChild(o); }
    for (const id of ids) { const o = document.createElement('option'); o.value = id; o.textContent = probTitle(id); pf.appendChild(o); }
    pf.value = ids.includes(cur) || cur === '*' ? cur || '*' : '*';
    const view = rows.map((r, i) => ({ r, i })).filter(x => pf.value === '*' || x.r.p === pf.value).sort((a, b) => b.r.s - a.r.s || a.r.n.localeCompare(b.r.n));
    const tb = $('#tbl tbody'); tb.textContent = '';
    if (!view.length) { const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 5; td.className = 'empty'; td.textContent = 'No results yet. Open a student\'s link or paste links above.'; tr.appendChild(td); tb.appendChild(tr); }
    for (const { r, i } of view) {
      const tr = document.createElement('tr'); if (i === sel) tr.className = 'sel';
      const cells = [r.n, probTitle(r.p), null, r.t ? r.t[0] + '/' + r.t[1] : '–', fmtTime(r.ts)];
      cells.forEach((c, k) => { const td = document.createElement('td'); if (k === 2) { td.className = 'n'; const b = document.createElement('span'); b.className = 'sc ' + (r.s >= 8 ? 'hi' : r.s >= 5 ? 'mid' : 'lo'); b.textContent = String(r.s); td.appendChild(b); } else { td.textContent = c; if (k === 3) td.className = 'n'; } tr.appendChild(td); });
      tr.tabIndex = 0; tr.onclick = () => { sel = i; render(); }; tr.onkeydown = (e) => { if (e.key === 'Enter') { sel = i; render(); } };
      tb.appendChild(tr);
    }
    const sc = view.map(x => x.r.s), avg = sc.length ? sc.reduce((a, b) => a + b, 0) / sc.length : 0;
    $('#stats').textContent = '';
    for (const [k, v] of [['Results', sc.length], ['Average', sc.length ? avg.toFixed(1) : '–'], ['Top', sc.length ? Math.max(...sc) : '–'], ['Below 5', sc.filter(x => x < 5).length]]) { const d = document.createElement('div'); const b = document.createElement('b'); b.textContent = String(v); d.append(b, document.createTextNode(k)); $('#stats').appendChild(d); }
    const dt = $('#detail');
    if (sel != null && rows[sel]) {
      const r = rows[sel]; dt.hidden = false;
      $('#dTitle').textContent = r.n + ' — ' + probTitle(r.p) + ' — ' + r.s + '/10 ' + r.g;
      const pp = $('#dParts'); pp.textContent = ''; for (const [id, got, max] of r.pt) { const s = document.createElement('span'); s.textContent = id + ' ' + got + '/' + max; pp.appendChild(s); }
      $('#dCode').textContent = r.c;
    } else dt.hidden = true;
  }
  $('#add').onclick = () => { addText($('#paste').value).then(() => { $('#paste').value = ''; }); };
  $('#probFilter').onchange = () => { sel = null; render(); };
  $('#dDel').onclick = () => { if (sel == null) return; rows.splice(sel, 1); sel = null; LS.set(KEY, rows); render(); };
  $('#wipe').onclick = () => { if (!rows.length || !confirm('Remove all ' + rows.length + ' results from this phone?')) return; rows = []; sel = null; LS.set(KEY, rows); render(); };
  $('#csv').onclick = () => {
    const q = (v) => { let s = String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const lines = [['Student', 'Problem', 'Score', 'Grade', 'Tests passed', 'Tests total', 'Sent'].map(q).join(',')];
    for (const r of rows) lines.push([r.n, probTitle(r.p), r.s, r.g, r.t ? r.t[0] : '', r.t ? r.t[1] : '', new Date(r.ts).toISOString()].map(q).join(','));
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([lines.join('\n') + '\n'], { type: 'text/csv' })); a.download = 'class-results.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  render();
  if (/#r=/.test(location.hash)) { const h = location.hash; history.replaceState(null, '', location.pathname); addText(h); }
})();
