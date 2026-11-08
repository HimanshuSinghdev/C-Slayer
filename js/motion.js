// Motion helpers: the on/off switch, the sliding tab bar and the console line fade. Pure add-on: delete this file, css/motion.css
// and the <link>/<script>/menu item in index.html to remove it; nothing else depends on it.
(function () {
  'use strict';
  var root = document.documentElement, KEY = 'cs.fx';
  var osReduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function read() { try { var v = localStorage.getItem(KEY); return v === null ? true : JSON.parse(v) !== false; } catch (e) { return true; } }
  function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  var on = read();
  function label() { var l = document.getElementById('fxLbl'), b = document.getElementById('btnFx'); if (!l || !b) return;
    l.textContent = osReduced ? 'Animations: off (phone setting)' : on ? 'Animations: on (tap to turn off)' : 'Animations: off (tap to turn on)';
    b.setAttribute('aria-pressed', on && !osReduced ? 'true' : 'false'); }
  function apply() { root.classList.toggle('fx', on && !osReduced); label(); place(true); }

  // ---- sliding tab bar ----
  var tabs = document.querySelector('.tabs'), ind = null;
  function place(snap) {
    if (!tabs) return;
    if (!root.classList.contains('fx')) { if (ind) ind.style.display = 'none'; return; }
    if (!ind) { ind = document.createElement('i'); ind.className = 'fx-ind'; ind.setAttribute('aria-hidden', 'true'); tabs.appendChild(ind); }
    var t = tabs.querySelector('button.on:not([hidden])'); if (!t) { ind.style.display = 'none'; return; }
    ind.style.display = '';
    if (snap) ind.classList.add('snap');
    ind.style.transform = 'translateX(' + t.offsetLeft + 'px) scaleX(' + (t.offsetWidth / 100) + ')';
    if (snap) { void ind.offsetWidth; ind.classList.remove('snap'); }
  }
  if (tabs) {
    new MutationObserver(function () { place(false); }).observe(tabs, { attributes: true, subtree: true, attributeFilter: ['class', 'hidden'] });
    window.addEventListener('resize', function () { place(true); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { place(true); });
  }

  // ---- console: wrap newly appended plain text so it can fade in (capped, so huge outputs stay fast) ----
  var out = document.getElementById('out'), wrapped = 0;
  if (out) new MutationObserver(function (list) {
    if (!root.classList.contains('fx')) return;
    if (!out.firstChild) { wrapped = 0; return; }
    list.forEach(function (m) { m.addedNodes.forEach(function (n) {
      if (n.nodeType !== 3 || wrapped > 150 || n.nodeValue.length > 4000 || n.parentNode !== out) return;
      var s = document.createElement('span'); s.className = 'fx-in' + (n.nodeValue.indexOf('\n') !== -1 && n.nodeValue.trim().length ? ' fx-multi' : '');
      s.textContent = n.nodeValue; out.replaceChild(s, n); wrapped++;
    }); });
  }).observe(out, { childList: true });

  var btn = document.getElementById('btnFx');
  if (btn) btn.addEventListener('click', function () { if (osReduced) return; on = !on; write(on); apply(); });
  apply();
})();
