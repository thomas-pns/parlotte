'use strict';
// Parlotte — les deux espaces : 💬 Potes (façon messages privés) et 🏠 Serveurs (communautés),
// plus 🔔 Activité. Navigation, liste des conversations, bulles, « Vu », groupes, cartes des serveurs.

// ---------------------------------------------------------------- Icônes (traits, pas d'emoji)
const svg = (d, w = 22, extra = '') => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
const ICON = {
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/>', 24),
  home: svg('<path d="M3 11l9-7 9 7v9h-6v-6H9v6H3z"/>', 24),
  heart: svg('<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0112 6.6 5.2 5.2 0 0121.3 12C19 16.6 12 21 12 21z"/>', 24),
  heartFill: svg('<path d="M12 21s-7-4.4-9.3-9A5.2 5.2 0 0112 6.6 5.2 5.2 0 0121.3 12C19 16.6 12 21 12 21z" fill="currentColor"/>', 24),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>', 20),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>', 20),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/>', 22),
  pin: svg('<path d="M9 4h6l-1 6 4 3H6l4-3zM12 13v8"/>', 20),
  thread: svg('<path d="M5 6h14M5 12h10M5 18h6"/>', 20),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>', 20),
  pen: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/>', 18),
  group: svg('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20a6 6 0 0112 0M10 20a6 6 0 0112 0"/>', 18),
  addUser: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M19 8v6M16 11h6"/>', 18),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>', 18),
  game: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01"/>', 20),
};

// ---------------------------------------------------------------- Espace courant et disposition
const space = () => st.view.server === '@me' ? 'potes' : st.view.server === '@activity' ? 'activity' : 'servers';
const mobile = () => matchMedia('(max-width:700px)').matches;
function layoutSpace() {
  const sp_ = space(), b = document.body;
  b.classList.toggle('space-potes', sp_ === 'potes');
  b.classList.toggle('space-servers', sp_ === 'servers');
  b.classList.toggle('space-activity', sp_ === 'activity');
  b.classList.toggle('has-chan', !!st.view.channel || (sp_ === 'potes' && !!st.view.friendsOpen));
  b.classList.toggle('no-server', sp_ === 'servers' && !server());
}
function goBack() {
  if (space() === 'potes') { st.view.friendsOpen = false; openChannel('@me', null); }
  else if (space() === 'servers') openChannel('@servers', null);
}
const PALETTE = ['#8E6CFF', '#3FB27F', '#4FA3D1', '#F5C04A', '#E05A8A', '#FF8A5B', '#5B8CFF', '#C77DFF'];
function serverColor(s) { if (s.color) return s.color; let h = 0; for (const ch of s.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
const lightColor = c => { const m = /^#?([0-9a-f]{6})$/i.exec(c || ''); if (!m) return false; const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 170; };
// Tuile d'un serveur : son icône si elle existe, sinon ses initiales sur sa couleur
function srvTileHTML(s, cls = '') {
  const col = serverColor(s);
  return s.icon ? `<span class="srv-tile img ${cls}" style="background-image:url('${esc(s.icon)}')" aria-hidden="true"></span>`
    : `<span class="srv-tile ${cls}" style="background:${col};color:${lightColor(col) ? '#14121A' : '#fff'}">${initials(s.name)}</span>`;
}
const initials = name => esc(name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase());
function ago(at) {
  const d = (Date.now() - new Date(at)) / 1000;
  if (d < 60) return 'à l\'instant';
  if (d < 3600) return Math.floor(d / 60) + ' min';
  if (d < 86400 && sameDay(at, Date.now())) return Math.floor(d / 3600) + ' h';
  if (sameDay(at, Date.now() - 864e5)) return 'hier';
  return new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
const previewOf = m => ({ a: m.author_id, at: m.timestamp, x: (m.content || (m.attachments?.[0]?.voice ? '🎙️ Message vocal' : m.attachments?.length
  ? (/^image\//.test(m.attachments[0].content_type) ? '📷 Photo' : /^video\//.test(m.attachments[0].content_type) ? '🎬 Vidéo' : '📎 Fichier') : m.poll ? '📊 Sondage' : '')).replace(/\s+/g, ' ').slice(0, 90) });
const inVoice = uid => Object.entries(st.voice || {}).find(([, ms]) => ms.some(m => m.id === uid))?.[0] || null;

// ---------------------------------------------------------------- Barre de navigation (PC : à gauche, téléphone : en bas)
function renderNav() {
  const rail = $('#rail');
  if (!rail.dataset.ready) {
    rail.dataset.ready = '1';
    $('#rail-top').outerHTML = `<div class="logo" aria-hidden="true">p<span>.</span></div>
      <button class="rail-btn" data-space="potes" data-srv="@me" aria-label="Potes">${ICON.chat}<b>Potes</b><span class="rb-badge" hidden></span></button>
      <button class="rail-btn" data-space="servers" aria-label="Serveurs">${ICON.home}<b>Serveurs</b><span class="rb-badge" hidden></span></button>
      <button class="rail-btn" data-space="activity" aria-label="Activité">${ICON.heart}<b>Activité</b><span class="rb-badge" hidden></span></button>`;
  }
  const sp_ = space();
  const dmUnread = unreadIn(st.dms) + st.incoming.length;
  const srvUnread = st.servers.reduce((a, s) => a + unreadIn(s.channels), 0);
  const actUnseen = (st.activity || []).filter(a => !a.seen).length;
  for (const [k, n] of [['potes', dmUnread], ['servers', srvUnread], ['activity', actUnseen]]) {
    const b = rail.querySelector(`[data-space="${k}"]`);
    b.classList.toggle('on', sp_ === k);
    b.setAttribute('aria-current', sp_ === k ? 'page' : 'false');
    const badge = b.querySelector('.rb-badge'); badge.hidden = !n; badge.textContent = n > 99 ? '99+' : n;
  }
  b_activityIcon(rail, sp_ === 'activity');
  renderServerCards();
}
function b_activityIcon(rail, on) {
  const b = rail.querySelector('[data-space="activity"]'), want = on ? 'fill' : 'line';
  if (b.dataset.icon === want) return;
  b.dataset.icon = want; b.querySelector('svg').outerHTML = on ? ICON.heartFill : ICON.heart;
}
$('#rail').addEventListener('click', e => {
  const b = e.target.closest('[data-space]'); if (!b) return;
  const k = b.dataset.space;
  if (k === 'potes') { st.view.friendsOpen = false; const last = st.dms.find(c => c.id === st.lastDm); openChannel('@me', !mobile() && last ? last.id : null); }
  if (k === 'activity') { openChannel('@activity', null); setTimeout(() => request('activitySeen').catch(() => {}), 1500); }
  if (k === 'servers') {
    // Petit écran (ou téléphone) : un 2e clic sur « Serveurs » revient à la liste des serveurs
    if (mobile() || (matchMedia('(max-width:1100px)').matches && space() === 'servers' && server())) return openChannel('@servers', null);
    const s = st.servers.find(x => x.id === st.lastServer) || st.servers[0];
    if (!s) return openChannel('@servers', null);
    openChannel(s.id, s.channels.some(c => c.id === st.lastChanOf?.[s.id]) ? st.lastChanOf[s.id] : firstText(s));
  }
});

// ---------------------------------------------------------------- Cartes des serveurs
function serverLive(s) {
  const voiceIds = s.channels.filter(c => c.type === 'voice').map(c => c.id);
  return voiceIds.reduce((a, id) => a + (st.voice[id] || []).length, 0);
}
function renderServerCards() {
  const box = $('#servers');
  const cards = st.servers.map(s => {
    const live = serverLive(s), unread = unreadIn(s.channels), color = serverColor(s);
    const online = s.members.filter(m => user(m).status !== 'offline').length;
    const sub = live ? `<i class="live-dot"></i>${live} en vocal` : unread ? `${unread} nouveau${unread > 1 ? 'x' : ''}` : `${online} en ligne · ${s.members.length} membre${s.members.length > 1 ? 's' : ''}`;
    return `<button class="srv-card ${s.id === st.view.server ? 'on' : ''}" data-srv="${s.id}" aria-label="${esc(s.name)}">
      ${srvTileHTML(s)}
      <span class="srv-txt"><b>${esc(s.name)}</b><small class="${live ? 'lv' : ''}">${sub}</small></span>
      ${unread && s.id !== st.view.server ? `<span class="srv-badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>`;
  }).join('');
  box.innerHTML = `<header class="col-head"><h1>Serveurs</h1><span class="col-acts">
      <button id="join-server" class="pill-btn" title="Rejoindre avec un code">${ICON.key}<span>Code</span></button>
      <button id="add-server" class="round-btn accent" title="Créer un serveur" aria-label="Créer un serveur">${ICON.plus}</button></span></header>
    <div class="srv-cards">${cards || '<p class="small pad">Aucun serveur pour l\'instant. Crée le tien ou rejoins celui d\'un ami avec son code.</p>'}</div>`;
}
function noServerHTML() {
  return st.servers.length ? `<div class="empty-state big"><div class="es-ico">${ICON.home}</div><h2>Choisis un serveur</h2><p>Tes communautés sont à gauche.</p></div>`
    : `<div class="empty-state big"><div class="es-ico">${ICON.home}</div><h2>Pas encore de serveur</h2><p>Un serveur, c'est un QG pour ta bande, ta famille ou ton club : des salons, du vocal, des sondages…</p>
      <div class="es-acts"><button class="primary" data-es="create">Créer un serveur</button><button class="ghost-btn" data-es="join">J'ai un code</button></div></div>`;
}

// ---------------------------------------------------------------- Liste des Potes
function renderPotesList(head, list) {
  const f = st.view.pfilter || 'messages';
  head.innerHTML = `<div class="col-head"><h1>Messages</h1><span class="col-acts">
    <button id="potes-friends" class="round-btn" title="Tes potes et les demandes" aria-label="Tes potes">${ICON.users}</button>
    <button id="new-group" class="round-btn" title="Nouveau groupe" aria-label="Nouveau groupe">${ICON.group}</button>
    <button id="new-dm" class="round-btn" title="Nouveau message" aria-label="Nouveau message">${ICON.pen}</button></span></div>`;
  // Rangée « dispo » : ta note + les potes en ligne (bulle = statut perso, comme les notes)
  const pr = st.profile || {};
  const myNote = pr.customStatus || pr.statusEmoji ? `${pr.statusEmoji ? emojiHTML(pr.statusEmoji) + ' ' : ''}${esc(pr.customStatus || '')}` : '';
  const online = st.friends.map(user).filter(u => u.status !== 'offline')
    .sort((a, b) => (inVoice(b.id) ? 2 : b.activity ? 1 : 0) - (inVoice(a.id) ? 2 : a.activity ? 1 : 0));
  const dispo = `<div class="dispo-row" role="list">
    <button class="dispo me" id="my-note" role="listitem" title="Écrire une note (statut perso)">
      <span class="note ${myNote ? '' : 'empty'}">${myNote || 'Ta note…'}</span>
      <span class="ring none">${avatar(user(st.me))}</span><span class="dn">Toi</span></button>
    ${online.map(u => { const v = inVoice(u.id), note = u.customStatus || u.statusEmoji ? `${u.statusEmoji ? emojiHTML(u.statusEmoji) + ' ' : ''}${esc(u.customStatus || '')}` : '';
      return `<button class="dispo" role="listitem" data-dm-user="${esc(u.id)}" title="${esc(u.name)}">
        ${note ? `<span class="note">${note}</span>` : ''}
        <span class="ring ${v ? 'live' : 'none'}">${avatar(u, true)}</span>
        ${v ? '<span class="pill live">vocal</span>' : u.activity ? '<span class="pill game">en jeu</span>' : ''}
        <span class="dn">${esc(u.name)}</span></button>`; }).join('')}
    ${online.length ? '' : '<p class="small dispo-empty">Aucun pote en ligne.</p>'}</div>`;
  const nReq = st.incoming.length;
  const chips = `<div class="chips" role="tablist">${[['messages', 'Messages'], ['groups', 'Groupes'], ['requests', `Demandes${nReq ? ' · ' + nReq : ''}`]]
    .map(([k, l]) => `<button role="tab" data-pfilter="${k}" aria-selected="${f === k}" class="chip ${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let rows = '';
  if (f === 'requests') {
    rows = `<form class="add-friend" id="add-friend-side"><input id="friend-name-side" placeholder="Pseudo d'un pote à ajouter" maxlength="24" autocomplete="off" aria-label="Pseudo"><button class="primary" type="submit">Ajouter</button></form>`
      + st.incoming.map(id => { const u = user(id); return `<div class="conv req">${avatar(u, true)}<span class="cv-txt"><b>${esc(u.name)}</b><small>Veut être ton pote</small></span>
        <button class="mini-btn ok" data-accept="${esc(id)}">Accepter</button><button class="mini-btn" data-remove="${esc(id)}" aria-label="Refuser">✕</button></div>`; }).join('')
      + st.outgoing.map(id => { const u = user(id); return `<div class="conv req">${avatar(u)}<span class="cv-txt"><b>${esc(u.name)}</b><small>Demande envoyée</small></span>
        <button class="mini-btn" data-remove="${esc(id)}">Annuler</button></div>`; }).join('')
      + (!st.incoming.length && !st.outgoing.length ? '<p class="small pad">Aucune demande en attente.</p>' : '');
  } else {
    const convs = st.dms.filter(c => f !== 'groups' || c.group)
      .sort((a, b) => (st.lastByChannel[b.id] || b.created || '').localeCompare(st.lastByChannel[a.id] || a.created || ''));
    rows = convs.map(convRowHTML).join('') || `<p class="small pad">${f === 'groups' ? 'Pas encore de groupe. Crée-en un avec le bouton en haut.' : 'Aucune conversation. Écris à un pote depuis la rangée du haut ou le crayon.'}</p>`;
  }
  list.innerHTML = dispo + chips + `<div class="convs">${rows}</div>`;
}
function convAvatar(c) {
  if (!c.group) return avatar(dmOther(c), true);
  const others = c.members.filter(m => m !== st.me).slice(0, 2).map(user);
  return `<span class="stack">${others.map(u => avatar(u)).join('')}</span>`;
}
function convRowHTML(c) {
  const n = st.unread[c.id], p = st.previews?.[c.id], call = (st.voice[c.id] || []).length, inIt = vc.channel === c.id;
  const who = p ? (p.a === st.me ? 'Toi : ' : c.group && p.a !== 'system' ? user(p.a).name + ' : ' : '') : '';
  const line = call ? `<small class="lv"><i class="live-dot"></i>${inIt ? 'Tu es en appel' : `Appel en cours · ${call}`}</small>`
    : `<small>${p ? esc(who + p.x) + ' · ' + ago(p.at) : c.group ? `${c.members.length} membres` : 'Dis bonjour 👋'}</small>`;
  return `<button class="conv ${c.id === st.view.channel ? 'on' : ''} ${n ? 'unread' : ''} ${call ? 'calling' : ''}" data-chan-id="${c.id}">
    ${convAvatar(c)}<span class="cv-txt"><b>${esc(c.group ? groupName(c) : dmOther(c).name)}</b>${line}</span>
    ${call && !inIt ? `<span class="mini-btn live" data-joincall-c="${c.id}">Rejoindre</span>` : n ? '<span class="udot" aria-label="Non lu"></span>' : ''}</button>`;
}
$('#sidebar').addEventListener('click', e => {
  const pf = e.target.closest('[data-pfilter]'); if (pf) { st.view.pfilter = pf.dataset.pfilter; return renderSide(); }
  const du = e.target.closest('[data-dm-user]'); if (du) return act('openDM', { userId: du.dataset.dmUser });
  const jc = e.target.closest('[data-joincall-c]'); if (jc) { e.stopPropagation(); openChannel('@me', jc.dataset.joincallC); return joinVoice(jc.dataset.joincallC); }
  if (e.target.closest('#my-note')) return openCustomStatus();
  if (e.target.closest('#potes-friends')) { st.view.friendsOpen = true; return openChannel('@me', null); }
  if (e.target.closest('#new-group')) return openGroupDialog();
  if (e.target.closest('#new-dm')) return openNewDm();
  const t = e.target.closest('[data-accept],[data-remove]');
  if (t) {
    if (t.dataset.accept) act('friendAccept', { userId: t.dataset.accept });
    if (t.dataset.remove && confirm(`${st.friends.includes(t.dataset.remove) ? 'Retirer' : 'Supprimer la demande de'} ${user(t.dataset.remove).name} ?`)) act('friendRemove', { userId: t.dataset.remove });
  }
}, true);
$('#sidebar').addEventListener('submit', e => {
  if (e.target.id !== 'add-friend-side') return; e.preventDefault();
  const v = $('#friend-name-side').value.trim(); if (v) act('friendRequest', { username: v }).then(() => toast('Demande envoyée à ' + v));
});

// Nouveau message : choisir un pote
function openNewDm() {
  if (!st.friends.length) { st.view.pfilter = 'requests'; renderSide(); return toast('Ajoute d\'abord un pote avec son pseudo'); }
  $('#group-dlg').dataset.mode = 'dm';
  fillPickList(false); $('#group-dlg h3').textContent = 'Nouveau message'; $('#group-name').closest('label').hidden = true;
  $('#group-dlg .small').textContent = 'À qui veux-tu écrire ?'; $('#group-ok').hidden = true; $('#group-dlg').showModal();
}
function openGroupDialog() {
  if (st.friends.length < 2) return toast('Il faut au moins 2 potes pour créer un groupe', true);
  $('#group-dlg').dataset.mode = 'group';
  fillPickList(true); $('#group-dlg h3').textContent = 'Nouveau groupe'; $('#group-name').closest('label').hidden = false; $('#group-name').value = '';
  $('#group-dlg .small').textContent = 'Choisis au moins 2 potes (10 personnes max).'; $('#group-ok').hidden = false; $('#group-dlg').showModal();
}
function fillPickList(multi, exclude = []) {
  $('#group-friends').innerHTML = st.friends.filter(id => !exclude.includes(id)).map(user).sort((a, b) => a.name.localeCompare(b.name)).map(u => multi
    ? `<label class="pick">${avatar(u, true)}<span>${esc(u.name)}</span><input type="checkbox" value="${esc(u.id)}"></label>`
    : `<button type="button" class="pick" data-pick="${esc(u.id)}">${avatar(u, true)}<span>${esc(u.name)}</span></button>`).join('') || '<p class="small">Aucun pote à ajouter.</p>';
}
$('#group-friends').addEventListener('click', e => {
  const p = e.target.closest('[data-pick]'); if (!p) return;
  $('#group-dlg').close(); act('openDM', { userId: p.dataset.pick });
});
$('#group-dlg').addEventListener('close', () => {
  const d = $('#group-dlg'); if (d.returnValue !== 'ok') return;
  const ids = [...d.querySelectorAll('#group-friends input:checked')].map(i => i.value);
  if (d.dataset.mode === 'add') return act('addToGroup', { channelId: d.dataset.chan, userIds: ids });
  act('createGroup', { name: $('#group-name').value, members: ids });
});

// ---------------------------------------------------------------- En-tête d'une conversation
function chatHeadDM(c) {
  if (c.group) {
    $('#chan-av').innerHTML = convAvatar(c);
    $('#chan-title').textContent = groupName(c);
    const on = c.members.filter(m => m !== st.me && user(m).status !== 'offline').length;
    $('#chan-topic').textContent = `${c.members.length} membres${on ? ` · ${on} en ligne` : ''}`;
  } else {
    const o = dmOther(c);
    $('#chan-av').innerHTML = avatar(o, true);
    $('#chan-title').textContent = o.name;
    $('#chan-topic').innerHTML = o.status === 'offline' ? 'Hors ligne' : statusLine(o);
  }
}
$('#vcall').onclick = async () => {
  const cid = st.view.channel; if (!cid) return;
  if (vc.channel !== cid) await joinVoice(cid);
  if (vc.channel === cid && !vc.camera) toggleVideo('camera');
};

// ---------------------------------------------------------------- Bulles (messages privés et groupes)
function receiptHTML(c, list) {
  const mine = [...list].reverse().find(m => m.author_id === st.me); if (!mine || list[list.length - 1] !== mine) return '';
  const others = c.members.filter(m => m !== st.me), reads = c.reads || {};
  const seen = others.filter(u => (reads[u] || '') >= mine.timestamp);
  if (!seen.length) return '<div class="receipt">Envoyé</div>';
  if (!c.group) return '<div class="receipt seen">Vu</div>';
  return `<div class="receipt seen">${seen.length === others.length ? 'Vu par tout le monde' : 'Vu par ' + esc(seen.map(u => user(u).name).join(', '))}</div>`;
}
function bubblesHTML(c, list) {
  if (document.visibilityState === 'visible') setTimeout(() => sendReadReceipt(c.id), 0);
  const inCall = st.voice[c.id] || [];
  let html = inCall.length ? `<div class="callbar"><i class="live-dot"></i>Appel en cours ${inCall.map(m => `<span data-speaker="${esc(m.id)}" class="${speaking.has(m.id) ? 'speaking' : ''}">${avatar(user(m.id))}</span>`).join('')}${vc.channel === c.id ? '' : '<button class="mini-btn live" data-joincall>Rejoindre</button>'}</div>` : '';
  if (st.more[c.id]) html += '<button class="more" id="load-more">Charger les messages plus anciens</button>';
  else if (c.group) html += `<div class="b-intro">${convAvatar(c)}<h2>${esc(groupName(c))}</h2><p>Groupe créé par ${esc(user(c.owner).name)} · ${c.members.length} membres</p></div>`;
  else { const o = dmOther(c); html += `<div class="b-intro">${avatar(o)}<h2>${esc(o.name)}</h2><p>${st.friends.includes(o.id) ? 'Vous êtes potes sur Parlotte' : 'Conversation privée'}</p></div>`; }
  const real = m => m.author_id !== 'system';
  for (let i = 0; i < list.length; i++) {
    const m = list[i], prev = list[i - 1], next = list[i + 1];
    const gap = prev ? new Date(m.timestamp) - new Date(prev.timestamp) : Infinity;
    if (!prev || !sameDay(prev.timestamp, m.timestamp) || gap > 15 * 6e4) html += `<div class="btime">${dayLabel(m.timestamp)} ${time(m.timestamp)}</div>`;
    if (!real(m)) { html += `<div class="msg bsys" data-id="${m.id}"><span class="text">${format(m.content)}</span></div>`; continue; }
    if ((st.blocked || []).includes(m.author_id) && !st.revealed?.has(m.id)) {
      html += `<div class="msg blocked-msg" data-id="${m.id}"><div class="body">🚫 Message d'un utilisateur bloqué — <button class="link" data-reveal="${m.id}">Afficher</button></div></div>`; continue;
    }
    const same = (a, b) => a && b && real(a) && real(b) && a.author_id === b.author_id && sameDay(a.timestamp, b.timestamp) && Math.abs(new Date(b.timestamp) - new Date(a.timestamp)) < 5 * 6e4;
    const first = !same(prev, m) || !!m.reply_to, last = !same(m, next) || !!next?.reply_to;
    const u = user(m.author_id), mine = m.author_id === st.me;
    const ref = m.reply_to && list.find(x => x.id === m.reply_to);
    const big = m.content && /^(\s*(<:\w{2,32}:[0-9a-z]+>|\p{Extended_Pictographic}|‍|️)\s*){1,3}$/u.test(m.content);
    html += `<div class="msg b ${mine ? 'mine' : 'theirs'} ${first ? 'first' : ''} ${last ? 'last' : ''} ${(m.mentions || []).includes(st.me) ? 'mentioned' : ''}" data-id="${m.id}">
      ${mine ? '' : `<div class="bav">${last ? avatar(u) : ''}</div>`}
      <div class="bcol">
        ${c.group && !mine && first ? `<span class="bname" data-user="${esc(u.id)}" style="color:${esc(u.color)}">${esc(u.name)}</span>` : ''}
        ${m.story ? storyReplyHTML(m, mine) : ''}
        ${m.reply_to ? `<div class="breply" data-jump="${m.reply_to}">${ref ? `<b>${esc(ref.author_id === st.me ? 'Toi' : user(ref.author_id).name)}</b> ${esc((ref.content || 'pièce jointe').slice(0, 70))}` : '<i>Message supprimé</i>'}</div>` : ''}
        ${m.content ? `<div class="bubble ${big ? 'big' : ''}" title="${esc(time(m.timestamp))}"><div class="text ${big ? 'big-emoji' : ''}">${format(m.content)}</div>${m.edited ? '<span class="edited">modifié</span>' : ''}</div>` : ''}
        ${attachmentsHTML(m.attachments)}${m.poll ? pollHTML(m, c) : ''}${m.game && typeof gameHTML === 'function' ? gameHTML(m) : ''}
        ${Object.keys(m.reactions || {}).length ? `<div class="reacts">${Object.entries(m.reactions).map(([e, who]) =>
          `<button class="react ${who.includes(st.me) ? 'mine' : ''}" data-react="${esc(e)}" title="${esc(who.map(w => user(w).name).join(', '))}">${reactionHTML(e)}${who.length > 1 ? ' ' + who.length : ''}</button>`).join('')}</div>` : ''}
      </div>
      <div class="tools">
        <button data-act="react" title="Réagir" aria-label="Réagir">😀</button><button data-act="reply" title="Répondre" aria-label="Répondre">↩</button>
        <button data-act="copy" title="Copier" aria-label="Copier">📋</button>${mine ? '<button data-act="edit" title="Modifier" aria-label="Modifier">✏️</button><button data-act="del" title="Supprimer" aria-label="Supprimer">🗑️</button>' : ''}
      </div></div>`;
  }
  return html + receiptHTML(c, list);
}
// Double-clic (ou double-tap) sur une bulle : ❤️
function likeBubble(row) {
  const m = (st.msgs[st.view.channel] || []).find(x => x.id === row.dataset.id); if (!m || m.author_id === 'system') return;
  if (!(m.reactions?.['❤️'] || []).includes(st.me)) act('react', { messageId: m.id, emoji: '❤️' });
  const h = document.createElement('span'); h.className = 'heart-pop'; h.innerHTML = ICON.heartFill;
  row.querySelector('.bcol')?.append(h); setTimeout(() => h.remove(), 800);
}
$('#view').addEventListener('dblclick', e => {
  const row = e.target.closest('.msg.b'); if (!row || e.target.closest('a,button,.tools,input,textarea')) return;
  window.getSelection()?.removeAllRanges(); likeBubble(row);
});
let lastTap = { t: 0, id: null };
$('#view').addEventListener('touchend', e => {
  const row = e.target.closest('.msg.b'); if (!row || e.target.closest('a,button,.tools')) return;
  const now = Date.now();
  if (lastTap.id === row.dataset.id && now - lastTap.t < 320) { e.preventDefault(); likeBubble(row); lastTap = { t: 0, id: null }; }
  else lastTap = { t: now, id: row.dataset.id };
});
$('#view').addEventListener('click', e => { if (e.target.closest('[data-joincall]') && channel()?.type === 'dm') joinVoice(st.view.channel); });

// « Vu »
const sentReads = {};
function sendReadReceipt(cid) {
  const c = st.dms.find(x => x.id === cid); if (!c || document.visibilityState !== 'visible' || st.view.channel !== cid) return;
  const last = (st.msgs[cid] || []).filter(m => m.author_id !== st.me && m.author_id !== 'system').pop();
  if (!last || (c.reads?.[st.me] || '') >= last.timestamp || sentReads[cid] === last.id) return;
  sentReads[cid] = last.id; request('markRead', { channelId: cid, messageId: last.id }).catch(() => { delete sentReads[cid]; });
}
function onRead(m) {
  const c = st.dms.find(x => x.id === m.channelId); if (!c) return;
  c.reads = { ...(c.reads || {}), [m.userId]: m.at };
  if (st.view.channel === c.id && m.userId !== st.me) { const r = $('#view .receipt'); const list = st.msgs[c.id]; if (r && list) r.outerHTML = receiptHTML(c, list) || '<span></span>'; else renderMain('keep'); }
}

// ---------------------------------------------------------------- Panneau de droite d'une conversation
function dmPanelHTML(c) {
  const imgs = (st.msgs[c.id] || []).flatMap(m => (m.attachments || []).filter(a => /^image\//.test(a.content_type))).slice(-9).reverse();
  const photos = imgs.length ? `<h4>Photos partagées</h4><div class="photo-grid">${imgs.map(a => `<img class="att-img" src="${esc(a.url)}" data-full="${esc(a.url)}" alt="">`).join('')}</div>` : '';
  if (c.group) {
    return `<div class="dm-panel"><div class="dp-av">${convAvatar(c)}</div><h3>${esc(groupName(c))}</h3>
      <div class="dp-acts"><button class="ghost-btn" id="grp-add">${ICON.addUser} Ajouter</button><button class="ghost-btn" id="grp-rename">${ICON.pen} Renommer</button></div>
      <h4>Membres — ${c.members.length}</h4>
      ${c.members.map(user).map(u => `<div class="mem">${avatar(u, true)}<div data-user="${esc(u.id)}"><span>${esc(u.name)}${u.id === st.me ? ' (toi)' : ''}${u.id === c.owner ? ' · créateur' : ''}</span>${u.status !== 'offline' ? `<small>${subline(u)}</small>` : ''}</div></div>`).join('')}
      ${photos}<button class="danger-btn leave-grp" id="grp-leave">Quitter le groupe</button></div>`;
  }
  const o = dmOther(c), note = o.customStatus || o.statusEmoji ? `${o.statusEmoji ? emojiHTML(o.statusEmoji) + ' ' : ''}${esc(o.customStatus || '')}` : '';
  const common = st.servers.filter(s => s.members.includes(o.id));
  return `<div class="dm-panel">
    <div class="dp-av big">${note ? `<span class="note">${note}</span>` : ''}<span class="ring ${inVoice(o.id) ? 'live' : 'none'}">${avatar(o, true)}</span></div>
    <h3 data-user="${esc(o.id)}">${esc(o.name)}</h3><p class="small">${o.status === 'offline' ? 'Hors ligne' : statusLine(o)}</p>
    ${o.about ? `<p class="dp-about">${esc(o.about)}</p>` : ''}
    <div class="dp-acts"><button class="ghost-btn" data-joincall>${ICON.phone} Appeler</button><button class="ghost-btn" id="dp-video">${ICON.video} Vidéo</button></div>
    ${photos}
    ${common.length ? `<h4>Serveurs en commun</h4>${common.map(s => { const live = serverLive(s), col = serverColor(s);
      return `<button class="common-srv" data-srv-open="${s.id}">${srvTileHTML(s, 'sm')}<span>${esc(s.name)}</span>${live ? `<small class="lv">${live} en vocal</small>` : ''}</button>`; }).join('')}` : ''}
  </div>`;
}
$('#members').addEventListener('click', e => {
  const c = channel();
  if (e.target.closest('[data-joincall]') && c) return joinVoice(c.id);
  if (e.target.closest('#dp-video')) return $('#vcall').click();
  const so = e.target.closest('[data-srv-open]'); if (so) { const s = st.servers.find(x => x.id === so.dataset.srvOpen); return openChannel(s.id, firstText(s)); }
  const img = e.target.closest('.att-img'); if (img) { const lb = $('#lightbox'); lb.querySelector('img').src = img.dataset.full; lb.querySelector('a').href = img.dataset.full; lb.hidden = false; return; }
  if (!c?.group) return;
  if (e.target.closest('#grp-add')) {
    const d = $('#group-dlg'); d.dataset.mode = 'add'; d.dataset.chan = c.id;
    fillPickList(true, c.members); $('#group-dlg h3').textContent = 'Ajouter au groupe'; $('#group-name').closest('label').hidden = true;
    $('#group-dlg .small').textContent = 'Choisis les potes à ajouter.'; $('#group-ok').hidden = false; $('#group-ok').textContent = 'Ajouter'; d.showModal();
  }
  if (e.target.closest('#grp-rename')) ask('Renommer le groupe', 'Laisse vide pour afficher les prénoms.', 'Renommer', name => act('renameGroup', { channelId: c.id, name }), c.name || '');
  if (e.target.closest('#grp-leave') && confirm('Quitter ce groupe ?')) act('leaveGroup', { channelId: c.id }).then(() => openChannel('@me', null));
});

// ---------------------------------------------------------------- Salons en onglets (téléphone)
function renderChips() {
  const box = $('#chan-chips'), s = server();
  if (!s || space() !== 'servers') { box.hidden = true; return; }
  box.hidden = false;
  const live = c => (st.voice[c.id] || []).length;
  box.innerHTML = s.channels.filter(c => c.type !== 'voice').map(c => `<button class="chip ${c.id === st.view.channel ? 'on' : ''} ${st.unread[c.id] ? 'unread' : ''}" data-chan-id="${c.id}"># ${esc(c.name)}</button>`).join('')
    + s.channels.filter(c => c.type === 'voice').map(c => `<button class="chip voice ${vc.channel === c.id ? 'on' : ''}" data-voice-id="${c.id}">🔊 ${esc(c.name)}${live(c) ? ' · ' + live(c) : ''}</button>`).join('')
    + `<button class="chip" id="chips-more" aria-label="Infos du serveur">⋯</button>`;
}
$('#chan-chips').addEventListener('click', e => {
  const c = e.target.closest('[data-chan-id]'); if (c) return openChannel(st.view.server, c.dataset.chanId);
  const v = e.target.closest('[data-voice-id]'); if (v) return vc.channel === v.dataset.voiceId ? null : joinVoice(v.dataset.voiceId);
  if (e.target.closest('#chips-more')) document.body.classList.toggle('show-channels');
});

// ---------------------------------------------------------------- Activité
function onActivity(item) {
  st.activity = [item, ...(st.activity || []).filter(a => a.id !== item.id)];
  renderRail();
  if (st.view.server === '@activity') renderMain();
  const who = user(item.from).name;
  if (item.type === 'invite') toast(`${who} t'invite sur ${item.serverName}`);
}
function activityHTML() {
  const f = st.view.afilter || 'all', all = st.activity || [];
  const list = all.filter(a => f === 'all' || a.type === { invites: 'invite', mentions: 'mention', likes: 'like' }[f] || (f === 'likes' && a.type === 'storylike') || (f === 'events' && /^event/.test(a.type)));
  const nInv = all.filter(a => a.type === 'invite' && !a.done && !a.joined && !a.gone).length;
  const chips = `<div class="chips act-chips" role="tablist">${[['all', 'Tout'], ['invites', `Invitations${nInv ? ' · ' + nInv : ''}`], ['mentions', 'Mentions'], ['events', 'Événements'], ['likes', 'J\'aime']]
    .map(([k, l]) => `<button role="tab" aria-selected="${f === k}" data-afilter="${k}" class="chip ${f === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const row = a => {
    const u = user(a.from), when = ago(a.at), cls = `act-item ${a.seen ? '' : 'new'}`;
    if (a.type === 'invite') {
      const s = st.servers.find(x => x.id === a.serverId), col = PALETTE[(a.serverName || '').length % PALETTE.length];
      const state = a.gone ? '<small>Ce serveur n\'existe plus</small>' : (a.joined || s) ? `<button class="mini-btn" data-act-open="${a.serverId}">Ouvrir</button>`
        : `<button class="mini-btn accent" data-inv-accept="${a.id}">Rejoindre</button><button class="mini-btn" data-act-dismiss="${a.id}">Ignorer</button>`;
      return `<div class="${cls} invite"><span class="srv-tile" style="background:${col};color:${lightColor(col) ? '#14121A' : '#fff'}">${initials(a.serverName || '?')}</span>
        <div class="ai-txt"><b>${esc(u.name)}</b> t'invite sur <b>${esc(a.serverName)}</b><small>${a.members ? `${a.members} membre${a.members > 1 ? 's' : ''} · ` : ''}${when}</small></div><div class="ai-acts">${state}</div></div>`;
    }
    const where = a.channelId && chanById(a.channelId);
    const place = where ? (where.type === 'dm' ? (where.group ? groupName(where) : 'en privé') : `#${esc(where.name)}${a.serverId ? ' · ' + esc(st.servers.find(x => x.id === a.serverId)?.name || '') : ''}`) : '';
    if (a.type === 'event' || a.type === 'eventSoon') {
      const d = new Date(a.start), ev = st.servers.find(x => x.id === a.serverId)?.events?.find(x => x.id === a.eventId);
      return `<button class="${cls} ev-act" data-act-event="${esc(a.serverId)}"><span class="ev-date"><small>${esc(d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''))}</small><b>${d.getDate()}</b></span>
        <div class="ai-txt">${a.type === 'eventSoon' ? `⏰ <b>${esc(a.text)}</b> commence ${esc(evWhen(a.start))} !` : `<b>${esc(u.name)}</b> organise <b>${esc(a.text)}</b> sur ${esc(a.serverName || '')}`}
        <small>${esc(evWhen(a.start))}${ev ? ` · ${ev.going.length} vien${ev.going.length > 1 ? 'nent' : 't'}` : ''} · ${when}</small></div></button>`;
    }
    if (a.type === 'storylike') return `<button class="${cls}" data-act-story="${esc(a.storyId)}">${avatar(u)}<div class="ai-txt"><b>${esc(u.name)}</b> a aimé ta story<small>${when}</small></div>${storyThumbHTML(a)}</button>`;
    if (a.type === 'mention') return `<button class="${cls}" data-act-go="${a.id}">${avatar(u)}<div class="ai-txt"><b>${esc(u.name)}</b> t'a mentionné dans <b>${place}</b>
      <span class="ai-quote">${esc(a.text)}</span><small>${when}</small></div></button>`;
    return `<button class="${cls}" data-act-go="${a.id}">${avatar(u)}<div class="ai-txt"><b>${esc(u.name)}</b> a réagi ${reactionHTML(a.emoji)} à ton message${a.text ? ` : <span class="ai-q">« ${esc(a.text)} »</span>` : ''}<small>${place ? place + ' · ' : ''}${when}</small></div></button>`;
  };
  const groups = f === 'all' ? [['Invitations', list.filter(a => a.type === 'invite')], ['Mentions', list.filter(a => a.type === 'mention')], ['Événements', list.filter(a => /^event/.test(a.type))], ['J\'aime', list.filter(a => a.type === 'like' || a.type === 'storylike')]] : [['', list]];
  const body = groups.filter(([, l]) => l.length).map(([t, l]) => `${t ? `<h3 class="act-h">${t}</h3>` : ''}${l.map(row).join('')}`).join('');
  return `<div class="activity">${chips}${body || `<div class="empty-state big"><div class="es-ico">${ICON.heart}</div><h2>Rien de neuf</h2><p>Les invitations à des serveurs, les mentions et les réactions à tes messages arriveront ici.</p></div>`}</div>`;
}
$('#view').addEventListener('click', e => {
  if (st.view.server === '@activity') {
    const fl = e.target.closest('[data-afilter]'); if (fl) { st.view.afilter = fl.dataset.afilter; return renderMain(); }
    const acc = e.target.closest('[data-inv-accept]'); if (acc) return act('acceptInvite', { activityId: acc.dataset.invAccept });
    const dis = e.target.closest('[data-act-dismiss]'); if (dis) return act('dismissActivity', { activityId: dis.dataset.actDismiss });
    const op = e.target.closest('[data-act-open]'); if (op) { const s = st.servers.find(x => x.id === op.dataset.actOpen); if (s) openChannel(s.id, firstText(s)); return; }
    const ae = e.target.closest('[data-act-event]');
    if (ae) { const s = st.servers.find(x => x.id === ae.dataset.actEvent); if (!s) return toast('Tu n\'es plus sur ce serveur', true); openChannel(s.id, firstText(s)); return openEvents(); }
    const so = e.target.closest('[data-act-story]');
    if (so) { const x = (st.stories || []).find(y => y.id === so.dataset.actStory); return x ? openStoryViewer(x.author, x.id) : toast('Cette story a expiré', true); }
    const go = e.target.closest('[data-act-go]');
    if (go) {
      const a = st.activity.find(x => x.id === go.dataset.actGo), c = a && chanById(a.channelId);
      if (!c) return toast('Ce message n\'est plus accessible', true);
      jumpAfterLoad = a.messageId;
      openChannel(c.type === 'dm' ? '@me' : (c.server_id || chanById(c.parent_id)?.server_id), c.id);
      if (st.msgs[c.id]) flashJump();
    }
    return;
  }
  const es = e.target.closest('[data-es]');
  if (es?.dataset.es === 'create') $('#add-server').click();
  if (es?.dataset.es === 'join') $('#join-server').click();
});

// ---------------------------------------------------------------- Inviter des potes sur un serveur
function openInvite(s) {
  const d = $('#invite-dlg');
  const candidates = st.friends.filter(id => !s.members.includes(id)).map(user);
  $('#invite-body').innerHTML = `<h3>Inviter sur ${esc(s.name)}</h3>
    <p class="small">Tes potes reçoivent l'invitation dans leur Activité.</p>
    <div class="pick-list">${candidates.map(u => `<div class="pick">${avatar(u, true)}<span>${esc(u.name)}</span><button class="mini-btn accent" data-invite-user="${esc(u.id)}">Inviter</button></div>`).join('')
      || '<p class="small">Tous tes potes sont déjà sur ce serveur.</p>'}</div>
    <h4>Ou partage le code</h4>
    <div class="code-row"><code id="inv-code">${esc(s.invite)}</code><button class="mini-btn" id="inv-copy">Copier</button></div>
    <p class="small">À coller dans Serveurs → Code.</p>
    <menu><button class="primary" id="inv-close">Fermer</button></menu>`;
  d.showModal();
}
$('#invite-dlg').addEventListener('click', e => {
  const s = server(), d = $('#invite-dlg');
  if (e.target === d || e.target.closest('#inv-close')) return d.close();
  if (e.target.closest('#inv-copy')) { try { navigator.clipboard.writeText(s.invite).then(() => toast('Code copié !')); } catch { toast('Copie impossible', true); } }
  const b = e.target.closest('[data-invite-user]');
  if (b && !b.disabled) request('inviteFriend', { serverId: s.id, userId: b.dataset.inviteUser })
    .then(() => { b.textContent = 'Envoyé ✓'; b.disabled = true; b.classList.remove('accent'); }, err => toast(err.message, true));
});

// ---------------------------------------------------------------- Icônes de l'en-tête
(() => {
  const set = (sel, icon, label) => { const b = $(sel); if (b) { b.innerHTML = icon; b.setAttribute('aria-label', label); } };
  set('#pins', ICON.pin, 'Messages épinglés'); set('#threads-btn', ICON.thread, 'Fils de discussion');
  set('#call', ICON.phone, 'Appel vocal'); set('#vcall', ICON.video, 'Appel vidéo'); set('#toggle-members', ICON.users, 'Afficher le panneau');
  addEventListener('resize', () => { if (st.me) layoutSpace(); });
})();

// ---------------------------------------------------------------- Panneaux de droite : un seul à la fois
// (épinglés / fils / recherche d'un côté, membres de l'autre) ; en fenêtre étroite ils s'ouvrent par-dessus.
(() => {
  const res = $('#results'), body = document.body;
  const sync = () => { body.classList.toggle('res-open', !res.hidden); if (!res.hidden) body.classList.remove('members-open'); };
  new MutationObserver(sync).observe(res, { attributes: true, attributeFilter: ['hidden'] });
  sync();
  $('#toggle-members').onclick = () => {
    const narrow = matchMedia('(max-width:1100px)').matches;
    if (!res.hidden) { res.hidden = true; $('#members').classList.remove('hide'); if (narrow) body.classList.add('members-open'); return; }
    if (narrow) body.classList.toggle('members-open');
    else $('#members').classList.toggle('hide');
  };
  document.addEventListener('click', e => {
    if (!body.classList.contains('members-open') || e.target.closest('#members,#toggle-members,#card')) return;
    body.classList.remove('members-open');
  });
})();
