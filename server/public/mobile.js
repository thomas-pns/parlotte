'use strict';
// Parlotte — confort sur téléphone : hauteur réelle de l'écran quand le clavier s'ouvre (iPhone).
(() => {
  const vv = window.visualViewport; if (!vv || !matchMedia('(pointer:coarse)').matches) return;
  const fit = () => {
    document.documentElement.style.setProperty('--vvh', Math.round(vv.height) + 'px');
    if (vv.offsetTop) window.scrollTo(0, 0); // iOS fait glisser la page sous le clavier : on la remet en place
  };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); fit();
  document.addEventListener('focusin', e => { if (e.target.id === 'input') setTimeout(() => { const v = $('#view'); if (v) v.scrollTop = v.scrollHeight; }, 300); });
})();

// Bouton « Envoyer » : apparaît dès qu'il y a du texte ou une photo à envoyer (avant, sur téléphone,
// une photo seule ne pouvait pas partir : il fallait taper un message pour avoir la touche Entrée).
(() => {
  const btn = $('#send-btn'), inp = $('#input');
  const sync = () => { const on = !!inp.value.trim() || pendingFiles.length > 0; btn.hidden = !on; $('#rec-btn').hidden = on; $('#composer').classList.toggle('can-send', on); };
  inp.addEventListener('input', sync);
  new MutationObserver(sync).observe($('#pending'), { childList: true, attributes: true });
  btn.addEventListener('pointerdown', e => e.preventDefault()); // garde le clavier ouvert
  btn.addEventListener('click', async () => { await sendMessage(); sync(); });
  const _send = sendMessage; sendMessage = async function () { await _send(); sync(); };
  sync();
})();
// Raccourci « Nouvelle story » (appui long sur l'icône de l'app)
if (new URLSearchParams(location.search).get('story') === '1') {
  history.replaceState(null, '', '/');
  const tryOpen = () => (st.me && typeof openCamera === 'function' ? openCamera() : setTimeout(tryOpen, 300));
  setTimeout(tryOpen, 600);
}
