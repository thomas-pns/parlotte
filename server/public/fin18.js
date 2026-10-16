'use strict';
// Parlotte 1.8 — finitions : icônes dessinées et centrées (sons, retour des événements),
// photos partagées en galerie plein écran, panneaux de droite qui ne débordent plus.

const FI = {
  play: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>',
  back: svg('<path d="M15 5l-7 7 7 7"/>', 20),
  grid: svg('<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>', 18),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>', 20),
};
// Remplace les caractères ▶ ‹ ✕ par des icônes dessinées, partout où ils apparaissent dans un bouton
function drawIcons(root = document) {
  root.querySelectorAll('button').forEach(b => {
    if (b.children.length) return;
    const t = b.textContent.trim();
    if (t === '▶') { b.innerHTML = FI.play; b.classList.add('ico-btn'); }
    else if (t === '‹') { b.innerHTML = FI.back; b.classList.add('ico-btn'); }
    else if (t === '✕' || t === '×') { b.innerHTML = FI.close; b.classList.add('ico-btn'); if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', 'Fermer'); }
  });
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1) drawIcons(n.tagName === 'BUTTON' ? n.parentElement || n : n); })
  .observe(document.body, { childList: true, subtree: true });
drawIcons();

// ---------------------------------------------------------------- Photos partagées : 6 vignettes + « Tout voir »
const _dmPanelHTML18 = dmPanelHTML;
dmPanelHTML = function (c) {
  let h = _dmPanelHTML18(c);
  const all = (st.msgs[c.id] || []).flatMap(m => (m.attachments || []).filter(a => a.url && /^image\//.test(a.content_type)));
  if (!all.length) return h;
  const grid = `<h4 class="ph-head"><span>Photos partagées</span><button class="link ph-all" data-photos-all="${esc(c.id)}">${FI.grid}<span>Tout voir (${all.length})</span></button></h4>
    <div class="photo-grid six">${all.slice(-6).reverse().map(a => `<img class="att-img" src="${esc(a.url)}" data-full="${esc(a.url)}" alt="" loading="lazy">`).join('')}</div>`;
  return h.replace(/<h4>Photos partagées<\/h4><div class="photo-grid">[\s\S]*?<\/div>/, grid);
};
document.addEventListener('click', e => {
  const b = e.target.closest('[data-photos-all]'); if (!b) return;
  const all = (st.msgs[b.dataset.photosAll] || []).flatMap(m => (m.attachments || []).filter(a => a.url && /^image\//.test(a.content_type)).map(a => ({ a, m }))).reverse();
  document.body.insertAdjacentHTML('beforeend', `<div id="gallery" role="dialog" aria-label="Photos partagées"><header><button class="pv-btn" data-gal-close aria-label="Fermer">${FI.close}</button><b>Photos partagées</b><small>${all.length}</small></header>
    <div class="gal-grid">${all.map(({ a, m }) => `<button class="gal-cell" data-gal="${esc(a.url)}"><img src="${esc(a.url)}" alt="" loading="lazy"><small>${esc(new Date(m.timestamp).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }))}</small></button>`).join('')}</div></div>`);
  const g = $('#gallery');
  g.onclick = ev => {
    if (ev.target.closest('[data-gal-close]')) { g.classList.add('closing'); return setTimeout(() => g.remove(), 220); }
    const cell = ev.target.closest('[data-gal]'); if (!cell) return;
    pv.list = all.map(({ a, m }) => ({ src: a.url, who: m.author_id, when: new Date(m.timestamp).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }));
    const box = $('#pv'); box.hidden = false; box.classList.remove('closing'); pvShow(all.findIndex(x => x.a.url === cell.dataset.gal));
    box.classList.remove('in'); void box.offsetWidth; box.classList.add('in');
  };
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#gallery') && $('#pv').hidden) $('#gallery [data-gal-close]').click(); });
