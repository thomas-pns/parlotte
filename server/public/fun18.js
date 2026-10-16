'use strict';
// Parlotte 1.8 — appels réglables, thèmes de conversation et filtres photo :
//  • la zone vidéo d'un appel se règle en hauteur (poignée à tirer) et se réduit d'un clic, joliment ;
//  • chaque conversation privée peut avoir son thème (fond + couleur des bulles), façon Instagram ;
//  • l'appareil photo propose des filtres (N&B, chaud, froid, vintage, vif…), appliqués à la photo et à la vidéo.

const UI8 = {
  cam: svg('<rect x="3" y="6" width="13" height="12" rx="3"/><path d="M16 10l5-3v10l-5-3z"/>', 16),
  down: svg('<path d="M6 9l6 6 6-6"/>', 16), up: svg('<path d="M6 15l6-6 6 6"/>', 16),
  palette: svg('<path d="M12 3a9 9 0 100 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5 0-.8.7-1.5 1.5-1.5H16a5 5 0 005-5c0-4.4-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1.2" fill="currentColor"/><circle cx="10" cy="7.5" r="1.2" fill="currentColor"/><circle cx="14.5" cy="7.5" r="1.2" fill="currentColor"/>', 18),
  check: svg('<path d="M5 12l5 5L20 7"/>', 18),
};

// ---------------------------------------------------------------- Appel : zone vidéo réglable
const STAGE_KEY = 'parlotte-stage-h';
let stageH = (() => { try { return Number(localStorage.getItem(STAGE_KEY)) || 0; } catch { return 0; } })();
$('#stage').insertAdjacentHTML('afterend', '<div id="stage-grip" hidden role="separator" aria-label="Tirer pour agrandir ou réduire la vidéo" tabindex="0"><i></i></div>');
const _renderStage18 = renderStage;
renderStage = function () {
  _renderStage18();
  const bar = $('#stage-bar'), st0 = $('#stage'), grip = $('#stage-grip'), n = st0.querySelectorAll('.tile').length;
  const inCallx = st0.classList.contains('in-callx');
  grip.hidden = bar.hidden || vc.stageCollapsed || inCallx;
  if (!bar.hidden) {
    bar.querySelector('b').innerHTML = `${UI8.cam}<span>${n} vidéo${n > 1 ? 's' : ''} · ${esc(where(vc.channel))}</span>`;
    const t = $('#stage-toggle'); t.innerHTML = vc.stageCollapsed ? `${UI8.down}<span>Afficher la vidéo</span>` : `${UI8.up}<span>Réduire</span>`;
  }
  if (!inCallx && stageH && !vc.stageCollapsed) { st0.style.height = stageH + 'px'; st0.style.maxHeight = 'none'; }
  else { st0.style.height = ''; st0.style.maxHeight = ''; }
};
(() => {
  const g = $('#stage-grip'); let y0 = 0, h0 = 0, on = false;
  g.addEventListener('pointerdown', e => { on = true; y0 = e.clientY; h0 = $('#stage').getBoundingClientRect().height; g.setPointerCapture(e.pointerId); document.body.classList.add('stage-resizing'); });
  g.addEventListener('pointermove', e => {
    if (!on) return;
    stageH = Math.round(Math.max(110, Math.min(innerHeight * 0.8, h0 + e.clientY - y0)));
    const s = $('#stage'); s.style.height = stageH + 'px'; s.style.maxHeight = 'none';
  });
  const end = () => { if (!on) return; on = false; document.body.classList.remove('stage-resizing'); try { localStorage.setItem(STAGE_KEY, stageH); } catch {} };
  g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
  g.addEventListener('dblclick', () => { stageH = 0; try { localStorage.removeItem(STAGE_KEY); } catch {} renderStage(); });
  g.addEventListener('keydown', e => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); stageH = Math.max(110, (stageH || $('#stage').offsetHeight) + (e.key === 'ArrowDown' ? 30 : -30)); renderStage(); } });
})();

// ---------------------------------------------------------------- Thèmes de conversation
const THEMES = [
  ['', 'Par défaut', 'var(--chat)', 'var(--coral)', 'var(--on-coral)'],
  ['sunset', 'Coucher de soleil', 'linear-gradient(170deg,#3a1c3f 0%,#7a2e3b 45%,#d9653b 100%)', '#FF8A5B', '#1A0E0A'],
  ['ocean', 'Océan', 'linear-gradient(170deg,#0b1d3a 0%,#123e6b 50%,#1f7a8c 100%)', '#4FA3D1', '#06121F'],
  ['forest', 'Forêt', 'linear-gradient(170deg,#0f1f17 0%,#1d3b2a 55%,#3f6b3a 100%)', '#3FB27F', '#06140D'],
  ['candy', 'Bonbon', 'linear-gradient(170deg,#3b1840 0%,#7a2d6e 50%,#e05a8a 100%)', '#FF7AB6', '#2A0718'],
  ['night', 'Nuit étoilée', 'radial-gradient(circle at 20% 10%,#ffffff22 0 1px,transparent 2px) 0 0/40px 40px,radial-gradient(circle at 70% 60%,#ffffff18 0 1px,transparent 2px) 0 0/60px 60px,linear-gradient(170deg,#0a0a1f,#1b1640 60%,#2c1f5a)', '#8E6CFF', '#fff'],
  ['lava', 'Lave', 'linear-gradient(170deg,#1a0a0a 0%,#4a1010 50%,#c0392b 100%)', '#FF6B4A', '#1A0E0A'],
  ['mint', 'Menthe', 'linear-gradient(170deg,#0e2422 0%,#14463f 55%,#3fb2a0 100%)', '#6FE3D2', '#0F2B27'],
];
function applyTheme() {
  const c = st.view.channel && chanById(st.view.channel), t = c?.type === 'dm' && c.theme ? THEMES.find(x => x[0] === c.theme) : null;
  const chat = $('#chat');
  chat.classList.toggle('themed', !!t);
  if (t) { chat.style.setProperty('--th-bg', t[2]); chat.style.setProperty('--th-me', t[3]); chat.style.setProperty('--th-on', t[4]); }
  else ['--th-bg', '--th-me', '--th-on'].forEach(k => chat.style.removeProperty(k));
}
const _renderMain18t = renderMain;
renderMain = function (...a) { _renderMain18t.apply(this, a); applyTheme(); };
// bouton « Thème » dans le panneau de la conversation
const _dmPanelHTML18t = dmPanelHTML;
dmPanelHTML = function (c) {
  const h = _dmPanelHTML18t(c), t = THEMES.find(x => x[0] === (c.theme || '')) || THEMES[0];
  const btn = `<button class="theme-btn" data-theme-open="${esc(c.id)}"><span class="th-sw" style="background:${t[2]}"><i style="background:${t[3]}"></i></span><span><b>Thème</b><small>${esc(t[1])}</small></span>${UI8.palette}</button>`;
  return h.replace(/(<h4[^>]*>)/, btn + '$1');
};
document.addEventListener('click', e => {
  const o = e.target.closest('[data-theme-open]');
  if (o) {
    const c = chanById(o.dataset.themeOpen); if (!c) return;
    openSheet(`<h3 class="sh-title">${UI8.palette} Thème de la conversation</h3><p class="small">Tout le monde dans la conversation voit le même thème.</p>
      <div class="theme-grid">${THEMES.map(([k, l, bg, me]) => `<button class="theme-pick ${(c.theme || '') === k ? 'on' : ''}" data-theme-set="${k}" data-cid="${esc(c.id)}">
        <span class="tp-prev" style="background:${bg}"><i class="tp-b1"></i><i class="tp-b2" style="background:${me}"></i>${(c.theme || '') === k ? `<em>${UI8.check}</em>` : ''}</span><small>${esc(l)}</small></button>`).join('')}</div>`);
  }
  const s = e.target.closest('[data-theme-set]');
  if (s) { closeSheet(); act('setChatTheme', { channelId: s.dataset.cid, theme: s.dataset.themeSet }); }
});

// ---------------------------------------------------------------- Filtres de l'appareil photo
const FILTERS = [
  ['none', 'Normal', 'none'], ['bw', 'N&B', 'grayscale(1) contrast(1.1)'], ['warm', 'Chaud', 'sepia(.35) saturate(1.35) hue-rotate(-10deg)'],
  ['cool', 'Froid', 'saturate(1.1) hue-rotate(15deg) brightness(1.03)'], ['vintage', 'Vintage', 'sepia(.55) contrast(.9) brightness(1.08) saturate(.85)'],
  ['vivid', 'Vif', 'saturate(1.7) contrast(1.12)'], ['dream', 'Rêve', 'brightness(1.12) saturate(1.2) contrast(.85) blur(.4px)'], ['noir', 'Noir', 'grayscale(1) contrast(1.6) brightness(.9)'],
];
let camFilter = 'none';
$('#scam .s-bottom').insertAdjacentHTML('beforebegin', `<div id="scam-filters" role="radiogroup" aria-label="Filtres">${FILTERS.map(([k, l, f]) =>
  `<button class="sf ${k === 'none' ? 'on' : ''}" data-filter="${k}" role="radio" aria-checked="${k === 'none'}"><i style="filter:${f}"></i><span>${l}</span></button>`).join('')}</div>`);
$('#scam-filters').addEventListener('click', e => {
  const b = e.target.closest('[data-filter]'); if (!b) return;
  camFilter = FILTERS.find(x => x[0] === b.dataset.filter)[2];
  $('#scam-v').style.filter = camFilter === 'none' ? '' : camFilter;
  $('#scam-filters').querySelectorAll('.sf').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
  b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  navigator.vibrate?.(8);
});
// le filtre est « cuit » dans la photo et dans chaque image de la vidéo
const _drawCover18 = drawCover;
drawCover = function (g, ...a) { if (camFilter !== 'none' && 'filter' in g) g.filter = camFilter; _drawCover18(g, ...a); if ('filter' in g) g.filter = 'none'; };
// on repart sans filtre à chaque ouverture
const _openCamera18f = openCamera;
openCamera = function (...a) {
  camFilter = 'none'; $('#scam-v').style.filter = '';
  $('#scam-filters')?.querySelectorAll('.sf').forEach((x, i) => { x.classList.toggle('on', i === 0); x.setAttribute('aria-checked', i === 0); });
  return _openCamera18f.apply(this, a);
};
