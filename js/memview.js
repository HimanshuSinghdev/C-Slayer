/* C-Slayer · memory picture for the debugger: stack variables on the left, malloc'd blocks on the right, pointers drawn as arrows.
   Pure DOM/SVG built with textContent only (no innerHTML). Input is the snapshot from VM.inspect(). */
(function (g) {
  'use strict';
  const CC = g.CC = g.CC || {};
  const NS = 'http://www.w3.org/2000/svg';
  const W = 340, SX = 6, SW = 150, HX = 192, HW = 142, ROW = 15;
  const mk = (tag, attrs, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; };
  const cut = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const isPtr = (n) => n && n.addr !== undefined && /\*/.test(n.type || '');

  CC.memView = {
    render(box, snap) {
      box.textContent = '';
      const blocks = snap.heap || [];
      const contents = new Map();   // heap block addr -> value node seen through a pointer
      const note = (n) => { if (!n) return; if (isPtr(n) && n.deref && n.where && n.where.indexOf('heap block') === 0) { if (!contents.has(n.addr)) contents.set(n.addr, n.deref); note(n.deref); } if (n.kids) n.kids.forEach(note); };
      for (const f of snap.stack) for (const v of f.vars) note(v);
      const rowsOf = (n) => {
        if (!n) return [];
        if (n.kids && n.type && /^struct|^union/.test(n.type)) return n.kids.slice(0, 6).map(k => ({ t: isPtr(k) && k.addr ? k.name + ' →' : cut(k.name + ' = ' + k.text, 20), node: k }));
        if (n.kids) return [{ t: cut(n.text, 18), node: null }];
        return [{ t: cut(n.text, 18), node: n }];
      };
      // ---- layout ----
      const svgEls = [], varBoxes = [], arrows = [];
      let y = 6;
      snap.stack.forEach((f, fi) => {
        svgEls.push(mk('text', { x: SX + 2, y: y + 11, class: 'mv-fn' }, f.fn + '()' + (fi === 0 ? '  ← you are here' : '')));
        y += 17;
        if (!f.vars.length) { svgEls.push(mk('text', { x: SX + 8, y: y + 12, class: 'mv-dim' }, '(no variables yet)')); y += 20; }
        for (const v of f.vars) {
          const h = 32;
          svgEls.push(mk('rect', { x: SX, y, width: SW, height: h, rx: 5, class: 'mv-var' + (v.hint ? ' mv-bad' : '') }));
          svgEls.push(mk('text', { x: SX + 7, y: y + 13, class: 'mv-name' }, cut(v.name + '  ' + v.type, 21)));
          svgEls.push(mk('text', { x: SX + 7, y: y + 26, class: 'mv-val' }, cut(v.hint ? '⚠ ' + v.hint : v.text, 20)));
          varBoxes.push({ v, x: SX, y, w: SW, h });
          if (isPtr(v)) arrows.push({ from: { x: SX + SW, y: y + h / 2 }, p: v.addr, where: v.where, src: 'stack', node: v });
          y += h + 6;
        }
        y += 8;
      });
      const stackBottom = y;
      let hy = 6; const hb = [];
      if (blocks.length) svgEls.push(mk('text', { x: HX, y: hy + 11, class: 'mv-fn' }, 'Heap (malloc)')); hy += 17;
      if (!blocks.length) svgEls.push(mk('text', { x: HX, y: hy + 12, class: 'mv-dim' }, 'nothing allocated'));
      for (const b of blocks.slice(0, 12)) {
        const rows = b.freed ? [] : rowsOf(contents.get(b.addr)); const h = 36 + rows.length * ROW;
        svgEls.push(mk('rect', { x: HX, y: hy, width: HW, height: h, rx: 5, class: 'mv-blk' + (b.freed ? ' mv-freed' : '') }));
        svgEls.push(mk('text', { x: HX + 6, y: hy + 13, class: 'mv-name' }, (b.freed ? 'FREED ' : '') + b.size + ' bytes'));
        svgEls.push(mk('text', { x: HX + 6, y: hy + 26, class: 'mv-dim' }, '0x' + b.addr.toString(16) + ' · L' + b.line));
        let ry = hy + 26;
        rows.forEach((r) => { ry += ROW; svgEls.push(mk('text', { x: HX + 8, y: ry, class: 'mv-val' }, r.t)); if (r.node && isPtr(r.node)) arrows.push({ from: { x: HX + HW, y: ry - 4 }, p: r.node.addr, where: r.node.where, src: 'heap', node: r.node }); });
        hb.push({ b, x: HX, y: hy, w: HW, h }); hy += h + 8;
      }
      if (blocks.length > 12) { svgEls.push(mk('text', { x: HX, y: hy + 12, class: 'mv-dim' }, '+' + (blocks.length - 12) + ' more')); hy += 18; }
      const H = Math.max(stackBottom, hy) + 6;
      const svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: '100%', role: 'img', 'aria-label': 'Memory picture: variables, heap blocks and pointers' });
      const defs = mk('defs', {}); const mkr = mk('marker', { id: 'mvArrow', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }); mkr.appendChild(mk('path', { d: 'M0 0L8 4L0 8z', class: 'mv-ah' })); defs.appendChild(mkr);
      const mkr2 = mk('marker', { id: 'mvArrowBad', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }); mkr2.appendChild(mk('path', { d: 'M0 0L8 4L0 8z', class: 'mv-ahb' })); defs.appendChild(mkr2);
      svg.appendChild(defs); svgEls.forEach(e => svg.appendChild(e));
      // ---- arrows ----
      const used = new Map(); const bump = (k) => { const n = used.get(k) || 0; used.set(k, n + 1); return n; };
      for (const a of arrows) {
        if (!a.p) { svg.appendChild(mk('text', { x: a.from.x - 4, y: a.from.y - 12, class: 'mv-null', 'text-anchor': 'end' }, '')); continue; }
        let tgt = null, kind = 'ok';
        const blk = hb.find(o => a.p >= o.b.addr && a.p < o.b.addr + Math.max(o.b.size, 1));
        if (blk) { tgt = { x: blk.x, y: blk.y + 16 + 6 * bump('b' + blk.b.addr) }; if (blk.b.freed) kind = 'bad'; }
        else {
          let best = null;
          for (const vb of varBoxes) { const ad = vb.v.address; if (ad === undefined) continue; if (ad === a.p) { best = vb; break; } if (ad <= a.p && a.p - ad < 64 && (!best || ad > best.v.address)) best = vb; }
          if (best && best.v !== a.node) tgt = { x: best.x + best.w, y: best.y + best.h / 2, right: true };
          else if (best) tgt = { x: best.x + best.w, y: best.y + best.h / 2, right: true };
        }
        if (!tgt) {
          // pointing nowhere valid: a short red stub
          svg.appendChild(mk('path', { d: 'M' + a.from.x + ' ' + a.from.y + ' h14', class: 'mv-arrow mv-abad', 'marker-end': 'url(#mvArrowBad)' }));
          svg.appendChild(mk('text', { x: a.from.x + 17, y: a.from.y + 4, class: 'mv-badtxt' }, '✖'));
          continue;
        }
        const d = tgt.right
          ? 'M' + a.from.x + ' ' + a.from.y + ' C' + (a.from.x + 26) + ' ' + a.from.y + ' ' + (tgt.x + 26) + ' ' + tgt.y + ' ' + tgt.x + ' ' + tgt.y
          : 'M' + a.from.x + ' ' + a.from.y + ' C' + (a.from.x + 28) + ' ' + a.from.y + ' ' + (tgt.x - 28) + ' ' + tgt.y + ' ' + tgt.x + ' ' + tgt.y;
        svg.appendChild(mk('path', { d, class: 'mv-arrow' + (kind === 'bad' ? ' mv-abad' : ''), 'marker-end': kind === 'bad' ? 'url(#mvArrowBad)' : 'url(#mvArrow)' }));
      }
      box.appendChild(svg);
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : self);
