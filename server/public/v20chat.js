'use strict';
// Parlotte 2.0 — partie 3 : les conversations et les stories
//  • appui long sur un message : l'arrière-plan se floute, le message se soulève, réactions au-dessus,
//    actions en dessous (avec l'heure exacte) ;
//  • glisser un message pour y répondre (vers la droite en privé, vers la gauche dans un serveur) ;
//  • toucher une bulle affiche son heure ; messages vocaux plus épais, façon Insta ;
//  • thèmes de conversation refaits (dégradés animés) ;
//  • stories : glisser vers le bas pour fermer, réactions rapides.

const M20 = {
  reply: svg('<path d="M10 8L4 13l6 5"/><path d="M4 13h10a6 6 0 016 6"/>', 20),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>', 20),
  pin: svg('<path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v6"/>', 20),
  thread: svg('<path d="M5 6h14M5 12h10M5 18h6"/>', 20),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>', 20),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 20),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 20),
  clock: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 15),
};
const QUICK20 = ['❤️', '😂', '😮', '😢', '🔥', '👍'];

// ================================================================ Appui long : message « soulevé »
document.body.insertAdjacentHTML('beforeend', '<div id="mfocus" hidden><div class="mf-back"></div><div class="mf-wrap"><div class="mf-react" data-noswipe></div><div class="mf-msg"></div><div class="mf-menu"></div></div></div>');
const fmtFull = iso => { const d = new Date(iso); return `${sameDay(iso, Date.now()) ? 'Aujourd\'hui' : sameDay(iso, Date.now() - 864e5) ? 'Hier' : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`; };
msgSheet = function (row) {
  const m = (st.msgs[st.view.channel] || []).find(x => x.id === row.dataset.id); if (!m) return;
  const tools = [...row.querySelectorAll('.tools [data-act]')].map(b => b.dataset.act);
  const LABEL = { reply: ['Répondre', M20.reply], thread: ['Créer un fil', M20.thread], pin: ['Épingler', M20.pin], copy: ['Copier', M20.copy], edit: ['Modifier', M20.edit], del: ['Supprimer', M20.trash] };
  const f = $('#mfocus'), mine = row.classList.contains('mine'), src = row.querySelector('.bcol') || row.querySelector('.body') || row;
  const r = src.getBoundingClientRect();
  const mine2 = (m.reactions && Object.entries(m.reactions).filter(([, w]) => w.includes(st.me)).map(([e]) => e)) || [];
  f.querySelector('.mf-react').innerHTML = tools.includes('react') ? QUICK20.map(q => `<button class="${mine2.includes(q) ? 'on' : ''}" data-mf-react="${q}" aria-label="Réagir ${q}">${q}</button>`).join('') + `<button class="mf-more" data-mf-react="+" aria-label="Plus d'emojis">${M20.plus}</button>` : '';
  const clone = src.cloneNode(true); clone.querySelectorAll('.tools,video').forEach(x => x.remove());
  clone.classList.add('mf-clone'); clone.style.width = r.width + 'px';
  const box = f.querySelector('.mf-msg'); box.innerHTML = ''; box.appendChild(clone);
  box.className = `mf-msg ${mine ? 'mine' : ''} ${row.classList.contains('b') ? 'b' : 'srv'}`;
  f.querySelector('.mf-menu').innerHTML = `<p class="mf-when">${M20.clock}${esc(fmtFull(m.timestamp))}${m.edited ? ' · modifié' : ''}</p>` + tools.filter(k => LABEL[k]).map(k => `<button class="${k === 'del' ? 'danger' : ''}" data-mf-act="${k}"><span>${LABEL[k][0]}</span>${LABEL[k][1]}</button>`).join('');
  f.dataset.mid = m.id; f.hidden = false; f.classList.remove('out'); f._at = Date.now();
  // place : là où était le message, sans sortir de l'écran
  const wrap = f.querySelector('.mf-wrap'); wrap.style.cssText = '';
  const wr = wrap.getBoundingClientRect(), top0 = r.top - 62, maxTop = innerHeight - wr.height - 16;
  const top = Math.max(16 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0), Math.min(top0, maxTop));
  wrap.style.top = top + 'px';
  wrap.style.left = mine ? '' : Math.max(8, Math.min(r.left - 4, innerWidth - wr.width - 8)) + 'px';
  wrap.style.right = mine ? Math.max(8, innerWidth - r.right - 4) + 'px' : '';
  wrap.classList.toggle('right', mine);
  void f.offsetWidth; f.classList.add('in'); H(14);
  row.classList.add('mf-src');
};
function closeFocus() {
  const f = $('#mfocus'); if (f.hidden) return;
  f.classList.remove('in'); f.classList.add('out');
  document.querySelectorAll('.mf-src').forEach(x => x.classList.remove('mf-src'));
  setTimeout(() => { f.hidden = true; f.classList.remove('out'); f.querySelector('.mf-msg').innerHTML = ''; }, 200);
}
$('#mfocus').addEventListener('click', e => {
  if (Date.now() - ($('#mfocus')._at || 0) < 550) return; // le doigt qui se relève après l'appui long
  const id = $('#mfocus').dataset.mid;
  const q = e.target.closest('[data-mf-react]');
  if (q) {
    const em = q.dataset.mfReact; closeFocus();
    if (em === '+') return setTimeout(() => openPicker(Math.max(8, innerWidth / 2 - 170), innerHeight * 0.3, x => act('react', { messageId: id, emoji: x })), 60);
    H(10); burstOn(id, em); return act('react', { messageId: id, emoji: em });
  }
  const a = e.target.closest('[data-mf-act]');
  if (a) {
    closeFocus(); const k = a.dataset.mfAct;
    if (k === 'reply') { H(8); return setReply(id); }
    const btn = document.querySelector(`.msg[data-id="${id}"] .tools [data-act="${k}"]`);
    return setTimeout(() => btn?.click(), k === 'del' ? 260 : 0);
  }
  if (!e.target.closest('.mf-msg')) closeFocus();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#mfocus').hidden) closeFocus(); });
function burstOn(id, em) {
  const row = document.querySelector(`.msg[data-id="${id}"]`); if (!row) return;
  const s = document.createElement('span'); s.className = 'react-burst'; s.textContent = em;
  (row.querySelector('.bcol') || row).appendChild(s); setTimeout(() => s.remove(), 900);
}

// ================================================================ Glisser pour répondre
(() => {
  let x0 = null, y0 = 0, row = null, dx = 0, mode = null, fired = false, dir = 1;
  const view = $('#view');
  view.addEventListener('touchstart', e => {
    x0 = null; if (e.touches.length !== 1) return;
    const r = e.target.closest('.msg[data-id]'); if (!r || r.classList.contains('sys') || r.classList.contains('bsys') || e.target.closest('.vwave,input,textarea,.poll,.game,[data-noswipe]')) return;
    if (e.touches[0].clientX < 34) return; // le bord gauche sert à sortir de la conversation
    row = r; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = null; fired = false;
    dir = typeof drawerOK === 'function' && drawerOK() ? -1 : 1; // serveur : vers la gauche (la droite ouvre les salons)
  }, { passive: true });
  view.addEventListener('touchmove', e => {
    if (x0 === null) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!mode) { if (Math.abs(mx) < 10 && Math.abs(my) < 10) return; mode = Math.abs(mx) > Math.abs(my) * 1.3 && Math.sign(mx) === dir ? 'h' : 'v'; if (mode === 'h') row.classList.add('swiping'); }
    if (mode !== 'h') return;
    dx = Math.max(0, Math.min(90, mx * dir)) ;
    row.style.transform = `translateX(${dx * dir * 0.85}px)`;
    row.style.setProperty('--sw', Math.min(1, dx / 60).toFixed(2));
    if (dx >= 60 && !fired) { fired = true; H(10); }
    if (dx < 60) fired = false;
  }, { passive: true });
  const end = () => {
    if (x0 === null) return; x0 = null;
    if (mode !== 'h') return;
    row.classList.remove('swiping'); row.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1)'; row.style.transform = '';
    const r = row; setTimeout(() => { r.style.transition = ''; r.style.removeProperty('--sw'); }, 260);
    if (fired) setReply(row.dataset.id);
  };
  view.addEventListener('touchend', end); view.addEventListener('touchcancel', end);
})();

// ================================================================ Toucher une bulle : son heure
$('#view').addEventListener('click', e => {
  const b = e.target.closest('.msg.b .bubble'); if (!b || e.target.closest('a,button,.spoiler')) return;
  const row = b.closest('.msg'), m = (st.msgs[st.view.channel] || []).find(x => x.id === row.dataset.id); if (!m) return;
  let w = row.querySelector('.b-when');
  if (!w) { b.insertAdjacentHTML('afterend', `<span class="b-when">${esc(time(m.timestamp))}</span>`); w = row.querySelector('.b-when'); }
  row.classList.toggle('show-time');
});

// ================================================================ Thèmes de conversation (refaits)
THEMES.length = 0;
THEMES.push(
  ['', 'Par défaut', 'var(--chat)', 'var(--coral)', 'var(--on-coral)'],
  ['night', 'Nuit étoilée', 'radial-gradient(1.5px 1.5px at 12% 18%,#fff 50%,transparent),radial-gradient(1px 1px at 72% 34%,#fffd 50%,transparent),radial-gradient(1.2px 1.2px at 40% 70%,#fffc 50%,transparent),radial-gradient(1px 1px at 85% 82%,#fffb 50%,transparent),radial-gradient(circle at 80% 0%,#3b2a7a 0,transparent 55%),linear-gradient(175deg,#070816 0%,#141038 55%,#25174d 100%)', '#8E6CFF', '#fff'],
  ['aurora', 'Aurore', 'linear-gradient(160deg,#04201f,#0b3b45,#1b2a5a,#3b1f5c,#0b3b45)', '#3FE0B5', '#062019'],
  ['sunset', 'Coucher de soleil', 'linear-gradient(170deg,#2a1036 0%,#6b1f45 40%,#c2453f 75%,#f29a4b 100%)', '#FF8A5B', '#2A0E06'],
  ['ocean', 'Océan', 'linear-gradient(175deg,#031428 0%,#0a3157 50%,#0f5e7a 85%,#1b8a9a 100%)', '#4FB7E6', '#04121F'],
  ['neon', 'Néon', 'radial-gradient(circle at 15% 15%,#ff2fa055,transparent 40%),radial-gradient(circle at 85% 85%,#21e6ff44,transparent 45%),linear-gradient(180deg,#0b0614,#120a22)', '#FF2FA0', '#fff'],
  ['candy', 'Bonbon', 'linear-gradient(160deg,#3a1240,#7a2d72,#d0568f,#ff9fb8)', '#FF7AB6', '#2A0718'],
  ['forest', 'Forêt', 'linear-gradient(175deg,#08140e 0%,#173424 50%,#2f5a37 100%)', '#5CCB8A', '#06140D'],
  ['lava', 'Lave', 'radial-gradient(circle at 50% 120%,#ff5a1f88,transparent 60%),linear-gradient(180deg,#120606,#3a0d0b)', '#FF6B4A', '#1A0E0A'],
  ['mint', 'Menthe', 'linear-gradient(170deg,#0c2522,#13443d,#2a8a7a)', '#6FE3D2', '#0F2B27'],
  ['peach', 'Pêche', 'linear-gradient(170deg,#ffe9dc,#ffd0c2,#ffc0d0)', '#FF7A59', '#fff'],
  ['sky', 'Ciel', 'linear-gradient(175deg,#dfe9ff,#c9d8ff,#e6d9ff)', '#5B7CFF', '#fff'],
  ['mono', 'Noir & blanc', 'linear-gradient(180deg,#0e0e10,#1c1c20)', '#F4F4F6', '#111'],
);
const LIGHT_TH = ['peach', 'sky'];
const _applyTheme20 = applyTheme;
applyTheme = function () {
  _applyTheme20();
  const c = st.view.channel && chanById(st.view.channel), k = c?.type === 'dm' ? c.theme || '' : '';
  const chat = $('#chat');
  [...chat.classList].filter(x => x.startsWith('th-')).forEach(x => chat.classList.remove(x));
  if (k) chat.classList.add('th-' + k);
  chat.classList.toggle('th-light', LIGHT_TH.includes(k));
};

// ================================================================ Stories : glisser vers le bas, réactions rapides
(() => {
  let y0 = null, dy = 0;
  const stg = $('#sview-stage');
  stg.addEventListener('touchstart', e => { if (e.target.closest('input,form,.stk')) return; y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  stg.addEventListener('touchmove', e => {
    if (y0 === null) return; dy = e.touches[0].clientY - y0;
    if (dy > 12) { stg.style.transform = `translateY(${dy * 0.8}px) scale(${1 - Math.min(dy, 400) / 1600})`; stg.style.borderRadius = '22px'; $('#sview').style.setProperty('--sv-fade', Math.max(0, 1 - dy / 400).toFixed(2)); if (!viewer.paused) { viewer._dragPause = true; setPaused(true); } }
  }, { passive: true });
  const end = () => {
    if (y0 === null) return; y0 = null;
    if (dy > 120) { H(8); closeViewerSoft(); setTimeout(() => { stg.style.transform = ''; stg.style.borderRadius = ''; $('#sview').style.removeProperty('--sv-fade'); }, 260); }
    else { stg.style.transition = 'transform .25s'; stg.style.transform = ''; stg.style.borderRadius = ''; $('#sview').style.removeProperty('--sv-fade'); setTimeout(() => (stg.style.transition = ''), 260); if (viewer._dragPause) { viewer._dragPause = false; setPaused(false); } }
  };
  stg.addEventListener('touchend', end); stg.addEventListener('touchcancel', end);
})();
const _renderViewerChrome20 = renderViewerChrome;
renderViewerChrome = function () {
  _renderViewerChrome20();
  const x = viewer.list[viewer.i]; if (!x || x.hl || x.author === st.me) return;
  $('#sview-foot').insertAdjacentHTML('afterbegin', `<div class="s-quick" data-noswipe>${QUICK20.map(q => `<button data-sq="${q}" aria-label="Réagir ${q}">${q}</button>`).join('')}</div>`);
};
$('#sview').addEventListener('click', async e => {
  const q = e.target.closest('[data-sq]'); if (!q) return;
  e.stopPropagation(); const x = viewer.list[viewer.i]; if (!x) return;
  H(12);
  for (let i = 0; i < 6; i++) { const s = document.createElement('span'); s.className = 'sq-fly'; s.textContent = q.dataset.sq; s.style.left = (30 + Math.random() * 40) + '%'; s.style.animationDelay = (i * 70) + 'ms'; $('#sview-stage').appendChild(s); setTimeout(() => s.remove(), 1600); }
  try { await request('replyStory', { storyId: x.id, text: q.dataset.sq }); toast('Réaction envoyée'); } catch (err) { toast(err.message, true); }
}, true);
