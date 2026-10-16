'use strict';
// Parlotte 1.7 — côté serveur façon maquette (moins « Discord ») :
//  • salon vocal en carte verte (qui est dedans, qui parle, « Rejoindre ») ;
//  • petite carte calendrier du prochain événement en haut des salons ;
//  • rôle en pastille colorée à côté du nom, message système discret ;
//  • sur téléphone : bandeau vocal vert au-dessus de la zone d'écriture, et liste des serveurs en « fil »
//    (rangée d'icônes + cartes qui montrent ce qui se passe) ;
//  • une seule lettre sur les icônes de serveur sans image.

const LI = {
  spk: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7"/>', 16),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 20),
};
const firstLetter = name => esc(([...String(name || '?').trim()][0] || '?').toUpperCase());

// ---------------------------------------------------------------- Une seule lettre
srvTileHTML = function (s, cls = '') {
  const col = serverColor(s);
  return s.icon ? `<span class="srv-tile img ${cls}" style="background-image:url('${esc(s.icon)}')" aria-hidden="true"></span>`
    : `<span class="srv-tile ${cls}" style="background:${col};color:${lightColor(col) ? '#14121A' : '#fff'}">${firstLetter(s.name)}</span>`;
};

// ---------------------------------------------------------------- Salon vocal en carte
voiceChannelHTML = function (c) {
  const members = st.voice[c.id] || [], on = vc.channel === c.id, n = members.length;
  const rows = members.map(m => { const u = user(m.id);
    return `<div class="vmem ${speaking.has(m.id) ? 'speaking' : ''}" data-speaker="${esc(m.id)}">${avatar(u)}<span>${esc(u.name)}</span><i>${m.screen ? '<span title="Partage son écran" class="live">EN DIRECT</span>' : ''}${m.camera ? '📷' : ''}${m.deafened ? '🔇' : m.muted ? '🤐' : ''}</i></div>`; }).join('');
  return `<div class="vcard ${n ? 'live' : ''} ${on ? 'on' : ''}">
    <button class="vc-head" data-voice-id="${c.id}" title="${on ? 'Tu es dans ce vocal' : 'Rejoindre le vocal'}"><span class="vc-dot"></span>${LI.spk}<b>${esc(c.name)}</b>${n ? `<span class="vc-n">${n}</span>` : ''}</button>
    ${rows ? `<div class="vc-list">${rows}</div>` : ''}
    ${on ? '<button class="vc-join leave" data-vc-leave>Quitter</button>' : n ? `<button class="vc-join" data-voice-id="${c.id}">Rejoindre</button>` : ''}
  </div>`;
};
document.addEventListener('click', e => { if (e.target.closest('[data-vc-leave]')) { e.preventDefault(); $('#vp-leave')?.click(); } });

// ---------------------------------------------------------------- Prochain événement en haut des salons
const MONTH_DAY = d => ({ wd: d.toLocaleDateString('fr-FR', { weekday: 'short' }), day: d.getDate() });
const _renderSide17 = renderSide;
renderSide = function () {
  _renderSide17();
  const s = !isSpecial(st.view.server) && server();
  if (s && typeof upcoming === 'function') {
    const ev = upcoming(s)[0], list = $('#side-list');
    if (ev && list && !list.querySelector('.ev-mini')) {
      const d = new Date(ev.start), md = MONTH_DAY(d), going = (ev.going || ev.yes || []).length || '';
      list.insertAdjacentHTML('afterbegin', `<button class="ev-mini" data-ev-open><span class="evm-cal"><small>${esc(md.wd)}</small><b>${md.day}</b></span>
        <span class="evm-txt"><b>${esc(ev.title)}</b><small>${esc(d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h '))}${going ? ` · ${going} viennent` : ''}</small></span></button>`);
    }
  }
  updateVoiceBanner();
};
document.addEventListener('click', e => { if (e.target.closest('[data-ev-open]') && typeof openEvents === 'function') openEvents(); });

// ---------------------------------------------------------------- Rôle en pastille à côté du nom
const _renderMain17 = renderMain;
renderMain = function (...a) {
  _renderMain17.apply(this, a);
  const s = !isSpecial(st.view.server) && server();
  if (s) document.querySelectorAll('#view .msg.first .who[data-user]').forEach(w => {
    if (w.nextElementSibling?.classList.contains('rpill')) return;
    const r = rolesOf(s, w.dataset.user)[0]; if (!r) return;
    w.insertAdjacentHTML('afterend', `<span class="rpill" style="--rc:${esc(r.color || '#A8A3B5')}">${esc(r.name)}</span>`);
  });
  updateVoiceBanner();
};

// ---------------------------------------------------------------- Téléphone : bandeau vocal au-dessus de la zone d'écriture
$('#composer').insertAdjacentHTML('beforebegin', '<div id="vbanner" hidden></div>');
function updateVoiceBanner() {
  const b = $('#vbanner'); if (!b) return;
  const s = !isSpecial(st.view.server) && server();
  const ch = s && s.channels.find(c => c.type === 'voice' && (st.voice[c.id] || []).length && vc.channel !== c.id);
  if (!ch || !mobile()) { b.hidden = true; return; }
  const ms = st.voice[ch.id], names = ms.map(m => user(m.id).name);
  const games = [...new Set(ms.map(m => user(m.id).activity?.name).filter(Boolean))];
  const sub = games.length ? `ils jouent à ${esc(games[0])}` : names.length > 2 ? `${esc(names.slice(0, 2).join(', '))} et ${names.length - 2} autre${names.length > 3 ? 's' : ''}` : esc(names.join(' et '));
  b.hidden = false;
  b.innerHTML = `<span class="vb-faces">${ms.slice(0, 3).map(m => avatar(user(m.id))).join('')}</span>
    <span class="vb-txt"><b>${esc(ch.name)}</b> · ${sub}</span><button class="vb-join" data-voice-id="${ch.id}">Rejoindre</button>`;
}
$('#vbanner').addEventListener('click', e => { const v = e.target.closest('[data-voice-id]'); if (v) joinVoice(v.dataset.voiceId); });
window.addEventListener('resize', updateVoiceBanner);

// ---------------------------------------------------------------- Téléphone : la liste des serveurs devient un « fil »
const _onNewMessage17 = onNewMessage;
onNewMessage = function (msg) {
  _onNewMessage17(msg);
  st.previews[msg.channel_id] = previewOf(msg);
  if (mobile() && st.view.server === '@servers') renderServerCards();
};
const _renderServerCards17 = renderServerCards;
renderServerCards = function () {
  if (!mobile() || inServer()) return _renderServerCards17();
  document.body.classList.remove('srv-slim');
  const box = $('#servers');
  const icons = st.servers.map(s => { const u = unreadIn(s.channels);
    return `<button class="fi-srv" data-srv="${s.id}" aria-label="${esc(s.name)}">${srvTileHTML(s)}${u ? `<span class="fi-badge">${u > 99 ? '99+' : u}</span>` : ''}<small>${esc(s.name)}</small></button>`; }).join('');
  const cards = st.servers.map(s => {
    const u = unreadIn(s.channels), online = s.members.filter(m => user(m).status !== 'offline').length;
    const vch = s.channels.find(c => c.type === 'voice' && (st.voice[c.id] || []).length);
    const ev = typeof upcoming === 'function' ? upcoming(s)[0] : null;
    const last = s.channels.filter(c => c.type !== 'voice' && st.previews[c.id]).sort((a, b) => (st.previews[b.id].at || '').localeCompare(st.previews[a.id].at || '')).slice(0, 2);
    return `<article class="feed-card" data-srv="${s.id}">
      <span class="fc-banner ${s.banner ? 'img' : ''}" style="--srv:${esc(serverColor(s))}${s.banner ? `;background-image:url('${esc(s.banner)}')` : ''}"></span>
      <div class="fc-body">
        <div class="fc-id">${srvTileHTML(s)}<span class="fc-name"><b>${esc(s.name)}</b><small>${s.members.length} membre${s.members.length > 1 ? 's' : ''} · ${online} en ligne</small></span>${u ? `<span class="fc-new">${u > 99 ? '99+' : u} nouveau${u > 1 ? 'x' : ''}</span>` : ''}</div>
        ${vch ? `<div class="fc-voice"><i class="vc-dot"></i><span><b>${esc(vch.name)} · en direct</b><small>${esc(st.voice[vch.id].map(m => user(m.id).name).join(', '))}</small></span><button class="vb-join" data-feed-voice="${vch.id}" data-feed-srv="${s.id}">Rejoindre</button></div>` : ''}
        ${ev ? (() => { const d = new Date(ev.start), md = MONTH_DAY(d); return `<div class="fc-ev"><span class="evm-cal"><small>${esc(md.wd)}</small><b>${md.day}</b></span><span><b>${esc(ev.title)}</b><small>${esc(d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h '))}</small></span></div>`; })() : ''}
        ${last.length ? `<div class="fc-last">${last.map(c => { const p = st.previews[c.id]; return `<div><span class="fc-ch"># ${esc(c.name)}</span> <b>${esc(user(p.a).name)}</b> : ${esc(p.x || '')}</div>`; }).join('')}</div>` : ''}
      </div></article>`;
  }).join('');
  box.innerHTML = `<header class="col-head"><h1>Serveurs</h1><span class="col-acts"><button id="srv-add-menu" class="round-btn accent" title="Créer ou rejoindre un serveur" aria-label="Créer ou rejoindre un serveur">${LI.plus}</button></span></header>
    ${st.servers.length ? `<div class="feed-icons">${icons}</div>` : ''}
    <div class="feed">${cards || '<p class="small pad">Aucun serveur pour l\'instant.</p>'}
      <button class="srv-add-card" data-srv-add>${LI.plus}<span><b>Ajouter un serveur</b><small>Crée le tien ou rejoins tes potes avec un code</small></span></button></div>`;
};
document.addEventListener('click', e => {
  const v = e.target.closest('[data-feed-voice]'); if (!v) return;
  e.preventDefault(); e.stopPropagation();
  const s = st.servers.find(x => x.id === v.dataset.feedSrv); if (!s) return;
  openChannel(s.id, firstText(s)); joinVoice(v.dataset.feedVoice);
}, true);

// ---------------------------------------------------------------- Proposer une partie (bouton manette)
const GI = {
  pad: svg('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 11v3M5.5 12.5h3M16 12h.01M18 14h.01"/>', 20),
  ttt: svg('<path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>', 20),
};
$('#rec-btn').insertAdjacentHTML('beforebegin', `<button type="button" id="plan-btn" title="Proposer une partie" aria-label="Proposer une partie">${GI.pad}</button>`);
const atIn = (h, m = 0, plusDays = 0) => { const d = new Date(); d.setDate(d.getDate() + plusDays); d.setHours(h, m, 0, 0); return d; };
function planSlots() {
  const now = new Date(), out = [['now', 'Maintenant', null], ['30', 'Dans 30 min', new Date(Date.now() + 30 * 60e3)]];
  const tonight = atIn(21); if (tonight > now) out.push(['21', 'Ce soir 21 h', tonight]);
  out.push(['d21', 'Demain 21 h', atIn(21, 0, 1)]);
  return out;
}
let planLast = (() => { try { return localStorage.getItem('parlotte-plan-game') || ''; } catch { return ''; } })();
function openPlan() {
  if (!st.view.channel) return;
  const guess = user(st.me).activity?.name || planLast || 'Krunker';
  const slots = planSlots();
  openSheet(`<h3 class="sh-title">Proposer une partie</h3>
    <form id="plan-form" class="plan-form">
      <label class="plan-lbl">À quoi on joue ?<input id="plan-game" maxlength="60" value="${esc(guess)}" autocomplete="off"></label>
      <div class="plan-lbl">Quand ?</div>
      <div class="plan-slots">${slots.map(([k, l], i) => `<button type="button" class="plan-slot ${i === 0 ? 'on' : ''}" data-slot="${k}">${l}</button>`).join('')}</div>
      <button class="primary plan-go">${GI.pad}<span>Proposer</span></button>
    </form>
    <div class="plan-or"><span>ou</span></div>
    <button class="sh-item big" data-plan-ttt><span class="sh-ico coral">${GI.ttt}</span><span><b>Jouer au morpion ici</b><small>Une partie rapide dans la conversation</small></span></button>`);
  const f = $('#plan-form'); let slot = 'now';
  f.onclick = e => { const b = e.target.closest('[data-slot]'); if (!b) return; slot = b.dataset.slot; f.querySelectorAll('.plan-slot').forEach(x => x.classList.toggle('on', x === b)); };
  f.onsubmit = async e => {
    e.preventDefault(); const title = $('#plan-game').value.trim(); if (!title) return $('#plan-game').focus();
    planLast = title; try { localStorage.setItem('parlotte-plan-game', title); } catch {}
    const at = planSlots().find(x => x[0] === slot)?.[2];
    closeSheet(); act('proposePlan', { channelId: st.view.channel, title, at: at ? at.toISOString() : null });
  };
}
$('#plan-btn').onclick = openPlan;
document.addEventListener('click', e => { if (e.target.closest('[data-plan-ttt]')) { closeSheet(); act('startGame', { channelId: st.view.channel }); } });
// dans le menu « + » aussi
const _attach17 = $('#attach').onclick;
$('#attach').onclick = e => {
  _attach17(e);
  const m = $('#plus-menu'); if (m.hidden || m.querySelector('[data-plus="plan"]')) return;
  m.querySelector('[data-plus="ttt"]')?.insertAdjacentHTML('beforebegin', `<button data-plus="plan">${GI.pad}<span><b>Proposer une partie</b><small>Qui vient jouer ?</small></span></button>`);
};
$('#plus-menu').addEventListener('click', e => { if (e.target.closest('[data-plus="plan"]')) { $('#plus-menu').hidden = true; openPlan(); } }, true);
// la carte dans la conversation
const names = ids => { const n = ids.map(u => user(u).name); return n.length <= 2 ? n.join(' et ') : `${n.slice(0, 2).join(', ')} et ${n.length - 2} autre${n.length > 3 ? 's' : ''}`; };
function planWhen(at) {
  if (!at) return 'maintenant';
  const d = new Date(at), t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', ' h ').replace(' h 00', ' h');
  return sameDay(d, Date.now()) ? (d.getHours() >= 18 ? `ce soir ${t}` : `à ${t}`) : sameDay(d, Date.now() + 864e5) ? `demain ${t}` : `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} ${t}`;
}
const _gameHTML17 = gameHTML;
gameHTML = function (m) {
  const g = m.game; if (g?.type !== 'plan') return _gameHTML17(m);
  const mine = g.going.includes(st.me) ? 'going' : g.no.includes(st.me) ? 'no' : null;
  const others = g.going.filter(u => u !== m.author_id);
  return `<div class="plan-card" data-plan="${esc(m.id)}">
    <div class="pc-top"><span class="pc-ico">${GI.pad}</span><span><small>${esc(m.author_id === st.me ? 'Tu proposes' : user(m.author_id).name + ' propose')}</small><b>${esc(g.title)} ${esc(planWhen(g.at))} ?</b></span></div>
    <div class="pc-acts"><button class="pc-yes ${mine === 'going' ? 'on' : ''}" data-plan-ans="going">${mine === 'going' ? '✓ Je viens' : 'Je viens'}</button><button class="pc-no ${mine === 'no' ? 'on' : ''}" data-plan-ans="no">Pas dispo</button></div>
    <div class="pc-who">${others.length ? `${esc(names(others))} ${others.length > 1 ? 'viennent' : 'vient'}` : 'Personne n\'a encore répondu'}${g.no.length ? ` · ${g.no.length} pas dispo` : ''}</div></div>`;
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-plan-ans]'); if (!b) return;
  const card = b.closest('[data-plan]'); const m = (st.msgs[st.view.channel] || []).find(x => x.id === card.dataset.plan); if (!m) return;
  const cur = m.game.going.includes(st.me) ? 'going' : m.game.no.includes(st.me) ? 'no' : null;
  act('answerPlan', { messageId: m.id, answer: cur === b.dataset.planAns ? null : b.dataset.planAns });
});

// ---------------------------------------------------------------- Petites retouches : heure courte, icône du vocal dans les onglets
const _renderMain17b = renderMain;
renderMain = function (...a) {
  _renderMain17b.apply(this, a);
  document.querySelectorAll('#view .msg .when').forEach(w => { if (w.textContent.startsWith('Aujourd\'hui à ')) w.textContent = w.textContent.slice(14); });
};
const _renderChips17 = renderChips;
renderChips = function () {
  _renderChips17();
  document.querySelectorAll('#chan-chips .chip.voice').forEach(c => { if (!c.querySelector('svg')) c.innerHTML = LI.spk + c.innerHTML.replace('🔊 ', ''); });
};
