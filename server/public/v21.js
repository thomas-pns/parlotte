'use strict';
// Parlotte 2.1 — refonte de l'interface (partie 1)
//  • fiche contact (téléphone) qui monte à mi-hauteur, se tire en grand, avec thème, photos, épinglés,
//    serveurs en commun, recherche dans la conversation et « Voir le profil » ;
//  • appui long : menu toujours dans l'écran, « + » = toute la palette d'emojis ; PC : clic droit ;
//  • PC : l'avatar ouvre ton profil (clic droit = statut) ;
//  • glisser sur la barre du bas = changer d'onglet, de partout ;
//  • 5 thèmes avec de vrais décors animés, qui teintent aussi l'en-tête et la barre d'écriture.
window.PARLOTTE_VERSION = '2.1.0';
const I21 = {
  search: svg('<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>', 22),
  phone: svg('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>', 22),
  video: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/>', 22),
  bell: svg('<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>', 22),
  pin: svg('<path d="M9 4h6l-1 6 4 4H6l4-4zM12 14v6"/>', 22),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', 22),
  lock: svg('<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>', 18),
  chev: svg('<path d="M9 5l7 7-7 7"/>', 18),
  kb: svg('<rect x="2.5" y="6" width="19" height="12" rx="3"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>', 20),
};

// ================================================================ Fiche contact (téléphone) : #members devient une feuille
document.body.insertAdjacentHTML('beforeend', '<div id="contact-back" hidden></div>');
function openContact() {
  const c = channel(); if (!c || c.type !== 'dm') return;
  renderMembers(); decorateContact();
  const m = $('#members'); m.scrollTop = 0; m.style.transform = '';
  document.body.classList.add('contact-open'); document.body.classList.remove('contact-full');
  $('#contact-back').hidden = false; H(8);
  m.classList.remove('ct-in'); void m.offsetWidth; m.classList.add('ct-in');
}
function closeContact() {
  if (!document.body.classList.contains('contact-open')) return;
  const m = $('#members'); m.classList.add('ct-out');
  setTimeout(() => { document.body.classList.remove('contact-open', 'contact-full'); m.classList.remove('ct-out', 'ct-in'); m.style.transform = ''; $('#contact-back').hidden = true; }, 230);
}
$('#contact-back').addEventListener('click', closeContact);
// on ajoute en haut : poignée, actions rapides, « Voir le profil »
function decorateContact() {
  const c = channel(), box = $('#members .dm-panel'); if (!box || !c || box.querySelector('.ct-grab')) return;
  box.insertAdjacentHTML('afterbegin', '<div class="ct-grab" aria-hidden="true"><i></i></div>');
  const muted = typeof mutedHere === 'function' && mutedHere(c);
  const acts = `<div class="ct-acts">
      ${c.group ? '' : `<button data-ct="profile">${I21.user}<span>Profil</span></button>`}
      <button data-ct="call">${I21.phone}<span>Appel</span></button><button data-ct="video">${I21.video}<span>Vidéo</span></button>
      <button data-ct="search">${I21.search}<span>Rechercher</span></button>
      <button data-ct="mute" class="${muted ? 'on' : ''}">${I21.bell}<span>${muted ? 'En sourdine' : 'Sourdine'}</span></button>
      <button data-ct="pins">${I21.pin}<span>Épinglés</span></button></div>`;
  const anchor = box.querySelector('h3') || box.firstElementChild;
  (box.querySelector('.dp-acts') || anchor).insertAdjacentHTML('afterend', acts);
  box.querySelector('.dp-acts')?.remove();
  if (!c.group) {
    const o = dmOther(c), d = profCache.get(o.id), locked = d?.profileHidden;
    box.querySelector('.ct-acts').insertAdjacentHTML('afterend', `<button class="ct-profile ${locked ? 'locked' : ''}" data-ct="profile">${avatarNU(o)}<span><b>${locked ? 'Profil privé' : 'Voir le profil'}</b><small>${locked ? `${esc(o.name)} montre son profil à certains potes` : d?.postCount != null ? `${d.postCount} publication${d.postCount > 1 ? 's' : ''} · ${d.highlights?.length || 0} à la une` : 'Publications, stories, à la une'}</small></span>${locked ? I21.lock : I21.chev}</button>`);
    if (!d) loadProfile(o.id).then(() => document.body.classList.contains('contact-open') && channel()?.id === c.id && (renderMembers(), decorateContact()));
  }
}
const _renderMembers21 = renderMembers;
renderMembers = function (...a) { _renderMembers21.apply(this, a); if (document.body.classList.contains('contact-open') && !$('#members .ct-grab')) decorateContact(); };
$('#members').addEventListener('click', e => {
  const b = e.target.closest('[data-ct]'); if (!b) return;
  e.stopPropagation(); const k = b.dataset.ct, c = channel(); H(8);
  if (k === 'profile') { const o = dmOther(c); if (b.classList.contains('locked')) return toast('Profil privé 🔒', true); return openPSheet(o.id); }
  if (k === 'call') { closeContact(); return joinVoice(c.id); }
  if (k === 'video') { closeContact(); return $('#vcall').click(); }
  if (k === 'search') return openConvSearch();
  if (k === 'mute') return $('#mute-btn')?.click();
  if (k === 'pins') { closeContact(); return setTimeout(() => $('#pins').click(), 240); }
}, true);
// toucher le nom / l'avatar en haut d'une conversation privée (téléphone) : la fiche
document.addEventListener('click', e => {
  if (!mobile() || !e.target.closest('#chan-av,#chan-title')) return;
  const c = channel(); if (c?.type !== 'dm') return;
  e.stopImmediatePropagation(); openContact();
}, true);
// mi-hauteur ↔ grand ↔ fermé, au doigt
(() => {
  let y0 = null, dy = 0, full0 = false, top0 = 0;
  const m = $('#members');
  m.addEventListener('touchstart', e => {
    if (!document.body.classList.contains('contact-open')) return;
    full0 = document.body.classList.contains('contact-full'); top0 = m.scrollTop;
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  m.addEventListener('touchmove', e => {
    if (y0 === null) return; dy = e.touches[0].clientY - y0;
    if (top0 > 0 || m.scrollTop > 0) { if (dy < 0 || m.scrollTop > 0) { y0 = null; } return; }
    if (!full0 && dy < 0) m.style.transform = `translateY(${Math.max(dy, -200) * 0.35}px)`;
    else if (dy > 0) m.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  m.addEventListener('touchend', () => {
    if (y0 === null) return; y0 = null;
    m.style.transition = 'transform .3s cubic-bezier(.2,.9,.3,1), height .35s cubic-bezier(.2,.9,.3,1)'; m.style.transform = '';
    setTimeout(() => (m.style.transition = ''), 360);
    if (!full0 && dy < -50) { document.body.classList.add('contact-full'); H(8); }
    else if (full0 && dy > 90) { document.body.classList.remove('contact-full'); H(6); }
    else if (!full0 && dy > 100) closeContact();
  });
})();
const _openChannel21 = openChannel;
openChannel = function (...a) { closeContact(); return _openChannel21.apply(this, a); };

// ================================================================ Rechercher dans la conversation
function openConvSearch() {
  const c = channel(); if (!c) return;
  closeContact();
  setTimeout(() => {
    openSheet(`<div class="csrch"><div class="fsr-box"><span>${I21.search}</span><input id="cs-q" placeholder="Rechercher dans la conversation" autocomplete="off" enterkeyhint="search"></div><div id="cs-res" class="cs-res"><p class="small pad">Un mot, un nom…</p></div></div>`);
    $('#sheet').classList.add('sh-tall'); setTimeout(() => $('#cs-q')?.focus(), 250);
    let t = null;
    $('#cs-q').oninput = () => { clearTimeout(t); t = setTimeout(() => runConvSearch(c), 300); };
  }, 240);
}
let convSearching = 0;
const _showResults21 = showResults;
showResults = function (res) { if (convSearching) return; return _showResults21(res); };
async function runConvSearch(c) {
  const q = $('#cs-q')?.value.trim(), box = $('#cs-res'); if (!box) return;
  if (!q) { box.innerHTML = '<p class="small pad">Un mot, un nom…</p>'; return; }
  try {
    convSearching++; let r; try { r = await request('search', { scope: c.type === 'dm' ? '@me' : c.server_id, query: q }); } finally { setTimeout(() => convSearching--, 50); }
    const hits = (r.messages || []).map(x => x[0]).filter(m => m.channel_id === c.id);
    box.innerHTML = hits.length ? hits.map(m => { const u = user(m.author_id);
      return `<button class="cs-hit" data-cs-mid="${esc(m.id)}">${avatarNU(u)}<span><b>${esc(u.name)}</b> <small>${esc(dayLabel(m.timestamp))} ${esc(time(m.timestamp))}</small><p>${typeof S !== 'undefined' && S.highlight ? S.highlight(m.content, r.query?.content || q) : esc(m.content)}</p></span></button>`; }).join('')
      : '<p class="small pad">Aucun message trouvé.</p>';
  } catch (err) { box.innerHTML = `<p class="small pad">${esc(err.message)}</p>`; }
}
document.addEventListener('click', async e => {
  const h = e.target.closest('[data-cs-mid]'); if (!h) return;
  closeSheet(); const id = h.dataset.csMid, cid = st.view.channel;
  for (let i = 0; i < 12 && !document.querySelector(`.msg[data-id="${id}"]`) && st.more[cid]; i++) { await loadHistory(cid, st.msgs[cid][0]?.timestamp); await new Promise(r => setTimeout(r, 250)); }
  const el = document.querySelector(`.msg[data-id="${id}"]`);
  if (!el) return toast('Message trop ancien', true);
  el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
});

// ================================================================ Appui long : toujours dans l'écran ; « + » = tous les emojis ; PC : clic droit
const _msgSheet21 = msgSheet;
msgSheet = function (row) {
  _msgSheet21(row);
  const f = $('#mfocus'); if (f.hidden) return;
  requestAnimationFrame(() => {
    const wrap = f.querySelector('.mf-wrap'), r = wrap.getBoundingClientRect(), pad = 12, maxH = innerHeight - pad * 2;
    if (r.height > maxH) { const msg = f.querySelector('.mf-msg'); msg.style.maxHeight = Math.max(80, maxH - (r.height - msg.getBoundingClientRect().height)) + 'px'; }
    const r2 = wrap.getBoundingClientRect();
    let top = parseFloat(wrap.style.top) || r2.top;
    if (r2.bottom > innerHeight - pad) top -= r2.bottom - (innerHeight - pad);
    if (top < pad) top = pad;
    wrap.style.top = top + 'px';
    if (r2.right > innerWidth - 8) { wrap.style.left = ''; wrap.style.right = '8px'; }
  });
};
$('#mfocus').addEventListener('click', e => {
  const q = e.target.closest('[data-mf-react="+"]'); if (!q) return;
  e.stopImmediatePropagation(); const id = $('#mfocus').dataset.mid; closeFocus();
  setTimeout(() => openEmojiSheet(em => { H(10); burstOn(id, em); act('react', { messageId: id, emoji: em }); }), 120);
}, true);
// PC : clic droit sur un message
$('#view').addEventListener('contextmenu', e => {
  if (matchMedia('(pointer:coarse)').matches) return;
  const row = e.target.closest('.msg[data-id]'); if (!row || row.classList.contains('sys') || row.classList.contains('bsys') || e.target.closest('a,img,video,input,textarea')) return;
  e.preventDefault(); msgSheet(row);
});
// Toute la palette d'emojis, rangée par catégories (comme sur Insta)
const range = (a, b, skip = []) => { const o = []; for (let i = a; i <= b; i++) if (!skip.includes(i)) o.push(String.fromCodePoint(i)); return o; };
const EMO_CATS = [
  ['😀', 'Smileys', [...range(0x1F600, 0x1F64F), ...range(0x1F910, 0x1F92F), ...range(0x1F970, 0x1F97A), ...'🫠🫢🫣🫡🫥🤤🤥🤧🤨🤩🤪🤫🤬🤭🤮🤯'.match(/./gu)]],
  ['👋', 'Gestes', [...'👋🤚🖐️✋🖖👌🤌🤏✌️🤞🫰🤟🤘🤙👈👉👆🖕👇☝️🫵👍👎✊👊🤛🤜👏🙌🫶👐🤲🤝🙏✍️💅🤳💪🦾🦵🦶👂🦻👃🧠🫀🫁🦷🦴👀👁️👅👄🫦👶🧒👦👧🧑👱👨🧔👩🧓👴👵🙍🙎🙅🙆💁🙋🧏🙇🤦🤷💃🕺👯🧖🧗🤸⛹️🏋️🚴🏊🤽🧘'.match(/\p{Extended_Pictographic}️?/gu)]],
  ['❤️', 'Cœurs', [...'❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟♥️🩷🩵🩶❤️‍🔥❤️‍🩹💋💌'.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?)*/gu)]],
  ['🐶', 'Animaux', [...range(0x1F400, 0x1F43F), ...range(0x1F980, 0x1F9AE), ...'🌸🌹🌺🌻🌼🌷🌱🌲🌳🌴🌵🌿☘️🍀🍁🍂🍃🍄🌾💐'.match(/\p{Extended_Pictographic}️?/gu)]],
  ['🍕', 'Nourriture', [...range(0x1F345, 0x1F37F), ...range(0x1F950, 0x1F96F), ...'🧀🧁🧃🧄🧅🧆🧇🧈🧉🧊🫐🫑🫒🫓🫔🫕🫖'.match(/./gu)]],
  ['⚽', 'Activités', [...'⚽🏀🏈⚾🥎🎾🏐🏉🥏🎱🪀🏓🏸🏒🏑🥍🏏🪃🥅⛳🪁🏹🎣🤿🥊🥋🎽🛹🛼🛷⛸️🥌🎿⛷️🏂🪂🏆🥇🥈🥉🏅🎖️🎗️🎫🎟️🎪🎭🩰🎨🎬🎤🎧🎼🎹🥁🪘🎷🎺🪗🎸🪕🎻🎲♟️🎯🎳🎮🕹️🎰🧩'.match(/\p{Extended_Pictographic}️?/gu)]],
  ['✈️', 'Voyages', [...range(0x1F680, 0x1F6A4), ...'🏠🏡🏢🏰🗼🗽⛪🕌🛕⛩️🗾🏖️🏝️🏜️🌋⛰️🏔️🗻🏕️🌅🌄🌠🎇🎆🌇🌆🏙️🌃🌌🌉🌁☀️🌤️⛅🌧️⛈️🌩️❄️☃️⛄🌈🌊🌙⭐🌟✨⚡🔥💧'.match(/\p{Extended_Pictographic}️?/gu)]],
  ['💡', 'Objets', [...range(0x1F4A1, 0x1F4FF, [0x1F4A2, 0x1F4A5, 0x1F4AB, 0x1F4AC, 0x1F4AD]), ...'⌚📱💻⌨️🖥️🖨️🖱️💽💾💿📀📷📸📹🎥📞☎️📺📻🎙️⏰⏳🔋🔌💡🔦🕯️🧯💸💵💰💳💎⚖️🧰🔧🔨⚒️🛠️🔩⚙️🧲🔫💣🧨🔪🗡️⚔️🛡️🔮🧿💈⚗️🔭🔬💊💉🩸🧬🦠🧹🧺🧻🧼🧽🛎️🔑🗝️🚪🪑🛋️🛏️🧸🎁🎈🎏🎀🪄🎊🎉'.match(/\p{Extended_Pictographic}️?/gu)]],
  ['💯', 'Symboles', [...'💯💢💥💫💦💨🕳️💬💭💤✅☑️✔️❌❎➕➖➗✖️♾️‼️⁉️❓❔❕❗〰️💲⚠️🚸⛔🚫🔞☢️☣️⬆️↗️➡️↘️⬇️↙️⬅️↖️↕️↔️🔄🔃🎵🎶🔔🔕📣📢🆗🆙🆒🆕🆓🔟🔢#️⃣*️⃣🔴🟠🟡🟢🔵🟣🟤⚫⚪🟥🟧🟨🟩🟦🟪🟫⬛⬜♈♉♊♋♌♍♎♏♐♑♒♓☮️✝️☪️🕉️☯️☸️✡️🔯'.match(/[\p{Extended_Pictographic}#*]️?⃣?/gu)]],
  ['🏳️', 'Drapeaux', [...'🏳️🏴🏁🚩🏳️‍🌈🏳️‍⚧️🏴‍☠️'.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?)*/gu), ...['FR', 'BE', 'CH', 'CA', 'US', 'GB', 'ES', 'IT', 'DE', 'PT', 'MA', 'DZ', 'TN', 'SN', 'CI', 'CM', 'JP', 'KR', 'CN', 'BR', 'AR', 'MX', 'NL', 'IE', 'GR', 'TR', 'UA', 'PL', 'SE', 'NO'].map(c => String.fromCodePoint(...[...c].map(ch => 0x1F1E6 + ch.charCodeAt(0) - 65)))]],
];
const RECENT_KEY = 'parlotte-emo-recent';
const recentEmo = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };
function openEmojiSheet(cb) {
  const rec = recentEmo();
  openSheet(`<div class="emo"><div class="emo-tabs" data-noswipe>${rec.length ? '<button data-emo-go="rec">🕘</button>' : ''}${EMO_CATS.map(([ic], i) => `<button data-emo-go="${i}">${ic}</button>`).join('')}
      <button class="emo-kb" data-emo-kb aria-label="Clavier emoji du téléphone">${I21.kb}</button></div>
    <input id="emo-kb-in" class="emo-kb-in" aria-label="Clavier emoji" autocomplete="off" inputmode="text">
    <div class="emo-scroll">${rec.length ? `<h5 id="emo-rec">Récents</h5><div class="emo-grid">${rec.map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>` : ''}
    ${EMO_CATS.map(([, l, list], i) => `<h5 id="emo-c${i}">${l}</h5><div class="emo-grid">${[...new Set(list)].map(e => `<button data-emo="${e}">${e}</button>`).join('')}</div>`).join('')}</div></div>`);
  $('#sheet').classList.add('sh-tall');
  const pick = em => { try { localStorage.setItem(RECENT_KEY, JSON.stringify([em, ...recentEmo().filter(x => x !== em)].slice(0, 24))); } catch {} closeSheet(); cb(em); };
  const body = $('#sheet .sh-body');
  body.onclick = e => {
    const b = e.target.closest('[data-emo]'); if (b) return pick(b.dataset.emo);
    const g = e.target.closest('[data-emo-go]'); if (g) { const t = $(g.dataset.emoGo === 'rec' ? '#emo-rec' : '#emo-c' + g.dataset.emoGo); t?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (e.target.closest('[data-emo-kb]')) { const i = $('#emo-kb-in'); i.value = ''; i.focus(); toast('Touche 🌐 ou 😀 sur ton clavier pour les emojis'); }
  };
  $('#emo-kb-in').oninput = e => { const m = e.target.value.match(/\p{Extended_Pictographic}(️|‍\p{Extended_Pictographic}️?|[\u{1F3FB}-\u{1F3FF}])*/u); if (m) pick(m[0]); };
}

// ================================================================ PC : l'avatar ouvre ton profil, clic droit = statut
$('#me').addEventListener('click', e => {
  if (mobile() || !e.target.closest('#open-status')) return;
  e.stopImmediatePropagation(); e.preventDefault();
  $('#status-menu').hidden = true;
  if (!$('#ptab').hidden) return closePTab();
  openPTab(); renderNav();
}, true);
$('#me').addEventListener('contextmenu', e => { e.preventDefault(); openStatusMenu(); });
// téléphone : appui long sur l'onglet Profil = statut
(() => {
  let t = null;
  $('#rail').addEventListener('pointerdown', e => { if (!e.target.closest('#me') || !mobile()) return; t = setTimeout(() => { t = null; H(12); openStatusMenu(); const m = $('#status-menu'); m.style.left = ''; m.style.right = '8px'; }, 480); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => $('#rail').addEventListener(k, () => { if (t) { clearTimeout(t); t = null; } }));
  $('#rail').addEventListener('click', e => { if (!$('#status-menu').hidden && e.target.closest('#me') && mobile()) { e.stopImmediatePropagation(); } }, true);
})();
// PC : les onglets referment ton profil
$('#rail').addEventListener('click', e => { if (!mobile() && e.target.closest('[data-space]')) closePTab(); }, true);

// ================================================================ Glisser sur la barre du bas = changer d'onglet (de partout)
(() => {
  let x0 = null, y0 = 0, done = false;
  const rail = $('#rail');
  rail.addEventListener('touchstart', e => { if (!mobile() || e.touches.length !== 1) { x0 = null; return; } x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; done = false; }, { passive: true });
  rail.addEventListener('touchmove', e => {
    if (x0 === null || done) return;
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      done = true; const from = curTab(), to = Math.max(0, Math.min(3, from + (dx < 0 ? 1 : -1)));
      if (to !== from) { H(8); goTab(to, to > from ? 'right' : 'left'); }
    }
  }, { passive: true });
  // un appui sur la barre ne doit pas déclencher le bouton après un glissé
  rail.addEventListener('click', e => { if (done && !_railClick.on) { e.stopImmediatePropagation(); e.preventDefault(); done = false; } }, true);
  rail.addEventListener('touchend', () => setTimeout(() => (done = false), 400));
})();

// ================================================================ En-tête d'une conversation privée : épuré
const _renderMain21 = renderMain;
renderMain = function (...a) {
  _renderMain21.apply(this, a);
  const c = channel(), dmc = c?.type === 'dm';
  document.body.classList.toggle('in-dm', !!dmc);
  applyDecor();
};

// ================================================================ Thèmes : 5 décors animés
const DECOR = {
  night: { label: 'Nuit étoilée', me: '#8E6CFF', on: '#fff', tint: '#0b0a24', prev: 'radial-gradient(circle at 75% 22%,#f6f1d0 0 6%,transparent 7%),radial-gradient(1px 1px at 20% 30%,#fff 50%,transparent),radial-gradient(1px 1px at 60% 60%,#fff 50%,transparent),linear-gradient(175deg,#050616,#14103a 60%,#2a1a55)' },
  aurora: { label: 'Aurore', me: '#3FE0B5', on: '#062019', tint: '#06141c', prev: 'radial-gradient(ellipse at 30% 30%,#3fe0b588,transparent 60%),radial-gradient(ellipse at 70% 50%,#8e6cff88,transparent 60%),linear-gradient(180deg,#03101a,#0b1d2e)' },
  ocean: { label: 'Océan', me: '#4FB7E6', on: '#04121F', tint: '#05213a', prev: 'linear-gradient(180deg,#0d4f7a 0%,#0a3157 55%,#06213c 100%)' },
  sunset: { label: 'Coucher de soleil', me: '#FF7A59', on: '#2A0E06', tint: '#2a1030', prev: 'radial-gradient(circle at 50% 62%,#ffd27a 0 10%,#ff8a5b 11%,transparent 30%),linear-gradient(180deg,#2a1036,#7a2a52 45%,#e0603f 75%,#f6a65a)' },
  synth: { label: 'Synthwave', me: '#FF2FA0', on: '#fff', tint: '#160a2a', prev: 'linear-gradient(180deg,#14072b 0%,#3a0d55 50%,#ff2fa0 51%,#1b0838 52%,#0b0418)' },
};
// la liste du sélecteur : par défaut + nos 5 décors (les anciens thèmes restent lisibles)
THEMES.length = 0;
THEMES.push(['', 'Par défaut', 'var(--chat)', 'var(--coral)', 'var(--on-coral)'], ...Object.entries(DECOR).map(([k, d]) => [k, d.label, d.prev, d.me, d.on]));
function starField(n) { const W = Math.max(innerWidth, 400), Hh = Math.max(innerHeight, 700); let s = ''; for (let i = 0; i < n; i++) s += `${Math.round(Math.random() * W)}px ${Math.round(Math.random() * Hh)}px #fff${i % 3 ? 'c' : ''},`; return s.slice(0, -1); }
const DECOR_HTML = {
  night: () => `<div class="dn-sky"></div><i class="dn-moon"></i><i class="dn-stars s1" style="box-shadow:${starField(140)}"></i><i class="dn-stars s2" style="box-shadow:${starField(70)}"></i><i class="dn-stars s3" style="box-shadow:${starField(26)}"></i><i class="dn-shoot a"></i><i class="dn-shoot b"></i><i class="dn-shoot c"></i>`,
  aurora: () => '<div class="da-base"></div><i class="da-b b1"></i><i class="da-b b2"></i><i class="da-b b3"></i><i class="da-b b4"></i><div class="da-grain"></div>',
  ocean: () => `<div class="do-sky"></div><i class="do-ray r1"></i><i class="do-ray r2"></i><i class="do-ray r3"></i>${[1, 2, 3].map(i => `<svg class="do-wave w${i}" viewBox="0 0 1200 120" preserveAspectRatio="none"><path d="M0 60 Q 150 ${20 + i * 8} 300 60 T 600 60 T 900 60 T 1200 60 V120 H0z"/></svg>`).join('')}${[1, 2, 3, 4, 5, 6].map(i => `<i class="do-bub" style="left:${10 + i * 13}%;animation-delay:${i * 1.7}s;--s:${4 + (i % 3) * 3}px"></i>`).join('')}`,
  sunset: () => '<div class="ds-sky"></div><i class="ds-sun"></i><i class="ds-cloud c1"></i><i class="ds-cloud c2"></i><svg class="ds-mtn m1" viewBox="0 0 1200 300" preserveAspectRatio="none"><path d="M0 300 L0 180 L140 90 L260 170 L400 60 L560 190 L700 110 L860 200 L1000 80 L1200 190 L1200 300z"/></svg><svg class="ds-mtn m2" viewBox="0 0 1200 300" preserveAspectRatio="none"><path d="M0 300 L0 230 L180 150 L330 230 L520 140 L690 240 L880 160 L1050 240 L1200 170 L1200 300z"/></svg>',
  synth: () => '<div class="dy-sky"></div><i class="dy-sun"></i><div class="dy-grid"><i></i></div><i class="dy-glow"></i>',
};
function applyDecor() {
  const chat = $('#chat'), c = st.view.channel && chanById(st.view.channel), k = c?.type === 'dm' ? c.theme || '' : '';
  const d = DECOR[k];
  let layer = $('#th-layer');
  chat.classList.toggle('decor', !!d);
  [...chat.classList].filter(x => x.startsWith('dk-')).forEach(x => chat.classList.remove(x));
  if (!d) { layer?.remove(); return; }
  chat.classList.add('dk-' + k); chat.style.setProperty('--th-tint', d.tint);
  if (!layer || layer.dataset.k !== k) {
    layer?.remove();
    chat.insertAdjacentHTML('afterbegin', `<div id="th-layer" class="dk-${k}" data-k="${k}" aria-hidden="true">${DECOR_HTML[k]()}</div>`);
  }
}
const _applyTheme21 = applyTheme;
applyTheme = function () { _applyTheme21(); applyDecor(); };
// pauses les animations quand l'appli n'est pas visible (batterie)
document.addEventListener('visibilitychange', () => document.body.classList.toggle('bg-paused', document.visibilityState !== 'visible'));

// ================================================================ Glisser depuis le bord gauche pour sortir d'une conversation
(() => {
  let x0 = null, y0 = 0, dx = 0, mode = null, t0 = 0;
  const chat = $('#chat');
  const ok = () => mobile() && document.body.classList.contains('has-chan') && !(typeof drawerOK === 'function' && drawerOK())
    && $('#sheet').hidden && $('#mfocus').hidden && !document.body.classList.contains('contact-open') && !document.body.classList.contains('story-open');
  chat.addEventListener('touchstart', e => {
    x0 = null; if (e.touches.length !== 1 || !ok()) return;
    const x = e.touches[0].clientX, onHead = !!e.target.closest('#chat-head');
    if (x > 32 && !onHead) return; // depuis le bord (ou n'importe où sur l'en-tête)
    x0 = x; y0 = e.touches[0].clientY; dx = 0; mode = null; t0 = Date.now();
  }, { passive: true });
  chat.addEventListener('touchmove', e => {
    if (x0 === null) return;
    const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
    if (!mode) { if (Math.abs(mx) < 8 && Math.abs(my) < 8) return; mode = mx > 0 && Math.abs(mx) > Math.abs(my) * 1.2 ? 'h' : 'v'; if (mode === 'h') { chat.style.transition = 'none'; document.body.classList.add('back-drag'); } }
    if (mode !== 'h') return;
    dx = Math.max(0, mx);
    chat.style.transform = `translateX(${dx}px)`; chat.style.boxShadow = '-20px 0 40px #0008';
  }, { passive: true });
  const end = () => {
    if (x0 === null) return; x0 = null;
    if (mode !== 'h') return;
    document.body.classList.remove('back-drag');
    const fast = dx / Math.max(1, Date.now() - t0) > 0.6;
    if (dx > innerWidth * 0.33 || (fast && dx > 50)) {
      chat.style.transition = 'transform .2s ease-out'; chat.style.transform = `translateX(${innerWidth}px)`; H(8);
      setTimeout(() => { chat.style.transition = 'none'; chat.style.transform = ''; chat.style.boxShadow = ''; goBack(); requestAnimationFrame(() => (chat.style.transition = '')); }, 190);
    } else { chat.style.transition = 'transform .25s cubic-bezier(.2,.9,.3,1)'; chat.style.transform = ''; chat.style.boxShadow = ''; setTimeout(() => (chat.style.transition = ''), 260); }
  };
  chat.addEventListener('touchend', end); chat.addEventListener('touchcancel', end);
})();
