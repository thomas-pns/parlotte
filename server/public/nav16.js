'use strict';
// Parlotte 1.6 — navigation des serveurs :
//  • PC : dès qu'on est dans un serveur, la liste devient une fine colonne d'icônes (le côté « Discord »),
//    avec un « + » en bas pour créer ou rejoindre ; la grande liste revient avec le bouton du haut.
//  • Téléphone : le salon glisse sur le côté pour montrer les serveurs et les salons (tiroir), au doigt.
//  • Téléphone : appui long sur un message → feuille qui monte du bas avec les actions.
//  • Feuilles du bas réutilisables (openSheet / closeSheet), qu'on ferme en les glissant vers le bas.

const NI = {
  grid: svg('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>', 22),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 22),
  key: svg('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>', 20),
  spark: svg('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>', 20),
  reply: svg('<path d="M10 7L4 12l6 5M4 12h10a6 6 0 016 6"/>', 20),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>', 20),
  pin: svg('<path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v6"/>', 20),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>', 20),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 20),
  thread: svg('<path d="M5 6h14M5 12h10M5 18h6"/>', 20),
  smile: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01"/>', 20),
};
const inServer = () => space() === 'servers' && !!server();

// ---------------------------------------------------------------- Colonne des serveurs (fine) ou grande liste
const _renderServerCards16 = renderServerCards;
renderServerCards = function () {
  const slim = inServer();
  document.body.classList.toggle('srv-slim', slim);
  if (!slim) {
    _renderServerCards16();
    // Le bouton « Code » du haut disparaît : un seul « + » (créer ou rejoindre), et un bouton en bas de la liste
    $('#join-server')?.remove();
    const add = $('#add-server'); if (add) { add.id = 'srv-add-menu'; add.title = 'Créer ou rejoindre un serveur'; }
    $('#servers .srv-cards')?.insertAdjacentHTML('beforeend', `<button class="srv-add-card" data-srv-add>${NI.plus}<span><b>Ajouter un serveur</b><small>Crée le tien ou rejoins tes potes avec un code</small></span></button>`);
    return;
  }
  const cur = st.view.server;
  $('#servers').innerHTML = `<div class="slim-col">
    <button class="slim-btn home" data-slim-home data-tip="Tous les serveurs" aria-label="Tous les serveurs">${NI.grid}</button>
    <i class="slim-sep"></i>
    ${st.servers.map(s => { const u = unreadIn(s.channels), live = serverLive(s);
      return `<button class="slim-btn srv ${s.id === cur ? 'on' : ''} ${u && s.id !== cur ? 'unread' : ''}" data-srv="${s.id}" data-tip="${esc(s.name)}" aria-label="${esc(s.name)}">
        <i class="slim-pill"></i>${srvTileHTML(s)}${u && s.id !== cur ? `<span class="slim-badge">${u > 99 ? '99+' : u}</span>` : ''}${live ? '<span class="slim-live"></span>' : ''}</button>`; }).join('')}
    <button class="slim-btn add" data-srv-add data-tip="Ajouter un serveur" aria-label="Ajouter un serveur">${NI.plus}</button>
  </div>`;
};
// Menu « Ajouter un serveur » : créer ou rejoindre (feuille sur téléphone, petite carte sur PC)
function openAddServer() {
  openSheet(`<h3 class="sh-title">Ajouter un serveur</h3>
    <button class="sh-item big" data-add="create"><span class="sh-ico coral">${NI.spark}</span><span><b>Créer mon serveur</b><small>Pour ta bande, ta famille ou ton club</small></span></button>
    <button class="sh-item big" data-add="join"><span class="sh-ico">${NI.key}</span><span><b>Rejoindre avec un code</b><small>Le code qu'un pote t'a donné</small></span></button>`);
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-srv-add], #srv-add-menu')) { e.preventDefault(); e.stopPropagation(); return openAddServer(); }
  const a = e.target.closest('[data-add]');
  if (a) {
    closeSheet();
    if (a.dataset.add === 'create') ask('Créer un serveur', 'Donne-lui un nom. Tu pourras inviter tes amis avec un code.', 'Créer', name => act('createServer', { name }));
    else ask('Rejoindre un serveur', 'Colle le code d\'invitation qu\'un ami t\'a donné.', 'Rejoindre', code => act('joinServer', { code }));
  }
  if (e.target.closest('[data-slim-home]')) { closeDrawer(true); openChannel('@servers', null); }
}, true);
// Les anciens raccourcis (« Créer un serveur » / « J'ai un code » de l'écran vide) passent par le même menu
document.addEventListener('click', e => {
  const es = e.target.closest('[data-es]'); if (!es) return;
  e.stopImmediatePropagation();
  if (es.dataset.es === 'create') ask('Créer un serveur', 'Donne-lui un nom. Tu pourras inviter tes amis avec un code.', 'Créer', name => act('createServer', { name }));
  if (es.dataset.es === 'join') ask('Rejoindre un serveur', 'Colle le code d\'invitation qu\'un ami t\'a donné.', 'Rejoindre', code => act('joinServer', { code }));
}, true);

// Bulle de nom au survol des icônes (PC)
(() => {
  const tip = document.createElement('div'); tip.id = 'slim-tip'; tip.hidden = true; document.body.appendChild(tip);
  $('#servers').addEventListener('pointerover', e => {
    const b = e.target.closest('[data-tip]'); if (!b || e.pointerType === 'touch') return;
    const r = b.getBoundingClientRect(); tip.textContent = b.dataset.tip; tip.hidden = false;
    tip.style.top = (r.top + r.height / 2) + 'px'; tip.style.left = (r.right + 10) + 'px';
    tip.classList.remove('in'); void tip.offsetWidth; tip.classList.add('in');
  });
  $('#servers').addEventListener('pointerout', e => { if (!e.relatedTarget?.closest?.('[data-tip]')) tip.hidden = true; });
  $('#servers').addEventListener('click', () => { tip.hidden = true; });
})();

// ---------------------------------------------------------------- Feuilles du bas
document.body.insertAdjacentHTML('beforeend', `<div id="sheet" hidden><div class="sh-back"></div><div class="sh-panel" role="dialog" aria-modal="true"><i class="sh-grab"></i><div class="sh-body"></div></div></div>`);
let sheetClose = null;
function openSheet(html, onClose) {
  const sh = $('#sheet'); clearTimeout(sh._t);
  sh.querySelector('.sh-body').innerHTML = html; sh.hidden = false; sheetClose = onClose || null; sh._at = Date.now();
  sh.querySelector('.sh-panel').style.transform = '';
  requestAnimationFrame(() => requestAnimationFrame(() => sh.classList.add('open')));
}
function closeSheet() {
  const sh = $('#sheet'); if (sh.hidden) return;
  sh.classList.remove('open'); sh.querySelector('.sh-panel').style.transform = '';
  sh._t = setTimeout(() => { sh.hidden = true; sh.querySelector('.sh-body').innerHTML = ''; }, 260);
  const f = sheetClose; sheetClose = null; f?.();
}
// (le doigt qui se relève après un appui long ne doit pas refermer la feuille qu'il vient d'ouvrir)
$('#sheet').addEventListener('click', e => { if (Date.now() - ($('#sheet')._at || 0) < 500) { e.stopPropagation(); e.preventDefault(); } }, true);
$('#sheet .sh-back').addEventListener('click', closeSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeSheet(); });
// Glisser la feuille vers le bas pour la fermer
(() => {
  const p = $('#sheet .sh-panel'); let y0 = null, dy = 0, t0 = 0;
  p.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse' && !e.target.closest('.sh-grab')) return;
    if (p.scrollTop > 0 || e.target.closest('input,textarea')) return;
    y0 = e.clientY; dy = 0; t0 = Date.now();
  });
  p.addEventListener('pointermove', e => {
    if (y0 === null) return; dy = Math.max(0, e.clientY - y0);
    if (dy > 6) { p.classList.add('dragging'); p.style.transform = `translateY(${dy}px)`; }
  });
  const end = () => {
    if (y0 === null) return; y0 = null; p.classList.remove('dragging');
    const fast = dy > 40 && Date.now() - t0 < 250;
    if (dy > 110 || fast) closeSheet(); else p.style.transform = '';
  };
  p.addEventListener('pointerup', end); p.addEventListener('pointercancel', end);
})();

// ---------------------------------------------------------------- Téléphone : tiroir serveurs + salons
const drawerOK = () => mobile() && inServer() && document.body.classList.contains('has-chan');
function openDrawer() { if (!drawerOK()) return; document.body.classList.add('drawer-open'); $('#chat').style.transform = ''; }
function closeDrawer(instant) {
  const b = document.body; if (!b.classList.contains('drawer-open')) return;
  if (instant) { b.classList.add('drawer-instant'); setTimeout(() => b.classList.remove('drawer-instant'), 50); }
  b.classList.remove('drawer-open'); $('#chat').style.transform = '';
}
// Le bouton retour et le « ⋯ » ouvrent le tiroir (au lieu de cacher les salons du haut sans retour possible)
$('#menu').onclick = () => (drawerOK() ? openDrawer() : goBack());
$('#chan-chips').addEventListener('click', e => {
  if (!e.target.closest('#chips-more')) return;
  e.stopImmediatePropagation(); document.body.classList.remove('show-channels'); openDrawer();
}, true);
// Choisir un salon ferme le tiroir
const _openChannel16 = openChannel;
openChannel = function (...a) {
  const wasOpen = document.body.classList.contains('drawer-open'), prev = st.view.channel;
  const r = _openChannel16.apply(this, a);
  if (st.view.channel !== prev) { const v = $('#view'); v.classList.remove('chan-in'); void v.offsetWidth; v.classList.add('chan-in'); }
  document.body.classList.remove('show-channels');
  if (wasOpen) { if (!a[1] || !inServer()) closeDrawer(true); else closeDrawer(); }
  return r;
};
// Toucher la bande du salon visible referme le tiroir
$('#chat').addEventListener('click', e => {
  if (!document.body.classList.contains('drawer-open')) return;
  e.preventDefault(); e.stopPropagation(); closeDrawer();
}, true);
// Glisser au doigt : de gauche à droite pour ouvrir, de droite à gauche pour fermer
(() => {
  let x0 = null, y0 = 0, dx = 0, mode = null, open0 = false;
  const W = () => window.innerWidth - 56;
  document.addEventListener('touchstart', e => {
    if (!drawerOK() || e.touches.length !== 1 || !$('#sheet').hidden || document.body.classList.contains('story-open')) return;
    if (e.target.closest('#chan-chips, .sstage, input, textarea, .vwave, [data-noswipe], dialog')) return;
    x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null;
    open0 = document.body.classList.contains('drawer-open');
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (x0 === null) return;
    const t = e.touches[0], mx = t.clientX - x0, my = t.clientY - y0;
    if (!mode) {
      if (Math.abs(mx) < 10 && Math.abs(my) < 10) return;
      mode = Math.abs(mx) > Math.abs(my) * 1.3 && (open0 ? mx < 0 : mx > 0) ? 'h' : 'v';
      if (mode === 'h') document.body.classList.add('drawer-drag');
    }
    if (mode !== 'h') return;
    dx = mx; const pos = Math.min(W(), Math.max(0, (open0 ? W() : 0) + dx));
    $('#chat').style.transform = `translateX(${pos}px)`;
    document.body.style.setProperty('--drawer-p', (pos / W()).toFixed(3));
  }, { passive: true });
  const end = () => {
    if (x0 === null) return; x0 = null;
    document.body.classList.remove('drawer-drag'); document.body.style.removeProperty('--drawer-p');
    if (mode !== 'h') return;
    const pos = (open0 ? W() : 0) + dx; $('#chat').style.transform = '';
    if (pos > W() * (open0 ? 0.7 : 0.3)) openDrawer(); else closeDrawer();
  };
  document.addEventListener('touchend', end); document.addEventListener('touchcancel', end);
})();
window.addEventListener('resize', () => { if (!mobile()) closeDrawer(true); });

// ---------------------------------------------------------------- Téléphone : appui long sur un message → actions
const QUICK = ['❤️', '😂', '👍', '😮', '😢', '🔥'];
(() => {
  let t = null, x0 = 0, y0 = 0, row = null, pid = null;
  const cancel = e => { if (e && e.pointerId !== pid) return; clearTimeout(t); t = null; row?.classList.remove('pressing'); row = null; pid = null; };
  $('#view').addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    const r = e.target.closest('.msg[data-id]'); if (!r || r.classList.contains('sys') || e.target.closest('a,button,video,audio,.vnote,input')) return;
    row = r; x0 = e.clientX; y0 = e.clientY; pid = e.pointerId; r.classList.add('pressing');
    t = setTimeout(() => { const rr = row; cancel(); if (rr) { navigator.vibrate?.(12); msgSheet(rr); } }, 430);
  });
  $('#view').addEventListener('pointermove', e => { if (t && e.pointerId === pid && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(e); });
  ['pointerup', 'pointercancel'].forEach(k => $('#view').addEventListener(k, cancel));
  let st0 = 0; $('#view').addEventListener('pointerdown', () => { st0 = $('#view').scrollTop; }, true);
  $('#view').addEventListener('scroll', () => { if (t && Math.abs($('#view').scrollTop - st0) > 12) cancel(); }, { passive: true });
  $('#view').addEventListener('contextmenu', e => { if (matchMedia('(pointer:coarse)').matches && e.target.closest('.msg')) e.preventDefault(); });
})();
function msgSheet(row) {
  const m = (st.msgs[st.view.channel] || []).find(x => x.id === row.dataset.id); if (!m) return;
  const tools = [...row.querySelectorAll('.tools [data-act]')].map(b => b.dataset.act);
  const LABEL = { reply: ['Répondre', NI.reply], thread: ['Créer un fil', NI.thread], pin: ['Épingler', NI.pin], copy: ['Copier le texte', NI.copy], edit: ['Modifier', NI.edit], del: ['Supprimer', NI.trash] };
  const u = user(m.author_id);
  openSheet(`<div class="sh-msg">${avatar(u)}<div><b>${esc(u.name)}</b><p>${esc((m.content || previewOf(m).x || '').slice(0, 140))}</p></div></div>
    ${tools.includes('react') ? `<div class="sh-quick">${QUICK.map(q => `<button data-quick="${q}" aria-label="Réagir ${q}">${q}</button>`).join('')}<button data-quick="+" aria-label="Plus d'emojis">${NI.smile}</button></div>` : ''}
    <div class="sh-list">${tools.filter(k => LABEL[k]).map(k => `<button class="sh-item ${k === 'del' ? 'danger' : ''}" data-msg-act="${k}"><span class="sh-ico">${LABEL[k][1]}</span><b>${LABEL[k][0]}</b></button>`).join('')}</div>`);
  const body = $('#sheet .sh-body');
  body.onclick = e => {
    const q = e.target.closest('[data-quick]');
    if (q) { closeSheet(); if (q.dataset.quick === '+') return setTimeout(() => openPicker(Math.max(8, innerWidth / 2 - 170), innerHeight * 0.3, em => act('react', { messageId: m.id, emoji: em })), 50); return act('react', { messageId: m.id, emoji: q.dataset.quick }); }
    const a = e.target.closest('[data-msg-act]'); if (!a) return;
    closeSheet();
    const btn = document.querySelector(`.msg[data-id="${m.id}"] .tools [data-act="${a.dataset.msgAct}"]`);
    setTimeout(() => btn?.click(), a.dataset.msgAct === 'del' ? 280 : 0);
  };
}
