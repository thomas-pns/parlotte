'use strict';
const D = window.parlotteDesktop;
const $ = s => document.querySelector(s);
const err = new URLSearchParams(location.search).get('error');
if (err) { $('#error').textContent = err; $('#error').hidden = false; }
D.state().then(s => {
  $('#ver').textContent = 'Version ' + s.version;
  if (s.joinUrl) $('#url').value = s.joinUrl.replace(/^https:\/\//, '').replace(/:3443$/, '');
  $('#recent').innerHTML = (s.recent || []).map(u => `<button class="chip" data-url="${u.replace(/"/g, '&quot;')}">${u.replace(/^https?:\/\//, '')}</button>`).join('');
});
$('#import').onclick = async () => {
  const r = await D.importData();
  const m = $('#import-msg');
  if (r.ok) { m.className = 'ok'; m.textContent = `✅ Importé : ${r.users} compte(s), ${r.servers} serveur(s), ${r.messages} message(s), ${r.files} fichier(s). Clique sur « Héberger sur ce PC ».`; m.hidden = false; }
  else if (r.error) { m.className = 'error'; m.textContent = r.error; m.hidden = false; }
};
$('#host').onclick = () => { $('#host').textContent = 'Démarrage du serveur…'; $('#host').disabled = true; D.host(); };
$('#join-form').onsubmit = e => { e.preventDefault(); if ($('#url').value.trim()) { $('#join-form button').textContent = 'Connexion…'; D.join($('#url').value); } };
$('#recent').onclick = e => { const b = e.target.closest('[data-url]'); if (b) D.join(b.dataset.url); };
