'use strict';
// Parlotte — statuts : menu rapide (En ligne / Absent / Ne pas déranger / Invisible), statut perso
// avec emoji et durée, passage automatique en « Absent », jeu en cours (app de bureau).

const desk = window.parlotteDesktop;

// ---------------------------------------------------------------- Menu de statut
const STATUS_ITEMS = [
  ['online', 'En ligne', ''],
  ['idle', 'Absent', ''],
  ['dnd', 'Ne pas déranger', 'Aucune notification ni sonnerie d\'appel'],
  ['invisible', 'Invisible', 'Tu apparais hors ligne, mais tu peux tout utiliser'],
];
function openStatusMenu() {
  const menu = $('#status-menu'), pr = st.profile || {}, cur = pr.presence || 'online';
  const hasCustom = pr.customStatus || pr.statusEmoji;
  menu.innerHTML = `${hasCustom ? `<div class="sm-custom"><span>${statusLine(pr)}</span>${pr.statusExpires ? `<small>jusqu'à ${esc(untilText(pr.statusExpires))}</small>` : ''}<button data-cs-clear title="Effacer le statut">✕</button></div>` : ''}
    <button class="sm-item" data-cs-edit>😀 ${hasCustom ? 'Modifier mon statut perso' : 'Définir un statut perso'}</button><hr>
    ${STATUS_ITEMS.map(([k, l, d]) => `<button class="sm-item ${cur === k ? 'on' : ''}" data-presence="${k}"><span class="st-dot" style="background:${dot[k === 'invisible' ? 'offline' : k]}"></span><span><b>${l}</b>${d ? `<small>${d}</small>` : ''}</span></button>`).join('')}`;
  const r = $('#me').getBoundingClientRect();
  menu.style.left = r.left + 8 + 'px'; menu.style.bottom = (innerHeight - r.top + 6) + 'px';
  menu.hidden = false;
}
$('#me').addEventListener('click', e => { if (e.target.closest('#open-status')) { e.stopPropagation(); $('#status-menu').hidden ? openStatusMenu() : ($('#status-menu').hidden = true); } });
$('#status-menu').addEventListener('click', e => {
  const p = e.target.closest('[data-presence]');
  if (p) { $('#status-menu').hidden = true; act('setProfile', { presence: p.dataset.presence }); }
  if (e.target.closest('[data-cs-edit]')) { $('#status-menu').hidden = true; openCustomStatus(); }
  if (e.target.closest('[data-cs-clear]')) { $('#status-menu').hidden = true; act('setProfile', { customStatus: '', statusEmoji: '' }); }
});
document.addEventListener('click', e => { if (!e.target.closest('#status-menu,#open-status')) $('#status-menu').hidden = true; });

// ---------------------------------------------------------------- Statut perso
const STATUS_EMOJIS = ['🎮', '💻', '📚', '🍕', '😴', '🎧', '🏃', '🎬', '🤒', '🔥', '🌴', '🚗'];
const EXPIRY = [['30m', '30 minutes'], ['1h', '1 heure'], ['4h', '4 heures'], ['today', 'Aujourd\'hui'], ['', 'Ne pas effacer']];
function expiryDate(k) {
  const d = new Date();
  if (k === '30m') return new Date(+d + 30 * 6e4);
  if (k === '1h') return new Date(+d + 36e5);
  if (k === '4h') return new Date(+d + 4 * 36e5);
  if (k === 'today') { d.setHours(23, 59, 59, 0); return d; }
  return null;
}
const untilText = iso => { const d = new Date(iso); return sameDay(d, Date.now()) ? time(d) : d.toLocaleString('fr-FR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }); };
function sinceText(iso) {
  const min = Math.max(1, Math.round((Date.now() - new Date(iso)) / 6e4));
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}
function openCustomStatus() {
  const pr = st.profile || {}, d = $('#cs-dlg');
  $('#cs-emoji').value = pr.statusEmoji || ''; $('#cs-text').value = pr.customStatus || '';
  $('#cs-quick').innerHTML = STATUS_EMOJIS.map(e => `<button type="button" data-qe="${e}">${e}</button>`).join('');
  $('#cs-exp').innerHTML = EXPIRY.map(([k, l]) => `<option value="${k}" ${k === (pr.statusExpires ? 'today' : '') ? 'selected' : ''}>${l}</option>`).join('');
  d.showModal(); $('#cs-text').focus();
}
$('#cs-quick').addEventListener('click', e => { const b = e.target.closest('[data-qe]'); if (b) { $('#cs-emoji').value = b.dataset.qe; $('#cs-text').focus(); } });
$('#cs-dlg').addEventListener('close', () => {
  if ($('#cs-dlg').returnValue !== 'ok') return;
  const exp = expiryDate($('#cs-exp').value);
  act('setProfile', { customStatus: $('#cs-text').value, statusEmoji: $('#cs-emoji').value.trim(), statusExpires: exp ? exp.toISOString() : null })
    .then(() => toast('Statut enregistré'));
});

// ---------------------------------------------------------------- Inactivité → « Absent »
let lastInput = Date.now(), sentIdle = null;
['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => { lastInput = Date.now(); if (sentIdle) checkIdle(); }, { passive: true, capture: true }));
const idleLimit = () => (prefs.idleMin ?? 10) * 60;
async function checkIdle() {
  if (!st.me || ws?.readyState !== 1) return;
  let secs = (Date.now() - lastInput) / 1000;
  // App de bureau : on regarde l'activité de tout l'ordinateur (on peut jouer sans toucher Parlotte)
  if (desk?.idleSeconds) secs = await desk.idleSeconds().catch(() => secs);
  const idle = idleLimit() > 0 && secs >= idleLimit();
  if (idle !== sentIdle) { sentIdle = idle; request('activity', { idle }).catch(() => { sentIdle = null; }); }
}
setInterval(checkIdle, 15000);

// ---------------------------------------------------------------- Jeu en cours (app de bureau)
let currentGame = '';
desk?.onGame?.(name => { currentGame = name || ''; if (st.me) request('setActivity', { name: currentGame }).catch(() => {}); });
function onAuthed() {
  sentIdle = null; setTimeout(checkIdle, 500);
  if (currentGame) request('setActivity', { name: currentGame }).catch(() => {});
}

function presenceSettingsHTML() {
  const cur = prefs.idleMin ?? 10;
  return `<h4>Statut</h4>
    <label class="fld">Passer en « Absent » après <select id="p-idle">${[[5, '5 minutes'], [10, '10 minutes'], [15, '15 minutes'], [30, '30 minutes'], [0, 'Jamais']]
      .map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select> sans activité</label>
    ${desk?.setShowGame ? `<label class="chk"><input type="checkbox" id="p-game" ${desktopInfo?.showGame === false ? '' : 'checked'}> Afficher le jeu auquel je joue (« 🎮 Joue à … »)</label>` : ''}`;
}
$('#settings-dlg').addEventListener('change', e => {
  if (e.target.id === 'p-idle') { prefs.idleMin = Number(e.target.value); savePrefs(); sentIdle = null; checkIdle(); }
  if (e.target.id === 'p-game') { desk.setShowGame(e.target.checked); if (desktopInfo) desktopInfo.showGame = e.target.checked; }
});

// ---------------------------------------------------------------- Connexion perdue : pouvoir changer de serveur
(() => {
  const c = $('#conn');
  c.innerHTML = `<span>Connexion au serveur perdue… reconnexion</span>${desk ? '<button id="conn-switch">Changer de serveur</button>' : ''}`;
  c.addEventListener('click', e => { if (e.target.closest('#conn-switch')) desk.openLauncher(); });
})();

// ---------------------------------------------------------------- Mise à jour de l'app de bureau
desk?.onUpdate?.(u => {
  const b = $('#update-bar');
  b.innerHTML = `<span>⬆️ Parlotte ${esc(u.version)} est disponible.</span><button id="upd-go" class="primary green">Mettre à jour</button><button id="upd-later" class="link">Plus tard</button>`;
  b.hidden = false;
});
$('#update-bar').addEventListener('click', e => {
  if (e.target.closest('#upd-go')) { $('#update-bar').hidden = true; desk.installUpdate(); }
  if (e.target.closest('#upd-later')) $('#update-bar').hidden = true;
});
