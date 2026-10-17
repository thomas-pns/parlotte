'use strict';
// Parlotte 2.0 — partie 2 : appareil photo, envoi, Souvenirs, éditeur, GIF et notes en photo
//  • appareil photo : retourner (rond, en bas), flash, minuteur, filtres rangés derrière un bouton ;
//    plus de « saut » quand on retourne la caméra ;
//  • après la photo : un seul bouton « Envoyer » → Ta story / Ta note / Ton profil / tes potes et groupes ;
//  • Souvenirs : deux onglets (Souvenirs / Téléphone) ;
//  • éditeur : styles de texte, heure, lieu, GIF (GIPHY) ;
//  • GIF aussi dans les messages.

const C20 = {
  flip: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><path d="M9.5 12.2a3 3 0 015-1.5l.8.8M14.5 14.8a3 3 0 01-5 1.5l-.8-.8M15.5 9.5v2h-2M8.5 17.5v-2h2"/>', 26),
  flashOff: svg('<path d="M13 2L5 13h6l-1 9 8-11h-6z"/><path d="M3 3l18 18"/>', 22),
  flashOn: svg('<path d="M13 2L5 13h6l-1 9 8-11h-6z" fill="currentColor"/>', 22),
  timer: svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>', 22),
  wand: svg('<path d="M4 20L16 8M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1zM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7z"/>', 22),
  mem: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 22),
  send: svg('<path d="M21 3L3 10.5l7 3 3 7z"/><path d="M10 13.5L21 3"/>', 20),
  chevR: svg('<path d="M9 5l7 7-7 7"/>', 18),
  story: svg('<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.2"/><path d="M12 8v8M8 12h8"/>', 24),
  note: svg('<path d="M5 5h14v10H10l-5 4z"/><path d="M9 9h6M9 12h4"/>', 24),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>', 24),
  once: svg('<circle cx="12" cy="12" r="9"/><path d="M11 9l2-1v8"/>', 18),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 22),
  pin: svg('<path d="M12 21s7-6.1 7-11.5a7 7 0 10-14 0C5 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>', 22),
  gif: '<span class="gif-ic">GIF</span>',
  dl: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 20),
  phone: svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 18.5h4"/>', 20),
  check: svg('<path d="M5 12l5 5L20 7"/>', 14),
};

// ================================================================ Appareil photo : outils
const camx = { flash: false, timer: 0, filters: false, counting: false };
(() => {
  const sc = $('#scam'), stage = sc.querySelector('.sstage'), bottom = sc.querySelector('.s-bottom');
  sc.querySelector('.s-top b').textContent = '';
  stage.insertAdjacentHTML('beforeend', `<div class="cam-tools">
    <button class="ct" id="cam-flash" aria-label="Flash" aria-pressed="false">${C20.flashOff}</button>
    <button class="ct" id="cam-timer" aria-label="Minuteur" aria-pressed="false">${C20.timer}<small></small></button>
    <button class="ct" id="cam-fx" aria-label="Filtres" aria-pressed="false">${C20.wand}</button></div>
    <canvas id="scam-freeze" aria-hidden="true"></canvas><div id="scam-count" hidden></div><div id="scam-sflash" hidden></div>`);
  // en bas : Souvenirs à gauche, déclencheur au milieu, retourner (rond) à droite
  const flip = $('#scam-flip'); flip.innerHTML = C20.flip; flip.className = 'cam-round'; flip.title = 'Retourner la caméra';
  const mem = $('#scam-mem'); mem.className = 'cam-round mem'; mem.innerHTML = C20.mem;
  const side = bottom.querySelector('.cam-side'); side.innerHTML = ''; side.appendChild(mem);
  bottom.querySelector('.s-hint')?.remove();
  bottom.appendChild(flip);
  // les filtres : cachés derrière le bouton « baguette »
  const fx = $('#scam-filters'); if (fx) {
    fx.setAttribute('data-noswipe', '');
    fx.querySelectorAll('.sf i').forEach(i => { i.innerHTML = '<b></b>'; });
  }
})();
const camBtn = id => $(id);
$('#cam-flash').onclick = () => { camx.flash = !camx.flash; H(8); renderCamTools(); };
$('#cam-timer').onclick = () => { camx.timer = camx.timer === 0 ? 3 : camx.timer === 3 ? 10 : 0; H(8); renderCamTools(); if (camx.timer) toast(`Minuteur : ${camx.timer} s`); };
$('#cam-fx').onclick = () => { camx.filters = !camx.filters; H(8); renderCamTools(); };
function renderCamTools() {
  const f = $('#cam-flash'), t = $('#cam-timer'), x = $('#cam-fx');
  f.innerHTML = camx.flash ? C20.flashOn : C20.flashOff; f.classList.toggle('on', camx.flash); f.setAttribute('aria-pressed', camx.flash);
  t.classList.toggle('on', !!camx.timer); t.querySelector('small').textContent = camx.timer ? camx.timer + 's' : ''; t.setAttribute('aria-pressed', !!camx.timer);
  x.classList.toggle('on', camx.filters); x.setAttribute('aria-pressed', camx.filters);
  $('#scam').classList.toggle('show-fx', camx.filters);
}
const _openCamera20 = openCamera;
openCamera = function (...a) { camx.filters = false; camx.counting = false; renderCamTools(); $('#scam-count').hidden = true; $('#scam-freeze').classList.remove('on'); return _openCamera20.apply(this, a); };
// Retourner sans « saut » : on fige la dernière image (floutée) le temps que l'autre caméra démarre
$('#scam-flip').onclick = async () => {
  const v = $('#scam-v'), c = $('#scam-freeze'), btn = $('#scam-flip');
  btn.classList.remove('spin'); void btn.offsetWidth; btn.classList.add('spin'); H(10);
  if (v.videoWidth) {
    c.width = v.videoWidth; c.height = v.videoHeight; const g = c.getContext('2d');
    g.save(); if (cam.facing === 'user') { g.translate(c.width, 0); g.scale(-1, 1); } g.drawImage(v, 0, 0); g.restore();
    c.classList.add('on');
  }
  cam.facing = cam.facing === 'user' ? 'environment' : 'user';
  v.style.opacity = '0';
  await startCamera();
  const show = () => setTimeout(() => { v.style.opacity = ''; c.classList.remove('on'); }, 180);
  if (v.readyState >= 2 && !v.paused) show(); else { v.addEventListener('playing', show, { once: true }); setTimeout(show, 1500); }
};
// Flash : lampe du téléphone (caméra arrière) ou écran blanc (caméra avant)
async function torch(on) {
  const tr = cam.stream?.getVideoTracks?.()[0]; if (!tr) return false;
  try { if (!tr.getCapabilities?.().torch) return false; await tr.applyConstraints({ advanced: [{ torch: on }] }); return true; } catch { return false; }
}
const _takePhoto20 = takePhoto;
takePhoto = async function () {
  if (camx.counting) return;
  if (camx.timer) {
    camx.counting = true; const box = $('#scam-count');
    for (let n = camx.timer; n > 0; n--) { box.hidden = false; box.textContent = n; box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop'); H(6); await new Promise(r => setTimeout(r, 1000)); if ($('#scam').hidden) { camx.counting = false; box.hidden = true; return; } }
    box.hidden = true; camx.counting = false;
  }
  if (camx.flash) {
    if (cam.facing === 'user' || !(await torch(true))) { const f = $('#scam-sflash'); f.hidden = false; await new Promise(r => setTimeout(r, 260)); setTimeout(() => (f.hidden = true), 120); }
    else await new Promise(r => setTimeout(r, 300));
  }
  return _takePhoto20();
};
const _startRecording20 = startRecording;
startRecording = function () { if (camx.flash && cam.facing !== 'user') torch(true); return _startRecording20(); };

// ================================================================ Souvenirs : deux onglets
let memTab = 'mem', phonePicks = [], memHTML = '';
const _openMemories20 = openMemories;
openMemories = function () {
  _openMemories20(); memHTML = $('#smem-grid').innerHTML;
  const head = $('#smem .msheet-head');
  if (!head.querySelector('.mtabs')) {
    head.querySelector('b').outerHTML = `<div class="mtabs" role="tablist"><button data-mtab="mem" role="tab">${C20.mem}<span>Souvenirs</span></button><button data-mtab="phone" role="tab">${C20.phone}<span>Téléphone</span></button></div>`;
    head.addEventListener('click', e => { const t = e.target.closest('[data-mtab]'); if (t) { memTab = t.dataset.mtab; H(6); renderMemTab(); } });
  }
  renderMemTab();
};
$('#scam-mem').onclick = () => openMemories();
function renderMemTab() {
  $('#smem').querySelectorAll('[data-mtab]').forEach(b => { b.classList.toggle('on', b.dataset.mtab === memTab); b.setAttribute('aria-selected', b.dataset.mtab === memTab); });
  const grid = $('#smem-grid');
  if (memTab === 'mem') { grid.innerHTML = memHTML; return; }
  grid.innerHTML = `<label class="mphone-pick">${C20.phone}<b>Choisir dans tes photos</b><small>Photos et vidéos de ton téléphone, pour une story, une publication ou un pote</small>
      <input type="file" id="mphone-in" accept="image/*,video/*" multiple hidden></label>
    ${phonePicks.map((f, i) => `<button class="mcell" data-pick-i="${i}">${f.type.startsWith('video/') ? `<video src="${esc(f._url)}#t=0.1" muted playsinline preload="metadata"></video><i class="mplay">${SI.play}</i>` : `<img src="${esc(f._url)}" alt="">`}</button>`).join('')}`;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'mphone-in') return;
  const files = [...e.target.files].filter(f => /^(image|video)\//.test(f.type)).slice(0, 30);
  files.forEach(f => (f._url = URL.createObjectURL(f))); phonePicks = [...files, ...phonePicks].slice(0, 60);
  if (files.length === 1) return usePhonePick(files[0]);
  renderMemTab();
});
$('#smem').addEventListener('click', e => { const p = e.target.closest('[data-pick-i]'); if (p) { e.stopImmediatePropagation(); usePhonePick(phonePicks[+p.dataset.pickI]); } }, true);
async function usePhonePick(f) {
  if (!f) return; $('#smem').hidden = true; closeCamera();
  if (f.type.startsWith('video/')) { if (f.size > 25 * 1024 * 1024) return toast('Vidéo trop lourde (25 Mo max)', true); return openEditor(f, 'video'); }
  openEditor(await shrinkImage(f), 'image');
}

// ================================================================ Éditeur : nouveaux outils et un seul bouton « Envoyer »
(() => {
  const top = $('#sedit .s-top');
  top.insertAdjacentHTML('beforeend', `<button class="s-ico" id="sedit-gif" aria-label="GIF">${C20.gif}</button><button class="s-ico" id="sedit-time" aria-label="Heure">${C20.clock}</button><button class="s-ico" id="sedit-place" aria-label="Lieu">${C20.pin}</button>`);
  const bar = $('#sedit .sedit-bar');
  bar.insertAdjacentHTML('beforeend', `<button class="primary s-go" id="sedit-go"><span>Envoyer</span>${C20.chevR}</button>`);
  $('#sedit-send').hidden = true; $('#sedit-share').hidden = true;
})();
const _openEditor20 = openEditor;
openEditor = function (...a) {
  _openEditor20.apply(this, a);
  $('#sedit-aud')?.setAttribute('hidden', ''); $('#sedit-share').hidden = true; $('#sedit-send').hidden = true;
  $('#sedit-go').hidden = !!$('#sedit-to'); // depuis une conversation : « Envoyer à … » direct
  const v = $('#sedit-media video'); if (v) { v.autoplay = true; kickVideo(v); }
};
// Styles de texte
const TSTY = [['classic', 'Classique'], ['neon', 'Néon'], ['type', 'Machine'], ['box', 'Étiquette'], ['strong', 'Gras']];
let txStyle = 'classic';
$('#sedit-text').addEventListener('click', () => setTimeout(() => {
  const f = $('#stx-form'); if (!f || f.querySelector('.tsty')) return;
  txStyle = 'classic';
  f.querySelector('textarea').insertAdjacentHTML('afterend', `<div class="tsty" data-noswipe>${TSTY.map(([k, l]) => `<button type="button" class="tsb sty-${k} ${k === txStyle ? 'on' : ''}" data-tsty="${k}">${l}</button>`).join('')}</div>`);
}, 0));
$('#sedit-input').addEventListener('click', e => {
  const b = e.target.closest('[data-tsty]'); if (!b) return;
  txStyle = b.dataset.tsty; $('#sedit-input').querySelectorAll('.tsb').forEach(x => x.classList.toggle('on', x === b)); H(6);
});
$('#sedit-input').addEventListener('submit', e => {
  if (e.target.id !== 'stx-form') return;
  setTimeout(() => { const k = ed.stickers[ed.stickers.length - 1]; if (k?.type === 'text') { k.style = txStyle; renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); } }, 0);
});
// Heure et lieu
const nowHM = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const LSTY = [['box', 'Étiquette'], ['neon', 'Néon'], ['type', 'Machine'], ['strong', 'Gras'], ['classic', 'Simple']];
function addLabelSticker(type, text, style) {
  ed.stickers.push({ type, text, style, x: 0.5, y: type === 'time' ? 0.3 : 0.4, rot: 0, size: 24 });
  ed.sel = -1; renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); H(8);
}
$('#sedit-time').onclick = () => {
  const t = nowHM();
  editorModal(`<div class="s-form lbl-pick"><h3>${C20.clock} Heure</h3><div class="lbl-grid">${LSTY.map(([k]) => `<button type="button" class="stk-prev sty-${k} lbl-time" data-lbl="${k}">${esc(t)}</button>`).join('')}</div><menu><button type="button" data-cancel>Annuler</button></menu></div>`);
  $('#sedit-input').onclick = e => { const b = e.target.closest('[data-lbl]'); if (!b) return; $('#sedit-input').hidden = true; $('#sedit-input').onclick = null; addLabelSticker('time', t, b.dataset.lbl); };
};
$('#sedit-place').onclick = () => {
  editorModal(`<form class="s-form lbl-pick" id="plc-form"><h3>${C20.pin} Lieu</h3>
    <div class="plc-row"><input id="plc-in" maxlength="40" placeholder="Paris, la plage, chez Léa…" autocomplete="off"><button type="button" class="pill-btn" id="plc-gps">${C20.pin}<span>Ma ville</span></button></div>
    <div class="lbl-grid">${LSTY.map(([k]) => `<button type="button" class="stk-prev sty-${k} lbl-place ${k === 'box' ? 'on' : ''}" data-plc="${k}">📍 <span>Lieu</span></button>`).join('')}</div>
    <menu><button type="button" data-cancel>Annuler</button><button class="primary">Ajouter</button></menu></form>`);
  let sty = 'box';
  const sync = () => $('#sedit-input').querySelectorAll('.lbl-place span').forEach(s => (s.textContent = $('#plc-in').value.trim() || 'Lieu'));
  $('#plc-in').oninput = sync;
  $('#plc-form').onclick = e => { const b = e.target.closest('[data-plc]'); if (b) { sty = b.dataset.plc; $('#plc-form').querySelectorAll('[data-plc]').forEach(x => x.classList.toggle('on', x === b)); } };
  $('#plc-gps').onclick = () => {
    if (!navigator.geolocation) return toast('Position indisponible', true);
    $('#plc-gps span').textContent = '…';
    navigator.geolocation.getCurrentPosition(async p => {
      try {
        const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.coords.latitude.toFixed(3)}&longitude=${p.coords.longitude.toFixed(3)}&localityLanguage=fr`);
        const j = await r.json(); $('#plc-in').value = j.city || j.locality || j.principalSubdivision || ''; sync();
      } catch { toast('Ville introuvable : écris-la', true); }
      $('#plc-gps span').textContent = 'Ma ville';
    }, () => { toast('Position refusée : écris le lieu', true); $('#plc-gps span').textContent = 'Ma ville'; }, { timeout: 8000, maximumAge: 600000 });
  };
  $('#plc-form').onsubmit = e => { e.preventDefault(); e.stopImmediatePropagation(); const t = $('#plc-in').value.trim(); if (!t) return $('#plc-in').focus(); $('#sedit-input').hidden = true; addLabelSticker('place', t, sty); };
};
// GIF dans l'éditeur
$('#sedit-gif').onclick = () => openGifPicker(g => {
  ed.stickers.push({ type: 'gif', url: g.full || g.url, ar: g.w / g.h, w: 0.42, x: 0.5, y: 0.45, rot: 0 });
  ed.sel = -1; renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); H(8);
}, { kind: 'stickers' });
// Rendu des nouveaux stickers (partout : éditeur, stories, publications)
const _stickerHTML20 = stickerHTML;
stickerHTML = function (k, i, opts = {}) {
  const pos = `left:${(k.x * 100).toFixed(2)}%;top:${(k.y * 100).toFixed(2)}%;transform:translate(-50%,-50%) rotate(${k.rot || 0}deg)`;
  if (k.type === 'gif') return `<div class="stk gif ${opts.edit ? 'drag' : ''}" data-stk="${i}" style="${pos};width:${(k.w * 100).toFixed(1)}%;aspect-ratio:${k.ar || 1}"><img src="${esc(k.url)}" alt="" draggable="false"></div>`;
  if (k.type === 'time' || k.type === 'place') return `<div class="stk lbl sty-${esc(k.style || 'box')} ${opts.edit ? 'drag' : ''}" data-stk="${i}" style="${pos}">${k.type === 'place' ? '📍 ' : ''}${esc(k.text)}</div>`;
  const h = _stickerHTML20(k, i, opts);
  return k.type === 'text' && k.style && k.style !== 'classic' ? h.replace('class="stk text', `class="stk text sty-${esc(k.style)}`) : h;
};

// ================================================================ Le bouton « Envoyer » : une seule feuille pour tout
const snd = { story: false, note: false, post: false, ids: new Set(), chans: new Set(), aud: null, paud: null, once: false };
$('#sedit-go').onclick = () => openSendSheet();
function openSendSheet() {
  Object.assign(snd, { story: false, note: false, post: window.sendPreset === 'post', ids: new Set(), chans: new Set(), aud: null, paud: null, once: false });
  window.sendPreset = null;
  openSheet(`<div class="snd" data-noswipe>
    <div class="snd-top">
      <button class="snd-dest" data-snd="story"><span class="sd-ic story">${C20.story}</span><b>Ta story</b><small class="sd-sub">Tous mes potes</small><i class="sd-chk">${C20.check}</i></button>
      <button class="snd-dest" data-snd="note"><span class="sd-ic note">${C20.note}</span><b>Ta note</b><small>24 h, en haut des Messages</small><i class="sd-chk">${C20.check}</i></button>
      <button class="snd-dest" data-snd="post"><span class="sd-ic post">${C20.grid}</span><b>Ton profil</b><small class="sd-psub">Publication</small><i class="sd-chk">${C20.check}</i></button>
    </div>
    <div class="snd-extra"></div>
    <div class="fsr-box snd-q"><span>${V9.search}</span><input id="snd-q" placeholder="Envoyer à…" autocomplete="off"></div>
    <div class="snd-people"></div>
    <div class="snd-foot"><button class="primary snd-go" disabled>Envoyer</button></div></div>`);
  $('#sheet').classList.add('sh-tall');
  renderSendPeople(); renderSendTop();
  $('#snd-q').oninput = renderSendPeople;
}
function renderSendTop() {
  const sh = $('#sheet .snd'); if (!sh) return;
  sh.querySelectorAll('[data-snd]').forEach(b => b.classList.toggle('on', !!snd[b.dataset.snd]));
  const g = snd.aud && fgroup(snd.aud), pg = snd.paud && fgroup(snd.paud);
  sh.querySelector('.sd-sub').textContent = g ? (g.id === 'close' ? '⭐ Amis proches' : g.name) : 'Tous mes potes';
  sh.querySelector('.sd-psub').textContent = pg ? '🔒 ' + pg.name : 'Publication';
  const ex = sh.querySelector('.snd-extra'), dm = snd.ids.size + snd.chans.size;
  ex.innerHTML = `${snd.story ? `<button class="snd-chip" data-snd-aud="story" style="--fc:${esc(g?.color || '#8E6CFF')}">${V9.people}<span>Story : ${esc(g ? (g.id === 'close' ? 'Amis proches' : g.name) : 'tous mes potes')}</span>${V9.down}</button>` : ''}
    ${snd.note ? `<input class="snd-in" id="snd-note" maxlength="80" placeholder="Texte de ta note (facultatif)" value="${esc(st.profile?.customStatus || '')}">` : ''}
    ${snd.post ? `<textarea class="snd-in" id="snd-cap" maxlength="1000" rows="2" placeholder="Écris une légende…">${esc($('#snd-cap')?.value || '')}</textarea>
      <div class="snd-row"><button class="snd-chip" data-snd-aud="post" style="--fc:${esc(pg?.color || '#8E6CFF')}">${V9.people}<span>Profil : ${esc(pg ? pg.name : 'tous mes potes')}</span>${V9.down}</button>
      <label class="snd-tog"><input type="checkbox" id="snd-com" checked><span>Commentaires</span></label><label class="snd-tog"><input type="checkbox" id="snd-hide"><span>Masquer les j'aime</span></label></div>` : ''}
    ${dm && ed.kind === 'image' ? `<label class="snd-tog once"><input type="checkbox" id="snd-once" ${snd.once ? 'checked' : ''}>${C20.once}<span>Vue unique pour les potes</span></label>` : ''}`;
  const n = (snd.story ? 1 : 0) + (snd.note ? 1 : 0) + (snd.post ? 1 : 0) + dm, go = sh.querySelector('.snd-go');
  const shared = snd.story || snd.note || snd.post;
  go.disabled = !n;
  go.textContent = !n ? 'Choisis où envoyer' : !dm ? 'Partager' : shared ? `Partager et envoyer (${dm})` : `Envoyer à ${dm} ${dm > 1 ? 'conversations' : 'conversation'}`;
}
function renderSendPeople() {
  const box = $('#sheet .snd-people'); if (!box) return;
  const q = ($('#snd-q')?.value || '').trim().toLowerCase(), has = s => !q || s.toLowerCase().includes(q);
  const friends = st.friends.map(user).filter(u => has(u.name))
    .sort((a, b) => isClose(b.id) - isClose(a.id) || (st.lastByChannel[st.dms.find(c => !c.group && c.members.includes(b.id))?.id] || '').localeCompare(st.lastByChannel[st.dms.find(c => !c.group && c.members.includes(a.id))?.id] || '') || a.name.localeCompare(b.name));
  const groups = st.dms.filter(c => c.group && has(groupName(c)));
  box.innerHTML = (friends.length ? `<div class="snd-grid">${friends.map(u => `<button class="snd-p ${snd.ids.has(u.id) ? 'on' : ''}" data-snd-u="${esc(u.id)}"><span class="snd-av">${avatarNU(u)}<i>${C20.check}</i></span><span>${esc(u.name)}</span></button>`).join('')}</div>` : '')
    + (groups.length ? `<h5>Groupes</h5><div class="snd-grid">${groups.map(c => `<button class="snd-p ${snd.chans.has(c.id) ? 'on' : ''}" data-snd-c="${esc(c.id)}"><span class="snd-av">${convAvatar(c)}<i>${C20.check}</i></span><span>${esc(groupName(c))}</span></button>`).join('')}</div>` : '')
    || `<p class="small pad">${q ? 'Personne avec ce nom.' : 'Ajoute des potes pour leur envoyer des photos.'}</p>`;
}
document.addEventListener('click', e => {
  const sh = e.target.closest('#sheet .snd'); if (!sh) return;
  const d = e.target.closest('[data-snd]');
  if (d) { const k = d.dataset.snd; snd[k] = !snd[k]; H(8); return renderSendTop(); }
  const a = e.target.closest('[data-snd-aud]');
  if (a) { const which = a.dataset.sndAud; return sndAudience(which); }
  const u = e.target.closest('[data-snd-u]'); if (u) { const id = u.dataset.sndU; snd.ids.has(id) ? snd.ids.delete(id) : snd.ids.add(id); u.classList.toggle('on'); H(6); return renderSendTop(); }
  const c = e.target.closest('[data-snd-c]'); if (c) { const id = c.dataset.sndC; snd.chans.has(id) ? snd.chans.delete(id) : snd.chans.add(id); c.classList.toggle('on'); H(6); return renderSendTop(); }
  if (e.target.closest('.snd-go')) return doSend();
});
document.addEventListener('change', e => { if (e.target.id === 'snd-once') snd.once = e.target.checked; });
function sndAudience(which) {
  const box = $('#sheet .snd-extra');
  const cur = which === 'story' ? snd.aud : snd.paud;
  const opts = [[null, 'Tous mes potes', '#8E6CFF'], ...fgroups().map(g => [g.id, g.id === 'close' ? '⭐ Amis proches' : g.name, g.color])];
  box.insertAdjacentHTML('afterbegin', `<div class="snd-audp" data-noswipe>${opts.map(([id, l, c]) => `<button class="snd-ap ${cur === id ? 'on' : ''}" data-ap="${id || ''}" style="--fc:${esc(c)}">${esc(l)}</button>`).join('')}</div>`);
  box.querySelector('.snd-audp').onclick = ev => {
    const b = ev.target.closest('[data-ap]'); if (!b) return; ev.stopPropagation();
    if (which === 'story') snd.aud = b.dataset.ap || null; else snd.paud = b.dataset.ap || null;
    H(6); renderSendTop();
  };
}
async function doSend() {
  const go = $('#sheet .snd-go'); if (!go || go.disabled) return;
  const cap = $('#snd-cap')?.value || '', noteText = $('#snd-note')?.value, com = $('#snd-com')?.checked !== false, hide = !!$('#snd-hide')?.checked;
  go.disabled = true; go.textContent = 'Envoi…';
  const done = [];
  try {
    const up = await edUpload();
    const ar = await mediaRatio();
    if (snd.story) { storyAud = null; await request('postStory', { fileId: up.id, stickers: edStickers(), audience: snd.aud || undefined }); done.push(snd.aud ? 'ta story (' + (fgroup(snd.aud)?.name || '') + ')' : 'ta story'); }
    if (snd.note) { await request('setNotePhoto', { fileId: up.id, text: noteText }); done.push('ta note'); }
    if (snd.post) { await request('createPost', { fileId: up.id, caption: cap, audience: snd.paud || undefined, allowComments: com, hideLikes: hide, stickers: edStickers().filter(k => k.type !== 'poll'), ar }); delete st.posts[st.me]; done.push('ton profil'); }
    const dms = [...snd.ids], chans = [...snd.chans];
    if (dms.length || chans.length) {
      const baked = ed.kind === 'image' && ed.stickers.length ? await bakeImage().catch(() => null) : null;
      const fid = baked ? (await upload(baked)).id : up.id;
      for (const uid of dms) { const r = await request('dmChannel', { userId: uid }); await request('send', { channelId: r.channel, content: '', attachments: [fid], once: snd.once && ed.kind === 'image' }); }
      for (const cid of chans) await request('send', { channelId: cid, content: '', attachments: [fid] });
      done.push([...dms.map(u => user(u).name), ...chans.map(c => groupName(chanById(c)))].join(', '));
    }
    closeSheet(); closeEditor(); H(16);
    toast(`Envoyé : ${done.join(' · ')} ✨`);
    if (snd.post && !$('#ptab').hidden) renderPTab();
  } catch (err) { toast(err.message, true); go.disabled = false; renderSendTop(); }
}
async function mediaRatio() {
  const m = $('#sedit-media img.s-main, #sedit-media video');
  if (!m) return null; const w = m.naturalWidth || m.videoWidth, h = m.naturalHeight || m.videoHeight;
  return w && h ? Math.round(w / h * 1000) / 1000 : null;
}
// Pour un pote : les textes et stickers sont « collés » dans la photo
async function bakeImage() {
  const stage = $('#sedit-stage'), r = stage.getBoundingClientRect(), img = $('#sedit-media img.s-main');
  if (!img || !r.width) return null;
  const k = 1080 / r.width, W = 1080, Hh = Math.round(r.height * k), c = document.createElement('canvas'); c.width = W; c.height = Hh;
  const g = c.getContext('2d');
  const fill = $('#sedit-media img.s-fill'); g.fillStyle = '#000'; g.fillRect(0, 0, W, Hh);
  if (fill) { g.filter = 'blur(30px) brightness(.7)'; const s = Math.max(W / fill.naturalWidth, Hh / fill.naturalHeight); g.drawImage(fill, (W - fill.naturalWidth * s) / 2, (Hh - fill.naturalHeight * s) / 2, fill.naturalWidth * s, fill.naturalHeight * s); g.filter = 'none'; }
  const ir = img.getBoundingClientRect(); g.drawImage(img, (ir.left - r.left) * k, (ir.top - r.top) * k, ir.width * k, ir.height * k);
  for (const el of $('#sedit-layer').querySelectorAll('[data-stk]')) {
    el.querySelector('.stk-del')?.remove();
    const er = el.getBoundingClientRect(), cs = getComputedStyle(el), x = (er.left - r.left) * k, y = (er.top - r.top) * k, w = er.width * k, h = er.height * k;
    const gi = el.querySelector('img'); if (gi) { try { g.drawImage(gi, x, y, w, h); } catch {} continue; }
    if (el.classList.contains('poll')) continue;
    g.save();
    const bg = cs.backgroundColor; if (bg && bg !== 'rgba(0, 0, 0, 0)') { g.fillStyle = bg; const rad = parseFloat(cs.borderRadius) * k || 0; g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, rad) : g.rect(x, y, w, h); g.fill(); }
    g.fillStyle = cs.color; g.font = `${cs.fontWeight} ${parseFloat(cs.fontSize) * k}px ${cs.fontFamily}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    if (cs.textShadow && cs.textShadow !== 'none') { g.shadowColor = cs.color; g.shadowBlur = 18; }
    const lines = el.innerText.split('\n'), lh = parseFloat(cs.fontSize) * k * 1.2;
    lines.forEach((ln, i) => g.fillText(ln, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * lh));
    g.restore();
  }
  const blob = await new Promise(res => c.toBlob(res, 'image/jpeg', 0.9));
  return new File([blob], 'photo.jpg', { type: 'image/jpeg' });
}

// ================================================================ GIF : la fenêtre de choix (GIPHY)
let gifState = { kind: 'gifs', q: '', cb: null, offset: 0, busy: false };
function openGifPicker(cb, opts = {}) {
  if (!st.profile?.giphy) {
    return openSheet(`<div class="gif-off">${C20.gif}<h3>Les GIF arrivent !</h3><p>${st.profile?.host ? 'Colle ta clé GIPHY dans Paramètres → Application pour activer les GIF pour tout le monde.' : 'Le propriétaire de Parlotte doit d\'abord activer les GIF.'}</p>
      ${st.profile?.host ? '<button class="primary" data-gif-set>Ouvrir les paramètres</button>' : ''}</div>`);
  }
  gifState = { kind: opts.kind || 'gifs', q: '', cb, offset: 0, busy: false };
  openSheet(`<div class="gifp"><div class="gifp-top"><div class="fsr-box"><span>${V9.search}</span><input id="gif-q" placeholder="Rechercher sur GIPHY" autocomplete="off" enterkeyhint="search"></div>
    <div class="gifp-tabs"><button data-gk="gifs">GIF</button><button data-gk="stickers">Stickers</button></div></div>
    <div class="gifp-grid" id="gif-grid"></div><p class="gifp-by">Propulsé par GIPHY</p></div>`);
  $('#sheet').classList.add('sh-tall');
  let t = null; $('#gif-q').oninput = () => { clearTimeout(t); t = setTimeout(() => { gifState.q = $('#gif-q').value.trim(); gifState.offset = 0; loadGifs(); }, 350); };
  $('#gif-grid').onscroll = () => { const g = $('#gif-grid'); if (g.scrollTop + g.clientHeight > g.scrollHeight - 300) loadGifs(true); };
  loadGifs();
}
async function loadGifs(more) {
  const grid = $('#gif-grid'); if (!grid || gifState.busy) return;
  $('#sheet').querySelectorAll('[data-gk]').forEach(b => b.classList.toggle('on', b.dataset.gk === gifState.kind));
  if (!more) { gifState.offset = 0; grid.innerHTML = '<i class="sk"></i>'.repeat(9); }
  gifState.busy = true;
  try {
    const r = await request('gifSearch', { q: gifState.q, kind: gifState.kind, offset: gifState.offset });
    if (!$('#gif-grid')) return;
    if (!more) grid.innerHTML = '';
    gifState.offset += r.results.length;
    grid.insertAdjacentHTML('beforeend', r.results.map(g => `<button class="gif-cell" data-gif='${esc(JSON.stringify(g))}' style="aspect-ratio:${g.w}/${g.h}"><img src="${esc(g.url)}" alt="${esc(g.title)}" loading="lazy"></button>`).join('')
      || (more ? '' : '<p class="small pad">Aucun GIF trouvé.</p>'));
  } catch (err) { if (!more) grid.innerHTML = `<p class="small pad">${esc(err.message)}</p>`; }
  gifState.busy = false;
}
document.addEventListener('click', e => {
  const k = e.target.closest('#sheet [data-gk]'); if (k) { gifState.kind = k.dataset.gk; return loadGifs(); }
  const g = e.target.closest('#sheet [data-gif]'); if (g) { const d = JSON.parse(g.dataset.gif); const cb = gifState.cb; closeSheet(); H(8); cb?.(d); }
  if (e.target.closest('[data-gif-set]')) { closeSheet(); setTab = 'app'; openSettings(); }
});
// GIF dans les messages : bouton dans la barre d'écriture
$('#emoji-btn').insertAdjacentHTML('beforebegin', `<button type="button" id="gif-btn" title="GIF" aria-label="Envoyer un GIF">${C20.gif}</button>`);
$('#gif-btn').onclick = () => { const cid = st.view.channel; if (!cid) return; openGifPicker(g => request('send', { channelId: cid, content: '', gif: { url: g.full || g.url, w: g.w, h: g.h }, replyTo }).then(() => setReply?.(null)).catch(err => toast(err.message, true))); };

// ================================================================ Paramètres → Application : clé GIPHY (propriétaire)
const _openSettings20 = openSettings;
openSettings = function () {
  _openSettings20();
  if (setTab !== 'app' || !st.profile?.host) return;
  const pane = $('#settings-body .set-pane'); if (!pane || pane.querySelector('#giphy-form')) return;
  pane.insertAdjacentHTML('afterbegin', `<h4>GIF (GIPHY)</h4><form id="giphy-form" class="giphy-form">
    <p class="small">${st.profile.giphy ? '✅ Les GIF sont activés pour tout le monde.' : 'Colle ta clé API GIPHY pour activer les GIF dans les messages et les stories.'} La clé reste sur ce serveur : les téléphones ne la voient jamais.</p>
    <div class="plc-row"><input id="giphy-key" type="password" autocomplete="off" placeholder="${st.profile.giphy ? 'Clé enregistrée (en coller une autre pour la changer)' : 'Clé API GIPHY'}"><button class="primary">Enregistrer</button></div>
    ${st.profile.giphy ? '<button type="button" class="link danger-link" id="giphy-off">Désactiver les GIF</button>' : ''}</form>`);
};
$('#settings-dlg').addEventListener('submit', async e => {
  if (e.target.id !== 'giphy-form') return; e.preventDefault();
  try { await request('setGiphyKey', { key: $('#giphy-key').value }); toast('GIF activés 🎉'); setTimeout(openSettings, 300); } catch (err) { toast(err.message, true); }
}, true);
$('#settings-dlg').addEventListener('click', async e => {
  if (!e.target.closest('#giphy-off')) return; e.stopImmediatePropagation();
  if (!confirm('Désactiver les GIF ?')) return;
  try { await request('setGiphyKey', { key: '' }); toast('GIF désactivés'); setTimeout(openSettings, 300); } catch (err) { toast(err.message, true); }
}, true);

// ================================================================ Notes en photo : la bulle montre la photo
const _renderPotes20 = renderPotesList;
renderPotesList = function (...a) {
  const r = _renderPotes20.apply(this, a);
  const put = (btn, u) => {
    const ph = u?.notePhoto; if (!btn || !ph) return;
    let n = btn.querySelector('.note'); if (!n) { btn.insertAdjacentHTML('afterbegin', '<span class="note"></span>'); n = btn.querySelector('.note'); }
    n.classList.remove('empty'); n.classList.add('has-ph');
    n.insertAdjacentHTML('afterbegin', `<span class="note-ph">${ph.kind === 'video' ? `<video src="${esc(ph.url)}#t=0.1" muted playsinline autoplay loop></video>` : `<img src="${esc(ph.url)}" alt="">`}</span>`);
    if (n.textContent.trim() === 'Ta note…') n.lastChild.textContent = '';
  };
  put($('#my-note'), user(st.me));
  document.querySelectorAll('.dispo[data-dm-user]').forEach(b => put(b, user(b.dataset.dmUser)));
  return r;
};
