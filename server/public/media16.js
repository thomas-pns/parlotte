'use strict';
// Parlotte 1.6 — nos propres lecteurs, sans le style de Windows ou de l'iPhone :
//  • visionneuse de photos : zoom (molette, pincement, double-tap), glisser pour se déplacer,
//    glisser vers le bas pour fermer, photo précédente / suivante, enregistrer ;
//  • messages vocaux : icônes dessinées (plus d'emoji ▶️ sur iPhone) ;
//  • vidéos et sons dans les messages : lecteur maison.

const MI = {
  play: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></svg>',
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 22),
  left: svg('<path d="M15 5l-7 7 7 7"/>', 24), right: svg('<path d="M9 5l7 7-7 7"/>', 24),
  dl: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 20),
  full: svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', 18),
  vol: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 9a4 4 0 010 6"/>', 18),
  mute: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>', 18),
};

// ---------------------------------------------------------------- Messages vocaux : icônes dessinées
const vIcon = paused => (paused ? MI.play : MI.pause);
const _voiceNoteHTML16 = voiceNoteHTML;
voiceNoteHTML = a => _voiceNoteHTML16(a).replace('<button class="vplay" title="Écouter">▶</button>', `<button class="vplay" title="Écouter" aria-label="Écouter">${MI.play}</button>`);
// Le lecteur d'origine écrit ▶ / ⏸ en texte : on remplace par les icônes à chaque changement
new MutationObserver(muts => {
  for (const m of muts) {
    const b = m.target.nodeType === 3 ? m.target.parentElement : m.target;
    if (b?.classList?.contains('vplay') && !b.querySelector('svg')) { const t = b.textContent.trim(); b.innerHTML = vIcon(t !== '⏸'); b.classList.toggle('playing', t === '⏸'); }
  }
}).observe(document.body, { subtree: true, childList: true, characterData: true });

// ---------------------------------------------------------------- Vidéos et sons dans les messages
const _attachmentsHTML16 = attachmentsHTML;
attachmentsHTML = function (list) {
  let h = _attachmentsHTML16(list);
  h = h.replace(/<video class="att-video" src="([^"]+)" controls preload="metadata"><\/video>/g, (_, url) =>
    `<div class="mvid" data-mvid><video src="${url}#t=0.1" preload="metadata" playsinline></video><button class="mv-big" aria-label="Lire">${MI.play}</button>
      <div class="mv-bar"><button class="mv-pp" aria-label="Lire">${MI.play}</button><span class="mv-t">0:00</span><div class="mv-track"><i></i></div><button class="mv-mute" aria-label="Couper le son">${MI.vol}</button><button class="mv-full" aria-label="Plein écran">${MI.full}</button></div></div>`);
  h = h.replace(/<audio src="([^"]+)" controls preload="none"><\/audio>/g, (_, url) =>
    `<div class="maudio" data-maudio="${url}"><button class="ma-play" aria-label="Écouter">${MI.play}</button><div class="mv-track"><i></i></div><span class="ma-time">0:00</span></div>`);
  return h;
};
const fmtT = s => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00');
function syncVid(box) {
  const v = box.querySelector('video'), p = v.duration ? v.currentTime / v.duration : 0;
  box.classList.toggle('playing', !v.paused); box.querySelector('.mv-pp').innerHTML = vIcon(v.paused);
  box.querySelector('.mv-t').textContent = fmtT(v.paused && !v.currentTime ? v.duration : v.currentTime);
  box.querySelector('.mv-track i').style.width = (p * 100) + '%';
  box.querySelector('.mv-mute').innerHTML = v.muted ? MI.mute : MI.vol;
}
document.addEventListener('click', e => {
  const box = e.target.closest('[data-mvid]');
  if (box) {
    const v = box.querySelector('video');
    if (!v._wired) { v._wired = true; ['timeupdate', 'play', 'pause', 'loadedmetadata', 'ended', 'volumechange'].forEach(k => v.addEventListener(k, () => syncVid(box))); }
    if (e.target.closest('.mv-mute')) { v.muted = !v.muted; return; }
    if (e.target.closest('.mv-full')) { (v.requestFullscreen || v.webkitEnterFullscreen || v.webkitRequestFullscreen)?.call(v); return; }
    const tr = e.target.closest('.mv-track');
    if (tr) { const r = tr.getBoundingClientRect(); if (v.duration) v.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * v.duration; return; }
    document.querySelectorAll('[data-mvid] video').forEach(o => { if (o !== v) o.pause(); });
    v.paused ? v.play().catch(() => {}) : v.pause();
    return;
  }
  const au = e.target.closest('[data-maudio]');
  if (au) {
    let a = au._a;
    if (!a) {
      a = au._a = new Audio(au.dataset.maudio);
      const sync = () => { au.querySelector('.ma-play').innerHTML = vIcon(a.paused); au.querySelector('.mv-track i').style.width = (a.duration ? a.currentTime / a.duration * 100 : 0) + '%'; au.querySelector('.ma-time').textContent = fmtT(a.currentTime); };
      ['timeupdate', 'play', 'pause', 'ended'].forEach(k => a.addEventListener(k, sync));
    }
    const tr = e.target.closest('.mv-track');
    if (tr && a.duration) { const r = tr.getBoundingClientRect(); a.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * a.duration; return; }
    a.paused ? a.play().catch(() => {}) : a.pause();
  }
});

// ---------------------------------------------------------------- Visionneuse de photos
document.body.insertAdjacentHTML('beforeend', `<div id="pv" hidden role="dialog" aria-label="Photo">
  <div class="pv-bg"></div>
  <header class="pv-top"><span class="pv-who"></span><span class="grow"></span>
    <a class="pv-btn" id="pv-dl" download aria-label="Enregistrer">${MI.dl}</a><button class="pv-btn" id="pv-close" aria-label="Fermer">${MI.close}</button></header>
  <button class="pv-nav prev" id="pv-prev" aria-label="Photo précédente">${MI.left}</button>
  <div class="pv-stage" id="pv-stage"><img id="pv-img" alt="" draggable="false"></div>
  <button class="pv-nav next" id="pv-next" aria-label="Photo suivante">${MI.right}</button>
  <div class="pv-count" id="pv-count"></div></div>`);
const pv = { list: [], i: 0, s: 1, x: 0, y: 0, from: null };
function pvApply(anim) {
  const img = $('#pv-img'); img.style.transition = anim ? 'transform .25s cubic-bezier(.2,.9,.3,1)' : 'none';
  img.style.transform = `translate(${pv.x}px,${pv.y}px) scale(${pv.s})`;
  $('#pv').classList.toggle('zoomed', pv.s > 1.01);
}
function pvShow(i, dir = 0) {
  pv.i = (i + pv.list.length) % pv.list.length; pv.s = 1; pv.x = 0; pv.y = 0;
  const it = pv.list[pv.i], img = $('#pv-img');
  img.src = it.src; $('#pv-dl').href = it.src; pvApply(false);
  if (dir) { img.classList.remove('pv-in-l', 'pv-in-r'); void img.offsetWidth; img.classList.add(dir > 0 ? 'pv-in-r' : 'pv-in-l'); }
  $('#pv-count').textContent = pv.list.length > 1 ? `${pv.i + 1} / ${pv.list.length}` : '';
  $('#pv .pv-who').innerHTML = it.who ? `${avatar(user(it.who))}<span><b>${esc(user(it.who).name)}</b><small>${esc(it.when || '')}</small></span>` : '';
  $('#pv-prev').hidden = $('#pv-next').hidden = pv.list.length < 2;
}
function openPhoto(thumb) {
  const scope = thumb.closest('#view, #res-list, .photo-grid, dialog, #card') || document;
  const all = [...scope.querySelectorAll('.att-img, .photo-grid img')].filter(x => x.dataset.full || x.src);
  pv.list = all.map(x => { const row = x.closest('.msg[data-id]'); const m = row && (st.msgs[st.view.channel] || []).find(y => y.id === row.dataset.id);
    return { src: x.dataset.full || x.src, who: m?.author_id, when: m ? new Date(m.timestamp).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '' }; });
  const i = Math.max(0, all.indexOf(thumb));
  const box = $('#pv'); box.hidden = false; box.classList.remove('closing'); pvShow(i);
  // L'image grandit depuis sa miniature
  const r = thumb.getBoundingClientRect(), img = $('#pv-img');
  pv.from = r;
  img.onload = null;
  const go = () => {
    const ir = img.getBoundingClientRect(); if (!ir.width) return;
    const sx = r.width / ir.width, dx = r.left + r.width / 2 - (ir.left + ir.width / 2), dy = r.top + r.height / 2 - (ir.top + ir.height / 2);
    img.animate([{ transform: `translate(${dx}px,${dy}px) scale(${sx})`, borderRadius: '24px' }, { transform: 'none', borderRadius: '6px' }], { duration: 300, easing: 'cubic-bezier(.2,.9,.3,1)' });
  };
  img.complete ? go() : (img.onload = go);
  box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
}
function closePhoto() {
  const box = $('#pv'); if (box.hidden || box.classList.contains('closing')) return;
  box.classList.add('closing'); setTimeout(() => { box.hidden = true; box.classList.remove('closing', 'in', 'zoomed'); $('#pv-img').removeAttribute('src'); $('#pv-img').style.transform = ''; }, 220);
}
// Remplace l'ancienne visionneuse
document.addEventListener('click', e => {
  const t = e.target.closest('.att-img, .photo-grid img'); if (!t || e.target.closest('#pv')) return;
  e.stopImmediatePropagation(); e.preventDefault(); openPhoto(t);
}, true);
$('#pv-close').onclick = closePhoto;
$('#pv .pv-bg').onclick = () => { if (pv.s <= 1.01) closePhoto(); };
$('#pv-stage').addEventListener('click', e => { if (e.target.id === 'pv-stage' && pv.s <= 1.01) closePhoto(); });
$('#pv-prev').onclick = () => pvShow(pv.i - 1, -1);
$('#pv-next').onclick = () => pvShow(pv.i + 1, 1);
document.addEventListener('keydown', e => {
  if ($('#pv').hidden) return;
  if (e.key === 'Escape') { e.stopPropagation(); closePhoto(); }
  if (e.key === 'ArrowRight' && pv.list.length > 1) pvShow(pv.i + 1, 1);
  if (e.key === 'ArrowLeft' && pv.list.length > 1) pvShow(pv.i - 1, -1);
}, true);
// Zoom à la molette (vers le curseur)
$('#pv-stage').addEventListener('wheel', e => {
  e.preventDefault();
  const k = Math.exp(-e.deltaY * 0.0015), ns = Math.min(6, Math.max(1, pv.s * k));
  const r = $('#pv-stage').getBoundingClientRect(), cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
  pv.x = cx - (cx - pv.x) * ns / pv.s; pv.y = cy - (cy - pv.y) * ns / pv.s; pv.s = ns;
  if (pv.s === 1) { pv.x = 0; pv.y = 0; }
  pvApply(false);
}, { passive: false });
// Doigts / souris : déplacer, pincer, glisser vers le bas pour fermer, glisser sur le côté pour changer
(() => {
  const pts = new Map(); let start = null, lastTap = 0;
  const stage = $('#pv-stage');
  stage.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    start = { s: pv.s, x: pv.x, y: pv.y, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])), t: Date.now() };
    if (pts.size === 1) {
      if (Date.now() - lastTap < 280) { // double toucher : zoom ×2.5 / retour
        const r = stage.getBoundingClientRect(), cx = e.clientX - r.left - r.width / 2, cy = e.clientY - r.top - r.height / 2;
        if (pv.s > 1.01) { pv.s = 1; pv.x = 0; pv.y = 0; } else { pv.s = 2.5; pv.x = -cx * 1.5; pv.y = -cy * 1.5; }
        pvApply(true); lastTap = 0; start = null; return;
      }
      lastTap = Date.now();
    }
  });
  stage.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !start) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pts.values()], [a0, b0] = [...start.pts.values()];
    if (pts.size >= 2 && b && b0) {
      const d = Math.hypot(a.x - b.x, a.y - b.y), d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1;
      pv.s = Math.min(6, Math.max(1, start.s * d / d0)); pvApply(false); return;
    }
    const dx = a.x - a0.x, dy = a.y - a0.y;
    if (start.s > 1.01) { pv.x = start.x + dx; pv.y = start.y + dy; pvApply(false); return; }
    // pas zoomé : on suit le doigt (bas = fermer, côté = changer de photo)
    const img = $('#pv-img');
    if (Math.abs(dy) > Math.abs(dx)) { img.style.transition = 'none'; img.style.transform = `translate(${dx * 0.3}px,${Math.max(0, dy)}px) scale(${1 - Math.min(0.25, Math.max(0, dy) / 1200)})`; $('#pv .pv-bg').style.opacity = String(1 - Math.min(0.8, Math.max(0, dy) / 400)); }
    else { img.style.transition = 'none'; img.style.transform = `translateX(${dx}px)`; }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return; const p = pts.get(e.pointerId); pts.delete(e.pointerId);
    if (!start || pts.size) return;
    const p0 = [...start.pts.values()][0], dx = p.x - p0.x, dy = p.y - p0.y, fast = Date.now() - start.t < 300;
    $('#pv .pv-bg').style.opacity = '';
    if (start.s <= 1.01 && pv.s <= 1.01) {
      if (dy > 120 || (fast && dy > 50)) { start = null; return closePhoto(); }
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) && pv.list.length > 1) { start = null; return pvShow(pv.i + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1); }
      pv.x = 0; pv.y = 0; pvApply(true);
    }
    if (pv.s <= 1.01) { pv.s = 1; pv.x = 0; pv.y = 0; pvApply(true); }
    start = null;
  };
  stage.addEventListener('pointerup', end); stage.addEventListener('pointercancel', end);
})();
