'use strict';
// Parlotte 2.1 — refonte de l'interface (partie 2) : éditeur, appareil photo et feuille « Envoyer »
//  • Texte / Heure / Lieu : une feuille qui monte, avec l'aperçu en direct sur la photo ;
//  • stickers : pincer pour agrandir / tourner, repères de centrage (avec vibration) ;
//  • « Enregistrer » → la feuille de l'iPhone (Enregistrer l'image) ; Souvenirs : instantané ;
//  • caméra : l'image arrive en fondu (plus de zoom ni de saut) ;
//  • « Envoyer » : plus aéré, rangé par sections, et tes choix sont gardés.

const E21 = {
  check: svg('<path d="M5 12l5 5L20 7"/>', 14),
  text: svg('<path d="M5 6h14M12 6v13M9 19h6"/>', 22),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 22),
  pin: svg('<path d="M12 21s7-6.1 7-11.5a7 7 0 10-14 0C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 22),
};
const TCOL = ['#FFFFFF', '#14121A', '#FF6B4A', '#F5C04A', '#3FB27F', '#6FE3D2', '#4FA3D1', '#8E6CFF', '#E05A8A'];
const TSTY21 = [['classic', 'Classique'], ['neon', 'Néon'], ['type', 'Machine'], ['box', 'Étiquette'], ['strong', 'Gras']];

// ================================================================ La feuille d'édition (en bas, la photo reste visible au-dessus)
$('#sedit').insertAdjacentHTML('beforeend', '<div id="ed-sheet" hidden><div class="eds-grab"><i></i></div><div class="eds-body"></div></div><i class="ed-guide v" hidden></i><i class="ed-guide h" hidden></i>');
let eds = null; // { type, k (sticker en cours), i (index), isNew }
function openEdSheet(type, html, k, isNew) {
  eds = { type, k, isNew, i: isNew ? ed.stickers.push(k) - 1 : ed.stickers.indexOf(k) };
  ed.sel = -1; renderStickers($('#sedit-layer'), ed.stickers, { edit: true });
  const s = $('#ed-sheet'); s.querySelector('.eds-body').innerHTML = html; s.hidden = false;
  s.classList.remove('in'); void s.offsetWidth; s.classList.add('in');
  $('#sedit').classList.add('editing'); H(8);
}
function closeEdSheet(keep) {
  const s = $('#ed-sheet'); if (s.hidden || !eds) return;
  if (!keep && eds.isNew) ed.stickers.splice(eds.i, 1);
  if (keep && (eds.k.text || '').trim() === '' && eds.k.type !== 'gif') ed.stickers.splice(eds.i, 1);
  eds = null; s.classList.remove('in'); $('#sedit').classList.remove('editing');
  setTimeout(() => (s.hidden = true), 220);
  document.activeElement?.blur?.();
  renderStickers($('#sedit-layer'), ed.stickers, { edit: true });
}
const livePaint = () => { if (eds) renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); };
function styleChips(cur, sample) {
  return `<div class="eds-chips" data-noswipe>${TSTY21.map(([k, l]) => `<button type="button" class="eds-chip ${k === cur ? 'on' : ''}" data-eds-sty="${k}"><span class="sty-${k}">${esc(sample || l)}</span><small>${l}</small></button>`).join('')}</div>`;
}
// Texte
$('#sedit-text').onclick = e => { e.stopImmediatePropagation(); textSheet(); };
function textSheet(k) {
  const isNew = !k; k = k || { type: 'text', text: '', color: '#FFFFFF', bg: null, size: 30, style: 'classic', x: 0.5, y: 0.4 + 0.08 * (ed.stickers.length % 3), rot: 0 };
  openEdSheet('text', `<textarea id="eds-in" rows="2" maxlength="80" placeholder="Écris quelque chose…">${esc(k.text)}</textarea>
    ${styleChips(k.style || 'classic', 'Aa')}
    <div class="eds-cols" data-noswipe>${TCOL.map(c => `<button type="button" class="eds-col ${c === k.color ? 'on' : ''}" data-eds-col="${c}" style="--c:${c}" aria-label="Couleur ${c}"></button>`).join('')}
      <button type="button" class="eds-bg ${k.bg ? 'on' : ''}" data-eds-bg>Fond</button></div>
    <div class="eds-row"><span class="eds-size-l">A</span><input type="range" id="eds-size" min="16" max="56" value="${k.size}"><span class="eds-size-b">A</span></div>
    <div class="eds-foot"><button type="button" class="pill-btn" data-eds-cancel>Annuler</button><button type="button" class="primary" data-eds-ok>${isNew ? 'Ajouter' : 'OK'}</button></div>`, k, isNew);
  const inp = $('#eds-in'); setTimeout(() => inp.focus(), 60);
  inp.oninput = () => { k.text = inp.value || ''; livePaint(); };
  $('#eds-size').oninput = e => { k.size = +e.target.value; livePaint(); };
}
// Heure
$('#sedit-time').onclick = e => { e.stopImmediatePropagation(); labelSheet('time'); };
$('#sedit-place').onclick = e => { e.stopImmediatePropagation(); labelSheet('place'); };
function labelSheet(type, k) {
  const isNew = !k, t = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  k = k || { type, text: type === 'time' ? t : '', style: 'box', x: 0.5, y: (type === 'time' ? 0.16 : 0.26) + 0.07 * (ed.stickers.length % 3), rot: 0, size: 24 };
  openEdSheet(type, `${type === 'place' ? `<div class="eds-place"><input id="eds-in" maxlength="40" placeholder="Paris, la plage, chez Léa…" value="${esc(k.text)}" autocomplete="off"><button type="button" class="pill-btn" data-eds-gps>${E21.pin}<span>Ma ville</span></button></div>` : `<h4 class="eds-h">${E21.clock} ${esc(k.text)}</h4>`}
    ${styleChips(k.style, type === 'time' ? k.text : '📍 Lieu')}
    <div class="eds-foot"><button type="button" class="pill-btn" data-eds-cancel>Annuler</button><button type="button" class="primary" data-eds-ok>${isNew ? 'Ajouter' : 'OK'}</button></div>`, k, isNew);
  if (type === 'place') { const inp = $('#eds-in'); setTimeout(() => inp.focus(), 60); inp.oninput = () => { k.text = inp.value; livePaint(); }; }
}
$('#ed-sheet').addEventListener('click', e => {
  if (!eds) return; const k = eds.k;
  const st_ = e.target.closest('[data-eds-sty]'); if (st_) { k.style = st_.dataset.edsSty; $('#ed-sheet').querySelectorAll('.eds-chip').forEach(b => b.classList.toggle('on', b === st_)); H(6); return livePaint(); }
  const c = e.target.closest('[data-eds-col]'); if (c) { k.color = c.dataset.edsCol; $('#ed-sheet').querySelectorAll('.eds-col').forEach(b => b.classList.toggle('on', b === c)); H(6); return livePaint(); }
  if (e.target.closest('[data-eds-bg]')) { k.bg = k.bg ? null : (k.color === '#FFFFFF' ? '#14121A' : '#FFFFFF'); e.target.closest('[data-eds-bg]').classList.toggle('on', !!k.bg); H(6); return livePaint(); }
  if (e.target.closest('[data-eds-cancel]')) return closeEdSheet(false);
  if (e.target.closest('[data-eds-ok]')) { H(10); return closeEdSheet(true); }
  if (e.target.closest('[data-eds-gps]')) {
    const b = e.target.closest('[data-eds-gps]'); if (!navigator.geolocation) return toast('Position indisponible', true);
    b.querySelector('span').textContent = '…';
    navigator.geolocation.getCurrentPosition(async p => {
      try { const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.coords.latitude.toFixed(3)}&longitude=${p.coords.longitude.toFixed(3)}&localityLanguage=fr`); const j = await r.json();
        k.text = j.city || j.locality || j.principalSubdivision || ''; const i = $('#eds-in'); if (i) i.value = k.text; livePaint(); } catch { toast('Ville introuvable : écris-la', true); }
      b.querySelector('span').textContent = 'Ma ville';
    }, () => { toast('Position refusée : écris le lieu', true); b.querySelector('span').textContent = 'Ma ville'; }, { timeout: 8000, maximumAge: 600000 });
  }
});
// toucher deux fois un texte déjà posé : on le modifie
$('#sedit-layer').addEventListener('dblclick', e => {
  const el = e.target.closest('[data-stk]'); if (!el) return; const k = ed.stickers[+el.dataset.stk];
  if (k?.type === 'text') textSheet(k); else if (k?.type === 'time' || k?.type === 'place') labelSheet(k.type, k);
});

// ================================================================ Stickers : taille, rotation, repères
const _stickerHTML21 = stickerHTML;
stickerHTML = function (k, i, opts = {}) {
  const h = _stickerHTML21(k, i, opts), s = k.s && k.s !== 1 ? ` scale(${(+k.s).toFixed(3)})` : '';
  let out = s ? h.replace(/(transform:translate\(-50%,-50%\) rotate\([-\d.]+deg\))/, `$1${s}`) : h;
  // styles du texte : appliqués aussi au texte simple (et visibles même avec une couleur choisie)
  if ((k.type === 'time' || k.type === 'place') && k.size && k.size !== 24) out = out.replace('style="', `style="font-size:${k.size}px;`);
  return out;
};
(() => {
  const stage = $('#sedit-stage'); let act = null, p0 = null, guideOn = { v: false, h: false };
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), ang = (a, b) => Math.atan2(b.clientY - a.clientY, b.clientX - a.clientX) * 180 / Math.PI;
  stage.addEventListener('touchstart', e => {
    const el = e.target.closest('#sedit-layer [data-stk]'); if (el) act = +el.dataset.stk;
    if (e.touches.length === 2 && act !== null && ed.stickers[act]) { const k = ed.stickers[act]; p0 = { d: dist(e.touches[0], e.touches[1]), a: ang(e.touches[0], e.touches[1]), s: k.s || 1, r: k.rot || 0 }; }
  }, { passive: true });
  stage.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !p0 || act === null) return;
    e.preventDefault();
    const k = ed.stickers[act]; if (!k) return;
    k.s = Math.max(0.35, Math.min(4, p0.s * dist(e.touches[0], e.touches[1]) / p0.d));
    let r = p0.r + ang(e.touches[0], e.touches[1]) - p0.a; r = ((r + 540) % 360) - 180;
    if (Math.abs(r) < 4) { if (k.rot && Math.abs(k.rot) >= 4) H(5); r = 0; } // revient droit
    k.rot = Math.round(r);
    const el = $(`#sedit-layer [data-stk="${act}"]`); if (el) el.style.transform = `translate(-50%,-50%) rotate(${k.rot}deg) scale(${k.s.toFixed(3)})`;
  }, { passive: false });
  stage.addEventListener('touchend', e => { if (e.touches.length < 2) p0 = null; }, { passive: true });
  // repères de centrage pendant qu'on déplace
  $('#sedit-layer').addEventListener('pointerdown', e => { const el = e.target.closest('[data-stk]'); if (el) act = +el.dataset.stk; });
  $('#sedit-layer').addEventListener('pointermove', e => {
    if (!(e.buttons || e.pointerType === 'touch') || act === null || p0) return;
    const k = ed.stickers[act], el = $(`#sedit-layer [data-stk="${act}"]`); if (!k || !el || !el.style.left) return;
    const sv = Math.abs(k.x - 0.5) < 0.025, sh = Math.abs(k.y - 0.5) < 0.02;
    if (sv) { k.x = 0.5; el.style.left = '50%'; } if (sh) { k.y = 0.5; el.style.top = '50%'; }
    if (sv !== guideOn.v || sh !== guideOn.h) { if ((sv && !guideOn.v) || (sh && !guideOn.h)) H(6); guideOn = { v: sv, h: sh }; $('#sedit .ed-guide.v').hidden = !sv; $('#sedit .ed-guide.h').hidden = !sh; }
  });
  const off = () => { $('#sedit .ed-guide.v').hidden = true; $('#sedit .ed-guide.h').hidden = true; guideOn = { v: false, h: false }; };
  $('#sedit-layer').addEventListener('pointerup', off); $('#sedit-layer').addEventListener('pointercancel', off);
})();

// ================================================================ Enregistrer dans Photos / Souvenirs instantanés
$('#sedit-dl').onclick = async () => {
  H(8);
  try {
    let f = ed.kind === 'image' && ed.stickers.length ? await bakeImage().catch(() => null) : null;
    if (!f) f = ed.file || (ed.remote ? await fetch(ed.remote).then(r => r.blob()).then(b => new File([b], ed.kind === 'video' ? 'parlotte.mp4' : 'parlotte.jpg', { type: b.type })) : null);
    if (f && navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f] }); return; }
  } catch (err) { if (err?.name === 'AbortError') return; }
  const a = document.createElement('a'); a.href = ed.url || ed.remote; a.download = `parlotte-${Date.now()}.${ed.kind === 'video' ? 'mp4' : 'jpg'}`;
  document.body.appendChild(a); a.click(); a.remove(); toast('Enregistré');
};
const _saveMem21 = $('#sedit-save').onclick;
$('#sedit-save').onclick = async () => {
  const b = $('#sedit-save');
  if (ed.memoryId || b.classList.contains('done')) return _saveMem21();
  b.classList.add('done', 'pop'); setTimeout(() => b.classList.remove('pop'), 500); H(12);
  toast('Gardé dans tes Souvenirs 💾');
  const file = ed.file;
  try { const up = await edUpload(); const r = await request('saveMemory', { fileId: up.id, stickers: edStickers() }); st.memories = r.memories; }
  catch (err) { if (ed.file === file) b.classList.remove('done'); toast(err.message, true); }
};
const _openEditor21 = openEditor;
openEditor = function (...a) { _openEditor21.apply(this, a); $('#ed-sheet').hidden = true; eds = null; $('#sedit').classList.remove('editing'); };

// ================================================================ Caméra : l'image arrive en fondu
const _startCamera21 = startCamera;
startCamera = async function (...a) {
  const v = $('#scam-v'); v.classList.add('cam-hide');
  await _startCamera21.apply(this, a);
  const show = () => setTimeout(() => v.classList.remove('cam-hide'), 120);
  if (v.readyState >= 3 && !v.paused) show(); else { v.addEventListener('playing', show, { once: true }); setTimeout(show, 1600); }
};

// ================================================================ Feuille « Envoyer » : refaite, et elle se souvient
let sndFor = null;
openSendSheet = function () {
  const keep = sndFor === ed.file && ed.file;
  if (!keep) { Object.assign(snd, { story: false, note: false, post: window.sendPreset === 'post', ids: new Set(), chans: new Set(), aud: null, paud: null, once: false, cap: '', noteText: st.profile?.customStatus || '', com: true, hide: false }); sndFor = ed.file; }
  window.sendPreset = null;
  const me = user(st.me);
  openSheet(`<div class="snd s21" data-noswipe>
    <div class="s21-dests">
      <button class="s21-d" data-snd="story"><span class="s21-ring story">${avatarNU(me)}</span><b>Ta story</b><i class="s21-chk">${E21.check}</i></button>
      <button class="s21-d" data-snd="note"><span class="s21-ring note"><em>Aa</em></span><b>Ta note</b><i class="s21-chk">${E21.check}</i></button>
      <button class="s21-d" data-snd="post"><span class="s21-ring post">${svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>', 26)}</span><b>Ton profil</b><i class="s21-chk">${E21.check}</i></button>
    </div>
    <div class="snd-extra"></div>
    <h5 class="s21-h">Envoyer à</h5>
    <div class="fsr-box snd-q"><span>${V9.search}</span><input id="snd-q" placeholder="Rechercher un pote" autocomplete="off"></div>
    <div class="snd-people"></div>
    <div class="snd-foot"><button class="primary snd-go" disabled>Envoyer</button></div></div>`);
  $('#sheet').classList.add('sh-tall');
  renderSendPeople(); renderSendTop();
  $('#snd-q').oninput = renderSendPeople;
};
renderSendTop = function () {
  const sh = $('#sheet .snd'); if (!sh) return;
  sh.querySelectorAll('[data-snd]').forEach(b => b.classList.toggle('on', !!snd[b.dataset.snd]));
  const g = snd.aud && fgroup(snd.aud), pg = snd.paud && fgroup(snd.paud), dm = snd.ids.size + snd.chans.size;
  const chips = (which, cur) => `<div class="snd-audp" data-noswipe>${[[null, 'Tous mes potes', '#8E6CFF'], ...fgroups().map(x => [x.id, x.id === 'close' ? '⭐ Amis proches' : x.name, x.color])].map(([id, l, c]) =>
    `<button class="snd-ap ${cur === id ? 'on' : ''}" data-ap="${id || ''}" data-ap-for="${which}" style="--fc:${esc(c)}">${esc(l)}</button>`).join('')}</div>`;
  const ex = sh.querySelector('.snd-extra');
  ex.innerHTML = [
    snd.story ? `<section class="s21-sec"><h5>Story · qui la voit</h5>${chips('story', snd.aud)}</section>` : '',
    snd.note ? `<section class="s21-sec"><h5>Note · 24 h</h5><input class="snd-in" id="snd-note" maxlength="80" placeholder="Un petit mot (facultatif)" value="${esc(snd.noteText || '')}"></section>` : '',
    snd.post ? `<section class="s21-sec"><h5>Publication</h5><textarea class="snd-in" id="snd-cap" maxlength="1000" rows="2" placeholder="Écris une légende…">${esc(snd.cap || '')}</textarea>
      ${chips('post', snd.paud)}<div class="s21-togs"><label class="s21-tog"><span>Commentaires</span><input type="checkbox" id="snd-com" switch ${snd.com ? 'checked' : ''}></label><label class="s21-tog"><span>Masquer les j'aime</span><input type="checkbox" id="snd-hide" switch ${snd.hide ? 'checked' : ''}></label></div></section>` : '',
    dm && ed.kind === 'image' ? `<label class="s21-tog once"><span>Vue unique pour les potes</span><input type="checkbox" id="snd-once" switch ${snd.once ? 'checked' : ''}></label>` : '',
  ].join('');
  const shared = snd.story || snd.note || snd.post, n = (snd.story ? 1 : 0) + (snd.note ? 1 : 0) + (snd.post ? 1 : 0) + dm, go = sh.querySelector('.snd-go');
  go.disabled = !n;
  go.textContent = !n ? 'Choisis où envoyer' : !dm ? 'Partager' : shared ? `Partager et envoyer (${dm})` : `Envoyer${dm > 1 ? ` à ${dm} potes` : ''}`;
};
// on garde ce qui est tapé
document.addEventListener('input', e => {
  if (e.target.id === 'snd-cap') snd.cap = e.target.value;
  if (e.target.id === 'snd-note') snd.noteText = e.target.value;
});
document.addEventListener('change', e => { if (e.target.id === 'snd-com') snd.com = e.target.checked; if (e.target.id === 'snd-hide') snd.hide = e.target.checked; });
document.addEventListener('click', e => {
  const a = e.target.closest('#sheet .s21 [data-ap]'); if (!a) return;
  e.stopImmediatePropagation(); const v = a.dataset.ap || null;
  if (a.dataset.apFor === 'story') snd.aud = v; else snd.paud = v; H(6); renderSendTop();
}, true);
// après l'envoi, on repart de zéro
const _doSend21 = doSend;
doSend = async function () { await _doSend21(); if ($('#sedit').hidden) sndFor = null; };
