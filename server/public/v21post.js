'use strict';
// Parlotte 2.1 — publications : fil façon Insta, commentaires en feuille, partage, « À la une » depuis Envoyer
const P21 = {
  back: svg('<path d="M15 5l-7 7 7 7"/>', 24),
  heart: svg('<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2.1 0 3.4 1.2 4.4 2.6 1-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z"/>', 25),
  heartF: svg('<path d="M12 20s-7-4.4-9.2-8.6C1.2 8.2 3 4.5 6.6 4.5c2.1 0 3.4 1.2 4.4 2.6 1-1.4 2.3-2.6 4.4-2.6 3.6 0 5.4 3.7 3.8 6.9C19 15.6 12 20 12 20z" fill="currentColor"/>', 25),
  comment: svg('<path d="M20 12a8 8 0 01-11.6 7.1L4 20l1-4.2A8 8 0 1120 12z"/>', 24),
  send: svg('<path d="M21 3L3 10.5l7 3 3 7z"/><path d="M10 13.5L21 3"/>', 24),
  more: svg('<circle cx="5" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="19" cy="12" r="1.7" fill="currentColor"/>', 22),
  check: svg('<path d="M5 12l5 5L20 7"/>', 14),
  star: svg('<path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z"/>', 26),
};

// ================================================================ Le fil des publications d'un profil
document.body.insertAdjacentHTML('beforeend', `<div id="pfeed" hidden role="dialog" aria-label="Publications"><header class="pf-head"><button class="pf-back" data-pf-close aria-label="Retour">${P21.back}</button><div><small>Publications</small><b></b></div></header><div class="pf-list"></div></div>`);
const pf21 = { uid: null };
function pfCardHTML(p) {
  const u = user(p.author), mine = p.author === st.me, ar = Math.max(0.8, Math.min(1.91, p.ar || 0.8));
  const n = p.likes, nc = (p.comments || []).length;
  return `<article class="pf-card" data-pfc="${esc(p.id)}">
    <header class="pf-ch">${avatarNU(u)}<div><b>${esc(u.name)}</b><small>${esc(ago(p.created))}${mine && p.audience ? ` · 🔒 ${esc(fgroup(p.audience)?.name || '')}` : ''}</small></div>${mine ? `<button class="pf-more" data-pf-more aria-label="Options">${P21.more}</button>` : ''}</header>
    <div class="pf-media" style="aspect-ratio:${ar}">${p.kind === 'video' ? `<video src="${esc(p.url)}" playsinline loop muted preload="metadata"></video><button class="pf-snd" data-pf-sound aria-label="Son">${SI.muted}</button>` : `<img src="${esc(p.url)}" alt="" loading="lazy" decoding="async">`}
      <div class="stk-layer pf-stk">${(p.stickers || []).map((k, i) => stickerHTML(k, i, {})).join('')}</div></div>
    <div class="pf-acts">
      <button class="pf-like ${p.liked ? 'on' : ''}" data-pf-like aria-label="J'aime">${p.liked ? P21.heartF : P21.heart}${n !== null && n !== undefined && n > 0 ? `<span>${fmtN(n)}</span>` : ''}</button>
      ${p.allowComments ? `<button data-pf-com aria-label="Commentaires">${P21.comment}${nc ? `<span>${nc}</span>` : ''}</button>` : ''}
      <button data-pf-share aria-label="Partager">${P21.send}</button></div>
    ${p.caption ? `<p class="pf-cap"><b>${esc(u.name)}</b> ${format(p.caption)}</p>` : ''}
    ${p.allowComments && nc ? `<button class="pf-allc" data-pf-com>${nc > 1 ? `Voir les ${nc} commentaires` : 'Voir le commentaire'}</button>` : ''}
  </article>`;
}
function openPostFeed(uid, postId) {
  const list = postsOf(uid) || []; if (!list.length) return;
  pf21.uid = uid;
  const f = $('#pfeed'); f.querySelector('.pf-head b').textContent = user(uid).name;
  f.querySelector('.pf-list').innerHTML = list.map(pfCardHTML).join('');
  f.hidden = false; f.classList.remove('out'); f.classList.remove('in'); void f.offsetWidth; f.classList.add('in');
  document.body.classList.add('post-open'); H(8);
  const el = f.querySelector(`[data-pfc="${CSS.escape(postId)}"]`); if (el) f.querySelector('.pf-list').scrollTop = el.offsetTop - f.querySelector('.pf-list').offsetTop;
  watchVideos();
}
function closePostFeed() {
  const f = $('#pfeed'); if (f.hidden) return;
  f.classList.add('out'); f.querySelectorAll('video').forEach(v => v.pause());
  setTimeout(() => { f.hidden = true; f.classList.remove('out', 'in'); f.querySelector('.pf-list').innerHTML = ''; pf21.uid = null; document.body.classList.remove('post-open'); }, 230);
}
// les vidéos se lancent quand elles sont à l'écran
let pfObs = null;
function watchVideos() {
  pfObs?.disconnect();
  pfObs = new IntersectionObserver(es => es.forEach(e => { const v = e.target; if (e.isIntersecting) { v.muted = v.dataset.snd !== '1'; v.play().catch(() => {}); } else v.pause(); }), { root: $('#pfeed .pf-list'), threshold: 0.6 });
  $('#pfeed').querySelectorAll('video').forEach(v => pfObs.observe(v));
}
openPostViewer = function (uid, postId) { openPostFeed(uid, postId); };
const postById = id => (postsOf(pf21.uid) || []).find(p => p.id === id) || findPostLocal(id);
function refreshCard(p) { const el = $('#pfeed').querySelector(`[data-pfc="${CSS.escape(p.id)}"]`); if (!el) return; const v = el.querySelector('video'), t = v?.currentTime; el.outerHTML = pfCardHTML(p); if (v) { const nv = $('#pfeed').querySelector(`[data-pfc="${CSS.escape(p.id)}"] video`); if (nv) { nv.currentTime = t || 0; } watchVideos(); } }
const _onPost21 = onPost;
onPost = function (p) { _onPost21(p); if (!$('#pfeed').hidden) refreshCard(p); if ($('#sheet .pfc-sheet')?.dataset.pid === p.id) renderComments(p); };
$('#pfeed').addEventListener('click', e => {
  if (e.target.closest('[data-pf-close]')) return closePostFeed();
  const card = e.target.closest('[data-pfc]'); if (!card) return;
  const p = postById(card.dataset.pfc); if (!p) return;
  if (e.target.closest('[data-pf-like]')) { pfLike(p, !p.liked, card); return; }
  if (e.target.closest('[data-pf-com]')) return openComments(p);
  if (e.target.closest('[data-pf-share]')) return sharePostSheet(p);
  if (e.target.closest('[data-pf-more]')) return postMenu(p);
  const s = e.target.closest('[data-pf-sound]'); if (s) { const v = card.querySelector('video'); v.muted = !v.muted; v.dataset.snd = v.muted ? '' : '1'; s.innerHTML = v.muted ? SI.muted : SI.sound; return; }
  if (e.target.closest('.pf-ch .av,.pf-ch b') && p.author !== st.me) { closePostFeed(); setTimeout(() => openUserProfile(p.author), 240); }
});
function pfLike(p, on, card) {
  H(on ? 14 : 6); p.liked = on; if (p.likes !== null && p.likes !== undefined) p.likes += on ? 1 : -1;
  refreshCard(p); act('likePost', { postId: p.id, on });
}
// double-tap sur la photo : ❤️
(() => {
  let last = 0, lastEl = null;
  $('#pfeed').addEventListener('pointerup', e => {
    const m = e.target.closest('.pf-media'); if (!m || e.target.closest('button')) return;
    const t = Date.now();
    if (t - last < 320 && lastEl === m) {
      last = 0; const card = m.closest('[data-pfc]'), p = postById(card.dataset.pfc); if (!p) return;
      if (!p.liked) pfLike(p, true, card); else H(8);
      const mm = $('#pfeed').querySelector(`[data-pfc="${CSS.escape(p.id)}"] .pf-media`) || m, r = mm.getBoundingClientRect();
      const h = document.createElement('i'); h.className = 'pv-burst'; h.innerHTML = P21.heartF; h.style.left = (e.clientX - r.left) + 'px'; h.style.top = (e.clientY - r.top) + 'px';
      mm.appendChild(h); setTimeout(() => h.remove(), 900);
    } else { last = t; lastEl = m; }
  });
})();
// glisser depuis le bord gauche pour revenir
(() => {
  let x0 = null, dx = 0; const f = $('#pfeed');
  f.addEventListener('touchstart', e => { x0 = e.touches[0].clientX < 34 ? e.touches[0].clientX : null; dx = 0; }, { passive: true });
  f.addEventListener('touchmove', e => { if (x0 === null) return; dx = Math.max(0, e.touches[0].clientX - x0); f.style.transform = `translateX(${dx}px)`; }, { passive: true });
  f.addEventListener('touchend', () => { if (x0 === null) return; x0 = null; f.style.transition = 'transform .22s'; if (dx > innerWidth * 0.3) { f.style.transform = `translateX(${innerWidth}px)`; setTimeout(() => { f.style.transition = ''; f.style.transform = ''; closePostFeed(); }, 200); } else { f.style.transform = ''; setTimeout(() => (f.style.transition = ''), 230); } });
})();
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#pfeed').hidden && $('#sheet').hidden) closePostFeed(); });
const _postMenu21 = postMenu;
postMenu = function (p) {
  _postMenu21(p);
  const body = $('#sheet .sh-body'), prev = body.onclick;
  body.onclick = e => { const k = e.target.closest('[data-pm]')?.dataset.pm; if (k === 'del') { closeSheet(); if (confirm('Supprimer cette publication ?')) { act('deletePost', { postId: p.id }); const el = $('#pfeed').querySelector(`[data-pfc="${CSS.escape(p.id)}"]`); el?.remove(); if (!$('#pfeed .pf-card')) closePostFeed(); } return; } prev(e); };
};
const _closePostViewer21 = closePostViewer;
closePostViewer = function () { _closePostViewer21(); closePostFeed(); };

// ---------------------------------------------------------------- Commentaires : une feuille qui monte
function openComments(p) {
  openSheet(`<div class="pfc-sheet" data-pid="${esc(p.id)}"><h3 class="sh-title">Commentaires</h3><div class="pfc-list"></div>
    <form class="pfc-form">${avatarNU(user(st.me))}<input id="pfc-in" placeholder="Ajouter un commentaire…" maxlength="500" autocomplete="off" enterkeyhint="send"><button class="pfc-go" aria-label="Publier">${P21.send}</button></form></div>`);
  $('#sheet').classList.add('sh-tall'); renderComments(p);
  $('#sheet .pfc-form').onsubmit = async e => {
    e.preventDefault(); const t = $('#pfc-in').value.trim(); if (!t) return;
    try { await request('commentPost', { postId: p.id, text: t }); $('#pfc-in').value = ''; H(8); } catch (err) { toast(err.message, true); }
  };
  $('#sheet .pfc-list').onclick = e => { const d = e.target.closest('[data-pfc-del]'); if (d) act('deleteComment', { postId: p.id, commentId: d.dataset.pfcDel }); };
}
function renderComments(p) {
  const box = $('#sheet .pfc-list'); if (!box) return; const mine = p.author === st.me;
  box.innerHTML = (p.comments || []).length ? p.comments.map(c => { const cu = user(c.uid);
    return `<div class="pv-c">${avatarNU(cu)}<p><b>${esc(cu.name)}</b> ${format(c.text)}<small>${esc(ago(c.at))}${c.uid === st.me || mine ? ` · <button class="link" data-pfc-del="${esc(c.id)}">Supprimer</button>` : ''}</small></p></div>`; }).join('')
    : '<p class="pv-none">Pas encore de commentaire. Lance la discussion !</p>';
  box.scrollTop = box.scrollHeight;
}

// ---------------------------------------------------------------- Partager / répondre en privé
function sharePostSheet(p) {
  const mine = p.author === st.me, au = user(p.author);
  const friends = st.friends.filter(u => u !== p.author).map(user).sort((a, b) => isClose(b.id) - isClose(a.id) || a.name.localeCompare(b.name));
  const sel = new Set();
  openSheet(`<div class="psh">${mine ? '' : `<form class="psh-reply">${avatarNU(au)}<input id="psh-r" placeholder="Répondre à ${esc(au.name)} en privé…" maxlength="500" autocomplete="off" enterkeyhint="send"><button aria-label="Envoyer">${P21.send}</button></form>`}
    <h5 class="s21-h">Partager avec</h5><p class="small psh-note">Seuls les potes qui peuvent voir ce profil la recevront.</p>
    <div class="snd-grid">${friends.map(u => `<button class="snd-p" data-psh="${esc(u.id)}"><span class="snd-av">${avatarNU(u)}<i>${P21.check}</i></span><span>${esc(u.name)}</span></button>`).join('') || '<p class="small">Aucun autre pote.</p>'}</div>
    <input class="snd-in" id="psh-t" placeholder="Ajouter un message (facultatif)" maxlength="500"><button class="primary snd-go" id="psh-go" disabled>Choisis des potes</button></div>`);
  $('#sheet').classList.add('sh-tall');
  const body = $('#sheet .sh-body');
  body.onclick = async e => {
    const b = e.target.closest('[data-psh]');
    if (b) { const id = b.dataset.psh; sel.has(id) ? sel.delete(id) : sel.add(id); b.classList.toggle('on'); H(6); const g = $('#psh-go'); g.disabled = !sel.size; g.textContent = sel.size ? `Envoyer à ${sel.size}` : 'Choisis des potes'; return; }
    if (e.target.closest('#psh-go') && sel.size) {
      try { const r = await request('sharePost', { postId: p.id, userIds: [...sel], text: $('#psh-t').value }); closeSheet(); H(12);
        toast(r.sent ? `Partagée avec ${r.sent} pote${r.sent > 1 ? 's' : ''} 📨${r.skipped ? ` (${r.skipped} sans accès)` : ''}` : 'Personne n\'a accès à ce profil', !r.sent); } catch (err) { toast(err.message, true); }
    }
  };
  $('#sheet .psh-reply')?.addEventListener('submit', async e => {
    e.preventDefault(); const t = $('#psh-r').value.trim(); if (!t) return;
    try { await request('replyPost', { postId: p.id, text: t }); closeSheet(); toast(`Envoyé à ${au.name} 📨`); } catch (err) { toast(err.message, true); }
  });
}
// la vignette dans la conversation : « a partagé une publication » et on l'ouvre au toucher
storyReplyHTML = (orig => function (m, mine) {
  if (!m.story?.post) return orig(m, mine);
  const who = user(m.story.author).name, label = m.story.shared ? (mine ? `Tu as partagé une publication de ${who}` : `Publication de ${who}`) : (mine ? 'Tu as répondu à sa publication' : 'A répondu à ta publication');
  return `<div class="sreply post ${mine ? 'mine' : ''}"><small>${esc(label)}</small><button class="pthumb" data-open-post="${esc(m.story.id)}" data-post-author="${esc(m.story.author)}">${m.story.kind === 'video' ? `<video src="${esc(m.story.url)}#t=0.3" muted playsinline preload="metadata"></video>` : `<img src="${esc(m.story.url)}" alt="" loading="lazy">`}</button></div>`;
})(storyReplyHTML);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-open-post]'); if (!b) return;
  e.stopPropagation(); const uid = b.dataset.postAuthor; await loadPosts(uid, true);
  if (!(postsOf(uid) || []).some(p => p.id === b.dataset.openPost)) return toast('Cette publication n\'est plus disponible', true);
  openPostFeed(uid, b.dataset.openPost);
});

// ================================================================ Envoyer : « À la une » remplace « Ta note »
const _openSend21p = openSendSheet;
openSendSheet = function () {
  const keep = sndFor === ed.file && ed.file;
  _openSend21p();
  if (!keep) Object.assign(snd, { hl: false, hlId: null, hlTitle: '' });
  const d = $('#sheet .s21-d[data-snd="note"]');
  if (d) d.outerHTML = `<button class="s21-d" data-snd="hl"><span class="s21-ring hl">${P21.star}</span><b>À la une</b><i class="s21-chk">${P21.check}</i></button>`;
  snd.note = false; renderSendTop();
};
const _renderSendTop21p = renderSendTop;
renderSendTop = function () {
  _renderSendTop21p();
  const sh = $('#sheet .snd'); if (!sh) return;
  sh.querySelector('[data-snd="hl"]')?.classList.toggle('on', !!snd.hl);
  const ex = sh.querySelector('.snd-extra');
  if (snd.hl) {
    const hls = profCache.get(st.me)?.highlights || [];
    ex.insertAdjacentHTML('afterbegin', `<section class="s21-sec"><h5>À la une · où la ranger</h5><div class="snd-audp" data-noswipe>${hls.map(h => `<button class="snd-ap ${snd.hlId === h.id ? 'on' : ''}" data-hlp="${esc(h.id)}" style="--fc:#F5C04A">${esc(h.title)}</button>`).join('')}<button class="snd-ap ${!snd.hlId ? 'on' : ''}" data-hlp="" style="--fc:#F5C04A">＋ Nouveau</button></div>
      ${snd.hlId ? '' : `<input class="snd-in" id="snd-hlt" maxlength="24" placeholder="Nom (ex. Vacances 🌴)" value="${esc(snd.hlTitle || '')}">`}</section>`);
    if (!profCache.get(st.me)) loadProfile(st.me).then(() => $('#sheet .snd') && renderSendTop());
  }
  const dm = snd.ids.size + snd.chans.size, n = (snd.story ? 1 : 0) + (snd.hl ? 1 : 0) + (snd.post ? 1 : 0) + dm, go = sh.querySelector('.snd-go');
  const shared = snd.story || snd.hl || snd.post;
  go.disabled = !n; go.textContent = !n ? 'Choisis où envoyer' : !dm ? 'Partager' : shared ? `Partager et envoyer (${dm})` : `Envoyer${dm > 1 ? ` à ${dm} potes` : ''}`;
};
document.addEventListener('click', e => {
  const b = e.target.closest('#sheet .s21 [data-hlp]'); if (!b) return;
  e.stopImmediatePropagation(); snd.hlId = b.dataset.hlp || null; H(6); renderSendTop();
}, true);
document.addEventListener('input', e => { if (e.target.id === 'snd-hlt') snd.hlTitle = e.target.value; });
const _doSend21p = doSend;
doSend = async function () {
  if (!snd.hl) return _doSend21p();
  const go = $('#sheet .snd-go'); if (!go || go.disabled) return;
  go.disabled = true; go.textContent = 'Envoi…';
  try {
    const up = await edUpload();
    const r = await request('addHighlightFile', { fileId: up.id, stickers: edStickers(), highlightId: snd.hlId || undefined, title: snd.hlId ? undefined : (snd.hlTitle || 'À la une') });
    profCache.delete(st.me);
    snd.hl = false;
    if (snd.story || snd.post || snd.ids.size || snd.chans.size) { go.disabled = false; return _doSend21p().then(() => toast(`Ajoutée à « ${r.title} » ⭐ et envoyée ✨`)); }
    closeSheet(); closeEditor(); sndFor = null; H(16); toast(`Ajoutée à « ${r.title} » ⭐`);
    if (!$('#ptab').hidden) loadProfile(st.me).then(renderPTab);
  } catch (err) { toast(err.message, true); go.disabled = false; renderSendTop(); }
};
