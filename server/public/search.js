// Recherche façon Discord : syntaxe à filtres (from:, in:, has:, mentions:, before:, after:, during:, pinned:)
// + texte libre, autocomplétion des filtres, résultats paginés au format de l'API Discord.
(function (global) {
  'use strict';

  const FILTERS = {
    from:     { hint: 'utilisateur', multi: true },
    mentions: { hint: 'utilisateur', multi: true },
    in:       { hint: 'salon',       multi: true },
    has:      { hint: 'link, embed, file, image, video, sound', multi: true,
                values: ['link', 'embed', 'file', 'image', 'video', 'sound'] },
    before:   { hint: 'date (AAAA-MM-JJ)' },
    after:    { hint: 'date (AAAA-MM-JJ)' },
    during:   { hint: 'date (AAAA-MM-JJ)' },
    pinned:   { hint: 'true / false', values: ['true', 'false'] },
  };

  // Découpe "from:alice has:link bonjour \"phrase exacte\"" en filtres + termes.
  function parseQuery(raw) {
    const q = { content: [], from: [], mentions: [], in: [], has: [], before: null, after: null, during: null, pinned: null };
    const re = /(\w+):("([^"]*)"|\S+)|"([^"]*)"|(\S+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      const key = m[1] && m[1].toLowerCase();
      if (key && FILTERS[key]) {
        const val = (m[3] !== undefined ? m[3] : m[2]).trim();
        if (!val) continue;
        if (FILTERS[key].multi) q[key].push(val.toLowerCase());
        else if (key === 'pinned') q.pinned = val.toLowerCase() === 'true';
        else q[key] = val;
      } else {
        const term = m[4] !== undefined ? m[4] : (m[0]);
        // Un filtre en cours de saisie ("from:") ne doit pas filtrer comme du texte.
        if (term && !(term.endsWith(':') && FILTERS[term.slice(0, -1).toLowerCase()])) q.content.push(term.toLowerCase());
      }
    }
    return q;
  }

  const day = s => { const d = new Date(s + 'T00:00:00'); return isNaN(d) ? null : d; };

  function messageHas(msg, kind) {
    switch (kind) {
      case 'link':  return /https?:\/\/\S+/i.test(msg.content);
      case 'embed': return (msg.embeds || []).length > 0;
      case 'file':  return (msg.attachments || []).length > 0;
      case 'image': return (msg.attachments || []).some(a => /^image\//.test(a.content_type));
      case 'video': return (msg.attachments || []).some(a => /^video\//.test(a.content_type));
      case 'sound': return (msg.attachments || []).some(a => /^audio\//.test(a.content_type));
      default: return false;
    }
  }

  function matches(msg, q, ctx) {
    const text = msg.content.toLowerCase();
    if (!q.content.every(t => text.includes(t))) return false;
    if (q.from.length && !q.from.includes(ctx.users[msg.author_id].name.toLowerCase())) return false;
    if (q.mentions.length && !q.mentions.every(n => (msg.mentions || []).some(id => ctx.users[id].name.toLowerCase() === n))) return false;
    if (q.in.length && !q.in.includes(ctx.channels[msg.channel_id].name.toLowerCase())) return false;
    if (!q.has.every(h => messageHas(msg, h))) return false;
    const t = new Date(msg.timestamp);
    if (q.before && day(q.before) && !(t < day(q.before))) return false;
    if (q.after && day(q.after) && !(t >= new Date(day(q.after).getTime() + 864e5))) return false;
    if (q.during && day(q.during)) { const d0 = day(q.during); if (t < d0 || t >= new Date(d0.getTime() + 864e5)) return false; }
    if (q.pinned !== null && !!msg.pinned !== q.pinned) return false;
    return true;
  }

  // Même forme de réponse que GET /guilds/{id}/messages/search :
  // { total_results, messages: [[message], ...] }, 25 résultats par page via offset.
  function search(ctx, raw, opts = {}) {
    const q = parseQuery(raw);
    const sort = opts.sort_order === 'asc' ? 1 : -1;
    const limit = opts.limit || 25, offset = opts.offset || 0;
    const hits = ctx.messages.filter(m => matches(m, q, ctx))
      .sort((a, b) => sort * (new Date(a.timestamp) - new Date(b.timestamp)));
    return { total_results: hits.length, query: q, messages: hits.slice(offset, offset + limit).map(m => [m]) };
  }

  // Autocomplétion : propose un filtre, puis ses valeurs (utilisateurs, salons, types).
  function suggest(ctx, raw) {
    const tok = raw.split(/\s+/).pop() || '';
    const colon = tok.indexOf(':');
    if (colon === -1) {
      const t = tok.toLowerCase();
      return Object.keys(FILTERS).filter(k => k.startsWith(t))
        .map(k => ({ insert: k + ':', label: k + ':', hint: FILTERS[k].hint }));
    }
    const key = tok.slice(0, colon).toLowerCase(), part = tok.slice(colon + 1).toLowerCase();
    let pool = [];
    if (key === 'from' || key === 'mentions') pool = Object.values(ctx.users).map(u => u.name);
    else if (key === 'in') pool = Object.values(ctx.channels).map(c => c.name);
    else if (FILTERS[key] && FILTERS[key].values) pool = FILTERS[key].values;
    return pool.filter(v => v.toLowerCase().startsWith(part)).slice(0, 8)
      .map(v => ({ insert: key + ':' + (/\s/.test(v) ? '"' + v + '"' : v) + ' ', label: v, hint: key }));
  }

  function highlight(text, terms) {
    const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    let out = esc(text);
    terms.filter(Boolean).forEach(t => {
      const re = new RegExp('(' + esc(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  global.DiscordLikeSearch = { FILTERS, parseQuery, search, suggest, highlight };
})(typeof window !== 'undefined' ? window : globalThis);
