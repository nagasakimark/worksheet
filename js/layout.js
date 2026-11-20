// Plans where every writing band goes. Pure maths (millimetres) - no DOM - so it can be tested in node.
//
// A "band" is one set of four lines. Its height B (top line to bottom line) is the writing size.
// Each item (word or sentence) gets: [black model] [trace x N] [write x N] slots. Slots flow along a band
// and wrap onto the next band, so short words sit on one line and sentences get a band per copy.
// The planner tries every paper direction, column count and size, and keeps the biggest writing
// that still fits every item on the pages allowed.
'use strict';
(function (global) {
  const M = global.NH_METRICS;
  const EM_BAND = (M.lines.top - M.lines.bottom) / M.upm; // band height in em (1.171)
  const BASE_IN_BAND = M.lines.top / M.upm;                 // baseline, em below the top line
  const PIPE = M.rl['|'] / M.upm;

  const PAGE = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } };
  // writing area under the header (page 1 has name + title + instructions, page 2 a small title)
  function area(orient, pageIndex) {
    const p = PAGE[orient];
    const top = pageIndex === 0 ? 41.5 : 25;
    return { x: 12.5, y: top, w: p.w - 25, h: p.h - 9.5 - top };
  }

  // sizes in mm (top line to bottom line)
  const SIZES = { xl: 20, l: 16, m: 12.5, s: 10 };
  const RANGE = { low: { min: 11, max: 19 }, high: { min: 9, max: 15 } };
  const ABS_MIN = 7.5;

  function textW(s, font) {
    const t = font === 'medium' ? M.medium : M.rl;
    let w = 0;
    for (const ch of s) w += t[ch] != null ? t[ch] : t['?'];
    return w / M.upm;
  }

  // JP label height above each band
  function labelSize(B, P) {
    if (!P.showJa) return { f: 0, h: Math.max(1.2, B * 0.12) };
    const test = !P.model && !P.traces;
    const f = test ? Math.min(5.4, Math.max(3.6, B * 0.36)) : Math.min(4.4, Math.max(3, B * 0.28));
    return { f, h: f * 1.32 };
  }
  const innerGap = B => Math.max(3.6, B * 0.48);
  const rowGap = B => Math.max(4.5, B * 0.55);
  const COL_GAP = 7;

  // Break a long sentence into pieces that each fit the band
  function chunk(text, avail, F, font) {
    const words = text.split(' ');
    const out = []; let cur = '';
    for (const w of words) {
      if (textW(w, font) * F > avail) return null;
      const next = cur ? cur + ' ' + w : w;
      if (textW(next, font) * F <= avail) cur = next;
      else { out.push(cur); cur = w; }
    }
    if (cur) out.push(cur);
    return out;
  }

  // Bands for one item. Returns null if a single word is wider than the band.
  function planItem(item, P, B, rowW, extra) {
    const F = B / EM_BAND, gap = 0.55 * F, pad = 0.14 * F, avail = rowW - 2 * pad;
    const font = P.traces && P.traceStyle === 'grey' ? 'medium' : 'rl';
    const kinds = [];
    if (P.model) kinds.push('model');
    for (let i = 0; i < P.traces; i++) kinds.push('trace');
    for (let i = 0; i < P.writes; i++) kinds.push('write');
    const text = item.text;
    const sw = Math.max(textW(text, 'rl'), textW(text, font), P.slotEm || 0) * F;
    const bands = [];
    if (sw <= avail) {
      const k = Math.max(1, Math.floor((avail + gap) / (sw + gap)));
      kinds.forEach((kind, i) => {
        const b = Math.floor(i / k), j = i % k;
        while (bands.length <= b) bands.push({ slots: [] });
        if (kind !== 'write') bands[b].slots.push({ kind, text, x: pad + j * (sw + gap) });
      });
    } else {
      if (P.noChunk) return null;
      const parts = chunk(text, avail, F, font);
      if (!parts) return null;
      for (const kind of kinds) for (const part of parts) bands.push({ slots: kind === 'write' ? [] : [{ kind, text: part, x: pad }] });
    }
    if (!bands.length) bands.push({ slots: [] });
    for (let i = 0; i < extra; i++) bands.push({ slots: [] });
    return { bands, slotW: sw, F };
  }

  function blockHeight(plan, B, lab) {
    const n = plan.bands.length;
    return lab.h + n * B + (n - 1) * innerGap(B);
  }

  // Try one combination. Returns a layout or null.
  function tryLayout(items, P, orient, cols, B, extra, maxPages) {
    const a0 = area(orient, 0);
    const rowW = (a0.w - (cols - 1) * COL_GAP) / cols;
    if (rowW < 30) return null;
    const lab = labelSize(B, P);
    if (P.letters && P.slotEm == null) {
      const font = P.traces && P.traceStyle === 'grey' ? 'medium' : 'rl';
      P = Object.assign({}, P, { slotEm: Math.max(...items.map(it => Math.max(textW(it.text, 'rl'), textW(it.text, font)))) });
    }
    const plans = [];
    for (const it of items) { const p = planItem(it, P, B, rowW, extra); if (!p) return null; plans.push(p); }
    // letter sets: every letter gets the same number of bands (W and M must not break the grid)
    if (P.letters) {
      const nb = Math.max(...plans.map(p => p.bands.length));
      for (const p of plans) while (p.bands.length < nb) p.bands.push({ slots: [] });
    }
    // items side by side get the same number of bands, so each row is an even strip
    const rows = [];
    for (let i = 0; i < items.length; i += cols) {
      const cells = [];
      for (let c = 0; c < cols && i + c < items.length; c++) cells.push({ item: items[i + c], plan: plans[i + c], x: c * (rowW + COL_GAP) });
      const nb = Math.max(...cells.map(c => c.plan.bands.length));
      for (const c of cells) while (c.plan.bands.length < nb) c.plan.bands.push({ slots: [] });
      rows.push({ cells, h: blockHeight(cells[0].plan, B, lab) });
    }
    // paginate
    const pages = [];
    let page = null;
    for (const r of rows) {
      if (page && page.used + rowGap(B) + r.h <= area(orient, pages.length - 1).h + 0.01) {
        page.rows.push(r); page.used += rowGap(B) + r.h;
        continue;
      }
      if (pages.length >= maxPages) return null;
      page = { rows: [r], used: r.h }; pages.push(page);
      if (r.h > area(orient, pages.length - 1).h + 0.01) return null;
    }
    if (!pages.length) pages.push({ rows: [], used: 0 });
    return { orient, cols, B, extra, rowW, lab, pages };
  }

  const STEP = 0.25;
  // Biggest B in [lo, hi] that fits, for one direction + column count
  function bestFor(items, P, orient, cols, lo, hi, maxPages) {
    for (let B = hi; B >= lo - 1e-9; B -= STEP) {
      const L = tryLayout(items, P, orient, cols, +B.toFixed(2), 0, maxPages);
      if (L) return L;
    }
    return null;
  }

  // Prefer sentences on one line each; wrap them only if nothing else fits.
  function choose(items, P, lo, hi, maxPages) {
    return chooseOnce(items, Object.assign({}, P, { noChunk: true }), lo, hi, maxPages) || chooseOnce(items, P, lo, hi, maxPages);
  }
  function chooseOnce(items, P, lo, hi, maxPages) {
    const orients = P.orient === 'auto' ? ['portrait', 'landscape'] : [P.orient];
    const best = {};
    for (const o of orients) {
      for (let cols = 1; cols <= 4; cols++) {
        const L = bestFor(items, P, o, cols, lo, hi, maxPages);
        // fewer columns win unless more columns give clearly bigger writing
        if (L && (!best[o] || L.B > best[o].B + 0.6)) best[o] = L;
      }
    }
    const p = best.portrait, l = best.landscape;
    if (p && l) return l.B >= p.B * 1.12 ? l : p;
    return p || l || null;
  }

  // Add extra blank bands while they still fit, then spread what is left over.
  function finish(items, P, L, maxPages) {
    if (P.fill && items.length) {
      const pagesNow = L.pages.length;
      for (let e = 1; e <= 8; e++) {
        const T = tryLayout(items, P, L.orient, L.cols, L.B, e, Math.min(maxPages, pagesNow));
        if (!T) break;
        L = T;
      }
    }
    for (let pi = 0; pi < L.pages.length; pi++) {
      const pg = L.pages[pi], a = area(L.orient, pi);
      const n = pg.rows.length;
      const g0 = rowGap(L.B);
      const left = a.h - pg.used;
      const isLast = pi === L.pages.length - 1;
      // spread a little on full pages; on a part-filled last page keep normal spacing
      const add = n > 1 ? Math.min(L.B * 0.35, Math.max(0, left) / (n - 1)) : 0;
      const g = isLast && pi > 0 && left > a.h * 0.35 ? g0 : g0 + add;
      let y = a.y;
      for (const r of pg.rows) { r.y = y; y += r.h + g; }
      pg.area = a;
    }
    return L;
  }

  // Blank 4-line paper: fill the pages with bands
  function blank(P, maxPages) {
    const orient = P.orient === 'auto' ? 'portrait' : P.orient;
    const B = P.size !== 'auto' ? SIZES[P.size] : (P.grade === 'low' ? 15 : 12);
    const lab = { f: 0, h: 0 };
    const pages = [];
    for (let pi = 0; pi < maxPages; pi++) {
      const a = area(orient, pi);
      const g = Math.max(4, B * 0.55);
      const n = Math.max(1, Math.floor((a.h + g) / (B + g)));
      const gg = n > 1 ? (a.h - n * B) / (n - 1) : 0;
      const rows = [];
      for (let i = 0; i < n; i++) rows.push({ y: a.y + i * (B + gg), h: B, cells: [{ item: null, x: 0, plan: { bands: [{ slots: [] }], F: B / EM_BAND } }] });
      pages.push({ rows, area: a, used: a.h });
    }
    return { orient, cols: 1, B, rowW: area(orient, 0).w, lab, pages, used: 0, total: 0, notes: [] };
  }

  // Main entry. items: [{ text, ja }]. P: options (see app.js).
  function plan(items, P) {
    const maxPages = P.pages;
    if (P.blank) return blank(P, maxPages);
    const notes = [];
    const R = P.letters ? { min: P.grade === 'low' ? 12 : 10, max: 22 } : RANGE[P.grade];
    let lo = R.min, hi = R.max;
    if (P.size !== 'auto') lo = hi = SIZES[P.size];
    const all = items;
    if (!all.length) return { empty: true, notes: ['The list is empty – add some words.'] };

    let use = all, L = null;
    if (P.count !== 'auto' && P.count !== 'all') use = all.slice(0, +P.count);
    if (P.count !== 'auto') {
      L = choose(use, P, P.size === 'auto' ? Math.min(lo, ABS_MIN) : lo, hi, maxPages);
      if (L && P.size === 'auto' && L.B < lo) notes.push(`To fit all ${use.length}, the writing is smaller than usual (${L.B} mm).`);
    } else {
      L = choose(use, P, lo, hi, maxPages);
      // Lists that belong together (months, days, ABC, short lists) keep every item:
      // write fewer times first, then trace fewer times, and only then go smaller.
      if (!L && P.keepAll) {
        const Q = Object.assign({}, P), was = { writes: P.writes, traces: P.traces };
        while (!L && Q.writes > 1) { Q.writes--; L = choose(use, Q, lo, hi, maxPages); }
        while (!L && Q.traces > 1) { Q.traces--; L = choose(use, Q, lo, hi, maxPages); }
        if (!L) { L = choose(use, Q, ABS_MIN, hi, maxPages); if (L) notes.push(`The writing is smaller than usual (${L.B} mm) so all ${use.length} fit.`); }
        if (L) {
          const ch = [];
          if (Q.writes < was.writes) ch.push(`write ${Q.writes}× (not ${was.writes}×)`);
          if (Q.traces < was.traces) ch.push(`trace ${Q.traces}× (not ${was.traces}×)`);
          if (ch.length) notes.push(`So all ${use.length} fit ${maxPages === 1 ? 'on one side' : 'on two sides'}: ${ch.join(', ')}. Choose 2 sides or fewer items for more practice.`);
          P = Q;
        }
      }
    }
    if (!L) {
      // too many: keep as many as fit at a comfortable size
      const pref = P.size === 'auto' ? +(lo + (hi - lo) * 0.3).toFixed(1) : lo;
      let a = 1, b = use.length - 1, got = null;
      while (a <= b) {
        const mid = (a + b) >> 1;
        const T = choose(use.slice(0, mid), P, pref, hi, maxPages);
        if (T) { got = { n: mid, T }; a = mid + 1; } else b = mid - 1;
      }
      if (!got) {
        const one = choose(use.slice(0, 1), P, ABS_MIN, hi, maxPages);
        if (!one) return { empty: true, notes: ['"' + use[0].text + '" is too long to fit across the paper. Shorten it or split it.'] };
        got = { n: 1, T: one };
      }
      L = got.T;
      const left = all.length - got.n;
      notes.push(`${got.n} of ${all.length} ${P.sentences ? 'sentences' : 'words'} fit` +
        (maxPages === 1 ? ' on one side' : ' on two sides') + ` at this size (${left} left out).` +
        (P.mix ? ' Press 🎲 for a different mix.' : ' Try 🎲 Mix, 2 pages, or a smaller size.'));
      use = use.slice(0, got.n);
    }
    L = finish(use, P, L, maxPages);
    L.used = use.length; L.total = all.length; L.notes = notes; L.P = P;
    return L;
  }

  global.Layout = { plan, innerGap, textW, area, PAGE, SIZES, RANGE, EM_BAND, BASE_IN_BAND, PIPE };
})(typeof window !== 'undefined' ? window : globalThis);
