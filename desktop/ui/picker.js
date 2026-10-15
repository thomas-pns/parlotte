'use strict';
const D = window.parlotteDesktop; let chosen = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
D.onSources(list => {
  const grid = document.getElementById('grid');
  grid.innerHTML = list.sort((a, b) => b.screen - a.screen).map(s => `<button class="src" data-id="${esc(s.id)}"><img src="${s.thumb}" alt=""><span>${s.screen ? '🖥️ ' : '🪟 '}${esc(s.name)}</span></button>`).join('');
  grid.onclick = e => { const b = e.target.closest('.src'); if (!b) return; grid.querySelectorAll('.src').forEach(x => x.classList.toggle('on', x === b)); chosen = b.dataset.id; document.getElementById('go').disabled = false; };
  grid.ondblclick = e => { const b = e.target.closest('.src'); if (b) D.choose(b.dataset.id); };
});
document.getElementById('go').onclick = () => chosen && D.choose(chosen);
document.getElementById('cancel').onclick = () => D.choose(null);
