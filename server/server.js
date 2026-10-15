'use strict';
// Parlotte — serveur de discussion en temps réel, sans aucune dépendance.
// Lancement : node server.js  (puis ouvre l'adresse affichée sur chaque appareil du même wifi)
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 3000;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || PORT + 443; // 3443 par défaut
const https = require('https');
const { generateCertificate } = require('./cert');
const PUBLIC = path.join(__dirname, 'public');
// Dossier des données : à côté du serveur par défaut, ou celui choisi par l'application de bureau.
const DATA_DIR = process.env.PARLOTTE_DATA || __dirname;
fs.mkdirSync(DATA_DIR, { recursive: true });
const DATA_FILE = path.join(DATA_DIR, 'data.json');
const UPLOADS = path.join(DATA_DIR, 'uploads');
const MAX_UPLOAD = 10 * 1024 * 1024; // 10 Mo par fichier
fs.mkdirSync(UPLOADS, { recursive: true });
// Seuls ces types sont affichés directement dans le navigateur ; tout le reste est servi en téléchargement
// (sinon un fichier .html ou .svg envoyé par quelqu'un pourrait exécuter du code dans l'app).
const INLINE_TYPES = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp',
  'video/mp4': '.mp4', 'video/webm': '.webm', 'audio/mpeg': '.mp3', 'audio/ogg': '.ogg', 'audio/wav': '.wav',
  'audio/webm': '.webm', 'audio/mp4': '.m4a', 'audio/aac': '.aac' };
require(path.join(PUBLIC, 'search.js'));            // même moteur de recherche que le client
const Search = globalThis.DiscordLikeSearch;

// ---------------------------------------------------------------- Permissions (bits)
// Inspiré du modèle public de Discord : permissions de base via les rôles, puis surcharges par salon.
const P = {
  VIEW: 1 << 0, SEND: 1 << 1, ATTACH: 1 << 2, REACT: 1 << 3, MANAGE_MESSAGES: 1 << 4, MANAGE_CHANNELS: 1 << 5,
  MANAGE_ROLES: 1 << 6, MANAGE_SERVER: 1 << 7, KICK: 1 << 8, BAN: 1 << 9, INVITE: 1 << 10,
  CONNECT: 1 << 11, SPEAK: 1 << 12, VIDEO: 1 << 13, MENTION_EVERYONE: 1 << 14, ADMIN: 1 << 15, MANAGE_EMOJIS: 1 << 16,
};
const ALL = Object.values(P).reduce((a, b) => a | b, 0);
const DEFAULT_PERMS = P.VIEW | P.SEND | P.ATTACH | P.REACT | P.INVITE | P.CONNECT | P.SPEAK | P.VIDEO;

// ---------------------------------------------------------------- Stockage
const empty = () => ({ users: {}, sessions: {}, servers: {}, channels: {}, messages: [], friendships: [], uploads: {}, blocks: {} });
let db;
try { db = Object.assign(empty(), JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'))); } catch { db = empty(); }
let migrated = false;
for (const s of Object.values(db.servers)) {
  if (!s.channels.some(c => db.channels[c]?.type === 'voice')) {
    migrated = true;
    const c = { id: Date.now().toString(36) + crypto.randomBytes(4).toString('hex'), type: 'voice', server_id: s.id, name: 'Vocal', topic: '' };
    db.channels[c.id] = c; s.channels.push(c.id);
  }
}
for (const s of Object.values(db.servers)) {
  if (!s.roles) { migrated = true; s.roles = [{ id: s.id, name: '@everyone', color: null, perms: DEFAULT_PERMS, hoist: false, position: 0 }]; }
  if (!s.memberRoles) { migrated = true; s.memberRoles = {}; }
  if (!s.bans) { migrated = true; s.bans = []; }
  if (!s.emojis) { migrated = true; s.emojis = []; }
  if (!s.sounds) { migrated = true; s.sounds = []; }
}
let saveTimer = null;
// Statuts personnalisés expirés : on les efface et on prévient.
setInterval(() => {
  for (const u of Object.values(db.users)) if (statusExpired(u)) {
    u.customStatus = ''; u.statusEmoji = ''; u.statusExpires = null; save();
    if (online.has(u.id)) { sendTo(u.id, { t: 'profile', profile: ownProfile(u) }); presenceChanged(u.id); }
  }
}, 30000).unref();
if (migrated) setImmediate(() => save());
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DATA_FILE);
  }, 300);
}

const id = () => Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
const COLORS = ['#5865f2', '#3ba55d', '#eb459e', '#faa61a', '#ed4245', '#9b59b6', '#1abc9c', '#e67e22'];
const now = () => new Date().toISOString();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}
function checkPassword(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}

// ---------------------------------------------------------------- Règles d'accès
const online = new Map(); // userId -> Set(socket)
// Statut vu par les autres : le statut choisi si connecté ; « invisible » apparaît hors ligne.
// « online » devient « idle » si tous les appareils de la personne sont inactifs depuis un moment.
const allIdle = uid => [...(online.get(uid) || [])].every(w => w.idle);
const status = uid => {
  if (!online.has(uid)) return 'offline';
  const s = db.users[uid]?.presence || 'online';
  if (s === 'invisible') return 'offline';
  return s === 'online' && allIdle(uid) ? 'idle' : s;
};
// Statut personnalisé (texte + emoji), qui peut expirer.
const statusExpired = u => u.statusExpires && new Date(u.statusExpires) <= new Date();
const customOf = u => (statusExpired(u) ? { text: '', emoji: '' } : { text: u.customStatus || '', emoji: u.statusEmoji || '' });
// Activité (jeu en cours) détectée par l'app de bureau ; cachée en mode invisible.
const activityOf = uid => {
  if (status(uid) === 'offline') return null;
  for (const w of online.get(uid) || []) if (w.activity) return w.activity;
  return null;
};
const fileUrl = fid => (fid && db.uploads[fid] ? `/uploads/${fid}` : null);
const publicUser = u => ({ id: u.id, name: u.name, color: u.color, status: status(u.id), bot: !!u.bot,
  avatar: fileUrl(u.avatar), about: u.about || '', customStatus: customOf(u).text, statusEmoji: customOf(u).emoji, activity: activityOf(u.id) });
const serversOf = uid => Object.values(db.servers).filter(s => s.members.includes(uid));
const dmsOf = uid => Object.values(db.channels).filter(c => c.type === 'dm' && c.members.includes(uid));
const roleIdsOf = (s, uid) => [s.id, ...((s.memberRoles || {})[uid] || [])];
// Rang = position du rôle le plus haut ; le propriétaire est au-dessus de tout.
const rankOf = (s, uid) => s.owner === uid ? Infinity : Math.max(0, ...roleIdsOf(s, uid).map(r => s.roles.find(x => x.id === r)?.position ?? 0));
function serverPerms(s, uid) {
  if (!s || !s.members.includes(uid)) return 0;
  if (s.owner === uid) return ALL;
  const ids = roleIdsOf(s, uid);
  const p = s.roles.filter(r => ids.includes(r.id)).reduce((a, r) => a | r.perms, 0);
  return p & P.ADMIN ? ALL : p;
}
// Ordre d'application des surcharges : @everyone (refus puis autorisations), rôles, puis le membre lui-même.
function channelPerms(ch, uid) {
  if (!ch) return 0;
  if (ch.type === 'thread') return channelPerms(db.channels[ch.parent_id], uid);
  if (ch.type === 'dm') return ch.members.includes(uid) ? ALL & ~(P.MANAGE_CHANNELS | P.MANAGE_ROLES | P.MANAGE_SERVER | P.KICK | P.BAN | P.ADMIN) : 0;
  const s = db.servers[ch.server_id];
  let p = serverPerms(s, uid);
  if (p === ALL) return ALL;
  const ow = ch.overwrites || [];
  const ev = ow.find(o => o.id === s.id);
  if (ev) p = (p & ~ev.deny) | ev.allow;
  const ids = roleIdsOf(s, uid);
  let allow = 0, deny = 0;
  for (const o of ow) if (o.type === 'role' && o.id !== s.id && ids.includes(o.id)) { allow |= o.allow; deny |= o.deny; }
  p = (p & ~deny) | allow;
  const me = ow.find(o => o.type === 'member' && o.id === uid);
  if (me) p = (p & ~me.deny) | me.allow;
  if (!(p & P.VIEW)) return 0;                                       // salon invisible = aucun droit
  if (ch.type !== 'voice' && !(p & P.SEND)) p &= ~P.ATTACH;           // pas d'écriture = pas de fichiers
  if (ch.type === 'voice' && !(p & P.CONNECT)) p &= ~(P.SPEAK | P.VIDEO);
  return p;
}
const can = (uid, ch, flag) => (channelPerms(ch, uid) & flag) === flag;
const canAccess = (uid, ch) => can(uid, ch, P.VIEW);
function need(uid, ch, flag, msg) { if (!can(uid, ch, flag)) throw new Error(msg || 'Tu n\'as pas la permission de faire ça'); }
function needServer(uid, s, flag, msg) { if (!s || (serverPerms(s, uid) & flag) !== flag) throw new Error(msg || 'Tu n\'as pas la permission de faire ça'); }
const audienceOf = ch => ch.type === 'thread' ? audienceOf(db.channels[ch.parent_id]) : ch.type === 'dm' ? ch.members : (db.servers[ch.server_id]?.members || []).filter(u => canAccess(u, ch));
const friendship = (a, b) => db.friendships.find(f => (f.from === a && f.to === b) || (f.from === b && f.to === a));
const blocked = (a, b) => (db.blocks[a] || []).includes(b) || (db.blocks[b] || []).includes(a); // l'un a bloqué l'autre
const friendsOf = uid => db.friendships.filter(f => f.accepted && (f.from === uid || f.to === uid)).map(f => (f.from === uid ? f.to : f.from));

// Tout ce que le client doit savoir après connexion.
function bootstrap(uid) {
  const servers = serversOf(uid).map(s => {
    const my = serverPerms(s, uid);
    return { id: s.id, name: s.name, owner: s.owner, members: s.members, created: s.created,
      roles: s.roles, memberRoles: s.memberRoles, myPerms: my, myRank: Math.min(rankOf(s, uid), 1e9) /* Infinity ne passe pas en JSON */,
      invite: my & P.INVITE ? s.invite : null, bans: my & P.BAN ? s.bans : [],
      channels: s.channels.map(cid => db.channels[cid]).filter(c => c && canAccess(uid, c)).map(c => ({ ...c, perms: channelPerms(c, uid) })),
      threads: threadsOf(s).filter(t => canAccess(uid, t)).map(t => ({ ...t, perms: channelPerms(t, uid) })),
      emojis: (s.emojis || []).map(publicEmoji), sounds: (s.sounds || []).map(publicSound) };
  });
  const dms = dmsOf(uid);
  const userIds = new Set([uid]);
  servers.forEach(s => s.members.forEach(m => userIds.add(m)));
  dms.forEach(c => c.members.forEach(m => userIds.add(m)));
  const rel = db.friendships.filter(f => f.from === uid || f.to === uid);
  rel.forEach(f => { userIds.add(f.from); userIds.add(f.to); });
  (db.blocks[uid] || []).forEach(u => userIds.add(u));
  const users = {}; userIds.forEach(u => db.users[u] && (users[u] = publicUser(db.users[u])));
  const lastByChannel = {};
  const visible = new Set([...servers.flatMap(s => [...s.channels, ...s.threads].map(c => c.id)), ...dms.map(c => c.id)]);
  for (const m of db.messages) if (visible.has(m.channel_id)) lastByChannel[m.channel_id] = m.timestamp;
  return {
    t: 'bootstrap', P, me: uid, users, servers, dms, lastByChannel, voice: voiceSnapshot(uid),
    friends: friendsOf(uid), blocked: db.blocks[uid] || [],
    incoming: rel.filter(f => !f.accepted && f.to === uid).map(f => f.from),
    outgoing: rel.filter(f => !f.accepted && f.from === uid).map(f => f.to),
  };
}

// ---------------------------------------------------------------- Diffusion
function sendTo(uid, msg) { const set = online.get(uid); if (set) for (const ws of set) ws.send(msg); }
function broadcast(uids, msg) { new Set(uids).forEach(u => sendTo(u, msg)); }
function refresh(uids) { new Set(uids).forEach(u => online.has(u) && sendTo(u, bootstrap(u))); }
function presenceChanged(uid) {
  const watchers = new Set([uid, ...friendsOf(uid)]);
  serversOf(uid).forEach(s => s.members.forEach(m => watchers.add(m)));
  dmsOf(uid).forEach(c => c.members.forEach(m => watchers.add(m)));
  broadcast([...watchers], { t: 'presence', user: publicUser(db.users[uid]) });
}


// ---------------------------------------------------------------- Vocal : état
const voice = new Map(); // channelId -> Map(userId -> {ws, muted, deafened, since})
const voiceMembers = cid => [...(voice.get(cid) || new Map())].map(([uid, v]) => ({ id: uid, muted: v.muted, deafened: v.deafened, camera: v.camera || null, screen: v.screen || null, since: v.since }));
function voiceChanged(cid) {
  const ch = db.channels[cid]; if (!ch) return;
  broadcast(audienceOf(ch), { t: 'voice', channelId: cid, members: voiceMembers(cid) });
}
function leaveVoice(ws, silent) {
  const cid = ws.voice; if (!cid) return;
  ws.voice = null;
  const room = voice.get(cid);
  if (room && room.get(ws.uid)?.ws === ws) {
    room.delete(ws.uid);
    for (const [, v] of room) v.ws.send({ t: 'peerLeft', channelId: cid, userId: ws.uid });
    if (!room.size) voice.delete(cid);
  }
  voiceChanged(cid);
}
function voiceSnapshot(uid) {
  const out = {};
  for (const [cid] of voice) if (canAccess(uid, db.channels[cid])) out[cid] = voiceMembers(cid);
  return out;
}


// ---------------------------------------------------------------- Fils et emojis : utilitaires
const threadsOf = s => Object.values(db.channels).filter(c => c.type === 'thread' && c.server_id === s.id);
const publicEmoji = e => ({ id: e.id, name: e.name, url: `/uploads/${e.file}`, by: e.by });
const publicSound = x => ({ id: x.id, name: x.name, emoji: x.emoji || '', url: `/uploads/${x.file}`, volume: x.volume ?? 1, by: x.by });
// Sons intégrés : synthétisés par le client, rien à télécharger.
const BUILTIN_SOUNDS = ['airhorn', 'rimshot', 'applause', 'ding', 'sadtrombone', 'drumroll', 'tada', 'pop'];
const lastSound = new Map(); // userId -> horodatage (anti-spam)
function broadcastThread(t) {
  for (const u of audienceOf(t)) sendTo(u, { t: 'threadUpdate', thread: { ...t, perms: channelPerms(t, u) } });
}
function threadActivity(t) {
  t.last = now(); t.count = (t.count || 0) + 1;
  const wasArchived = t.archived; t.archived = false;
  const starter = db.messages.find(m => m.id === t.starter_id);
  if (starter?.thread) { Object.assign(starter.thread, { count: t.count, last: t.last }); broadcast(audienceOf(t), { t: 'messageUpdate', message: starter }); }
  save(); if (wasArchived || t.count === 1) broadcastThread(t);
}

// ---------------------------------------------------------------- Actions
const clean = (s, max) => String(s ?? '').trim().slice(0, max);
const validName = n => /^[\p{L}\p{N}_.-]{2,24}$/u.test(n);
const inviteCode = () => crypto.randomBytes(4).toString('hex');

function createChannel(serverId, name, type = 'text') {
  const c = { id: id(), type, server_id: serverId, name, topic: '' };
  db.channels[c.id] = c; db.servers[serverId].channels.push(c.id);
  return c;
}
function systemMessage(channelId, content) {
  const m = { id: id(), channel_id: channelId, author_id: 'system', timestamp: now(), content, reactions: {}, mentions: [] };
  db.messages.push(m); return m;
}

function manageableRole(uid, s, roleId) {
  needServer(uid, s, P.MANAGE_ROLES, 'Il faut la permission « Gérer les rôles »');
  const r = s.roles.find(x => x.id === roleId); if (!r) throw new Error('Rôle introuvable');
  if (r.id !== s.id && r.position >= rankOf(s, uid)) throw new Error('Tu ne peux modifier que les rôles en dessous du tien');
  return r;
}
function checkTarget(s, actor, target) {
  if (!s.members.includes(target)) throw new Error('Ce membre n\'est pas sur le serveur');
  if (target === s.owner) throw new Error('On ne peut pas expulser le propriétaire');
  if (target === actor) throw new Error('Utilise « Quitter le serveur » pour partir');
  if (rankOf(s, target) >= rankOf(s, actor)) throw new Error('Ce membre est au même niveau ou au-dessus de toi');
}
function removeMember(s, uid) {
  s.members = s.members.filter(m => m !== uid);
  delete s.memberRoles[uid];
  for (const cid of s.channels) {
    const v = voice.get(cid)?.get(uid);
    if (v) { v.ws.send({ t: 'voiceKicked', reason: `Tu n'es plus membre de ${s.name}` }); leaveVoice(v.ws); }
  }
}
// Après un changement de droits : on sort du vocal ceux qui n'ont plus le droit d'y être.
function kickFromForbiddenVoice(s) {
  for (const cid of s.channels) for (const [uid, v] of [...(voice.get(cid) || [])])
    if (!can(uid, db.channels[cid], P.CONNECT)) { v.ws.send({ t: 'voiceKicked', reason: 'Tu n\'as plus accès à ce salon vocal' }); leaveVoice(v.ws); }
}
// @pseudo → cette personne ; @everyone → tout le salon ; @here → les personnes en ligne (si permission).
function mentionsIn(text, audience, author, ch) {
  const out = new Set();
  for (const x of text.matchAll(/@([\p{L}\p{N}_.-]+)/gu)) {
    const name = x[1].toLowerCase();
    if ((name === 'everyone' || name === 'here') && author && ch && ch.type !== 'dm' && can(author, ch, P.MENTION_EVERYONE))
      audience.filter(u => u !== author && (name === 'everyone' || status(u) !== 'offline')).forEach(u => out.add(u));
    else { const u = audience.find(u => db.users[u]?.name.toLowerCase() === name); if (u) out.add(u); }
  }
  return [...out];
}

const handlers = {
  // --- Comptes
  register(ws, { username, password }) {
    const name = clean(username, 24);
    if (!validName(name)) throw new Error('Pseudo : 2 à 24 caractères (lettres, chiffres, _ . -)');
    if (String(password || '').length < 6) throw new Error('Mot de passe : 6 caractères minimum');
    if (Object.values(db.users).some(u => u.name.toLowerCase() === name.toLowerCase())) throw new Error('Ce pseudo est déjà pris');
    const u = { id: id(), name, color: COLORS[Object.keys(db.users).length % COLORS.length], created: now(), ...hashPassword(String(password)) };
    db.users[u.id] = u; save();
    return login(ws, u);
  },
  login(ws, { username, password }) {
    const u = Object.values(db.users).find(x => x.name.toLowerCase() === clean(username, 24).toLowerCase());
    if (!u || u.bot || !checkPassword(u, String(password || ''))) throw new Error('Pseudo ou mot de passe incorrect');
    return login(ws, u);
  },
  resume(ws, { token }) {
    const uid = db.sessions[token];
    if (!uid || !db.users[uid]) throw new Error('Session expirée, reconnecte-toi');
    return login(ws, db.users[uid], token);
  },
  logout(ws, { token }) { delete db.sessions[token]; save(); ws.close(); },

  // --- Serveurs
  createServer(ws, { name }) {
    name = clean(name, 40); if (!name) throw new Error('Nom de serveur vide');
    const s = { id: id(), name, owner: ws.uid, members: [ws.uid], channels: [], invite: inviteCode(), created: now(),
      memberRoles: {}, bans: [], emojis: [], sounds: [] };
    s.roles = [{ id: s.id, name: '@everyone', color: null, perms: DEFAULT_PERMS, hoist: false, position: 0 }];
    db.servers[s.id] = s;
    const general = createChannel(s.id, 'general'); createChannel(s.id, 'jeux'); createChannel(s.id, 'Vocal', 'voice');
    systemMessage(general.id, `Bienvenue sur **${name}** ! Code d'invitation : \`${s.invite}\``);
    save(); refresh([ws.uid]);
    return { t: 'opened', server: s.id, channel: general.id };
  },
  joinServer(ws, { code }) {
    const s = Object.values(db.servers).find(x => x.invite === clean(code, 20).toLowerCase());
    if (!s) throw new Error('Code d\'invitation invalide');
    if (s.bans.includes(ws.uid)) throw new Error('Tu as été banni de ce serveur');
    if (!s.members.includes(ws.uid)) {
      s.members.push(ws.uid);
      const first = db.channels[s.channels.find(c => db.channels[c].type === 'text')];
      const m = systemMessage(first.id, `**${db.users[ws.uid].name}** a rejoint le serveur 👋`);
      save(); refresh(s.members); broadcast(audienceOf(first), { t: 'message', message: m });
    }
    return { t: 'opened', server: s.id, channel: s.channels[0] };
  },
  leaveServer(ws, { serverId }) {
    const s = db.servers[serverId]; if (!s || !s.members.includes(ws.uid)) throw new Error('Serveur introuvable');
    if (s.owner === ws.uid) throw new Error('Le propriétaire ne peut pas quitter son serveur (supprime-le plutôt)');
    removeMember(s, ws.uid);
    save(); refresh([...s.members, ws.uid]);
  },
  deleteServer(ws, { serverId }) {
    const s = db.servers[serverId]; if (!s || s.owner !== ws.uid) throw new Error('Seul le propriétaire peut supprimer le serveur');
    const members = s.members;
    const all = [...s.channels, ...threadsOf(s).map(t => t.id)];
    db.messages = db.messages.filter(m => !all.includes(m.channel_id));
    all.forEach(c => delete db.channels[c]); delete db.servers[serverId];
    save(); refresh(members);
  },
  createChannel(ws, { serverId, name, type }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_CHANNELS, 'Il faut la permission « Gérer les salons »');
    const voice = type === 'voice';
    name = voice ? clean(name, 30) : clean(name, 30).toLowerCase().replace(/\s+/g, '-'); if (!name) throw new Error('Nom de salon vide');
    const c = createChannel(serverId, name, voice ? 'voice' : 'text'); save(); refresh(s.members);
    if (voice) return;
    return { t: 'opened', server: serverId, channel: c.id };
  },
  newInvite(ws, { serverId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_SERVER);
    s.invite = inviteCode(); save(); refresh(s.members);
  },

  // --- Amis et messages privés
  friendRequest(ws, { username }) {
    const target = Object.values(db.users).find(u => u.name.toLowerCase() === clean(username, 24).toLowerCase());
    if (!target || target.bot) throw new Error('Aucun utilisateur avec ce pseudo');
    if (target.id === ws.uid) throw new Error('Tu ne peux pas t\'ajouter toi-même 🙂');
    if (blocked(ws.uid, target.id)) throw new Error('Impossible d\'ajouter cette personne');
    const f = friendship(ws.uid, target.id);
    if (f && f.accepted) throw new Error('Vous êtes déjà amis');
    if (f && f.from === ws.uid) throw new Error('Demande déjà envoyée');
    if (f) f.accepted = true; // il m'avait déjà demandé : on accepte
    else db.friendships.push({ from: ws.uid, to: target.id, accepted: false, created: now() });
    save(); refresh([ws.uid, target.id]);
    return { t: 'info', text: f ? `Toi et ${target.name} êtes maintenant amis !` : `Demande envoyée à ${target.name}` };
  },
  friendAccept(ws, { userId }) {
    const f = friendship(ws.uid, userId); if (!f || f.to !== ws.uid) throw new Error('Aucune demande de cet utilisateur');
    f.accepted = true; save(); refresh([ws.uid, userId]);
  },
  friendRemove(ws, { userId }) { // refuser, annuler ou retirer
    db.friendships = db.friendships.filter(f => f !== friendship(ws.uid, userId)); save(); refresh([ws.uid, userId]);
  },
  openDM(ws, { userId }) {
    if (!db.users[userId] || userId === ws.uid) throw new Error('Utilisateur introuvable');
    let c = dmsOf(ws.uid).find(x => x.members.includes(userId));
    if (!c && blocked(ws.uid, userId)) throw new Error('Impossible d\'écrire à cette personne');
    if (!c) {
      if (!friendsOf(ws.uid).includes(userId)) throw new Error('Ajoute cette personne en ami pour lui écrire');
      c = { id: id(), type: 'dm', members: [ws.uid, userId] }; db.channels[c.id] = c; save(); refresh([ws.uid, userId]);
    }
    return { t: 'opened', server: '@me', channel: c.id };
  },

  // --- Messages
  history(ws, { channelId, before }) {
    const ch = db.channels[channelId]; if (!canAccess(ws.uid, ch)) throw new Error('Salon inaccessible');
    let list = db.messages.filter(m => m.channel_id === channelId && (!before || m.timestamp < before));
    const more = list.length > 50; list = list.slice(-50);
    return { t: 'history', channelId, messages: list, more, prepend: !!before };
  },
  send(ws, { channelId, content, replyTo, attachments, voiceNote }) {
    const ch = db.channels[channelId]; if (!canAccess(ws.uid, ch)) throw new Error('Salon inaccessible');
    if (ch.type === 'voice') throw new Error('On ne peut pas écrire dans un salon vocal');
    need(ws.uid, ch, P.SEND, 'Tu ne peux pas écrire dans ce salon');
    if (ch.type === 'dm' && blocked(ch.members[0], ch.members[1])) throw new Error('Impossible d\'écrire à cette personne (blocage)');
    if (attachments?.length) need(ws.uid, ch, P.ATTACH, 'Tu ne peux pas envoyer de fichiers dans ce salon');
    content = clean(content, 2000);
    // Pièces jointes : uniquement des fichiers que cet utilisateur a lui-même envoyés, 10 max.
    const files = (Array.isArray(attachments) ? attachments : []).slice(0, 10)
      .map(fid => db.uploads[fid]).filter(u => u && u.owner === ws.uid)
      .map(u => ({ id: u.id, url: `/uploads/${u.id}`, filename: u.filename, size: u.size, content_type: u.content_type }));
    if (!content && !files.length) return;
    const audience = audienceOf(ch);
    const m = { id: id(), channel_id: channelId, author_id: ws.uid, timestamp: now(), content, reactions: {}, mentions: mentionsIn(content, audience, ws.uid, ch) };
    if (files.length) m.attachments = files;
    // Message vocal : un seul fichier audio + durée et forme d'onde calculées par le navigateur.
    if (voiceNote && files.length === 1 && /^audio\//.test(files[0].content_type)) {
      const dur = Math.max(0, Math.min(600, Number(voiceNote.duration) || 0));
      const wave = (Array.isArray(voiceNote.waveform) ? voiceNote.waveform : []).slice(0, 64).map(v => Math.max(0, Math.min(100, Math.round(Number(v) || 0))));
      files[0].voice = { duration: Math.round(dur * 10) / 10, waveform: wave };
    }
    const link = content.match(/https?:\/\/\S+/); if (link) m.embeds = [{ url: link[0] }];
    if (replyTo && db.messages.some(x => x.id === replyTo && x.channel_id === channelId)) m.reply_to = replyTo;
    db.messages.push(m); save();
    broadcast(audience, { t: 'message', message: m });
    if (ch.type === 'thread') threadActivity(ch);
  },
  edit(ws, { messageId, content }) {
    const m = db.messages.find(x => x.id === messageId); if (!m || m.author_id !== ws.uid || !canAccess(ws.uid, db.channels[m.channel_id])) throw new Error('Tu ne peux modifier que tes messages');
    content = clean(content, 2000); if (!content && !m.poll) return;
    const ch = db.channels[m.channel_id];
    Object.assign(m, { content, edited: now(), mentions: mentionsIn(content, audienceOf(ch), ws.uid, ch) }); save();
    broadcast(audienceOf(ch), { t: 'messageUpdate', message: m });
  },
  delete(ws, { messageId }) {
    const m = db.messages.find(x => x.id === messageId); if (!m) return;
    const ch = db.channels[m.channel_id];
    if (!canAccess(ws.uid, ch) || (m.author_id !== ws.uid && (ch.type === 'dm' || !can(ws.uid, ch, P.MANAGE_MESSAGES))))
      throw new Error('Tu ne peux supprimer que tes messages');
    db.messages = db.messages.filter(x => x !== m); save();
    broadcast(audienceOf(ch), { t: 'messageDelete', id: m.id, channelId: m.channel_id });
  },
  react(ws, { messageId, emoji }) {
    const m = db.messages.find(x => x.id === messageId); const ch = m && db.channels[m.channel_id];
    if (!canAccess(ws.uid, ch)) throw new Error('Message inaccessible');
    emoji = clean(emoji, 60); if (!emoji || (emoji.length > 16 && !/^<:\w{2,32}:[0-9a-z]+>$/.test(emoji))) return;
    if (!m.reactions[emoji]) need(ws.uid, ch, P.REACT, 'Tu ne peux pas ajouter de réactions ici');
    const who = (m.reactions[emoji] = m.reactions[emoji] || []), i = who.indexOf(ws.uid);
    i === -1 ? who.push(ws.uid) : who.splice(i, 1);
    if (!who.length) delete m.reactions[emoji];
    save(); broadcast(audienceOf(ch), { t: 'messageUpdate', message: m });
  },
  pin(ws, { messageId }) {
    const m = db.messages.find(x => x.id === messageId); const ch = m && db.channels[m.channel_id];
    need(ws.uid, ch, P.MANAGE_MESSAGES, 'Il faut la permission « Gérer les messages » pour épingler');
    m.pinned = !m.pinned; save(); broadcast(audienceOf(ch), { t: 'messageUpdate', message: m });
  },

  // --- Sondages
  createPoll(ws, { channelId, question, answers, multi, hours }) {
    const ch = db.channels[channelId]; if (!canAccess(ws.uid, ch) || ch.type === 'voice') throw new Error('Salon inaccessible');
    need(ws.uid, ch, P.SEND, 'Tu ne peux pas écrire dans ce salon');
    question = clean(question, 300); if (!question) throw new Error('Il faut une question');
    const list = (Array.isArray(answers) ? answers : []).map(a => clean(a, 55)).filter(Boolean);
    if (list.length < 2 || list.length > 10) throw new Error('Entre 2 et 10 réponses');
    if (new Set(list.map(a => a.toLowerCase())).size !== list.length) throw new Error('Deux réponses sont identiques');
    const h = [1, 4, 8, 24, 72, 168].includes(Number(hours)) ? Number(hours) : 24;
    const m = { id: id(), channel_id: channelId, author_id: ws.uid, timestamp: now(), content: '', reactions: {}, mentions: [],
      poll: { question, multi: !!multi, expires: new Date(Date.now() + h * 3600e3).toISOString(), answers: list.map((text, i) => ({ id: String(i + 1), text, votes: [] })) } };
    db.messages.push(m); save();
    broadcast(audienceOf(ch), { t: 'message', message: m });
  },
  vote(ws, { messageId, answerIds }) {
    const m = db.messages.find(x => x.id === messageId); const ch = m && db.channels[m.channel_id];
    if (!m?.poll || !canAccess(ws.uid, ch)) throw new Error('Sondage introuvable');
    if (new Date(m.poll.expires) <= new Date()) throw new Error('Ce sondage est terminé');
    let ids = (Array.isArray(answerIds) ? answerIds : []).map(String).filter(x => m.poll.answers.some(a => a.id === x));
    if (!m.poll.multi) ids = ids.slice(0, 1);
    for (const a of m.poll.answers) { a.votes = a.votes.filter(u => u !== ws.uid); if (ids.includes(a.id)) a.votes.push(ws.uid); }
    save(); broadcast(audienceOf(ch), { t: 'messageUpdate', message: m });
  },
  endPoll(ws, { messageId }) {
    const m = db.messages.find(x => x.id === messageId); const ch = m && db.channels[m.channel_id];
    if (!m?.poll || !canAccess(ws.uid, ch)) throw new Error('Sondage introuvable');
    if (m.author_id !== ws.uid && !can(ws.uid, ch, P.MANAGE_MESSAGES)) throw new Error('Seul l\'auteur ou un modérateur peut terminer le sondage');
    m.poll.expires = now(); save(); broadcast(audienceOf(ch), { t: 'messageUpdate', message: m });
  },
  pins(ws, { channelId }) {
    const ch = db.channels[channelId]; if (!canAccess(ws.uid, ch)) throw new Error('Salon inaccessible');
    return { t: 'pinsList', channelId, messages: db.messages.filter(m => m.channel_id === channelId && m.pinned).reverse() };
  },
  typing(ws, { channelId }) {
    const ch = db.channels[channelId]; if (!can(ws.uid, ch, P.SEND)) return;
    broadcast(audienceOf(ch).filter(u => u !== ws.uid), { t: 'typing', channelId, userId: ws.uid });
  },

  // --- Vocal (WebRTC : le serveur ne transporte pas le son, il met seulement les appareils en relation)
  voiceJoin(ws, { channelId }) {
    const ch = db.channels[channelId];
    if (!canAccess(ws.uid, ch) || (ch.type !== 'voice' && ch.type !== 'dm')) throw new Error('Salon vocal inaccessible');
    need(ws.uid, ch, P.CONNECT, 'Tu n\'as pas le droit de rejoindre ce salon vocal');
    leaveVoice(ws, true);
    // Même compte déjà en vocal sur un autre appareil : on le déconnecte du vocal.
    for (const [cid, room] of voice) {
      const old = room.get(ws.uid);
      if (old && old.ws !== ws) { old.ws.send({ t: 'voiceKicked', reason: 'Tu as rejoint le vocal depuis un autre appareil' }); leaveVoice(old.ws); }
    }
    const room = voice.get(channelId) || new Map(); voice.set(channelId, room);
    const peers = [...room.keys()];
    room.set(ws.uid, { ws, muted: false, deafened: false, since: now() });
    ws.voice = channelId;
    voiceChanged(channelId);
    if (ch.type === 'dm') {
      const other = ch.members.find(m => m !== ws.uid);
      if (blocked(ws.uid, other)) { leaveVoice(ws); throw new Error('Impossible d\'appeler cette personne'); }
      if (!room.has(other)) sendTo(other, { t: 'ring', channelId, from: ws.uid });
    }
    return { t: 'voiceJoined', channelId, peers };
  },
  voiceLeave(ws) { leaveVoice(ws); },
  voiceState(ws, { muted, deafened, camera, screen }) {
    const room = ws.voice && voice.get(ws.voice); const me = room?.get(ws.uid); if (!me || me.ws !== ws) return;
    const streamId = v => (typeof v === 'string' && /^[\w{}-]{1,64}$/.test(v) ? v : null); // identifiant du flux vidéo
    const ch = db.channels[ws.voice];
    me.muted = !!muted || !can(ws.uid, ch, P.SPEAK); me.deafened = !!deafened;
    me.camera = can(ws.uid, ch, P.VIDEO) ? streamId(camera) : null; me.screen = can(ws.uid, ch, P.VIDEO) ? streamId(screen) : null;
    voiceChanged(ws.voice);
  },
  voiceDecline(ws, { channelId }) {
    const room = voice.get(channelId); const ch = db.channels[channelId];
    if (!room || !canAccess(ws.uid, ch)) return;
    for (const [, v] of room) v.ws.send({ t: 'callDeclined', channelId, by: ws.uid });
  },
  rtc(ws, { to, data }) { // relaie offre/réponse/candidats ICE entre deux membres du même salon vocal
    const room = ws.voice && voice.get(ws.voice); const peer = room?.get(to);
    if (!peer || room.get(ws.uid)?.ws !== ws) return;
    peer.ws.send({ t: 'rtc', from: ws.uid, data });
  },


  // --- Administration du serveur : rôles, membres, salons
  updateServer(ws, { serverId, name }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_SERVER, 'Il faut la permission « Gérer le serveur »');
    name = clean(name, 40); if (!name) throw new Error('Nom de serveur vide');
    s.name = name; save(); refresh(s.members);
  },
  createRole(ws, { serverId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_ROLES, 'Il faut la permission « Gérer les rôles »');
    if (s.roles.length >= 50) throw new Error('50 rôles maximum');
    s.roles.forEach(r => { if (r.position >= 1) r.position++; });
    const r = { id: id(), name: 'nouveau rôle', color: '#99aab5', perms: 0, hoist: false, position: 1 };
    s.roles.push(r); save(); refresh(s.members);
    return { t: 'roleCreated', roleId: r.id };
  },
  updateRole(ws, { serverId, roleId, name, color, perms, hoist }) {
    const s = db.servers[serverId], r = manageableRole(ws.uid, s, roleId);
    const mine = serverPerms(s, ws.uid);
    if (name !== undefined && r.id !== s.id) { name = clean(name, 30); if (!name) throw new Error('Nom de rôle vide'); r.name = name; }
    if (color !== undefined && r.id !== s.id) { if (color !== null && !/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Couleur invalide'); r.color = color; }
    if (hoist !== undefined && r.id !== s.id) r.hoist = !!hoist;
    if (perms !== undefined) {
      perms = Number(perms) & ALL;
      // On ne peut pas donner une permission qu'on n'a pas soi-même.
      if ((perms & ~r.perms) & ~mine) throw new Error('Tu ne peux pas donner une permission que tu n\'as pas');
      r.perms = perms;
    }
    save(); refresh(s.members);
  },
  deleteRole(ws, { serverId, roleId }) {
    const s = db.servers[serverId], r = manageableRole(ws.uid, s, roleId);
    if (r.id === s.id) throw new Error('Le rôle @everyone ne peut pas être supprimé');
    s.roles = s.roles.filter(x => x !== r);
    s.roles.filter(x => x.position > r.position).forEach(x => x.position--);
    for (const uid in s.memberRoles) s.memberRoles[uid] = s.memberRoles[uid].filter(x => x !== r.id);
    for (const cid of s.channels) { const c = db.channels[cid]; if (c.overwrites) c.overwrites = c.overwrites.filter(o => o.id !== r.id); }
    save(); refresh(s.members);
  },
  moveRole(ws, { serverId, roleId, dir }) {
    const s = db.servers[serverId], r = manageableRole(ws.uid, s, roleId);
    const target = r.position + (dir > 0 ? 1 : -1);
    const other = s.roles.find(x => x.position === target);
    if (!other || other.id === s.id) return;
    if (other.position >= rankOf(s, ws.uid)) throw new Error('Tu ne peux pas placer un rôle au-dessus du tien');
    other.position = r.position; r.position = target; save(); refresh(s.members);
  },
  setMemberRoles(ws, { serverId, userId, roles }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_ROLES, 'Il faut la permission « Gérer les rôles »');
    if (!s.members.includes(userId)) throw new Error('Ce membre n\'est pas sur le serveur');
    const myRank = rankOf(s, ws.uid);
    if (userId !== ws.uid && rankOf(s, userId) >= myRank) throw new Error('Ce membre est au même niveau ou au-dessus de toi');
    const want = new Set((Array.isArray(roles) ? roles : []).filter(rid => rid !== s.id && s.roles.some(x => x.id === rid)));
    const current = new Set(s.memberRoles[userId] || []);
    for (const rid of new Set([...want, ...current])) {
      if (want.has(rid) === current.has(rid)) continue;
      const pos = s.roles.find(x => x.id === rid)?.position ?? 0;
      if (pos >= myRank) throw new Error('Tu ne peux pas donner ou retirer un rôle au-dessus du tien');
    }
    s.memberRoles[userId] = [...want];
    save(); refresh(s.members); kickFromForbiddenVoice(s);
  },
  kick(ws, { serverId, userId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.KICK, 'Il faut la permission « Expulser »');
    checkTarget(s, ws.uid, userId);
    removeMember(s, userId);
    const first = s.channels.map(c => db.channels[c]).find(c => c.type === 'text');
    const m = systemMessage(first.id, `**${db.users[userId].name}** a été expulsé du serveur`);
    save(); refresh([...s.members, userId]); broadcast(audienceOf(first), { t: 'message', message: m });
    sendTo(userId, { t: 'info', text: `Tu as été expulsé de ${s.name}` });
  },
  ban(ws, { serverId, userId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.BAN, 'Il faut la permission « Bannir »');
    if (!db.users[userId]) throw new Error('Utilisateur introuvable');
    if (s.members.includes(userId)) { checkTarget(s, ws.uid, userId); removeMember(s, userId); }
    if (!s.bans.includes(userId)) s.bans.push(userId);
    save(); refresh([...s.members, userId]);
    sendTo(userId, { t: 'info', text: `Tu as été banni de ${s.name}` });
  },
  unban(ws, { serverId, userId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.BAN, 'Il faut la permission « Bannir »');
    s.bans = s.bans.filter(u => u !== userId); save(); refresh(s.members);
  },
  updateChannel(ws, { channelId, name, topic, overwrites }) {
    const ch = db.channels[channelId], s = ch && db.servers[ch.server_id];
    if (!s) throw new Error('Salon introuvable');
    need(ws.uid, ch, P.MANAGE_CHANNELS, 'Il faut la permission « Gérer les salons »');
    if (name !== undefined) { name = ch.type === 'voice' ? clean(name, 30) : clean(name, 30).toLowerCase().replace(/\s+/g, '-'); if (!name) throw new Error('Nom de salon vide'); ch.name = name; }
    if (topic !== undefined) ch.topic = clean(topic, 200);
    if (overwrites !== undefined) {
      if (!(serverPerms(s, ws.uid) & P.MANAGE_ROLES)) throw new Error('Il faut la permission « Gérer les rôles » pour changer qui voit ce salon');
      const mine = serverPerms(s, ws.uid);
      ch.overwrites = (Array.isArray(overwrites) ? overwrites : []).slice(0, 60).map(o => ({
        id: String(o.id), type: o.type === 'member' ? 'member' : 'role', allow: Number(o.allow) & ALL & mine, deny: Number(o.deny) & ALL & mine,
      })).filter(o => (o.type === 'role' ? s.roles.some(r => r.id === o.id) : s.members.includes(o.id)) && (o.allow || o.deny));
    }
    save(); refresh(s.members); kickFromForbiddenVoice(s);
  },
  deleteChannel(ws, { channelId }) {
    const ch = db.channels[channelId], s = ch && db.servers[ch.server_id];
    if (!s) throw new Error('Salon introuvable');
    need(ws.uid, ch, P.MANAGE_CHANNELS, 'Il faut la permission « Gérer les salons »');
    if (ch.type === 'text' && s.channels.filter(c => db.channels[c].type === 'text').length <= 1) throw new Error('Il faut garder au moins un salon textuel');
    for (const [, v] of voice.get(channelId) || []) { v.ws.send({ t: 'voiceKicked', reason: 'Le salon vocal a été supprimé' }); leaveVoice(v.ws); }
    const gone = [channelId, ...threadsOf(s).filter(t => t.parent_id === channelId).map(t => t.id)];
    s.channels = s.channels.filter(c => c !== channelId); gone.forEach(c => delete db.channels[c]);
    db.messages = db.messages.filter(m => !gone.includes(m.channel_id));
    save(); refresh(s.members);
  },


  // --- Fils de discussion
  createThread(ws, { channelId, messageId, name }) {
    const parent = db.channels[channelId];
    if (!parent || parent.type !== 'text') throw new Error('On ne peut créer un fil que dans un salon textuel');
    need(ws.uid, parent, P.SEND, 'Tu ne peux pas écrire dans ce salon');
    const s = db.servers[parent.server_id];
    let starter = null;
    if (messageId) {
      starter = db.messages.find(m => m.id === messageId && m.channel_id === channelId);
      if (!starter) throw new Error('Message introuvable');
      if (starter.thread) return { t: 'opened', server: s.id, channel: starter.thread.id };
    }
    name = clean(name, 60) || clean(starter?.content || '', 40) || 'Nouveau fil';
    const t = { id: id(), type: 'thread', server_id: s.id, parent_id: channelId, name, topic: '', owner: ws.uid,
      starter_id: starter?.id || null, archived: false, created: now(), last: now(), count: 0 };
    db.channels[t.id] = t;
    if (starter) {
      starter.thread = { id: t.id, name, count: 0, last: t.last };
      broadcast(audienceOf(parent), { t: 'messageUpdate', message: starter });
    } else {
      const m = { id: id(), channel_id: channelId, author_id: 'system', timestamp: now(), reactions: {}, mentions: [],
        content: `**${db.users[ws.uid].name}** a créé un fil : **${name}**`, thread: { id: t.id, name, count: 0, last: t.last } };
      t.starter_id = m.id; db.messages.push(m);
      broadcast(audienceOf(parent), { t: 'message', message: m });
    }
    save(); broadcastThread(t);
    return { t: 'opened', server: s.id, channel: t.id };
  },
  updateThread(ws, { threadId, name, archived }) {
    const t = db.channels[threadId]; if (!t || t.type !== 'thread' || !canAccess(ws.uid, t)) throw new Error('Fil introuvable');
    if (t.owner !== ws.uid && !can(ws.uid, t, P.MANAGE_MESSAGES)) throw new Error('Seul le créateur du fil ou un modérateur peut le modifier');
    if (name !== undefined) { name = clean(name, 60); if (!name) throw new Error('Nom vide'); t.name = name; }
    if (archived !== undefined) t.archived = !!archived;
    const starter = db.messages.find(m => m.id === t.starter_id);
    if (starter?.thread) { starter.thread.name = t.name; broadcast(audienceOf(t), { t: 'messageUpdate', message: starter }); }
    save(); broadcastThread(t);
  },
  deleteThread(ws, { threadId }) {
    const t = db.channels[threadId]; if (!t || t.type !== 'thread' || !canAccess(ws.uid, t)) throw new Error('Fil introuvable');
    if (t.owner !== ws.uid && !can(ws.uid, t, P.MANAGE_MESSAGES)) throw new Error('Seul le créateur du fil ou un modérateur peut le supprimer');
    const audience = audienceOf(t);
    db.messages = db.messages.filter(m => m.channel_id !== t.id);
    const starter = db.messages.find(m => m.id === t.starter_id);
    if (starter) { delete starter.thread; broadcast(audience, { t: 'messageUpdate', message: starter }); }
    delete db.channels[t.id]; save();
    broadcast(audience, { t: 'threadDelete', threadId: t.id, serverId: t.server_id });
  },

  // --- Emojis personnalisés
  addEmoji(ws, { serverId, name, fileId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_EMOJIS, 'Il faut la permission « Gérer les emojis »');
    s.emojis = s.emojis || [];
    name = clean(name, 32).toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!/^\w{2,32}$/.test(name)) throw new Error('Nom : 2 à 32 caractères (lettres, chiffres, _)');
    if (s.emojis.some(e => e.name === name)) throw new Error('Un emoji porte déjà ce nom');
    if (s.emojis.length >= 50) throw new Error('50 emojis maximum par serveur');
    const f = db.uploads[fileId];
    if (!f || f.owner !== ws.uid || !/^image\/(png|jpeg|gif|webp)$/.test(f.content_type)) throw new Error('L\'emoji doit être une image (png, jpg, gif, webp)');
    if (f.size > 512 * 1024) throw new Error('Image trop lourde pour un emoji (512 Ko max)');
    s.emojis.push({ id: crypto.randomBytes(6).toString('hex'), name, file: f.id, by: ws.uid, created: now() });
    save(); refresh(s.members);
  },
  deleteEmoji(ws, { serverId, emojiId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_EMOJIS, 'Il faut la permission « Gérer les emojis »');
    s.emojis = s.emojis.filter(e => e.id !== emojiId); save(); refresh(s.members);
  },


  // --- Soundboard : sons courts joués à tout le salon vocal
  addSound(ws, { serverId, name, emoji, fileId, volume }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_EMOJIS, 'Il faut la permission « Gérer les emojis et les sons »');
    s.sounds = s.sounds || [];
    name = clean(name, 24);
    if (name.length < 2) throw new Error('Nom : 2 à 24 caractères');
    if (s.sounds.length >= 24) throw new Error('24 sons maximum par serveur');
    const f = db.uploads[fileId];
    if (!f || f.owner !== ws.uid || !/^audio\//.test(f.content_type)) throw new Error('Le son doit être un fichier audio (mp3, ogg, wav…)');
    if (f.size > 1024 * 1024) throw new Error('Son trop lourd (1 Mo max)');
    emoji = clean(emoji, 16);
    s.sounds.push({ id: crypto.randomBytes(6).toString('hex'), name, emoji, file: f.id, by: ws.uid, created: now(),
      volume: Math.min(1, Math.max(0.05, Number(volume) || 1)) });
    save(); refresh(s.members);
  },
  deleteSound(ws, { serverId, soundId }) {
    const s = db.servers[serverId]; needServer(ws.uid, s, P.MANAGE_EMOJIS, 'Il faut la permission « Gérer les emojis et les sons »');
    s.sounds = (s.sounds || []).filter(x => x.id !== soundId); save(); refresh(s.members);
  },
  playSound(ws, { soundId }) {
    const room = ws.voice && voice.get(ws.voice); const me = room?.get(ws.uid);
    if (!me || me.ws !== ws) throw new Error('Rejoins un salon vocal pour jouer un son');
    const ch = db.channels[ws.voice];
    if (!can(ws.uid, ch, P.SPEAK)) throw new Error('Tu n\'as pas la permission de parler dans ce salon');
    if (me.deafened) throw new Error('Réactive ton son pour utiliser la soundboard');
    const last = lastSound.get(ws.uid) || 0;
    if (Date.now() - last < 1500) throw new Error('Doucement sur la soundboard 🙂');
    let sound;
    if (BUILTIN_SOUNDS.includes(soundId)) sound = { id: soundId, builtin: true, volume: 1 };
    else {
      // Sons du serveur du salon vocal (en appel privé : ceux de tous les serveurs de l'appelant)
      const pools = ch.type === 'dm' ? serversOf(ws.uid) : [db.servers[ch.server_id]];
      const found = pools.flatMap(x => x?.sounds || []).find(x => x.id === soundId);
      if (!found) throw new Error('Son introuvable');
      sound = publicSound(found);
    }
    lastSound.set(ws.uid, Date.now());
    for (const [, v] of room) v.ws.send({ t: 'sound', channelId: ws.voice, userId: ws.uid, sound });
  },

  // --- Blocage
  block(ws, { userId }) {
    if (!db.users[userId] || userId === ws.uid) throw new Error('Utilisateur introuvable');
    const list = (db.blocks[ws.uid] = db.blocks[ws.uid] || []);
    if (!list.includes(userId)) list.push(userId);
    db.friendships = db.friendships.filter(f => f !== friendship(ws.uid, userId)); // retire l'amitié et les demandes
    save(); refresh([ws.uid, userId]);
  },
  unblock(ws, { userId }) {
    db.blocks[ws.uid] = (db.blocks[ws.uid] || []).filter(u => u !== userId); save(); refresh([ws.uid]);
  },

  // --- Présence : inactivité (souris/clavier) et jeu en cours (app de bureau)
  activity(ws, { idle }) {
    const before = status(ws.uid);
    ws.idle = !!idle;
    if (status(ws.uid) !== before) presenceChanged(ws.uid);
  },
  setActivity(ws, { name }) {
    const n = clean(name, 64);
    const next = n ? { type: 'playing', name: n, since: ws.activity?.name === n ? ws.activity.since : now() } : null;
    if ((ws.activity?.name || null) === (next?.name || null)) return;
    ws.activity = next; presenceChanged(ws.uid);
  },

  // --- Profil
  setProfile(ws, { presence, customStatus, statusEmoji, statusExpires, about, avatar, color }) {
    const u = db.users[ws.uid];
    if (presence !== undefined) {
      if (!['online', 'idle', 'dnd', 'invisible'].includes(presence)) throw new Error('Statut inconnu');
      u.presence = presence;
    }
    if (statusEmoji !== undefined) {
      const e = clean(statusEmoji, 64);
      if (e && !/^(\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|<:\w{2,32}:\w{1,24}>)+$/u.test(e)) throw new Error('Emoji de statut invalide');
      u.statusEmoji = e;
    }
    if (customStatus !== undefined) u.customStatus = clean(customStatus, 80);
    if (statusExpires !== undefined) {
      const exp = statusExpires ? new Date(statusExpires) : null;
      if (exp && (isNaN(exp) || exp <= new Date())) throw new Error('Date d\'expiration invalide');
      u.statusExpires = exp ? exp.toISOString() : null;
    }
    if (!u.customStatus && !u.statusEmoji) u.statusExpires = null;
    if (about !== undefined) u.about = clean(about, 190);
    if (color !== undefined) { if (!/^#[0-9a-f]{6}$/i.test(color)) throw new Error('Couleur invalide'); u.color = color; }
    if (avatar !== undefined) {
      if (avatar === null) delete u.avatar;
      else {
        const f = db.uploads[avatar];
        if (!f || f.owner !== ws.uid || !/^image\/(png|jpeg|gif|webp)$/.test(f.content_type)) throw new Error('La photo de profil doit être une image (png, jpg, gif, webp)');
        u.avatar = f.id;
      }
    }
    save(); sendTo(ws.uid, { t: 'profile', profile: ownProfile(u) }); presenceChanged(ws.uid);
  },
  // Recherche côté serveur, comme Discord : on ne cherche que dans les salons accessibles.
  search(ws, { scope, query }) {
    let chans;
    if (scope === '@me') chans = dmsOf(ws.uid);
    else { const s = db.servers[scope]; if (!s || !s.members.includes(ws.uid)) throw new Error('Serveur inaccessible'); chans = [...s.channels.map(c => db.channels[c]), ...threadsOf(s)].filter(c => canAccess(ws.uid, c)); }
    const ids = new Set(chans.map(c => c.id));
    const users = {}; Object.values(db.users).forEach(u => (users[u.id] = { name: u.name }));
    const channels = {}; chans.forEach(c => (channels[c.id] = { name: c.name || 'mp' }));
    const res = Search.search({ users: { ...users, system: { name: 'système' } }, channels,
      messages: db.messages.filter(m => ids.has(m.channel_id)).map(m => (m.poll ? { ...m, content: `${m.content} ${m.poll.question} ${m.poll.answers.map(a => a.text).join(' ')}` } : m)) }, clean(query, 300), { limit: 50 });
    return { t: 'searchResults', ...res };
  },
};

const ownProfile = u => ({ presence: u.presence || 'online', customStatus: customOf(u).text, statusEmoji: customOf(u).emoji,
  statusExpires: statusExpired(u) ? null : u.statusExpires || null, about: u.about || '', avatar: fileUrl(u.avatar), color: u.color });

function login(ws, u, token) {
  if (!token) { token = crypto.randomBytes(24).toString('hex'); db.sessions[token] = u.id; save(); }
  ws.uid = u.id;
  const first = !online.has(u.id);
  if (first) online.set(u.id, new Set());
  online.get(u.id).add(ws);
  ws.token = token;
  ws.send({ t: 'auth', token, user: publicUser(u), profile: ownProfile(u) });
  ws.send(bootstrap(u.id));
  if (first) presenceChanged(u.id);
}

function onMessage(ws, raw) {
  let msg; try { msg = JSON.parse(raw); } catch { return; }
  const fn = handlers[msg.t];
  if (!fn) return ws.send({ t: 'error', ref: msg.ref, error: 'Action inconnue' });
  if (!ws.uid && !['register', 'login', 'resume'].includes(msg.t)) return ws.send({ t: 'error', ref: msg.ref, error: 'Connecte-toi d\'abord' });
  try {
    const out = fn(ws, msg);
    if (out) ws.send({ ...out, ref: msg.ref });
    else if (msg.ref) ws.send({ t: 'ok', ref: msg.ref });
  } catch (e) { ws.send({ t: 'error', ref: msg.ref, error: e.message }); }
}

function onClose(ws) {
  leaveVoice(ws);
  const set = ws.uid && online.get(ws.uid);
  if (!set) return;
  set.delete(ws);
  if (!set.size) { online.delete(ws.uid); presenceChanged(ws.uid); }
}

// ---------------------------------------------------------------- WebSocket (RFC 6455, implémentation minimale)
class Socket {
  constructor(sock) {
    this.sock = sock; this.buf = Buffer.alloc(0); this.frags = []; this.open = true;
    sock.setNoDelay(true);
    sock.on('data', d => this.onData(d));
    sock.on('close', () => this.closed());
    sock.on('error', () => this.closed());
    this.alive = true;
    this.ping = setInterval(() => { if (!this.alive) return this.sock.destroy(); this.alive = false; this.frame(0x9, Buffer.alloc(0)); }, 30000);
  }
  onData(d) {
    this.buf = Buffer.concat([this.buf, d]);
    while (this.buf.length >= 2) {
      const b0 = this.buf[0], b1 = this.buf[1], fin = b0 & 0x80, op = b0 & 0x0f, masked = b1 & 0x80;
      let len = b1 & 0x7f, off = 2;
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; len = Number(this.buf.readBigUInt64BE(2)); off = 10; }
      if (!masked || len > 1 << 20) return this.sock.destroy(); // le client doit masquer ; 1 Mo max
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4), data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.alive = true;
      if (op === 0x8) { this.frame(0x8, Buffer.alloc(0)); this.sock.end(); return this.closed(); }
      if (op === 0x9) { this.frame(0xA, data); continue; }
      if (op === 0xA) continue;
      if (op === 0x1 || op === 0x0) {
        this.frags.push(data);
        if (fin) { const text = Buffer.concat(this.frags).toString('utf8'); this.frags = []; onMessage(this, text); }
      }
    }
  }
  frame(op, payload) {
    if (!this.open) return;
    const len = payload.length;
    const head = len < 126 ? Buffer.from([0x80 | op, len])
      : len < 65536 ? Buffer.from([0x80 | op, 126, len >> 8, len & 255])
      : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(len), 2); return h; })();
    this.sock.write(Buffer.concat([head, payload]));
  }
  send(obj) { this.frame(0x1, Buffer.from(JSON.stringify(obj))); }
  close() { this.frame(0x8, Buffer.alloc(0)); this.sock.end(); this.closed(); }
  closed() { if (!this.open) return; this.open = false; clearInterval(this.ping); onClose(this); }
}

// ---------------------------------------------------------------- HTTP
const TYPES = { '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
function json(res, code, obj) { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); }

// POST /upload : corps = octets du fichier ; en-têtes Authorization: Bearer <jeton>, X-Filename, Content-Type.
function handleUpload(req, res) {
  const uid = db.sessions[(req.headers.authorization || '').replace(/^Bearer /, '')];
  if (!uid) return json(res, 401, { error: 'Connecte-toi d\'abord' });
  const declared = Number(req.headers['content-length'] || 0);
  if (declared > MAX_UPLOAD) { req.resume(); return json(res, 413, { error: 'Fichier trop lourd (10 Mo max)' }); }
  const chunks = []; let size = 0, aborted = false;
  req.on('data', c => {
    size += c.length;
    if (size > MAX_UPLOAD) { aborted = true; req.destroy(); return json(res, 413, { error: 'Fichier trop lourd (10 Mo max)' }); }
    chunks.push(c);
  });
  req.on('end', () => {
    if (aborted) return;
    if (!size) return json(res, 400, { error: 'Fichier vide' });
    let filename = 'fichier';
    try { filename = decodeURIComponent(req.headers['x-filename'] || 'fichier'); } catch {}
    filename = filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').slice(0, 120) || 'fichier';
    const type = String(req.headers['content-type'] || 'application/octet-stream').split(';')[0].toLowerCase();
    const f = { id: crypto.randomBytes(12).toString('hex'), owner: uid, filename, size, content_type: type, created: now() };
    fs.writeFile(path.join(UPLOADS, f.id), Buffer.concat(chunks), err => {
      if (err) return json(res, 500, { error: 'Impossible d\'enregistrer le fichier' });
      db.uploads[f.id] = f; save();
      json(res, 200, { id: f.id, url: `/uploads/${f.id}`, filename, size, content_type: type });
    });
  });
}

// GET /uploads/<id> : images/vidéos/sons connus affichés, tout le reste téléchargé.
function serveUpload(res, fid) {
  const f = /^[0-9a-f]{24}$/.test(fid) && db.uploads[fid];
  if (!f) { res.writeHead(404); return res.end('Introuvable'); }
  const inline = !!INLINE_TYPES[f.content_type];
  res.writeHead(200, {
    'Content-Type': inline ? f.content_type : 'application/octet-stream',
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(f.filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'",
    'Cache-Control': 'private, max-age=31536000, immutable',
  });
  fs.createReadStream(path.join(UPLOADS, f.id)).on('error', () => res.end()).pipe(res);
}

const isLocal = host => /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host || '');
function app(req, res) {
  const pathname = new URL(req.url, 'http://x').pathname;
  if (req.method === 'POST' && pathname === '/upload') return handleUpload(req, res);
  if (pathname.startsWith('/uploads/')) return serveUpload(res, pathname.slice(9));
  let url; try { url = decodeURIComponent(pathname); } catch { res.writeHead(400); return res.end(); }
  const file = path.normalize(path.join(PUBLIC, url === '/' ? 'index.html' : url));
  if (!file.startsWith(PUBLIC + path.sep)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}
function upgrade(req, sock) {
  const key = req.headers['sec-websocket-key'];
  if (new URL(req.url, 'http://x').pathname !== '/ws' || !key) return sock.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  new Socket(sock);
}

// HTTP : sur ce PC (localhost) tout marche, y compris le micro. Depuis un autre appareil,
// on redirige vers HTTPS, seul moyen pour le navigateur d'autoriser le micro.
const server = http.createServer((req, res) => {
  if (!isLocal(req.headers.host)) {
    const host = String(req.headers.host || '').replace(/:\d+$/, '');
    res.writeHead(302, { Location: `https://${host}:${HTTPS_PORT}${req.url}` }); return res.end();
  }
  app(req, res);
});
server.on('upgrade', upgrade);

// Certificat auto-signé : régénéré si les adresses IP du PC changent (autre wifi).
const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
const CERT_FILE = path.join(DATA_DIR, 'cert.json');
let tlsCert;
try { tlsCert = JSON.parse(fs.readFileSync(CERT_FILE, 'utf8')); } catch {}
const wanted = ['127.0.0.1', ...ips].sort().join(',');
if (!tlsCert || tlsCert.ips !== wanted || new Date(tlsCert.expires) < new Date(Date.now() + 7 * 864e5)) {
  const c = generateCertificate({ dnsNames: ['localhost', os.hostname()], ips: wanted.split(',') });
  tlsCert = { ...c, ips: wanted, expires: new Date(Date.now() + 397 * 864e5).toISOString() };
  fs.writeFileSync(CERT_FILE, JSON.stringify(tlsCert));
}
const secure = https.createServer({ key: tlsCert.key, cert: tlsCert.cert }, app);
secure.on('upgrade', upgrade);

server.listen(PORT, '0.0.0.0', () => secure.listen(HTTPS_PORT, '0.0.0.0', () => {
  console.log('\n  Parlotte est lancé !\n');
  console.log(`  Sur ce PC :            http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`  Sur le même wifi :     https://${ip}:${HTTPS_PORT}`));
  console.log('\n  Sur les autres appareils, le navigateur affichera un avertissement de sécurité');
  console.log('  la première fois (certificat fait maison) : choisis « Continuer vers le site ».');
  console.log('\n  Laisse cette fenêtre ouverte. Ctrl+C pour arrêter.\n');
  // Lancé par l'application de bureau : on lui dit qu'on est prêt et sur quelles adresses.
  if (process.send) process.send({ type: 'ready', port: PORT, httpsPort: HTTPS_PORT, ips, fingerprint: new crypto.X509Certificate(tlsCert.cert).fingerprint256 });
}));
function shutdown() { clearTimeout(saveTimer); try { fs.writeFileSync(DATA_FILE, JSON.stringify(db)); } catch {} process.exit(0); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
process.on('message', m => { if (m === 'shutdown') shutdown(); });
for (const srv of [server, secure]) srv.on('error', err => {
  const msg = err.code === 'EADDRINUSE' ? `Le port ${err.port} est déjà utilisé (Parlotte tourne peut-être déjà ?)` : err.message;
  console.error('\n  ❌ ' + msg + '\n');
  if (process.send) process.send({ type: 'error', message: msg });
  process.exit(1);
});
