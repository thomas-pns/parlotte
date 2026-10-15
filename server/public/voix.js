'use strict';
// Parlotte — vocal+ : réglages du micro, porte de bruit / appuyer pour parler,
// volume par personne et soundboard. Se branche sur le vocal de app.js (vc, meters, audioCtx…).

const vp = () => (prefs.voice = prefs.voice || {});
const saveVoice = () => savePrefs();
function actx() {
  audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume?.();
  const want = vp().output || '';
  if (audioCtx.setSinkId && audioCtx._sink !== want) { audioCtx._sink = want; audioCtx.setSinkId(want).catch(() => { audioCtx._sink = null; }); }
  return audioCtx;
}

// ---------------------------------------------------------------- Micro
function getMic() {
  const v = vp();
  const audio = { echoCancellation: v.echo !== false, noiseSuppression: v.noise !== false, autoGainControl: v.agc !== false };
  if (v.input) audio.deviceId = { ideal: v.input };
  return navigator.mediaDevices.getUserMedia({ audio, video: false });
}
// Ce qu'on envoie passe par un « robinet » (gain) : ouvert quand on parle assez fort,
// ou seulement quand on tient la touche en mode « appuyer pour parler ».
const gate = { src: null, gain: null, dest: null, open: true, lastLoud: 0, ptt: false, level: 0 };
function makeSendStream(raw) {
  try {
    const c = actx();
    gate.gain = c.createGain(); gate.gain.gain.value = 0;
    gate.dest = c.createMediaStreamDestination();
    gate.src = c.createMediaStreamSource(raw);
    gate.src.connect(gate.gain).connect(gate.dest);
    gate.lastLoud = 0; gate.ptt = false; setGate();
    return gate.dest.stream;
  } catch (e) { console.warn('porte', e); return raw; }
}
function stopSendStream() {
  try { gate.src?.disconnect(); gate.gain?.disconnect(); } catch {}
  gate.dest?.stream.getTracks().forEach(t => t.stop());
  gate.src = gate.gain = gate.dest = null;
}
// Changement de micro ou de traitement pendant un appel : pas besoin de renégocier,
// on rebranche juste la nouvelle source sur le robinet.
async function restartMic() {
  if (!vc.stream) return;
  let fresh;
  try { fresh = await getMic(); } catch { return toast('Impossible d\'ouvrir ce micro', true); }
  vc.stream.getTracks().forEach(t => t.stop());
  vc.stream = fresh;
  if (gate.gain) { try { gate.src.disconnect(); } catch {} gate.src = actx().createMediaStreamSource(fresh); gate.src.connect(gate.gain); }
  watchSpeaking(st.me, fresh); applyMute();
}
const pttMode = () => vp().mode === 'ptt';
function micOpen() { return pttMode() ? gate.ptt : gate.open; }
function setGate() {
  if (!gate.gain) return;
  const c = actx();
  gate.gain.gain.setTargetAtTime(micOpen() ? 1 : 0, c.currentTime, micOpen() ? 0.005 : 0.05);
}
// Boucle rapide (30 ms) pour ouvrir le robinet sans couper le début des mots.
setInterval(() => {
  const m = meters.get(st.me); if (!m || !gate.gain) return;
  m.analyser.getByteTimeDomainData(m.data);
  let sum = 0; for (const v of m.data) sum += (v - 128) ** 2;
  const level = Math.sqrt(sum / m.data.length);
  gate.level = level;
  if (level > (vp().threshold ?? 4)) gate.lastLoud = Date.now();
  const open = Date.now() - gate.lastLoud < 350;
  if (open !== gate.open) { gate.open = open; setGate(); }
}, 30);
function micLevel(level) {
  const bar = $('#v-vu'); if (!bar) return;
  bar.style.width = Math.min(100, level / 30 * 100) + '%';
  bar.classList.toggle('open', micOpen());
}

// Appuyer pour parler (quand la fenêtre Parlotte est active)
const keyLabel = code => !code ? '—' : code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Pavé ')
  .replace('Space', 'Espace').replace('ControlLeft', 'Ctrl gauche').replace('ControlRight', 'Ctrl droit').replace('ShiftLeft', 'Maj gauche')
  .replace('ShiftRight', 'Maj droit').replace('AltLeft', 'Alt').replace('AltRight', 'Alt Gr').replace('CapsLock', 'Verr. Maj').replace('Backquote', '²');
let capturingKey = false;
const typingField = t => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
window.addEventListener('keydown', e => {
  if (capturingKey) {
    e.preventDefault(); e.stopPropagation(); capturingKey = false;
    if (e.code !== 'Escape') { vp().pttKey = e.code; saveVoice(); }
    if ($('#v-ptt-key')) $('#v-ptt-key').textContent = keyLabel(vp().pttKey || 'KeyV');
    return;
  }
  if (!vc.channel || !pttMode() || e.code !== (vp().pttKey || 'KeyV') || e.repeat) return;
  if (typingField(e.target) && e.key.length === 1) return; // on écrit un message : on laisse la lettre
  gate.ptt = true; setGate(); renderSpeakingSelf();
}, true);
window.addEventListener('keyup', e => {
  if (!pttMode() || e.code !== (vp().pttKey || 'KeyV') || !gate.ptt) return;
  gate.ptt = false; setGate(); renderSpeakingSelf();
}, true);
window.addEventListener('blur', () => { if (gate.ptt) { gate.ptt = false; setGate(); } });
function renderSpeakingSelf() { document.querySelectorAll(`[data-speaker="${CSS.escape(st.me || '')}"]`).forEach(el => el.classList.toggle('ptt', gate.ptt)); }

// ---------------------------------------------------------------- Volume par personne
const volFor = uid => (vp().lmute?.[uid] ? 0 : vp().vol?.[uid] ?? 1);
function routePeerAudio(uid, peer, stream) {
  // Le son passe par un gain (jusqu'à 200 %). L'élément <audio> reste branché mais muet :
  // Chrome ne fait couler un flux WebRTC dans WebAudio que s'il est aussi lu par un élément.
  try {
    const c = actx();
    try { peer.src?.disconnect(); } catch {}
    peer.src = c.createMediaStreamSource(stream);
    peer.gain = peer.gain || c.createGain();
    peer.src.connect(peer.gain); peer.gain.connect(c.destination);
    peer.audio.muted = true;
  } catch (e) { console.warn('volume', e); peer.gain = null; }
  updatePeerVolumes();
}
function updatePeerVolumes() {
  vc.peers.forEach((p, uid) => {
    const v = vc.deafened ? 0 : volFor(uid);
    if (p.gain) { p.gain.gain.value = v; p.audio.muted = true; }
    else { p.audio.muted = v === 0; p.audio.volume = Math.min(1, v); }
  });
}
function userVolumeHTML(u) {
  if (!vc.channel || u.id === st.me || !(st.voice[vc.channel] || []).some(m => m.id === u.id)) return '';
  const pct = Math.round((vp().vol?.[u.id] ?? 1) * 100), muted = !!vp().lmute?.[u.id];
  return `<div class="uvol"><label>🔊 Volume <b id="uvol-val">${pct} %</b><input type="range" min="0" max="200" step="5" value="${pct}" data-uvol="${esc(u.id)}"></label>
    <label class="chk"><input type="checkbox" data-lmute="${esc(u.id)}" ${muted ? 'checked' : ''}> Rendre muet pour moi</label></div>`;
}
$('#card').addEventListener('input', e => {
  const r = e.target.closest('[data-uvol]'); if (!r) return;
  const v = vp(); v.vol = v.vol || {}; v.vol[r.dataset.uvol] = Number(r.value) / 100;
  $('#uvol-val').textContent = r.value + ' %'; saveVoice(); updatePeerVolumes();
});
$('#card').addEventListener('change', e => {
  const c = e.target.closest('[data-lmute]'); if (!c) return;
  const v = vp(); v.lmute = v.lmute || {};
  if (c.checked) v.lmute[c.dataset.lmute] = true; else delete v.lmute[c.dataset.lmute];
  saveVoice(); updatePeerVolumes();
});

// ---------------------------------------------------------------- Soundboard
const BUILTIN = [
  ['airhorn', '📯', 'Klaxon'], ['rimshot', '🥁', 'Ba-dum-tss'], ['applause', '👏', 'Bravo !'], ['ding', '🔔', 'Ding'],
  ['sadtrombone', '🎺', 'Trombone triste'], ['drumroll', '🪘', 'Roulement'], ['tada', '🎉', 'Tadaa'], ['pop', '🫧', 'Pop'],
];
const builtinLabel = id => BUILTIN.find(b => b[0] === id) || [id, '🎵', id];
// Sons synthétisés (aucun fichier) : petites recettes d'oscillateurs et de bruit.
function noiseBuf(c, secs) {
  const b = c.createBuffer(1, Math.ceil(c.sampleRate * secs), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
function env(c, out, t, a, peak, d) { const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); g.connect(out); return g; }
function osc(c, out, t, f, dur, type = 'sine', vol = 0.3, f2) {
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  o.connect(env(c, out, t, 0.01, vol, dur)); o.start(t); o.stop(t + dur + 0.05); return o;
}
function hit(c, out, t, { dur = 0.15, vol = 0.5, hp = 1000, lp = 12000 } = {}) {
  const s = c.createBufferSource(); s.buffer = noiseBuf(c, dur + 0.05);
  const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.value = lp;
  s.connect(h).connect(l).connect(env(c, out, t, 0.002, vol, dur)); s.start(t); s.stop(t + dur + 0.05);
}
const SYNTH = {
  airhorn(c, out, t) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2800; lp.connect(out);
    [[0, 0.22], [0.28, 0.22], [0.56, 0.75]].forEach(([d, len]) => [440, 554, 659].forEach(f => osc(c, lp, t + d, f, len, 'sawtooth', 0.12)));
  },
  rimshot(c, out, t) {
    hit(c, out, t, { dur: 0.12, hp: 900 }); osc(c, out, t, 190, 0.1, 'triangle', 0.4);
    hit(c, out, t + 0.16, { dur: 0.12, hp: 900 }); osc(c, out, t + 0.16, 170, 0.1, 'triangle', 0.4);
    hit(c, out, t + 0.38, { dur: 1.3, hp: 6000, vol: 0.35 });
  },
  applause(c, out, t) {
    for (let i = 0; i < 70; i++) hit(c, out, t + Math.random() * 2, { dur: 0.04 + Math.random() * 0.03, hp: 900 + Math.random() * 900, lp: 4000, vol: 0.12 + Math.random() * 0.15 });
  },
  ding(c, out, t) { osc(c, out, t, 1318, 1.6, 'sine', 0.35); osc(c, out, t, 2637, 0.9, 'sine', 0.12); },
  sadtrombone(c, out, t) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1200; lp.connect(out);
    [[392, 0], [370, 0.45], [349, 0.9]].forEach(([f, d]) => osc(c, lp, t + d, f, 0.4, 'sawtooth', 0.2));
    const o = osc(c, lp, t + 1.35, 330, 1.3, 'sawtooth', 0.2);
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 6; lg.gain.value = 9;
    lfo.connect(lg).connect(o.frequency); lfo.start(t + 1.35); lfo.stop(t + 2.7);
  },
  drumroll(c, out, t) {
    for (let i = 0; i < 40; i++) hit(c, out, t + i * 0.04, { dur: 0.05, hp: 1200, lp: 7000, vol: 0.08 + i / 40 * 0.3 });
    hit(c, out, t + 1.65, { dur: 1.4, hp: 5000, vol: 0.4 }); osc(c, out, t + 1.65, 90, 0.3, 'sine', 0.5);
  },
  tada(c, out, t) {
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; lp.connect(out);
    osc(c, lp, t, 523, 0.12, 'sawtooth', 0.15);
    [523, 659, 784, 1046].forEach(f => osc(c, lp, t + 0.16, f, 0.9, 'sawtooth', 0.09));
  },
  pop(c, out, t) { osc(c, out, t, 900, 0.09, 'sine', 0.5, 180); },
};
const bufCache = new Map();
const loadBuffer = url => {
  if (!bufCache.has(url)) bufCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error('son introuvable'); return r.arrayBuffer(); }).then(b => actx().decodeAudioData(b)));
  return bufCache.get(url);
};
async function playSoundLocal(sound, volume) {
  const c = actx(), out = c.createGain(); out.gain.value = volume; out.connect(c.destination);
  setTimeout(() => { try { out.disconnect(); } catch {} }, 7000);
  if (sound.builtin) return SYNTH[sound.id]?.(c, out, c.currentTime + 0.02);
  const src = c.createBufferSource(); src.buffer = await loadBuffer(sound.url); src.connect(out);
  src.start(); src.stop(c.currentTime + 6); // 6 s maximum, même si le fichier est plus long
}
const sbVolume = () => vp().sbVolume ?? 0.6;
function onSound(m) {
  if (m.channelId !== vc.channel || vc.deafened || volFor(m.userId) === 0) return;
  playSoundLocal(m.sound, sbVolume() * (m.sound.volume ?? 1)).catch(e => console.warn('soundboard', e));
  const label = m.sound.builtin ? builtinLabel(m.sound.id).slice(1).join(' ') : `${m.sound.emoji || '🎵'} ${m.sound.name}`;
  const s = $('#vp-status');
  if (s) { s.textContent = `${user(m.userId).name} : ${label}`; s.className = 'ok'; clearTimeout(onSound.t); onSound.t = setTimeout(renderVoicePanel, 2500); }
  const els = document.querySelectorAll(`[data-speaker="${CSS.escape(m.userId)}"]`);
  els.forEach(el => el.classList.add('sb')); setTimeout(() => els.forEach(el => el.classList.remove('sb')), 1200);
}
function availableSounds() {
  const c = chanById(vc.channel); if (!c) return [];
  const servers = c.type === 'dm' ? st.servers : st.servers.filter(s => s.id === c.server_id);
  return servers.flatMap(s => (s.sounds || []).map(x => ({ ...x, server: s.name })));
}
function toggleSoundboard(anchor) {
  const box = $('#sb');
  if (!box.hidden) { box.hidden = true; return; }
  const own = availableSounds(), dm = chanById(vc.channel)?.type === 'dm';
  box.innerHTML = `<header><b>🎵 Soundboard</b><label title="Volume des sons que tu entends">🔉<input type="range" id="sb-vol" min="0" max="100" value="${Math.round(sbVolume() * 100)}"></label></header>
    <div class="sb-grid">${BUILTIN.map(([id, e, l]) => `<button data-sound="${id}" title="${esc(l)}"><i>${e}</i>${esc(l)}</button>`).join('')}
    ${own.map(x => `<button data-sound="${esc(x.id)}" class="custom" title="${esc(x.name)}${dm ? ' — ' + esc(x.server) : ''}"><i>${esc(x.emoji || '🎵')}</i>${esc(x.name)}</button>`).join('')}</div>
    <p class="small">${own.length ? '' : 'Ajoute tes propres sons dans Paramètres du serveur → Sons. '}Tout le salon vocal entend le son.</p>`;
  const r = anchor.getBoundingClientRect();
  box.style.left = Math.max(8, Math.min(r.left, innerWidth - 340)) + 'px';
  box.style.bottom = (innerHeight - r.top + 8) + 'px';
  box.hidden = false;
}
$('#sb').addEventListener('click', e => {
  const b = e.target.closest('[data-sound]'); if (!b) return;
  b.classList.add('fired'); setTimeout(() => b.classList.remove('fired'), 300);
  request('playSound', { soundId: b.dataset.sound }).catch(err => toast(err.message, true));
});
$('#sb').addEventListener('input', e => { if (e.target.id === 'sb-vol') { vp().sbVolume = Number(e.target.value) / 100; saveVoice(); } });
document.addEventListener('click', e => { if (!e.target.closest('#sb,#vp-sb')) $('#sb').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#sb').hidden = true; });

// Onglet « Sons » des paramètres du serveur
function soundsTabHTML(s) {
  const manage = sp(s, P.MANAGE_EMOJIS), list = s.sounds || [];
  return `<h3>Sons — ${list.length}/24</h3><p class="small">Ils apparaissent dans la soundboard 🎵 du vocal de ce serveur, en plus des sons intégrés.</p>
    ${manage ? `<div class="snd-add"><input type="file" id="snd-file" accept="audio/*"><input id="snd-emoji" placeholder="😀" maxlength="8" class="emo-in">
      <input id="snd-name" placeholder="nom (ex : GG)" maxlength="24"><label class="small">Volume <input type="range" id="snd-vol" min="5" max="100" value="100"></label>
      <button class="primary" id="snd-add">Ajouter</button></div><p class="small">5 secondes et 1 Mo maximum (mp3, ogg, wav…).</p>`
      : '<p class="small">Il faut la permission « Gérer les emojis et les sons » pour en ajouter.</p>'}
    <div class="snd-list"><h4>Intégrés</h4>${BUILTIN.map(([id, e, l]) => `<div class="snd"><button data-presound="${id}" title="Écouter">▶</button><i>${e}</i><b>${esc(l)}</b></div>`).join('')}
    ${list.length ? '<h4>De ce serveur</h4>' : ''}${list.map(x => `<div class="snd"><button data-presound="${esc(x.id)}" title="Écouter">▶</button><i>${esc(x.emoji || '🎵')}</i><b>${esc(x.name)}</b>
      <small>par ${esc(user(x.by).name)}</small>${manage ? `<button class="danger-btn" data-delsound="${esc(x.id)}">Supprimer</button>` : ''}</div>`).join('')}</div>`;
}
function audioDuration(file) {
  return file.arrayBuffer().then(b => actx().decodeAudioData(b)).then(buf => buf.duration);
}
$('#srv-dlg').addEventListener('click', async e => {
  const s = server(); if (!s) return;
  const pre = e.target.closest('[data-presound]');
  if (pre) {
    const id = pre.dataset.presound, x = (s.sounds || []).find(y => y.id === id);
    return playSoundLocal(x ? { ...x } : { id, builtin: true }, sbVolume() * (x?.volume ?? 1)).catch(err => toast(err.message, true));
  }
  const del = e.target.closest('[data-delsound]');
  if (del && confirm('Supprimer ce son ?')) return act('deleteSound', { serverId: s.id, soundId: del.dataset.delsound });
  if (!e.target.closest('#snd-add')) return;
  const f = $('#snd-file').files[0];
  if (!f) return toast('Choisis un fichier audio', true);
  if (f.size > 1024 * 1024) return toast('Son trop lourd (1 Mo max)', true);
  try {
    const d = await audioDuration(f);
    if (d > 5.2) return toast(`Son trop long (${d.toFixed(1)} s) : 5 secondes maximum`, true);
  } catch { return toast('Ce fichier audio est illisible', true); }
  try {
    const up = await upload(f);
    await request('addSound', { serverId: s.id, name: $('#snd-name').value.trim() || f.name.replace(/\.\w+$/, '').slice(0, 24), emoji: $('#snd-emoji').value.trim(),
      fileId: up.id, volume: Number($('#snd-vol').value) / 100 });
    toast('Son ajouté');
  } catch (err) { toast(err.message, true); }
});

// ---------------------------------------------------------------- Paramètres « Voix »
function voiceSettingsHTML() {
  const v = vp(), ptt = pttMode(), canSink = !!(window.AudioContext && AudioContext.prototype.setSinkId);
  setTimeout(fillDevices, 0);
  return `<h4>Voix</h4>
    <label class="fld">Micro <select id="v-input"><option value="">Par défaut</option></select></label>
    ${canSink ? '<label class="fld">Sortie (haut-parleurs / casque) <select id="v-output"><option value="">Par défaut</option></select></label>' : ''}
    <div class="seg" role="radiogroup"><button data-vmode="vad" class="${ptt ? '' : 'on'}">🎙️ Détection de la voix</button><button data-vmode="ptt" class="${ptt ? 'on' : ''}">⌨️ Appuyer pour parler</button></div>
    ${ptt ? `<div class="row"><span>Touche : <kbd id="v-ptt-key">${esc(keyLabel(v.pttKey || 'KeyV'))}</kbd></span><button id="v-ptt-set">Changer la touche</button></div>
      <p class="small">Maintiens la touche pour parler (quand la fenêtre Parlotte est active).</p>`
    : `<label class="fld">Sensibilité du micro <input type="range" id="v-thr" min="0" max="30" step="1" value="${v.threshold ?? 4}">
      <div class="vu"><i id="v-vu"></i><b id="v-thr-mark" style="left:${(v.threshold ?? 4) / 30 * 100}%"></b></div></label>
      <p class="small">${vc.channel ? 'La barre bouge quand tu parles : ton micro ne s\'ouvre qu\'au-delà du trait blanc.' : 'Rejoins un salon vocal pour voir ton niveau en direct.'}</p>`}
    <label class="chk"><input type="checkbox" id="v-noise" ${v.noise === false ? '' : 'checked'}> Suppression du bruit (clavier, ventilateur…)</label>
    <label class="chk"><input type="checkbox" id="v-echo" ${v.echo === false ? '' : 'checked'}> Annulation de l'écho</label>
    <label class="chk"><input type="checkbox" id="v-agc" ${v.agc === false ? '' : 'checked'}> Réglage automatique du volume du micro</label>
    <label class="fld">Volume de la soundboard : <b id="v-sb-val">${Math.round(sbVolume() * 100)} %</b><input type="range" id="v-sb" min="0" max="100" value="${Math.round(sbVolume() * 100)}"></label>`;
}
async function fillDevices() {
  if (!navigator.mediaDevices?.enumerateDevices || !$('#v-input')) return;
  const list = await navigator.mediaDevices.enumerateDevices().catch(() => []);
  const fill = (sel, kind, cur) => {
    if (!sel) return; let n = 0;
    sel.innerHTML = '<option value="">Par défaut</option>' + list.filter(d => d.kind === kind && d.deviceId && d.deviceId !== 'default')
      .map(d => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || (kind === 'audioinput' ? 'Micro ' : 'Sortie ') + ++n)}</option>`).join('');
  };
  fill($('#v-input'), 'audioinput', vp().input); fill($('#v-output'), 'audiooutput', vp().output);
}
$('#settings-dlg').addEventListener('click', e => {
  const m = e.target.closest('[data-vmode]');
  if (m) { vp().mode = m.dataset.vmode; gate.ptt = false; saveVoice(); setGate(); return openSettings(); }
  if (e.target.closest('#v-ptt-set')) { capturingKey = true; $('#v-ptt-key').textContent = 'Appuie sur une touche…'; }
});
$('#settings-dlg').addEventListener('input', e => {
  const v = vp();
  if (e.target.id === 'v-thr') { v.threshold = Number(e.target.value); $('#v-thr-mark').style.left = v.threshold / 30 * 100 + '%'; saveVoice(); }
  if (e.target.id === 'v-sb') { v.sbVolume = Number(e.target.value) / 100; $('#v-sb-val').textContent = e.target.value + ' %'; saveVoice(); }
});
$('#settings-dlg').addEventListener('change', e => {
  const v = vp(), id = e.target.id;
  if (id === 'v-input') { v.input = e.target.value; saveVoice(); restartMic(); }
  if (id === 'v-output') { v.output = e.target.value; saveVoice(); if (audioCtx) actx(); }
  if (['v-noise', 'v-echo', 'v-agc'].includes(id)) { v[id.slice(2)] = e.target.checked; saveVoice(); restartMic(); }
});
