'use strict';
// Parlotte 1.8 — serveurs plus complets :
//  • catégories de salons (créer, renommer, déplacer, replier), salons avec ou sans catégorie ;
//  • « Supprimer le serveur » rangé dans les paramètres, en tapant son nom pour confirmer ;
//  • sur PC, la page « Tous les serveurs » affiche le fil en grand ;
//  • icône du serveur sélectionné entourée de sa couleur ; pastille « vocal » claire ;
//  • recadrage de l'image d'un événement.

const SI8 = {
  plus: svg('<path d="M12 5v14M5 12h14"/>', 16),
  more: svg('<circle cx="5" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="19" cy="12" r="1.6" fill="currentColor"/>', 16),
  chev: svg('<path d="M6 9l6 6 6-6"/>', 14),
  hash: svg('<path d="M5 9h14M4 15h14M10 3L8 21M16 3l-2 18"/>', 18),
  spk: svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7"/>', 18),
  up: svg('<path d="M12 19V5M6 11l6-6 6 6"/>', 18), down: svg('<path d="M12 5v14M6 13l6 6 6-6"/>', 18),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>', 18), trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 18),
  folder: svg('<path d="M3 6h6l2 2h10v11H3z"/>', 18),
};
const collapsed = (() => { try { return new Set(JSON.parse(localStorage.getItem('parlotte-cat-closed') || '[]')); } catch { return new Set(); } })();
const saveCollapsed = () => { try { localStorage.setItem('parlotte-cat-closed', JSON.stringify([...collapsed])); } catch {} };

// ---------------------------------------------------------------- Liste des salons avec catégories
function chanRowHTML(s, c) {
  if (c.type === 'voice') return voiceChannelHTML(c);
  const on = c.id === st.view.channel, n = st.unread[c.id];
  const subs = (s.threads || []).filter(t => t.parent_id === c.id && (!t.archived || t.id === st.view.channel));
  const gear = (c.perms & P.MANAGE_CHANNELS) ? `<span class="gear" data-chan-settings="${c.id}" title="Paramètres du salon">⚙</span>` : '';
  return `<button class="chan ${on ? 'on' : ''} ${n ? 'unread' : ''}" data-chan-id="${c.id}">${isPrivate(s, c) ? '🔒' : '#'} ${esc(c.name)}${n ? `<span class="badge">${n}</span>` : ''}${gear}</button>`
    + subs.map(t => { const tn = st.unread[t.id]; return `<button class="chan thread ${t.id === st.view.channel ? 'on' : ''} ${tn ? 'unread' : ''}" data-chan-id="${t.id}">↳ ${esc(t.name)}${tn ? `<span class="badge">${tn}</span>` : ''}</button>`; }).join('');
}
const _renderSide18 = renderSide;
renderSide = function () {
  _renderSide18();
  const s = !isSpecial(st.view.server) && server(); if (!s) return;
  const list = $('#side-list'), manage = sp(s, P.MANAGE_CHANNELS);
  $('#delete-server')?.closest('p')?.remove(); // désormais dans les paramètres du serveur
  const cats = s.categories || [];
  if (cats.length) {
    const ev = list.querySelector('.ev-mini')?.outerHTML || '';
    const loose = s.channels.filter(c => !c.category || !cats.some(k => k.id === c.category));
    let html = ev + loose.map(c => chanRowHTML(s, c)).join('');
    for (const k of cats) {
      const chans = s.channels.filter(c => c.category === k.id), closed = collapsed.has(k.id);
      const unread = chans.some(c => st.unread[c.id]);
      html += `<div class="cat cat18 ${closed ? 'closed' : ''}" data-cat="${k.id}"><button class="cat-t" data-cat-toggle="${k.id}">${SI8.chev}<span>${esc(k.name)}</span>${closed && unread ? '<i class="cat-dot"></i>' : ''}</button>
        ${manage ? `<button class="cat-b" data-cat-add="${k.id}" title="Créer un salon ici" aria-label="Créer un salon dans ${esc(k.name)}">${SI8.plus}</button><button class="cat-b" data-cat-menu="${k.id}" title="Catégorie" aria-label="Options de la catégorie">${SI8.more}</button>` : ''}</div>`;
      if (!closed) html += chans.map(c => chanRowHTML(s, c)).join('') || '<p class="cat-empty">Aucun salon</p>';
      else html += chans.filter(c => c.id === st.view.channel).map(c => chanRowHTML(s, c)).join('');
    }
    list.innerHTML = html;
  }
  if (manage) list.insertAdjacentHTML('beforeend', `<button class="cat-new" data-cat-new>${SI8.folder}<span>Créer une catégorie</span></button>`);
};
// créer un salon : choisir texte ou vocal, puis le nom
function newChannelSheet(categoryId) {
  const s = server(); const k = (s.categories || []).find(x => x.id === categoryId);
  openSheet(`<h3 class="sh-title">Nouveau salon${k ? ` dans ${esc(k.name)}` : ''}</h3>
    <form id="nc-form" class="plan-form"><div class="nc-types">
      <label class="nc-type"><input type="radio" name="nc-t" value="text" checked><span>${SI8.hash}<b>Textuel</b><small>Messages, photos, sondages</small></span></label>
      <label class="nc-type"><input type="radio" name="nc-t" value="voice"><span>${SI8.spk}<b>Vocal</b><small>Parler, vidéo, partage d'écran</small></span></label></div>
      <label class="plan-lbl">Nom du salon<input id="nc-name" maxlength="30" placeholder="nouveau-salon" autocomplete="off"></label>
      <button class="primary plan-go">Créer le salon</button></form>`);
  setTimeout(() => $('#nc-name')?.focus(), 250);
  $('#nc-form').onsubmit = e => {
    e.preventDefault(); const name = $('#nc-name').value.trim(); if (!name) return $('#nc-name').focus();
    const type = $('#nc-form').querySelector('input[name="nc-t"]:checked').value;
    closeSheet(); act('createChannel', { serverId: s.id, name, type, categoryId: categoryId || undefined });
  };
}
document.addEventListener('click', e => {
  const s = !isSpecial(st.view.server) && server(); if (!s) return;
  const t = e.target.closest('[data-cat-toggle]');
  if (t) { const id = t.dataset.catToggle; collapsed.has(id) ? collapsed.delete(id) : collapsed.add(id); saveCollapsed(); return renderSide(); }
  const add = e.target.closest('[data-cat-add]'); if (add) { e.stopPropagation(); return newChannelSheet(add.dataset.catAdd); }
  if (e.target.closest('#add-channel, #add-voice') && (s.categories || []).length) { e.stopImmediatePropagation(); return newChannelSheet(null); }
  if (e.target.closest('[data-cat-new]')) return ask('Créer une catégorie', 'Par exemple « Jeux », « Infos » ou « Vocal ».', 'Créer', name => act('createCategory', { serverId: s.id, name }));
  const m = e.target.closest('[data-cat-menu]');
  if (m) {
    const k = s.categories.find(x => x.id === m.dataset.catMenu); if (!k) return;
    openSheet(`<h3 class="sh-title">${esc(k.name)}</h3><div class="sh-list">
      <button class="sh-item" data-cat-act="rename" data-k="${k.id}"><span class="sh-ico">${SI8.edit}</span><b>Renommer</b></button>
      <button class="sh-item" data-cat-act="up" data-k="${k.id}"><span class="sh-ico">${SI8.up}</span><b>Monter</b></button>
      <button class="sh-item" data-cat-act="down" data-k="${k.id}"><span class="sh-ico">${SI8.down}</span><b>Descendre</b></button>
      <button class="sh-item danger" data-cat-act="del" data-k="${k.id}"><span class="sh-ico">${SI8.trash}</span><b>Supprimer la catégorie</b><small>Ses salons sont gardés</small></button></div>`);
  }
  const a = e.target.closest('[data-cat-act]');
  if (a) {
    const id = a.dataset.k, k = s.categories.find(x => x.id === id); closeSheet(); if (!k) return;
    if (a.dataset.catAct === 'rename') setTimeout(() => ask('Renommer la catégorie', '', 'Renommer', name => act('updateCategory', { serverId: s.id, categoryId: id, name }), k.name), 150);
    if (a.dataset.catAct === 'up') act('updateCategory', { serverId: s.id, categoryId: id, dir: -1 });
    if (a.dataset.catAct === 'down') act('updateCategory', { serverId: s.id, categoryId: id, dir: 1 });
    if (a.dataset.catAct === 'del') act('deleteCategory', { serverId: s.id, categoryId: id });
  }
}, true);

// ---------------------------------------------------------------- Paramètres du salon : catégorie et ordre
const _renderChannelSettings18 = renderChannelSettings;
renderChannelSettings = function () {
  _renderChannelSettings18();
  const s = server(), c = chanEdit?.c; if (!s || !c) return;
  const cats = s.categories || [];
  $('#ch-name')?.closest('label')?.insertAdjacentHTML('afterend', `<div class="ch-place">
    ${cats.length ? `<label class="fld">Catégorie <select id="ch-cat"><option value="">Aucune</option>${cats.map(k => `<option value="${k.id}" ${c.category === k.id ? 'selected' : ''}>${esc(k.name)}</option>`).join('')}</select></label>` : ''}
    <div class="ch-move"><span>Ordre</span><button type="button" data-ch-move="-1" aria-label="Monter">${SI8.up}</button><button type="button" data-ch-move="1" aria-label="Descendre">${SI8.down}</button></div></div>`);
};
$('#chan-dlg').addEventListener('click', e => {
  const mv = e.target.closest('[data-ch-move]'); if (mv && chanEdit) { act('moveChannel', { channelId: chanEdit.c.id, dir: Number(mv.dataset.chMove) }); toast('Salon déplacé'); return; }
  if (e.target.closest('#ch-save') && chanEdit && $('#ch-cat') && ($('#ch-cat').value || '') !== (chanEdit.c.category || '')) act('moveChannel', { channelId: chanEdit.c.id, categoryId: $('#ch-cat').value || null });
}, true);

// ---------------------------------------------------------------- Supprimer le serveur (paramètres, en tapant son nom)
const _renderServerSettings18 = renderServerSettings;
renderServerSettings = function () {
  _renderServerSettings18();
  const s = server(); if (!s || srvTab !== 'overview' || s.owner !== st.me || $('#srv-danger')) return;
  $('#srv-body .ov')?.insertAdjacentHTML('beforeend', `<div class="danger-zone" id="srv-danger"><div><b>Supprimer le serveur</b><small>Tous les salons et messages seront effacés. C'est définitif.</small></div><button class="danger-btn" data-srv-del>Supprimer…</button></div>`);
};
document.addEventListener('click', e => {
  if (!e.target.closest('[data-srv-del]')) return;
  const s = server(); if (!s) return;
  const d = document.createElement('dialog'); d.className = 'del-dlg';
  d.innerHTML = `<form method="dialog"><h3>Supprimer « ${esc(s.name)} » ?</h3><p>Tous les salons, messages, événements et emojis seront effacés pour tout le monde. Ça ne peut pas être annulé.</p>
    <label class="fld">Tape <b>${esc(s.name)}</b> pour confirmer<input id="del-name" autocomplete="off"></label>
    <menu><button type="button" value="cancel" data-del-cancel>Annuler</button><button class="danger-btn" id="del-go" disabled>Supprimer définitivement</button></menu></form>`;
  document.body.appendChild(d); d.showModal();
  d.addEventListener('close', () => d.remove());
  d.querySelector('#del-name').oninput = ev => { d.querySelector('#del-go').disabled = ev.target.value.trim() !== s.name; };
  d.querySelector('[data-del-cancel]').onclick = () => d.close();
  d.querySelector('form').onsubmit = ev => {
    ev.preventDefault();
    request('deleteServer', { serverId: s.id, confirmName: d.querySelector('#del-name').value }).then(() => { d.close(); $('#srv-dlg').close(); openChannel('@servers', null); toast('Serveur supprimé'); }, err => toast(err.message, true));
  };
});

// ---------------------------------------------------------------- PC : colonne fine partout, page « Tous les serveurs » en grand
const _renderServerCards18 = renderServerCards;
renderServerCards = function () {
  if (mobile() || space() !== 'servers' || inServer()) return _renderServerCards18();
  // pas de serveur ouvert : même colonne fine, avec « Tous les serveurs » allumé
  const saved = st.view.server; _renderServerCards18.call(this);
  document.body.classList.add('srv-slim');
  const box = $('#servers');
  if (!box.querySelector('.slim-col')) {
    box.innerHTML = `<div class="slim-col"><button class="slim-btn home on" data-slim-home data-tip="Tous les serveurs" aria-label="Tous les serveurs">${NI.grid}</button><i class="slim-sep"></i>
      ${st.servers.map(s => { const u = unreadIn(s.channels); return `<button class="slim-btn srv ${u ? 'unread' : ''}" data-srv="${s.id}" data-tip="${esc(s.name)}" aria-label="${esc(s.name)}" style="--sc:${esc(serverColor(s))}"><i class="slim-pill"></i>${srvTileHTML(s)}${u ? `<span class="slim-badge">${u > 99 ? '99+' : u}</span>` : ''}${serverLive(s) ? `<span class="slim-live" title="Vocal en cours">${SI8.spk}</span>` : ''}</button>`; }).join('')}
      <button class="slim-btn add" data-srv-add data-tip="Ajouter un serveur" aria-label="Ajouter un serveur">${NI.plus}</button></div>`;
  }
  st.view.server = saved;
};
const _renderMain18s = renderMain;
renderMain = function (...a) {
  _renderMain18s.apply(this, a);
  if (st.view.server !== '@servers' || mobile()) return;
  $('#chan-title').textContent = 'Tous les serveurs';
  $('#view').innerHTML = st.servers.length ? `<div class="feed-page"><div class="feed-grid">${st.servers.map(feedCardHTML).join('')}
    <button class="srv-add-card" data-srv-add>${NI.plus}<span><b>Ajouter un serveur</b><small>Crée le tien ou rejoins tes potes avec un code</small></span></button></div></div>` : noServerHTML();
};
$('#view').addEventListener('click', e => {
  if (e.target.closest('[data-feed-voice],[data-srv-add]')) return;
  const c = e.target.closest('.feed-card[data-srv]'); if (!c) return;
  const s = st.servers.find(x => x.id === c.dataset.srv); if (s) openChannel(s.id, s.channels.some(x => x.id === st.lastChanOf?.[s.id]) ? st.lastChanOf[s.id] : firstText(s));
});
// colonne fine : couleur du serveur pour le contour de l'icône sélectionnée, pastille « vocal » parlante
const _renderServerCards18b = renderServerCards;
renderServerCards = function () {
  _renderServerCards18b();
  document.querySelectorAll('#servers .slim-btn.srv[data-srv]').forEach(b => {
    const s = st.servers.find(x => x.id === b.dataset.srv); if (!s) return;
    b.style.setProperty('--sc', serverColor(s));
    const lv = b.querySelector('.slim-live'); if (lv && !lv.querySelector('svg')) { lv.innerHTML = SI8.spk; lv.title = 'Vocal en cours'; }
  });
};

// ---------------------------------------------------------------- Recadrage de l'image d'un événement
if (typeof CROP === 'object') CROP['ev-cover'] = { ratio: 2, w: 1200, h: 600, round: false, title: 'Image de l\'événement', hint: 'Conseillé : 1200 × 600 px (format 2:1)' };
