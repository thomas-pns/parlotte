'use strict';
// Parlotte — profils façon Discord : bannière, couleurs, pronoms, « À propos », À la une,
// potes et serveurs en commun. Carte au clic (feuille du bas sur téléphone), profil complet,
// et éditeur de profil avec aperçu en direct.

const PI = {
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 22),
  msg: svg('<path d="M4 5h16v11H9l-5 4z"/>', 18),
  add: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M19 8v6M16 11h6"/>', 18),
  expand: svg('<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>', 18),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 18),
  cake: svg('<path d="M4 20h16v-7H4zM4 15c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 13V9M12 6.5V5"/>', 16),
  srv: svg('<rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 4v16"/>', 16),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>', 16),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 18),
};
const profCache = new Map(); // userId → réponse de getProfile (À la une, en commun)

function mixColor(a, b, k) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}
const bannerStyle = u => {
  const c1 = /^#[0-9a-f]{6}$/i.test(u.color || '') ? u.color : '#8E6CFF', c2 = u.accent || mixColor(c1, '#14121A', 0.55);
  return `--pc1:${c1};--pc2:${c2}${u.banner ? `;background-image:url('${esc(u.banner)}')` : ''}`;
};
const sinceDate = iso => iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

function profileHTML(u, data, opts = {}) {
  const me = u.id === st.me, friend = st.friends.includes(u.id), blockedU = (st.blocked || []).includes(u.id);
  const story = typeof hasStory === 'function' && hasStory(u.id), unseen = story && unseenStory(u.id);
  const hl = data?.highlights || [];
  const common = data ? [data.mutualServers?.length ? `<span>${PI.srv} ${data.mutualServers.length} serveur${data.mutualServers.length > 1 ? 's' : ''} en commun</span>` : '',
    data.mutualFriends?.length ? `<span>${PI.people} ${data.mutualFriends.length} pote${data.mutualFriends.length > 1 ? 's' : ''} en commun</span>` : ''].join('') : '';
  return `<div class="pc ${opts.full ? 'full' : ''} ${opts.preview ? 'preview' : ''}" data-pc="${esc(u.id)}">
    <div class="pc-banner ${u.banner ? 'img' : ''}" style="${bannerStyle(u)}">
      ${opts.full ? `<button class="pc-x" data-pc-close aria-label="Fermer">${PI.close}</button>` : ''}
      ${!opts.preview && !opts.full ? `<button class="pc-x" data-pc-full title="Voir le profil" aria-label="Voir le profil">${PI.expand}</button>` : ''}
    </div>
    <div class="pc-head">
      <button class="pc-av ${story ? (unseen ? 'story' : 'story seen') : ''}" ${story && !opts.preview ? `data-pc-story="${esc(u.id)}" title="Voir la story"` : 'tabindex="-1"'}>${avatar(u, true)}</button>
      ${u.customStatus || u.statusEmoji ? `<div class="pc-bubble">${statusLine({ customStatus: u.customStatus, statusEmoji: u.statusEmoji })}</div>` : ''}
    </div>
    <div class="pc-body">
      <div class="pc-names"><h3>${esc(u.name)}</h3><div class="pc-sub">${esc(STATUS[u.status] || '')}${u.pronouns ? ` · ${esc(u.pronouns)}` : ''}</div></div>
      ${u.activity ? `<div class="pc-act">🎮 Joue à <b>${esc(u.activity.name)}</b>${typeof sinceText === 'function' ? `<small>depuis ${esc(sinceText(u.activity.since))}</small>` : ''}</div>` : ''}
      ${u.about ? `<div class="pc-sec"><h5>À propos</h5><p>${esc(u.about)}</p></div>` : ''}
      ${hl.length ? `<div class="pc-sec"><h5>À la une</h5><div class="pc-hl">${hl.map(h => `<button class="pc-hli" data-pc-hl="${esc(h.id)}">${typeof hlCoverHTML === 'function' ? hlCoverHTML(h) : ''}<span>${esc(h.title)}</span></button>`).join('')}</div></div>` : ''}
      ${data?.since ? `<div class="pc-sec"><h5>Sur Parlotte depuis</h5><p class="pc-since">${PI.cake} ${esc(sinceDate(data.since))}</p></div>` : ''}
      ${common ? `<div class="pc-common">${common}</div>` : ''}
      ${!opts.preview && !opts.full ? `${typeof userVolumeHTML === 'function' ? userVolumeHTML(u) : ''}${typeof cardRolesHTML === 'function' ? cardRolesHTML(u) : ''}` : ''}
      ${opts.preview ? '' : `<div class="pc-actions">
        ${me ? `<button class="primary" id="card-edit">${PI.edit}<span>Modifier mon profil</span></button>`
          : friend ? `<button class="primary" data-carddm="${esc(u.id)}">${PI.msg}<span>Message</span></button>`
          : blockedU ? '' : `<button class="primary green" data-cardadd="${esc(u.name)}">${PI.add}<span>Ajouter en pote</span></button>`}
        ${!opts.full && !me ? `<button class="pill-btn" data-pc-full>${PI.expand}<span>Profil</span></button>` : ''}
      </div>
      ${!me ? (blockedU ? `<button class="link block-link" data-unblock="${esc(u.id)}">Débloquer</button>` : `<button class="link block-link danger-link" data-block="${esc(u.id)}">Bloquer</button>`) : ''}`}
    </div></div>`;
}
async function loadProfile(uid) {
  try { const r = await request('getProfile', { userId: uid }); profCache.set(uid, r); if (r.user) st.users[uid] = { ...st.users[uid], ...r.user }; return r; }
  catch { return profCache.get(uid) || null; }
}

// ---------------------------------------------------------------- Carte au clic (remplace l'ancienne)
document.addEventListener('click', e => {
  const t = e.target.closest('[data-user]'), card = $('#card');
  if (!t || card.hidden || e.target.closest('#card,#me,#prof-av,#dlg,#profile-dlg,#status-menu,#pfull,.pc')) return;
  const u = user(t.dataset.user); if (!u || u.id === 'system') return;
  showCard(u, t);
});
function showCard(u, anchor) {
  const card = $('#card'); card.classList.add('pc-card');
  card.innerHTML = profileHTML(u, profCache.get(u.id));
  const phone = innerWidth <= 700;
  if (phone) { card.style.left = ''; card.style.top = ''; }
  else {
    const r = anchor.getBoundingClientRect(), w = 320, h = Math.min(card.offsetHeight || 420, innerHeight - 16);
    let left = r.right + 10; if (left + w > innerWidth - 8) left = Math.max(8, r.left - w - 10);
    if (r.width > 200) left = Math.max(8, Math.min(r.left, innerWidth - w - 8));
    card.style.left = left + 'px'; card.style.top = Math.max(8, Math.min(r.top, innerHeight - h - 8)) + 'px';
  }
  card.hidden = false; replayCls(card, 'pc-in');
  loadProfile(u.id).then(d => { if (!card.hidden && card.querySelector(`[data-pc="${CSS.escape(u.id)}"]`) && d) { card.innerHTML = profileHTML(user(u.id), d); } });
}
function replayCls(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
// Sur téléphone, toucher le fond ferme la feuille
document.addEventListener('pointerdown', e => {
  const card = $('#card'); if (card.hidden || innerWidth > 700) return;
  if (!e.target.closest('#card,[data-user]')) card.hidden = true;
});

// ---------------------------------------------------------------- Profil complet
document.body.insertAdjacentHTML('beforeend', '<div id="pfull" hidden role="dialog" aria-label="Profil"><div class="pfull-box"></div></div>');
function openFullProfile(uid) {
  const u = user(uid); if (!u) return;
  $('#card').hidden = true;
  const box = $('#pfull .pfull-box');
  box.innerHTML = profileHTML(u, profCache.get(uid), { full: true });
  $('#pfull').hidden = false; replayCls($('#pfull'), 'pc-in');
  loadProfile(uid).then(d => { if (!$('#pfull').hidden && d) box.innerHTML = profileHTML(user(uid), d, { full: true }); });
}
function pcClick(e) {
  const root = e.target.closest('.pc'); if (!root) return;
  const uid = root.dataset.pc;
  if (e.target.closest('[data-pc-full]')) { e.stopPropagation(); return openFullProfile(uid); }
  if (e.target.closest('[data-pc-close]')) { $('#pfull').hidden = true; return; }
  if (e.target.closest('[data-pc-story]')) { $('#card').hidden = true; $('#pfull').hidden = true; return openStoryViewer(uid); }
  const hb = e.target.closest('[data-pc-hl]');
  if (hb) { const h = profCache.get(uid)?.highlights?.find(x => x.id === hb.dataset.pcHl); $('#card').hidden = true; $('#pfull').hidden = true; return openHighlight(uid, h); }
}
$('#card').addEventListener('click', pcClick);
$('#pfull').addEventListener('click', e => {
  if (e.target === $('#pfull')) { $('#pfull').hidden = true; return; }
  pcClick(e);
  if (e.target.closest('#card-edit')) { $('#pfull').hidden = true; openProfile(); }
  const dm = e.target.closest('[data-carddm]'); if (dm) { $('#pfull').hidden = true; act('openDM', { userId: dm.dataset.carddm }); }
  const add = e.target.closest('[data-cardadd]'); if (add) { $('#pfull').hidden = true; act('friendRequest', { username: add.dataset.cardadd }).then(() => toast('Demande envoyée')); }
  if (e.target.closest('[data-block],[data-unblock]')) $('#pfull').hidden = true;
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pfull').hidden) $('#pfull').hidden = true; });

// ---------------------------------------------------------------- Éditeur de profil (avec aperçu en direct)
const PROFILE_COLORS = ['#FF6B4A', '#F5C04A', '#3FB27F', '#6FE3D2', '#4FA3D1', '#5B8CFF', '#8E6CFF', '#C77DFF', '#E05A8A', '#FF8A5B'];
let pd = null; // brouillon
$('#profile-form').innerHTML = `
  <div class="pe">
    <div class="pe-form">
      <h3>Mon profil</h3>
      <div class="pe-row">
        <div class="pe-field"><span class="pe-label">Bannière</span>
          <div class="pe-btns"><label class="pill-btn">${PI.camera}<span>Choisir une image</span><input type="file" id="pe-banner" accept="image/png,image/jpeg,image/gif,image/webp" hidden></label>
          <button type="button" class="link danger-link" id="pe-banner-del">Retirer</button></div></div>
        <div class="pe-field"><span class="pe-label">Photo</span>
          <div class="pe-btns"><label class="pill-btn">${PI.camera}<span>Changer</span><input type="file" id="pe-avatar" accept="image/png,image/jpeg,image/gif,image/webp" hidden></label>
          <button type="button" class="link danger-link" id="pe-avatar-del">Retirer</button></div></div>
      </div>
      <div class="pe-field"><span class="pe-label">Couleurs de la bannière</span>
        <div class="pe-colors" id="pe-c1">${PROFILE_COLORS.map(c => `<button type="button" class="sw" data-c1="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<label class="sw custom" title="Autre couleur"><input type="color" id="prof-color"><span>+</span></label></div>
        <div class="pe-colors" id="pe-c2"><small>Dégradé vers</small>${['#14121A', '#2B1D3A', '#0F2E2A', '#3A1E22', '#F5C04A', '#6FE3D2'].map(c => `<button type="button" class="sw" data-c2="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}<label class="sw custom" title="Autre couleur"><input type="color" id="pe-accent"><span>+</span></label><button type="button" class="link" data-c2="">Auto</button></div>
      </div>
      <div class="pe-row">
        <label class="pe-field"><span class="pe-label">Pronoms</span><input id="pe-pronouns" maxlength="30" placeholder="il/lui, elle, iel…"></label>
        <label class="pe-field"><span class="pe-label">Statut</span><select id="prof-presence">
          <option value="online">🟢 En ligne</option><option value="idle">🌙 Absent</option><option value="dnd">⛔ Ne pas déranger</option><option value="invisible">⚪ Invisible</option></select></label>
      </div>
      <label class="pe-field"><span class="pe-label">Message perso</span><input id="prof-custom" maxlength="80" placeholder="En train de jouer à Krunker…"></label>
      <label class="pe-field"><span class="pe-label">À propos de moi <small id="pe-count">0/190</small></span><textarea id="prof-about" maxlength="190" rows="3" placeholder="Deux-trois mots sur toi, tes jeux, ta musique…"></textarea></label>
    </div>
    <div class="pe-prev"><span class="pe-label">Aperçu</span><div id="pe-preview"></div></div>
  </div>
  <menu class="pe-menu"><button value="cancel">Annuler</button><button value="save" class="primary">Enregistrer</button></menu>
  <div id="prof-av" hidden></div>`;
function pdUser() {
  const me = user(st.me);
  return { ...me, color: pd.color, accent: pd.accent, pronouns: pd.pronouns, about: pd.about, customStatus: pd.customStatus, statusEmoji: me.statusEmoji,
    avatar: pd.avatar === undefined ? me.avatar : pd.avatar?.url || null, banner: pd.banner === undefined ? me.banner : pd.banner?.url || null,
    status: pd.presence === 'invisible' ? 'offline' : pd.presence };
}
function pdRender() {
  $('#pe-preview').innerHTML = profileHTML(pdUser(), profCache.get(st.me), { preview: true });
  document.querySelectorAll('#pe-c1 [data-c1]').forEach(b => b.classList.toggle('on', b.dataset.c1.toLowerCase() === (pd.color || '').toLowerCase()));
  document.querySelectorAll('#pe-c2 [data-c2]').forEach(b => b.classList.toggle('on', (b.dataset.c2 || '').toLowerCase() === (pd.accent || '').toLowerCase()));
  $('#pe-count').textContent = `${pd.about.length}/190`;
  $('#pe-banner-del').hidden = !pdUser().banner; $('#pe-avatar-del').hidden = !pdUser().avatar;
}
openProfile = function () {
  const p = st.profile || {}, me = user(st.me);
  pd = { color: p.color || me.color, accent: p.accent || null, pronouns: p.pronouns || '', about: p.about || '', customStatus: p.customStatus || '', presence: p.presence || 'online', avatar: undefined, banner: undefined };
  $('#prof-presence').value = pd.presence; $('#prof-custom').value = pd.customStatus; $('#prof-about').value = pd.about;
  $('#prof-color').value = pd.color; $('#pe-accent').value = pd.accent || '#14121a'; $('#pe-pronouns').value = pd.pronouns;
  pdRender(); $('#profile-dlg').showModal();
  loadProfile(st.me).then(() => pd && pdRender());
};
$('#profile-form').addEventListener('input', e => {
  if (!pd) return;
  const id = e.target.id;
  if (id === 'prof-color') pd.color = e.target.value;
  else if (id === 'pe-accent') pd.accent = e.target.value;
  else if (id === 'pe-pronouns') pd.pronouns = e.target.value;
  else if (id === 'prof-about') pd.about = e.target.value;
  else if (id === 'prof-custom') pd.customStatus = e.target.value;
  else if (id === 'prof-presence') pd.presence = e.target.value;
  else return;
  pdRender();
});
$('#profile-form').addEventListener('click', e => {
  if (!pd) return;
  const c1 = e.target.closest('[data-c1]'); if (c1) { pd.color = c1.dataset.c1; $('#prof-color').value = pd.color; return pdRender(); }
  const c2 = e.target.closest('[data-c2]'); if (c2) { pd.accent = c2.dataset.c2 || null; return pdRender(); }
  if (e.target.closest('#pe-banner-del')) { pd.banner = null; return pdRender(); }
  if (e.target.closest('#pe-avatar-del')) { pd.avatar = null; return pdRender(); }
});
$('#profile-form').addEventListener('change', async e => {
  if (!pd || !['pe-banner', 'pe-avatar'].includes(e.target.id)) return;
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) return toast('Choisis une image (png, jpg, gif, webp)', true);
  if (f.size > MAX_FILE) return toast('Image trop lourde', true);
  try { const up = await upload(f); pd[e.target.id === 'pe-banner' ? 'banner' : 'avatar'] = { id: up.id, url: up.url }; pdRender(); }
  catch (err) { toast(err.message, true); }
});
$('#profile-dlg').addEventListener('close', () => {
  if ($('#profile-dlg').returnValue !== 'save' || !pd) return;
  const payload = { presence: pd.presence, customStatus: pd.customStatus, about: pd.about, color: pd.color, accent: pd.accent, pronouns: pd.pronouns };
  if (pd.avatar !== undefined) payload.avatar = pd.avatar ? pd.avatar.id : null;
  if (pd.banner !== undefined) payload.banner = pd.banner ? pd.banner.id : null;
  pd = null;
  act('setProfile', payload).then(() => { toast('Profil enregistré ✨'); profCache.delete(st.me); });
});
