// Draws the A4 pages from a Layout plan. Header boxes are HTML (same style as Puzzle Sheet);
// the writing bands are one SVG per page so every line sits exactly where the planner put it.
//
// Each band is drawn as: model / trace letters first, then a row of '|' in the NH RL font on top.
// '|' is a piece of the four lines in that font, so the guide lines match the letters perfectly.
'use strict';
(function (global) {
  const MM = 3.7795275591;
  const LY = global.Layout;

  const TXT = {
    kana: {
      grey: 'うすい 字を なぞってから、じぶんで 書こう！',
      arrow: 'やじるしの むきに なぞってから、じぶんで 書こう！',
      model: 'お手本を 見て、4線に 書こう！',
      test: '日本語を 見て、英語で 書こう！',
      blank: '4線に ていねいに 書こう！',
      names: 'じぶんの 名前を なぞってから、書いてみよう！',
    },
    kanji: {
      grey: 'うすい字をなぞってから、自分で書きましょう。',
      arrow: 'やじるしの向きになぞってから、自分で書きましょう。',
      model: 'お手本を見て、4線に書きましょう。',
      test: '日本語を見て、英語で書きましょう。',
      blank: '4線にていねいに書きましょう。',
      names: '自分の名前をなぞってから、ていねいに書きましょう。',
    },
    en: { grey: 'Trace and write!', arrow: 'Trace and write!', model: 'Look and write!', test: 'Write in English!', blank: "Let's write!", names: 'Write your name!' },
  };
  function instKind(m) {
    if (m.blank) return 'blank';
    if (m.names) return 'names';
    if (m.P.traces) return m.P.traceStyle === 'arrow' ? 'arrow' : 'grey';
    return m.P.model ? 'model' : 'test';
  }

  // ---------- DOM helpers ----------
  function el(tag, cls, style, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (style) for (const k in style) e.style[k] = typeof style[k] === 'number' ? style[k] + 'mm' : style[k];
    if (html != null) e.innerHTML = html;
    return e;
  }
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function box(page, x, y, w, h, cls, html, fit) {
    const e = el('div', 'abs ' + (cls || ''), { left: x, top: y, width: w, height: h }, html);
    if (fit) { e.dataset.fit = fit.max + ',' + fit.min; e.style.fontSize = fit.max + 'mm'; }
    page.appendChild(e);
    return e;
  }
  const PENCIL = '<svg viewBox="0 0 24 24"><path d="M4 20l1.2-4.6L16.4 4.2a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8Z" fill="none" stroke="#000" stroke-width="1.8" stroke-linejoin="round"/><path d="M14.6 6l3.4 3.4M5.2 15.4l3.4 3.4" stroke="#000" stroke-width="1.6"/></svg>';

  // ---------- header ----------
  function header(page, m, pageIndex, W) {
    if (pageIndex > 0) {
      const tw = Math.min(140, W - 60);
      const t = box(page, (W - tw) / 2, 9.5, tw, 11, 'pill title-pill small', '<span class="fit-text">' + esc(m.title) + '</span>');
      t.dataset.title = 'small';
      return;
    }
    // name row: 名前 ____________   ___年 ___組 ___番
    const y = 8.6, h = 6.6, R = W - 13;
    const fields = [['番', 9], ['組', 8], ['年', 8]];
    let x = R;
    const st = m.student || {};
    const fill = { '番': st.num, '組': st.cls, '年': st.year };
    for (const [label, gapW] of fields) {
      x -= 4.4; box(page, x, y, 4.4, h, 'namefield', label);
      x -= gapW; box(page, x, y, gapW, h, 'nameline filled', fill[label] != null ? esc(fill[label]) : '');
      x -= 2;
    }
    box(page, 13.5, y, 10, h, 'namefield', '名前');
    box(page, 23.5, y, x - 6 - 23.5, h, 'nameline');
    const tw = Math.min(172, W - 40);
    const t = box(page, (W - tw) / 2, 16.4, tw, 13.4, 'pill title-pill', '<span class="fit-text">' + esc(m.title) + '</span>');
    t.dataset.title = 'big';
    const k = instKind(m);
    const html = '<span class="inst-icon">' + PENCIL + '</span><span class="inst-jp">' + esc(TXT[m.kana][k]) +
      '</span><span class="inst-en">' + esc(TXT.en[k]) + '</span>';
    box(page, 14, 31.2, W - 28, 8, 'inst', html, { max: 4.9, min: 3 });
  }

  // ---------- writing bands ----------
  let ctx = null;
  function jaWidth(text, f) {
    ctx = ctx || document.createElement('canvas').getContext('2d');
    ctx.font = `${f * 10}px "Noto Sans JP"`;
    return ctx.measureText(text).width / 10;
  }
  function bandsSvg(m, pg, W, H) {
    const L = m.L;
    let s = '';
    for (const row of pg.rows) {
      const B = row.B || L.B, lab = row.lab || L.lab, inner = LY.innerGap(B);
      for (const cell of row.cells) {
        const cx = pg.area.x + cell.x, F = cell.plan.F;
        const rowW = L.rowW;
        if (lab.f && cell.item && cell.item.ja) {
          const f = lab.f, tw = jaWidth(cell.item.ja, f);
          const fit = tw > rowW - 1 ? ` textLength="${(rowW - 1).toFixed(2)}" lengthAdjust="spacingAndGlyphs"` : '';
          s += `<text class="${cell.item.sec ? 'sec' : 'ja'}" x="${(cx + 0.6).toFixed(2)}" y="${(row.y + f * 0.98).toFixed(2)}" font-size="${f.toFixed(2)}"${fit}>${esc(cell.item.ja)}</text>`;
        }
        const n = Math.max(1, Math.round(rowW / (LY.PIPE * F)));
        const pipes = '|'.repeat(n);
        cell.plan.bands.forEach((band, bi) => {
          const top = row.y + lab.h + bi * (B + inner);
          const base = (top + LY.BASE_IN_BAND * F).toFixed(2);
          for (const sl of band.slots) {
            const cls = sl.kind === 'model' ? 'nh-model' : m.P.traceStyle === 'arrow' ? 'nh-arrow' : 'nh-grey';
            s += `<text class="${cls}" x="${(cx + sl.x).toFixed(2)}" y="${base}" font-size="${F.toFixed(3)}">${esc(sl.text)}</text>`;
          }
          s += `<text class="nh-lines" x="${cx.toFixed(2)}" y="${base}" font-size="${F.toFixed(3)}" textLength="${rowW.toFixed(2)}" lengthAdjust="spacingAndGlyphs">${pipes}</text>`;
        });
      }
    }
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', W + 'mm'); svg.setAttribute('height', H + 'mm');
    svg.setAttribute('class', 'bands');
    svg.innerHTML = s;
    return svg;
  }

  function build(m) {
    const P = LY.PAGE[m.L.orient];
    return m.L.pages.map((pg, i) => {
      const page = el('div', 'page ' + m.L.orient);
      page.appendChild(el('div', 'panel abs', { left: 6, top: 6, width: P.w - 12, height: P.h - 12 }));
      header(page, m, i, P.w);
      page.appendChild(bandsSvg(m, pg, P.w, P.h));
      return page;
    });
  }

  // ---------- shrink-to-fit text (same approach as Puzzle Sheet) ----------
  function overflows(e) { return e.scrollWidth > e.clientWidth + 0.5 || e.scrollHeight > e.clientHeight + 0.5; }
  function fitAll(root) {
    root.querySelectorAll('[data-title]').forEach(fitTitle);
    root.querySelectorAll('[data-fit]').forEach(e => {
      const [max, min] = e.dataset.fit.split(',').map(parseFloat);
      let f = max; e.style.fontSize = f + 'mm';
      while (f > min && overflows(e)) { f = Math.max(min, f - 0.1); e.style.fontSize = f.toFixed(2) + 'mm'; }
      e.classList.toggle('overflow', overflows(e));
    });
  }
  function fitTitle(e) {
    const span = e.querySelector('.fit-text');
    const big = e.dataset.title === 'big';
    e.classList.remove('two');
    let f = big ? 9 : 6.6; span.style.fontSize = f + 'mm';
    const tooWide = () => span.scrollWidth > e.clientWidth - 8 * MM || span.offsetHeight > e.clientHeight;
    while (f > (big ? 6 : 4.4) && tooWide()) { f -= 0.1; span.style.fontSize = f + 'mm'; }
    if (!tooWide()) return;
    if (!big) { while (f > 3 && tooWide()) { f -= 0.1; span.style.fontSize = f + 'mm'; } e.classList.toggle('overflow', tooWide()); return; }
    e.classList.add('two'); f = 6; span.style.fontSize = f + 'mm';
    const tooBig = () => span.scrollWidth > span.clientWidth + 1 || span.offsetHeight > e.clientHeight - 0.8 * MM;
    while (f > 3.2 && tooBig()) { f -= 0.1; span.style.fontSize = f + 'mm'; }
    e.classList.toggle('overflow', tooBig());
  }

  global.Render = { build, fitAll, TXT };
})(window);
