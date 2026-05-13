/* First Class Agency — premium rank system.
   16 ranks total. MONTHLY — resets on the 1st of each month (America/New_York).
   Single source of truth, used by dashboard widget, leaderboard pills, and
   rank-up modal.

     Copper IV → III → II → I       ($0 → $14,999)        ramping up
     Silver IV → III → II → I       ($15k → $24,999)      real producer month
     Gold   IV → III → II → I       ($25k → $39,999)      heater month
     Platinum  III → II → I         ($40k → $99,999)      hall-of-fame month
     Champion                        ($100k+)              legendary month
*/
(function () {
  const RANKS = [
    { key: 'bronze-iv',    tier: 'Copper',   sub: 'IV',  min: 0,      pips: 1, totalPips: 4, color: 'bronze' },
    { key: 'bronze-iii',   tier: 'Copper',   sub: 'III', min: 4000,   pips: 2, totalPips: 4, color: 'bronze' },
    { key: 'bronze-ii',    tier: 'Copper',   sub: 'II',  min: 8000,   pips: 3, totalPips: 4, color: 'bronze' },
    { key: 'bronze-i',     tier: 'Copper',   sub: 'I',   min: 12000,  pips: 4, totalPips: 4, color: 'bronze' },
    { key: 'silver-iv',    tier: 'Silver',   sub: 'IV',  min: 15000,  pips: 1, totalPips: 4, color: 'silver' },
    { key: 'silver-iii',   tier: 'Silver',   sub: 'III', min: 17500,  pips: 2, totalPips: 4, color: 'silver' },
    { key: 'silver-ii',    tier: 'Silver',   sub: 'II',  min: 20000,  pips: 3, totalPips: 4, color: 'silver' },
    { key: 'silver-i',     tier: 'Silver',   sub: 'I',   min: 22500,  pips: 4, totalPips: 4, color: 'silver' },
    { key: 'gold-iv',      tier: 'Gold',     sub: 'IV',  min: 25000,  pips: 1, totalPips: 4, color: 'gold' },
    { key: 'gold-iii',     tier: 'Gold',     sub: 'III', min: 29000,  pips: 2, totalPips: 4, color: 'gold' },
    { key: 'gold-ii',      tier: 'Gold',     sub: 'II',  min: 33000,  pips: 3, totalPips: 4, color: 'gold' },
    { key: 'gold-i',       tier: 'Gold',     sub: 'I',   min: 37000,  pips: 4, totalPips: 4, color: 'gold' },
    { key: 'platinum-iii', tier: 'Platinum', sub: 'III', min: 40000,  pips: 1, totalPips: 3, color: 'platinum' },
    { key: 'platinum-ii',  tier: 'Platinum', sub: 'II',  min: 60000,  pips: 2, totalPips: 3, color: 'platinum' },
    { key: 'platinum-i',   tier: 'Platinum', sub: 'I',   min: 80000,  pips: 3, totalPips: 3, color: 'platinum' },
    { key: 'champion',     tier: 'Champion', sub: null,  min: 100000, pips: 0, totalPips: 0, color: 'champion' },
  ];

  // Returns the current calendar month key in America/New_York, e.g. "2026-05".
  function currentMonthKey() {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
    });
    const parts = fmt.formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year').value;
    const m = parts.find((p) => p.type === 'month').value;
    return y + '-' + m;
  }
  function currentMonthLabel() {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'long',
    });
    return fmt.format(new Date());
  }

  function rankFor(amount) {
    const v = Number(amount) || 0;
    let current = RANKS[0];
    for (const r of RANKS) {
      if (v >= r.min) current = r; else break;
    }
    return current;
  }
  function rankByKey(key) {
    return RANKS.find((r) => r.key === key) || null;
  }
  function rankIndex(key) {
    return RANKS.findIndex((r) => r.key === key);
  }
  function nextRank(key) {
    const i = rankIndex(key);
    if (i < 0 || i >= RANKS.length - 1) return null;
    return RANKS[i + 1];
  }
  function progressToNext(amount) {
    const v = Number(amount) || 0;
    const current = rankFor(v);
    const next = nextRank(current.key);
    if (!next) return { current, next: null, pct: 100, remaining: 0, filled: v - current.min };
    const span = next.min - current.min;
    const filled = v - current.min;
    return {
      current,
      next,
      pct: Math.max(0, Math.min(100, Math.round((filled / span) * 100))),
      remaining: Math.max(0, next.min - v),
      filled,
    };
  }
  function rankLabel(rank) {
    if (!rank) return '';
    return rank.sub ? `${rank.tier} ${rank.sub}` : rank.tier;
  }
  function formatMoney(n) {
    const v = Number(n) || 0;
    return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }

  // ------------------- EMBLEM SVG GENERATION --------------------
  // Each rank's emblem is built from layered shapes. ID suffix prevents
  // gradient ID collisions when multiple emblems render on the same page.
  let emblemSeq = 0;

  const COLORS = {
    bronze:   { grad: ['#e69a52', '#b06a2a', '#5c3416'], face: ['#d18d4c', '#7a4218'], stroke: '#5c3416', faceStroke: '#7a4218', chevron: '#fbe4c4', text: '#5c3416' },
    silver:   { grad: ['#f3f4f6', '#b9bdc4', '#5d6168'], face: ['#e1e3e8', '#8b8f96'], stroke: '#5d6168', faceStroke: '#8b8f96', chevron: '#ffffff', text: '#3a3d42' },
    gold:     { grad: ['#fff0a3', '#e6b34a', '#7a5212'], face: ['#ffd86a', '#b07f1c'], stroke: '#7a5212', faceStroke: '#b07f1c', chevron: '#fff8d8', text: '#7a5212' },
    platinum: { grad: ['#dffaff', '#7fc7e3', '#2c5d78'], face: ['#c6edfa', '#4d8aa6'], stroke: '#2c5d78', faceStroke: '#4d8aa6', chevron: '#ffffff', text: '#2c5d78' },
    champion: { grad: ['#1aa3df', '#0078ab', '#08334a'], face: ['#1f9bd0', '#0a4d70'], stroke: '#042c44', faceStroke: '#063f5e', chevron: '#fff8d8', text: '#0078ab' },
  };

  function gradientDefs(id, c) {
    return `
      <linearGradient id="g${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.grad[0]}"/>
        <stop offset="0.5" stop-color="${c.grad[1]}"/>
        <stop offset="1" stop-color="${c.grad[2]}"/>
      </linearGradient>
      <linearGradient id="f${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c.face[0]}"/>
        <stop offset="1" stop-color="${c.face[1]}"/>
      </linearGradient>`;
  }
  const SHIELD_PATH = 'M40 2 L74 14 L74 56 Q74 76 40 96 Q6 76 6 56 L6 14 Z';

  function chevrons(count, c) {
    // Three slots, top to bottom: y=30, 42, 54, 66
    const baseY = count === 1 ? 54 : count === 2 ? 44 : 30;
    const step  = 12;
    let out = '';
    for (let i = 0; i < count; i++) {
      const y = baseY + i * step;
      out += `<path d="M22 ${y + 12} L40 ${y} L58 ${y + 12}" fill="none" stroke="${c.chevron}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    }
    return out;
  }

  function emblemBronze(id, c) {
    return `
      <path d="${SHIELD_PATH}" fill="url(#g${id})" stroke="${c.stroke}" stroke-width="2"/>
      <path d="M40 8 L68 18 L68 56 Q68 73 40 90 Q12 73 12 56 L12 18 Z" fill="url(#f${id})" stroke="${c.faceStroke}" stroke-width="1"/>
      ${chevrons(1, c)}`;
  }
  function emblemSilver(id, c) {
    return `
      <path d="${SHIELD_PATH}" fill="url(#g${id})" stroke="${c.stroke}" stroke-width="2"/>
      <path d="M40 8 L68 18 L68 56 Q68 73 40 90 Q12 73 12 56 L12 18 Z" fill="url(#f${id})" stroke="${c.faceStroke}" stroke-width="1"/>
      <path d="M40 12 L64 21 L64 55 Q64 70 40 85 Q16 70 16 55 L16 21 Z" fill="none" stroke="#ffffff" stroke-width="0.8" opacity="0.7"/>
      <circle cx="14" cy="20" r="2" fill="#ffffff"/>
      <circle cx="66" cy="20" r="2" fill="#ffffff"/>
      ${chevrons(2, c)}`;
  }
  function emblemGold(id, c) {
    return `
      <path d="M-4 30 Q4 26 10 36 Q14 44 6 50 Q-2 44 -4 30 Z" fill="url(#f${id})" stroke="${c.stroke}" stroke-width="0.8"/>
      <path d="M84 30 Q76 26 70 36 Q66 44 74 50 Q82 44 84 30 Z" fill="url(#f${id})" stroke="${c.stroke}" stroke-width="0.8"/>
      <path d="${SHIELD_PATH}" fill="url(#g${id})" stroke="${c.stroke}" stroke-width="2"/>
      <path d="M40 8 L68 18 L68 56 Q68 73 40 90 Q12 73 12 56 L12 18 Z" fill="url(#f${id})" stroke="${c.faceStroke}" stroke-width="1"/>
      <path d="M40 12 L64 21 L64 55 Q64 70 40 85 Q16 70 16 55 L16 21 Z" fill="none" stroke="${c.chevron}" stroke-width="0.8" opacity="0.6"/>
      <polygon points="40,18 42,24 48,24 43,27 45,33 40,30 35,33 37,27 32,24 38,24" fill="${c.chevron}" stroke="${c.stroke}" stroke-width="0.4"/>
      ${chevrons(3, c)}`;
  }
  function emblemPlatinum(id, c) {
    return `
      <path d="M-6 40 L0 36 L4 44 L10 40 L8 50 L-2 50 Z" fill="url(#f${id})" stroke="${c.stroke}" stroke-width="0.8"/>
      <path d="M86 40 L80 36 L76 44 L70 40 L72 50 L82 50 Z" fill="url(#f${id})" stroke="${c.stroke}" stroke-width="0.8"/>
      <path d="M40 -2 L46 6 L52 0 L56 8 L66 4 L62 14 L74 14 L74 56 Q74 76 40 96 Q6 76 6 56 L6 14 L18 14 L14 4 L24 8 L28 0 L34 6 Z" fill="url(#g${id})" stroke="${c.stroke}" stroke-width="2"/>
      <path d="M40 14 L68 22 L68 56 Q68 73 40 90 Q12 73 12 56 L12 22 Z" fill="url(#f${id})" stroke="${c.faceStroke}" stroke-width="1"/>
      <circle cx="22" cy="14" r="2" fill="#dffaff" stroke="${c.stroke}" stroke-width="0.5"/>
      <circle cx="40" cy="6" r="2.5" fill="#dffaff" stroke="${c.stroke}" stroke-width="0.5"/>
      <circle cx="58" cy="14" r="2" fill="#dffaff" stroke="${c.stroke}" stroke-width="0.5"/>
      <polygon points="40,30 56,52 40,76 24,52" fill="#e8f9ff" stroke="#7fc7e3" stroke-width="1.5"/>
      <polygon points="40,30 56,52 40,52" fill="#ffffff" opacity="0.8"/>
      <polygon points="40,52 56,52 40,76" fill="#9ed8ec" opacity="0.6"/>
      <line x1="40" y1="30" x2="40" y2="76" stroke="#5d8aa8" stroke-width="0.5" opacity="0.5"/>
      <line x1="24" y1="52" x2="56" y2="52" stroke="#5d8aa8" stroke-width="0.5" opacity="0.5"/>`;
  }
  function emblemChampion(id, c, includeAura) {
    const aura = includeAura ? `
      <radialGradient id="a${id}" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#1aa3df" stop-opacity="0.55"/>
        <stop offset="1" stop-color="#0078ab" stop-opacity="0"/>
      </radialGradient>
    ` : '';
    const auraCircles = includeAura ? `
      <circle cx="40" cy="56" r="50" fill="url(#a${id})">
        <animate attributeName="r" values="46;60;46" dur="2.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.85;0.35;0.85" dur="2.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx="40" cy="56" r="42" fill="none" stroke="#1aa3df" stroke-width="1.2" opacity="0.6">
        <animate attributeName="r" values="40;50;40" dur="2.6s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.7;0;0.7" dur="2.6s" repeatCount="indefinite"/>
      </circle>
    ` : '';
    return `
      ${aura}
      ${auraCircles}
      <path d="M-4 26 Q-6 38 0 50 Q6 62 14 66 Q22 70 24 78 Q18 76 12 70 Q4 60 -2 48 Q-6 36 -4 26 Z" fill="url(#f${id})" stroke="#7a5212" stroke-width="0.6"/>
      <ellipse cx="6" cy="44" rx="2" ry="4" fill="#fff8d8" opacity="0.7"/>
      <ellipse cx="12" cy="56" rx="2" ry="4" fill="#fff8d8" opacity="0.7"/>
      <ellipse cx="18" cy="66" rx="2" ry="4" fill="#fff8d8" opacity="0.7"/>
      <path d="M84 26 Q86 38 80 50 Q74 62 66 66 Q58 70 56 78 Q62 76 68 70 Q76 60 82 48 Q86 36 84 26 Z" fill="url(#f${id})" stroke="#7a5212" stroke-width="0.6"/>
      <ellipse cx="74" cy="44" rx="2" ry="4" fill="#fff8d8" opacity="0.7"/>
      <ellipse cx="68" cy="56" rx="2" ry="4" fill="#fff8d8" opacity="0.7"/>
      <ellipse cx="62" cy="66" rx="2" ry="4" fill="#fff8d8" opacity="0.7"/>
      <path d="M18 -4 L24 6 L32 -2 L40 8 L48 -2 L56 6 L62 -4 L62 14 L18 14 Z" fill="#e6b34a" stroke="#7a5212" stroke-width="1.2"/>
      <circle cx="24" cy="2" r="2" fill="#fff8d8"/>
      <circle cx="40" cy="-2" r="2.5" fill="#fff8d8"/>
      <circle cx="56" cy="2" r="2" fill="#fff8d8"/>
      <circle cx="40" cy="6" r="3" fill="#0078ab" stroke="#fff8d8" stroke-width="0.8"/>
      <path d="M40 14 L74 26 L74 56 Q74 76 40 96 Q6 76 6 56 L6 26 Z" fill="url(#g${id})" stroke="${c.stroke}" stroke-width="2"/>
      <path d="M40 20 L68 30 L68 56 Q68 73 40 90 Q12 73 12 56 L12 30 Z" fill="url(#f${id})" stroke="${c.faceStroke}" stroke-width="1"/>
      <polygon points="40,38 47,55 65,57 51,68 56,86 40,76 24,86 29,68 15,57 33,55" fill="#e6b34a" stroke="#7a5212" stroke-width="1"/>
      <polygon points="40,38 47,55 40,55" fill="#fff8d8" opacity="0.6"/>`;
  }

  function pipsSvg(rank) {
    if (rank.color === 'champion' || rank.totalPips === 0) return '';
    const total = rank.totalPips;
    const filled = rank.pips;
    const c = COLORS[rank.color];
    const pipY = rank.color === 'platinum' || rank.color === 'champion' ? 108 : 108;
    const spacing = 12;
    const startX = 40 - ((total - 1) * spacing) / 2;
    let out = '';
    for (let i = 0; i < total; i++) {
      const cx = startX + i * spacing;
      out += i < filled
        ? `<circle cx="${cx}" cy="${pipY}" r="3.5" fill="${c.stroke}" stroke="${c.text}" stroke-width="0.5"/>`
        : `<circle cx="${cx}" cy="${pipY}" r="3.5" fill="none" stroke="${c.stroke}" stroke-width="1" opacity="0.45"/>`;
    }
    return out;
  }

  function emblemSvg(rankOrAmount, opts) {
    opts = opts || {};
    const size = opts.size || 80;
    const showPips = opts.showPips !== false;
    const animate = opts.animate !== false; // champion aura on by default
    const rank = typeof rankOrAmount === 'number'
      ? rankFor(rankOrAmount)
      : (rankByKey(rankOrAmount) || rankFor(0));
    const c = COLORS[rank.color];
    const id = (++emblemSeq).toString(36);

    let body;
    if (rank.color === 'bronze')        body = emblemBronze(id, c);
    else if (rank.color === 'silver')   body = emblemSilver(id, c);
    else if (rank.color === 'gold')     body = emblemGold(id, c);
    else if (rank.color === 'platinum') body = emblemPlatinum(id, c);
    else                                body = emblemChampion(id, c, animate);

    // Champion has no pips; others get the pip row when requested.
    const pipRow = (showPips && rank.color !== 'champion') ? pipsSvg(rank) : '';

    // Champion needs taller viewBox for aura; others use 0..115 for shield + pips
    const isChampion = rank.color === 'champion';
    const viewBox = isChampion ? '-12 -12 104 124' : '-10 -8 100 124';
    const h = Math.round(size * 1.2);

    return `<svg class="rank-emblem rank-emblem-${rank.color}" width="${size}" height="${h}" viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-label="${rankLabel(rank)} rank emblem">
      <defs>${gradientDefs(id, c)}</defs>
      ${body}
      ${pipRow}
    </svg>`;
  }

  // Small inline pill for use in leaderboard rows, sidebar chip, etc.
  function pillHtml(rankOrAmount) {
    const rank = typeof rankOrAmount === 'number'
      ? rankFor(rankOrAmount)
      : (rankByKey(rankOrAmount) || rankFor(0));
    return `<span class="rank-pill rank-pill-${rank.color}" title="${rankLabel(rank)}">${rankLabel(rank)}</span>`;
  }

  window.FCA_RANKS = {
    RANKS,
    rankFor,
    rankByKey,
    rankIndex,
    nextRank,
    progressToNext,
    rankLabel,
    formatMoney,
    emblemSvg,
    pillHtml,
    currentMonthKey,
    currentMonthLabel,
  };
})();
