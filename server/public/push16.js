'use strict';
// Parlotte 1.6 — notifications sur téléphone, même appli fermée (Web Push).
// Marche sur iPhone (appli ajoutée à l'écran d'accueil, iOS 16.4+), Android et ordinateur,
// à condition que Parlotte soit ouverte depuis une adresse sécurisée (https avec un vrai certificat,
// par exemple l'adresse « de partout » donnée par l'app de bureau).

// Le serveur ne sonne pas le téléphone si Parlotte est ouverte et visible quelque part
const sendVisible = () => { if (st.me) request('visible', { on: document.visibilityState === 'visible' }).catch(() => {}); };
document.addEventListener('visibilitychange', sendVisible);
window.addEventListener('focus', sendVisible);
const _onAuthed16 = onAuthed;
onAuthed = function () { _onAuthed16(); sendVisible(); setTimeout(openFromUrl, 400); pushRefresh(); };

// Ouvrir le bon salon quand on touche une notification (?c=…)
function openById(cid) {
  if (!cid) return;
  if ((st.dms || []).some(c => c.id === cid)) return openChannel('@me', cid);
  const s = (st.servers || []).find(x => x.channels.some(c => c.id === cid)); if (s) openChannel(s.id, cid);
}
function openFromUrl() {
  const c = new URLSearchParams(location.search).get('c'); if (!c) return;
  history.replaceState(null, '', '/');
  const tryIt = (n = 0) => (st.servers || st.dms?.length ? openById(c) : n < 20 && setTimeout(() => tryIt(n + 1), 250));
  tryIt();
}
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.open) { const c = new URL(e.data.open, location.origin).searchParams.get('c'); openById(c); } });

// État des notifications push sur cet appareil
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
let pushState = { status: 'unknown' };
async function pushRefresh() {
  if (window.parlotteDesktop) return (pushState = { status: 'desktop' });
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return (pushState = { status: isIOS && !standalone() ? 'ios-home' : 'unsupported' });
  }
  if (!window.isSecureContext) return (pushState = { status: 'insecure' });
  const reg = await Promise.race([navigator.serviceWorker.getRegistration(), new Promise(r => setTimeout(() => r(null), 1500))]);
  if (!reg) return (pushState = { status: 'no-sw' }); // certificat fait maison : le navigateur refuse le service worker
  if (Notification.permission === 'denied') return (pushState = { status: 'denied' });
  const sub = await reg.pushManager.getSubscription().catch(() => null);
  pushState = { status: sub ? 'on' : 'off', reg, sub };
  if (sub) request('pushSubscribe', { sub: sub.toJSON() }).catch(() => {}); // garde le serveur à jour
  return pushState;
}
async function pushEnable() {
  const st0 = await pushRefresh(); if (!st0.reg) return;
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') { toast('Notifications refusées', true); return pushRefresh(); }
  try {
    const { key } = await request('pushKey');
    const raw = Uint8Array.from(atob(key.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const sub = await st0.reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: raw });
    await request('pushSubscribe', { sub: sub.toJSON() });
    toast('Notifications activées 🔔');
  } catch (e) { toast('Impossible d\'activer : ' + e.message, true); }
  return pushRefresh();
}
async function pushDisable() {
  const s = pushState.sub; if (!s) return;
  await request('pushUnsubscribe', { endpoint: s.endpoint }).catch(() => {});
  await s.unsubscribe().catch(() => {});
  toast('Notifications coupées'); return pushRefresh();
}
function pushCardHTML() {
  const S = pushState.status;
  const msg = {
    desktop: ['🖥️', 'App de bureau', 'Les notifications de l\'app de bureau sont déjà actives.'],
    on: ['🔔', 'Activées sur cet appareil', 'Tu seras prévenu des messages privés, des mentions et des appels, même appli fermée.'],
    off: ['🔕', 'Pas encore activées', 'Reçois les messages privés, mentions et appels même quand Parlotte est fermée.'],
    denied: ['⛔', 'Bloquées', 'Autorise les notifications pour Parlotte dans les réglages de ton téléphone ou du navigateur.'],
    'ios-home': ['📲', 'Ajoute d\'abord Parlotte à l\'écran d\'accueil', 'Sur iPhone, les notifications marchent dans l\'appli de l\'écran d\'accueil : bouton Partager ⬆️ → « Sur l\'écran d\'accueil », puis ouvre-la depuis là.'],
    'no-sw': ['🔒', 'Il faut l\'adresse sécurisée', 'Avec l\'adresse « wifi » (certificat fait maison), le téléphone refuse les notifications. Utilise l\'adresse « de partout » donnée par l\'app de bureau de l\'hôte (Paramètres → Application).'],
    insecure: ['🔒', 'Connexion non sécurisée', 'Ouvre Parlotte en https pour activer les notifications.'],
    unsupported: ['🚫', 'Non disponible', 'Ce navigateur ne gère pas les notifications push.'],
    unknown: ['…', 'Vérification…', ''],
  }[S] || ['…', '', ''];
  return `<div class="push-card ${S}"><span class="pc-ico">${msg[0]}</span><div><b>${msg[1]}</b><p>${msg[2]}</p>
    <div class="row">${S === 'off' ? '<button class="primary" id="push-on">Activer les notifications</button>' : ''}${S === 'on' ? '<button class="pill-btn" id="push-test">Envoyer un test</button><button class="pill-btn" id="push-off">Couper</button>' : ''}</div></div></div>`;
}
// Dans Paramètres → Notifications
const _openSettingsPush = openSettings;
openSettings = function () {
  _openSettingsPush();
  if (setTab !== 'notifs') return;
  const pane = $('#settings-body .set-pane');
  pane?.querySelectorAll('.row').forEach(r => { if (/^\s*Notifications\s*:/.test(r.textContent)) r.remove(); }); // remplacé par la carte ci-dessous
  pane?.insertAdjacentHTML('afterbegin', `<h4>Sur cet appareil</h4><div id="push-box">${pushCardHTML()}</div>`);
  if (pushState.status === 'unknown') pushRefresh().then(() => { const b = $('#push-box'); if (b) b.innerHTML = pushCardHTML(); });
};
$('#settings-dlg').addEventListener('click', async e => {
  const redraw = () => { const b = $('#push-box'); if (b) b.innerHTML = pushCardHTML(); };
  if (e.target.closest('#push-on')) { await pushEnable(); redraw(); }
  if (e.target.closest('#push-off')) { await pushDisable(); redraw(); }
  if (e.target.closest('#push-test')) request('pushTest').then(() => toast('Test envoyé : verrouille ton téléphone pour le voir arriver'), err => toast(err.message, true));
});

// ---------------------------------------------------------------- Accès de partout (app de bureau de l'hôte)
const dk = window.parlotteDesktop;
let pubState = null;
function qrSVG(text, px = 180) {
  if (typeof qrcode !== 'function') return '';
  const q = qrcode(0, 'M'); q.addData(text); q.make();
  const n = q.getModuleCount(), cell = px / (n + 8); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${(c + 4) * cell} ${(r + 4) * cell}h${cell}v${cell}h-${cell}z`;
  return `<svg class="qr" viewBox="0 0 ${px} ${px}" width="${px}" height="${px}" role="img" aria-label="QR code"><rect width="${px}" height="${px}" rx="16" fill="#fff"/><path d="${d}" fill="#14121A"/></svg>`;
}
function publicCardHTML() {
  const s = pubState;
  if (!s) return '<div class="pub-card"><p class="small">Vérification…</p></div>';
  if (s.error) return `<div class="pub-card"><p>${esc(s.error)}</p></div>`;
  if (!s.installed) return `<div class="pub-card"><span class="pc-ico">🌍</span><div><b>Tes potes, de partout</b>
    <p>Pour que tes potes se connectent depuis chez eux, installent Parlotte sur leur téléphone et reçoivent les notifications, il faut une vraie adresse sécurisée. <b>Tailscale</b> (gratuit) la donne en un clic.</p>
    <ol class="pub-steps"><li>Installe Tailscale sur ce PC et crée ton compte (gratuit).</li><li>Reviens ici et touche « Activer ».</li></ol>
    <div class="row"><button class="primary" data-open-safe="https://tailscale.com/download/windows">Télécharger Tailscale</button><button class="pill-btn" id="pub-refresh">J'ai installé, vérifier</button></div></div></div>`;
  if (!s.running) return `<div class="pub-card"><span class="pc-ico">🔑</span><div><b>Connecte-toi à Tailscale</b>
    <p>Ouvre Tailscale (icône près de l'horloge) et connecte-toi, puis reviens ici.</p><div class="row"><button class="pill-btn" id="pub-refresh">Vérifier</button></div></div></div>`;
  if (!s.on) return `<div class="pub-card"><span class="pc-ico">🌍</span><div><b>Accès de partout : coupé</b>
    <p>Active-le pour donner à tes potes l'adresse <code>${esc(s.url || '')}</code> : elle marche partout, avec un vrai cadenas 🔒.</p>
    ${s.enableUrl ? `<p class="warn-box">Tailscale demande une autorisation (une seule fois) : <button class="link" data-open-safe="${esc(s.enableUrl)}">ouvre ce lien</button>, accepte « Funnel », puis touche « Activer » à nouveau.</p>` : ''}
    <div class="row"><button class="primary" id="pub-on">Activer l'accès de partout</button></div></div></div>`;
  return `<div class="pub-card on"><div class="pub-qr">${qrSVG(s.url)}</div><div><b>Accès de partout : activé ✅</b>
    <p>Tes potes ouvrent cette adresse, de n'importe où (4G, autre wifi) :</p>
    <div class="code-row"><code>${esc(s.url)}</code><button class="pill-btn" id="pub-copy">Copier</button></div>
    <p class="small">Sur téléphone : scanne le QR code, puis « Sur l'écran d'accueil » (iPhone) ou « Installer » (Android) pour avoir l'appli et les notifications. Dans l'app de bureau : « Rejoindre » et colle l'adresse.</p>
    <div class="row"><button class="pill-btn" id="pub-off">Couper</button></div></div></div>`;
}
const _openSettingsPub = openSettings;
openSettings = function () {
  _openSettingsPub();
  if (setTab !== 'app' || !dk?.publicStatus) return;
  $('#settings-body .set-pane')?.insertAdjacentHTML('afterbegin', `<h4>Accès de partout</h4><div id="pub-box">${publicCardHTML()}</div>`);
  if (!pubState) dk.publicStatus().then(s => { pubState = s; const b = $('#pub-box'); if (b) b.innerHTML = publicCardHTML(); });
};
$('#settings-dlg').addEventListener('click', async e => {
  const redraw = () => { const b = $('#pub-box'); if (b) b.innerHTML = publicCardHTML(); };
  const o = e.target.closest('[data-open-safe]'); if (o) { dk?.openSafe?.(o.dataset.openSafe); return; }
  if (e.target.closest('#pub-refresh')) { pubState = null; redraw(); pubState = await dk.publicStatus(); redraw(); }
  if (e.target.closest('#pub-on')) { const b = e.target.closest('#pub-on'); b.disabled = true; b.textContent = 'Activation…'; pubState = await dk.publicStart(); redraw(); if (pubState.on) toast('Accès de partout activé 🌍'); }
  if (e.target.closest('#pub-off')) { pubState = await dk.publicStop(); redraw(); }
  if (e.target.closest('#pub-copy')) { try { await navigator.clipboard.writeText(pubState.url); toast('Adresse copiée'); } catch { toast('Copie impossible', true); } }
});

// ---------------------------------------------------------------- Installer l'appli sur téléphone (bandeau discret)
(() => {
  if (dk || standalone() || !matchMedia('(pointer:coarse)').matches) return;
  let dismissed = false; try { dismissed = localStorage.getItem('parlotte-install-dismissed') === '1'; } catch {}
  if (dismissed) return;
  const show = () => {
    if ($('#install-bar') || !st.me) return;
    const android = /Android/i.test(navigator.userAgent);
    const how = isIOS ? 'Touche <b>Partager</b> <span class="ib-share">⬆︎</span> puis <b>« Sur l\'écran d\'accueil »</b>.'
      : deferredInstall ? 'Installe-la en un toucher, comme une vraie appli.' : android ? 'Menu <b>⋮</b> du navigateur puis <b>« Installer l\'application »</b>.' : '';
    if (!how) return;
    document.body.insertAdjacentHTML('beforeend', `<div id="install-bar" role="dialog" aria-label="Installer Parlotte"><img src="/icon-192.png" alt=""><div><b>Parlotte sur ton écran d'accueil</b><p>${how} Tu auras l'appli en plein écran et les notifications.</p></div>
      ${deferredInstall ? '<button class="primary" id="ib-install">Installer</button>' : ''}<button class="ib-x" id="ib-close" aria-label="Plus tard">✕</button></div>`);
  };
  setTimeout(show, 4000);
  document.addEventListener('click', e => {
    if (e.target.closest('#ib-close')) { $('#install-bar')?.remove(); try { localStorage.setItem('parlotte-install-dismissed', '1'); } catch {} }
    if (e.target.closest('#ib-install') && deferredInstall) { deferredInstall.prompt(); deferredInstall.userChoice.finally(() => { deferredInstall = null; $('#install-bar')?.remove(); }); }
  });
})();
