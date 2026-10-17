'use strict';
// Parlotte 2.0 — partie 1 : corrections, vibrations, en-tête des salons, et profils façon Instagram
//  • vibrations sur iPhone aussi (astuce iOS 18+ : l'interrupteur natif fait vibrer) ;
//  • en-tête d'un salon : boutons à droite + bouton « Membres » (téléphone) ;
//  • dans un serveur, glisser vers la droite depuis la liste des salons ramène aux Messages ;
//  • publications du profil (photos/vidéos, réservées ou non à une catégorie), ❤️ (double-tap),
//    commentaires (désactivables), j'aime masquables, réponse en privé, partage du profil (lien + QR) ;
//  • profil « Insta » côté potes, carte « Discord » côté serveurs.
window.PARLOTTE_VERSION = '2.0.0';

const V20 = {
  heart: svg('<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2.1 0 3.4 1.2 4.4 2.6 1-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z"/>', 26),
  heartF: svg('<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2.1 0 3.4 1.2 4.4 2.6 1-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z" fill="currentColor"/>', 26),
  comment: svg('<path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1120 12z"/>', 26),
  send: svg('<path d="M21 3L3 10.5l7 3 3 7z"/><path d="M10 13.5L21 3"/>', 26),
  more: svg('<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>', 22),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 22),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>', 20),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
  share: svg('<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6"/>', 20),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>', 18),
  people: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>', 20),
  play: svg('<path d="M8 5l11 7-11 7z" fill="currentColor"/>', 18),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 20),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 20),
  eye: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 20),
  chat: svg('<path d="M4 5h16v11H9l-5 4z"/>', 20),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" fill="currentColor"/>', 16),
  link: svg('<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>', 20),
  check: svg('<path d="M5 12l5 5L20 7"/>', 16),
};
const H = (ms = 10) => navigator.vibrate?.(ms);

// ================================================================ Vibrations sur iPhone
// Safari n'a pas navigator.vibrate ; mais toucher un interrupteur natif (<input switch>, iOS 18+) fait vibrer.
if (!navigator.vibrate && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
  const lab = document.createElement('label'); lab.setAttribute('aria-hidden', 'true');
  lab.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  lab.innerHTML = '<input type="checkbox" switch tabindex="-1">'; document.body.appendChild(lab);
  let last = 0;
  try { Object.defineProperty(navigator, 'vibrate', { configurable: true, value: () => { const t = Date.now(); if (t - last > 40) { last = t; try { lab.click(); } catch {} } return true; } }); } catch {}
}

// ================================================================ En-tête d'un salon (téléphone) + Membres
const _renderMain20h = renderMain;
renderMain = function (...a) {
  _renderMain20h.apply(this, a);
  let b = $('#mem-btn');
  if (!b) { $('#chat-head').insertAdjacentHTML('beforeend', `<button id="mem-btn" title="Membres" aria-label="Membres">${V20.people}</button>`); b = $('#mem-btn'); }
  const c = channel(); b.hidden = !(c && (c.type !== 'dm' || c.group));
};
$('#chat-head').addEventListener('click', e => {
  if (!e.target.closest('#mem-btn')) return;
  e.stopPropagation(); H(8);
  if (!mobile()) return $('#toggle-members').click();
  renderMembers();
  const c = channel(), n = c?.type === 'dm' ? c.members.length : server()?.members.length || 0;
  openSheet(`<h3 class="sh-title">${V20.people} Membres <small class="mem-n">${n}</small></h3><div class="mem-sheet">${$('#members').innerHTML}</div>`);
  $('#sheet').classList.add('sh-tall');
});
// un membre touché dans la feuille : son profil (carte Discord côté serveur)
document.addEventListener('click', e => {
  const r = e.target.closest('.mem-sheet [data-user]'); if (!r) return;
  e.stopImmediatePropagation(); closeSheet(); setTimeout(() => openUserProfile(r.dataset.user), 200);
}, true);

// ================================================================ Serveur : glisser vers la droite depuis les salons → Messages
(() => {
  let x0 = null, y0 = 0, done = false;
  document.addEventListener('touchstart', e => {
    x0 = null; if (!mobile() || !document.body.classList.contains('drawer-open') || e.touches.length !== 1) return;
    if (e.target.closest('[data-noswipe],input,textarea,#chat')) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; done = false;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (x0 === null || done) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (dx > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) { done = true; H(8); goTab(0, 'left'); }
  }, { passive: true });
})();

// ================================================================ Publications (données)
st.posts = {}; // userId → liste (plus récente d'abord)
const postsOf = uid => st.posts[uid] || null;
async function loadPosts(uid, force) {
  if (st.posts[uid] && !force) return st.posts[uid];
  try { const r = await request('getPosts', { userId: uid }); st.posts[uid] = r.posts || []; st.posts[uid].hidden = !!r.hidden; }
  catch { st.posts[uid] = st.posts[uid] || []; }
  return st.posts[uid];
}
function findPostLocal(id) { for (const l of Object.values(st.posts)) { const p = (l || []).find(x => x.id === id); if (p) return p; } return null; }
const _handle20 = handle;
handle = function (m) {
  if (m.t === 'post') return onPost(m.post);
  if (m.t === 'postRemoved') { for (const k in st.posts) st.posts[k] = (st.posts[k] || []).filter(p => p.id !== m.id); if (pv20.post?.id === m.id) closePostViewer(); return refreshProfiles(); }
  if (m.t === 'postsReset') { delete st.posts[m.userId]; return refreshProfiles(); }
  _handle20(m);
};
function onPost(p) {
  const l = st.posts[p.author]; if (!l) { if (p.author === st.me) st.posts[p.author] = [p]; return refreshProfiles(); }
  const i = l.findIndex(x => x.id === p.id); if (i >= 0) l[i] = p; else { l.unshift(p); l.sort((a, b) => b.created.localeCompare(a.created)); }
  if (pv20.post?.id === p.id) { pv20.post = p; renderPostChrome(); }
  refreshProfiles();
}
function refreshProfiles() {
  if (!$('#ptab').hidden) renderPTab();
  const ig = $('#pfull .igp'); if (ig && !$('#pfull').hidden) fillIgGrid(ig.dataset.igp);
}

// ================================================================ Profil Insta (onglet Profil et potes)
const fmtN = n => (n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.', ',') + ' k' : String(n));
function noteBubble(u, me) {
  const pr = me ? st.profile || {} : u, txt = pr.customStatus || pr.statusEmoji ? `${pr.statusEmoji ? emojiHTML(pr.statusEmoji) + ' ' : ''}${esc(pr.customStatus || '')}` : '';
  const ph = u.notePhoto;
  if (!txt && !ph && !me) return '';
  return `<button class="ig-note ${txt || ph ? '' : 'empty'}" ${me ? 'data-pt="note"' : 'tabindex="-1"'}>${ph ? `<span class="ign-ph">${ph.kind === 'video' ? `<video src="${esc(ph.url)}#t=0.1" muted playsinline autoplay loop></video>` : `<img src="${esc(ph.url)}" alt="">`}</span>` : ''}<span class="ign-tx">${txt || (me ? 'Ta note…' : '')}</span></button>`;
}
function gridHTML(uid, list) {
  const me = uid === st.me;
  if (!list) return '<div class="ig-grid loading">' + '<i class="sk"></i>'.repeat(6) + '</div>';
  if (list.hidden) return `<div class="ig-empty">${V20.lock}<b>Profil privé</b><p>${esc(user(uid).name)} montre ses publications à certains potes seulement.</p></div>`;
  if (!list.length) return me ? `<button class="ig-empty add" data-ig-new>${V20.plus}<b>Ta première publication</b><p>Une photo ou une vidéo sur ton profil. Tes potes reçoivent une notification, pas de fil à faire défiler.</p></button>`
    : `<div class="ig-empty">${V20.grid}<b>Pas encore de publication</b></div>`;
  return `<div class="ig-grid">${me ? `<button class="ig-cell add" data-ig-new aria-label="Nouvelle publication">${V20.plus}</button>` : ''}${list.map(p => `<button class="ig-cell" data-post="${esc(p.id)}">
    ${p.kind === 'video' ? `<video src="${esc(p.url)}#t=0.1" muted playsinline preload="metadata"></video><i class="ig-vid">${V20.play}</i>` : `<img src="${esc(p.url)}" alt="" loading="lazy">`}
    ${me && p.audience ? `<i class="ig-aud" style="--fc:${esc(fgroup(p.audience)?.color || '#3FB27F')}">${p.audience === 'close' ? V20.star : V20.lock}</i>` : ''}</button>`).join('')}</div>`;
}
function igProfileHTML(uid, data) {
  const u = user(uid), me = uid === st.me, friend = st.friends.includes(uid), posts = postsOf(uid);
  const story = hasStory(uid), unseen = story && unseenStory(uid), hl = data?.highlights || [];
  const nPosts = posts && !posts.hidden ? posts.length : data?.postCount ?? '–';
  const mutual = data?.mutualFriends?.length || 0;
  return `<div class="igp" data-igp="${esc(uid)}">
    <div class="igp-top">
      <button class="igp-av ${story ? (unseen ? 'story' : 'story seen') : ''}" ${story ? `data-igp-story="${esc(uid)}"` : 'tabindex="-1"'}>${avatarNU(u)}</button>
      <div class="igp-stats"><div><b>${nPosts}</b><small>publication${nPosts === 1 ? '' : 's'}</small></div>
        <div><b>${me ? st.friends.length : mutual}</b><small>${me ? 'potes' : 'en commun'}</small></div>
        <div><b>${hl.length}</b><small>à la une</small></div></div>
    </div>
    ${noteBubble(u, me)}
    <div class="igp-name"><h2>${esc(u.name)}${isClose(uid) ? ` <i class="fr-star in">${V20.star}</i>` : ''}</h2>${u.pronouns ? `<small>${esc(u.pronouns)}</small>` : ''}</div>
    ${u.about ? `<p class="igp-bio">${esc(u.about)}</p>` : ''}
    <div class="igp-btns">${me ? `<button class="pill-btn" data-pt="edit">Modifier</button><button class="pill-btn" data-ig-share>${V20.share}<span>Partager</span></button>`
      : friend ? `<button class="primary" data-carddm="${esc(uid)}">${V20.chat}<span>Message</span></button><button class="pill-btn ${isClose(uid) ? 'on-close' : ''}" data-ig-friend="${esc(uid)}">${isClose(uid) ? V20.star : V20.people}<span>${isClose(uid) ? 'Ami proche' : 'Pote'}</span></button>`
      : `<button class="primary green" data-cardadd="${esc(u.name)}">Ajouter en pote</button>`}</div>
    ${hl.length ? `<div class="igp-hl" data-noswipe>${hl.map(h => `<button class="igp-hli" data-igp-hl="${esc(h.id)}">${hlCoverHTML(h)}<span>${esc(h.title)}</span>${me && h.audience ? `<i class="ig-aud" style="--fc:${esc(fgroup(h.audience)?.color || '#3FB27F')}">${V20.lock}</i>` : ''}</button>`).join('')}</div>` : ''}
    <div class="igp-tabs"><span class="on">${V20.grid}</span></div>
    <div class="igp-grid">${gridHTML(uid, posts)}</div>
  </div>`;
}
function fillIgGrid(uid) { const g = document.querySelector(`.igp[data-igp="${CSS.escape(uid)}"] .igp-grid`); if (g) g.innerHTML = gridHTML(uid, postsOf(uid)); }
// Le profil d'un pote (hors serveur) : la version Insta, dans la feuille qui monte
const _openPSheet20 = openPSheet;
openPSheet = function (uid) {
  if (space() === 'servers' && !isFriendsView()) return _openPSheet20(uid); // côté serveur : la carte Discord
  const pf = $('#pfull'), box = pf.querySelector('.pfull-box'); $('#card').hidden = true;
  pf.classList.add('sheet19', 'ig'); pf.classList.remove('ps-out');
  const draw = () => { const s = box.scrollTop; box.innerHTML = `<div class="ps-grab" aria-hidden="true"><i></i></div><button class="pc-x igp-x" data-pc-close aria-label="Fermer">${V20.close}</button>` + igProfileHTML(uid, profCache.get(uid)); box.scrollTop = s; };
  draw(); box.scrollTop = 0; box.style.transform = '';
  pf.hidden = false; pf.classList.remove('ps-open'); void pf.offsetWidth; pf.classList.add('ps-open');
  loadProfile(uid).then(() => !pf.hidden && pf.querySelector(`.igp[data-igp="${CSS.escape(uid)}"]`) && draw());
  loadPosts(uid, true).then(() => !pf.hidden && fillIgGrid(uid));
};
const _closePSheet20 = closePSheet;
closePSheet = function () { _closePSheet20(); setTimeout(() => $('#pfull').hidden && $('#pfull').classList.remove('ig'), 300); };
// clics dans un profil Insta (feuille ou onglet)
document.addEventListener('click', e => {
  const root = e.target.closest('.igp, #ptab'); if (!root) return;
  const p = e.target.closest('[data-post]'); if (p) { const uid = root.dataset.igp || st.me; return openPostViewer(uid, p.dataset.post); }
  if (e.target.closest('[data-ig-new]')) return newPostFlow();
  if (e.target.closest('[data-ig-share]')) return shareProfile();
  const s = e.target.closest('[data-igp-story]'); if (s) { closePSheet(); return openStoryViewer(s.dataset.igpStory); }
  const h = e.target.closest('[data-igp-hl]');
  if (h) { const uid = root.dataset.igp; const x = profCache.get(uid)?.highlights?.find(y => y.id === h.dataset.igpHl); if (x) { closePSheet(); openHighlight(uid, x); } return; }
  const f = e.target.closest('[data-ig-friend]'); if (f) return openFriendSheet(f.dataset.igFriend);
  if (!root.closest('#ptab') && e.target.closest('[data-pt="edit"]')) { closePSheet(); return openProfile(); }
});

// ---------------------------------------------------------------- L'onglet Profil devient « Insta »
const _renderPTab20 = renderPTab;
renderPTab = function () {
  _renderPTab20();
  const me = user(st.me), sc = $('#ptab .pt-scroll'); if (!sc) return;
  const keep = sc.scrollTop;
  // on remplace le haut par la version Insta et on garde les stories / potes en dessous
  const stories = sc.querySelector('.pt-sec'), friendsSec = [...sc.querySelectorAll('.pt-sec')].pop();
  sc.innerHTML = `<div class="pt-bar"><b>${esc(me.name)}</b><span class="grow"></span>
      <button class="pt-ic" data-ig-new aria-label="Nouvelle publication">${V20.plus}</button><button class="pt-ic" data-pt="privacy" aria-label="Qui voit ton profil">${V20.lock}</button><button class="pt-ic" data-pt="settings" aria-label="Paramètres">${V9.gear}</button></div>
    <div class="pt-banner mini ${me.banner ? 'img' : ''}" style="${bannerStyle(me)}"></div>` + igProfileHTML(st.me, profCache.get(st.me));
  const grid = sc.querySelector('.igp-tabs');
  if (stories) grid.insertAdjacentElement('beforebegin', stories);
  if (friendsSec && friendsSec !== stories) sc.appendChild(friendsSec);
  sc.insertAdjacentHTML('beforeend', `<p class="pt-foot">Parlotte ${esc(window.PARLOTTE_VERSION || '')}</p>`);
  sc.scrollTop = keep;
  if (!postsOf(st.me)) loadPosts(st.me).then(() => !$('#ptab').hidden && fillIgGrid(st.me));
};
$('#ptab').addEventListener('click', e => {
  if (e.target.closest('[data-pt="privacy"]')) { e.stopImmediatePropagation(); return profilePrivacy(); }
  if (e.target.closest('.igp-av[data-igp-story]')) { e.stopImmediatePropagation(); return openStoryViewer(st.me); }
}, true);
// appui long sur un « À la une » de ton profil : qui peut le voir
(() => {
  let t = null;
  document.addEventListener('pointerdown', e => {
    const h = e.target.closest('#ptab [data-igp-hl], #ptab [data-pt-hl]'); if (!h) return;
    t = setTimeout(() => { t = null; H(12); audiencePicker('Qui voit « ' + (profCache.get(st.me)?.highlights?.find(x => x.id === (h.dataset.igpHl || h.dataset.ptHl))?.title || '') + ' » ?',
      profCache.get(st.me)?.highlights?.find(x => x.id === (h.dataset.igpHl || h.dataset.ptHl))?.audience || null,
      a => act('setHighlightAudience', { highlightId: h.dataset.igpHl || h.dataset.ptHl, audience: a }).then(() => { profCache.delete(st.me); loadProfile(st.me).then(renderPTab); toast('C\'est noté'); })); }, 480);
  }, true);
  ['pointerup', 'pointercancel', 'pointermove'].forEach(k => document.addEventListener(k, ev => { if (t && (k !== 'pointermove' || Math.abs(ev.movementY) + Math.abs(ev.movementX) > 6)) { clearTimeout(t); t = null; } }, true));
})();

// ---------------------------------------------------------------- Choisir un public (tous / une catégorie)
function audiencePicker(title, cur, cb, opts = {}) {
  const items = [[null, opts.allLabel || 'Tous mes potes', `${st.friends.length} pote${st.friends.length > 1 ? 's' : ''}`, '#8E6CFF'],
    ...fgroups().map(g => [g.id, g.id === 'close' ? 'Amis proches' : g.name, `${g.members.length} pote${g.members.length > 1 ? 's' : ''}`, g.color])];
  openSheet(`<h3 class="sh-title">${esc(title)}</h3>${opts.sub ? `<p class="small sh-sub">${esc(opts.sub)}</p>` : ''}<div class="aud-list">${items.map(([id, l, sub, c]) =>
    `<button class="aud-opt ${cur === id ? 'on' : ''}" data-audp="${id || ''}" style="--fc:${esc(c)}"><span class="aud-ic">${id === 'close' ? V20.star : id ? V9.tag : V20.people}</span><span><b>${esc(l)}</b><small>${sub}</small></span><i>${V20.check}</i></button>`).join('')}
    <button class="aud-new" data-audp-new>${V9.plus}<span>Créer une catégorie</span></button></div>`);
  $('#sheet .sh-body').onclick = e => {
    const o = e.target.closest('[data-audp]'); if (o) { closeSheet(); H(8); return cb(o.dataset.audp || null); }
    if (e.target.closest('[data-audp-new]')) { closeSheet(); setTimeout(() => editFriendGroup(null), 220); }
  };
}
function profilePrivacy() {
  audiencePicker('Qui voit ton profil ?', st.profile?.profileAudience || null, a => act('setProfileAudience', { audience: a }).then(() => toast(a ? `Profil visible par « ${fgroup(a)?.name} » seulement 🔒` : 'Profil visible par tous tes potes')),
    { sub: 'Tes publications et tes « À la une ». Les autres potes voient juste ton nom et ta photo (pratique pour les potes des serveurs).' });
}

// ---------------------------------------------------------------- Partager son profil (lien + QR)
function shareProfile() {
  const me = user(st.me), url = `${location.origin}/?u=${encodeURIComponent(me.name)}`;
  openSheet(`<div class="share-p"><div class="sp-card" style="${bannerStyle(me)}">${avatarNU(me)}<b>${esc(me.name)}</b><div class="sp-qr">${qrSVG(url, 200)}</div><small>Scanne pour m'ajouter sur Parlotte</small></div>
    <div class="sp-btns"><button class="pill-btn" data-sp-copy>${V20.link}<span>Copier le lien</span></button>${navigator.share ? `<button class="primary" data-sp-share>${V20.share}<span>Partager</span></button>` : ''}</div>
    <p class="small">Le lien ouvre Parlotte et propose de t'ajouter en pote. Personne ne peut te trouver sans ton pseudo exact.</p></div>`);
  $('#sheet .sh-body').onclick = async e => {
    if (e.target.closest('[data-sp-copy]')) { try { await navigator.clipboard.writeText(url); toast('Lien copié 🔗'); } catch { toast(url); } }
    if (e.target.closest('[data-sp-share]')) navigator.share({ title: `${me.name} sur Parlotte`, url }).catch(() => {});
  };
}
// Ouvrir un lien de profil (?u=pseudo)
(() => {
  const name = new URLSearchParams(location.search).get('u'); if (!name) return;
  history.replaceState(null, '', '/');
  const go = () => {
    if (!st.me) return setTimeout(go, 400);
    const u = Object.values(st.users).find(x => x.name?.toLowerCase() === name.toLowerCase());
    if (u && u.id === st.me) return mobile() ? openPTab() : null;
    if (u && st.friends.includes(u.id)) return openUserProfile(u.id);
    openSheet(`<div class="share-p"><div class="sp-card">${SILHOUETTE}<b>${esc(name)}</b><small>veut être ton pote sur Parlotte</small></div>
      <div class="sp-btns"><button class="primary" data-sp-add>${V9.plus}<span>Ajouter ${esc(name)}</span></button></div></div>`);
    $('#sheet .sh-body').onclick = e => { if (e.target.closest('[data-sp-add]')) { closeSheet(); act('friendRequest', { username: name }).then(r => toast(r?.text || 'Demande envoyée')); } };
  };
  setTimeout(go, 800);
})();

// ================================================================ Visionneuse de publication
document.body.insertAdjacentHTML('beforeend', `<div id="postv" hidden role="dialog" aria-label="Publication"><div class="pv-in">
  <header class="pv-head"></header><div class="pv-media"></div><div class="pv-acts"></div><div class="pv-cap"></div><div class="pv-coms"></div></div>
  <form class="pv-form" hidden><input id="pv-input" placeholder="Ajouter un commentaire…" maxlength="500" autocomplete="off" enterkeyhint="send"><button class="pv-post" aria-label="Publier">${V20.send}</button></form></div>`);
const pv20 = { uid: null, post: null, mode: 'comment' };
function openPostViewer(uid, postId) {
  const p = (postsOf(uid) || []).find(x => x.id === postId) || findPostLocal(postId); if (!p) return;
  pv20.uid = uid; pv20.post = p; pv20.mode = 'comment';
  const v = $('#postv'); v.hidden = false; v.classList.remove('out'); void v.offsetWidth; v.classList.add('in');
  document.body.classList.add('post-open');
  renderPostViewer();
}
function closePostViewer() {
  const v = $('#postv'); if (v.hidden) return;
  v.classList.add('out'); v.querySelector('video')?.pause();
  setTimeout(() => { v.hidden = true; v.classList.remove('out', 'in'); v.querySelector('.pv-media').innerHTML = ''; v.querySelector('.pv-in').style.transform = ''; pv20.post = null; document.body.classList.remove('post-open'); }, 220);
}
function renderPostViewer() {
  const p = pv20.post, v = $('#postv'), u = user(p.author);
  v.querySelector('.pv-media').innerHTML = `<div class="pv-frame" style="${p.ar ? `aspect-ratio:${p.ar}` : ''}">${p.kind === 'video' ? `<video src="${esc(p.url)}" playsinline loop autoplay muted></video><button class="pv-snd" data-pv-sound aria-label="Son">${SI.muted}</button>` : `<img src="${esc(p.url)}" alt="">`}
    <div class="stk-layer pv-stk">${(p.stickers || []).map((k, i) => stickerHTML(k, i, {})).join('')}</div></div>`;
  const vid = v.querySelector('video'); if (vid) kickVideo(vid);
  renderPostChrome();
}
function renderPostChrome() {
  const p = pv20.post, v = $('#postv'), u = user(p.author), mine = p.author === st.me;
  v.querySelector('.pv-head').innerHTML = `<button class="pv-back" data-pv-close aria-label="Fermer">${V20.close}</button>${avatarNU(u)}<div class="pv-who"><b>${esc(u.name)}</b><small>${esc(ago(p.created))}${mine && p.audience ? ` · 🔒 ${esc(fgroup(p.audience)?.name || '')}` : ''}</small></div>
    ${mine ? `<button class="pv-more" data-pv-more aria-label="Options">${V20.more}</button>` : ''}`;
  const n = p.likes;
  v.querySelector('.pv-acts').innerHTML = `<button class="pv-like ${p.liked ? 'on' : ''}" data-pv-like aria-label="J'aime">${p.liked ? V20.heartF : V20.heart}</button>
    ${p.allowComments ? `<button data-pv-com aria-label="Commenter">${V20.comment}</button>` : ''}${mine ? '' : `<button data-pv-reply aria-label="Répondre en privé">${V20.send}</button>`}
    ${n !== null && n !== undefined ? `<button class="pv-count" ${mine ? 'data-pv-likers' : ''}>${n ? `<b>${fmtN(n)}</b> j'aime` : 'Sois le premier à aimer'}${p.hideLikes && mine ? ' <small>(masqué pour les autres)</small>' : ''}</button>` : ''}`;
  v.querySelector('.pv-cap').innerHTML = p.caption ? `<p><b>${esc(u.name)}</b> ${format(p.caption)}</p>` : '';
  v.querySelector('.pv-coms').innerHTML = p.allowComments ? (p.comments.length ? p.comments.map(c => { const cu = user(c.uid);
    return `<div class="pv-c">${avatarNU(cu)}<p><b>${esc(cu.name)}</b> ${format(c.text)}<small>${esc(ago(c.at))}${c.uid === st.me || mine ? ` · <button class="link" data-pv-cdel="${esc(c.id)}">Supprimer</button>` : ''}</small></p></div>`; }).join('')
    : '<p class="pv-none">Pas encore de commentaire.</p>') : '<p class="pv-none">Commentaires désactivés</p>';
  const f = v.querySelector('.pv-form'), canC = p.allowComments || !mine;
  f.hidden = !canC; f.classList.toggle('reply', pv20.mode === 'reply' || (!p.allowComments && !mine));
  $('#pv-input').placeholder = f.classList.contains('reply') ? `Répondre à ${u.name} en privé…` : 'Ajouter un commentaire…';
}
$('#postv').addEventListener('click', e => {
  const p = pv20.post; if (!p) return;
  if (e.target.closest('[data-pv-close]') || e.target === $('#postv')) return closePostViewer();
  if (e.target.closest('[data-pv-like]')) return likePost(p, !p.liked);
  if (e.target.closest('[data-pv-com]')) { pv20.mode = 'comment'; renderPostChrome(); return $('#pv-input').focus(); }
  if (e.target.closest('[data-pv-reply]')) { pv20.mode = 'reply'; renderPostChrome(); return $('#pv-input').focus(); }
  if (e.target.closest('[data-pv-sound]')) { const vd = $('#postv video'); vd.muted = !vd.muted; e.target.closest('[data-pv-sound]').innerHTML = vd.muted ? SI.muted : SI.sound; return; }
  const cd = e.target.closest('[data-pv-cdel]'); if (cd) return act('deleteComment', { postId: p.id, commentId: cd.dataset.pvCdel });
  if (e.target.closest('[data-pv-likers]')) return openSheet(`<h3 class="sh-title">J'aime</h3><div class="sh-list">${(p.likers || []).map(id => `<div class="sh-item">${avatarNU(user(id))}<b>${esc(user(id).name)}</b></div>`).join('') || '<p class="small pad">Personne pour l\'instant.</p>'}</div>`);
  if (e.target.closest('[data-pv-more]')) return postMenu(p);
  const u = e.target.closest('.pv-head .av'); if (u && p.author !== st.me) { closePostViewer(); return setTimeout(() => openUserProfile(p.author), 230); }
});
function likePost(p, on) {
  H(on ? 14 : 6);
  p.liked = on; if (p.likes !== null && p.likes !== undefined) p.likes += on ? 1 : -1; renderPostChrome();
  act('likePost', { postId: p.id, on });
}
// double-tap sur la photo : ❤️
(() => {
  let last = 0;
  $('#postv').addEventListener('pointerup', e => {
    if (!e.target.closest('.pv-frame') || e.target.closest('button')) return;
    const t = Date.now();
    if (t - last < 300) { last = 0; const p = pv20.post; if (!p.liked) likePost(p, true); else H(8);
      const h = document.createElement('i'); h.className = 'pv-burst'; h.innerHTML = V20.heartF; h.style.left = e.offsetX + 'px'; h.style.top = e.offsetY + 'px';
      e.target.closest('.pv-frame').appendChild(h); setTimeout(() => h.remove(), 900);
    } else last = t;
  });
})();
$('#postv .pv-form').addEventListener('submit', async e => {
  e.preventDefault(); const p = pv20.post, txt = $('#pv-input').value.trim(); if (!txt) return;
  const reply = e.target.classList.contains('reply');
  try {
    if (reply) { await request('replyPost', { postId: p.id, text: txt }); toast(`Envoyé à ${user(p.author).name} 📨`); pv20.mode = 'comment'; }
    else await request('commentPost', { postId: p.id, text: txt });
    $('#pv-input').value = ''; H(8); renderPostChrome();
    if (!reply) setTimeout(() => { const c = $('#postv .pv-in'); c.scrollTop = c.scrollHeight; }, 60);
  } catch (err) { toast(err.message, true); }
});
// glisser vers le bas pour fermer
(() => {
  let y0 = null, dy = 0;
  const box = () => $('#postv .pv-in');
  $('#postv').addEventListener('touchstart', e => { y0 = box().scrollTop <= 0 && !e.target.closest('.pv-form') ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  $('#postv').addEventListener('touchmove', e => { if (y0 === null) return; dy = e.touches[0].clientY - y0; if (dy > 0) { box().style.transform = `translateY(${dy}px) scale(${1 - Math.min(dy, 300) / 2000})`; } }, { passive: true });
  $('#postv').addEventListener('touchend', () => { if (y0 === null) return; y0 = null; if (dy > 110) closePostViewer(); else { box().style.transition = 'transform .25s'; box().style.transform = ''; setTimeout(() => (box().style.transition = ''), 260); } });
})();
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#postv').hidden) closePostViewer(); });
function postMenu(p) {
  openSheet(`<h3 class="sh-title">Ta publication</h3><div class="sh-list">
    <button class="sh-item" data-pm="cap"><span class="sh-ico">${V20.edit}</span><b>Modifier la légende</b></button>
    <button class="sh-item" data-pm="aud"><span class="sh-ico">${V20.lock}</span><b>Qui peut la voir</b><small>${p.audience ? esc(fgroup(p.audience)?.name || '') : 'Tous tes potes'}</small></button>
    <button class="sh-item" data-pm="com"><span class="sh-ico">${V20.comment}</span><b>${p.allowComments ? 'Désactiver' : 'Activer'} les commentaires</b></button>
    <button class="sh-item" data-pm="likes"><span class="sh-ico">${V20.heart}</span><b>${p.hideLikes ? 'Afficher' : 'Masquer'} le nombre de j'aime</b><small>${p.hideLikes ? 'Tes potes le verront' : 'Toi seul le verras'}</small></button>
    <button class="sh-item danger" data-pm="del"><span class="sh-ico">${V20.trash}</span><b>Supprimer</b></button></div>`);
  $('#sheet .sh-body').onclick = e => {
    const k = e.target.closest('[data-pm]')?.dataset.pm; if (!k) return; closeSheet();
    if (k === 'cap') setTimeout(() => ask('Légende', '', 'Enregistrer', t => act('updatePost', { postId: p.id, caption: t }), p.caption || ''), 200);
    if (k === 'aud') setTimeout(() => audiencePicker('Qui voit cette publication ?', p.audience || null, a => act('updatePost', { postId: p.id, audience: a })), 220);
    if (k === 'com') act('updatePost', { postId: p.id, allowComments: !p.allowComments });
    if (k === 'likes') act('updatePost', { postId: p.id, hideLikes: !p.hideLikes });
    if (k === 'del' && confirm('Supprimer cette publication ?')) { act('deletePost', { postId: p.id }); closePostViewer(); }
  };
}

// ================================================================ Nouvelle publication
// depuis le profil : choisir une photo/vidéo → éditeur (stickers possibles) → Envoyer → « Ton profil »
function newPostFlow() {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*,video/*';
  i.onchange = async () => { const f = i.files[0]; if (!f) return; window.sendPreset = 'post';
    if (/^image\//.test(f.type)) openEditor(await shrinkImage(f), 'image'); else if (/^video\//.test(f.type)) { if (f.size > 25 * 1024 * 1024) return toast('Vidéo trop lourde (25 Mo max)', true); openEditor(f, 'video'); } };
  i.click();
}

// ================================================================ Activité : publications
const _activityHTML20 = activityHTML;
activityHTML = function () {
  const f = st.view.afilter || 'all', mine = (st.activity || []).filter(a => /^post/.test(a.type));
  if (f === 'posts') {
    const body = mine.map(postActRow).join('');
    return `<div class="activity">${_activityHTML20().match(/<div class="chips act-chips"[\s\S]*?<\/div>/)?.[0].replace('aria-selected="true"', 'aria-selected="false"').replace(/ on"/, '"') || ''}${body || `<div class="empty-state big"><div class="es-ico">${V20.grid}</div><h2>Rien de neuf</h2><p>Les publications de tes potes, et les j'aime et commentaires sur les tiennes arrivent ici.</p></div>`}</div>`
      .replace('<div class="chips act-chips" role="tablist">', `<div class="chips act-chips" role="tablist" data-noswipe>`).replace(/(<\/div>)/, `<button role="tab" aria-selected="true" data-afilter="posts" class="chip on">Publications</button>$1`);
  }
  let html = _activityHTML20();
  html = html.replace(/(<div class="chips act-chips" role="tablist">[\s\S]*?)(<\/div>)/, `$1<button role="tab" aria-selected="false" data-afilter="posts" class="chip">Publications${mine.some(a => !a.seen) ? ' ·' : ''}</button>$2`);
  if (f === 'all' && mine.length) html = html.replace('<div class="activity">', `<div class="activity">`).replace(/(<div class="chips act-chips"[\s\S]*?<\/div>)/, `$1<h3 class="act-h">Publications</h3>${mine.slice(0, 6).map(postActRow).join('')}`);
  return html;
};
function postActRow(a) {
  const u = user(a.from), when = ago(a.at), cls = `act-item ${a.seen ? '' : 'new'}`;
  const thumb = `<span class="ai-thumb">${a.kind === 'video' ? `<video src="${esc(a.url)}#t=0.1" muted playsinline preload="metadata"></video>` : `<img src="${esc(a.url)}" alt="">`}</span>`;
  const txt = a.type === 'post' ? `<b>${esc(u.name)}</b> a publié une photo${a.text ? ` : <span class="ai-q">« ${esc(a.text)} »</span>` : ''}`
    : a.type === 'postlike' ? `<b>${esc(u.name)}</b> a aimé ta publication` : `<b>${esc(u.name)}</b> a commenté : <span class="ai-q">« ${esc(a.text || '')} »</span>`;
  return `<button class="${cls}" data-act-post="${esc(a.postId)}" data-act-pa="${esc(a.type === 'post' ? a.from : st.me)}">${avatarNU(u)}<div class="ai-txt">${txt}<small>${when}</small></div>${thumb}</button>`;
}
$('#view').addEventListener('click', async e => {
  const b = e.target.closest('[data-act-post]'); if (!b) return;
  e.stopImmediatePropagation();
  const uid = b.dataset.actPa; await loadPosts(uid, true);
  if (!(postsOf(uid) || []).some(p => p.id === b.dataset.actPost)) return toast('Cette publication n\'est plus disponible', true);
  openPostViewer(uid, b.dataset.actPost);
}, true);
// les notifications de publication
const _handle20a = handle;
handle = function (m) {
  _handle20a(m);
  if (m.t === 'activity' && /^post/.test(m.item?.type)) {
    const u = user(m.item.from).name;
    if (m.item.type === 'post') { delete st.posts[m.item.from]; toast(`${u} a publié une photo 📸`); }
    if (m.item.type === 'postlike') toast(`${u} a aimé ta publication ❤️`);
    if (m.item.type === 'postcomment') toast(`${u} a commenté ta publication 💬`);
  }
};
// réponse privée à une publication : la vignette dit « publication »
const _storyReplyHTML20 = storyReplyHTML;
storyReplyHTML = function (m, mine) {
  const h = _storyReplyHTML20(m, mine);
  return m.story?.post ? h.replace('Tu as répondu à sa story', 'Tu as répondu à sa publication').replace('A répondu à ta story', 'A répondu à ta publication') : h;
};

// ================================================================ Carte Discord côté serveur, Insta ailleurs
const _openUserProfile20 = openUserProfile;
openUserProfile = function (uid) { return _openUserProfile20(uid); };
