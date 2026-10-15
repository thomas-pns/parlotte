'use strict';
// Parlotte — stories (24 h, visibles par tes potes) : appareil photo, création avec texte et sondage,
// visionneuse plein écran, « Vu par », cœurs et réponses qui arrivent en message privé.

const SI = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 24),
  flip: svg('<path d="M4 7h11a5 5 0 015 5v1M20 17H9a5 5 0 01-5-5v-1"/><path d="M17 4l3 3-3 3M7 20l-3-3 3-3"/>', 24),
  gallery: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 26),
  text: '<span class="aa" aria-hidden="true">Aa</span>',
  poll: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>', 22),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 20),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 20),
  send: svg('<path d="M21 3L3 10.5l7 3 3 7z"/><path d="M10 13.5L21 3"/>', 22),
  heart: svg('<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0112 6.6 5.2 5.2 0 0121.3 12C19 16.6 12 21 12 21z"/>', 26),
  heartFill: svg('<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0112 6.6 5.2 5.2 0 0121.3 12C19 16.6 12 21 12 21z" fill="currentColor"/>', 26),
  muted: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 9l5 6M22 9l-5 6"/>', 22),
  sound: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8.5a5 5 0 010 7M19.5 6a8.5 8.5 0 010 12"/>', 22),
  memories: svg('<rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><path d="M17.25 13.5v7.5M13.5 17.25H21"/>', 24),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M4 19h16"/>', 24),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>', 22),
  play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor"/>', 22),
  chevL: svg('<path d="M15 5l-7 7 7 7"/>', 28), chevR: svg('<path d="M9 5l7 7-7 7"/>', 28),
};
const IMG_MS = 6000, MAX_VIDEO_S = 15;

// ---------------------------------------------------------------- Données
const storyLive = x => new Date(x.expires) > new Date();
const storiesOf = uid => (st.stories || []).filter(x => x.author === uid && storyLive(x)).sort((a, b) => a.created.localeCompare(b.created));
const hasStory = uid => storiesOf(uid).length > 0;
const unseenStory = uid => storiesOf(uid).some(x => !x.seen);
function storyAuthors() { // ordre de la rangée : moi, puis non vues, puis vues
  const others = [...new Set((st.stories || []).filter(storyLive).map(x => x.author))].filter(u => u !== st.me && st.friends.includes(u));
  others.sort((a, b) => (unseenStory(b) - unseenStory(a)) || storiesOf(b).at(-1).created.localeCompare(storiesOf(a).at(-1).created));
  return hasStory(st.me) ? [st.me, ...others] : others;
}
function onStory(x) {
  st.stories = st.stories || [];
  const i = st.stories.findIndex(y => y.id === x.id);
  if (i >= 0) st.stories[i] = x; else st.stories.push(x);
  if (viewer.list.some(y => y.id === x.id)) { viewer.list = viewer.list.map(y => (y.id === x.id ? x : y)); if (viewer.list[viewer.i]?.id === x.id) renderViewerChrome(); }
  if (space() === 'potes') renderSide();
}
function onStoryRemoved(id) {
  st.stories = (st.stories || []).filter(x => x.id !== id);
  if (viewer.list[viewer.i]?.id === id) closeViewer();
  if (space() === 'potes') renderSide();
}

// ---------------------------------------------------------------- Rangée « dispo » : anneaux de story
const _renderPotesList = renderPotesList;
renderPotesList = function (head, list) {
  _renderPotesList(head, list);
  const row = list.querySelector('.dispo-row'), me = row?.querySelector('#my-note'); if (!row || !me) return;
  if (hasStory(st.me)) me.querySelector('.ring').className = 'ring ' + (storiesOf(st.me).length ? 'story mine' : 'none');
  me.insertAdjacentHTML('beforeend', `<span class="add-story" data-story-new role="button" aria-label="Ajouter une story">${ICON.plus}</span>`);
  const shown = new Set([...row.querySelectorAll('[data-dm-user]')].map(b => b.dataset.dmUser));
  for (const u of storyAuthors()) if (u !== st.me && !shown.has(u)) {
    row.querySelector('.dispo-empty')?.remove();
    const p = user(u);
    me.insertAdjacentHTML('afterend', `<button class="dispo" role="listitem" data-dm-user="${esc(u)}" title="${esc(p.name)}"><span class="ring none">${avatar(p, true)}</span><span class="dn">${esc(p.name)}</span></button>`);
  }
  const withStory = [];
  row.querySelectorAll('[data-dm-user]').forEach(b => {
    const u = b.dataset.dmUser; if (!hasStory(u)) return;
    b.dataset.storyUser = u; b.title = `Voir la story de ${user(u).name}`;
    const r = b.querySelector('.ring'); r.classList.remove('none', 'live'); r.classList.add(unseenStory(u) ? 'story' : 'seen');
    withStory.push(b);
  });
  withStory.sort((a, b) => unseenStory(b.dataset.storyUser) - unseenStory(a.dataset.storyUser));
  let anchor = me; for (const b of withStory) { anchor.after(b); anchor = b; }
};
// Barre de navigation : bouton « + » pour créer une story
const _renderNav = renderNav;
renderNav = function () {
  _renderNav();
  if (!$('#story-new')) $('#rail [data-space="servers"]').insertAdjacentHTML('afterend',
    `<button class="rail-btn create" id="story-new" title="Créer une story" aria-label="Créer une story">${ICON.plus}<b>Story</b></button>`);
};
renderNav();
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-story-new],#story-new')) { e.preventDefault(); e.stopPropagation(); return openCamera(); }
  const me = t.closest('#my-note');
  if (me && !t.closest('.note')) { e.preventDefault(); e.stopPropagation(); return hasStory(st.me) ? openStoryViewer(st.me) : openCamera(); }
  const su = t.closest('[data-story-user]');
  if (su) { e.preventDefault(); e.stopPropagation(); return openStoryViewer(su.dataset.storyUser); }
  const os = t.closest('[data-open-story]');
  if (os) { e.preventDefault(); e.stopPropagation(); const x = (st.stories || []).find(y => y.id === os.dataset.openStory); return x ? openStoryViewer(x.author, x.id) : toast('Cette story a expiré', true); }
}, true);

// Miniatures (réponse en message privé, activité)
function storyThumbHTML(x) {
  const live = (st.stories || []).find(y => y.id === (x.storyId || x.id));
  const media = x.kind === 'video' ? `<video src="${esc(x.url)}#t=0.5" muted playsinline preload="metadata"></video>` : `<img src="${esc(x.url)}" alt="" loading="lazy">`;
  return `<span class="sthumb ${live ? '' : 'gone'}" ${live ? `data-open-story="${esc(live.id)}"` : ''}>${media}</span>`;
}
function storyReplyHTML(m, mine) {
  return `<div class="sreply ${mine ? 'mine' : ''}"><small>${mine ? `Tu as répondu à sa story` : 'A répondu à ta story'}</small>${storyThumbHTML({ ...m.story, storyId: m.story.id })}</div>`;
}

// ---------------------------------------------------------------- Calques plein écran (créés une fois)
document.body.insertAdjacentHTML('beforeend', `
<div id="scam" class="sfull" hidden role="dialog" aria-label="Nouvelle story">
  <div class="sstage"><video id="scam-v" playsinline muted autoplay></video><p id="scam-msg" hidden></p><div id="scam-rec" hidden><i></i><span>0:00</span><em>Touche pour arrêter</em></div>
  <div class="s-top"><button class="s-ico" id="scam-close" aria-label="Fermer">${SI.close}</button><b>Nouvelle story</b><button class="s-ico" id="scam-flip" aria-label="Changer de caméra">${SI.flip}</button></div>
  <div class="s-bottom cam">
    <div class="cam-side"><label class="s-ico gal" title="Choisir une photo ou une vidéo du téléphone">${SI.gallery}<input type="file" id="scam-file" accept="image/*,video/*" hidden><span class="sr">Galerie</span></label>
    <button class="s-ico" id="scam-mem" title="Mes souvenirs" aria-label="Mes souvenirs">${SI.memories}</button></div>
    <button id="scam-shutter" aria-label="Appuie pour une photo, maintiens pour filmer"><svg class="sh-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="47"/></svg><i></i></button>
    <span class="s-hint">Appuie : photo<br>Maintiens : vidéo</span>
  </div></div>
</div>
<div id="sedit" class="sfull" hidden role="dialog" aria-label="Modifier la story">
  <div class="sstage" id="sedit-stage"><div id="sedit-media"></div><div class="stk-layer" id="sedit-layer"></div>
  <div class="s-top"><button class="s-ico" id="sedit-back" aria-label="Recommencer">${SI.close}</button><span class="grow"></span>
    <button class="s-ico" id="sedit-text" aria-label="Ajouter du texte">${SI.text}</button><button class="s-ico" id="sedit-poll" aria-label="Ajouter un sondage">${SI.poll}</button></div>
  <div class="s-bottom sedit-bar">
    <button class="s-act" id="sedit-save"><i>${SI.memories}</i><span>Souvenirs</span></button>
    <button class="s-act" id="sedit-dl"><i>${SI.download}</i><span>Enregistrer</span></button>
    <button class="s-act" id="sedit-send"><i>${SI.send}</i><span>Envoyer</span></button>
    <button class="primary s-share" id="sedit-share"><span>Ta story</span>${SI.chevR}</button></div></div>
  <div id="sedit-input" class="s-modal" hidden></div>
</div>
<div id="smem" class="sfull sheet-wrap" hidden role="dialog" aria-label="Mes souvenirs">
  <div class="msheet"><div class="msheet-head"><b>Souvenirs</b><span class="grow"></span><button class="s-ico" id="smem-close" aria-label="Fermer">${SI.close}</button></div>
  <div id="smem-grid" class="mgrid"></div></div>
</div>
<div id="sview" class="sfull" hidden role="dialog" aria-label="Story">
  <button class="s-nav prev" id="sview-prev" aria-label="Story précédente">${SI.chevL}</button>
  <div class="sstage" id="sview-stage"><div class="s-bars" id="sview-bars"></div><div id="sview-media"></div><div class="stk-layer" id="sview-layer"></div>
    <div class="s-head" id="sview-head"></div><div class="s-tap" id="sview-tap"></div><div class="s-foot" id="sview-foot"></div></div>
  <button class="s-nav next" id="sview-next" aria-label="Story suivante">${SI.chevR}</button>
  <div id="sview-viewers" class="s-modal" hidden></div>
</div>`);

// ---------------------------------------------------------------- Appareil photo
const cam = { stream: null, facing: 'user', rec: null, chunks: [], recTimer: null, holdTimer: null, recStart: 0 };
async function openCamera() {
  closeViewer();
  $('#scam').hidden = false; document.body.classList.add('story-open');
  $('#scam-msg').hidden = true;
  await startCamera();
}
async function startCamera() {
  stopCamera();
  const v = $('#scam-v');
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return camMsg('L\'appareil photo a besoin d\'une connexion sécurisée (https). Tu peux quand même choisir une photo dans ta galerie.');
  const video = { facingMode: cam.facing, width: { ideal: 1080 }, height: { ideal: 1920 } };
  try { cam.stream = await navigator.mediaDevices.getUserMedia({ video, audio: true }); }
  catch { try { cam.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false }); } catch (e) {
    return camMsg(e.name === 'NotAllowedError' ? 'Accès à la caméra refusé. Autorise-le, ou choisis une photo dans ta galerie.' : 'Pas de caméra trouvée. Choisis une photo ou une vidéo dans ta galerie.'); } }
  v.srcObject = cam.stream; v.classList.toggle('mirror', cam.facing === 'user'); v.play().catch(() => {});
  $('#scam-shutter').disabled = false;
}
function camMsg(text) { const m = $('#scam-msg'); m.textContent = text; m.hidden = false; $('#scam-shutter').disabled = true; }
function stopCamera() {
  if (cam.rec?.state === 'recording') { cam.rec.onstop = null; cam.rec.stop(); }
  cam.drawing = false; cancelAnimationFrame(cam.raf);
  clearInterval(cam.recTimer); $('#scam-rec').hidden = true; $('#scam-shutter').classList.remove('rec');
  cam.stream?.getTracks().forEach(t => t.stop()); cam.stream = null; $('#scam-v').srcObject = null;
}
function closeCamera() { stopCamera(); $('#scam').hidden = true; if ($('#sedit').hidden && $('#sview').hidden) document.body.classList.remove('story-open'); }
$('#scam-close').onclick = closeCamera;
$('#scam-flip').onclick = () => { cam.facing = cam.facing === 'user' ? 'environment' : 'user'; startCamera(); };
$('#scam-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (/^image\//.test(f.type)) return openEditor(await shrinkImage(f), 'image');
  if (/^video\//.test(f.type)) {
    if (f.size > 25 * 1024 * 1024) return toast('Vidéo trop lourde (25 Mo max)', true);
    return openEditor(f, 'video');
  }
  toast('Choisis une photo ou une vidéo', true);
};
const shutter = $('#scam-shutter');
// Sur téléphone, un appui long déclenche d'habitude le menu, la loupe ou la sélection de texte, et le
// navigateur « annule » le doigt (pointercancel) : la vidéo ne s'arrêtait jamais. On bloque tout ça,
// et si le doigt est quand même perdu, la vidéo continue et un simple appui l'arrête.
const recording = () => cam.rec?.state === 'recording';
shutter.addEventListener('pointerdown', e => {
  if (shutter.disabled || !cam.stream) return;
  e.preventDefault(); try { shutter.setPointerCapture(e.pointerId); } catch {}
  if (recording()) { cam.stopOnUp = true; return; } // appui pendant l'enregistrement = stop
  cam.stopOnUp = false; clearTimeout(cam.holdTimer);
  cam.holdTimer = setTimeout(startRecording, 350);
});
shutter.addEventListener('pointerup', e => {
  e.preventDefault();
  if (cam.holdTimer) { clearTimeout(cam.holdTimer); cam.holdTimer = null; if (!recording()) return takePhoto(); }
  if (recording() && (cam.stopOnUp || !cam.lost)) cam.rec.stop();
});
shutter.addEventListener('pointercancel', () => {
  if (cam.holdTimer) { clearTimeout(cam.holdTimer); cam.holdTimer = null; startRecording(); } // l'appui long a été « volé » : on filme quand même
  if (recording()) { cam.lost = true; $('#scam-rec').classList.add('tapstop'); }
});
shutter.addEventListener('contextmenu', e => e.preventDefault());
shutter.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
shutter.addEventListener('touchend', e => e.preventDefault(), { passive: false });
shutter.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); takePhoto(); } });
// Ce qui est enregistré = exactement ce que tu vois à l'écran : on recadre l'image de la caméra au format
// de l'écran (toujours en portrait), y compris pour la vidéo. Avant, un iPhone tenu droit pouvait donner
// une vidéo couchée.
function outSize(width) {
  const r = $('#scam .sstage').getBoundingClientRect(), a = Math.min(9 / 16, Math.max(9 / 21, (r.width || 9) / (r.height || 16)));
  return [width, Math.round(width / a / 2) * 2];
}
function drawCover(g, v, W, H, mirror) {
  const s = Math.max(W / v.videoWidth, H / v.videoHeight), dw = v.videoWidth * s, dh = v.videoHeight * s;
  g.save(); if (mirror) { g.translate(W, 0); g.scale(-1, 1); } g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh); g.restore();
}
async function takePhoto() {
  const v = $('#scam-v'); if (!v.videoWidth) return;
  const [W, H] = outSize(1080), c = document.createElement('canvas'); c.width = W; c.height = H;
  drawCover(c.getContext('2d'), v, W, H, cam.facing === 'user'); // comme dans un miroir, ce que tu voyais
  shutter.classList.add('flash'); setTimeout(() => shutter.classList.remove('flash'), 200);
  const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
  stopCamera(); $('#scam').hidden = true;
  openEditor(new File([blob], 'story.jpg', { type: 'image/jpeg' }), 'image');
}
function startRecording() {
  cam.holdTimer = null;
  if (!window.MediaRecorder) return toast('Ton navigateur ne sait pas filmer : prends une photo', true);
  // MP4 (H.264) d'abord : c'est ce que tous les téléphones savent lire.
  const type = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,opus', 'video/mp4;codecs=avc1', 'video/mp4',
    'video/webm;codecs=vp8,opus', 'video/webm'].find(t => MediaRecorder.isTypeSupported?.(t)) || '';
  const v = $('#scam-v'); let stream = cam.stream;
  const c = document.createElement('canvas');
  if (c.captureStream && v.videoWidth) {
    const [W, H] = outSize(720); c.width = W; c.height = H; const g = c.getContext('2d');
    cam.drawing = true;
    const draw = () => { if (!cam.drawing) return; drawCover(g, v, W, H, cam.facing === 'user'); cam.raf = requestAnimationFrame(draw); };
    draw();
    stream = c.captureStream(30); cam.stream.getAudioTracks().forEach(t => stream.addTrack(t));
  }
  try { cam.rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 2_500_000 } : {}); }
  catch { try { cam.rec = new MediaRecorder(stream); } catch { cam.drawing = false; return toast('Enregistrement vidéo impossible', true); } }
  cam.chunks = [];
  cam.rec.ondataavailable = e => e.data.size && cam.chunks.push(e.data);
  cam.rec.onstop = () => {
    cam.drawing = false; cancelAnimationFrame(cam.raf); clearInterval(cam.recTimer); $('#scam-rec').hidden = true; shutter.classList.remove('rec');
    const base = (cam.rec.mimeType || type || 'video/webm').split(';')[0];
    const file = new File(cam.chunks, base === 'video/mp4' ? 'story.mp4' : 'story.webm', { type: base });
    stopCamera(); $('#scam').hidden = true;
    if (file.size > 25 * 1024 * 1024) { toast('Vidéo trop lourde (25 Mo max)', true); return openCamera(); }
    openEditor(file, 'video');
  };
  cam.lost = false; $('#scam-rec').classList.remove('tapstop');
  cam.rec.start(250); cam.recStart = Date.now(); navigator.vibrate?.(15);
  shutter.classList.add('rec'); $('#scam-rec').hidden = false;
  cam.recTimer = setInterval(() => {
    const s = (Date.now() - cam.recStart) / 1000;
    $('#scam-rec span').textContent = `0:${String(Math.floor(s)).padStart(2, '0')}`;
    shutter.style.setProperty('--p', Math.min(1, s / MAX_VIDEO_S));
    if (s >= MAX_VIDEO_S && cam.rec.state === 'recording') cam.rec.stop();
  }, 200);
}
// Photos de la galerie : réduites à 1920 px (plus légères à envoyer)
async function shrinkImage(f) {
  if (f.type === 'image/gif') return f;
  try {
    const bmp = await createImageBitmap(f), k = Math.min(1, 1920 / Math.max(bmp.width, bmp.height));
    if (k === 1 && f.size < 3e6 && /jpeg|png|webp/.test(f.type)) return f;
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    return new File([blob], 'story.jpg', { type: 'image/jpeg' });
  } catch { return f; }
}

// ---------------------------------------------------------------- Création : texte, sondage, placement
const ed = { file: null, kind: null, url: null, stickers: [], sel: -1, up: null, memoryId: null, remote: null };
// Le fichier n'est envoyé qu'une fois, même si on l'enregistre ET qu'on le partage.
async function edUpload() { if (!ed.up) ed.up = await upload(ed.file); return ed.up; }
const edStickers = () => ed.stickers.map(({ answers, ...k }) => (k.type === 'poll' ? { ...k, answers: answers.map(a => a.text ?? a) } : k));
const TEXT_COLORS = ['#FFFFFF', '#14121A', '#FF6B4A', '#6FE3D2', '#F5C04A', '#8E6CFF', '#E05A8A'];
function openEditor(file, kind, opts = {}) {
  if (ed.url) URL.revokeObjectURL(ed.url);
  Object.assign(ed, { file, kind, stickers: (opts.stickers || []).map(k => (k.type === 'poll' ? { ...k, answers: k.answers.map(a => ({ text: a.text ?? a })) } : { ...k })),
    sel: -1, up: opts.up || null, memoryId: opts.memoryId || null, remote: opts.url || null });
  ed.url = file ? URL.createObjectURL(file) : null;
  const src = ed.url || opts.url;
  $('#sedit-save').classList.toggle('done', !!opts.memoryId);
  $('#sedit-save span').textContent = opts.memoryId ? 'Supprimer' : 'Souvenirs';
  $('#sedit-media').innerHTML = kind === 'video' ? `<video src="${esc(src)}" autoplay loop playsinline muted></video><button class="s-ico s-sound" data-ed-sound aria-label="Activer le son">${SI.muted}</button>` : `<img class="s-fill" src="${esc(src)}" alt="" aria-hidden="true"><img class="s-main" src="${esc(src)}" alt="">`;
  replay($('#sedit-stage'), 'opening');
  $('#sedit').hidden = false; document.body.classList.add('story-open');
  const v = $('#sedit-media video'); if (v) kickVideo(v);
  renderStickers($('#sedit-layer'), ed.stickers, { edit: true });
}
// iPhone : une vidéo ne démarre seule que si elle est déjà visible et vraiment muette ; sinon on
// réessaie quand elle est prête, et en dernier recours un gros bouton ▶ apparaît (un toucher suffit).
function kickVideo(v) {
  v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('webkit-playsinline', '');
  const go = () => v.play().catch(() => {});
  go(); v.addEventListener('loadeddata', go, { once: true }); v.addEventListener('canplay', go, { once: true });
  setTimeout(() => {
    if (!v.isConnected || !v.paused) return;
    const btn = document.createElement('button'); btn.className = 'v-kick'; btn.setAttribute('aria-label', 'Lire la vidéo'); btn.innerHTML = SI.play || '▶';
    v.parentElement.appendChild(btn);
    btn.onclick = e => { e.stopPropagation(); v.play().then(() => btn.remove(), () => {}); };
    v.addEventListener('playing', () => btn.remove(), { once: true });
  }, 900);
}
function closeEditor() {
  $('#sedit').hidden = true; $('#sedit-media').innerHTML = ''; $('#sedit-input').hidden = true;
  if (ed.url) { URL.revokeObjectURL(ed.url); ed.url = null; }
  if ($('#scam').hidden && $('#sview').hidden) document.body.classList.remove('story-open');
}
$('#sedit-back').onclick = () => { const fromMem = ed.memoryId; closeEditor(); openCamera().then(() => { if (fromMem) openMemories(); }); };
function stickerHTML(k, i, opts = {}) {
  const pos = `left:${(k.x * 100).toFixed(2)}%;top:${(k.y * 100).toFixed(2)}%;transform:translate(-50%,-50%) rotate(${k.rot || 0}deg)`;
  if (k.type === 'text') return `<div class="stk text ${opts.edit ? 'drag' : ''}" data-stk="${i}" style="${pos};color:${esc(k.color)};font-size:${k.size}px${k.bg ? `;background:${esc(k.bg)}` : ''}">${esc(k.text)}</div>`;
  const total = k.answers.reduce((a, b) => a + (b.count || 0), 0), voted = k.answers.some(a => a.mine);
  const showRes = !opts.edit && (voted || opts.mine);
  return `<div class="stk poll ${opts.edit ? 'drag' : ''}" data-stk="${i}" style="${pos}"><b>${esc(k.question)}</b>
    ${k.answers.map(a => { const pct = total ? Math.round((a.count || 0) / total * 100) : 0;
      return `<button class="pa ${a.mine ? 'mine' : ''} ${showRes ? 'res' : ''}" ${opts.edit || opts.mine ? 'tabindex="-1"' : `data-vote="${i}:${esc(a.id)}"`}>
        ${showRes ? `<i style="width:${pct}%"></i>` : ''}<span>${esc(a.text)}</span>${showRes ? `<em>${pct} %</em>` : ''}</button>`; }).join('')}
    ${showRes ? `<small>${total} vote${total > 1 ? 's' : ''}</small>` : ''}</div>`;
}
function renderStickers(layer, list, opts) {
  layer.innerHTML = list.map((k, i) => stickerHTML(k, i, opts)).join('');
  if (opts.edit && ed.sel >= 0) layer.querySelector(`[data-stk="${ed.sel}"]`)?.insertAdjacentHTML('beforeend', `<button class="stk-del" data-del-stk="${ed.sel}" aria-label="Retirer">${SI.trash}</button>`);
}
function editorModal(html) { const m = $('#sedit-input'); m.innerHTML = html; m.hidden = false; m.querySelector('input,textarea')?.focus(); }
$('#sedit-text').onclick = () => editorModal(`<form class="s-form" id="stx-form"><textarea id="stx-in" maxlength="80" rows="2" placeholder="Écris quelque chose…"></textarea>
  <div class="s-colors">${TEXT_COLORS.map((c, i) => `<button type="button" class="sw ${i ? '' : 'on'}" data-color="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}
  <label class="chk"><input type="checkbox" id="stx-bg"> Fond</label></div>
  <menu><button type="button" data-cancel>Annuler</button><button class="primary">Ajouter</button></menu></form>`);
$('#sedit-poll').onclick = () => editorModal(`<form class="s-form" id="spl-form"><input id="spl-q" maxlength="60" placeholder="Ta question (ex. Plage samedi ?)" required>
  <input class="spl-a" maxlength="30" value="Oui !" required><input class="spl-a" maxlength="30" value="Non" required>
  <input class="spl-a" maxlength="30" placeholder="Réponse 3 (facultatif)"><menu><button type="button" data-cancel>Annuler</button><button class="primary">Ajouter</button></menu></form>`);
$('#sedit-input').addEventListener('click', e => {
  if (e.target.closest('[data-cancel]') || e.target === $('#sedit-input')) $('#sedit-input').hidden = true;
  const sw = e.target.closest('[data-color]'); if (sw) { $('#sedit-input').querySelectorAll('.sw').forEach(b => b.classList.toggle('on', b === sw)); }
});
$('#sedit-input').addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'stx-form') {
    const text = $('#stx-in').value.trim(); if (!text) return;
    const color = $('#sedit-input .sw.on')?.dataset.color || '#FFFFFF', bg = $('#stx-bg').checked;
    ed.stickers.push({ type: 'text', text, color: bg ? (color === '#14121A' ? '#FFFFFF' : '#14121A') : color, bg: bg ? color : null, size: 30, x: 0.5, y: 0.4, rot: 0 });
  } else {
    const answers = [...document.querySelectorAll('.spl-a')].map(i => i.value.trim()).filter(Boolean);
    if (answers.length < 2) return toast('Il faut au moins 2 réponses', true);
    ed.stickers.push({ type: 'poll', question: $('#spl-q').value.trim(), answers: answers.map((text, i) => ({ id: String(i + 1), text })), x: 0.5, y: 0.6, rot: -2 });
  }
  $('#sedit-input').hidden = true; ed.sel = -1; renderStickers($('#sedit-layer'), ed.stickers, { edit: true });
  $('#sedit-layer').lastElementChild?.classList.add('new');
});
// Glisser-déposer des éléments (souris et doigt)
(() => {
  let drag = null;
  $('#sedit-layer').addEventListener('pointerdown', e => {
    const del = e.target.closest('[data-del-stk]');
    if (del) { ed.stickers.splice(Number(del.dataset.delStk), 1); ed.sel = -1; return renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); }
    const el = e.target.closest('[data-stk]'); if (!el) { ed.sel = -1; return renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); }
    const r = $('#sedit-stage').getBoundingClientRect(), i = Number(el.dataset.stk), k = ed.stickers[i];
    drag = { i, r, dx: e.clientX - (r.left + k.x * r.width), dy: e.clientY - (r.top + k.y * r.height), moved: false, el };
    el.setPointerCapture?.(e.pointerId); e.preventDefault();
  });
  $('#sedit-layer').addEventListener('pointermove', e => {
    if (!drag) return;
    const k = ed.stickers[drag.i];
    k.x = Math.min(0.95, Math.max(0.05, (e.clientX - drag.dx - drag.r.left) / drag.r.width));
    k.y = Math.min(0.95, Math.max(0.05, (e.clientY - drag.dy - drag.r.top) / drag.r.height));
    drag.el.style.left = k.x * 100 + '%'; drag.el.style.top = k.y * 100 + '%'; drag.moved = true;
  });
  $('#sedit-layer').addEventListener('pointerup', () => {
    if (!drag) return;
    if (!drag.moved) { ed.sel = ed.sel === drag.i ? -1 : drag.i; renderStickers($('#sedit-layer'), ed.stickers, { edit: true }); }
    drag = null;
  });
})();
$('#sedit-share').onclick = async () => {
  const b = $('#sedit-share'); if (b.disabled) return;
  b.disabled = true; b.textContent = 'Envoi…';
  try {
    const up = await edUpload();
    await request('postStory', { fileId: up.id, stickers: edStickers() });
    closeEditor(); toast('Story partagée avec tes potes ✨');
  } catch (e) { toast(e.message, true); }
  b.disabled = false; b.innerHTML = `<span>Ta story</span>${SI.chevR}`;
};

// ---------------------------------------------------------------- Visionneuse
const viewer = { uid: null, list: [], i: 0, timer: null, start: 0, elapsed: 0, paused: false, queue: [] };
function openStoryViewer(uid, storyId) {
  const list = storiesOf(uid); if (!list.length) return toast('Plus de story à voir', true);
  closeCamera(); if (!$('#sedit').hidden) closeEditor();
  viewer.queue = storyAuthors(); viewer.hl = null;
  viewer.uid = uid; viewer.list = list;
  const first = storyId ? list.findIndex(x => x.id === storyId) : list.findIndex(x => !x.seen);
  const sv = $('#sview'); clearTimeout(viewer.closing); sv.classList.remove('closing');
  if (sv.hidden) replay(sv, 'opening'); else replay($('#sview-stage'), 'swap-next');
  sv.hidden = false; document.body.classList.add('story-open');
  showStory(first >= 0 ? first : 0);
}
// Rejoue une animation CSS (même si elle vient de tourner)
function replay(el, cls) { el.classList.remove('opening', 'swap-next', 'swap-prev'); void el.offsetWidth; el.classList.add(cls); }
function closeViewerSoft() {
  const sv = $('#sview'); if (sv.hidden || sv.classList.contains('closing')) return;
  cancelAnimationFrame(viewer.raf); sv.classList.add('closing');
  viewer.closing = setTimeout(() => { sv.classList.remove('closing'); closeViewer(); }, 200);
}
function closeViewer() {
  clearTimeout(viewer.timer); cancelAnimationFrame(viewer.raf);
  const v = $('#sview-media video'); if (v) v.pause();
  $('#sview').hidden = true; $('#sview-media').innerHTML = ''; $('#sview-viewers').hidden = true;
  viewer.uid = null; viewer.list = [];
  if ($('#scam').hidden && $('#sedit').hidden) document.body.classList.remove('story-open');
}
function showStory(i) {
  clearTimeout(viewer.timer);
  const x = viewer.list[i]; if (!x) return closeViewer();
  viewer.i = i; viewer.elapsed = 0; viewer.paused = false; viewer.start = performance.now();
  $('#sview-media').innerHTML = x.kind === 'video' ? `<video src="${esc(x.url)}" autoplay playsinline></video>`
    : `<img class="s-fill" src="${esc(x.url)}" alt="" aria-hidden="true"><img class="s-main" src="${esc(x.url)}" alt="">`;
  $('#sview').style.setProperty('--sbg', x.kind === 'video' ? 'none' : `url("${x.url.replace(/"/g, '')}")`);
  $('#sview').classList.remove('paused');
  const v = $('#sview-media video');
  if (v) {
    v.muted = !!viewer.muted;
    v.onended = () => nextStory();
    v.onerror = () => { v.replaceWith(Object.assign(document.createElement('div'), { className: 's-bad', textContent: 'Cette vidéo ne se lit pas sur cet appareil 😕' })); viewer.start = performance.now(); viewer.elapsed = 0; };
    v.play().catch(() => { v.muted = true; viewer.autoMuted = true; renderSound(); v.play().catch(() => {}); });
  }
  renderViewerChrome(); renderSound();
  const lay = $('#sview-layer'); lay.classList.add('pop'); clearTimeout(viewer.popT); viewer.popT = setTimeout(() => lay.classList.remove('pop'), 900);
  if (!x.seen && x.author !== st.me) request('viewStory', { storyId: x.id }).catch(() => {});
  tick();
}
function renderSound() {
  const v = $('#sview-media video'), b = $('#sview-head [data-sound]'); if (!b) return;
  b.hidden = !v; if (v) { b.innerHTML = v.muted ? SI.muted : SI.sound; b.setAttribute('aria-label', v.muted ? 'Activer le son' : 'Couper le son'); }
}
function storyDuration() { const v = $('#sview-media video'); return v ? Math.min(MAX_VIDEO_S * 2, v.duration || MAX_VIDEO_S) * 1000 : IMG_MS; }
function tick() {
  cancelAnimationFrame(viewer.raf);
  const loop = now => {
    if (viewer.paused) { viewer.start = now - viewer.elapsed; }
    else {
      const v = $('#sview-media video');
      viewer.elapsed = v ? v.currentTime * 1000 : now - viewer.start;
      const p = Math.min(1, viewer.elapsed / storyDuration());
      const bar = $('#sview-bars').children[viewer.i]?.firstElementChild; if (bar) bar.style.width = p * 100 + '%';
      if (!v && p >= 1) return nextStory();
    }
    viewer.raf = requestAnimationFrame(loop);
  };
  viewer.raf = requestAnimationFrame(loop);
}
function setPaused(on) {
  viewer.paused = on; $('#sview').classList.toggle('paused', on); const v = $('#sview-media video');
  if (v) on ? v.pause() : v.play().catch(() => {});
}
function nextStory() {
  if (viewer.i < viewer.list.length - 1) return showStory(viewer.i + 1);
  if (viewer.hl) return closeViewerSoft();
  const q = viewer.queue, at = q.indexOf(viewer.uid), nxt = q.slice(at + 1).find(u => unseenStory(u)) || q[at + 1];
  if (nxt && nxt !== viewer.uid) return openStoryViewer(nxt);
  closeViewerSoft();
}
function prevStory() {
  if (viewer.i > 0) return showStory(viewer.i - 1);
  if (viewer.hl) return showStory(0);
  const q = viewer.queue, at = q.indexOf(viewer.uid);
  if (at > 0) { const u = q[at - 1]; viewer.uid = u; viewer.list = storiesOf(u); replay($('#sview-stage'), 'swap-prev'); return showStory(viewer.list.length - 1); }
  showStory(0);
}
function renderViewerChrome() {
  const x = viewer.list[viewer.i]; if (!x) return;
  const u = user(x.author), mine = x.author === st.me;
  $('#sview-bars').innerHTML = viewer.list.map((y, j) => `<span><i style="width:${j < viewer.i ? 100 : 0}%"></i></span>`).join('');
  if (x.hl) {
    $('#sview-head').innerHTML = `${avatar(u)}<b>${esc(viewer.hl.title)}</b><small>${esc(u.name)} · ${esc(new Date(x.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }))}</small><span class="grow"></span>
      <button class="s-ico" data-sound hidden aria-label="Son">${SI.sound}</button><button class="s-ico" data-close-story aria-label="Fermer">${SI.close}</button>`;
    renderStickers($('#sview-layer'), x.stickers || [], { mine: true });
    $('#sview-foot').innerHTML = mine ? `<button class="s-seen" data-hl-remove>${SI.trash}<span>Retirer de « ${esc(viewer.hl.title)} »</span></button>` : '';
    $('#sview-prev').disabled = viewer.i === 0;
    return;
  }
  $('#sview-head').innerHTML = `${avatar(u)}<b>${esc(mine ? 'Ta story' : u.name)}</b><small>${esc(ago(x.created))}</small><span class="grow"></span>
    <button class="s-ico" data-sound hidden aria-label="Son">${SI.sound}</button>${mine ? `<button class="s-ico" data-del-story aria-label="Supprimer cette story">${SI.trash}</button>` : ''}<button class="s-ico" data-close-story aria-label="Fermer">${SI.close}</button>`;
  renderStickers($('#sview-layer'), x.stickers || [], { mine });
  $('#sview-foot').innerHTML = mine
    ? `<button class="s-seen" data-viewers>${SI.eye}<span>${x.viewers?.length ? `Vu par ${x.viewers.length}` : 'Personne ne l\'a encore vue'}</span></button><span class="grow"></span><button class="s-seen" data-hl>${SI.star}<span>À la une</span></button>`
    : `<form class="s-reply" id="sview-reply"><input id="sview-in" maxlength="500" placeholder="Répondre à ${esc(u.name)}…" autocomplete="off" aria-label="Répondre"><button type="submit" class="s-ico" aria-label="Envoyer">${SI.send}</button></form>
       <button class="s-ico s-like ${x.liked ? 'on' : ''}" data-like-story aria-label="${x.liked ? 'Je n\'aime plus' : 'J\'aime'}">${x.liked ? SI.heartFill : SI.heart}</button>`;
  $('#sview-prev').disabled = viewer.i === 0 && viewer.queue.indexOf(viewer.uid) <= 0;
}
$('#sview').addEventListener('click', e => {
  const x = viewer.list[viewer.i]; if (!x) return;
  if (e.target.closest('[data-close-story]') || e.target === $('#sview')) return closeViewerSoft();
  if (e.target.closest('#sview-prev')) return prevStory();
  if (e.target.closest('#sview-next')) return nextStory();
  if (e.target.closest('[data-hl]')) { pickHighlight(x); return; }
  if (e.target.closest('[data-hl-remove]')) {
    return request('editHighlight', { highlightId: viewer.hl.id, removeItem: x.id }).then(() => {
      toast('Retirée de « ' + viewer.hl.title + ' »'); viewer.list.splice(viewer.i, 1); viewer.hl.items = viewer.list;
      viewer.list.length ? showStory(Math.min(viewer.i, viewer.list.length - 1)) : closeViewerSoft();
    }, err => toast(err.message, true));
  }
  const hp = e.target.closest('[data-hl-pick]');
  if (hp) {
    const title = hp.dataset.hlPick === 'new' ? ($('#hl-new')?.value.trim() || '') : '';
    if (hp.dataset.hlPick === 'new' && !title) { $('#hl-new')?.focus(); return; }
    return request('addHighlight', { storyId: x.id, highlightId: hp.dataset.hlPick === 'new' ? null : hp.dataset.hlPick, title }).then(r => {
      $('#sview-viewers').hidden = true; setPaused(false); toast(`Ajoutée à « ${r.title} » ⭐`);
    }, err => toast(err.message, true));
  }
  if (e.target.closest('[data-sound]')) { const v = $('#sview-media video'); if (v) { v.muted = !v.muted; viewer.muted = v.muted; if (!v.muted) v.play().catch(() => {}); renderSound(); } return; }
  if (e.target.closest('[data-like-story]')) { if (!x.liked) heartBurst(); return request('likeStory', { storyId: x.id }).catch(err => toast(err.message, true)); }
  const vt = e.target.closest('[data-vote]');
  if (vt) { const [k, a] = vt.dataset.vote.split(':'); return request('voteStory', { storyId: x.id, sticker: Number(k), answer: a }).catch(err => toast(err.message, true)); }
  if (e.target.closest('[data-del-story]')) {
    if (!confirm('Supprimer cette story ?')) return;
    return request('deleteStory', { storyId: x.id }).then(() => toast('Story supprimée'), err => toast(err.message, true));
  }
  if (e.target.closest('[data-viewers]')) {
    setPaused(true);
    const m = $('#sview-viewers');
    m.innerHTML = `<div class="s-form"><h3>Vu par ${x.viewers?.length || 0}</h3><div class="s-vlist">${(x.viewers || []).map(v => `<div class="s-vrow">${avatar(user(v.id))}<span>${esc(user(v.id).name)}</span><small>${esc(ago(v.at))}</small>${v.liked ? `<i class="s-vheart">${SI.heartFill}</i>` : ''}</div>`).join('') || '<p class="small">Personne pour l\'instant.</p>'}</div>
      <menu><button class="primary" data-close-viewers>Fermer</button></menu></div>`;
    m.hidden = false; return;
  }
  if (e.target.closest('[data-close-viewers]') || e.target === $('#sview-viewers')) { $('#sview-viewers').hidden = true; setPaused(false); }
});
// Zone de tap : gauche = précédente, droite = suivante, maintenir = pause
(() => {
  const tap = $('#sview-tap'); let down = 0, holdT = null, held = false;
  tap.addEventListener('pointerdown', () => { down = Date.now(); held = false; holdT = setTimeout(() => { held = true; setPaused(true); }, 220); });
  tap.addEventListener('pointerup', e => {
    clearTimeout(holdT);
    if (held) return setPaused(false);
    const r = tap.getBoundingClientRect();
    (e.clientX - r.left < r.width / 3) ? prevStory() : nextStory();
  });
  tap.addEventListener('pointerleave', () => { clearTimeout(holdT); if (held) { held = false; setPaused(false); } });
})();
$('#sview').addEventListener('focusin', e => { if (e.target.id === 'sview-in') setPaused(true); });
$('#sview').addEventListener('focusout', e => { if (e.target.id === 'sview-in') setPaused(false); });
$('#sview').addEventListener('submit', async e => {
  e.preventDefault();
  const x = viewer.list[viewer.i], inp = $('#sview-in'), text = inp?.value.trim(); if (!x || !text) return;
  try { await request('replyStory', { storyId: x.id, text }); inp.value = ''; inp.blur(); fly(); toast(`Réponse envoyée à ${user(x.author).name}`); }
  catch (err) { toast(err.message, true); }
});
document.addEventListener('keydown', e => {
  if ($('#sview').hidden || e.target.id === 'sview-in') {
    if (e.key === 'Escape' && !$('#scam').hidden) closeCamera();
    else if (e.key === 'Escape' && !$('#sedit').hidden && $('#sedit-input').hidden) closeEditor();
    return;
  }
  if (e.key === 'Escape') { e.preventDefault(); closeViewerSoft(); }
  if (e.key === 'ArrowRight') nextStory();
  if (e.key === 'ArrowLeft') prevStory();
});

// ---------------------------------------------------------------- Petites animations
function heartBurst() {
  const st0 = $('#sview-stage'), h = document.createElement('div'); h.className = 's-burst';
  h.innerHTML = SI.heartFill + Array.from({ length: 8 }, (_, k) => `<b style="--a:${k * 45}deg"></b>`).join('');
  st0.appendChild(h); setTimeout(() => h.remove(), 900); navigator.vibrate?.(10);
}
function fly() {
  const st0 = $('#sview-stage'), f = document.createElement('div'); f.className = 's-fly'; f.innerHTML = SI.send;
  st0.appendChild(f); setTimeout(() => f.remove(), 900);
}
$('#sview').addEventListener('animationend', e => { if (e.target.id === 'sview') e.target.classList.remove('opening'); });

$('#sedit').addEventListener('click', e => {
  if (!e.target.closest('[data-ed-sound]')) return;
  const v = $('#sedit-media video'), b = e.target.closest('[data-ed-sound]'); if (!v) return;
  v.muted = !v.muted; if (!v.muted) v.play().catch(() => {});
  b.innerHTML = v.muted ? SI.muted : SI.sound;
});

// ---------------------------------------------------------------- Souvenirs (comme sur Snapchat : tes photos gardées pour toi)
$('#sedit-save').onclick = async () => {
  const b = $('#sedit-save'); if (b.disabled) return; b.disabled = true;
  try {
    if (ed.memoryId) {
      if (!confirm('Supprimer ce souvenir ?')) return;
      const r = await request('deleteMemory', { memoryId: ed.memoryId }); st.memories = r.memories;
      toast('Souvenir supprimé'); closeEditor(); openCamera().then(openMemories); return;
    }
    const up = await edUpload(); const r = await request('saveMemory', { fileId: up.id, stickers: edStickers() });
    st.memories = r.memories; b.classList.add('done', 'pop'); setTimeout(() => b.classList.remove('pop'), 500);
    toast('Gardé dans tes Souvenirs 💾');
  } catch (e) { toast(e.message, true); } finally { b.disabled = false; }
};
$('#sedit-dl').onclick = () => {
  const a = document.createElement('a'); a.href = ed.url || ed.remote;
  a.download = `parlotte-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ed.kind === 'video' ? (/mp4|quicktime/.test(ed.file?.type || 'mp4') ? 'mp4' : 'webm') : 'jpg'}`;
  document.body.appendChild(a); a.click(); a.remove();
  toast('Enregistré sur ton appareil (ou ouvert : appuie longuement pour l\'enregistrer)');
};
// Envoyer à un ou plusieurs potes (photo ou vidéo dans la conversation privée)
$('#sedit-send').onclick = () => {
  const friends = st.friends.map(user).filter(Boolean).sort((a, b) => (b.status !== 'offline') - (a.status !== 'offline') || a.name.localeCompare(b.name));
  if (!friends.length) return toast('Ajoute des potes pour leur envoyer des photos', true);
  editorModal(`<form class="s-form" id="ssend-form"><h3>Envoyer à…</h3><div class="ssend-list">${friends.map(u => `<label class="ssend-row">${avatar(u)}<span>${esc(u.name)}</span><input type="checkbox" value="${esc(u.id)}"></label>`).join('')}</div>
    <menu><button type="button" data-cancel>Annuler</button><button class="primary" id="ssend-go" disabled>Envoyer</button></menu></form>`);
};
$('#sedit-input').addEventListener('change', e => { if (e.target.closest('#ssend-form')) $('#ssend-go').disabled = !$('#ssend-form').querySelector('input:checked'); });
$('#sedit-input').addEventListener('submit', async e => {
  if (e.target.id !== 'ssend-form') return;
  e.preventDefault(); e.stopImmediatePropagation();
  const ids = [...e.target.querySelectorAll('input:checked')].map(i => i.value), go = $('#ssend-go'); if (!ids.length) return;
  go.disabled = true; go.textContent = 'Envoi…';
  try {
    const up = await edUpload();
    for (const uid of ids) { const r = await request('dmChannel', { userId: uid }); await request('send', { channelId: r.channel, content: '', attachments: [up.id] }); }
    $('#sedit-input').hidden = true; closeEditor();
    toast(`Envoyé à ${ids.map(u => user(u).name).join(', ')} 📨`);
  } catch (err) { toast(err.message, true); go.disabled = false; go.textContent = 'Envoyer'; }
}, true);
function openMemories() {
  const list = st.memories || [];
  $('#smem-grid').innerHTML = list.length ? list.map(m => `<button class="mcell" data-mem="${esc(m.id)}">${m.kind === 'video'
    ? `<video src="${esc(m.url)}#t=0.1" muted playsinline preload="metadata"></video><i class="mplay">${SI.play}</i>` : `<img src="${esc(m.url)}" alt="" loading="lazy">`}
    <small>${esc(new Date(m.created).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}</small></button>`).join('')
    : `<div class="mempty">${SI.memories}<b>Pas encore de souvenirs</b><p>Prends une photo, puis touche « Souvenirs » pour la garder ici, rien que pour toi.</p></div>`;
  $('#smem').hidden = false; replay($('#smem .msheet'), 'opening');
}
$('#scam-mem').onclick = openMemories;
// Fermeture en douceur : la feuille redescend et le fond s'efface
function closeMemories() {
  const w = $('#smem'); if (w.hidden || w.classList.contains('closing')) return;
  w.classList.add('closing'); setTimeout(() => { w.hidden = true; w.classList.remove('closing'); }, 260);
}
$('#smem-close').onclick = closeMemories;
$('#smem').addEventListener('click', e => {
  if (e.target === $('#smem')) return closeMemories();
  const c = e.target.closest('[data-mem]'); if (!c) return;
  const m = (st.memories || []).find(x => x.id === c.dataset.mem); if (!m) return;
  $('#smem').hidden = true; stopCamera(); $('#scam').hidden = true;
  openEditor(null, m.kind, { url: m.url, up: { id: m.fileId, url: m.url }, stickers: m.stickers, memoryId: m.id });
});

// ---------------------------------------------------------------- À la une
async function pickHighlight(x) {
  setPaused(true);
  const m = $('#sview-viewers');
  m.innerHTML = `<div class="s-form"><h3>${SI.star} Mettre à la une</h3><p class="small">Elle restera sur ton profil, même après 24 h.</p><div class="hl-pick" id="hl-pick"><p class="small">Chargement…</p></div>
    <div class="hl-newrow"><input id="hl-new" maxlength="24" placeholder="Nouvelle : Vacances, Soirées…"><button class="primary" data-hl-pick="new">Créer</button></div>
    <menu><button data-close-viewers>Annuler</button></menu></div>`;
  m.hidden = false;
  try {
    const r = await request('getProfile', { userId: st.me });
    $('#hl-pick').innerHTML = r.highlights.length ? r.highlights.map(h => `<button class="hl-chip" data-hl-pick="${esc(h.id)}">${hlCoverHTML(h)}<span>${esc(h.title)}</span></button>`).join('')
      : '<p class="small">Crée ta première « À la une » :</p>';
  } catch { $('#hl-pick').innerHTML = ''; }
}
function hlCoverHTML(h) {
  return `<i class="hl-cover">${h.coverKind === 'video' ? `<video src="${esc(h.cover)}#t=0.1" muted playsinline preload="metadata"></video>` : h.cover ? `<img src="${esc(h.cover)}" alt="" loading="lazy">` : ''}</i>`;
}
function openHighlight(uid, h, start = 0) {
  if (!h?.items?.length) return toast('Cette « À la une » est vide', true);
  closeCamera(); if (!$('#sedit').hidden) closeEditor();
  viewer.hl = h; viewer.uid = uid; viewer.queue = [];
  viewer.list = h.items.map(i => ({ ...i, author: uid, hl: h.id, seen: true }));
  const sv = $('#sview'); clearTimeout(viewer.closing); sv.classList.remove('closing');
  if (sv.hidden) replay(sv, 'opening');
  sv.hidden = false; document.body.classList.add('story-open');
  showStory(start);
}
