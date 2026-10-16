'use strict';
// Parlotte 1.8 — l'appareil photo partout :
//  • le bouton central de la barre devient l'appareil photo (story, potes, souvenirs… au choix après) ;
//  • dans une conversation, le menu « + » ouvre l'appareil photo pour envoyer directement ici,
//    avec « Vue unique » ; le menu « + » devient une feuille stylée ;
//  • en privé à deux : pas de sondage ni de « proposer une partie » (ils restent dans les groupes et serveurs).

const CI = {
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 24),
  gallery: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 24),
  file: svg('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5"/>', 24),
  poll: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>', 24),
  pad: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01"/>', 24),
  ttt: svg('<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>', 24),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 24),
  once: svg('<circle cx="12" cy="12" r="9"/><path d="M11 9l2-1v8"/>', 18),
  send: svg('<path d="M21 3L3 10.5l7 3 3 7z"/><path d="M10 13.5L21 3"/>', 18),
};
const isDuo = c => c?.type === 'dm' && !c.group;

// ---------------------------------------------------------------- Bouton central = appareil photo
const _renderNav18 = renderNav;
renderNav = function () {
  _renderNav18();
  const b = $('#story-new');
  if (b && !b.dataset.cam) { b.dataset.cam = '1'; b.title = 'Appareil photo'; b.setAttribute('aria-label', 'Appareil photo'); b.innerHTML = `${CI.camera}<b>Photo</b>`; }
};

// ---------------------------------------------------------------- Appareil photo pour une conversation
let camTarget = null; // salon où envoyer directement
function openCameraFor(cid) { camTarget = cid; openCamera(); }
const _openEditor18 = openEditor;
openEditor = function (file, kind, opts) {
  _openEditor18(file, kind, opts);
  $('#sedit-to')?.remove();
  const c = camTarget && chanById(camTarget); if (!c) return;
  const name = c.type === 'dm' ? (c.group ? groupName(c) : dmOther(c).name) : '#' + c.name;
  const canOnce = c.type === 'dm' && kind === 'image';
  $('#sedit .s-bottom').insertAdjacentHTML('afterbegin', `<div id="sedit-to">${canOnce ? `<button type="button" class="sto-once" aria-pressed="false">${CI.once}<span>Vue unique</span></button>` : ''}
    <button type="button" class="primary sto-send">${CI.send}<span>Envoyer à ${esc(name)}</span></button></div>`);
};
document.addEventListener('click', async e => {
  const o = e.target.closest('.sto-once'); if (o) { const on = o.getAttribute('aria-pressed') !== 'true'; o.setAttribute('aria-pressed', on); o.classList.toggle('on', on); return; }
  const s = e.target.closest('.sto-send'); if (!s || s.disabled) return;
  s.disabled = true; s.querySelector('span').textContent = 'Envoi…';
  try {
    const up = await edUpload(), once = $('.sto-once')?.classList.contains('on');
    await request('send', { channelId: camTarget, content: '', attachments: [up.id], once: !!once });
    const cid = camTarget; camTarget = null; closeEditor();
    if (st.view.channel !== cid) openById?.(cid);
    toast(once ? 'Photo à vue unique envoyée 📨' : 'Envoyé 📨');
  } catch (err) { toast(err.message, true); s.disabled = false; s.querySelector('span').textContent = 'Réessayer'; }
});
// Fermer l'appareil photo (ou l'éditeur sans envoyer) oublie la conversation visée
const _closeCamera18 = closeCamera;
closeCamera = function () { _closeCamera18(); if ($('#sedit').hidden) camTarget = null; };
// Le bouton central de la barre ouvre l'appareil photo « libre »
document.addEventListener('click', e => { if (e.target.closest('#story-new,[data-story-new]')) camTarget = null; }, true);

// Envoyer à des potes depuis l'éditeur : avec « Vue unique » pour une photo
function addOnceToSend() {
  const f = $('#ssend-form'); if (!f || f.querySelector('.ssend-once') || ed.kind !== 'image') return;
  f.querySelector('menu').insertAdjacentHTML('beforebegin', `<label class="ssend-once">${CI.once}<span>Vue unique (ne s'ouvre qu'une fois)</span><input type="checkbox" id="ssend-once"></label>`);
}
new MutationObserver(addOnceToSend).observe($('#sedit-input'), { childList: true });
const _request18 = request;
request = function (t, p = {}) {
  if (t === 'send' && $('#ssend-once')?.checked && !$('#sedit-input').hidden && (p.attachments || []).length === 1) p = { ...p, once: true };
  return _request18(t, p);
};

// ---------------------------------------------------------------- Menu « + » en feuille
$('#attach').onclick = e => {
  e.stopPropagation(); $('#plus-menu').hidden = true;
  const c = chanById(st.view.channel); if (!c) return;
  const s = c.type !== 'dm' && server(), duo = isDuo(c);
  const tile = (k, ico, label, sub, cls = '') => `<button class="plus-tile ${cls}" data-plus18="${k}">${ico}<b>${label}</b><small>${sub}</small></button>`;
  openSheet(`<h3 class="sh-title">Ajouter</h3><div class="plus-grid">
    ${tile('camera', CI.camera, 'Appareil photo', duo ? 'Photo, vidéo, vue unique' : 'Photo ou vidéo', 'hot')}
    ${tile('gallery', CI.gallery, 'Galerie', 'Photos et vidéos')}
    ${tile('file', CI.file, 'Fichier', "Jusqu'à 25 Mo")}
    ${duo ? '' : tile('poll', CI.poll, 'Sondage', 'Tout le monde vote')}
    ${duo ? '' : tile('plan', CI.pad, 'Proposer une partie', 'Qui vient jouer ?')}
    ${tile('ttt', CI.ttt, 'Morpion', 'Une partie rapide')}
    ${s ? tile('event', CI.cal, 'Événement', 'Prévois une soirée') : ''}
  </div>`);
};
document.addEventListener('click', e => {
  const t = e.target.closest('[data-plus18]'); if (!t) return;
  closeSheet(); const k = t.dataset.plus18;
  if (k === 'camera') return setTimeout(() => openCameraFor(st.view.channel), 120);
  if (k === 'gallery') { const f = $('#file'); f.accept = 'image/*,video/*'; f.click(); setTimeout(() => (f.accept = ''), 1000); return; }
  if (k === 'file') { const f = $('#file'); f.accept = ''; return f.click(); }
  if (k === 'poll') return $('#poll-btn').click();
  if (k === 'plan') return openPlan();
  if (k === 'ttt') return act('startGame', { channelId: st.view.channel });
  if (k === 'event') return openEvents('new');
});

// ---------------------------------------------------------------- Privé à deux : ni sondage ni partie
const _renderMain18 = renderMain;
renderMain = function (...a) {
  _renderMain18.apply(this, a);
  const duo = isDuo(chanById(st.view.channel));
  if (duo) $('#poll-btn').hidden = true;
  const pb = $('#plan-btn'); if (pb) pb.hidden = duo || !st.view.channel;
};
