'use strict';
// Parlotte — confort sur téléphone : hauteur réelle de l'écran quand le clavier s'ouvre (iPhone).
(() => {
  const vv = window.visualViewport; if (!vv || !matchMedia('(pointer:coarse)').matches) return;
  // 1.9 — L'appli de l'écran d'accueil (iPhone) : plus de page « fixée » ni de hauteur calculée en permanence
  // (c'est ce qui coupait le bas). L'appli prend 100 % de l'écran en CSS ; on ne mesure qu'avec le clavier ouvert.
  // Si iOS laisse quand même une bande en bas, deux modes de secours se choisissent dans Paramètres → Apparence :
  //  • « ext »    : l'appli descend de la hauteur de la barre d'état (bug connu d'iOS 26/27) ;
  //  • « screen » : l'appli prend la hauteur réelle de l'écran (mesurée).
  const html = document.documentElement;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const fullH = () => (innerWidth > innerHeight ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height));
  // 2.0 : la vraie cause était la barre d'état « translucide » (corrigée dans index.html) : plus besoin des modes de secours
  try { localStorage.removeItem('parlotte-ios-fit'); } catch {}
  window.iosFitMode = () => 'auto';
  let peak = innerHeight, wasKb = false;
  const fit = () => {
    const r = html.style, kb = vv.height < innerHeight - 100 || (document.activeElement?.matches?.('input,textarea,[contenteditable]') && vv.height < peak - 100);
    const mode = html.classList.contains('standalone') && ios ? iosFitMode() : 'auto';
    if (!kb) peak = Math.max(peak, innerHeight);
    html.classList.toggle('kb', !!kb);
    html.classList.toggle('fit-ext', mode === 'ext');
    let gap = 0; if (mode === 'screen') { const g = fullH() - innerHeight; if (g > 4 && g < 160) gap = g; }
    html.classList.toggle('fit-screen', gap > 0);
    html.classList.toggle('ios-gap', mode === 'ext' || gap > 0);
    r.setProperty('--gapb', mode === 'ext' ? 'env(safe-area-inset-top)' : gap + 'px');
    r.setProperty('--vvh', Math.round(kb ? vv.height : innerHeight + gap) + 'px');
    r.setProperty('--apph', Math.round(innerHeight + gap) + 'px');
    r.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
    if (window.scrollY || window.scrollX) window.scrollTo(0, 0);
    if (wasKb && !kb) heal();
    wasKb = !!kb;
  };
  // Après le clavier, iOS garde parfois une zone d'affichage rétrécie jusqu'à ce qu'on relance l'appli :
  // on force une nouvelle mesure en masquant/réaffichant l'appli d'un coup (invisible à l'œil).
  function heal() {
    setTimeout(() => {
      if (peak - innerHeight <= 4 && !html.classList.contains('kb')) return;
      const app = $('#app'), v = $('#view'), top = v?.scrollTop || 0; if (!app || html.classList.contains('kb')) return;
      app.style.display = 'none'; void app.offsetHeight; app.style.display = '';
      if (v) v.scrollTop = top;
      requestAnimationFrame(fitSoon);
    }, 140);
  }
  const fitSoon = () => setTimeout(fit, 30);
  window.refitScreen = () => { peak = innerHeight; fit(); };
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit); window.addEventListener('orientationchange', () => setTimeout(() => { peak = 0; fit(); }, 300));
  window.addEventListener('resize', fit);
  window.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); }, { passive: true });
  document.addEventListener('focusout', () => setTimeout(fit, 120));
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
