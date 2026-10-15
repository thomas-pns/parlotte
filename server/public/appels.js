'use strict';
// Parlotte — écran d'appel plein écran (surtout pour le téléphone) : grands avatars qui s'illuminent
// quand on parle, minuteur, vidéos, et gros boutons en bas. La petite barre « Connecté au vocal »
// reste là quand on le réduit.

const CXI = {
  down: svg('<path d="M6 9l6 6 6-6"/>', 26),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 26),
  micOff: svg('<path d="M3 3l18 18M9 9v2a3 3 0 005.1 2.1M15 10V6a3 3 0 00-5.7-1.3M5 11a7 7 0 0011.3 5.5M19 11a7 7 0 01-.7 3M12 18v3"/>', 26),
  deaf: svg('<path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>', 26),
  deafOff: svg('<path d="M3 3l18 18M4 15v-3a8 8 0 0112.9-6.3M20 12v3"/><rect x="3" y="14" width="5" height="7" rx="2"/>', 26),
  cam: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/>', 26),
  screen: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', 26),
  sb: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', 26),
  hang: svg('<path d="M3 15c5-5 13-5 18 0l-2.5 2.5-3-2v-3a12 12 0 00-7 0v3l-3 2z"/>', 28),
  expand: svg('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>', 16),
  mutedSmall: svg('<path d="M3 3l18 18M9 9v2a3 3 0 005.1 2.1M15 10V6a3 3 0 00-5.7-1.3M5 11a7 7 0 0011.3 5.5"/>', 14),
};
document.body.insertAdjacentHTML('beforeend', '<div id="callx" hidden role="dialog" aria-label="Appel en cours"></div>');
const cx = { open: false, since: 0, last: null, stageHome: null };

function callTitle(cid) {
  const c = chanById(cid); if (!c) return { title: 'Appel', sub: '', c1: '#8E6CFF' };
  if (c.type === 'dm') {
    if (c.group) return { title: groupName(c), sub: 'Appel de groupe', c1: '#8E6CFF' };
    const o = dmOther(c); return { title: o.name, sub: 'Appel', c1: o.color || '#8E6CFF', u: o };
  }
  const s = st.servers.find(x => x.id === c.server_id);
  return { title: c.name, sub: s?.name || 'Salon vocal', c1: s ? serverColor(s) : '#3FB27F', banner: s?.banner };
}
const fmtCall = ms => { const s = Math.floor(ms / 1000), h = Math.floor(s / 3600); return (h ? h + ':' : '') + String(Math.floor(s / 60) % 60).padStart(h ? 2 : 1, '0') + ':' + String(s % 60).padStart(2, '0'); };

function renderCallX() {
  const box = $('#callx'), cid = vc.channel;
  if (!cid) { if (cx.open) closeCallX(); return; }
  if (!cx.open) return;
  const t = callTitle(cid), members = st.voice[cid] || [], others = members.filter(m => m.id !== st.me);
  const ringingSolo = !others.length && chanById(cid)?.type === 'dm';
  const can = id => !!$('#' + id);
  const hasVideo = $('#stage')?.children.length > 0;
  box.style.setProperty('--c1', t.c1);
  parkStage(); // sinon les vidéos seraient détruites en redessinant
  box.innerHTML = `<div class="cx-bg ${t.banner ? 'img' : ''}" ${t.banner ? `style="background-image:url('${esc(t.banner)}')"` : ''}></div>
    <header class="cx-top"><button class="cx-round" data-cx="min" aria-label="Réduire l'appel">${CXI.down}</button>
      <div class="cx-title"><b>${esc(t.title)}</b><small><span id="cx-timer">${ringingSolo ? 'Ça sonne…' : fmtCall(Date.now() - cx.since)}</span> · ${esc(t.sub)}</small></div><span class="cx-sp"></span></header>
    <div class="cx-people n${Math.min(members.length, 5)} ${hasVideo ? 'with-video' : ''}">${members.map(m => { const u = user(m.id);
      return `<div class="cx-p ${speaking.has(m.id) ? 'speaking' : ''}" data-speaker="${esc(m.id)}"><span class="cx-av">${avatar(u)}${m.muted || m.deafened ? `<i class="cx-muted">${CXI.mutedSmall}</i>` : ''}</span>
        <b>${esc(m.id === st.me ? 'Toi' : u.name)}</b>${m.screen ? '<small class="live">EN DIRECT</small>' : m.camera ? '<small>📷 caméra</small>' : ''}</div>`; }).join('')}
      ${ringingSolo ? `<div class="cx-p ringing">${avatar(t.u || user(st.me))}<b>${esc(t.title)}</b><small>En attente…</small></div>` : ''}</div>
    <div class="cx-stage-slot"></div>
    <div class="cx-ctrl">
      <button class="cx-btn ${vc.muted ? 'off' : ''}" data-cx="mute" aria-label="${vc.muted ? 'Réactiver le micro' : 'Couper le micro'}">${vc.muted ? CXI.micOff : CXI.mic}</button>
      <button class="cx-btn ${vc.deafened ? 'off' : ''}" data-cx="deaf" aria-label="${vc.deafened ? 'Réactiver le son' : 'Couper le son'}">${vc.deafened ? CXI.deafOff : CXI.deaf}</button>
      ${can('vp-cam') ? `<button class="cx-btn ${vc.camera ? 'on' : ''}" data-cx="cam" aria-label="Caméra">${CXI.cam}</button>` : ''}
      ${can('vp-screen') ? `<button class="cx-btn ${vc.screen ? 'on' : ''}" data-cx="screen" aria-label="Partager l'écran">${CXI.screen}</button>` : ''}
      ${can('vp-sb') ? `<button class="cx-btn" data-cx="sb" aria-label="Soundboard">${CXI.sb}</button>` : ''}
      <button class="cx-btn hang" data-cx="leave" aria-label="Raccrocher">${CXI.hang}</button></div>`;
  // les vidéos (caméras, écrans) viennent dans l'écran d'appel
  const stage = $('#stage');
  if (stage) {
    if (!cx.stageHome) cx.stageHome = { parent: stage.parentNode, next: stage.nextSibling };
    box.querySelector('.cx-stage-slot').appendChild(stage); stage.classList.add('in-callx');
  }
}
function parkStage() {
  const stage = $('#stage');
  if (stage && cx.stageHome && $('#callx').contains(stage)) {
    const h = cx.stageHome; h.parent.insertBefore(stage, h.next && h.next.parentNode === h.parent ? h.next : null);
    stage.classList.remove('in-callx'); cx.stageHome = null;
  }
}
function openCallX() {
  if (!vc.channel) return;
  cx.open = true; $('#callx').hidden = false; document.body.classList.add('callx-open');
  renderCallX(); $('#callx').classList.remove('cx-in'); void $('#callx').offsetWidth; $('#callx').classList.add('cx-in');
}
function closeCallX() {
  cx.open = false; $('#callx').hidden = true; document.body.classList.remove('callx-open');
  parkStage();
}
$('#callx').addEventListener('click', e => {
  const b = e.target.closest('[data-cx]'); if (!b) return;
  const k = b.dataset.cx;
  if (k === 'min') return closeCallX();
  if (k === 'leave') { closeCallX(); return leaveVoice(); }
  const map = { mute: 'vp-mute', deaf: 'vp-deaf', cam: 'vp-cam', screen: 'vp-screen', sb: 'vp-sb' };
  const target = $('#' + map[k]);
  if (k === 'sb') { closeCallX(); } // la soundboard s'ouvre au-dessus de la petite barre
  target?.click();
  setTimeout(renderCallX, 50);
});
// Suivre l'état du vocal : ouverture auto sur téléphone, minuteur, mise à jour
const _renderVoicePanelCx = renderVoicePanel;
renderVoicePanel = function (...a) {
  _renderVoicePanelCx.apply(this, a);
  const cid = vc.channel;
  if (cid !== cx.last) { if (cid) { cx.since = Date.now(); if (innerWidth <= 700) setTimeout(openCallX, 0); } cx.last = cid; }
  const p = $('#voice-panel');
  if (cid && !p.querySelector('.vp-open')) p.querySelector('.vp-info')?.insertAdjacentHTML('beforeend', `<button class="vp-open" title="Plein écran" aria-label="Ouvrir l'écran d'appel">${CXI.expand}</button>`);
  renderCallX();
};
const _renderStageCx = renderStage;
renderStage = function (...a) { _renderStageCx.apply(this, a); if (cx.open) { const pv = $('.cx-people'); pv?.classList.toggle('with-video', $('#stage').children.length > 0); } };
$('#voice-panel').addEventListener('click', e => { if (e.target.closest('.vp-open,.vp-info')) openCallX(); });
setInterval(() => {
  if (!cx.open || !vc.channel) return;
  const others = (st.voice[vc.channel] || []).filter(m => m.id !== st.me).length, t = $('#cx-timer');
  if (t && (others || chanById(vc.channel)?.type !== 'dm')) t.textContent = fmtCall(Date.now() - cx.since);
  // quelqu'un arrive ou part : on redessine
  const n = document.querySelectorAll('#callx .cx-p:not(.ringing)').length;
  if (n !== (st.voice[vc.channel] || []).length) renderCallX();
}, 1000);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && cx.open) closeCallX(); });
