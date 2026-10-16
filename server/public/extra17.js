'use strict';
// Parlotte 1.7 — finitions et petits plus :
//  • croix bien centrées ; tailles conseillées et recadrage avant d'enregistrer une bannière, une icône, un avatar ;
//  • couper les notifications d'un salon, d'une conversation ou d'un serveur (1 h, 8 h, 24 h, toujours) ;
//  • photo à voir une fois dans les messages privés ;
//  • brouillons : un message commencé reste là quand on change de conversation ;
//  • appli téléphone : bandeau « nouvelle version » quand une mise à jour arrive.

const XI = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 18),
  bell: svg('<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>', 20),
  bellOff: svg('<path d="M6 16V11a6 6 0 019.5-4.9M18 11v5l2 2H8M10 20a2 2 0 004 0M3 3l18 18"/>', 20),
  once: svg('<circle cx="12" cy="12" r="9"/><path d="M11 9l2-1v8"/>', 20),
  check: svg('<path d="M5 12l5 5L20 7"/>', 18),
};

// ---------------------------------------------------------------- Croix centrées (dessinées, plus le caractère ✕)
['#srv-close', '#close-results'].forEach(sel => { const b = $(sel); if (b) { b.innerHTML = XI.close; b.setAttribute('aria-label', 'Fermer'); } });

// ---------------------------------------------------------------- Recadrage + tailles conseillées
const CROP = {
  'ov-banner-file': { ratio: 3, w: 1500, h: 500, round: false, title: 'Bannière du serveur', hint: 'Conseillé : 1500 × 500 px (format 3:1)' },
  'ov-icon-file': { ratio: 1, w: 512, h: 512, round: false, title: 'Icône du serveur', hint: 'Conseillé : image carrée, 512 × 512 px' },
  'pe-banner': { ratio: 3, w: 1500, h: 500, round: false, title: 'Bannière du profil', hint: 'Conseillé : 1500 × 500 px (format 3:1)' },
  'pe-avatar': { ratio: 1, w: 512, h: 512, round: true, title: 'Photo de profil', hint: 'Conseillé : image carrée, 512 × 512 px' },
};
// l'indication sous les boutons
new MutationObserver(() => {
  for (const [id, sel] of Object.entries({ 'ov-banner-file': 1, 'ov-icon-file': 1, 'pe-banner': 1, 'pe-avatar': 1 })) {
    const i = document.getElementById(id); if (!i || i.dataset.hinted) continue;
    i.dataset.hinted = '1'; i.title = CROP[id].hint;
    const lab = i.closest('label'); if (lab) lab.title = CROP[id].hint;
  }
  const ov = $('.ov-fields'); if (ov && !ov.querySelector('.size-hints')) ov.insertAdjacentHTML('afterbegin', `<p class="size-hints">Bannière : <b>1500 × 500 px</b> · Icône : <b>carrée, 512 × 512 px</b> · 8 Mo max. Tu pourras recadrer après avoir choisi.</p>`);
  const pe = document.getElementById('pe-banner')?.closest('.pe-btns'); if (pe && !pe.parentElement.querySelector('.size-hints')) pe.insertAdjacentHTML('afterend', '<p class="size-hints">Bannière : <b>1500 × 500 px</b> · Photo : <b>carrée</b>. Tu pourras recadrer.</p>');
}).observe(document.body, { childList: true, subtree: true });

document.body.insertAdjacentHTML('beforeend', `<dialog id="crop" aria-label="Recadrer l'image"><div class="cr-box">
  <header><b id="cr-title">Recadrer</b><small id="cr-hint"></small></header>
  <div class="cr-stage" id="cr-stage"><img id="cr-img" alt="" draggable="false"><div class="cr-frame" id="cr-frame"></div></div>
  <label class="cr-zoom"><span>Zoom</span><input type="range" id="cr-zoom" min="1" max="4" step="0.01" value="1"></label>
  <menu><button type="button" id="cr-cancel">Annuler</button><button type="button" class="primary" id="cr-ok">Valider</button></menu></div></dialog>`);
const cr = { input: null, file: null, opt: null, img: null, s: 1, x: 0, y: 0, base: 1 };
function crLayout() {
  const st0 = $('#cr-stage'), W = st0.clientWidth, H = st0.clientHeight, o = cr.opt;
  const fw = Math.min(W - 32, (H - 32) * o.ratio), fh = fw / o.ratio;
  const f = $('#cr-frame'); f.style.width = fw + 'px'; f.style.height = fh + 'px'; f.classList.toggle('round', o.round);
  cr.fw = fw; cr.fh = fh;
  cr.base = Math.max(fw / cr.img.naturalWidth, fh / cr.img.naturalHeight); // l'image couvre toujours le cadre
  crClamp(); crApply();
}
function crClamp() {
  const k = cr.base * cr.s, iw = cr.img.naturalWidth * k, ih = cr.img.naturalHeight * k;
  const mx = Math.max(0, (iw - cr.fw) / 2), my = Math.max(0, (ih - cr.fh) / 2);
  cr.x = Math.max(-mx, Math.min(mx, cr.x)); cr.y = Math.max(-my, Math.min(my, cr.y));
}
function crApply() {
  const k = cr.base * cr.s, i = $('#cr-img');
  i.style.width = cr.img.naturalWidth * k + 'px'; i.style.height = cr.img.naturalHeight * k + 'px';
  i.style.transform = `translate(calc(-50% + ${cr.x}px), calc(-50% + ${cr.y}px))`;
}
async function openCrop(input, file, opt) {
  Object.assign(cr, { input, file, opt, s: 1, x: 0, y: 0 });
  const url = URL.createObjectURL(file), img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }).catch(() => null);
  if (!img.naturalWidth) { URL.revokeObjectURL(url); return passThrough(input, file); }
  cr.img = img; $('#cr-img').src = url; $('#cr-zoom').value = 1;
  $('#cr-title').textContent = opt.title; $('#cr-hint').textContent = opt.hint;
  const box = $('#crop'); if (!box.open) box.showModal(); // au-dessus des autres fenêtres (paramètres, profil)
  requestAnimationFrame(crLayout);
}
function passThrough(input, file) {
  const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input._cropped = true;
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
function closeCrop() { const box = $('#crop'); if (box.open) box.close(); if (cr.img) URL.revokeObjectURL(cr.img.src); cr.img = null; }
$('#crop').addEventListener('cancel', () => { if (cr.input) cr.input.value = ''; setTimeout(closeCrop); });
document.addEventListener('change', e => {
  const i = e.target; if (!(i instanceof HTMLInputElement) || i.type !== 'file' || !CROP[i.id]) return;
  if (i._cropped) { i._cropped = false; return; }
  const f = i.files[0]; if (!f || !/^image\/(png|jpeg|webp)$/.test(f.type)) return; // GIF animés : gardés tels quels
  e.stopImmediatePropagation(); openCrop(i, f, CROP[i.id]);
}, true);
$('#cr-cancel').onclick = () => { if (cr.input) cr.input.value = ''; closeCrop(); };
$('#cr-zoom').oninput = e => { cr.s = Number(e.target.value); crClamp(); crApply(); };
$('#cr-stage').addEventListener('wheel', e => { e.preventDefault(); cr.s = Math.min(4, Math.max(1, cr.s * Math.exp(-e.deltaY * 0.0015))); $('#cr-zoom').value = cr.s; crClamp(); crApply(); }, { passive: false });
(() => {
  const pts = new Map(); let start = null;
  const stg = $('#cr-stage');
  stg.addEventListener('pointerdown', e => { stg.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); start = { x: cr.x, y: cr.y, s: cr.s, pts: new Map([...pts].map(([k, v]) => [k, { ...v }])) }; });
  stg.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId) || !start) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const [a, b] = [...pts.values()], [a0, b0] = [...start.pts.values()];
    if (b && b0) { cr.s = Math.min(4, Math.max(1, start.s * Math.hypot(a.x - b.x, a.y - b.y) / (Math.hypot(a0.x - b0.x, a0.y - b0.y) || 1))); $('#cr-zoom').value = cr.s; }
    else { cr.x = start.x + a.x - a0.x; cr.y = start.y + a.y - a0.y; }
    crClamp(); crApply();
  });
  const end = e => { pts.delete(e.pointerId); if (!pts.size) start = null; };
  stg.addEventListener('pointerup', end); stg.addEventListener('pointercancel', end);
})();
$('#cr-ok').onclick = async () => {
  const o = cr.opt, k = cr.base * cr.s, img = cr.img;
  // coin haut-gauche du cadre, en pixels de l'image
  const sx = (img.naturalWidth * k / 2 - cr.x - cr.fw / 2) / k, sy = (img.naturalHeight * k / 2 - cr.y - cr.fh / 2) / k;
  const sw = cr.fw / k, sh = cr.fh / k;
  const outW = Math.min(o.w, Math.round(sw)), outH = Math.round(outW / o.ratio);
  const c = document.createElement('canvas'); c.width = outW; c.height = outH;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  const type = o.ratio === 1 ? 'image/png' : 'image/jpeg';
  const blob = await new Promise(r => c.toBlob(r, type, 0.9));
  const input = cr.input; closeCrop();
  passThrough(input, new File([blob], type === 'image/png' ? 'image.png' : 'image.jpg', { type }));
};

// ---------------------------------------------------------------- Couper les notifications
st.mutes = {};
const _handle17 = handle;
handle = function (m) {
  if (m.t === 'mutes') { st.mutes = m.mutes || {}; renderMuteBtn(); return; }
  _handle17(m);
  if (m.t === 'auth') { st.mutes = m.profile?.mutes || {}; renderMuteBtn(); }
};
const muteLive = id => { const v = id && st.mutes[id]; return !!v && (v === 'always' || Date.parse(v) > Date.now()); };
const mutedHere = c => !!c && (muteLive(c.id) || muteLive(c.parent_id) || muteLive(c.server_id));
const _notify17 = notify;
notify = function (msg, ch) { if (mutedHere(ch)) return; _notify17(msg, ch); };
$('#pins').insertAdjacentHTML('beforebegin', `<button id="mute-btn" title="Notifications" aria-label="Notifications" hidden>${XI.bell}</button>`);
function renderMuteBtn() {
  const b = $('#mute-btn'), c = st.view.channel && chanById(st.view.channel); if (!b) return;
  b.hidden = !c || c.type === 'voice';
  const on = mutedHere(c); b.innerHTML = on ? XI.bellOff : XI.bell; b.classList.toggle('muted', on);
  b.title = on ? 'Notifications coupées' : 'Couper les notifications';
}
const _renderMain17x = renderMain;
renderMain = function (...a) { _renderMain17x.apply(this, a); renderMuteBtn(); };
const untilTxt = v => (v === 'always' ? 'jusqu\'à ce que tu les réactives' : `jusqu'à ${new Date(v).toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' })}`);
function muteSection(id, label) {
  const v = muteLive(id) && st.mutes[id];
  return `<div class="mute-sec"><h4>${esc(label)}</h4>${v ? `<p class="small">Coupées ${esc(untilTxt(v))}.</p><button class="sh-item" data-mute="${id}" data-min="0"><span class="sh-ico">${XI.bell}</span><b>Réactiver les notifications</b></button>`
    : `<div class="mute-opts">${[[60, '1 heure'], [480, '8 heures'], [1440, '24 heures'], [-1, 'Toujours']].map(([m, l]) => `<button class="plan-slot" data-mute="${id}" data-min="${m}">${l}</button>`).join('')}</div>`}</div>`;
}
$('#mute-btn').onclick = () => {
  const c = chanById(st.view.channel); if (!c) return;
  const s = c.type !== 'dm' && server();
  openSheet(`<h3 class="sh-title">${XI.bellOff} Couper les notifications</h3>
    ${muteSection(c.type === 'thread' ? c.parent_id : c.id, c.type === 'dm' ? (c.group ? 'Ce groupe' : 'Cette conversation') : `Le salon #${c.type === 'thread' ? chanById(c.parent_id)?.name : c.name}`)}
    ${s ? muteSection(s.id, `Tout le serveur ${s.name}`) : ''}
    <p class="small">Tu verras toujours les nouveaux messages dans l'appli, mais sans son ni notification.</p>`);
};
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-mute]'); if (!b) return;
  const min = Number(b.dataset.min);
  try { const r = await request('setMute', { target: b.dataset.mute, minutes: min || null }); st.mutes = r.mutes; renderMuteBtn(); closeSheet(); toast(min ? 'Notifications coupées 🔕' : 'Notifications réactivées 🔔'); }
  catch (err) { toast(err.message, true); }
});

// ---------------------------------------------------------------- Photo à voir une fois (messages privés)
let onceArmed = false;
const _request17 = request;
request = function (t, p = {}) {
  if (t === 'send' && onceArmed && (p.attachments || []).length === 1) { p = { ...p, once: true }; onceArmed = false; syncOnce(); }
  return _request17(t, p);
};
function syncOnce() {
  const pend = $('#pending'), c = chanById(st.view.channel);
  const ok = c?.type === 'dm' && pendingFiles.length === 1 && /^image\/(png|jpeg|gif|webp)$/.test(pendingFiles[0].file?.type || '');
  let b = $('#once-btn');
  if (!ok) { b?.remove(); onceArmed = false; return; }
  if (!b) { pend.insertAdjacentHTML('beforeend', `<button type="button" id="once-btn" title="La photo ne pourra être vue qu'une fois">${XI.once}<span>Vue unique</span></button>`); b = $('#once-btn'); }
  b.classList.toggle('on', onceArmed);
}
new MutationObserver(() => syncOnce()).observe($('#pending'), { childList: true });
document.addEventListener('click', e => { if (e.target.closest('#once-btn')) { onceArmed = !onceArmed; syncOnce(); if (onceArmed) toast('La photo ne pourra être vue qu\'une fois'); } });
const _attachmentsHTML17 = attachmentsHTML;
attachmentsHTML = function (list) {
  const once = (list || []).filter(a => a.once), rest = (list || []).filter(a => !a.once);
  return (once.length ? `<div class="atts">${once.map(a => {
    const seen = a.viewers || [], mineView = seen.includes(st.me);
    return `<button class="once-card ${seen.length ? 'opened' : ''}" data-once="${esc(a.id)}"><span class="oc-ico">${XI.once}</span><span><b>Photo · vue unique</b><small data-once-state>…</small></span></button>`;
  }).join('')}</div>` : '') + (rest.length ? _attachmentsHTML17(rest) : '');
};
// L'état dépend de qui regarde : on le remplit après l'affichage
function fillOnce() {
  document.querySelectorAll('.once-card').forEach(card => {
    const row = card.closest('.msg[data-id]'); const m = row && (st.msgs[st.view.channel] || []).find(x => x.id === row.dataset.id); if (!m) return;
    const a = m.attachments.find(x => x.id === card.dataset.once), mine = m.author_id === st.me, seen = a.viewers || [];
    card.querySelector('[data-once-state]').textContent = mine ? (seen.length ? 'Ouverte ✓' : 'Pas encore ouverte') : seen.includes(st.me) ? 'Ouverte' : 'Touche pour la voir (une seule fois)';
    card.disabled = mine || seen.includes(st.me);
  });
}
const _renderMain17o = renderMain;
renderMain = function (...a) { _renderMain17o.apply(this, a); fillOnce(); };
document.addEventListener('click', async e => {
  const card = e.target.closest('.once-card'); if (!card || card.disabled) return;
  try {
    const { url } = await request('viewOnce', { fileId: card.dataset.once });
    pv.list = [{ src: url }]; const box = $('#pv'); box.classList.add('once'); box.hidden = false; box.classList.remove('closing'); pvShow(0);
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  } catch (err) { toast(err.message, true); }
});
new MutationObserver(() => { const box = $('#pv'); if (box.hidden && box.classList.contains('once')) { box.classList.remove('once'); $('#pv-img').removeAttribute('src'); } })
  .observe($('#pv'), { attributes: true, attributeFilter: ['hidden'] });

// ---------------------------------------------------------------- Brouillons
const drafts = (() => { try { return JSON.parse(localStorage.getItem('parlotte-drafts') || '{}'); } catch { return {}; } })();
const saveDrafts = () => { try { localStorage.setItem('parlotte-drafts', JSON.stringify(drafts)); } catch {} };
const _openChannel17 = openChannel;
openChannel = function (...a) {
  const prev = st.view.channel, inp = $('#input');
  if (prev) { const v = inp.value; if (v.trim()) drafts[prev] = v; else delete drafts[prev]; saveDrafts(); }
  const r = _openChannel17.apply(this, a);
  if (st.view.channel !== prev) {
    inp.value = drafts[st.view.channel] || ''; inp.style.height = 'auto'; if (inp.value) inp.style.height = inp.scrollHeight + 'px';
    inp.dispatchEvent(new Event('input')); // bouton Envoyer
  }
  return r;
};
const _sendMessage17 = sendMessage;
sendMessage = async function () { const c = st.view.channel; await _sendMessage17(); if (!$('#input').value.trim()) { delete drafts[c]; saveDrafts(); } };
// petite marque « Brouillon » dans la liste des conversations
const _renderSide17d = renderSide;
renderSide = function () {
  _renderSide17d();
  document.querySelectorAll('#side-list [data-chan-id]').forEach(el => {
    const d = drafts[el.dataset.chanId]; if (!d || el.dataset.chanId === st.view.channel || el.querySelector('.draft-tag')) return;
    const p = el.querySelector('.cprev, .preview, small'); if (p) p.innerHTML = `<span class="draft-tag">Brouillon :</span> ${esc(d.slice(0, 60))}`;
  });
};

// ---------------------------------------------------------------- Appli téléphone : nouvelle version disponible
if ('serviceWorker' in navigator && !window.parlotteDesktop) {
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) { had = true; return; } // première installation : rien à dire
    if ($('#upd-pwa')) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="upd-pwa" role="status"><b>Nouvelle version de Parlotte</b><button class="primary" id="upd-pwa-go">Mettre à jour</button><button class="ib-x" id="upd-pwa-x" aria-label="Plus tard">${XI.close}</button></div>`);
  });
  document.addEventListener('click', e => { if (e.target.closest('#upd-pwa-go')) location.reload(); if (e.target.closest('#upd-pwa-x')) $('#upd-pwa')?.remove(); });
  // vérifie de temps en temps (et quand on revient dans l'appli)
  const check = () => navigator.serviceWorker.getRegistration().then(r => r?.update()).catch(() => {});
  setInterval(check, 30 * 60e3); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
}
