'use strict';
// Parlotte — confort sur téléphone : hauteur réelle de l'écran quand le clavier s'ouvre (iPhone).
(() => {
  const vv = window.visualViewport; if (!vv || !matchMedia('(pointer:coarse)').matches) return;
  // Bug d'iOS (appli écran d'accueil, iPhone à Dynamic Island) : la zone d'affichage s'arrête avant le bas de
  // l'écran (il manque la hauteur de la barre d'état). On prend la vraie hauteur de l'écran et on décale tout
  // ce qui est accroché en bas d'autant (--gapb).
  const html = document.documentElement;
  const iosStandalone = () => html.classList.contains('standalone') && (/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const fullH = () => (innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height));
  const fit = () => {
    const r = html.style, kb = vv.height < innerHeight - 100; // clavier ouvert
    let gap = 0;
    if (iosStandalone()) { const g = fullH() - innerHeight; if (g > 12 && g < 140) gap = g; }
    html.classList.toggle('ios-gap', gap > 0);
    r.setProperty('--gapb', gap + 'px');
    r.setProperty('--vvh', Math.round(kb ? vv.height : innerHeight + gap) + 'px');
    r.setProperty('--apph', Math.round(innerHeight + gap) + 'px');
    r.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0); // iOS fait glisser la page (clavier) : on la remet en place
  };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); window.addEventListener('orientationchange', () => setTimeout(fit, 300));
  window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); }, { passive: true });
  document.addEventListener('focusout', () => setTimeout(fit, 120)); // clavier fermé : on remesure
  document.addEventListener('visibilitychange', () => setTimeout(fit, 120));
  fit();
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
