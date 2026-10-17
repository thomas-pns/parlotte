'use strict';
// Parlotte 1.9 — les fondations :
//  • 4 onglets en bas (Messages, Serveurs, Activité, Profil) qu'on fait défiler au doigt, avec animation ;
//  • un vrai onglet Profil (ta page à toi) ;
//  • le profil d'un pote s'ouvre dans une feuille qui monte (on la redescend du doigt) ;
//  • catégories d'amis (Amis proches + les tiennes), appui long sur un pote pour le ranger,
//    et une story peut être réservée à une catégorie ;
//  • une loupe pour retrouver un pote ou une conversation (à la place du crayon) ;
//  • catégories de salons fines, sans « Salons textuels / vocaux » imposés ;
//  • stories : chargement en douceur, la suivante est préchargée, rien ne reste après 24 h ;
//  • réglage « Écran de l'iPhone » + diagnostic.

window.PARLOTTE_VERSION = window.PARLOTTE_VERSION || '1.9.0';
// un avatar dans nos feuilles ne doit pas ouvrir la carte de profil en plus (data-user)
const avatarNU = (u, s) => avatar(u, s).replace(' data-user=', ' data-nouser=');
const V9 = {
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', 20),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" fill="currentColor"/>', 18),
  starO: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>', 18),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', 18),
  msg: svg('<path d="M4 5h16v11H9l-5 4z"/>', 18),
  tag: svg('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3" fill="currentColor"/>', 18),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 18),
  check: svg('<path d="M5 12l5 5L20 7"/>', 16),
  bye: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 11h6"/>', 18),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z"/>', 18),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 18),
  memo: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/>', 18),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>', 18),
  group: svg('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20a6 6 0 0112 0M10 20a6 6 0 0112 0"/>', 18),
  chev: svg('<path d="M9 5l7 7-7 7"/>', 16),
  down: svg('<path d="M6 9l6 6 6-6"/>', 14),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 18),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 18),
  phone: svg('<rect x="6" y="2.5" width="12" height="19" rx="3"/><path d="M10 18.5h4"/>', 20),
  hash: svg('<path d="M5 9h14M4 15h14M10 3L8 21M16 3l-2 18"/>', 16),
};
const FG_COLORS = ['#3FB27F', '#FF6B4A', '#F5C04A', '#4FA3D1', '#8E6CFF', '#E05A8A', '#6FE3D2', '#FF8A5B'];
const noTouchSel = () => getSelection?.()?.removeAllRanges?.();

// ================================================================ Catégories d'amis (données)
st.fgroups = [];
const fgroups = () => st.fgroups || [];
const fgroup = id => fgroups().find(g => g.id === id);
const isClose = uid => !!fgroup('close')?.members.includes(uid);
const groupsOfUser = uid => fgroups().filter(g => g.members.includes(uid));
const _handle19 = handle;
handle = function (m) {
  if (m.t === 'fgroups') { st.fgroups = m.fgroups || []; return afterFgroups(); }
  _handle19(m);
  if (m.t === 'auth') st.fgroups = m.profile?.fgroups || [];
};
function afterFgroups() {
  if (isFriendsView()) renderMain();
  if (!$('#ptab').hidden) renderPTab();
  if ($('#settings-dlg').open && setTab === 'friends') fillFriendsPane();
  if (!$('#sheet').hidden && $('#sheet .fsheet')) refreshFriendSheet();
}

// ================================================================ Feuille d'un pote (appui long)
function friendSheetHTML(uid) {
  const u = user(uid), friend = st.friends.includes(uid), gs = fgroups();
  const sub = typeof subline === 'function' ? subline(u) : '';
  return `<div class="fsheet" data-fs="${esc(uid)}">
    <div class="fs-head">${avatarNU(u, true)}<div><b>${esc(u.name)}</b>${sub ? `<small>${sub}</small>` : ''}</div>${isClose(uid) ? `<span class="fs-close-badge">${V9.star}</span>` : ''}</div>
    <div class="fs-quick">
      <button data-fs-act="profile">${V9.user}<span>Profil</span></button>
      ${friend ? `<button data-fs-act="dm">${V9.msg}<span>Message</span></button>` : ''}
      ${friend ? `<button data-fs-act="close" class="${isClose(uid) ? 'on' : ''}">${isClose(uid) ? V9.star : V9.starO}<span>${isClose(uid) ? 'Ami proche' : 'Ami proche ?'}</span></button>` : ''}
    </div>
    ${friend ? `<h5 class="fs-h">Catégories d'amis</h5><div class="sh-list fs-groups">
      ${gs.filter(g => g.id !== 'close').map(g => `<button class="sh-item fs-g ${g.members.includes(uid) ? 'on' : ''}" data-fs-group="${esc(g.id)}">
        <span class="fg-dot" style="background:${esc(g.color)}"></span><b>${esc(g.name)}</b><small>${g.members.length} pote${g.members.length > 1 ? 's' : ''}</small><i class="fs-chk">${V9.check}</i></button>`).join('')}
      <button class="sh-item" data-fs-act="newgroup"><span class="sh-ico">${V9.plus}</span><b>Nouvelle catégorie…</b></button></div>
      <div class="sh-list fs-danger"><button class="sh-item danger" data-fs-act="remove"><span class="sh-ico">${V9.bye}</span><b>Retirer de mes potes</b></button></div>` : ''}
  </div>`;
}
function openFriendSheet(uid) {
  if (!uid || uid === st.me || uid === 'system') return;
  noTouchSel(); navigator.vibrate?.(12);
  $('#sheet')._at = Date.now();
  openSheet(friendSheetHTML(uid));
}
function refreshFriendSheet() {
  const f = $('#sheet .fsheet'); if (!f) return;
  f.outerHTML = friendSheetHTML(f.dataset.fs);
}
document.addEventListener('click', async e => {
  const fs = e.target.closest('.fsheet'); if (!fs) return;
  const uid = fs.dataset.fs, a = e.target.closest('[data-fs-act]'), g = e.target.closest('[data-fs-group]');
  if (g) { const on = !fgroup(g.dataset.fsGroup)?.members.includes(uid); g.classList.toggle('on', on); return act('setFriendGroup', { groupId: g.dataset.fsGroup, userId: uid, on }); }
  if (!a) return;
  const k = a.dataset.fsAct;
  if (k === 'profile') { closeSheet(); return setTimeout(() => openUserProfile(uid), 180); }
  if (k === 'dm') { closeSheet(); return act('openDM', { userId: uid }); }
  if (k === 'close') { const on = !isClose(uid); toast(on ? `${user(uid).name} est dans tes amis proches ⭐` : `${user(uid).name} n'est plus dans tes amis proches`); return act('setFriendGroup', { groupId: 'close', userId: uid, on }); }
  if (k === 'newgroup') { closeSheet(); return setTimeout(() => editFriendGroup(null, uid), 200); }
  if (k === 'remove') { closeSheet(); if (confirm(`Retirer ${user(uid).name} de tes potes ?`)) act('friendRemove', { userId: uid }); }
});

// Appui long (téléphone) ou clic droit (PC) sur un pote, n'importe où dans les listes
const FRIEND_TARGETS = '[data-friend-row],.dispo[data-dm-user],.conv[data-chan-id],.fsr-row[data-fsr-user],.pick[data-pick]';
const friendOf = el => el.dataset.friendRow || el.dataset.dmUser || el.dataset.fsrUser || el.dataset.pick
  || (() => { const c = chanById(el.dataset.chanId); return c?.type === 'dm' && !c.group ? dmOther(c).id : null; })();
(() => {
  let t = null, x0 = 0, y0 = 0, el = null, fired = 0;
  const cancel = () => { clearTimeout(t); t = null; el?.classList.remove('pressing'); el = null; };
  document.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    const r = e.target.closest(FRIEND_TARGETS); if (!r || e.target.closest('.mini-btn,.act,[data-joincall-c]')) return;
    const uid = friendOf(r); if (!uid) return;
    el = r; x0 = e.clientX; y0 = e.clientY; r.classList.add('pressing');
    t = setTimeout(() => { cancel(); fired = Date.now(); openFriendSheet(uid); }, 430);
  }, true);
  document.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); }, true);
  ['pointerup', 'pointercancel', 'scroll'].forEach(k => document.addEventListener(k, () => t && cancel(), true));
  // le doigt qui se relève après l'appui long ne doit pas ouvrir la conversation
  document.addEventListener('click', e => { if (Date.now() - fired < 600 && !e.target.closest('#sheet')) { e.stopPropagation(); e.preventDefault(); } }, true);
  document.addEventListener('contextmenu', e => {
    const r = e.target.closest(FRIEND_TARGETS); if (!r) return;
    const uid = friendOf(r); if (!uid) return;
    e.preventDefault(); if (e.pointerType !== 'touch' && Date.now() - fired > 600) openFriendSheet(uid);
  });
})();

// ================================================================ Créer / modifier une catégorie d'amis
function editFriendGroup(groupId, addUid) {
  const g = groupId && fgroup(groupId), sel = new Set(g ? g.members : addUid ? [addUid] : []);
  let color = g?.color || FG_COLORS[(fgroups().length) % FG_COLORS.length];
  const friends = st.friends.map(user).sort((a, b) => a.name.localeCompare(b.name));
  openSheet(`<form class="fg-edit" id="fg-form">
    <h3 class="sh-title">${g ? (g.id === 'close' ? `${V9.star} Amis proches` : 'Modifier la catégorie') : 'Nouvelle catégorie d\'amis'}</h3>
    ${g?.id === 'close' ? '<p class="small fg-hint">Tes amis proches voient les stories que tu leur réserves (anneau vert ⭐).</p>' : `
    <input id="fg-name" maxlength="30" placeholder="Famille, Potes du foot, Lycée…" value="${esc(g?.name || '')}" autocomplete="off">
    <div class="fg-colors">${FG_COLORS.map(c => `<button type="button" class="fg-c ${c === color ? 'on' : ''}" data-fg-c="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}</div>`}
    <div class="fg-search"><span>${V9.search}</span><input id="fg-q" placeholder="Chercher un pote" autocomplete="off"></div>
    <div class="fg-list">${friends.map(u => `<label class="fg-pick" data-name="${esc(u.name.toLowerCase())}">${avatarNU(u, true)}<span>${esc(u.name)}</span><input type="checkbox" value="${esc(u.id)}" ${sel.has(u.id) ? 'checked' : ''}><i>${V9.check}</i></label>`).join('') || '<p class="small">Ajoute d\'abord des potes.</p>'}</div>
    <div class="fg-foot">${g && g.id !== 'close' ? `<button type="button" class="pill-btn danger-pill" id="fg-del">${V9.trash}<span>Supprimer</span></button>` : ''}
      <button class="primary" id="fg-ok">${g ? 'Enregistrer' : 'Créer'}</button></div></form>`);
  $('#sheet').classList.add('sh-tall');
  const f = $('#fg-form');
  f.addEventListener('click', e => { const c = e.target.closest('[data-fg-c]'); if (c) { color = c.dataset.fgC; f.querySelectorAll('.fg-c').forEach(x => x.classList.toggle('on', x === c)); } });
  $('#fg-q').oninput = () => { const q = $('#fg-q').value.trim().toLowerCase(); f.querySelectorAll('.fg-pick').forEach(l => (l.hidden = !!q && !l.dataset.name.includes(q))); };
  $('#fg-del')?.addEventListener('click', () => { if (!confirm(`Supprimer la catégorie « ${g.name} » ? Tes potes restent tes potes.`)) return; closeSheet(); act('deleteFriendGroup', { groupId: g.id }); });
  f.onsubmit = async e => {
    e.preventDefault();
    try {
      let gid = g?.id;
      if (!g || g.id !== 'close') {
        const name = $('#fg-name').value.trim(); if (!name) return $('#fg-name').focus();
        const r = await request('saveFriendGroup', { groupId: gid, name, color }); gid = r.id || gid;
      }
      const want = new Set([...f.querySelectorAll('.fg-pick input:checked')].map(i => i.value)), had = new Set(g?.members || []);
      for (const u of st.friends) if (want.has(u) !== had.has(u)) await request('setFriendGroup', { groupId: gid, userId: u, on: want.has(u) });
      closeSheet(); toast(g ? 'Catégorie enregistrée' : 'Catégorie créée ✨');
    } catch (err) { toast(err.message, true); }
  };
}
const _closeSheet19 = closeSheet;
closeSheet = function () { _closeSheet19(); const sh = $('#sheet'); setTimeout(() => sh.hidden && sh.classList.remove('sh-tall'), 280); };

// ================================================================ Paramètres → Catégories d'amis
SETI.friends = svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M17.5 6.5l1 2 2.2.3-1.6 1.6.4 2.2-2-1-2 1 .4-2.2-1.6-1.6 2.2-.3z"/>', 20);
SET_GROUPS[0][1].push(['friends', 'Catégories d\'amis']);
SET_LABEL.friends = 'Catégories d\'amis';
function fillFriendsPane() {
  const pane = $('#settings-body .set-pane'); if (!pane || setTab !== 'friends') return;
  const gs = fgroups();
  pane.innerHTML = `<p class="small">Range tes potes dans des catégories (Amis proches, Famille, Potes du foot…). Tu choisis ensuite à qui montrer chaque story.
      Personne ne voit dans quelle catégorie tu l'as mis. Astuce : <b>appui long</b> sur un pote pour le ranger.</p>
    <div class="fg-cards">${gs.map(g => `<button class="fg-card" data-fg-edit="${esc(g.id)}" style="--fc:${esc(g.color)}">
      <span class="fg-ic">${g.id === 'close' ? V9.star : V9.tag}</span><span class="fg-tx"><b>${esc(g.name)}</b><small>${g.members.length ? g.members.slice(0, 3).map(u => esc(user(u).name)).join(', ') + (g.members.length > 3 ? ` +${g.members.length - 3}` : '') : 'Personne pour l\'instant'}</small></span>
      <span class="fg-av">${g.members.slice(0, 3).map(u => avatarNU(user(u))).join('')}</span>${V9.chev}</button>`).join('')}
      <button class="fg-card add" data-fg-new><span class="fg-ic">${V9.plus}</span><span class="fg-tx"><b>Créer une catégorie</b><small>Jusqu'à 20</small></span></button></div>`;
}
const _openSettings19 = openSettings;
openSettings = function () { _openSettings19(); if (setTab === 'friends') fillFriendsPane(); fillScreenSetting(); };
$('#settings-dlg').addEventListener('click', e => {
  const ed = e.target.closest('[data-fg-edit]'); if (ed) { e.stopImmediatePropagation(); return editFriendGroup(ed.dataset.fgEdit); }
  if (e.target.closest('[data-fg-new]')) { e.stopImmediatePropagation(); return editFriendGroup(null); }
}, true);

// ================================================================ Page « Tes potes » : recherche + catégories
const _friendsHTML19 = friendsHTML;
friendsHTML = function () {
  const tab = st.view.tab || 'online';
  if (tab === 'pending' || tab === 'blocked' || tab === 'add') return _friendsHTML19().replace('<div class="friends">', `<div class="friends">${friendsTabsHTML(tab)}`).replace(/<div class="tabs">[\s\S]*?Ajouter un ami<\/button><\/div>/, '');
  const F = st.friends.map(user).sort((a, b) => (a.status === 'offline') - (b.status === 'offline') || a.name.localeCompare(b.name));
  const g = tab.startsWith('g:') && fgroup(tab.slice(2));
  const list = g ? F.filter(u => g.members.includes(u.id)) : tab === 'online' ? F.filter(u => u.status !== 'offline') : F;
  const rows = list.map(u => `<div class="friend frow" data-friend-row="${esc(u.id)}" data-name="${esc(u.name.toLowerCase())}">
      <span class="fr-av">${avatarNU(u, true)}${isClose(u.id) ? `<i class="fr-star">${V9.star}</i>` : ''}</span>
      <div class="grow"><b>${esc(u.name)}</b><small>${subline(u) || esc(STATUS[u.status] || '')}</small>
        ${groupsOfUser(u.id).filter(x => x.id !== 'close').length ? `<span class="fr-tags">${groupsOfUser(u.id).filter(x => x.id !== 'close').map(x => `<i style="--fc:${esc(x.color)}">${esc(x.name)}</i>`).join('')}</span>` : ''}</div>
      <button class="act fr-btn" data-dm="${u.id}" title="Message" aria-label="Message à ${esc(u.name)}">${V9.msg}</button>
      <button class="act fr-btn" data-fr-more="${u.id}" title="Plus" aria-label="Options pour ${esc(u.name)}">${svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>', 18)}</button></div>`).join('');
  return `<div class="friends f19">${friendsTabsHTML(tab)}
    <div class="fr-search"><span>${V9.search}</span><input id="fr-q" placeholder="Rechercher parmi tes ${st.friends.length} pote${st.friends.length > 1 ? 's' : ''}" autocomplete="off" aria-label="Rechercher un pote"></div>
    ${g ? `<div class="fr-ghead" style="--fc:${esc(g.color)}"><span>${g.id === 'close' ? V9.star : V9.tag}</span><b>${esc(g.name)}</b><button class="pill-btn" data-fg-open="${esc(g.id)}">${V9.edit}<span>Modifier</span></button></div>` : ''}
    <div class="cat">${g ? `${list.length} pote${list.length > 1 ? 's' : ''}` : `${tab === 'online' ? 'En ligne' : 'Tous tes potes'} — ${list.length}`}</div>
    <div class="fr-rows">${rows || `<div class="empty-state">${g ? 'Personne ici. Appui long sur un pote pour l\'ajouter, ou « Modifier ».' : tab === 'online' ? 'Aucun pote en ligne pour le moment.' : 'Pas encore de potes. Touche « Ajouter » !'}</div>`}</div>
    <p class="fr-none" hidden>Aucun pote ne s'appelle comme ça.</p></div>`;
};
function friendsTabsHTML(tab) {
  const n = st.incoming.length;
  const items = [['online', 'En ligne'], ['all', 'Tous'], ...fgroups().map(g => ['g:' + g.id, (g.id === 'close' ? '⭐ ' : '') + g.name, g.color]),
    ['pending', `Demandes${n ? ` · ${n}` : ''}`], ['blocked', 'Bloqués']];
  return `<div class="tabs fr-tabs" data-noswipe>${items.map(([k, l, c]) => `<button data-tab="${esc(k)}" class="${tab === k ? 'on' : ''}" ${c ? `style="--fc:${esc(c)}"` : ''}>${esc(l)}</button>`).join('')}
    <button data-tab="add" class="add ${tab === 'add' ? 'on' : ''}">${V9.plus}<span>Ajouter</span></button><button class="fr-newg" data-fg-new-p title="Nouvelle catégorie">${V9.tag}</button></div>`;
}
$('#view').addEventListener('input', e => {
  if (e.target.id !== 'fr-q') return;
  const q = e.target.value.trim().toLowerCase(); let n = 0;
  $('#view').querySelectorAll('.frow').forEach(r => { const on = !q || r.dataset.name.includes(q); r.hidden = !on; n += on; });
  const none = $('#view .fr-none'); if (none) none.hidden = n > 0 || !q;
});
$('#view').addEventListener('click', e => {
  const m = e.target.closest('[data-fr-more]'); if (m) { e.stopPropagation(); return openFriendSheet(m.dataset.frMore); }
  const o = e.target.closest('[data-fg-open]'); if (o) return editFriendGroup(o.dataset.fgOpen);
  if (e.target.closest('[data-fg-new-p]')) return editFriendGroup(null);
  const row = e.target.closest('[data-friend-row]'); if (row && !e.target.closest('button')) return openUserProfile(row.dataset.friendRow);
}, true);

// ================================================================ Loupe : retrouver un pote ou une conversation
function openFinder() {
  openSheet(`<div class="finder"><div class="fsr-box"><span>${V9.search}</span><input id="fsr-q" placeholder="Un pote, un groupe, un salon…" autocomplete="off" enterkeyhint="go" aria-label="Rechercher"></div>
    <div id="fsr-res" class="fsr-res"></div></div>`);
  $('#sheet').classList.add('sh-tall');
  const q = $('#fsr-q'); q.oninput = () => fillFinder(q.value); fillFinder('');
  q.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#fsr-res [data-fsr-user],#fsr-res [data-fsr-chan]')?.click(); } };
  setTimeout(() => q.focus(), 280);
}
function fillFinder(raw) {
  const q = raw.trim().toLowerCase(), has = s => !q || s.toLowerCase().includes(q);
  const friends = st.friends.map(user).filter(u => has(u.name)).sort((a, b) => isClose(b.id) - isClose(a.id) || (a.status === 'offline') - (b.status === 'offline') || a.name.localeCompare(b.name));
  const groups = st.dms.filter(c => c.group && (has(groupName(c)) || c.members.some(m => has(user(m).name))));
  const chans = q ? st.servers.flatMap(s => s.channels.filter(c => c.type !== 'voice' && has(c.name)).map(c => ({ s, c }))).slice(0, 8) : [];
  const recent = !q ? st.dms.filter(c => !c.group).sort((a, b) => (st.lastByChannel[b.id] || '').localeCompare(st.lastByChannel[a.id] || '')).slice(0, 8).map(dmOther) : [];
  const row = u => `<button class="fsr-row" data-fsr-user="${esc(u.id)}">${avatarNU(u, true)}<span class="fsr-tx"><b>${esc(u.name)}${isClose(u.id) ? ` <i class="fr-star in">${V9.star}</i>` : ''}</b><small>${subline(u) || esc(STATUS[u.status] || '')}</small></span>${V9.msg}</button>`;
  let html = '';
  if (recent.length) html += `<h5>Récents</h5><div class="fsr-chips" data-noswipe>${recent.map(u => `<button class="fsr-chip" data-fsr-user="${esc(u.id)}">${avatarNU(u, true)}<span>${esc(u.name)}</span></button>`).join('')}</div>`;
  if (friends.length) html += `<h5>${q ? 'Potes' : 'Tous tes potes'}</h5>` + friends.map(row).join('');
  if (groups.length) html += '<h5>Groupes</h5>' + groups.map(c => `<button class="fsr-row" data-fsr-chan="${esc(c.id)}">${convAvatar(c)}<span class="fsr-tx"><b>${esc(groupName(c))}</b><small>${c.members.length} membres</small></span>${V9.msg}</button>`).join('');
  if (chans.length) html += '<h5>Salons</h5>' + chans.map(({ s, c }) => `<button class="fsr-row" data-fsr-chan="${esc(c.id)}" data-fsr-srv="${esc(s.id)}">${srvTileHTML(s, 'fsr-srv')}<span class="fsr-tx"><b>#${esc(c.name)}</b><small>${esc(s.name)}</small></span>${V9.hash}</button>`).join('');
  if (!html) html = `<div class="fsr-empty">${q ? `Personne ne s'appelle « ${esc(raw.trim())} » dans tes potes.<br><button class="pill-btn" data-fsr-add="${esc(raw.trim())}">${V9.plus}<span>Ajouter « ${esc(raw.trim())} » en pote</span></button>` : 'Ajoute des potes avec leur pseudo exact pour leur écrire.'}</div>`;
  html += `<button class="fsr-row fsr-new" data-fsr-group>${'<span class="sh-ico">' + V9.group + '</span>'}<span class="fsr-tx"><b>Nouveau groupe</b><small>Écris à plusieurs potes d'un coup</small></span>${V9.chev}</button>`;
  $('#fsr-res').innerHTML = html;
}
document.addEventListener('click', e => {
  if (e.target.closest('#new-dm')) { e.stopImmediatePropagation(); e.preventDefault(); return openFinder(); }
  const fu = e.target.closest('#fsr-res [data-fsr-user]'); if (fu) { closeSheet(); return act('openDM', { userId: fu.dataset.fsrUser }); }
  const fc = e.target.closest('#fsr-res [data-fsr-chan]'); if (fc) { closeSheet(); return openChannel(fc.dataset.fsrSrv || '@me', fc.dataset.fsrChan); }
  if (e.target.closest('#fsr-res [data-fsr-group]')) { closeSheet(); return setTimeout(openGroupDialog, 220); }
  const fa = e.target.closest('[data-fsr-add]'); if (fa) { closeSheet(); return act('friendRequest', { username: fa.dataset.fsrAdd }).then(r => toast(r?.text || 'Demande envoyée')); }
}, true);
const _renderSide19f = renderSide;
renderSide = function () {
  _renderSide19f();
  const b = $('#new-dm'); if (b && !b.dataset.v19) { b.dataset.v19 = '1'; b.innerHTML = V9.search; b.title = 'Rechercher un pote ou une conversation'; b.setAttribute('aria-label', 'Rechercher'); }
};

// ================================================================ Profil d'un pote : feuille qui monte (téléphone)
function openUserProfile(uid) {
  const u = user(uid); if (!u || uid === 'system') return;
  if (uid === st.me && mobile()) return openPTab();
  if (!mobile()) return openFullProfile(uid);
  openPSheet(uid);
}
function openPSheet(uid) {
  const pf = $('#pfull'), box = pf.querySelector('.pfull-box');
  $('#card').hidden = true;
  pf.classList.add('sheet19'); pf.classList.remove('ps-out');
  box.innerHTML = `<div class="ps-grab" aria-hidden="true"><i></i></div>` + profileHTML(user(uid), profCache.get(uid), { full: true });
  box.scrollTop = 0; box.style.transform = '';
  pf.hidden = false; pf.classList.remove('ps-open'); void pf.offsetWidth; pf.classList.add('ps-open');
  loadProfile(uid).then(d => { if (!pf.hidden && d && box.querySelector(`[data-pc="${CSS.escape(uid)}"]`)) { const s = box.scrollTop; box.innerHTML = `<div class="ps-grab" aria-hidden="true"><i></i></div>` + profileHTML(user(uid), d, { full: true }); box.scrollTop = s; } });
}
function closePSheet() {
  const pf = $('#pfull'); if (pf.hidden) return;
  if (!pf.classList.contains('sheet19')) { pf.hidden = true; return; }
  pf.classList.add('ps-out'); pf.classList.remove('ps-open');
  setTimeout(() => { pf.hidden = true; pf.classList.remove('ps-out', 'sheet19'); pf.querySelector('.pfull-box').style.transform = ''; }, 260);
}
// Sur téléphone, tout ce qui ouvrait la petite carte ou le profil complet ouvre la feuille
const _showCard19 = showCard;
showCard = function (u, anchor) { if (mobile()) return openPSheet(u.id); return _showCard19(u, anchor); };
const _openFull19 = openFullProfile;
openFullProfile = function (uid) { if (mobile()) return openPSheet(uid); $('#pfull').classList.remove('sheet19'); return _openFull19(uid); };
// En-tête d'une conversation privée : toucher l'avatar ou le nom ouvre le profil
document.addEventListener('click', e => {
  if (!e.target.closest('#chan-av,#chan-title')) return;
  const c = channel(); if (c?.type !== 'dm' || c.group) return;
  e.stopImmediatePropagation(); openUserProfile(dmOther(c).id);
}, true);
// Fermer : fond, croix, ou glisser vers le bas
$('#pfull').addEventListener('click', e => {
  if (!$('#pfull').classList.contains('sheet19')) return;
  if (e.target === $('#pfull') || e.target.closest('[data-pc-close]')) { e.stopImmediatePropagation(); closePSheet(); }
}, true);
(() => {
  let y0 = null, dy = 0, startTop = 0, drag = false;
  const box = () => $('#pfull .pfull-box');
  $('#pfull').addEventListener('touchstart', e => {
    if (!$('#pfull').classList.contains('sheet19')) return;
    startTop = box().scrollTop; y0 = e.touches[0].clientY; dy = 0; drag = false;
  }, { passive: true });
  $('#pfull').addEventListener('touchmove', e => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (!drag && dy > 8 && startTop <= 0 && box().scrollTop <= 0) drag = true;
    if (drag) { box().style.transform = `translateY(${Math.max(0, dy)}px)`; $('#pfull').style.setProperty('--ps-fade', Math.max(0.15, 1 - dy / 500).toFixed(2)); }
  }, { passive: true });
  const end = () => {
    if (y0 === null) return; y0 = null; $('#pfull').style.removeProperty('--ps-fade');
    if (!drag) return; drag = false;
    if (dy > 120) closePSheet(); else { const b = box(); b.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1)'; b.style.transform = ''; setTimeout(() => (b.style.transition = ''), 260); }
  };
  $('#pfull').addEventListener('touchend', end); $('#pfull').addEventListener('touchcancel', end);
})();
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#pfull').classList.contains('sheet19')) closePSheet(); }, true);

// ================================================================ Onglet Profil (ta page)
document.body.insertAdjacentHTML('beforeend', '<section id="ptab" hidden aria-label="Ton profil"></section>');
function renderPTab() {
  const me = user(st.me), pr = st.profile || {}, mine = storiesOf(st.me), d = profCache.get(st.me);
  const note = pr.customStatus || pr.statusEmoji ? `${pr.statusEmoji ? emojiHTML(pr.statusEmoji) + ' ' : ''}${esc(pr.customStatus || '')}` : '';
  const hl = d?.highlights || [], close = fgroup('close');
  $('#ptab').innerHTML = `<div class="pt-scroll">
    <div class="pt-banner ${me.banner ? 'img' : ''}" style="${bannerStyle(me)}">
      <button class="pt-gear" data-pt="settings" aria-label="Paramètres">${V9.gear}</button></div>
    <div class="pt-id">
      <button class="pt-av ${mine.length ? (mine.some(x => !x.seen) ? 'story' : 'story seen') : ''}" data-pt="${mine.length ? 'story' : 'camera'}" aria-label="${mine.length ? 'Voir ta story' : 'Créer une story'}">${avatarNU(me, true)}${mine.length ? '' : `<i class="pt-plus">${V9.plus}</i>`}</button>
      <button class="pt-note ${note ? '' : 'empty'}" data-pt="note">${note || 'Ta note…'}</button>
    </div>
    <div class="pt-names"><h2>${esc(me.name)}</h2><small>${esc(me.pronouns || '')}${me.pronouns ? ' · ' : ''}${st.friends.length} pote${st.friends.length > 1 ? 's' : ''}</small></div>
    ${me.about ? `<p class="pt-about">${esc(me.about)}</p>` : '<button class="pt-about empty" data-pt="edit">Ajoute une description à ton profil…</button>'}
    <div class="pt-btns"><button class="primary" data-pt="edit">${V9.edit}<span>Modifier le profil</span></button><button class="pill-btn" data-pt="memories">${V9.memo}<span>Souvenirs</span></button></div>
    <div class="pt-sec"><h5>Tes stories <small>${mine.length ? `${mine.length} en ligne · elles disparaissent après 24 h` : 'aucune en ce moment'}</small></h5>
      <div class="pt-row" data-noswipe>
        <button class="pt-new" data-pt="camera"><span>${V9.camera}</span><small>Nouvelle</small></button>
        ${mine.map(x => `<button class="pt-st ${x.audience ? 'aud' : ''}" data-pt-story="${esc(x.id)}" style="${x.audience ? `--fc:${esc(fgroup(x.audience)?.color || '#3FB27F')}` : ''}">${x.kind === 'video' ? `<video src="${esc(x.url)}#t=0.1" muted playsinline preload="metadata"></video>` : `<img src="${esc(x.url)}" alt="" loading="lazy">`}
          <small>${esc(storyLeft(x))}${x.audience ? ` · ${esc(fgroup(x.audience)?.name || '')}` : ''}</small></button>`).join('')}
      </div></div>
    ${hl.length ? `<div class="pt-sec"><h5>À la une</h5><div class="pt-row" data-noswipe>${hl.map(h => `<button class="pc-hli" data-pt-hl="${esc(h.id)}">${hlCoverHTML(h)}<span>${esc(h.title)}</span></button>`).join('')}</div></div>` : ''}
    <div class="pt-sec"><h5>Tes potes</h5>
      <div class="sh-list">
        <button class="sh-item" data-pt="friends"><span class="sh-ico">${V9.people}</span><b>Tous tes potes</b><small>${st.friends.length} · ${st.friends.filter(u => user(u).status !== 'offline').length} en ligne</small></button>
        <button class="sh-item" data-pt="close"><span class="sh-ico pt-star">${V9.star}</span><b>Amis proches</b><small>${close?.members.length || 0} pote${(close?.members.length || 0) > 1 ? 's' : ''} · pour tes stories privées</small></button>
        <button class="sh-item" data-pt="groups"><span class="sh-ico">${V9.tag}</span><b>Catégories d'amis</b><small>${Math.max(0, fgroups().length - 1)} catégorie${fgroups().length - 1 > 1 ? 's' : ''} perso</small></button>
      </div></div>
    <p class="pt-foot">Parlotte ${esc(window.PARLOTTE_VERSION || '')}</p></div>`;
}
const storyLeft = x => { const h = Math.max(0, (Date.parse(x.expires) - Date.now()) / 3600e3); return h >= 1 ? `encore ${Math.floor(h)} h` : `encore ${Math.max(1, Math.round(h * 60))} min`; };
function openPTab(dir) {
  const p = $('#ptab'); if (!p.hidden) return;
  renderPTab(); p.hidden = false; document.body.classList.add('ptab-open');
  renderNav(); loadProfile(st.me).then(() => !p.hidden && renderPTab());
  if (dir) playIn([p], dir);
}
function closePTab() { const p = $('#ptab'); if (p.hidden) return; p.hidden = true; document.body.classList.remove('ptab-open'); renderNav(); }
function railOn() { $('#rail').querySelectorAll('.rail-btn[data-space]').forEach(b => { b.classList.remove('on'); b.setAttribute('aria-current', 'false'); }); }
const _renderNav19 = renderNav;
renderNav = function () {
  _renderNav19();
  if (document.body.classList.contains('ptab-open')) railOn();
  const pot = $('#rail [data-space="potes"] b'); if (pot && pot.textContent !== 'Messages') pot.textContent = 'Messages';
  meLabel();
};
function meLabel() {
  const me = $('#rail #me'); if (!me) return;
  me.classList.toggle('on', document.body.classList.contains('ptab-open'));
  if (!me.querySelector('.me-lbl')) me.insertAdjacentHTML('beforeend', '<b class="me-lbl">Profil</b>');
}
const _renderMe19 = renderMe;
renderMe = function () { _renderMe19(); meLabel(); };
$('#ptab').addEventListener('click', e => {
  const a = e.target.closest('[data-pt]'), s = e.target.closest('[data-pt-story]'), h = e.target.closest('[data-pt-hl]');
  if (s) return openStoryViewer(st.me, s.dataset.ptStory);
  if (h) { const x = profCache.get(st.me)?.highlights?.find(y => y.id === h.dataset.ptHl); return x && openHighlight(st.me, x); }
  if (!a) return;
  const k = a.dataset.pt;
  if (k === 'settings') return openSettings();
  if (k === 'edit') return openProfile();
  if (k === 'note') return openCustomStatus();
  if (k === 'memories') return openMemories();
  if (k === 'camera') { camTarget = null; return openCamera(); }
  if (k === 'story') return openStoryViewer(st.me);
  if (k === 'friends') { closePTab(); st.view.friendsOpen = true; st.view.tab = 'all'; return openChannel('@me', null); }
  if (k === 'close') return editFriendGroup('close');
  if (k === 'groups') { setTab = 'friends'; setPhonePane = true; openSettings(); const w = $('#settings-body .set-wrap'); w?.classList.add('pane-open'); }
});
// L'avatar de la barre du bas devient l'onglet Profil (téléphone)
$('#rail').addEventListener('click', e => {
  if (!mobile()) return;
  if (e.target.closest('#me')) { e.stopImmediatePropagation(); e.preventDefault(); return goTab(3); }
  const b = e.target.closest('[data-space]');
  if (b && !_railClick.on) { const to = TABS.indexOf(b.dataset.space), from = curTab(); if (to !== from) { closePTab(); setTimeout(() => playIn(tabLayers(to), to > from ? 'right' : 'left'), 0); } else closePTab(); }
}, true);
const _openChannel19 = openChannel;
openChannel = function (...a) { if (!$('#ptab').hidden && !openChannel._keepP) closePTab(); return _openChannel19.apply(this, a); };
const _renderSide19p = renderSide;
renderSide = function () { _renderSide19p(); if (!$('#ptab').hidden) { /* les badges restent à jour derrière */ } };
// Le profil reste à jour (note, stories, potes)
const _handle19p = handle;
handle = function (m) { _handle19p(m); if (!$('#ptab').hidden && /^(profile|story|storyRemoved|storyPosted|presence|friends|refresh|bootstrap)$/.test(m.t)) renderPTab(); };

// ================================================================ Glisser entre les onglets
const TABS = ['potes', 'servers', 'activity', 'profile'];
const curTab = () => (!$('#ptab').hidden ? 3 : TABS.indexOf(space()));
const tabLayers = i => (i === 3 ? [$('#ptab')] : [...document.querySelectorAll('#app > :not(#rail):not([hidden])')]);
function goTab(i, dir) {
  const from = curTab(); if (i === from || i < 0 || i > 3) return;
  dir = dir || (i > from ? 'right' : 'left');
  if (i === 3) return openPTab(dir);
  closePTab();
  const b = $(`#rail [data-space="${TABS[i]}"]`);
  _railClick(b);
  playIn(tabLayers(i), dir);
}
// clic « normal » sur un onglet (sans notre interception)
function _railClick(b) { if (!b) return; _railClick.on = true; try { b.dispatchEvent(new MouseEvent('click', { bubbles: true })); } finally { _railClick.on = false; } }
function playIn(els, dir) {
  for (const el of els) { if (!el) continue; el.classList.remove('tab-in-left', 'tab-in-right'); void el.offsetWidth; el.classList.add('tab-in-' + dir); setTimeout(() => el.classList.remove('tab-in-' + dir), 380); }
}
(() => {
  let x0 = null, y0 = 0, dx = 0, mode = null, els = [], from = 0, t0 = 0;
  const ok = e => mobile() && !document.body.classList.contains('has-chan') && $('#sheet').hidden && $('#pfull').hidden && !document.querySelector('dialog[open]')
    && !document.body.classList.contains('story-open') && !document.body.classList.contains('drawer-open') && !(typeof drawerOK === 'function' && drawerOK())
    && !e.target.closest('[data-noswipe],.dispo-row,.chips,#chan-chips,input,textarea,.pt-row,.fr-tabs,.fsr-chips,#rail,.srv-cards-row,.hscroll');
  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !ok(e)) { x0 = null; return; }
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null; from = curTab(); t0 = Date.now();
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (x0 === null) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!mode) {
      if (Math.abs(mx) < 12 && Math.abs(my) < 12) return;
      mode = Math.abs(mx) > Math.abs(my) * 1.4 ? 'h' : 'v';
      if (mode === 'h') { els = tabLayers(from); els.forEach(el => (el.style.transition = 'none')); document.body.classList.add('tab-drag'); }
    }
    if (mode !== 'h') return;
    // au bout de la rangée, ça résiste (comme un élastique)
    dx = (from === 0 && mx > 0) || (from === 3 && mx < 0) ? mx / 4 : mx;
    const w = innerWidth;
    els.forEach(el => { el.style.transform = `translateX(${dx}px)`; el.style.opacity = String(1 - Math.min(0.5, Math.abs(dx) / w)); });
  }, { passive: true });
  const end = () => {
    if (x0 === null) return; x0 = null;
    if (mode !== 'h') return;
    document.body.classList.remove('tab-drag');
    const w = innerWidth, fast = Math.abs(dx) / Math.max(1, Date.now() - t0) > 0.5;
    const to = (Math.abs(dx) > w * 0.28 || (fast && Math.abs(dx) > 40)) ? from + (dx < 0 ? 1 : -1) : from;
    if (to === from || to < 0 || to > 3) {
      els.forEach(el => { el.style.transition = 'transform .28s cubic-bezier(.2,.9,.3,1), opacity .28s'; el.style.transform = ''; el.style.opacity = ''; });
      setTimeout(() => els.forEach(el => (el.style.transition = '')), 300); return;
    }
    const out = dx < 0 ? -w : w;
    els.forEach(el => { el.style.transition = 'transform .17s ease-in, opacity .17s'; el.style.transform = `translateX(${out}px)`; el.style.opacity = '0'; });
    navigator.vibrate?.(6);
    setTimeout(() => {
      els.forEach(el => { el.style.transition = ''; el.style.transform = ''; el.style.opacity = ''; });
      goTab(to, to > from ? 'right' : 'left');
    }, 160);
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
})();

// ================================================================ Catégories de salons : fines, et sans en-têtes imposés
const _renderSide19c = renderSide;
renderSide = function () {
  _renderSide19c();
  const s = !isSpecial(st.view.server) && server(); if (!s) return;
  const list = $('#side-list'), manage = sp(s, P.MANAGE_CHANNELS), cats = s.categories || [];
  if (!cats.length) { // plus de « Salons textuels / Salons vocaux » : juste les salons, dans l'ordre
    const ev = list.querySelector('.ev-mini')?.outerHTML || '';
    list.innerHTML = ev + s.channels.map(c => chanRowHTML(s, c)).join('') + (s.channels.length ? '' : '<p class="small pad">Aucun salon pour l\'instant.</p>');
  } else {
    // catégories vides : cachées pour les membres, discrètes pour ceux qui gèrent
    list.querySelectorAll('.cat18').forEach(h => {
      const empty = !s.channels.some(c => c.category === h.dataset.cat);
      if (!empty) return;
      h.nextElementSibling?.classList.contains('cat-empty') && h.nextElementSibling.remove();
      if (!manage) h.remove(); else h.classList.add('empty');
    });
  }
  list.querySelector('.cat-new')?.remove();
  if (manage) list.insertAdjacentHTML('beforeend', `<div class="cat-tools"><button class="cat-new" data-chan-new>${V9.hash}<span>Salon</span></button><button class="cat-new" data-cat-new>${V9.tag}<span>Catégorie</span></button></div>`);
};
document.addEventListener('click', e => { if (e.target.closest('[data-chan-new]')) { e.stopPropagation(); newChannelSheet(null); } });

// ================================================================ Stories : chargement doux, préchargement, 24 h
const _showStory19 = showStory;
showStory = function (i) {
  _showStory19(i);
  const x = viewer.list[i]; if (!x) return;
  const sv = $('#sview'), media = $('#sview-media'), img = media.querySelector('img.s-main'), v = media.querySelector('video');
  let ready = false;
  const go = () => {
    if (ready || viewer.list[viewer.i]?.id !== x.id) return; ready = true;
    sv.classList.remove('s-loading'); viewer.loadWait = false;
    if (!viewer.paused) { viewer.start = performance.now(); viewer.elapsed = 0; }
  };
  sv.classList.add('s-loading'); viewer.loadWait = true;
  if (img) { if (img.complete && img.naturalWidth) go(); else { img.decode?.().then(go, go); img.addEventListener('load', go, { once: true }); img.addEventListener('error', go, { once: true }); } }
  else if (v) { if (v.readyState >= 3) go(); else { v.addEventListener('playing', go, { once: true }); v.addEventListener('error', go, { once: true }); } }
  else go();
  setTimeout(go, 8000);
  // la suivante se charge pendant qu'on regarde celle-ci
  const n = viewer.list[i + 1];
  if (n) { if (n.kind === 'video') { const p = document.createElement('video'); p.preload = 'auto'; p.muted = true; p.src = n.url; } else new Image().src = n.url; }
};
// pendant le chargement, la barre de progression ne bouge pas
let keepOn = false;
const _tick19 = tick;
tick = function () {
  _tick19();
  if (keepOn) return; keepOn = true;
  const keep = () => { if ($('#sview').hidden) { keepOn = false; viewer.loadWait = false; return; } if (viewer.loadWait) { viewer.start = performance.now(); viewer.elapsed = 0; } requestAnimationFrame(keep); };
  requestAnimationFrame(keep);
};
// Les stories de plus de 24 h disparaissent même si l'appli reste ouverte
setInterval(() => {
  const before = (st.stories || []).length;
  st.stories = (st.stories || []).filter(storyLive);
  if (st.stories.length !== before) {
    if (viewer.list.length && !viewer.list.every(storyLive)) { const cur = viewer.list[viewer.i]; if (cur && !storyLive(cur)) closeViewerSoft(); }
    if (space() === 'potes') renderSide();
    if (!$('#ptab').hidden) renderPTab();
  }
}, 30e3);

// ================================================================ Story réservée à une catégorie d'amis
let storyAud = null;
function audLabel() { const g = storyAud && fgroup(storyAud); return g ? (g.id === 'close' ? '⭐ Amis proches' : g.name) : 'Tous mes potes'; }
const _openEditor19 = openEditor;
openEditor = function (...a) {
  _openEditor19.apply(this, a);
  storyAud = null;
  const sh = $('#sedit-share'); if (!sh || $('#sedit-aud')) return renderAud();
  sh.insertAdjacentHTML('beforebegin', `<button type="button" id="sedit-aud" class="sedit-aud" aria-label="Qui voit ta story">${V9.people}<span></span>${V9.down}</button>`);
  renderAud();
};
function renderAud() { const b = $('#sedit-aud'); if (!b) return; b.querySelector('span').textContent = audLabel(); b.classList.toggle('on', !!storyAud); b.style.setProperty('--fc', storyAud ? fgroup(storyAud)?.color || '#3FB27F' : ''); }
document.addEventListener('click', e => {
  if (e.target.closest('#sedit-aud')) {
    const opts = [[null, 'Tous mes potes', `${st.friends.length} pote${st.friends.length > 1 ? 's' : ''}`, '#8E6CFF'], ...fgroups().map(g => [g.id, g.id === 'close' ? 'Amis proches' : g.name, `${g.members.length} pote${g.members.length > 1 ? 's' : ''}`, g.color])];
    $('#sedit-input').innerHTML = `<div class="aud-pick"><h3>Qui voit ta story ?</h3>${opts.map(([id, l, sub, c]) => `<button type="button" class="aud-opt ${storyAud === id ? 'on' : ''}" data-aud="${id || ''}" style="--fc:${esc(c)}"><span class="aud-ic">${id === 'close' ? V9.star : id ? V9.tag : V9.people}</span><span><b>${esc(l)}</b><small>${sub}</small></span><i>${V9.check}</i></button>`).join('')}
      <button type="button" class="aud-new" data-aud-new>${V9.plus}<span>Gérer mes catégories</span></button></div>`;
    $('#sedit-input').hidden = false; return;
  }
  const o = e.target.closest('[data-aud]');
  if (o) { const g = o.dataset.aud || null; if (g && !fgroup(g)?.members.length) toast('Personne dans cette catégorie pour l\'instant', true); storyAud = g; $('#sedit-input').hidden = true; $('#sedit-input').innerHTML = ''; return renderAud(); }
  if (e.target.closest('[data-aud-new]')) { $('#sedit-input').hidden = true; setTab = 'friends'; openSettings(); }
});
const _request19 = request;
request = function (t, p = {}) {
  if (t === 'postStory' && storyAud) p = { ...p, audience: storyAud };
  return _request19(t, p).then(r => { if (t === 'postStory' && storyAud) { const g = fgroup(storyAud); setTimeout(() => toast(`Story partagée avec ${g?.id === 'close' ? 'tes amis proches ⭐' : g ? '« ' + g.name + ' »' : 'tes potes'}`), 30); storyAud = null; } return r; });
};
// anneau vert « amis proches » chez ceux qui la voient
const _renderPotes19 = renderPotesList;
renderPotesList = function (...a) {
  const r = _renderPotes19.apply(this, a);
  document.querySelectorAll('.dispo[data-dm-user]').forEach(b => {
    const uid = b.dataset.dmUser, cl = storiesOf(uid).some(x => x.close && !x.seen);
    b.querySelector('.ring')?.classList.toggle('close', cl);
  });
  return r;
};

// ================================================================ Paramètres → Apparence : écran de l'iPhone
function fillScreenSetting() {
  if (setTab !== 'appearance') return;
  const pane = $('#settings-body .set-pane'); if (!pane || pane.querySelector('.scr-set')) return;
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIOS && !matchMedia('(pointer:coarse)').matches) return;
  const m = typeof iosFitMode === 'function' ? iosFitMode() : 'auto';
  const opts = [['auto', 'Automatique', 'Le réglage normal (conseillé)'], ['ext', 'Descendre jusqu\'en bas', 'Si une bande vide reste sous la barre du bas'], ['screen', 'Hauteur de l\'écran', 'Autre essai si la bande est toujours là']];
  pane.insertAdjacentHTML('beforeend', `<h4>Écran du téléphone</h4><div class="scr-set">
    <p class="small">Sur iPhone, si une bande vide reste en bas : supprime l'icône Parlotte de l'écran d'accueil puis rajoute-la (Partager → Sur l'écran d'accueil). iOS ne relit le réglage de l'écran qu'à ce moment-là.</p>
    <details class="scr-diag"><summary>${V9.phone} Diagnostic (à m'envoyer en capture)</summary><pre id="scr-diag"></pre></details></div>`);
  diag();
}
function diag() {
  const p = $('#scr-diag'); if (!p) return;
  const probe = k => { const d = document.createElement('div'); d.style.cssText = `position:fixed;top:0;left:0;width:1px;visibility:hidden;height:${k}`; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; };
  const env = k => { const d = document.createElement('div'); d.style.cssText = `position:fixed;visibility:hidden;padding-top:env(safe-area-inset-${k})`; document.body.appendChild(d); const h = parseFloat(getComputedStyle(d).paddingTop); d.remove(); return h; };
  const vv = window.visualViewport, r = $('#rail')?.getBoundingClientRect();
  p.textContent = [
    `iOS ${(/OS (\d+[_.]\d+)/.exec(navigator.userAgent) || [, '?'])[1].replace('_', '.')} · ${matchMedia('(display-mode: standalone)').matches || navigator.standalone ? 'appli écran d\'accueil' : 'navigateur'}`,
    `écran ${screen.width}×${screen.height} · fenêtre ${innerWidth}×${innerHeight} · visible ${vv ? Math.round(vv.height) : '?'}`,
    `100vh=${probe('100vh')} 100dvh=${probe('100dvh')} 100lvh=${probe('100lvh')} 100%=${document.documentElement.clientHeight}`,
    `encoche haut=${env('top')} bas=${env('bottom')}`,
    `appli ${Math.round($('#app').getBoundingClientRect().height)} · barre du bas ${r ? Math.round(r.top) + '→' + Math.round(r.bottom) : '?'}`,
    `mode ${typeof iosFitMode === 'function' ? iosFitMode() : '?'} · ${[...document.documentElement.classList].join(' ')}`,
  ].join('\n');
}
$('#settings-dlg').addEventListener('change', e => {
  if (e.target.name !== 'scr') return;
  try { localStorage.setItem('parlotte-ios-fit', e.target.value); } catch {}
  window.refitScreen?.(); setTimeout(diag, 200);
  toast(e.target.value === 'auto' ? 'Écran : automatique' : 'Essaie maintenant : la barre du bas touche-t-elle le bord ?');
});
