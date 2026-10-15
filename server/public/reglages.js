'use strict';
// Parlotte — paramètres du serveur, version « fun » : aperçu en direct, bannière et icône,
// couleur, description, code d'invitation, onglets avec icônes et choix de fichier stylés.

const RI = {
  overview: svg('<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 10h18"/>', 18),
  roles: svg('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', 18),
  members: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6.5 6.5 0 013.5 6"/>', 18),
  emojis: svg('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 007 0M9 9.5h.01M15 9.5h.01"/>', 18),
  sounds: svg('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', 18),
  bans: svg('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>', 18),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 18),
  upload: svg('<path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3"/>', 22),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>', 16),
  refresh: svg('<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>', 16),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 16),
};

// ---------------------------------------------------------------- Choix de fichier stylé (réutilisable)
function filePickHTML(id, accept, label, hint = '') {
  return `<label class="fpick" for="${id}"><span class="fp-ico">${RI.upload}</span><span class="fp-txt"><b data-fp-label="${id}">${esc(label)}</b>${hint ? `<small>${esc(hint)}</small>` : ''}</span>
    <input type="file" id="${id}" accept="${esc(accept)}" data-fp hidden></label>`;
}
document.addEventListener('change', e => {
  const i = e.target.closest('input[data-fp]'); if (!i) return;
  const lab = document.querySelector(`[data-fp-label="${i.id}"]`), f = i.files[0];
  if (lab && f) { lab.textContent = f.name; lab.closest('.fpick').classList.add('chosen'); }
});

// ---------------------------------------------------------------- Onglets avec icônes
const _renderServerSettings = renderServerSettings;
renderServerSettings = function () {
  _renderServerSettings();
  const s = server(); if (!s) return;
  const tabs = $('#srv-tabs');
  tabs.querySelector('h4')?.replaceWith(Object.assign(document.createElement('div'), { className: 'st-head', innerHTML: `${srvTileHTML(s, 'sm')}<b>${esc(s.name)}</b>` }));
  tabs.querySelectorAll('[data-stab]').forEach(b => { if (!b.querySelector('svg')) b.insertAdjacentHTML('afterbegin', RI[b.dataset.stab] || ''); });
  const body = $('#srv-body');
  if (srvTab === 'overview') body.innerHTML = overviewHTML(s);
  if (srvTab === 'bans') body.innerHTML = `<h3>Bannissements <span class="count-pill">${s.bans.length}</span></h3>
    ${s.bans.length ? `<div class="ban-grid">${s.bans.map(uid => { const u = user(uid); return `<div class="ban-card">${avatar(u)}<b>${esc(u.name)}</b><button class="pill-btn" data-unban="${esc(uid)}">Révoquer</button></div>`; }).join('')}</div>`
      : `<div class="empty-state"><div class="es-ico">${RI.bans}</div><h2>Personne n'est banni</h2><p>Les personnes bannies ne peuvent plus revenir avec le code d'invitation.</p></div>`}`;
};

// ---------------------------------------------------------------- Vue d'ensemble : aperçu en direct
let ov = null; // brouillon : { id, name, description, color, icon:{id,url}|null, banner:{id,url}|null }
function ovFrom(s) {
  return { id: s.id, name: s.name, description: s.description || '', color: s.color || null,
    icon: s.icon ? { id: '=', url: s.icon } : null, banner: s.banner ? { id: '=', url: s.banner } : null };
}
function ovDirty(s) {
  if (!ov) return false;
  return ov.name !== s.name || ov.description !== (s.description || '') || ov.color !== (s.color || null)
    || (ov.icon ? ov.icon.id !== '=' : !!s.icon) || (ov.banner ? ov.banner.id !== '=' : !!s.banner);
}
function overviewHTML(s) {
  if (!ov || ov.id !== s.id) ov = ovFrom(s);
  const col = ov.color || serverColor({ ...s, color: null }), online = s.members.filter(m => user(m).status !== 'offline').length;
  const tile = ov.icon ? `<span class="srv-tile img" style="background-image:url('${esc(ov.icon.url)}')"></span>`
    : `<span class="srv-tile" style="background:${col};color:${lightColor(col) ? '#14121A' : '#fff'}">${initials(ov.name || '?')}</span>`;
  const sw = [...PALETTE, '#FF6B4A', '#6FE3D2'];
  return `<div class="ov">
    <div class="ov-card">
      <div class="ov-banner ${ov.banner ? 'img' : ''}" style="--c:${col}${ov.banner ? `;background-image:url('${esc(ov.banner.url)}')` : ''}">
        <label class="ov-chip" title="Changer la bannière">${RI.camera}<span>${ov.banner ? 'Changer la bannière' : 'Ajouter une bannière'}</span><input type="file" id="ov-banner-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden></label>
        ${ov.banner ? `<button class="ov-chip danger" id="ov-banner-del" title="Retirer la bannière">${RI.trash}</button>` : ''}
      </div>
      <div class="ov-id">
        <label class="ov-icon" title="Changer l'icône">${tile}<span class="ov-icon-cam">${RI.camera}</span><input type="file" id="ov-icon-file" accept="image/png,image/jpeg,image/gif,image/webp" hidden></label>
        <div class="ov-names"><b id="ov-prev-name">${esc(ov.name || 'Sans nom')}</b><small id="ov-prev-desc">${esc(ov.description || `${s.members.length} membre${s.members.length > 1 ? 's' : ''} · ${online} en ligne`)}</small></div>
        ${ov.icon ? `<button class="link danger-link" id="ov-icon-del">Retirer l'icône</button>` : ''}
      </div>
    </div>
    <div class="ov-fields">
      <label class="fld">Nom du serveur <input id="srv-name" value="${esc(ov.name)}" maxlength="40"></label>
      <label class="fld">Description <textarea id="ov-desc" maxlength="120" rows="2" placeholder="Le QG de la bande, les soirées jeux, les photos de vacances…">${esc(ov.description)}</textarea></label>
      <div class="fld">Couleur du serveur
        <div class="ov-colors">${sw.map(c => `<button class="sw ${ov.color === c ? 'on' : ''}" data-ov-color="${c}" style="background:${c}" aria-label="Couleur ${c}"></button>`).join('')}
          <label class="sw custom ${ov.color && !sw.includes(ov.color) ? 'on' : ''}" title="Autre couleur" style="${ov.color && !sw.includes(ov.color) ? `background:${ov.color}` : ''}"><input type="color" id="ov-color" value="${esc(ov.color || col)}"><span>+</span></label>
          ${ov.color ? '<button class="link" data-ov-color="">Automatique</button>' : ''}</div></div>
    </div>
    <div class="ov-invite">
      <div class="ovi-txt"><b>Code d'invitation</b><small>À donner à tes potes : Serveurs → Code. Ou invite-les directement avec le bouton « Inviter ».</small></div>
      <code class="code-pill">${esc(s.invite || '—')}</code>
      <button class="pill-btn" id="ov-copy">${RI.copy}<span>Copier</span></button>
      <button class="pill-btn" id="srv-new-invite" title="L'ancien code ne marchera plus">${RI.refresh}<span>Nouveau code</span></button>
    </div>
    <div class="ov-save ${ovDirty(s) ? 'show' : ''}" id="ov-save"><span>Tu as des modifications pas encore enregistrées</span>
      <button class="link" id="ov-reset">Annuler</button><button class="primary" id="srv-save-name">Enregistrer</button></div>
  </div>`;
}
const ovRefresh = () => { const s = server(); if (s && srvTab === 'overview') { const y = $('#srv-body').scrollTop; $('#srv-body').innerHTML = overviewHTML(s); $('#srv-body').scrollTop = y; } };
const ovSaveBar = () => { const s = server(); $('#ov-save')?.classList.toggle('show', ovDirty(s)); };
$('#srv-dlg').addEventListener('input', e => {
  if (!ov || srvTab !== 'overview') return;
  if (e.target.id === 'srv-name') { ov.name = e.target.value; $('#ov-prev-name').textContent = ov.name || 'Sans nom'; const t = $('.ov-id .srv-tile:not(.img)'); if (t) t.textContent = ov.name.split(/\s+/).map(w => w[0] || '').join('').slice(0, 2).toUpperCase(); }
  if (e.target.id === 'ov-desc') { ov.description = e.target.value; $('#ov-prev-desc').textContent = ov.description || ' '; }
  if (e.target.id === 'ov-color') { ov.color = e.target.value; return ovRefresh(); }
  ovSaveBar();
});
$('#srv-dlg').addEventListener('change', async e => {
  if (!ov || !['ov-icon-file', 'ov-banner-file'].includes(e.target.id)) return;
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!/^image\/(png|jpeg|gif|webp)$/.test(f.type)) return toast('Choisis une image (png, jpg, gif, webp)', true);
  if (f.size > 8 * 1024 * 1024) return toast('Image trop lourde (8 Mo max)', true);
  const which = e.target.id === 'ov-icon-file' ? 'icon' : 'banner';
  try { const up = await upload(f); ov[which] = { id: up.id, url: up.url }; ovRefresh(); }
  catch (err) { toast(err.message, true); }
});
$('#srv-dlg').addEventListener('click', e => {
  const s = server(); if (!s || srvTab !== 'overview' || !ov) return;
  const c = e.target.closest('[data-ov-color]'); if (c) { ov.color = c.dataset.ovColor || null; return ovRefresh(); }
  if (e.target.closest('#ov-banner-del')) { e.preventDefault(); ov.banner = null; return ovRefresh(); }
  if (e.target.closest('#ov-icon-del')) { e.preventDefault(); ov.icon = null; return ovRefresh(); }
  if (e.target.closest('#ov-reset')) { ov = ovFrom(s); return ovRefresh(); }
  if (e.target.closest('#ov-copy')) { try { navigator.clipboard.writeText(s.invite).then(() => toast('Code copié !')); } catch { toast('Copie impossible', true); } return; }
  if (e.target.closest('#srv-save-name')) {
    e.stopImmediatePropagation();
    const payload = { serverId: s.id, name: ov.name, description: ov.description, color: ov.color };
    if (!ov.icon) payload.icon = null; else if (ov.icon.id !== '=') payload.icon = ov.icon.id;
    if (!ov.banner) payload.banner = null; else if (ov.banner.id !== '=') payload.banner = ov.banner.id;
    request('updateServer', payload).then(() => { ov = null; ovRefresh(); toast('Serveur enregistré ✨'); }, err => toast(err.message, true));
  }
}, true);
$('#srv-dlg').addEventListener('close', () => { ov = null; });
