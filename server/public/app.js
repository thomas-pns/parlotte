'use strict';
// Parlotte — client web. Parle au serveur via WebSocket (/ws).
const EMOJIS = ['👍', '😂', '❤️', '🔥', '😮', '😢', '🎉', '👀', '💯', '🤔', '👏', '🚀'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let prefs;
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};

prefs = store.get('parlotte-prefs') || {};
// ---------------------------------------------------------------- État
const st = {
  me: null, users: {}, servers: [], dms: [], friends: [], incoming: [], outgoing: [], lastByChannel: {},
  msgs: {}, more: {}, unread: {}, read: {},
  view: { server: '@me', channel: null, tab: 'online' },
};
const SYSTEM = { id: 'system', name: 'Parlotte', color: '#5865f2', bot: true, status: 'online' };
const user = id => (id === 'system' ? SYSTEM : st.users[id] || { id, name: 'inconnu', color: '#777', status: 'offline' });
const server = () => st.servers.find(s => s.id === st.view.server);
const firstText = s => s?.channels.find(c => c.type !== 'voice')?.id || null;
// Permissions (les bits viennent du serveur au démarrage)
let P = {};
const cp = (c, flag) => !!c && (c.type === 'dm' || (((c.perms || 0) & flag) === flag));      // droit dans un salon
const sp = (s, flag) => !!s && ((s.myPerms || 0) & flag) === flag;                            // droit sur le serveur
const rolesOf = (s, uid) => (s?.memberRoles?.[uid] || []).map(id => s.roles.find(r => r.id === id)).filter(Boolean).sort((a, b) => b.position - a.position);
const nameColor = (uid, fallback) => { const s = server(); const r = s && rolesOf(s, uid).find(r => r.color); return r ? r.color : fallback; };
const isPrivate = (s, c) => { const o = (c.overwrites || []).find(o => o.id === s.id); return !!o && (o.deny & P.VIEW); };
const allChannels = () => [...st.servers.flatMap(s => [...s.channels, ...(s.threads || [])]), ...st.dms];
const chanById = id => allChannels().find(c => c.id === id);
const channel = () => chanById(st.view.channel);
const dmOther = c => user(c.members.find(m => m !== st.me) || st.me);
const groupName = c => c.name || c.members.filter(m => m !== st.me).map(m => user(m).name).slice(0, 4).join(', ') || 'Groupe';
const chanLabel = c => (c.type === 'dm' ? (c.group ? groupName(c) : '@' + dmOther(c).name) : c.type === 'thread' ? '🧵 ' + c.name : '#' + c.name);

// ---------------------------------------------------------------- Réseau
let ws, refN = 0, retry = 0;
const pending = new Map();
function connect() {
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onopen = () => {
    retry = 0; $('#conn').hidden = true;
    const token = store.get('parlotte-token');
    if (token) request('resume', { token }).catch(() => { store.del('parlotte-token'); showAuth(); });
    else showAuth();
  };
  ws.onmessage = e => handle(JSON.parse(e.data));
  ws.onclose = () => {
    if (typeof vc !== 'undefined' && (vc.channel || vc.stream)) leaveVoice(true);
    pending.forEach(p => p.reject(new Error('Connexion perdue'))); pending.clear();
    if (st.me || retry >= 1) $('#conn').hidden = false; // même avant connexion : sinon page vide si le serveur est éteint
    setTimeout(connect, Math.min(1000 * 2 ** retry++, 10000));
  };
}
function request(t, payload = {}) {
  return new Promise((resolve, reject) => {
    if (!ws || ws.readyState !== 1) return reject(new Error('Pas connecté au serveur'));
    const ref = ++refN; pending.set(ref, { resolve, reject });
    ws.send(JSON.stringify({ t, ref, ...payload }));
  });
}
const act = (t, p) => request(t, p).catch(e => toast(e.message, true));

function handle(m) {
  const p = m.ref && pending.get(m.ref);
  if (p) pending.delete(m.ref);
  if (m.t === 'error') { if (p) p.reject(new Error(m.error)); else toast(m.error, true); return; }
  switch (m.t) {
    case 'auth':
      store.set('parlotte-token', m.token); st.me = m.user.id;
      st.read = store.get('parlotte-read-' + st.me) || {}; st.profile = m.profile;
      if (!st.restored) { const v = store.get('parlotte-view-' + st.me); if (v) Object.assign(st.view, { server: v.server, channel: v.channel }); st.restored = true; }
      $('#auth').hidden = true; $('#app').hidden = false;
      onAuthed(); // présence : inactivité, jeu en cours (presence.js)
      break;
    case 'bootstrap': {
      P = m.P || P;
      st.blocked = m.blocked || [];
      Object.assign(st, { users: m.users, servers: m.servers, dms: m.dms, friends: m.friends, incoming: m.incoming, outgoing: m.outgoing, lastByChannel: m.lastByChannel, voice: m.voice || {},
        previews: m.previews || {}, activity: m.activity || [], stories: m.stories || [], memories: m.memories || [] });
      for (const [c, ts] of Object.entries(m.lastByChannel)) if (!st.unread[c] && ts > (st.read[c] || '') && c !== st.view.channel) st.unread[c] = '•';
      if (!isSpecial(st.view.server) && !server()) Object.assign(st.view, { server: '@me', channel: null });
      if (st.view.channel && !channel()) st.view.channel = st.view.server === '@me' ? null : firstText(server());
      render(); if (st.view.channel && !st.msgs[st.view.channel]) loadHistory(st.view.channel);
      if ($('#srv-dlg').open) renderServerSettings();
      break; }
    case 'opened': openChannel(m.server, m.channel); break;
    case 'history': {
      const cur = st.msgs[m.channelId] || [];
      st.msgs[m.channelId] = m.prepend ? [...m.messages, ...cur] : m.messages;
      st.more[m.channelId] = m.more;
      if (m.channelId === st.view.channel) { renderMain(m.prepend ? 'keepTop' : 'bottom'); flashJump(); }
      break; }
    case 'message': onNewMessage(m.message); break;
    case 'messageUpdate': {
      const list = st.msgs[m.message.channel_id]; if (!list) break;
      const i = list.findIndex(x => x.id === m.message.id); if (i !== -1) list[i] = m.message;
      if (m.message.channel_id === st.view.channel && !document.querySelector('.edit-box')) renderMain('keep');
      break; }
    case 'threadUpdate': {
      const sv = st.servers.find(x => x.id === m.thread.server_id); if (!sv) break;
      sv.threads = (sv.threads || []).filter(t => t.id !== m.thread.id).concat(m.thread);
      renderSide(); if (st.view.channel === m.thread.id) renderMain('keep');
      break; }
    case 'threadDelete': {
      const sv = st.servers.find(x => x.id === m.serverId); if (!sv) break;
      const t = (sv.threads || []).find(x => x.id === m.threadId);
      sv.threads = (sv.threads || []).filter(x => x.id !== m.threadId);
      if (st.view.channel === m.threadId) openChannel(sv.id, t?.parent_id || firstText(sv)); else renderSide();
      break; }
    case 'messageDelete': {
      const list = st.msgs[m.channelId]; if (list) st.msgs[m.channelId] = list.filter(x => x.id !== m.id);
      if (m.channelId === st.view.channel) renderMain('keep');
      break; }
    case 'profile': st.profile = m.profile; renderSide(); break;
    case 'presence': st.users[m.user.id] = m.user; renderMembers(); renderSide(); if (isFriendsView() || !document.querySelector('.edit-box')) renderMain('keep'); break;
    case 'typing': showTyping(m.channelId, m.userId); break;
    case 'searchResults': showResults(m); break;
    case 'pinsList': showPins(m); break;
    case 'info': toast(m.text); break;
    case 'voice': onVoiceState(m.channelId, m.members); break;
    case 'peerLeft': closePeer(m.userId); break;
    case 'rtc': onRtc(m.from, m.data); break;
    case 'ring': onRing(m.channelId, m.from); break;
    case 'callDeclined': if (vc.channel === m.channelId) { toast(`${user(m.by).name} a refusé l'appel`); leaveVoice(); } break;
    case 'voiceKicked': leaveVoice(true); toast(m.reason); break;
    case 'read': onRead(m); break;
    case 'activity': onActivity(m.item); break;
    case 'activitySeen': (st.activity || []).forEach(a => (a.seen = true)); renderRail(); break;
    case 'activityRemoved': st.activity = (st.activity || []).filter(a => a.id !== m.id); renderRail(); if (st.view.server === '@activity') renderMain(); break;
    case 'sound': onSound(m); break;
    case 'story': onStory(m.story); break;
    case 'storyRemoved': onStoryRemoved(m.id); break;
  }
  if (p) p.resolve(m);
}

let onNewMessage = function (msg) {
  const list = st.msgs[msg.channel_id];
  if (list && !list.some(x => x.id === msg.id)) list.push(msg);
  st.lastByChannel[msg.channel_id] = msg.timestamp;
  const isDm = st.dms.some(c => c.id === msg.channel_id);
  if (isDm) st.previews[msg.channel_id] = previewOf(msg);
  clearTyping(msg.channel_id, msg.author_id);
  const here = msg.channel_id === st.view.channel && document.visibilityState === 'visible';
  if (msg.channel_id === st.view.channel) { renderMain('keep'); if (here) markRead(msg.channel_id); }
  if (isDm && st.view.server === '@me') renderSide(); // aperçu du dernier message dans la liste
  if (!here && msg.author_id !== st.me) {
    st.unread[msg.channel_id] = (typeof st.unread[msg.channel_id] === 'number' ? st.unread[msg.channel_id] : 0) + 1;
    renderRail(); renderSide(); updateTitle();
    const ch = chanById(msg.channel_id);
    if (ch && !isDnd() && (ch.type === 'dm' || (msg.mentions || []).includes(st.me))) { notify(msg, ch); window.parlotteDesktop?.attention(); }
  }
}
function markRead(cid) {
  st.read[cid] = st.lastByChannel[cid] || new Date().toISOString(); delete st.unread[cid];
  store.set('parlotte-read-' + st.me, st.read); updateTitle();
  sendReadReceipt(cid); // « Vu » (espaces.js)
}
function updateTitle() {
  const n = Object.entries(st.unread).filter(([c]) => chanById(c)?.type === 'dm').reduce((a, [, v]) => a + (typeof v === 'number' ? v : 1), 0);
  document.title = (n ? `(${n}) ` : '') + 'Parlotte';
  window.parlotteDesktop?.setBadge(n); // pastille sur l'icône de l'app de bureau
}
function notify(msg, ch) {
  if (!('Notification' in window) || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
  try { new Notification(`${user(msg.author_id).name} · ${chanLabel(ch)}`, { body: msg.content.slice(0, 120) }); } catch {}
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.view.channel) { markRead(st.view.channel); renderSide(); renderRail(); } });

// ---------------------------------------------------------------- Connexion / inscription
let mode = 'login';
function showAuth() {
  st.me = null; $('#app').hidden = true; $('#auth').hidden = false; $('#auth-user').focus();
}
function setMode(m) {
  mode = m; const reg = m === 'register';
  $('#auth-sub').textContent = reg ? 'Crée ton compte en 10 secondes' : 'Content de te revoir !';
  $('#auth-btn').textContent = reg ? 'Créer mon compte' : 'Se connecter';
  $('#auth-switch').textContent = reg ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire';
  $('#auth-pass').autocomplete = reg ? 'new-password' : 'current-password';
  $('#auth-err').textContent = '';
}
$('#auth-switch').onclick = e => { e.preventDefault(); setMode(mode === 'login' ? 'register' : 'login'); };
$('#auth-form').onsubmit = e => {
  e.preventDefault(); $('#auth-err').textContent = '';
  request(mode, { username: $('#auth-user').value, password: $('#auth-pass').value })
    .then(() => { $('#auth-pass').value = ''; if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {}); })
    .catch(err => { $('#auth-err').textContent = err.message; });
};

// ---------------------------------------------------------------- Formatage
const time = d => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const dayLabel = d => sameDay(d, Date.now()) ? "Aujourd'hui" : sameDay(d, Date.now() - 864e5) ? 'Hier'
  : new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dot = { online: '#23a55a', idle: '#f0b232', dnd: '#f23f43', offline: '#80848e' };
const STATUS = { online: 'En ligne', idle: 'Absent', dnd: 'Ne pas déranger', invisible: 'Invisible', offline: 'Hors ligne' };
// Ligne de statut : statut perso (emoji + texte), sinon jeu en cours, sinon le statut.
const emojiHTML = tok => { const m = /^<:(\w{2,32}):([0-9a-z]+)>$/.exec(tok || ''); const e = m && emojiById(m[2]);
  return m ? (e ? `<img class="emoji" src="${esc(e.url)}" alt=":${esc(m[1])}:">` : `:${esc(m[1])}:`) : esc(tok); };
const statusLine = u => {
  if (u.customStatus || u.statusEmoji) return `${u.statusEmoji ? emojiHTML(u.statusEmoji) + ' ' : ''}${esc(u.customStatus || '')}`;
  if (u.activity) return `🎮 Joue à <b>${esc(u.activity.name)}</b>`;
  return esc(STATUS[u.status] || '');
};
const subline = statusLine;
const isDnd = () => st.profile?.presence === 'dnd';
// 2.0 : sans photo, une silhouette moderne sur un dégradé de la couleur de la personne (au lieu de l'initiale)
const SILHOUETTE = '<svg class="sil" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15.5" r="7.2"/><path d="M5.5 39c1.2-8.6 7.3-13.4 14.5-13.4S33.3 30.4 34.5 39z"/></svg>';
const avatar = (u, withStatus) => `<div class="av ${u.avatar ? '' : 'nopic'}" data-user="${esc(u.id)}" style="${u.avatar ? `background:url('${esc(u.avatar)}')` : `--avc:${esc(u.color || '#8E6CFF')}`}">${u.avatar ? '' : SILHOUETTE}${withStatus ? `<span class="st" style="background:${dot[u.status] || dot.offline}"></span>` : ''}</div>`;
// Mise en forme : ```blocs de code```, > citations, # titres, listes, **gras**, *italique*, __souligné__,
// ~~barré~~, ||spoiler||, `code`, liens, @mentions, #salons, emojis perso.
function inlineFormat(raw, ctx) {
  const codes = [];
  let h = esc(raw).replace(/`([^`\n]+)`/g, (all, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });
  h = h
    .replace(/&lt;:(\w{2,32}):([0-9a-z]+)&gt;/g, (all, n, id) => { const e = emojiById(id); return e ? `<img class="emoji" src="${esc(e.url)}" alt=":${n}:" title=":${n}:">` : `:${n}:`; })
    .replace(/\|\|(.+?)\|\|/g, '<span class="spoiler" title="Spoiler : clique pour afficher">$1</span>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/__(.+?)__/g, '<u>$1</u>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    .replace(/(^|[^*\w])\*(?!\s)(.+?)(?<!\s)\*(?!\w)/g, '$1<i>$2</i>')
    .replace(/(^|[^\w])_(?!\s)([^_]+?)(?<!\s)_(?!\w)/g, '$1<i>$2</i>')
    .replace(/(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/@([\p{L}\p{N}_.-]+)/gu, (all, n) => ctx.names.includes(n.toLowerCase()) || n === 'everyone' || n === 'here' ? `<span class="mention">@${n}</span>` : all)
    .replace(/(^|\s)#([\w-]+)/g, (all, sp, n) => { const c = ctx.chans.find(c => c.name === n); return c ? `${sp}<span class="mention" data-goto="${c.id}">#${n}</span>` : all; });
  return h.replace(/\u0000(\d+)\u0000/g, (all, i) => `<code>${codes[i]}</code>`);
}
function format(text) {
  const ctx = { names: Object.values(st.users).map(u => u.name.toLowerCase()), chans: st.view.server !== '@me' && server() ? server().channels : [] };
  const parts = String(text).split('```');
  if (parts.length % 2 === 0) parts[parts.length - 2] += '```' + parts.pop(); // bloc de code non fermé : texte normal
  return parts.map((part, i) => {
    if (i % 2) { // bloc de code
      const m = part.match(/^([\w+#.-]{1,20})\n/), body = (m ? part.slice(m[0].length) : part.replace(/^\n/, '')).replace(/\n$/, '');
      return `<pre class="codeblock">${m ? `<span class="lang">${esc(m[1])}</span>` : ''}<code>${esc(body)}</code></pre>`;
    }
    if (i > 0) part = part.replace(/^\n/, '');                 // pas de ligne vide juste après un bloc de code
    if (i < parts.length - 1) part = part.replace(/\n$/, ''); // ni juste avant
    const out = []; let list = null, quote = [];
    const flushList = () => { if (list) { out.push(`<${list.type}>${list.items.map(x => `<li>${x}</li>`).join('')}</${list.type}>`); list = null; } };
    const flushQuote = () => { if (quote.length) { out.push(`<blockquote>${quote.join('<br>')}</blockquote>`); quote = []; } };
    for (const line of part.split('\n')) {
      let m;
      if ((m = line.match(/^>\s?(.*)$/))) { flushList(); quote.push(inlineFormat(m[1], ctx)); continue; }
      flushQuote();
      if ((m = line.match(/^\s*[-*•]\s+(.+)$/))) { if (list?.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; } list.items.push(inlineFormat(m[1], ctx)); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) { if (list?.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; } list.items.push(inlineFormat(m[1], ctx)); continue; }
      flushList();
      if ((m = line.match(/^(#{1,3})\s+(.+)$/))) { out.push(`<div class="h${m[1].length}">${inlineFormat(m[2], ctx)}</div>`); continue; }
      out.push(inlineFormat(line, ctx) + '<br>');
    }
    flushList(); flushQuote();
    return out.join('').replace(/(<br>)+$/, '');
  }).join('');
}

// ---------------------------------------------------------------- Rendu
function render() { layoutSpace(); renderRail(); renderSide(); renderMain('bottom'); renderMembers(); }
const isFriendsView = () => st.view.server === '@me' && !st.view.channel;
const isSpecial = id => id === '@me' || id === '@activity' || id === '@servers';
const unreadIn = chans => chans.reduce((a, c) => a + (st.unread[c.id] ? (typeof st.unread[c.id] === 'number' ? st.unread[c.id] : 1) : 0), 0);

function renderRail() { renderNav(); } // barre Potes / Serveurs / Activité + cartes des serveurs (espaces.js)

function renderSide() {
  const head = $('#side-head'), list = $('#side-list');
  renderMe();
  if (st.view.server === '@activity' || st.view.server === '@servers') { head.innerHTML = ''; list.innerHTML = ''; return; }
  if (st.view.server === '@me') return renderPotesList(head, list);
  {
    const s = server(), owner = s.owner === st.me, manageCh = sp(s, P.MANAGE_CHANNELS);
    const admin = sp(s, P.MANAGE_SERVER) || sp(s, P.MANAGE_ROLES) || sp(s, P.KICK) || sp(s, P.BAN);
    head.innerHTML = `<div class="srv-banner ${s.banner ? 'has-img' : ''}" style="--srv:${esc(serverColor(s))}${s.banner ? `;--srv-img:url('${esc(s.banner)}')` : ''}"><span class="srv-name">${esc(s.name)}</span><span class="srv-acts">${s.invite ? '<button id="invite" title="Inviter des amis">Inviter</button>' : ''}${admin ? ' <button id="srv-settings" title="Paramètres du serveur" aria-label="Paramètres du serveur">⚙</button>' : ''}${owner ? '' : ' <button id="leave" title="Quitter le serveur">Quitter</button>'}</span></div>`;
    const gear = c => (c.perms & P.MANAGE_CHANNELS) ? `<span class="gear" data-chan-settings="${c.id}" title="Paramètres du salon">⚙</span>` : '';
    list.innerHTML = `<div class="cat">Salons textuels ${manageCh ? '<button id="add-channel" title="Créer un salon">+</button>' : ''}</div>` +
      s.channels.filter(c => c.type !== 'voice').map(c => { const on = c.id === st.view.channel, n = st.unread[c.id];
        const subs = (s.threads || []).filter(t => t.parent_id === c.id && (!t.archived || t.id === st.view.channel)).sort((a, b) => (b.last || '').localeCompare(a.last || ''));
        const threadsHTML = subs.map(t => { const tn = st.unread[t.id];
          return `<button class="chan thread ${t.id === st.view.channel ? 'on' : ''} ${tn ? 'unread' : ''}" data-chan-id="${t.id}">↳ ${esc(t.name)}${tn ? `<span class="badge">${tn}</span>` : ''}</button>`; }).join('');
        return `<button class="chan ${on ? 'on' : ''} ${n ? 'unread' : ''}" data-chan-id="${c.id}">${isPrivate(s, c) ? '🔒' : '#'} ${esc(c.name)}${n ? `<span class="badge">${n}</span>` : ''}${gear(c)}</button>` + threadsHTML; }).join('') +
      `<div class="cat" style="margin-top:12px">Salons vocaux ${manageCh ? '<button id="add-voice" title="Créer un salon vocal">+</button>' : ''}</div>` +
      s.channels.filter(c => c.type === 'voice').map(voiceChannelHTML).join('') +
      (owner ? '<p class="small" style="padding:12px 8px"><button class="danger-btn" id="delete-server">Supprimer le serveur</button></p>' : '');
  }
}
function renderMe() {
  const me = user(st.me);
  const pr = st.profile || {}, chosen = pr.presence || 'online';
  const mine = { ...me, status: chosen === 'invisible' ? 'offline' : chosen === 'online' && me.status === 'idle' ? 'idle' : chosen };
  const line = pr.customStatus || pr.statusEmoji ? statusLine(pr) : me.activity ? statusLine({ activity: me.activity }) : esc(STATUS[chosen === 'online' ? mine.status : chosen]);
  const box = $('#me'); if (!box) return;
  box.innerHTML = `<button class="me-av" id="open-status" title="Changer de statut" aria-label="Mon statut">${avatar(mine, true)}</button><div class="meinfo" id="open-profile" title="Modifier mon profil"><b>${esc(me.name)}</b><small>${line}</small></div><button id="open-settings" title="Paramètres" aria-label="Paramètres">${ICON.gear}</button>`;
}

function renderMain(scroll) {
  const box = $('#view'), composer = $('#composer');
  const prevH = box.scrollHeight, prevTop = box.scrollTop, atBottom = prevH - prevTop - box.clientHeight < 80;
  $('#chan-av').innerHTML = ''; $('#vcall').hidden = true; $('#thread-bar').hidden = true;
  if (st.view.server === '@activity' || st.view.server === '@servers') {
    $('#call').hidden = true; $('#pins').hidden = true; $('#threads-btn').hidden = true; $('#chan-chips').hidden = true;
    composer.hidden = true; $('#members').hidden = true; $('#chan-topic').textContent = '';
    if (st.view.server === '@activity') { $('#chan-title').textContent = 'Activité'; box.innerHTML = activityHTML(); }
    else { $('#chan-title').textContent = 'Serveurs'; box.innerHTML = noServerHTML(); }
    return;
  }
  renderChips();
  if (isFriendsView()) {
    $('#call').hidden = true; $('#pins').hidden = true; $('#threads-btn').hidden = true;
    $('#chan-title').textContent = 'Tes potes'; $('#chan-topic').textContent = '';
    composer.hidden = true; $('#members').hidden = true; box.innerHTML = friendsHTML();
    return;
  }
  const c = channel(); if (!c) { box.innerHTML = '<div class="empty-state">Choisis un salon</div>'; composer.hidden = true; return; }
  composer.hidden = false; $('#members').hidden = false;
  $('#chan-title').textContent = chanLabel(c); $('#chan-topic').textContent = c.topic || '';
  if (c.type === 'thread') {
    const parent = chanById(c.parent_id), mod = c.owner === st.me || cp(c, P.MANAGE_MESSAGES);
    $('#chan-title').innerHTML = `<button class="crumb" data-goto-chan="${c.parent_id}">#${esc(parent?.name || '')}</button> › 🧵 ${esc(c.name)}`;
    $('#chan-topic').innerHTML = c.archived ? '<span class="arch">archivé</span>' : '';
    $('#thread-bar').innerHTML = mod ? `<span>🧵 Fil de discussion</span><button class="link" data-thread-act="rename">Renommer</button><button class="link" data-thread-act="${c.archived ? 'unarchive' : 'archive'}">${c.archived ? 'Désarchiver' : 'Archiver'}</button><button class="link" data-thread-act="delete">Supprimer</button>` : '';
  }
  $('#thread-bar').hidden = !(c.type === 'thread' && $('#thread-bar').innerHTML);
  $('#threads-btn').hidden = c.type !== 'text';
  $('#call').hidden = c.type !== 'dm'; $('#vcall').hidden = c.type !== 'dm'; $('#pins').hidden = c.type === 'voice';
  if (c.type === 'dm') chatHeadDM(c);
  const canSend = cp(c, P.SEND);
  $('#input').disabled = !canSend;
  $('#input').placeholder = !canSend ? 'Tu n\'as pas la permission d\'écrire dans ce salon' : c.type === 'dm' ? 'Message…' : `Écrire dans ${chanLabel(c)}`;
  $('#attach').hidden = !cp(c, P.ATTACH);
  $('#poll-btn').hidden = !canSend; $('#emoji-btn').hidden = !canSend; $('#rec-btn').hidden = !cp(c, P.ATTACH);
  const list = st.msgs[c.id];
  if (!list) { box.innerHTML = '<div class="empty-state">Chargement…</div>'; return; }
  if (c.type === 'dm') { box.classList.add('bubbles'); box.innerHTML = bubblesHTML(c, list); afterRender(box, scroll, prevH, prevTop, atBottom); return; }
  box.classList.remove('bubbles');
  const inCall = c.type === 'dm' ? (st.voice[c.id] || []) : [];
  let html = inCall.length ? `<div class="callbar">🔊 Appel en cours ${inCall.map(m => `<span data-speaker="${esc(m.id)}" class="${speaking.has(m.id) ? 'speaking' : ''}">${avatar(user(m.id))}</span>`).join('')}${vc.channel === c.id ? '' : '<button class="primary green" data-joincall>Rejoindre</button>'}</div>` : '';
  html += st.more[c.id] ? '<button class="more" id="load-more">Charger les messages plus anciens</button>'
    : c.type === 'thread' ? `<div class="welcome"><h2>🧵 ${esc(c.name)}</h2>Début du fil, créé par ${esc(user(c.owner).name)}.${starterHTML(c)}</div>`
    : `<div class="welcome"><h2>${c.type === 'dm' ? esc(dmOther(c).name) : 'Bienvenue dans #' + esc(c.name) + ' !'}</h2>${c.type === 'dm' ? `Début de ta conversation privée avec @${esc(dmOther(c).name)}.` : `C'est le début du salon #${esc(c.name)}.`}</div>`;
  let prev = null, dividerDone = false;
  const divAt = st.divider?.channel === c.id ? st.divider.at : null;
  for (const m of list) {
    const u = user(m.author_id), newDay = !prev || !sameDay(prev.timestamp, m.timestamp);
    if (divAt && !dividerDone && m.timestamp > divAt && m.author_id !== st.me) { html += '<div class="newdiv"><span>Nouveaux messages</span></div>'; dividerDone = true; }
    if ((st.blocked || []).includes(m.author_id) && !st.revealed?.has(m.id)) {
      html += `<div class="msg blocked-msg" data-id="${m.id}"><div class="gut"></div><div class="body">🚫 Message d'un utilisateur bloqué — <button class="link" data-reveal="${m.id}">Afficher</button></div></div>`;
      prev = m; continue;
    }
    if (newDay) html += `<div class="day">${dayLabel(m.timestamp)}</div>`;
    const first = newDay || prev.author_id !== m.author_id || new Date(m.timestamp) - new Date(prev.timestamp) > 7 * 60000 || m.reply_to;
    const ref = m.reply_to && list.find(x => x.id === m.reply_to);
    const mine = m.author_id === st.me, owner = c.type !== 'dm' && cp(c, P.MANAGE_MESSAGES);
    html += `<div class="msg ${first ? 'first' : ''} ${(m.mentions || []).includes(st.me) ? 'mentioned' : ''} ${m.author_id === 'system' ? 'sys' : ''}" data-id="${m.id}">
      <div class="gut">${first ? avatar(u) : time(m.timestamp)}</div>
      <div class="body">
        ${m.reply_to ? `<div class="replyto" data-jump="${m.reply_to}">↪ ${ref ? `<b>@${esc(user(ref.author_id).name)}</b> ${esc(ref.content.slice(0, 80))}` : '<i>Message original non chargé ou supprimé</i>'}</div>` : ''}
        ${first ? `<div><span class="who" data-user="${esc(u.id)}" style="color:${esc(c.type === 'dm' ? u.color : nameColor(u.id, u.color))}">${esc(u.name)}</span>${u.bot ? ' <span class="mention">SYSTÈME</span>' : ''}<span class="when">${dayLabel(m.timestamp)} à ${time(m.timestamp)}</span>${m.pinned ? ' 📌' : ''}</div>` : ''}
        ${m.content ? `<div class="text ${/^(\s*<:\w{2,32}:[0-9a-z]+>\s*){1,10}$/.test(m.content) ? 'big-emoji' : ''}">${format(m.content)}${m.edited ? ' <span class="edited">(modifié)</span>' : ''}</div>` : ''}
        ${attachmentsHTML(m.attachments)}${m.poll ? pollHTML(m, c) : ''}${m.game && typeof gameHTML === 'function' ? gameHTML(m) : ''}${m.thread ? threadChipHTML(m.thread) : ''}
        ${Object.keys(m.reactions || {}).length ? `<div class="reacts">${Object.entries(m.reactions).map(([e, who]) =>
          `<button class="react ${who.includes(st.me) ? 'mine' : ''}" data-react="${esc(e)}" title="${esc(who.map(w => user(w).name).join(', '))}">${reactionHTML(e)} ${who.length}</button>`).join('')}</div>` : ''}
      </div>
      <div class="tools">
        ${cp(c, P.REACT) ? '<button data-act="react" title="Réagir">😀</button>' : ''}${cp(c, P.SEND) ? '<button data-act="reply" title="Répondre">↩</button>' : ''}${c.type === 'text' && cp(c, P.SEND) && !m.thread && m.author_id !== 'system' ? '<button data-act="thread" title="Créer un fil">🧵</button>' : ''}${cp(c, P.MANAGE_MESSAGES) ? '<button data-act="pin" title="Épingler">📌</button>' : ''}
        <button data-act="copy" title="Copier le texte">📋</button>${mine ? '<button data-act="edit" title="Modifier">✏️</button>' : ''}${mine || owner ? '<button data-act="del" title="Supprimer (Maj+clic : sans confirmation)">🗑️</button>' : ''}
      </div></div>`;
    prev = m;
  }
  box.innerHTML = html;
  afterRender(box, scroll, prevH, prevTop, atBottom);
}
function afterRender(box, scroll, prevH, prevTop, atBottom) {
  const nd = box.querySelector('.newdiv');
  if (scroll === 'bottom' && nd && st.divider?.fresh !== false) { nd.scrollIntoView({ block: 'center' }); st.divider.fresh = false; }
  else if (scroll === 'bottom' || (scroll === 'keep' && atBottom)) box.scrollTop = box.scrollHeight;
  else if (scroll === 'keepTop') box.scrollTop = box.scrollHeight - prevH + prevTop;
  else box.scrollTop = prevTop;
}

function friendsHTML() {
  const tab = st.view.tab, F = st.friends.map(user);
  const tabs = [['online', 'En ligne'], ['all', 'Tous'], ['pending', `En attente${st.incoming.length ? ` (${st.incoming.length})` : ''}`], ['blocked', 'Bloqués']];
  let html = `<div class="friends"><div class="tabs">${tabs.map(([k, l]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}<button data-tab="add" class="add ${tab === 'add' ? 'on' : ''}">Ajouter un ami</button></div>`;
  const row = (u, sub, actions) => `<div class="friend">${avatar(u, true)}<div class="grow"><b>${esc(u.name)}</b><small>${sub}</small></div>${actions}</div>`;
  const statusText = subline;
  if (tab === 'add') {
    html += `<h3>Ajouter un ami</h3><p class="small">Entre le pseudo exact de la personne.</p>
      <form class="addf" id="add-friend"><input id="friend-name" placeholder="Pseudo" maxlength="24" autocomplete="off"><button class="primary" type="submit">Envoyer la demande</button></form>`;
  } else if (tab === 'blocked') {
    html += (st.blocked || []).map(id => row(user(id), 'Bloqué', `<button class="act" data-unblock="${id}" title="Débloquer">🔓</button>`)).join('') || '<div class="empty-state">Tu n\'as bloqué personne.</div>';
  } else if (tab === 'pending') {
    const rows = [...st.incoming.map(id => row(user(id), 'Demande reçue', `<button class="act" data-accept="${id}" title="Accepter">✔️</button><button class="act" data-remove="${id}" title="Refuser">✖️</button>`)),
      ...st.outgoing.map(id => row(user(id), 'Demande envoyée', `<button class="act" data-remove="${id}" title="Annuler">✖️</button>`))];
    html += rows.join('') || '<div class="empty-state">Aucune demande en attente.</div>';
  } else {
    const list = tab === 'online' ? F.filter(u => u.status === 'online') : F;
    html += `<div class="cat">${tab === 'online' ? 'En ligne' : 'Tous les amis'} — ${list.length}</div>` +
      (list.map(u => row(u, statusText(u), `<button class="act" data-dm="${u.id}" title="Message">💬</button><button class="act" data-remove="${u.id}" title="Retirer l'ami">✖️</button>`)).join('')
       || `<div class="empty-state">${tab === 'online' ? 'Aucun ami en ligne pour le moment.' : 'Pas encore d\'amis. Clique sur « Ajouter un ami » !'}</div>`);
  }
  return html + '</div>';
}

function renderMembers() {
  const box = $('#members');
  let ids;
  if (isFriendsView() || isSpecial(st.view.server) && st.view.server !== '@me') return;
  if (st.view.server === '@me' && channel()?.type === 'dm') { box.innerHTML = dmPanelHTML(channel()); return; }
  if (st.view.server === '@me') { const c = channel(); ids = c ? c.members : []; }
  else ids = server()?.members || [];
  const us = ids.map(user), s = st.view.server === '@me' ? null : server();
  const groups = [];
  if (s) {
    const hoisted = s.roles.filter(r => r.hoist && r.id !== s.id).sort((a, b) => b.position - a.position);
    const placed = new Set();
    for (const r of hoisted) {
      const l = us.filter(u => u.status !== 'offline' && !placed.has(u.id) && rolesOf(s, u.id).find(x => x.hoist)?.id === r.id);
      l.forEach(u => placed.add(u.id)); groups.push([r.name, l]);
    }
    groups.push(['En ligne', us.filter(u => u.status !== 'offline' && !placed.has(u.id))]);
  } else groups.push(['En ligne', us.filter(u => u.status !== 'offline')]);
  groups.push(['Hors ligne', us.filter(u => u.status === 'offline')]);
  box.innerHTML = groups.filter(([, l]) => l.length).map(([label, l]) => `<h4>${esc(label)} — ${l.length}</h4>` + l.map(u =>
    `<div class="mem ${u.status === 'offline' ? 'off' : ''}">${avatar(u, true)}<div data-user="${esc(u.id)}"><span style="color:${esc(s ? nameColor(u.id, 'inherit') : 'inherit')}">${esc(u.name)}</span>${s?.owner === u.id ? ' 👑' : ''}${u.id === st.me ? ' (toi)' : ''}${u.status !== 'offline' && subline(u) ? `<small>${subline(u)}</small>` : ''}</div></div>`).join('')).join('');
}

// ---------------------------------------------------------------- Navigation
function openChannel(serverId, channelId) {
  if (st.me) store.set('parlotte-view-' + st.me, { server: serverId, channel: channelId });
  if (channelId && channelId !== st.view.channel) st.divider = { channel: channelId, at: st.read[channelId] || '' };
  if (st.divider && !st.divider.at) st.divider = null; // première visite : pas de séparateur
  Object.assign(st.view, { server: serverId, channel: channelId });
  if (serverId === '@me' && channelId) st.lastDm = channelId;
  if (!isSpecial(serverId)) { st.lastServer = serverId; if (channelId) (st.lastChanOf = st.lastChanOf || {})[serverId] = channelId; }
  setReply(null); $('#results').hidden = true; document.body.classList.remove('show-side');
  if (channelId) { markRead(channelId); if (!st.msgs[channelId]) loadHistory(channelId); }
  render();
  if (channelId && innerWidth > 700) $('#input').focus();
}
const loadHistory = (cid, before) => act('history', { channelId: cid, before });

// ---------------------------------------------------------------- Messages : actions
let replyTo = null;
function setReply(id) {
  replyTo = id; const bar = $('#reply-bar');
  if (!id) { bar.hidden = true; return; }
  const m = (st.msgs[st.view.channel] || []).find(x => x.id === id);
  bar.hidden = false; bar.querySelector('span').innerHTML = `Réponse à <b>@${esc(user(m.author_id).name)}</b>`;
  $('#input').focus();
}
function startEdit(m) {
  const el = document.querySelector(`.msg[data-id="${m.id}"] .text`); if (!el) return;
  el.innerHTML = `<textarea class="edit-box" rows="2">${esc(m.content)}</textarea><div class="hint">Échap pour annuler • Entrée pour enregistrer</div>`;
  const ta = el.querySelector('textarea'); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') { ta.remove(); renderMain('keep'); }
    else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); const v = ta.value.trim(); ta.remove();
      if (v && v !== m.content) act('edit', { messageId: m.id, content: toEmojiTokens(v) }); renderMain('keep');
    }
  });
}
function openPicker(x, y, onPick, opts = {}) {
  const p = $('#picker'), custom = usableEmojis();
  p.innerHTML = (custom.length ? `<div class="pk-h">Emojis du serveur</div>${custom.map(e => `<button data-tok="<:${esc(e.name)}:${e.id}>" data-name="${esc(e.name)}" title=":${esc(e.name)}:"><img class="emoji" src="${esc(e.url)}" alt=""></button>`).join('')}<div class="pk-h">Classiques</div>` : '')
    + (opts.big ? EMOJIS_BIG : EMOJIS).map(e => `<button>${e}</button>`).join('');
  p.hidden = false;
  const w = 6 * 34 + 14, h = Math.min(320, p.scrollHeight);
  p.style.left = Math.max(8, Math.min(x, innerWidth - w - 8)) + 'px'; p.style.top = Math.max(8, Math.min(y, innerHeight - h - 8)) + 'px';
  p.onclick = ev => { const b = ev.target.closest('button'); if (!b) return; onPick(b.dataset.tok || b.textContent, b.dataset.name); p.hidden = true; };
}

// Indicateur « en train d'écrire »
const typers = {}; // channelId -> {userId: timeout}
function showTyping(cid, uid) {
  const t = (typers[cid] = typers[cid] || {}); clearTimeout(t[uid]);
  t[uid] = setTimeout(() => clearTyping(cid, uid), 5000); renderTyping();
}
function clearTyping(cid, uid) { if (typers[cid]) { clearTimeout(typers[cid][uid]); delete typers[cid][uid]; } renderTyping(); }
function renderTyping() {
  const names = Object.keys(typers[st.view.channel] || {}).map(u => user(u).name);
  $('#typing').textContent = !names.length ? '' : names.length === 1 ? `${names[0]} est en train d'écrire…` : `${names.join(', ')} écrivent…`;
}
let lastTyping = 0;

// ---------------------------------------------------------------- Recherche (côté serveur)
const S = window.DiscordLikeSearch;
function suggestCtx() {
  const ids = st.view.server === '@me' ? [...new Set(st.dms.flatMap(c => c.members))] : server()?.members || [];
  return { users: Object.fromEntries(ids.map(id => [id, user(id)])),
    channels: Object.fromEntries((st.view.server === '@me' ? [] : server()?.channels || []).map(c => [c.id, c])), messages: [] };
}
function runSearch() {
  const query = $('#q').value.trim(); if (query) act('search', { scope: st.view.server, query });
}
function showResults(res) {
  $('#results').hidden = false;
  $('#res-count').textContent = `${res.total_results} résultat${res.total_results > 1 ? 's' : ''}`;
  $('#res-list').innerHTML = res.messages.map(([m]) => { const c = chanById(m.channel_id), u = user(m.author_id);
    return `<div class="res" data-open="${m.channel_id}" data-mid="${m.id}"><div class="meta"><b style="color:${esc(u.color)}">${esc(u.name)}</b> · ${c ? esc(chanLabel(c)) : ''} · ${dayLabel(m.timestamp)} ${time(m.timestamp)}</div><div>${S.highlight(m.content, res.query.content)}</div></div>`; }).join('')
    || '<p class="small" style="padding:8px">Aucun résultat</p>';
}
let sItems = [], sActive = -1;
function renderSugg() {
  sItems = S.suggest(suggestCtx(), $('#q').value); sActive = sItems.length ? 0 : -1;
  $('#sugg').innerHTML = sItems.map((it, i) => `<li data-i="${i}" class="${i ? '' : 'active'}"><span>${esc(it.label)}</span><span class="h">${esc(it.hint)}</span></li>`).join('');
  $('#sugg').classList.toggle('open', sItems.length > 0 && document.activeElement === $('#q'));
}
function applySugg(i) { const p = $('#q').value.split(/(\s+)/); p[p.length - 1] = sItems[i].insert; $('#q').value = p.join(''); $('#q').focus(); renderSugg(); }

// ---------------------------------------------------------------- Boîtes de dialogue et toasts
function ask(title, text, okLabel, cb, value = '') {
  const d = $('#dlg'); $('#dlg-title').textContent = title; $('#dlg-text').textContent = text || '';
  $('#dlg-ok').textContent = okLabel; $('#dlg-input').value = value; d.returnValue = '';
  d.onclose = () => { const v = $('#dlg-input').value.trim(); if (d.returnValue === 'ok' && v) cb(v); };
  d.showModal(); $('#dlg-input').select();
}
let toastTimer;
function toast(text, bad) {
  const t = $('#toast'); t.textContent = text; t.className = bad ? 'bad' : ''; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// ---------------------------------------------------------------- Événements
$('#servers').addEventListener('click', e => {
  const b = e.target.closest('[data-srv]');
  if (b) {
    if (b.dataset.srv === '@me') openChannel('@me', null);
    else { const s = st.servers.find(x => x.id === b.dataset.srv); openChannel(s.id, firstText(s)); }
  }
  if (e.target.closest('#add-server')) ask('Créer un serveur', 'Donne-lui un nom. Tu pourras inviter tes amis avec un code.', 'Créer', name => act('createServer', { name }));
  if (e.target.closest('#join-server')) ask('Rejoindre un serveur', 'Colle le code d\'invitation qu\'un ami t\'a donné.', 'Rejoindre', code => act('joinServer', { code }));
});
$('#sidebar').addEventListener('click', e => {
  const gear = e.target.closest('[data-chan-settings]'); if (gear) { e.stopPropagation(); return openChannelSettings(gear.dataset.chanSettings); }
  if (e.target.closest('#srv-settings')) return openServerSettings();
  const vch = e.target.closest('[data-voice-id]'); if (vch) return joinVoice(vch.dataset.voiceId);
  const c = e.target.closest('[data-chan-id]'); if (c) return openChannel(st.view.server, c.dataset.chanId);
  if (e.target.closest('[data-friends]')) return openChannel('@me', null);
  const s = server();
  if (e.target.closest('#add-channel')) ask('Créer un salon textuel', '', 'Créer', name => act('createChannel', { serverId: s.id, name }));
  if (e.target.closest('#add-voice')) ask('Créer un salon vocal', '', 'Créer', name => act('createChannel', { serverId: s.id, name, type: 'voice' }));
  if (e.target.closest('#invite')) openInvite(s);
  if (e.target.closest('#leave') && confirm(`Quitter ${s.name} ?`)) act('leaveServer', { serverId: s.id }).then(() => openChannel('@servers', null));
  if (e.target.closest('#delete-server') && confirm(`Supprimer définitivement ${s.name} et tous ses messages ?`)) act('deleteServer', { serverId: s.id }).then(() => openChannel('@servers', null));
  if (e.target.closest('#logout')) doLogout();
});
$('#view').addEventListener('click', e => {
  const tab = e.target.closest('[data-tab]'); if (tab) { st.view.tab = tab.dataset.tab; renderMain(); if (st.view.tab === 'add') $('#friend-name').focus(); return; }
  const t = e.target.closest('[data-accept],[data-remove],[data-dm]');
  if (t) {
    if (t.dataset.accept) act('friendAccept', { userId: t.dataset.accept });
    if (t.dataset.remove && confirm(`${st.friends.includes(t.dataset.remove) ? 'Retirer' : 'Supprimer la demande de'} ${user(t.dataset.remove).name} ?`)) act('friendRemove', { userId: t.dataset.remove });
    if (t.dataset.dm) act('openDM', { userId: t.dataset.dm });
    return;
  }
  if (e.target.closest('#load-more')) { const l = st.msgs[st.view.channel]; return loadHistory(st.view.channel, l[0]?.timestamp); }
  const g = e.target.closest('[data-goto]'); if (g) return openChannel(st.view.server, g.dataset.goto);
  const j = e.target.closest('[data-jump]');
  if (j) { const el = document.querySelector(`.msg[data-id="${j.dataset.jump}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); } return; }
  const row = e.target.closest('.msg'); if (!row) return;
  const m = (st.msgs[st.view.channel] || []).find(x => x.id === row.dataset.id); if (!m) return;
  const r = e.target.closest('[data-react]'); if (r) return act('react', { messageId: m.id, emoji: r.dataset.react });
  const a = e.target.closest('[data-act]')?.dataset.act;
  if (a === 'react') { const rc = e.target.getBoundingClientRect(); openPicker(rc.left - 180, rc.bottom + 4, em => act('react', { messageId: m.id, emoji: em })); }
  if (a === 'reply') setReply(m.id);
  if (a === 'pin') act('pin', { messageId: m.id });
  if (a === 'edit') startEdit(m);
  if (a === 'copy') { try { navigator.clipboard.writeText(m.content || '').then(() => toast('Texte copié')); } catch { toast('Copie impossible', true); } }
  if (a === 'thread') ask('Créer un fil', 'Donne un nom au fil (ou laisse le début du message).', 'Créer', name => act('createThread', { channelId: c0().id, messageId: m.id, name }), (m.content || '').slice(0, 40) || 'Nouveau fil');
  if (a === 'del' && (e.shiftKey || confirm('Supprimer ce message ?'))) act('delete', { messageId: m.id });
});
$('#view').addEventListener('submit', e => {
  if (e.target.id !== 'add-friend') return; e.preventDefault();
  const name = $('#friend-name').value.trim(); if (name) act('friendRequest', { username: name }).then(() => { const i = $('#friend-name'); if (i) i.value = ''; });
});
const input = $('#input');
input.addEventListener('input', () => {
  input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px';
  if (Date.now() - lastTyping > 3000 && input.value) { lastTyping = Date.now(); act('typing', { channelId: st.view.channel }); }
});
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault(); sendMessage();
  } else if (e.key === 'ArrowUp' && !input.value) {
    const mine = (st.msgs[st.view.channel] || []).filter(m => m.author_id === st.me).pop();
    if (mine) { e.preventDefault(); startEdit(mine); }
  } else if (e.key === 'Escape') setReply(null);
});
$('#cancel-reply').onclick = () => setReply(null);
$('#composer').onsubmit = e => e.preventDefault();
$('#menu').onclick = () => goBack(); // téléphone : retour à la liste (espaces.js)
$('#toggle-members').onclick = () => $('#members').classList.toggle('hide');
$('#close-results').onclick = () => { $('#results').hidden = true; };
$('#res-list').addEventListener('click', e => {
  const r = e.target.closest('[data-open]'); if (!r) return;
  const c = chanById(r.dataset.open); if (!c) return;
  jumpAfterLoad = r.dataset.mid || null;
  if (c.id !== st.view.channel) openChannel(c.type === 'dm' ? '@me' : c.server_id, c.id); else flashJump();
  if (st.msgs[c.id]) flashJump();
});
const q = $('#q');
q.addEventListener('input', renderSugg); q.addEventListener('focus', renderSugg);
q.addEventListener('blur', () => setTimeout(() => $('#sugg').classList.remove('open'), 120));
q.addEventListener('keydown', e => {
  const open = $('#sugg').classList.contains('open'), last = q.value.split(/\s+/).pop();
  if (open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
    e.preventDefault(); sActive = (sActive + (e.key === 'ArrowDown' ? 1 : sItems.length - 1)) % sItems.length;
    [...$('#sugg').children].forEach((li, i) => li.classList.toggle('active', i === sActive));
  } else if (open && (e.key === 'Tab' || (e.key === 'Enter' && last && !/:\S/.test(last)))) { e.preventDefault(); applySugg(sActive); }
  else if (e.key === 'Enter') { e.preventDefault(); $('#sugg').classList.remove('open'); runSearch(); }
  else if (e.key === 'Escape') { q.value = ''; q.blur(); $('#results').hidden = true; }
});
$('#sugg').addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); applySugg(+li.dataset.i); } });
document.addEventListener('click', e => { if (!e.target.closest('#picker,[data-act="react"],#emoji-btn')) $('#picker').hidden = true; });
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && st.me) { e.preventDefault(); q.focus(); } });


// ---------------------------------------------------------------- Pièces jointes
const MAX_FILE = 25 * 1024 * 1024;
const pendingFiles = []; // {key, file, preview, upload (Promise), result}
const fmtSize = n => n < 1024 ? n + ' o' : n < 1048576 ? (n / 1024).toFixed(0) + ' Ko' : (n / 1048576).toFixed(1) + ' Mo';
const fileIcon = t => /^image\//.test(t) ? '🖼️' : /^video\//.test(t) ? '🎞️' : /^audio\//.test(t) ? '🎵' : /pdf/.test(t) ? '📕' : /zip|rar|7z|compressed/.test(t) ? '🗜️' : '📄';
function attachmentsHTML(list) {
  if (!list || !list.length) return '';
  return '<div class="atts">' + list.map(a => {
    const url = esc(a.url);
    if (/^image\/(png|jpeg|gif|webp)$/.test(a.content_type)) return `<img class="att-img" src="${url}" alt="${esc(a.filename)}" loading="lazy" data-full="${url}">`;
    if (/^video\/(mp4|webm)$/.test(a.content_type)) return `<video class="att-video" src="${url}" controls preload="metadata"></video>`;
    if (a.voice) return voiceNoteHTML(a);
    if (/^audio\/(mpeg|ogg|wav|webm|mp4|aac)$/.test(a.content_type)) return `<audio src="${url}" controls preload="none"></audio>`;
    return `<a class="att-file" href="${url}" download="${esc(a.filename)}"><span class="ico">${fileIcon(a.content_type)}</span><span>${esc(a.filename)}<small>${fmtSize(a.size)}</small></span></a>`;
  }).join('') + '</div>';
}
function upload(file) {
  return fetch('/upload', { method: 'POST', body: file, headers: {
    'Authorization': 'Bearer ' + store.get('parlotte-token'),
    'Content-Type': file.type || 'application/octet-stream',
    'X-Filename': encodeURIComponent(file.name || 'image.png') } })
    .then(async r => { const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Envoi impossible'); return j; });
}
function addFiles(files) {
  if (!st.view.channel) return toast('Ouvre un salon ou une conversation d\'abord', true);
  for (const file of files) {
    if (pendingFiles.length >= 10) { toast('10 fichiers maximum par message', true); break; }
    if (file.size > MAX_FILE) { toast(`${file.name} est trop lourd (25 Mo max)`, true); continue; }
    const p = { key: Math.random().toString(36).slice(2), file, preview: /^image\//.test(file.type) ? URL.createObjectURL(file) : null };
    p.upload = upload(file).then(r => (p.result = r)).catch(e => { toast(e.message, true); removePending(p.key); });
    pendingFiles.push(p);
  }
  renderPending(); input.focus();
}
function removePending(key) {
  const i = pendingFiles.findIndex(p => p.key === key);
  if (i !== -1) { if (pendingFiles[i].preview) URL.revokeObjectURL(pendingFiles[i].preview); pendingFiles.splice(i, 1); }
  renderPending();
}
function renderPending() {
  const box = $('#pending'); box.hidden = !pendingFiles.length;
  box.innerHTML = pendingFiles.map(p => `<div class="pend ${p.result ? '' : 'up'}" title="${esc(p.file.name)}">
    ${p.preview ? `<img src="${p.preview}" alt="">` : `<div class="ico">${fileIcon(p.file.type)}</div>`}
    <div class="nm">${p.result ? '' : '⏳ '}${esc(p.file.name)}</div><button type="button" data-unpend="${p.key}" title="Retirer">✕</button></div>`).join('');
  pendingFiles.forEach(p => p.upload.then(() => { const el = box.querySelector(`[data-unpend="${p.key}"]`)?.parentElement; if (el) { el.classList.remove('up'); el.querySelector('.nm').textContent = p.file.name; } }));
}
let sending = false;
async function sendMessage() {
  if (sending) return;
  const content = input.value.trim(), files = pendingFiles.slice();
  if (!content && !files.length) return;
  sending = true;
  try {
    await Promise.all(files.map(p => p.upload));
    const attachments = files.filter(p => p.result).map(p => p.result.id);
    if (!content && !attachments.length) return;
    await request('send', { channelId: st.view.channel, content: toEmojiTokens(content), replyTo, attachments });
    input.value = ''; input.style.height = 'auto'; setReply(null); lastTyping = 0;
    files.forEach(p => removePending(p.key));
  } catch (e) { toast(e.message, true); } finally { sending = false; }
}
$('#attach').onclick = () => $('#file').click();
$('#file').onchange = e => { addFiles([...e.target.files]); e.target.value = ''; };
$('#pending').addEventListener('click', e => { const b = e.target.closest('[data-unpend]'); if (b) removePending(b.dataset.unpend); });
input.addEventListener('paste', e => {
  const files = [...(e.clipboardData?.files || [])]; if (files.length) { e.preventDefault(); addFiles(files); }
});
let dragDepth = 0;
const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
document.addEventListener('dragenter', e => { if (hasFiles(e) && st.me && st.view.channel) { dragDepth++; $('#drop').hidden = false; } });
document.addEventListener('dragleave', e => { if (hasFiles(e) && --dragDepth <= 0) { dragDepth = 0; $('#drop').hidden = true; } });
document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); dragDepth = 0; $('#drop').hidden = true; if (st.me) addFiles([...e.dataTransfer.files]); });
// Visionneuse d'images
$('#view').addEventListener('click', e => {
  const img = e.target.closest('.att-img'); if (!img) return;
  const lb = $('#lightbox'); lb.querySelector('img').src = img.dataset.full; lb.querySelector('a').href = img.dataset.full; lb.hidden = false;
});
$('#lightbox').onclick = e => { if (e.target.tagName !== 'A') $('#lightbox').hidden = true; };

// ---------------------------------------------------------------- Profils
let profAvatar; // undefined = inchangé, null = retirer, sinon id de fichier envoyé
function openProfile() {
  const p = st.profile || {}, me = user(st.me); profAvatar = undefined;
  $('#prof-presence').value = p.presence || 'online'; $('#prof-custom').value = p.customStatus || '';
  $('#prof-about').value = p.about || ''; $('#prof-color').value = p.color || me.color;
  $('#prof-av').innerHTML = avatar(me); $('#profile-dlg').showModal();
}
$('#prof-upload').onclick = () => $('#prof-file').click();
$('#prof-remove').onclick = () => { profAvatar = null; $('#prof-av').innerHTML = avatar({ ...user(st.me), avatar: null, color: $('#prof-color').value }); };
$('#prof-file').onchange = async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > MAX_FILE) return toast('Image trop lourde (25 Mo max)', true);
  try { const r = await upload(f); profAvatar = r.id; $('#prof-av').innerHTML = avatar({ ...user(st.me), avatar: r.url }); }
  catch (err) { toast(err.message, true); }
};
$('#profile-dlg').addEventListener('close', () => {
  if ($('#profile-dlg').returnValue !== 'ok') return;
  const payload = { presence: $('#prof-presence').value, customStatus: $('#prof-custom').value, about: $('#prof-about').value, color: $('#prof-color').value };
  if (profAvatar !== undefined) payload.avatar = profAvatar;
  act('setProfile', payload).then(() => toast('Profil enregistré'));
});
$('#me').addEventListener('click', e => { if (e.target.closest('#open-profile')) openProfile(); });

// Carte de profil quand on clique sur un nom ou un avatar
document.addEventListener('click', e => {
  const card = $('#card');
  const t = e.target.closest('[data-user]');
  if (!t || e.target.closest('#card,#me,#prof-av,#dlg,#profile-dlg,#status-menu') || (e.target.closest('#side-list') && !e.target.closest('.vmem'))) { if (!e.target.closest('#card')) card.hidden = true; return; }
  const u = user(t.dataset.user); if (!u || u.id === 'system') return;
  const friend = st.friends.includes(u.id);
  card.innerHTML = `<div class="ban" style="background:${esc(u.color)}"></div><div class="in">${avatar(u, true)}
    <h3>${esc(u.name)}</h3><div class="small">${esc(STATUS[u.status] || '')}</div>
    ${u.customStatus || u.statusEmoji ? `<div class="cs">${statusLine({ customStatus: u.customStatus, statusEmoji: u.statusEmoji })}</div>` : ''}
    ${u.activity ? `<div class="act">🎮 Joue à <b>${esc(u.activity.name)}</b><small>depuis ${esc(sinceText(u.activity.since))}</small></div>` : ''}
    ${userVolumeHTML(u)}${u.about ? `<div class="ab">${esc(u.about)}</div>` : ''}
    ${cardRolesHTML(u)}
    ${u.id === st.me ? '<button class="primary msgbtn" id="card-edit">Modifier mon profil</button>'
      : friend ? `<button class="primary msgbtn" data-carddm="${esc(u.id)}">Envoyer un message</button>`
      : (st.blocked || []).includes(u.id) ? '' : `<button class="primary msgbtn green" data-cardadd="${esc(u.name)}">Ajouter en ami</button>`}
    ${u.id !== st.me ? ((st.blocked || []).includes(u.id) ? `<button class="link block-link" data-unblock="${esc(u.id)}">Débloquer</button>` : `<button class="link block-link danger-link" data-block="${esc(u.id)}">Bloquer</button>`) : ''}</div>`;
  const r = t.getBoundingClientRect();
  card.style.left = Math.max(8, Math.min(r.left, innerWidth - 290)) + 'px';
  card.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - 320)) + 'px';
  card.hidden = false;
});
$('#card').addEventListener('click', e => {
  if (e.target.closest('#card-edit')) { $('#card').hidden = true; openProfile(); }
  const dm = e.target.closest('[data-carddm]'); if (dm) { $('#card').hidden = true; act('openDM', { userId: dm.dataset.carddm }); }
  const add = e.target.closest('[data-cardadd]'); if (add) { $('#card').hidden = true; act('friendRequest', { username: add.dataset.cardadd }); }
  const s = server();
  const role = e.target.closest('[data-togglerole]');
  if (role && s) { const uid = role.dataset.uid, cur = s.memberRoles[uid] || [], rid = role.dataset.togglerole;
    act('setMemberRoles', { serverId: s.id, userId: uid, roles: cur.includes(rid) ? cur.filter(x => x !== rid) : [...cur, rid] }); $('#card').hidden = true; }
  const k = e.target.closest('[data-kick]'); if (k && s && confirm(`Expulser ${user(k.dataset.kick).name} ?`)) { $('#card').hidden = true; act('kick', { serverId: s.id, userId: k.dataset.kick }); }
  const b = e.target.closest('[data-ban]'); if (b && s && confirm(`Bannir ${user(b.dataset.ban).name} ? Il ne pourra plus revenir avec le code d'invitation.`)) { $('#card').hidden = true; act('ban', { serverId: s.id, userId: b.dataset.ban }); }
});


// ---------------------------------------------------------------- Vocal (WebRTC, maillage pair-à-pair)
// Le son va directement d'un appareil à l'autre ; le serveur ne fait que transmettre les « poignées de main ».
const vc = { channel: null, stream: null, camera: null, screen: null, muted: false, deafened: false, peers: new Map(), joining: null, focus: null, stageCollapsed: false };
const RTC_CONFIG = { iceServers: [] }; // même wifi : pas besoin de serveur STUN/TURN
const speaking = new Set();
let audioCtx = null;
const meters = new Map(); // userId -> {analyser, data}

function voiceChannelHTML(c) {
  const members = st.voice[c.id] || [];
  return `<button class="chan voice ${vc.channel === c.id ? 'on' : ''}" data-voice-id="${c.id}" title="Rejoindre le vocal">🔊 ${esc(c.name)}</button>` +
    members.map(m => { const u = user(m.id);
      return `<div class="vmem ${speaking.has(m.id) ? 'speaking' : ''}" data-speaker="${esc(m.id)}">${avatar(u)}<span>${esc(u.name)}</span><i>${m.screen ? '<span title="Partage son écran" class="live">EN DIRECT</span>' : ''}${m.camera ? '📷' : ''}${m.deafened ? '🔇' : m.muted ? '🤐' : ''}</i></div>`; }).join('');
}
function where(cid) {
  const c = chanById(cid); if (!c) return '';
  if (c.type === 'dm') return c.group ? 'Appel · ' + groupName(c) : 'Appel avec ' + dmOther(c).name;
  const s = st.servers.find(x => x.id === c.server_id); return `${c.name} / ${s ? s.name : ''}`;
}
function renderVoicePanel() {
  const p = $('#voice-panel'), cid = vc.channel || vc.joining;
  document.body.classList.toggle('in-voice', !!cid);
  p.hidden = !cid; if (!cid) return;
  const states = [...vc.peers.values()].map(x => x.pc.connectionState);
  const connecting = vc.joining || states.some(s => s === 'new' || s === 'connecting');
  $('#vp-status').textContent = connecting ? 'Connexion…' : 'Connecté au vocal';
  $('#vp-status').className = connecting ? 'warn' : 'ok';
  $('#vp-where').textContent = where(cid);
  p.querySelector('.vp-btns')?.remove();
  p.insertAdjacentHTML('beforeend', `<div class="vp-btns">
    <button id="vp-mute" class="${vc.muted ? 'off' : ''}" title="${vc.muted ? 'Réactiver le micro' : 'Couper le micro'}">${vc.muted ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M9 9v2a3 3 0 005.1 2.1M15 10V6a3 3 0 00-5.7-1.3M5 11a7 7 0 0011.3 5.5M19 11a7 7 0 01-.7 3M12 18v3"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>'}</button>
    <button id="vp-deaf" class="${vc.deafened ? 'off' : ''}" title="${vc.deafened ? 'Réactiver le son' : 'Couper le son'}">${vc.deafened ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18M4 15v-3a8 8 0 0112.9-6.3M20 12v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><path d="M16 16v3a2 2 0 002 2h1"/></svg>' : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 15v-3a8 8 0 0116 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/></svg>'}</button>
    ${cp(chanById(cid), P.VIDEO) ? `<button id="vp-cam" class="${vc.camera ? 'on' : ''}" title="${vc.camera ? 'Couper la caméra' : 'Activer la caméra'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/></svg></button>` : ''}
    ${canShareScreen && cp(chanById(cid), P.VIDEO) ? `<button id="vp-screen" class="${vc.screen ? 'on' : ''}" title="${vc.screen ? 'Arrêter le partage' : 'Partager mon écran'}"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg></button>` : ''}
    ${vc.channel && cp(chanById(cid), P.SPEAK) ? '<button id="vp-sb" title="Soundboard" aria-label="Soundboard"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg></button>' : ''}</div>`);
  const call = $('#call'); call.classList.toggle('active', vc.channel && vc.channel === st.view.channel);
  call.title = call.classList.contains('active') ? 'Raccrocher' : 'Lancer un appel vocal';
}

async function joinVoice(cid) {
  if (vc.channel === cid || vc.joining) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    return toast(`Le vocal a besoin d'une connexion sécurisée : ouvre https://${location.hostname}:3443`, true);
  if (vc.channel) leaveVoice();
  vc.joining = cid; renderVoicePanel();
  try {
    vc.stream = await getMic();      // micro brut (voix.js : appareil, suppression de bruit…)
    vc.send = makeSendStream(vc.stream); // ce qu'on envoie : passe par la porte (sensibilité / appuyer pour parler)
  } catch (e) {
    vc.joining = null; renderVoicePanel();
    return toast(e.name === 'NotAllowedError' ? 'Micro refusé : autorise le micro pour ce site dans ton navigateur' : 'Aucun micro trouvé', true);
  }
  if (chanById(cid)?.type !== 'dm' && !cp(chanById(cid), P.SPEAK)) { vc.muted = true; toast('Tu peux écouter mais pas parler dans ce salon'); }
  applyMute();
  try {
    const r = await request('voiceJoin', { channelId: cid });
    vc.channel = cid; vc.joining = null;
    watchSpeaking(st.me, vc.stream);
    r.peers.forEach(uid => createPeer(uid));
    sendVoiceState(); playTone('join'); hideRing();
  } catch (e) { stopLocal(); vc.joining = null; toast(e.message, true); }
  renderVoicePanel(); renderSide(); if (chanById(cid)?.type === 'dm') renderMain('keep');
}
function stopLocal() { vc.stream?.getTracks().forEach(t => t.stop()); vc.stream = null; stopSendStream(); }
function leaveVoice(serverAlreadyKnows) {
  if (!vc.channel && !vc.stream) return;
  const cid = vc.channel;
  if (!serverAlreadyKnows && ws?.readyState === 1) request('voiceLeave').catch(() => {});
  [...vc.peers.keys()].forEach(closePeer);
  stopVideo('camera'); stopVideo('screen');
  stopLocal(); stopMeter(st.me); vc.channel = null; vc.joining = null; vc.focus = null; renderStage();
  playTone('leave'); renderVoicePanel(); renderSide();
  if (cid && chanById(cid)?.type === 'dm') renderMain('keep');
}
const rtcSend = (to, data) => request('rtc', { to, data }).catch(() => {});

// « Perfect negotiation » : chaque côté peut (re)négocier quand il ajoute/retire la caméra ou l'écran,
// et en cas d'offres croisées, le côté « poli » cède.
function createPeer(uid) {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  const audio = document.createElement('audio'); audio.autoplay = true; audio.playsInline = true; audio.muted = vc.deafened;
  $('#audios').append(audio);
  const peer = { pc, audio, pending: [], polite: st.me < uid, makingOffer: false, ignoreOffer: false, senders: {}, streams: new Map() };
  vc.peers.set(uid, peer);
  pc.onnegotiationneeded = async () => {
    try { peer.makingOffer = true; await pc.setLocalDescription(); rtcSend(uid, { sdp: pc.localDescription }); }
    catch (e) { console.warn('negotiation', e); } finally { peer.makingOffer = false; }
  };
  pc.onicecandidate = e => { if (e.candidate) rtcSend(uid, { candidate: e.candidate.toJSON() }); };
  pc.ontrack = e => {
    const stream = e.streams[0]; if (!stream) return;
    if (e.track.kind === 'audio') { audio.srcObject = stream; audio.play().catch(() => {}); routePeerAudio(uid, peer, stream); watchSpeaking(uid, stream); }
    else { peer.streams.set(stream.id, stream); stream.onremovetrack = () => { if (!stream.getTracks().length) { peer.streams.delete(stream.id); renderStage(); } }; renderStage(); }
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed') { toast(`Connexion audio impossible avec ${user(uid).name} (réseau qui bloque les appareils entre eux ?)`, true); pc.restartIce?.(); }
    renderVoicePanel();
  };
  (vc.send || vc.stream).getTracks().forEach(t => pc.addTrack(t, vc.send || vc.stream));
  for (const kind of ['camera', 'screen']) { const st_ = vc[kind]; if (st_) peer.senders[kind] = pc.addTrack(st_.getVideoTracks()[0], st_); }
  return peer;
}
async function onRtc(from, data) {
  if (!vc.channel || !vc.stream) return;
  const peer = vc.peers.get(from) || createPeer(from), pc = peer.pc;
  try {
    if (data.sdp) {
      const collision = data.sdp.type === 'offer' && (peer.makingOffer || pc.signalingState !== 'stable');
      peer.ignoreOffer = !peer.polite && collision;
      if (peer.ignoreOffer) return;
      await pc.setRemoteDescription(data.sdp);
      for (const c of peer.pending) await pc.addIceCandidate(c).catch(() => {});
      peer.pending = [];
      if (data.sdp.type === 'offer') { await pc.setLocalDescription(); rtcSend(from, { sdp: pc.localDescription }); }
    } else if (data.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.candidate).catch(e => { if (!peer.ignoreOffer) console.warn(e); });
      else peer.pending.push(data.candidate);
    }
  } catch (e) { console.warn('rtc', e); }
}

// Caméra et partage d'écran
const canShareScreen = !!navigator.mediaDevices?.getDisplayMedia;
async function toggleVideo(kind) {
  if (!vc.channel) return;
  if (vc[kind]) return stopVideo(kind);
  let stream;
  try {
    stream = kind === 'camera'
      ? await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24 } } })
      : await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 15 } }, audio: false });
  } catch (e) {
    if (e.name !== 'NotAllowedError' || kind === 'camera') toast(kind === 'camera' ? 'Caméra refusée ou introuvable' : 'Partage d\'écran impossible', true);
    return;
  }
  if (!vc.channel) { stream.getTracks().forEach(t => t.stop()); return; }
  vc[kind] = stream;
  const track = stream.getVideoTracks()[0];
  if (kind === 'screen') track.contentHint = 'detail';
  track.onended = () => stopVideo(kind); // « Arrêter le partage » du navigateur
  vc.peers.forEach(p => { p.senders[kind] = p.pc.addTrack(track, stream); });
  sendVoiceState(); renderVoicePanel(); renderStage();
}
function stopVideo(kind) {
  const stream = vc[kind]; if (!stream) return;
  vc[kind] = null;
  stream.getTracks().forEach(t => t.stop());
  vc.peers.forEach(p => { if (p.senders[kind]) { try { p.pc.removeTrack(p.senders[kind]); } catch {} delete p.senders[kind]; } });
  if (vc.focus?.endsWith(':' + kind) && vc.focus.startsWith(st.me)) vc.focus = null;
  sendVoiceState(); renderVoicePanel(); renderStage();
}

// Scène vidéo : grille de tuiles, clic = mise en avant
const tiles = new Map(); // clé -> élément
function renderStage() {
  const stage = $('#stage');
  const want = [];
  if (vc.channel) {
    for (const m of st.voice[vc.channel] || []) {
      for (const kind of ['screen', 'camera']) {
        let stream = null;
        if (m.id === st.me) stream = vc[kind];
        else if (m[kind]) stream = vc.peers.get(m.id)?.streams.get(m[kind]) || null;
        if (stream) want.push({ key: `${m.id}:${kind}`, uid: m.id, kind, stream });
      }
    }
  }
  if (vc.focus && !want.some(w => w.key === vc.focus)) vc.focus = null;
  for (const [key, el] of tiles) if (!want.some(w => w.key === key)) { el.querySelector('video').srcObject = null; el.remove(); tiles.delete(key); }
  for (const w of want) {
    let el = tiles.get(w.key);
    if (!el) {
      el = document.createElement('div'); el.className = 'tile'; el.dataset.tile = w.key;
      el.innerHTML = `<video autoplay playsinline muted></video><span class="tl"></span><button class="tile-full" title="Plein écran">⛶</button>`;
      tiles.set(w.key, el);
    }
    const v = el.querySelector('video');
    if (v.srcObject !== w.stream) { v.srcObject = w.stream; v.play().catch(() => {}); }
    el.classList.toggle('mine', w.uid === st.me && w.kind === 'camera');
    el.classList.toggle('screen', w.kind === 'screen');
    el.classList.toggle('focus', vc.focus === w.key);
    el.dataset.speaker = w.kind === 'camera' ? w.uid : '';
    el.classList.toggle('speaking', w.kind === 'camera' && speaking.has(w.uid));
    el.querySelector('.tl').textContent = `${w.kind === 'screen' ? '🖥️ ' : ''}${user(w.uid).name}${w.uid === st.me ? ' (toi)' : ''}`;
    stage.append(el);
  }
  stage.classList.toggle('has-focus', !!vc.focus);
  stage.classList.toggle('collapsed', !!vc.stageCollapsed);
  stage.hidden = !want.length;
  $('#stage-bar').hidden = !want.length;
  $('#stage-bar b').textContent = `🎥 ${want.length} vidéo${want.length > 1 ? 's' : ''} · ${where(vc.channel)}`;
  $('#stage-toggle').textContent = vc.stageCollapsed ? 'Afficher' : 'Réduire';
}
$('#stage').addEventListener('click', e => {
  const t = e.target.closest('.tile'); if (!t) return;
  if (e.target.closest('.tile-full')) { const v = t.querySelector('video'); (v.requestFullscreen || v.webkitEnterFullscreen)?.call(v); return; }
  vc.focus = vc.focus === t.dataset.tile ? null : t.dataset.tile; renderStage();
});
$('#stage-toggle').onclick = () => { vc.stageCollapsed = !vc.stageCollapsed; renderStage(); };

function closePeer(uid) {
  const p = vc.peers.get(uid); if (!p) return;
  p.pc.close(); p.audio.srcObject = null; p.audio.remove(); try { p.gain?.disconnect(); p.src?.disconnect(); } catch {} vc.peers.delete(uid); stopMeter(uid); renderStage();
}
function onVoiceState(cid, members) {
  const before = (st.voice[cid] || []).map(m => m.id);
  if (members.length) st.voice[cid] = members; else delete st.voice[cid];
  if (cid === vc.channel) {
    const ids = members.map(m => m.id);
    [...vc.peers.keys()].filter(u => !ids.includes(u)).forEach(closePeer);
    if (ids.some(u => !before.includes(u) && u !== st.me)) playTone('join');
    if (before.some(u => !ids.includes(u) && u !== st.me)) playTone('leave');
  }
  if (ringing === cid && !members.length) hideRing();
  if (cid === vc.channel) renderStage();
  renderRail(); renderSide(); renderVoicePanel();
  if (cid === st.view.channel) renderMain('keep');
}
function applyMute() {
  (vc.send || vc.stream)?.getAudioTracks().forEach(t => (t.enabled = !(vc.muted || vc.deafened)));
  updatePeerVolumes(); // casque coupé, volume par personne (voix.js)
}
const sendVoiceState = () => request('voiceState', { muted: vc.muted, deafened: vc.deafened, camera: vc.camera?.id || null, screen: vc.screen?.id || null }).catch(() => {});

// Détection de qui parle (anneau vert)
function watchSpeaking(uid, stream) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
    stopMeter(uid);
    const src = audioCtx.createMediaStreamSource(stream), analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512; src.connect(analyser);
    meters.set(uid, { src, analyser, data: new Uint8Array(analyser.fftSize) });
  } catch (e) { console.warn('meter', e); }
}
function stopMeter(uid) { const m = meters.get(uid); if (m) { try { m.src.disconnect(); } catch {} meters.delete(uid); } speaking.delete(uid); }
setInterval(() => {
  for (const [uid, m] of meters) {
    m.analyser.getByteTimeDomainData(m.data);
    let sum = 0; for (const v of m.data) sum += (v - 128) ** 2;
    const level = Math.sqrt(sum / m.data.length);
    if (uid === st.me) micLevel(level); // porte de bruit / vumètre des paramètres
    const loud = level > 6 && !(uid === st.me && (vc.muted || vc.deafened || !micOpen()));
    if (loud !== speaking.has(uid)) {
      loud ? speaking.add(uid) : speaking.delete(uid);
      document.querySelectorAll(`[data-speaker="${CSS.escape(uid)}"]`).forEach(el => el.classList.toggle('speaking', loud));
    }
  }
}, 120);

// Petits sons (générés, pas de fichier audio)
function playTone(kind) {
  if (prefs.sounds === false && kind !== 'ring') return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const notes = { join: [523, 784], leave: [784, 523], ring: [659, 880, 659, 880] }[kind];
    notes.forEach((f, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t = audioCtx.currentTime + i * 0.12;
      o.frequency.value = f; o.type = 'sine'; g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g).connect(audioCtx.destination); o.start(t); o.stop(t + 0.12);
    });
  } catch {}
}

// Appels privés
let ringing = null, ringTimer = null, ringLoop = null;
function onRing(cid, from) {
  if (vc.channel === cid) return;
  ringing = cid; const u = user(from);
  $('#ring-name').textContent = u.name; $('#ring .ring-av').innerHTML = avatar(u); $('#ring').hidden = false;
  clearInterval(ringLoop); clearTimeout(ringTimer); ringTimer = setTimeout(hideRing, 30000);
  if (isDnd()) return; // Ne pas déranger : la bannière s'affiche, mais sans sonnerie ni notification
  playTone('ring'); ringLoop = setInterval(() => playTone('ring'), 2000);
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try { new Notification(`${u.name} t'appelle`, { body: 'Ouvre Parlotte pour répondre' }); } catch {}
  }
}
function hideRing() { ringing = null; $('#ring').hidden = true; clearInterval(ringLoop); clearTimeout(ringTimer); }
$('#ring-accept').onclick = () => { const cid = ringing; hideRing(); openChannel('@me', cid); joinVoice(cid); };
$('#ring-decline').onclick = () => { const cid = ringing; hideRing(); act('voiceDecline', { channelId: cid }); };
$('#call').onclick = () => {
  const cid = st.view.channel;
  if (vc.channel === cid) leaveVoice(); else joinVoice(cid);
};
$('#voice-panel').addEventListener('click', e => {
  if (e.target.closest('#vp-leave')) leaveVoice();
  if (e.target.closest('#vp-mute')) { if (vc.muted && !cp(chanById(vc.channel), P.SPEAK)) return toast('Tu n\'as pas la permission de parler dans ce salon', true); vc.muted = !vc.muted; if (!vc.muted) vc.deafened = false; applyMute(); sendVoiceState(); renderVoicePanel(); }
  if (e.target.closest('#vp-cam')) toggleVideo('camera');
  if (e.target.closest('#vp-screen')) toggleVideo('screen');
  if (e.target.closest('#vp-deaf')) { vc.deafened = !vc.deafened; applyMute(); sendVoiceState(); renderVoicePanel(); }
  if (e.target.closest('#vp-sb')) toggleSoundboard(e.target.closest('#vp-sb'));
});
$('#view').addEventListener('click', e => { if (e.target.closest('[data-joincall]')) joinVoice(st.view.channel); });
window.addEventListener('beforeunload', () => { if (vc.channel) leaveVoice(); });

// ---------------------------------------------------------------- Administration : rôles, membres, salons
const PERM_LABELS = () => [
  ['VIEW', 'Voir les salons', 'Lire les salons textuels et voir les salons vocaux'],
  ['SEND', 'Envoyer des messages', ''],
  ['ATTACH', 'Joindre des fichiers', ''],
  ['REACT', 'Ajouter des réactions', ''],
  ['CONNECT', 'Rejoindre le vocal', ''],
  ['SPEAK', 'Parler en vocal', ''],
  ['VIDEO', 'Caméra et partage d\'écran', ''],
  ['INVITE', 'Inviter des gens', 'Voir le code d\'invitation'],
  ['MANAGE_MESSAGES', 'Gérer les messages', 'Supprimer les messages des autres, épingler'],
  ['MANAGE_CHANNELS', 'Gérer les salons', 'Créer, renommer, supprimer des salons'],
  ['MANAGE_ROLES', 'Gérer les rôles', 'Créer et attribuer les rôles en dessous du sien'],
  ['KICK', 'Expulser des membres', ''],
  ['BAN', 'Bannir des membres', ''],
  ['MANAGE_SERVER', 'Gérer le serveur', 'Renommer le serveur, changer le code d\'invitation'],
  ['MANAGE_EMOJIS', 'Gérer les emojis et les sons', 'Ajouter et supprimer les emojis et les sons de la soundboard'],
  ['MENTION_EVERYONE', 'Mentionner @everyone et @here', 'Notifier tout le salon d\'un coup'],
  ['ADMIN', 'Administrateur', '⚠️ Toutes les permissions, ignore les restrictions des salons'],
];
function cardRolesHTML(u) {
  const s = server(); if (!s || st.view.server === '@me' || !s.members.includes(u.id)) return '';
  const roles = rolesOf(s, u.id);
  let html = `<div class="card-roles">${roles.map(r => `<span class="rchip"><i style="background:${esc(r.color || '#99aab5')}"></i>${esc(r.name)}</span>`).join('') || '<span class="small">Aucun rôle</span>'}</div>`;
  const above = u.id !== s.owner && (s.myRank > rankLocal(s, u.id));
  if (sp(s, P.MANAGE_ROLES) && (above || u.id === st.me)) {
    const assignable = s.roles.filter(r => r.id !== s.id && r.position < s.myRank).sort((a, b) => b.position - a.position);
    if (assignable.length) html += `<div class="small" style="margin-top:8px">Rôles (clic pour ajouter/retirer)</div><div class="card-roles">${assignable.map(r =>
      `<button class="rchip ${roles.includes(r) ? 'has' : ''}" data-togglerole="${r.id}" data-uid="${esc(u.id)}"><i style="background:${esc(r.color || '#99aab5')}"></i>${esc(r.name)}</button>`).join('')}</div>`;
  }
  if (above && u.id !== st.me && (sp(s, P.KICK) || sp(s, P.BAN)))
    html += `<div class="mod-btns">${sp(s, P.KICK) ? `<button class="danger-btn" data-kick="${esc(u.id)}">Expulser</button>` : ''}${sp(s, P.BAN) ? `<button class="danger-btn" data-ban="${esc(u.id)}">Bannir</button>` : ''}</div>`;
  return html;
}
const rankLocal = (s, uid) => s.owner === uid ? Infinity : Math.max(0, ...rolesOf(s, uid).map(r => r.position));

// --- Paramètres du serveur
let srvTab = 'overview', editRole = null;
function openServerSettings(tab) {
  srvTab = tab || (sp(server(), P.MANAGE_SERVER) ? 'overview' : sp(server(), P.MANAGE_ROLES) ? 'roles' : 'members');
  renderServerSettings(); $('#srv-dlg').showModal();
}
function renderServerSettings() {
  const s = server(); if (!s) return $('#srv-dlg').close();
  const tabs = [['overview', 'Vue d\'ensemble', P.MANAGE_SERVER], ['roles', 'Rôles', P.MANAGE_ROLES], ['members', 'Membres', 0], ['emojis', 'Emojis', 0], ['sounds', 'Sons', 0], ['bans', 'Bannissements', P.BAN]]
    .filter(([, , f]) => !f || sp(s, f));
  $('#srv-tabs').innerHTML = `<h4>${esc(s.name)}</h4>` + tabs.map(([k, l]) => `<button data-stab="${k}" class="${srvTab === k ? 'on' : ''}">${l}</button>`).join('');
  const body = $('#srv-body');
  if (srvTab === 'overview') {
    body.innerHTML = `<h3>Vue d'ensemble</h3><label class="fld">Nom du serveur <input id="srv-name" value="${esc(s.name)}" maxlength="40"></label>
      <button class="primary" id="srv-save-name">Enregistrer</button>
      <h3>Invitation</h3><p class="small">Code actuel : <code>${esc(s.invite || '—')}</code></p><button id="srv-new-invite">Générer un nouveau code (l'ancien ne marchera plus)</button>`;
  } else if (srvTab === 'roles') {
    const roles = [...s.roles].sort((a, b) => b.position - a.position);
    if (!editRole || !s.roles.some(r => r.id === editRole)) editRole = roles[0].id;
    const r = s.roles.find(x => x.id === editRole), locked = r.id !== s.id && r.position >= s.myRank, every = r.id === s.id;
    body.innerHTML = `<div class="roles-wrap"><div class="role-list"><button class="primary" id="role-new">+ Créer un rôle</button>${roles.map(x =>
      `<button class="role-item ${x.id === editRole ? 'on' : ''}" data-role="${x.id}"><i style="background:${esc(x.color || '#99aab5')}"></i>${esc(x.name)}<small>${(Object.values(s.memberRoles).filter(l => l.includes(x.id)).length) || ''}</small></button>`).join('')}
      <p class="small">Les rôles du haut l'emportent. Tu ne peux gérer que ceux sous ton rôle le plus haut.</p></div>
      <div class="role-edit">${locked ? '<p class="warn-box">🔒 Ce rôle est au même niveau ou au-dessus du tien : lecture seule.</p>' : ''}
        ${every ? '<p class="small">@everyone = les permissions de base de tous les membres.</p>' : `
        <label class="fld">Nom <input id="role-name" value="${esc(r.name)}" maxlength="30" ${locked ? 'disabled' : ''}></label>
        <div class="row"><label class="fld">Couleur <input type="color" id="role-color" value="${esc(r.color || '#99aab5')}" ${locked ? 'disabled' : ''}></label>
        <label class="chk"><input type="checkbox" id="role-hoist" ${r.hoist ? 'checked' : ''} ${locked ? 'disabled' : ''}> Afficher séparément dans la liste des membres</label></div>
        <div class="row"><button id="role-up" ${locked ? 'disabled' : ''}>▲ Monter</button><button id="role-down" ${locked ? 'disabled' : ''}>▼ Descendre</button><button class="danger-btn" id="role-del" ${locked ? 'disabled' : ''}>Supprimer le rôle</button></div>`}
        <h4>Permissions</h4>${PERM_LABELS().map(([k, l, d]) => { const bit = P[k], has = (r.perms & bit) === bit, grantable = (s.myPerms & bit) === bit;
          return `<label class="perm"><span><b>${l}</b>${d ? `<small>${d}</small>` : ''}</span><input type="checkbox" data-perm="${k}" ${has ? 'checked' : ''} ${locked || (!has && !grantable) ? 'disabled' : ''}></label>`; }).join('')}
        ${locked ? '' : '<button class="primary" id="role-save">Enregistrer le rôle</button>'}</div></div>`;
  } else if (srvTab === 'members') {
    body.innerHTML = `<h3>Membres — ${s.members.length}</h3>` + s.members.map(uid => { const u = user(uid);
      const manage = sp(s, P.MANAGE_ROLES) && (uid === st.me || (uid !== s.owner && s.myRank > rankLocal(s, uid)));
      const chips = s.roles.filter(r => r.id !== s.id).sort((a, b) => b.position - a.position).filter(r => manage ? r.position < s.myRank : rolesOf(s, uid).includes(r))
        .map(r => manage ? `<button class="rchip ${rolesOf(s, uid).includes(r) ? 'has' : ''}" data-togglerole="${r.id}" data-uid="${esc(uid)}"><i style="background:${esc(r.color || '#99aab5')}"></i>${esc(r.name)}</button>`
          : `<span class="rchip"><i style="background:${esc(r.color || '#99aab5')}"></i>${esc(r.name)}</span>`).join('');
      return `<div class="friend">${avatar(u, true)}<div class="grow"><b style="color:${esc(nameColor(uid, 'inherit'))}">${esc(u.name)}</b>${s.owner === uid ? ' 👑' : ''}<div class="card-roles">${chips || '<small>Aucun rôle</small>'}</div></div>
        ${uid !== st.me && uid !== s.owner && s.myRank > rankLocal(s, uid) ? `${sp(s, P.KICK) ? `<button class="danger-btn" data-kick="${esc(uid)}">Expulser</button>` : ''} ${sp(s, P.BAN) ? `<button class="danger-btn" data-ban="${esc(uid)}">Bannir</button>` : ''}` : ''}</div>`; }).join('')
      + (sp(s, P.MANAGE_ROLES) ? '<p class="small">Clique sur un rôle pour le donner ou le retirer (rôles en surbrillance = attribués).</p>' : '');
  } else if (srvTab === 'emojis') {
    const manage = sp(s, P.MANAGE_EMOJIS);
    body.innerHTML = `<h3>Emojis — ${s.emojis.length}/50</h3><p class="small">Utilise-les dans les messages avec <code>:nom:</code>, dans le sélecteur 😀 ou en réaction.</p>
      ${manage ? `<div class="emo-add">${filePickHTML('emo-file', 'image/png,image/jpeg,image/gif,image/webp', 'Choisir une image', 'carrée, 512 Ko max')}<input id="emo-name" placeholder="nom (ex : gg)" maxlength="32"><button class="primary" id="emo-add">Ajouter</button></div><p class="small">Image carrée conseillée, 512 Ko max. Les GIF animés marchent aussi.</p>` : '<p class="small">Il faut la permission « Gérer les emojis » pour en ajouter.</p>'}
      <div class="emo-grid">${s.emojis.map(e => `<div class="emo"><img src="${esc(e.url)}" alt=""><b>:${esc(e.name)}:</b><small>par ${esc(user(e.by).name)}</small>${manage ? `<button class="danger-btn" data-delemoji="${e.id}">Supprimer</button>` : ''}</div>`).join('')}</div>`;
  } else if (srvTab === 'sounds') {
    body.innerHTML = soundsTabHTML(s);
  } else if (srvTab === 'bans') {
    body.innerHTML = `<h3>Bannissements — ${s.bans.length}</h3>` + (s.bans.map(uid => `<div class="friend">${avatar(user(uid))}<div class="grow"><b>${esc(user(uid).name)}</b></div><button data-unban="${esc(uid)}">Révoquer</button></div>`).join('') || '<p class="small">Personne n\'est banni.</p>');
  }
}
$('#srv-dlg').addEventListener('click', e => {
  const s = server(); if (!s) return;
  if (e.target === $('#srv-dlg') || e.target.closest('#srv-close')) return $('#srv-dlg').close();
  const t = e.target.closest('[data-stab]'); if (t) { srvTab = t.dataset.stab; return renderServerSettings(); }
  const ro = e.target.closest('[data-role]'); if (ro) { editRole = ro.dataset.role; return renderServerSettings(); }
  if (e.target.closest('#srv-save-name')) act('updateServer', { serverId: s.id, name: $('#srv-name').value }).then(() => toast('Serveur renommé'));
  if (e.target.closest('#srv-new-invite')) act('newInvite', { serverId: s.id }).then(() => toast('Nouveau code créé'));
  if (e.target.closest('#role-new')) act('createRole', { serverId: s.id }).then(r => { if (r?.roleId) { editRole = r.roleId; renderServerSettings(); setTimeout(() => $('#role-name')?.select(), 0); } });
  if (e.target.closest('#role-up')) act('moveRole', { serverId: s.id, roleId: editRole, dir: 1 });
  if (e.target.closest('#role-down')) act('moveRole', { serverId: s.id, roleId: editRole, dir: -1 });
  if (e.target.closest('#role-del') && confirm('Supprimer ce rôle ?')) act('deleteRole', { serverId: s.id, roleId: editRole });
  if (e.target.closest('#role-save')) {
    let perms = 0; document.querySelectorAll('#srv-body [data-perm]').forEach(c => { if (c.checked) perms |= P[c.dataset.perm]; });
    const payload = { serverId: s.id, roleId: editRole, perms };
    if ($('#role-name')) Object.assign(payload, { name: $('#role-name').value, color: $('#role-color').value, hoist: $('#role-hoist').checked });
    act('updateRole', payload).then(() => toast('Rôle enregistré'));
  }
  const k = e.target.closest('[data-kick]'); if (k && confirm(`Expulser ${user(k.dataset.kick).name} ?`)) act('kick', { serverId: s.id, userId: k.dataset.kick });
  const b = e.target.closest('[data-ban]'); if (b && confirm(`Bannir ${user(b.dataset.ban).name} ?`)) act('ban', { serverId: s.id, userId: b.dataset.ban });
  const u = e.target.closest('[data-unban]'); if (u) act('unban', { serverId: s.id, userId: u.dataset.unban });
  if (e.target.closest('#emo-add')) addEmojiFlow(s);
  const de = e.target.closest('[data-delemoji]'); if (de && confirm('Supprimer cet emoji ?')) act('deleteEmoji', { serverId: s.id, emojiId: de.dataset.delemoji });
  const tr = e.target.closest('[data-togglerole]');
  if (tr) { const uid = tr.dataset.uid, cur = s.memberRoles[uid] || [], rid = tr.dataset.togglerole;
    act('setMemberRoles', { serverId: s.id, userId: uid, roles: cur.includes(rid) ? cur.filter(x => x !== rid) : [...cur, rid] }); }
});

// --- Paramètres d'un salon (nom, sujet, qui voit/écrit)
let chanEdit = null;
const TRI = ['inherit', 'allow', 'deny'], TRI_LABEL = { inherit: '/', allow: '✓', deny: '✕' };
function openChannelSettings(cid) {
  const s = server(), c = s.channels.find(x => x.id === cid); if (!c) return;
  const cols = c.type === 'voice' ? ['VIEW', 'CONNECT', 'SPEAK', 'VIDEO'] : ['VIEW', 'SEND', 'ATTACH', 'REACT'];
  const ow = {}; (c.overwrites || []).forEach(o => (ow[o.id] = { ...o }));
  chanEdit = { c, cols, ow };
  renderChannelSettings(); $('#chan-dlg').showModal();
}
function renderChannelSettings() {
  const s = server(), { c, cols, ow } = chanEdit, canRoles = sp(s, P.MANAGE_ROLES);
  const state = (id, k) => { const o = ow[id]; if (!o) return 'inherit'; return o.allow & P[k] ? 'allow' : o.deny & P[k] ? 'deny' : 'inherit'; };
  const roles = [...s.roles].sort((a, b) => b.position - a.position);
  const lbl = { VIEW: 'Voir', SEND: 'Écrire', ATTACH: 'Fichiers', REACT: 'Réactions', CONNECT: 'Rejoindre', SPEAK: 'Parler', VIDEO: 'Vidéo' };
  $('#chan-body').innerHTML = `<h3>${c.type === 'voice' ? '🔊' : '#'} Paramètres du salon</h3>
    <label class="fld">Nom <input id="ch-name" value="${esc(c.name)}" maxlength="30"></label>
    ${c.type === 'voice' ? '' : `<label class="fld">Sujet <input id="ch-topic" value="${esc(c.topic || '')}" maxlength="200"></label>`}
    <label class="chk"><input type="checkbox" id="ch-private" ${state(s.id, 'VIEW') === 'deny' ? 'checked' : ''} ${canRoles ? '' : 'disabled'}> 🔒 Salon privé (seuls les rôles autorisés ci-dessous le voient)</label>
    <h4>Permissions par rôle</h4><p class="small">/ = hérite du rôle, ✓ = autorisé ici, ✕ = interdit ici. ${canRoles ? 'Clique pour changer.' : '(Il faut « Gérer les rôles » pour modifier.)'}</p>
    <table class="ow"><tr><th></th>${cols.map(k => `<th>${lbl[k]}</th>`).join('')}</tr>${roles.map(r => `<tr><td><i style="background:${esc(r.color || '#99aab5')}"></i>${esc(r.name)}</td>${cols.map(k => { const v = state(r.id, k);
      return `<td><button class="tri ${v}" data-tri="${r.id}:${k}" ${canRoles ? '' : 'disabled'}>${TRI_LABEL[v]}</button></td>`; }).join('')}</tr>`).join('')}</table>
    <div class="row" style="margin-top:12px"><button class="danger-btn" id="ch-del">Supprimer le salon</button><span style="flex:1"></span><button id="ch-cancel">Annuler</button><button class="primary" id="ch-save">Enregistrer</button></div>`;
}
function setTri(id, k, v) {
  const s = server(), o = (chanEdit.ow[id] = chanEdit.ow[id] || { id, type: 'role', allow: 0, deny: 0 }), bit = P[k];
  o.allow &= ~bit; o.deny &= ~bit; if (v === 'allow') o.allow |= bit; if (v === 'deny') o.deny |= bit;
}
$('#chan-dlg').addEventListener('click', e => {
  const s = server(); if (!chanEdit) return;
  if (e.target === $('#chan-dlg') || e.target.closest('#ch-cancel')) return $('#chan-dlg').close();
  const t = e.target.closest('[data-tri]');
  if (t) { const [id, k] = t.dataset.tri.split(':'), cur = t.classList.contains('allow') ? 'allow' : t.classList.contains('deny') ? 'deny' : 'inherit';
    setTri(id, k, TRI[(TRI.indexOf(cur) + 1) % 3]); return renderChannelSettings(); }
  if (e.target.closest('#ch-private')) {
    const on = $('#ch-private').checked; setTri(s.id, 'VIEW', on ? 'deny' : 'inherit');
    // Rendre privé sans bloquer celui qui le fait : on autorise ses rôles qui ne sont pas administrateurs.
    if (on && s.owner !== st.me) rolesOf(s, st.me).forEach(r => setTri(r.id, 'VIEW', 'allow'));
    return renderChannelSettings();
  }
  if (e.target.closest('#ch-del') && confirm(`Supprimer ${chanEdit.c.name} et tous ses messages ?`)) { act('deleteChannel', { channelId: chanEdit.c.id }); $('#chan-dlg').close(); }
  if (e.target.closest('#ch-save')) {
    const payload = { channelId: chanEdit.c.id, name: $('#ch-name').value };
    if ($('#ch-topic')) payload.topic = $('#ch-topic').value;
    if (sp(s, P.MANAGE_ROLES)) payload.overwrites = Object.values(chanEdit.ow).filter(o => o.allow || o.deny);
    act('updateChannel', payload).then(() => { toast('Salon enregistré'); $('#chan-dlg').close(); });
  }
});

// ---------------------------------------------------------------- Aller à un message (recherche, épinglés)
let jumpAfterLoad = null;
function flashJump() {
  if (!jumpAfterLoad) return;
  const el = document.querySelector(`.msg[data-id="${CSS.escape(jumpAfterLoad)}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); jumpAfterLoad = null; }
}

// ---------------------------------------------------------------- Messages épinglés
$('#pins').onclick = () => { if (st.view.channel) act('pins', { channelId: st.view.channel }); };
function showPins(res) {
  $('#results').hidden = false;
  $('#res-count').textContent = `📌 Épinglés — ${res.messages.length}`;
  $('#res-list').innerHTML = res.messages.map(m => { const u = user(m.author_id);
    return `<div class="res" data-open="${m.channel_id}" data-mid="${m.id}"><div class="meta"><b style="color:${esc(u.color)}">${esc(u.name)}</b> · ${dayLabel(m.timestamp)} ${time(m.timestamp)}</div><div>${format(m.content || (m.poll ? '📊 ' + m.poll.question : ''))}</div>${m.attachments?.length ? `<div class="small">📎 ${m.attachments.length} fichier(s)</div>` : ''}</div>`; }).join('')
    || '<p class="small" style="padding:8px">Aucun message épinglé dans ce salon.<br>Survole un message et clique sur 📌 pour l\'épingler (il faut la permission « Gérer les messages »).</p>';
}

// ---------------------------------------------------------------- Sondages
function timeLeft(iso) {
  const ms = new Date(iso) - Date.now(); if (ms <= 0) return null;
  const total = Math.ceil(ms / 60e3), h = Math.floor(total / 60), d = Math.floor(h / 24), mn = total % 60;
  return d >= 1 ? `${d} j ${h % 24} h` : h >= 1 ? `${h} h ${mn} min` : `${mn} min`;
}
function pollHTML(m, c) {
  const p = m.poll, left = timeLeft(p.expires), total = new Set(p.answers.flatMap(a => a.votes)).size;
  const mine = p.answers.filter(a => a.votes.includes(st.me)).map(a => a.id);
  const max = Math.max(0, ...p.answers.map(a => a.votes.length));
  const canEnd = left && (m.author_id === st.me || cp(c, P.MANAGE_MESSAGES));
  return `<div class="poll ${left ? '' : 'ended'}" data-poll="${m.id}">
    <div class="pq">${esc(p.question)}</div>
    <div class="small">${p.multi ? 'Plusieurs réponses possibles' : 'Une seule réponse'}</div>
    ${p.answers.map(a => { const n = a.votes.length, pct = total ? Math.round(n * 100 / total) : 0, on = mine.includes(a.id), win = !left && n && n === max;
      return `<button class="pa ${on ? 'on' : ''} ${win ? 'win' : ''}" data-vote="${a.id}" ${left ? '' : 'disabled'} title="${esc(a.votes.map(u => user(u).name).join(', ') || 'Aucun vote')}">
        <span class="bar" style="width:${(mine.length || !left) ? pct : 0}%"></span>
        <span class="box">${p.multi ? (on ? '☑' : '☐') : (on ? '◉' : '○')}</span><span class="pt">${esc(a.text)}${win ? ' 🏆' : ''}</span>
        ${(mine.length || !left) ? `<span class="pc">${n} · ${pct}%</span>` : ''}</button>`; }).join('')}
    <div class="pf">${total} votant${total > 1 ? 's' : ''} · ${left ? `encore ${left}` : 'Sondage terminé'}${mine.length && left ? ' · <button class="link" data-unvote>Retirer mon vote</button>' : ''}${canEnd ? ' · <button class="link" data-endpoll>Terminer maintenant</button>' : ''}</div>
  </div>`;
}
$('#view').addEventListener('click', e => {
  const poll = e.target.closest('[data-poll]'); if (!poll) return;
  const m = (st.msgs[st.view.channel] || []).find(x => x.id === poll.dataset.poll); if (!m) return;
  if (e.target.closest('[data-endpoll]')) { if (confirm('Terminer le sondage maintenant ?')) act('endPoll', { messageId: m.id }); return; }
  if (e.target.closest('[data-unvote]')) return act('vote', { messageId: m.id, answerIds: [] });
  const v = e.target.closest('[data-vote]'); if (!v) return;
  const mine = m.poll.answers.filter(a => a.votes.includes(st.me)).map(a => a.id), id = v.dataset.vote;
  const next = m.poll.multi ? (mine.includes(id) ? mine.filter(x => x !== id) : [...mine, id]) : (mine.includes(id) ? [] : [id]);
  act('vote', { messageId: m.id, answerIds: next });
});
setInterval(() => { // met à jour « encore 12 min » et la clôture des sondages
  const list = st.msgs[st.view.channel] || [];
  if (list.some(m => m.poll) && !document.querySelector('.edit-box') && document.activeElement !== input) renderMain('keep');
}, 30000);
function pollAnswerRow(v = '') {
  const d = document.createElement('div'); d.className = 'pans';
  d.innerHTML = `<input maxlength="55" placeholder="Réponse" value="${esc(v)}"><button type="button" title="Retirer">✕</button>`;
  d.querySelector('button').onclick = () => { if ($('#poll-answers').children.length > 2) d.remove(); };
  $('#poll-answers').append(d);
}
$('#poll-btn').onclick = () => {
  if (!st.view.channel) return;
  $('#poll-q').value = ''; $('#poll-answers').innerHTML = ''; pollAnswerRow(); pollAnswerRow();
  $('#poll-multi').checked = false; $('#poll-hours').value = '24'; $('#poll-err').textContent = '';
  $('#poll-dlg').showModal(); $('#poll-q').focus();
};
$('#poll-add').onclick = () => { if ($('#poll-answers').children.length < 10) { pollAnswerRow(); $('#poll-answers').lastChild.querySelector('input').focus(); } };
$('#poll-form').addEventListener('submit', e => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  const answers = [...$('#poll-answers').querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
  request('createPoll', { channelId: st.view.channel, question: $('#poll-q').value, answers, multi: $('#poll-multi').checked, hours: Number($('#poll-hours').value) })
    .then(() => $('#poll-dlg').close()).catch(err => { $('#poll-err').textContent = err.message; });
});

// ---------------------------------------------------------------- Autocomplétion des @mentions
let mItems = [], mActive = 0;
function mentionQuery() {
  const before = input.value.slice(0, input.selectionStart);
  const m = before.match(/(?:^|\s)@([\p{L}\p{N}_.-]*)$/u);
  return m ? m[1].toLowerCase() : null;
}
function renderMentionSugg() {
  const eq = emojiQuery();
  if (eq !== null) {
    mItems = usableEmojis().filter(e => e.name.startsWith(eq)).slice(0, 8)
      .map(e => ({ insert: e.name, emoji: true, html: `<img class="emoji" src="${esc(e.url)}" alt=""><b>:${esc(e.name)}:</b>` }));
    mActive = 0; $('#msugg').hidden = !mItems.length;
    $('#msugg').innerHTML = mItems.map((it, i) => `<li data-mi="${i}" class="${i ? '' : 'active'}">${it.html}</li>`).join('');
    return;
  }
  const q = mentionQuery(), box = $('#msugg'), c = channel();
  if (q === null || !c) { box.hidden = true; mItems = []; return; }
  const ids = c.type === 'dm' ? c.members : (server()?.members || []);
  mItems = ids.map(user).filter(u => u.name.toLowerCase().startsWith(q)).slice(0, 8).map(u => ({ insert: u.name, html: `${avatar(u)}<b>${esc(u.name)}</b>` }));
  if (c.type !== 'dm' && cp(c, P.MENTION_EVERYONE))
    [['everyone', 'Notifie tout le monde dans ce salon'], ['here', 'Notifie les personnes en ligne']].filter(([k]) => k.startsWith(q))
      .forEach(([k, d]) => mItems.push({ insert: k, html: `<b>@${k}</b><small>${d}</small>` }));
  mActive = 0; box.hidden = !mItems.length;
  box.innerHTML = mItems.map((it, i) => `<li data-mi="${i}" class="${i ? '' : 'active'}">${it.html}</li>`).join('');
}
function applyMention(i) {
  const pos = input.selectionStart, it = mItems[i];
  const before = it.emoji ? input.value.slice(0, pos).replace(/:(\w*)$/, ':' + it.insert + ': ')
    : input.value.slice(0, pos).replace(/@([\p{L}\p{N}_.-]*)$/u, '@' + it.insert + ' ');
  input.value = before + input.value.slice(pos); input.setSelectionRange(before.length, before.length);
  $('#msugg').hidden = true; mItems = []; input.focus();
}
input.addEventListener('input', renderMentionSugg);
input.addEventListener('click', renderMentionSugg);
input.addEventListener('blur', () => setTimeout(() => ($('#msugg').hidden = true), 150));
input.addEventListener('keydown', e => {
  if ($('#msugg').hidden || !mItems.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); e.stopImmediatePropagation(); mActive = (mActive + (e.key === 'ArrowDown' ? 1 : mItems.length - 1)) % mItems.length;
    [...$('#msugg').children].forEach((li, i) => li.classList.toggle('active', i === mActive));
  } else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); e.stopImmediatePropagation(); applyMention(mActive); }
  else if (e.key === 'Escape') { e.stopImmediatePropagation(); $('#msugg').hidden = true; }
}, true);
$('#msugg').addEventListener('mousedown', e => { const li = e.target.closest('li'); if (li) { e.preventDefault(); applyMention(+li.dataset.mi); } });

// ---------------------------------------------------------------- Emojis personnalisés
const EMOJIS_BIG = ['😀', '😂', '🥲', '😍', '😎', '🤔', '😮', '😢', '😡', '🥳', '👍', '👎', '👏', '🙏', '💪', '🔥', '❤️', '💯', '🎉', '🚀', '👀', '✅', '❌', '⭐', '🎮', '🏆', '⚽', '🍕', '☕', '🌙', '💀', '🤝', '🙌', '😴', '🤯', '😇'];
const emojiById = id => { for (const s of st.servers) { const e = (s.emojis || []).find(x => x.id === id); if (e) return e; } return null; };
// Emojis utilisables ici : ceux du serveur courant (en MP : ceux de tous mes serveurs).
const usableEmojis = () => st.view.server === '@me' ? st.servers.flatMap(s => s.emojis || []) : (server()?.emojis || []);
function toEmojiTokens(text) {
  const list = usableEmojis();
  return text.replace(/(^|[^\w<]):(\w{2,32}):(?!\w)/g, (all, pre, name) => { const e = list.find(x => x.name === name.toLowerCase()); return e ? `${pre}<:${e.name}:${e.id}>` : all; });
}
function reactionHTML(e) {
  const m = e.match(/^<:(\w{2,32}):([0-9a-z]+)>$/);
  if (!m) return esc(e);
  const em = emojiById(m[2]); return em ? `<img class="emoji" src="${esc(em.url)}" alt=":${esc(m[1])}:">` : `:${esc(m[1])}:`;
}
function emojiQuery() {
  const before = input.value.slice(0, input.selectionStart), m = before.match(/(?:^|\s):(\w{2,})$/);
  return m && usableEmojis().length ? m[1].toLowerCase() : null;
}
$('#emoji-btn').onclick = e => {
  const r = e.currentTarget.getBoundingClientRect();
  openPicker(r.right - 220, r.top - 330, (tok, name) => {
    const ins = name ? `:${name}: ` : tok, pos = input.selectionStart ?? input.value.length;
    input.value = input.value.slice(0, pos) + ins + input.value.slice(pos); input.focus();
    input.setSelectionRange(pos + ins.length, pos + ins.length);
  }, { big: true });
};

// ---------------------------------------------------------------- Fils de discussion
const c0 = () => channel();
function threadChipHTML(t) {
  const ago = t.last ? dayLabel(t.last) + ' ' + time(t.last) : '';
  return `<button class="tchip" data-open-thread="${t.id}">🧵 <b>${esc(t.name)}</b><span>${t.count || 0} message${(t.count || 0) > 1 ? 's' : ''}${t.count ? ' · dernier : ' + ago : ''}</span></button>`;
}
function starterHTML(t) {
  const parentMsgs = st.msgs[t.parent_id] || [], m = parentMsgs.find(x => x.id === t.starter_id);
  if (!m || m.author_id === 'system') return '';
  const u = user(m.author_id);
  return `<div class="starter"><div class="meta"><b>${esc(u.name)}</b> · ${dayLabel(m.timestamp)} ${time(m.timestamp)}</div>${m.content ? `<div class="text">${format(m.content)}</div>` : ''}${attachmentsHTML(m.attachments)}</div>`;
}
document.addEventListener('click', e => {
  const t = e.target.closest('[data-open-thread]'); if (t) { const th = chanById(t.dataset.openThread); if (th) openChannel(th.server_id, th.id); return; }
  const g = e.target.closest('[data-goto-chan]'); if (g) return openChannel(st.view.server, g.dataset.gotoChan);
  const a = e.target.closest('[data-thread-act]'); if (!a) return;
  const th = channel(); if (!th || th.type !== 'thread') return;
  const k = a.dataset.threadAct;
  if (k === 'rename') ask('Renommer le fil', '', 'Renommer', name => act('updateThread', { threadId: th.id, name }), th.name);
  if (k === 'archive') act('updateThread', { threadId: th.id, archived: true }).then(() => toast('Fil archivé : il réapparaît dès qu\'on y écrit'));
  if (k === 'unarchive') act('updateThread', { threadId: th.id, archived: false });
  if (k === 'delete' && confirm(`Supprimer le fil « ${th.name} » et tous ses messages ?`)) act('deleteThread', { threadId: th.id });
});
$('#threads-btn').onclick = () => {
  const c = channel(), s = server(); if (!c || !s) return;
  const list = (s.threads || []).filter(t => t.parent_id === c.id).sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  $('#results').hidden = false;
  $('#res-count').textContent = `🧵 Fils de #${c.name} — ${list.length}`;
  $('#res-list').innerHTML = (cp(c, P.SEND) ? '<button class="primary" id="new-thread" style="width:100%;margin-bottom:8px">+ Nouveau fil</button>' : '')
    + (list.map(t => `<div class="res" data-open-thread="${t.id}"><div><b>🧵 ${esc(t.name)}</b>${t.archived ? ' <span class="arch">archivé</span>' : ''}</div><div class="meta">${t.count || 0} message(s) · par ${esc(user(t.owner).name)}${t.last ? ' · ' + dayLabel(t.last) + ' ' + time(t.last) : ''}</div></div>`).join('')
       || '<p class="small" style="padding:8px">Aucun fil pour l\'instant. Survole un message et clique sur 🧵 pour en créer un.</p>');
};
$('#res-list').addEventListener('click', e => {
  if (e.target.closest('#new-thread')) ask('Nouveau fil', `Dans #${channel()?.name}`, 'Créer', name => act('createThread', { channelId: st.view.channel, name }));
});

// ---------------------------------------------------------------- Messages vocaux
const fmtDur = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function voiceNoteHTML(a) {
  const w = a.voice.waveform?.length ? a.voice.waveform : Array(40).fill(30);
  return `<div class="vnote" data-vnote="${esc(a.url)}" data-dur="${a.voice.duration}"><button class="vplay" title="Écouter">▶</button>
    <div class="vwave">${w.map(v => `<i style="height:${Math.max(8, v)}%"></i>`).join('')}</div><span class="vtime">${fmtDur(a.voice.duration)}</span></div>`;
}
const vPlayers = new Map(); let vCurrent = null;
document.addEventListener('click', e => {
  const btn = e.target.closest('.vplay'), wave = e.target.closest('.vwave');
  const box = (btn || wave)?.closest('.vnote'); if (!box) return;
  const url = box.dataset.vnote;
  let a = vPlayers.get(url);
  if (!a) {
    a = new Audio(url); vPlayers.set(url, a);
    const sync = () => document.querySelectorAll(`.vnote[data-vnote="${CSS.escape(url)}"]`).forEach(el => {
      const dur = isFinite(a.duration) ? a.duration : Number(el.dataset.dur) || 1, p = a.currentTime / dur;
      el.querySelectorAll('.vwave i').forEach((b, i, all) => b.classList.toggle('played', i / all.length < p));
      el.querySelector('.vtime').textContent = fmtDur(a.paused && !a.currentTime ? Number(el.dataset.dur) : a.currentTime);
      el.querySelector('.vplay').textContent = a.paused ? '▶' : '⏸';
    });
    a.ontimeupdate = sync; a.onplay = sync; a.onpause = sync; a.onended = () => { a.currentTime = 0; sync(); };
  }
  if (wave && !btn) { const r = wave.getBoundingClientRect(), dur = isFinite(a.duration) ? a.duration : Number(box.dataset.dur); a.currentTime = Math.max(0, (e.clientX - r.left) / r.width) * dur; }
  if (btn || a.paused) {
    if (vCurrent && vCurrent !== a) vCurrent.pause();
    if (a.paused) a.play().catch(() => playDecoded(url)); else a.pause();
    vCurrent = a;
  }
});

// Dernier recours (vieux messages en .webm sur iPhone) : on décode nous-mêmes et on joue sans les contrôles.
async function playDecoded(url) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)(), data = await (await fetch(url)).arrayBuffer();
    const buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start(); src.onended = () => ctx.close();
  } catch { toast('Ce vieux message vocal ne se lit pas sur cet appareil (les nouveaux, si)', true); }
}
// Les messages vocaux sont convertis en MP3 avant l'envoi : c'est le seul format lisible partout (iPhone compris).
function loadScript(src) {
  return new Promise((res, rej) => { if (document.querySelector(`script[src="${src}"]`)) return res(); const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
}
async function toMp3(blob) {
  await loadScript('vendor/lame.min.js');
  const ctx = new (window.AudioContext || window.webkitAudioContext)(), data = await blob.arrayBuffer();
  const buf = await new Promise((res, rej) => ctx.decodeAudioData(data, res, rej)); ctx.close();
  const ch = [...Array(buf.numberOfChannels).keys()].map(i => buf.getChannelData(i));
  let rate = buf.sampleRate, step = rate >= 44100 ? 2 : 1; rate = rate / step;
  if (![8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000].includes(rate)) throw new Error('fréquence');
  const n = Math.floor(buf.length / step), pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) { let v = 0; for (const c of ch) for (let k = 0; k < step; k++) v += c[i * step + k] || 0; v /= ch.length * step; pcm[i] = Math.max(-32768, Math.min(32767, v * 32767)); }
  const enc = new lamejs.Mp3Encoder(1, rate, 48), out = [];
  for (let i = 0; i < n; i += 1152) { const b = enc.encodeBuffer(pcm.subarray(i, i + 1152)); if (b.length) out.push(new Uint8Array(b)); }
  const end = enc.flush(); if (end.length) out.push(new Uint8Array(end));
  return new Blob(out, { type: 'audio/mpeg' });
}
const rec = { mr: null, stream: null, chunks: [], start: 0, levels: [], timer: null, analyser: null, ctx: null };
$('#rec-btn').onclick = async () => {
  if (rec.mr) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
    return toast(`Les messages vocaux ont besoin d'une connexion sécurisée : ouvre https://${location.hostname}:3443`, true);
  try { rec.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
  catch { return toast('Micro refusé ou introuvable', true); }
  const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  rec.mr = new MediaRecorder(rec.stream, type ? { mimeType: type, audioBitsPerSecond: 48000 } : undefined);
  rec.chunks = []; rec.levels = []; rec.start = Date.now();
  rec.mr.ondataavailable = e => e.data.size && rec.chunks.push(e.data);
  rec.mr.start(250);
  rec.ctx = new (window.AudioContext || window.webkitAudioContext)();
  const src = rec.ctx.createMediaStreamSource(rec.stream); rec.analyser = rec.ctx.createAnalyser(); rec.analyser.fftSize = 512; src.connect(rec.analyser);
  const data = new Uint8Array(rec.analyser.fftSize), cv = $('#rec-wave'), g = cv.getContext('2d');
  rec.timer = setInterval(() => {
    rec.analyser.getByteTimeDomainData(data);
    let sum = 0; for (const v of data) sum += (v - 128) ** 2;
    rec.levels.push(Math.min(100, Math.sqrt(sum / data.length) * 4));
    const secs = (Date.now() - rec.start) / 1000; $('#rec-time').textContent = fmtDur(secs);
    g.clearRect(0, 0, cv.width, cv.height); g.fillStyle = '#f23f43';
    rec.levels.slice(-75).forEach((v, i) => { const hh = Math.max(2, v / 100 * cv.height); g.fillRect(i * 4, (cv.height - hh) / 2, 2, hh); });
    if (secs >= 300) finishRecording(true); // 5 minutes max
  }, 100);
  $('#rec-bar').hidden = false; document.querySelector('.input-row').hidden = true;
};
function stopRecorder() {
  return new Promise(res => {
    clearInterval(rec.timer);
    if (!rec.mr) return res(null);
    rec.mr.onstop = () => res(new Blob(rec.chunks, { type: rec.mr.mimeType || 'audio/webm' }));
    rec.mr.stop(); rec.stream.getTracks().forEach(t => t.stop()); rec.ctx?.close();
  });
}
async function finishRecording(send) {
  if (!rec.mr) return;
  const duration = (Date.now() - rec.start) / 1000, levels = rec.levels.slice();
  const blob = await stopRecorder(); rec.mr = null;
  $('#rec-bar').hidden = true; document.querySelector('.input-row').hidden = false;
  if (!send || !blob) return;
  if (duration < 0.7) return toast('Message trop court');
  // Forme d'onde réduite à 48 barres
  const n = 48, waveform = Array.from({ length: n }, (_, i) => { const sl = levels.slice(Math.floor(i * levels.length / n), Math.floor((i + 1) * levels.length / n) || undefined); return sl.length ? Math.round(Math.max(...sl)) : 0; });
  const peak = Math.max(1, ...waveform), norm = waveform.map(v => Math.round(v * 100 / peak));
  let out = blob; try { out = await toMp3(blob); } catch (e) { console.warn('MP3 impossible, envoi tel quel', e); }
  const ext = /mpeg/.test(out.type) ? 'mp3' : /mp4/.test(out.type) ? 'm4a' : /ogg/.test(out.type) ? 'ogg' : 'webm';
  const file = new File([out], `message-vocal.${ext}`, { type: out.type.split(';')[0] });
  try {
    const up = await upload(file);
    await request('send', { channelId: st.view.channel, content: '', attachments: [up.id], voiceNote: { duration, waveform: norm }, replyTo });
    setReply(null);
  } catch (e) { toast(e.message, true); }
}
$('#rec-cancel').onclick = () => finishRecording(false);
$('#rec-send').onclick = () => finishRecording(true);

// ---------------------------------------------------------------- Onglet « Emojis » des paramètres du serveur
async function addEmojiFlow(s) {
  const f = $('#emo-file').files[0], name = $('#emo-name').value.trim();
  if (!f) return toast('Choisis une image', true);
  if (f.size > 512 * 1024) return toast('Image trop lourde (512 Ko max)', true);
  try { const up = await upload(f); await request('addEmoji', { serverId: s.id, name: name || f.name.replace(/\.\w+$/, ''), fileId: up.id }); toast('Emoji ajouté'); }
  catch (e) { toast(e.message, true); }
}

function doLogout() { leaveVoice(); request('logout', { token: store.get('parlotte-token') }).catch(() => {}); store.del('parlotte-token'); st.msgs = {}; st.unread = {}; setMode('login'); }
// ---------------------------------------------------------------- Préférences (thème, texte, compact, sons)
function applyPrefs() {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme || 'dark';
  root.style.setProperty('--fs', (prefs.fs || 15) + 'px');
  document.body.classList.toggle('compact', !!prefs.compact);
  const light = prefs.theme === 'light' || (prefs.theme === 'auto' && matchMedia('(prefers-color-scheme: light)').matches);
  setTimeout(() => document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.body).backgroundColor || (light ? '#ffffff' : '#14121a')), 0);
}
function savePrefs() { store.set('parlotte-prefs', prefs); applyPrefs(); }
applyPrefs();
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', applyPrefs);

function openSettings() {
  const notif = !('Notification' in window) ? 'Non disponible sur cet appareil'
    : Notification.permission === 'granted' ? '✅ Activées' : Notification.permission === 'denied' ? '❌ Bloquées dans le navigateur' : 'Pas encore activées';
  $('#settings-body').innerHTML = `<h3>Paramètres</h3>
    <h4>Apparence</h4>
    <div class="seg" role="radiogroup">${[['dark', '🌙 Sombre'], ['light', '☀️ Clair'], ['auto', '🖥️ Comme l\'appareil']].map(([k, l]) =>
      `<button data-theme-pick="${k}" class="${(prefs.theme || 'dark') === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <label class="fld">Taille du texte : <b id="fs-val">${prefs.fs || 15} px</b><input type="range" id="fs" min="12" max="20" step="1" value="${prefs.fs || 15}"></label>
    <label class="chk"><input type="checkbox" id="compact" ${prefs.compact ? 'checked' : ''}> Mode compact (messages plus serrés)</label>
    <h4>Sons et notifications</h4>
    <label class="chk"><input type="checkbox" id="sounds" ${prefs.sounds === false ? '' : 'checked'}> Sons d'arrivée/départ dans le vocal</label>
    <div class="row"><span>Notifications : ${notif}</span>${'Notification' in window && Notification.permission === 'default' ? '<button id="ask-notif">Activer</button>' : ''}</div>
    <p class="small">En « Ne pas déranger », pas de notification ni de sonnerie d'appel.</p>
    ${voiceSettingsHTML()}
    ${presenceSettingsHTML()}
    <h4>Application</h4>
    ${window.parlotteDesktop ? `<p class="small">🖥️ Tu utilises l'application de bureau Parlotte.</p>
      <div class="row"><button id="desk-launcher">Changer de serveur</button>${desktopInfo?.hosting ? '<button id="desk-addr">📡 Adresses pour tes amis</button>' : ''}</div>`
      : `<p class="small">${installHint()}</p>${deferredInstall ? '<button class="primary" id="install-app">📲 Installer Parlotte</button>' : ''}`}
    <h4>Confidentialité</h4>
    <p class="small">${(st.blocked || []).length} utilisateur(s) bloqué(s) — gère-les dans Amis → Bloqués.</p>
    <h4>Compte</h4>
    <div class="row"><button id="settings-profile">Modifier mon profil</button><button class="danger-btn" id="settings-logout">Se déconnecter</button></div>
    <p class="small kbd">Raccourcis : <kbd>Ctrl</kbd>+<kbd>K</kbd> aller à un salon · <kbd>Ctrl</kbd>+<kbd>F</kbd> rechercher · <kbd>↑</kbd> modifier ton dernier message · <kbd>Échap</kbd> annuler</p>
    <menu><button class="primary" id="settings-close">Fermer</button></menu>`;
  $('#settings-dlg').showModal();
}
$('#me').addEventListener('click', e => { if (e.target.closest('#open-settings')) openSettings(); });
$('#settings-dlg').addEventListener('click', e => {
  const t = e.target.closest('[data-theme-pick]'); if (t) { prefs.theme = t.dataset.themePick; savePrefs(); return openSettings(); }
  if (e.target === $('#settings-dlg') || e.target.closest('#settings-close')) return $('#settings-dlg').close();
  if (e.target.closest('#ask-notif')) Notification.requestPermission().then(openSettings);
  if (e.target.closest('#install-app')) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; openSettings(); }); }
  if (e.target.closest('#desk-launcher')) { $('#settings-dlg').close(); window.parlotteDesktop.openLauncher(); }
  if (e.target.closest('#desk-addr')) window.parlotteDesktop.showAddresses();
  if (e.target.closest('#settings-profile')) { $('#settings-dlg').close(); openProfile(); }
  if (e.target.closest('#settings-logout')) { $('#settings-dlg').close(); doLogout(); }
});
$('#settings-dlg').addEventListener('input', e => {
  if (e.target.id === 'fs') { prefs.fs = Number(e.target.value); $('#fs-val').textContent = prefs.fs + ' px'; savePrefs(); }
  if (e.target.id === 'compact') { prefs.compact = e.target.checked; savePrefs(); }
  if (e.target.id === 'sounds') { prefs.sounds = e.target.checked; savePrefs(); }
});

// ---------------------------------------------------------------- App installable
let desktopInfo = null;
window.parlotteDesktop?.info().then(i => { desktopInfo = i; }).catch(() => {});
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });
function installHint() {
  if (matchMedia('(display-mode: standalone)').matches) return '✅ Parlotte est installée comme une application.';
  if (/iPhone|iPad/.test(navigator.userAgent)) return 'Sur iPhone : bouton Partager ⬆️ puis « Sur l\'écran d\'accueil ».';
  if (deferredInstall) return 'Installe Parlotte pour l\'ouvrir comme une vraie application.';
  return 'Sur Android : menu ⋮ du navigateur puis « Ajouter à l\'écran d\'accueil ». Sur ordinateur : icône d\'installation dans la barre d\'adresse.';
}
if ('serviceWorker' in navigator && window.isSecureContext && !window.parlotteDesktop) navigator.serviceWorker.register('/sw.js').catch(() => {}); // refusé avec un certificat fait maison : sans gravité

// ---------------------------------------------------------------- Ctrl+K : aller n'importe où
let qsItems = [], qsActive = 0;
function qsSources() {
  const out = [];
  for (const s of st.servers) {
    for (const c of s.channels) out.push({ label: (c.type === 'voice' ? '🔊 ' : '# ') + c.name, sub: s.name, go: () => c.type === 'voice' ? (openChannel(s.id, firstText(s)), joinVoice(c.id)) : openChannel(s.id, c.id), unread: !!st.unread[c.id] });
    for (const t of s.threads || []) out.push({ label: '🧵 ' + t.name, sub: `${s.name} · #${s.channels.find(c => c.id === t.parent_id)?.name || ''}`, go: () => openChannel(s.id, t.id), unread: !!st.unread[t.id] });
    out.push({ label: '🏠 ' + s.name, sub: 'Serveur', go: () => openChannel(s.id, firstText(s)) });
  }
  const withDm = new Set();
  for (const c of st.dms) { if (!c.group) withDm.add(dmOther(c).id); out.push({ label: chanLabel(c), sub: c.group ? 'Groupe' : 'Message privé', go: () => openChannel('@me', c.id), unread: !!st.unread[c.id] }); }
  for (const f of st.friends) if (!withDm.has(f)) out.push({ label: '@' + user(f).name, sub: 'Ami · démarrer une conversation', go: () => act('openDM', { userId: f }) });
  out.push({ label: '👥 Tes potes', sub: 'Amis et demandes', go: () => openChannel('@me', null) });
  out.push({ label: '🔔 Activité', sub: 'Invitations, mentions, j\'aime', go: () => openChannel('@activity', null) });
  return out;
}
function fuzzy(q, text) { // score simple : lettres dans l'ordre, bonus si consécutives / au début
  q = q.toLowerCase(); text = text.toLowerCase();
  if (!q) return 1;
  let ti = 0, score = 0, run = 0;
  for (const ch of q) { const i = text.indexOf(ch, ti); if (i === -1) return 0; run = i === ti ? run + 1 : 0; score += 1 + run * 2 + (i === 0 ? 3 : 0); ti = i + 1; }
  return score - text.length * 0.01;
}
function renderQs() {
  const q = $('#qs-input').value.replace(/^[#@]/, '').trim();
  qsItems = qsSources().map(it => ({ ...it, score: fuzzy(q, it.label.replace(/^\S+\s/, '')) + (it.unread ? 0.5 : 0) })).filter(it => it.score > 0)
    .sort((a, b) => b.score - a.score).slice(0, 12);
  qsActive = 0;
  $('#qs-list').innerHTML = qsItems.map((it, i) => `<li data-qs="${i}" class="${i ? '' : 'active'} ${it.unread ? 'unread' : ''}"><span>${esc(it.label)}</span><small>${esc(it.sub)}</small></li>`).join('')
    || '<li class="empty">Rien trouvé</li>';
}
function openQs() { if (!st.me) return; $('#qs-input').value = ''; renderQs(); $('#qs').showModal(); $('#qs-input').focus(); }
function goQs(i) { const it = qsItems[i]; if (!it) return; $('#qs').close(); it.go(); }
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('#qs').open ? $('#qs').close() : openQs(); } });
$('#qs-input').addEventListener('input', renderQs);
$('#qs-input').addEventListener('keydown', e => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); qsActive = (qsActive + (e.key === 'ArrowDown' ? 1 : qsItems.length - 1)) % Math.max(1, qsItems.length);
    [...$('#qs-list').children].forEach((li, i) => li.classList.toggle('active', i === qsActive)); }
  if (e.key === 'Enter') { e.preventDefault(); goQs(qsActive); }
});
$('#qs-list').addEventListener('click', e => { const li = e.target.closest('[data-qs]'); if (li) goQs(+li.dataset.qs); });
$('#qs').addEventListener('click', e => { if (e.target === $('#qs')) $('#qs').close(); });
$('#qs-open').onclick = openQs;

// ---------------------------------------------------------------- Retour au présent
const viewBox = $('#view');
viewBox.addEventListener('scroll', () => {
  const far = viewBox.scrollHeight - viewBox.scrollTop - viewBox.clientHeight > 600;
  $('#jump-present').hidden = !far; if (!far) $('#jump-present').classList.remove('news');
});
$('#jump-present').onclick = () => { viewBox.scrollTo({ top: viewBox.scrollHeight, behavior: 'smooth' }); };
const _onNew = onNewMessage;
onNewMessage = function (msg) { // signale les nouveaux messages quand on est remonté loin
  _onNew(msg);
  if (msg.channel_id === st.view.channel && msg.author_id !== st.me && !$('#jump-present').hidden) $('#jump-present').classList.add('news');
};

// ---------------------------------------------------------------- Spoilers, messages bloqués, blocage
document.addEventListener('click', e => {
  const sp = e.target.closest('.spoiler'); if (sp) sp.classList.add('shown');
  const rv = e.target.closest('[data-reveal]'); if (rv) { (st.revealed = st.revealed || new Set()).add(rv.dataset.reveal); renderMain('keep'); }
  const ub = e.target.closest('[data-unblock]'); if (ub) act('unblock', { userId: ub.dataset.unblock }).then(() => toast('Débloqué'));
  const bl = e.target.closest('[data-block]');
  if (bl && confirm(`Bloquer ${user(bl.dataset.block).name} ? Vous ne serez plus amis, il ne pourra plus t'écrire ni t'appeler en privé, et ses messages seront masqués.`)) {
    $('#card').hidden = true; act('block', { userId: bl.dataset.block }).then(() => toast('Utilisateur bloqué'));
  }
});

setMode('login');
connect();
