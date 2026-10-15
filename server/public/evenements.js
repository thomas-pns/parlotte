'use strict';
// Parlotte — événements de serveur (« Soirée Krunker samedi 21 h »), cartes de serveurs plus riches,
// menu « + » de la zone d'écriture et morpion dans les conversations.

const EI = {
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>', 20),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 20),
  clip: svg('<path d="M20 11l-8.5 8.5a5 5 0 01-7-7L13 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L14 7"/>', 20),
  game: svg('<path d="M9 4v16M15 4v16M4 9h16M4 15h16"/>', 20),
  poll: svg('<path d="M5 20V11M12 20V5M19 20v-6"/>', 20),
  voice: svg('<path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M17 8.5a5 5 0 010 7"/>', 16),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 16),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20),
};

// ---------------------------------------------------------------- Dates lisibles
function evWhen(iso) {
  const d = new Date(iso), n = new Date(), diff = d - n;
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diff < 0 && diff > -6 * 3600e3) return 'en ce moment';
  const day0 = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(), days = Math.round((day0(d) - day0(n)) / 86400e3);
  if (days === 0) return `aujourd'hui à ${hm}`;
  if (days === 1) return `demain à ${hm}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} à ${hm}`;
  return `${d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} à ${hm}`;
}
const upcoming = s => (s?.events || []).filter(e => Date.parse(e.start) > Date.now() - 6 * 3600e3);

// ---------------------------------------------------------------- Cartes des serveurs (plus épaisses, avec bannière)
renderServerCards = function () {
  const box = $('#servers');
  const cards = st.servers.map(s => {
    const live = serverLive(s), unread = unreadIn(s.channels), color = serverColor(s);
    const online = s.members.filter(m => user(m).status !== 'offline').length, next = upcoming(s)[0];
    return `<button class="srv-card big ${s.id === st.view.server ? 'on' : ''}" data-srv="${s.id}" aria-label="${esc(s.name)}">
      <span class="sc-banner ${s.banner ? 'img' : ''}" style="--srv:${esc(color)}${s.banner ? `;background-image:url('${esc(s.banner)}')` : ''}">
        ${live ? `<span class="sc-live"><i class="live-dot"></i>${live} en vocal</span>` : ''}</span>
      <span class="sc-body">${srvTileHTML(s)}
        <span class="srv-txt"><b>${esc(s.name)}</b>${s.description ? `<small class="sc-desc">${esc(s.description)}</small>` : ''}
          <small class="sc-stats"><i class="sc-on"></i>${online} en ligne<i class="sc-dot"></i>${s.members.length} membre${s.members.length > 1 ? 's' : ''}</small>
          ${next ? `<small class="sc-ev">${EI.cal}<span>${esc(next.title)} · ${esc(evWhen(next.start))}</span></small>` : ''}</span></span>
      ${unread && s.id !== st.view.server ? `<span class="srv-badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>`;
  }).join('');
  box.innerHTML = `<header class="col-head"><h1>Serveurs</h1><span class="col-acts">
      <button id="join-server" class="pill-btn" title="Rejoindre avec un code">${ICON.key}<span>Code</span></button>
      <button id="add-server" class="round-btn accent" title="Créer un serveur" aria-label="Créer un serveur">${ICON.plus}</button></span></header>
    <div class="srv-cards">${cards || '<p class="small pad">Aucun serveur pour l\'instant. Crée le tien ou rejoins celui d\'un ami avec son code.</p>'}</div>`;
};

// ---------------------------------------------------------------- Bouton « Événements » dans l'en-tête
$('#pins').insertAdjacentHTML('beforebegin', `<button id="events-btn" title="Événements du serveur" aria-label="Événements du serveur" hidden>${EI.cal}<span class="ev-count" hidden></span></button>`);
const _renderMainEv = renderMain;
renderMain = function (...a) {
  _renderMainEv.apply(this, a);
  const s = !isSpecial(st.view.server) && server(), b = $('#events-btn');
  b.hidden = !s || isFriendsView();
  const n = s ? upcoming(s).length : 0, c = b.querySelector('.ev-count'); c.hidden = !n; c.textContent = n;
  if ($('#ev-dlg').open) renderEvents();
};
$('#events-btn').onclick = () => openEvents();

// ---------------------------------------------------------------- Fenêtre des événements
document.body.insertAdjacentHTML('beforeend', '<dialog id="ev-dlg" class="big"><div id="ev-body"></div></dialog>');
let evView = 'list';
function openEvents(view = 'list') { evView = view; renderEvents(); if (!$('#ev-dlg').open) $('#ev-dlg').showModal(); }
function renderEvents() {
  const s = server(); if (!s) return $('#ev-dlg').close();
  const body = $('#ev-body');
  if (evView === 'new') {
    const d = new Date(Date.now() + 86400e3); d.setHours(21, 0, 0, 0);
    const pad = n => String(n).padStart(2, '0'), voices = s.channels.filter(c => c.type === 'voice');
    body.innerHTML = `<form class="ev-form" id="ev-form">
      <header class="ev-head"><button type="button" class="ev-x" data-ev-back aria-label="Retour">‹</button><div><h2>Nouvel événement</h2><small>${esc(s.name)}</small></div><span class="grow"></span></header>
      <label class="fld">Nom de l'événement<input id="ev-title" maxlength="60" required placeholder="Soirée Krunker, Anniv de Léa, Ciné…"></label>
      <div class="ev-row"><label class="fld">Date<input type="date" id="ev-date" required value="${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}"></label>
        <label class="fld">Heure<input type="time" id="ev-time" required value="21:00"></label></div>
      ${voices.length ? `<label class="fld">Où ? <select id="ev-chan"><option value="">Pas de salon précis</option>${voices.map(c => `<option value="${c.id}">🔊 ${esc(c.name)}</option>`).join('')}</select></label>` : ''}
      <label class="fld">Description <textarea id="ev-desc" maxlength="400" rows="3" placeholder="Ce qu'on fait, ce qu'il faut ramener…"></textarea></label>
      <div class="fld">Image (facultatif) ${filePickHTML('ev-cover', 'image/png,image/jpeg,image/gif,image/webp', 'Choisir une image', 'affichée en haut de l\'événement')}</div>
      <menu><button type="button" data-ev-back>Annuler</button><button class="primary" id="ev-create">Créer l'événement</button></menu></form>`;
    return;
  }
  const list = upcoming(s), admin = sp(s, P.MANAGE_SERVER);
  body.innerHTML = `<header class="ev-head"><span class="ev-ico">${EI.cal}</span><div><h2>Événements</h2><small>${esc(s.name)}</small></div><span class="grow"></span>
      <button class="primary" data-ev-new>${EI.plus}<span>Créer</span></button><button class="ev-x" data-ev-close aria-label="Fermer">${EI.close}</button></header>
    <div class="ev-list">${list.length ? list.map(e => evCardHTML(s, e, admin)).join('')
      : `<div class="empty-state"><div class="es-ico">${EI.cal}</div><h2>Rien de prévu</h2><p>Une soirée jeux, un resto, un anniv ? Crée un événement : tout le serveur est prévenu, et un rappel part 15 min avant.</p><button class="primary" data-ev-new>Créer un événement</button></div>`}</div>`;
}
function evCardHTML(s, e, admin) {
  const d = new Date(e.start), mine = e.going.includes(st.me) ? 'going' : e.maybe.includes(st.me) ? 'maybe' : null;
  const now = Date.parse(e.start) <= Date.now(), ch = e.channelId && s.channels.find(c => c.id === e.channelId);
  const who = [...e.going, ...e.maybe].slice(0, 6).map(u => avatar(user(u))).join('');
  return `<article class="ev-card ${now ? 'now' : ''}" data-ev="${esc(e.id)}">
    <div class="ev-cover ${e.cover ? 'img' : ''}" style="--srv:${esc(serverColor(s))}${e.cover ? `;background-image:url('${esc(e.cover)}')` : ''}">
      <span class="ev-date"><small>${esc(d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', ''))}</small><b>${d.getDate()}</b></span>
      ${now ? '<span class="ev-now"><i class="live-dot"></i>En ce moment</span>' : ''}</div>
    <div class="ev-info">
      <h3>${esc(e.title)}</h3>
      <p class="ev-when">${esc(evWhen(e.start).replace(/^./, c => c.toUpperCase()))}${ch ? ` · <button class="link" data-ev-chan="${esc(ch.id)}">${EI.voice} ${esc(ch.name)}</button>` : ''}</p>
      ${e.description ? `<p class="ev-desc">${esc(e.description)}</p>` : ''}
      <div class="ev-foot"><span class="ev-who">${who}<small>${e.going.length} vien${e.going.length > 1 ? 'nent' : 't'}${e.maybe.length ? ` · ${e.maybe.length} peut-être` : ''}</small></span>
        <span class="ev-rsvp"><button class="${mine === 'going' ? 'on' : ''}" data-rsvp="going">✅ Je viens</button><button class="${mine === 'maybe' ? 'on' : ''}" data-rsvp="maybe">🤔 Peut-être</button>
        ${e.author === st.me || admin ? `<button class="ev-del" data-ev-del title="Annuler l'événement" aria-label="Annuler l'événement">${EI.trash}</button>` : ''}</span></div>
      <small class="ev-by">Organisé par ${esc(user(e.author).name)}</small>
    </div></article>`;
}
$('#ev-dlg').addEventListener('click', async e => {
  const s = server(); if (!s) return;
  if (e.target === $('#ev-dlg') || e.target.closest('[data-ev-close]')) return $('#ev-dlg').close();
  if (e.target.closest('[data-ev-new]')) { evView = 'new'; renderEvents(); setTimeout(() => $('#ev-title')?.focus(), 50); return; }
  if (e.target.closest('[data-ev-back]')) { evView = 'list'; return renderEvents(); }
  const card = e.target.closest('[data-ev]'); if (!card) return;
  const evId = card.dataset.ev, ev = upcoming(s).find(x => x.id === evId);
  const r = e.target.closest('[data-rsvp]');
  if (r) { const mine = ev?.going.includes(st.me) ? 'going' : ev?.maybe.includes(st.me) ? 'maybe' : null; return act('rsvpEvent', { eventId: evId, answer: mine === r.dataset.rsvp ? null : r.dataset.rsvp }); }
  if (e.target.closest('[data-ev-del]') && confirm(`Annuler « ${ev?.title} » ?`)) return act('deleteEvent', { eventId: evId }).then(() => toast('Événement annulé'));
  const ch = e.target.closest('[data-ev-chan]'); if (ch) { $('#ev-dlg').close(); openChannel(s.id, ch.dataset.evChan); }
});
$('#ev-dlg').addEventListener('submit', async e => {
  e.preventDefault(); const s = server(); if (!s) return;
  const b = $('#ev-create'); b.disabled = true;
  try {
    const start = new Date(`${$('#ev-date').value}T${$('#ev-time').value}`);
    if (isNaN(start)) throw new Error('Date invalide');
    let cover = null; const f = $('#ev-cover').files[0];
    if (f) { if (!/^image\//.test(f.type)) throw new Error('Choisis une image'); cover = (await upload(f)).id; }
    await request('createEvent', { serverId: s.id, title: $('#ev-title').value, description: $('#ev-desc').value, start: start.toISOString(), channelId: $('#ev-chan')?.value || null, cover });
    evView = 'list'; renderEvents(); toast('Événement créé 📅 Tout le serveur est prévenu');
  } catch (err) { toast(err.message, true); b.disabled = false; }
});

// ---------------------------------------------------------------- Menu « + » de la zone d'écriture
document.body.insertAdjacentHTML('beforeend', '<div id="plus-menu" class="pop-menu" hidden role="menu"></div>');
$('#attach').onclick = e => {
  e.stopPropagation();
  const m = $('#plus-menu'); if (!m.hidden) { m.hidden = true; return; }
  const c = channel(), s = c && c.type !== 'dm' && server();
  m.innerHTML = `<button data-plus="file">${EI.clip}<span><b>Photo ou fichier</b><small>Jusqu'à 25 Mo</small></span></button>
    ${$('#poll-btn').hidden ? '' : `<button data-plus="poll">${EI.poll}<span><b>Sondage</b><small>Tout le monde vote</small></span></button>`}
    <button data-plus="ttt">${EI.game}<span><b>Morpion</b><small>Défie quelqu'un</small></span></button>
    ${s ? `<button data-plus="event">${EI.cal}<span><b>Événement</b><small>Prévois une soirée</small></span></button>` : ''}`;
  const r = $('#attach').getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(r.left, innerWidth - 248)) + 'px'; m.style.bottom = (innerHeight - r.top + 8) + 'px';
  m.hidden = false; m.classList.remove('pop-in'); void m.offsetWidth; m.classList.add('pop-in');
};
$('#plus-menu').addEventListener('click', e => {
  const b = e.target.closest('[data-plus]'); if (!b) return; $('#plus-menu').hidden = true;
  const k = b.dataset.plus;
  if (k === 'file') $('#file').click();
  if (k === 'poll') $('#poll-btn').click();
  if (k === 'ttt') act('startGame', { channelId: st.view.channel });
  if (k === 'event') openEvents('new');
});
document.addEventListener('click', e => { if (!e.target.closest('#plus-menu,#attach')) $('#plus-menu').hidden = true; });

// ---------------------------------------------------------------- Morpion
function gameHTML(m) {
  const g = m.game; if (g?.type !== 'ttt') return '';
  const X = user(g.x), O = g.o ? user(g.o) : null, mine = st.me === g.x ? 'x' : st.me === g.o ? 'o' : null;
  const myTurn = !g.winner && (g.o ? g.turn === mine : st.me !== g.x);
  const status = g.winner === 'draw' ? 'Match nul 🤝'
    : g.winner ? `🏆 ${esc(user(g.winner === 'x' ? g.x : g.o).name)} gagne !`
    : !O ? (st.me === g.x ? 'En attente d\'un adversaire…' : `${esc(X.name)} attend un adversaire : joue pour le défier !`)
    : myTurn ? 'À toi de jouer !' : `Au tour de ${esc(user(g.turn === 'x' ? g.x : g.o).name)}`;
  return `<div class="ttt ${g.winner ? 'over' : ''} ${myTurn ? 'myturn' : ''}" data-game="${esc(m.id)}">
    <div class="ttt-head"><span class="ttt-p x ${!g.winner && g.turn === 'x' && O ? 'turn' : ''}">${avatar(X)}<b>${esc(X.name)}</b><i>✕</i></span><span class="ttt-vs">VS</span>
      <span class="ttt-p o ${!g.winner && g.turn === 'o' ? 'turn' : ''}"><i>◯</i><b>${O ? esc(O.name) : '???'}</b>${O ? avatar(O) : '<span class="av ttt-q">?</span>'}</span></div>
    <div class="ttt-grid">${[...g.board].map((c, i) => `<button class="ttt-c ${c !== ' ' ? 'f ' + c : ''} ${g.line.includes(i) ? 'win' : ''}" data-ttt="${i}" ${c !== ' ' || g.winner ? 'disabled' : ''} aria-label="Case ${i + 1}">${c === 'x' ? '✕' : c === 'o' ? '◯' : ''}</button>`).join('')}</div>
    <div class="ttt-st">${status}${g.winner ? ' <button class="link" data-ttt-again>Rejouer</button>' : ''}</div></div>`;
}
$('#view').addEventListener('click', e => {
  const c = e.target.closest('[data-ttt]');
  if (c) { const g = c.closest('[data-game]'); return act('playGame', { messageId: g.dataset.game, cell: Number(c.dataset.ttt) }); }
  if (e.target.closest('[data-ttt-again]')) act('startGame', { channelId: st.view.channel });
});
