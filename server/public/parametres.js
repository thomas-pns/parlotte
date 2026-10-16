'use strict';
// Parlotte 1.6 — Paramètres de l'appli, façon Discord : un menu classé à gauche (Mon compte, Profil,
// Apparence, Notifications, Voix…), le contenu à droite qui glisse quand on change d'onglet.
// Sur téléphone : la liste des catégories, puis la catégorie glisse par-dessus (bouton retour).
// Les réglages existants (thème, voix, statut, sauvegardes…) sont rangés dans les bons onglets.

const SETI = {
  account: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', 20),
  profile: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17a4 4 0 017 0M14 9h4M14 13h3"/>', 20),
  privacy: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>', 20),
  appearance: svg('<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 000 18z" fill="currentColor"/>', 20),
  notifs: svg('<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>', 20),
  voice: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 20),
  status: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 20),
  app: svg('<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>', 20),
  logout: svg('<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>', 20),
  back: svg('<path d="M15 5l-7 7 7 7"/>', 22),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20),
  chev: svg('<path d="M9 5l7 7-7 7"/>', 18),
};
const SET_GROUPS = [
  ['Ton compte', [['account', 'Mon compte'], ['profile', 'Profil'], ['privacy', 'Confidentialité']]],
  ['L\'appli', [['appearance', 'Apparence'], ['notifs', 'Notifications'], ['voice', 'Voix et vidéo'], ['status', 'Statut et activité'], ['app', 'Application']]],
];
const SET_LABEL = Object.fromEntries(SET_GROUPS.flatMap(([, l]) => l));
const H4_TO_TAB = { 'Apparence': 'appearance', 'Sons et notifications': 'notifs', 'Voix': 'voice', 'Statut': 'status', 'Application': 'app', 'Sauvegardes du serveur': 'app', 'Confidentialité': 'privacy', 'Compte': 'account' };
let setTab = 'account', setPhonePane = false;

function accountPaneHTML() {
  const me = user(st.me);
  return `<div class="acc-card">
      <div class="acc-banner" style="--c:${esc(me.color || '#8E6CFF')}${me.banner ? `;background-image:url('${esc(me.banner)}')` : ''}"></div>
      <div class="acc-id">${avatar(me, true)}<div><b>${esc(me.name)}</b><small>Membre depuis ${esc(new Date(me.created || Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))}</small></div>
        <button class="pill-btn" data-set-go="profile">Modifier le profil</button></div>
      <div class="acc-rows">
        <form class="acc-row" id="acc-rename"><span><small>Pseudo</small><input id="acc-name" value="${esc(me.name)}" maxlength="24" autocomplete="username"></span><button class="pill-btn">Enregistrer</button></form>
      </div></div>
    <h4>Mot de passe</h4>
    <form class="acc-pass" id="acc-pass">
      <input type="password" id="acc-old" placeholder="Mot de passe actuel" autocomplete="current-password" required>
      <input type="password" id="acc-new" placeholder="Nouveau mot de passe (6 caractères min.)" autocomplete="new-password" minlength="6" required>
      <button class="primary">Changer le mot de passe</button>
      <p class="small">Tes autres appareils seront déconnectés.</p></form>
    <h4>Appareils connectés</h4>
    <div class="acc-dev"><span id="acc-sessions">…</span><button class="pill-btn" id="acc-others">Déconnecter les autres appareils</button></div>`;
}
function profilePaneHTML() {
  const me = user(st.me);
  return `<div class="prof-teaser" style="--c:${esc(me.color || '#8E6CFF')}">
      <div class="pt-banner" ${me.banner ? `style="background-image:url('${esc(me.banner)}')"` : ''}></div>
      <div class="pt-body">${avatar(me, true)}<b>${esc(me.name)}</b>${me.pronouns ? `<small>${esc(me.pronouns)}</small>` : ''}<p>${esc(me.about || 'Pas encore de description.')}</p></div></div>
    <p class="small">Bannière, couleurs, pronoms, « À propos », À la une : tout se règle dans l'éditeur de profil, avec l'aperçu en direct.</p>
    <button class="primary big-btn" id="settings-profile">Ouvrir l'éditeur de profil</button>`;
}

const _openSettings16 = openSettings;
openSettings = function () {
  const dlg = $('#settings-dlg'), first = !dlg.open;
  const keepScroll = $('#settings-body .set-pane')?.scrollTop || 0;
  _openSettings16();
  const body = $('#settings-body');
  // Range chaque bloc de l'ancien écran dans son onglet
  const panes = {}; let key = 'app';
  for (const el of [...body.children]) {
    if (el.tagName === 'H3' || el.tagName === 'MENU') { el.remove(); continue; }
    if (el.tagName === 'H4') key = H4_TO_TAB[el.textContent.trim()] || key;
    if (el.classList.contains('kbd')) key = 'app';
    (panes[key] ||= []).push(el);
  }
  body.innerHTML = `<div class="set-wrap ${setPhonePane ? 'pane-open' : ''}">
    <nav class="set-nav" aria-label="Catégories">
      <div class="set-nav-in">
        <div class="set-me">${avatar(user(st.me), true)}<b>${esc(user(st.me).name)}</b></div>
        ${SET_GROUPS.map(([g, items]) => `<h5>${esc(g)}</h5>${items.map(([k, l]) => `<button class="set-tab ${k === setTab ? 'on' : ''}" data-set-tab="${k}">${SETI[k]}<span>${esc(l)}</span><i class="chev">${SETI.chev}</i></button>`).join('')}`).join('')}
        <i class="set-sep"></i>
        <button class="set-tab danger" id="settings-logout">${SETI.logout}<span>Se déconnecter</span></button>
        <p class="set-ver">Parlotte ${esc(window.PARLOTTE_VERSION || '')}</p>
      </div></nav>
    <section class="set-main">
      <header class="set-head"><button class="set-back" data-set-back aria-label="Retour">${SETI.back}</button><h2>${esc(SET_LABEL[setTab])}</h2>
        <button class="set-close" id="settings-close" aria-label="Fermer">${SETI.close}<small>ÉCHAP</small></button></header>
      <div class="set-pane" data-pane="${setTab}"></div>
    </section></div>`;
  const pane = body.querySelector('.set-pane');
  if (setTab === 'account') { pane.insertAdjacentHTML('beforeend', accountPaneHTML()); fillSessions(); }
  if (setTab === 'profile') pane.insertAdjacentHTML('beforeend', profilePaneHTML());
  (panes[setTab === 'account' ? 'account' : setTab] || []).forEach(el => { if (setTab === 'account' && el.tagName === 'H4') return; if (setTab === 'account' && el.querySelector?.('#settings-profile')) { el.querySelector('#settings-profile')?.remove(); el.querySelector('#settings-logout')?.remove(); if (!el.textContent.trim()) return; } pane.appendChild(el); });
  if (!pane.children.length) pane.innerHTML = '<p class="small">Rien à régler ici pour l\'instant.</p>';
  pane.scrollTop = first ? 0 : keepScroll;
  if (first) { dlg.classList.remove('closing'); replayAnim(dlg, 'opening'); }
};
const replayAnim = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
async function fillSessions() {
  try { const r = await request('sessionsCount'); const n = r.count; const s = $('#acc-sessions'); if (s) s.textContent = n <= 1 ? 'Connecté sur cet appareil seulement' : `Connecté sur ${n} appareils`; } catch {}
}
function switchSetTab(k) {
  setTab = k; setPhonePane = true;
  openSettings();
  if (mobile()) { const w = $('#settings-body .set-wrap'); w.classList.remove('pane-open'); void w.offsetWidth; requestAnimationFrame(() => w.classList.add('pane-open')); }
  else replayAnim($('#settings-body .set-pane'), 'pane-in');
}
// Fermeture animée (le dialogue rétrécit légèrement en s'effaçant)
function closeSettings() {
  const d = $('#settings-dlg'); if (!d.open || d.classList.contains('closing')) return;
  d.classList.add('closing'); setTimeout(() => { d.classList.remove('closing', 'opening'); d.close(); setPhonePane = false; }, 180);
}
$('#settings-dlg').addEventListener('click', e => {
  const t = e.target.closest('[data-set-tab]'); if (t) { e.stopImmediatePropagation(); return switchSetTab(t.dataset.setTab); }
  const g = e.target.closest('[data-set-go]'); if (g) { e.stopImmediatePropagation(); return switchSetTab(g.dataset.setGo); }
  if (e.target.closest('[data-set-back]')) { e.stopImmediatePropagation(); setPhonePane = false; $('#settings-body .set-wrap')?.classList.remove('pane-open'); return; }
  if (e.target === $('#settings-dlg') || e.target.closest('#settings-close')) { e.stopImmediatePropagation(); return closeSettings(); }
  if (e.target.closest('#acc-others')) {
    e.stopImmediatePropagation();
    request('logoutOthers', { token: store.get('parlotte-token') }).then(r => { toast(r.closed ? `${r.closed} appareil${r.closed > 1 ? 's' : ''} déconnecté${r.closed > 1 ? 's' : ''}` : 'Aucun autre appareil'); fillSessions(); }, err => toast(err.message, true));
  }
}, true);
$('#settings-dlg').addEventListener('cancel', e => { e.preventDefault(); closeSettings(); });
$('#settings-dlg').addEventListener('submit', async e => {
  if (e.target.id === 'acc-rename') {
    e.preventDefault(); const name = $('#acc-name').value.trim();
    if (name === user(st.me).name) return;
    try { await request('renameMe', { username: name }); toast('Pseudo changé ✨'); setTimeout(openSettings, 150); } catch (err) { toast(err.message, true); }
  }
  if (e.target.id === 'acc-pass') {
    e.preventDefault();
    try { await request('changePassword', { oldPassword: $('#acc-old').value, newPassword: $('#acc-new').value, token: store.get('parlotte-token') });
      toast('Mot de passe changé 🔒'); $('#acc-old').value = ''; $('#acc-new').value = ''; fillSessions(); }
    catch (err) { toast(err.message, true); }
  }
});
// Paramètres du serveur : le contenu glisse aussi quand on change d'onglet
$('#srv-dlg').addEventListener('click', e => {
  if (!e.target.closest('[data-stab]')) return;
  setTimeout(() => { const b = $('#srv-body'); b.classList.remove('pane-in'); void b.offsetWidth; b.classList.add('pane-in'); }, 0);
});

// ---------------------------------------------------------------- 1.6.1 : toujours un moyen de fermer
// Paramètres sur téléphone : titre + bouton fermer au-dessus de la liste des catégories
const _openSettings161 = openSettings;
openSettings = function () {
  _openSettings161();
  const nav = $('#settings-body .set-nav-in');
  if (nav && !nav.querySelector('.set-nav-head')) nav.insertAdjacentHTML('afterbegin', `<div class="set-nav-head"><h2>Paramètres</h2><button class="set-x" data-set-x aria-label="Fermer">${SETI.close}</button></div>`);
};
$('#settings-dlg').addEventListener('click', e => { if (e.target.closest('[data-set-x]')) { e.stopImmediatePropagation(); closeSettings(); } }, true);
// Toute fenêtre qui n'a pas de bouton pour se fermer en reçoit un (en haut à droite)
const CLOSERS = '[id$="close"],[id$="-x"],.close,[data-close],[data-cancel],.dlg-x,.set-x,.set-close,#srv-close,button[value="cancel"],.ev-x,[data-ev-close],[data-ev-back],[aria-label="Fermer"],[aria-label="Retour"]';
function ensureCloser(d) {
  if (!d.open || d.id === 'qs' || d.querySelector('.dlg-x')) return;
  const has = [...d.querySelectorAll(CLOSERS + ',button')].some(b => b.matches(CLOSERS) || /^(✕|×|Fermer|Annuler|Retour)$/.test(b.textContent.trim()));
  if (has) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'dlg-x'; b.setAttribute('aria-label', 'Fermer'); b.innerHTML = SETI.close;
  b.onclick = () => d.close(); d.prepend(b);
}
new MutationObserver(ms => ms.forEach(m => m.target.tagName === 'DIALOG' && ensureCloser(m.target)))
  .observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'] });
