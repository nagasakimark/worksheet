// UI: pick a list, choose how much tracing / writing, preview, print.
'use strict';
(function () {
  const D = window.PS_DATA, LY = window.Layout, R = window.Render, M = window.NH_METRICS;
  const $ = id => document.getElementById(id);
  const BOOKS = D.books.concat([{ id: 'custom', name: 'My own list', kind: 'custom', grade: 5, units: [] }]);
  const BOOK_SHORT = { basics: 'ABC & Basics', lt1: "Let's Try 1", lt2: "Let's Try 2", nh5: 'New Horizon 5', nh6: 'New Horizon 6', mpd: 'Picture Dictionary', theme: 'Themes', custom: 'My own list' };
  const DEF_OPT = {
    words: { traces: 2, traceStyle: 'grey', writes: 2, model: false, showJa: true, fill: true },
    sentences: { traces: 1, traceStyle: 'grey', writes: 1, model: false, showJa: true, fill: true },
  };

  const store = {
    get() { try { return JSON.parse(localStorage.getItem('worksheet') || '{}'); } catch (e) { return {}; } },
    set(v) { try { localStorage.setItem('worksheet', JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const saved = store.get();
  const state = Object.assign({
    book: 'basics', unit: 'b-months', mode: 'words', grade: null, size: 'auto', orient: 'auto', pages: 1,
    count: 'auto', order: 'list', seed: 1, letterCase: 'as',
    title: null, words: null, sentences: null, custom: { words: '', sentences: '', title: 'WRITING PRACTICE' },
  }, saved);
  state.opt = { words: Object.assign({}, DEF_OPT.words, (saved.opt || {}).words), sentences: Object.assign({}, DEF_OPT.sentences, (saved.opt || {}).sentences) };

  // ---------- list helpers ----------
  const book = () => BOOKS.find(b => b.id === state.book) || BOOKS[0];
  const unit = () => { const b = book(); return b.units.find(u => u.id === state.unit) || b.units[0] || null; };
  const isCustom = () => book().kind === 'custom';
  const isBlank = () => !!(unit() && unit().blank);
  const isLetters = () => !!(unit() && unit().letters);
  const hasSentences = () => isCustom() || !!(unit() && unit().sentences && unit().sentences.length && !unit().phrases);
  const mode = () => (state.mode === 'sentences' && hasSentences() && !isLetters() && !isBlank()) ? 'sentences' : 'words';
  const opt = () => state.opt[mode()];
  const grade = () => state.grade || (book().grade <= 4 ? 'low' : 'high');

  function defaultTitle(b, u) {
    if (!u) return state.custom.title || 'WRITING PRACTICE';
    if (b.kind === 'unit') return ('UNIT ' + u.unit + ' - ' + u.title).toUpperCase();
    if (b.kind === 'category') return ('PICTURE DICTIONARY - ' + u.label).toUpperCase();
    return u.title.toUpperCase();
  }
  const listToText = ws => ws.map(w => w.ja ? `${w.en} = ${w.ja}` : w.en).join('\n');

  // Characters the handwriting font does not have are swapped or dropped
  const SWAP = { '–': '-', '—': '-', '−': '-', '…': '...', '´': "'", '`': "'", '　': ' ' };
  function cleanText(s, bad) {
    let t = String(s).normalize('NFKC').replace(/[–—−…´`　]/g, c => SWAP[c]);
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
    let out = '';
    for (const ch of t) { if (M.rl[ch] != null && ch !== '|') out += ch; else bad.add(ch); }
    return out.replace(/\s+/g, ' ').trim();
  }
  function parseList(text, bad) {
    const out = [], seen = new Set();
    for (let line of String(text || '').split(/\r?\n/)) {
      line = line.trim(); if (!line) continue;
      let en = line, ja = '';
      const m = line.match(/^(.*?)\s*(?:=|＝|\t)\s*(.*)$/);
      if (m) { en = m[1].trim(); ja = m[2].trim(); }
      en = cleanText(en, bad);
      if (!en || !/[A-Za-z0-9]/.test(en)) continue;
      const k = en.toLowerCase();
      if (seen.has(k)) continue; seen.add(k);
      if (!ja) ja = D.dict[k] || D.dict[k.replace(/[.!?]$/, '')] || D.dict[k.replace(/s$/, '')] || '';
      out.push({ text: en, ja: ja.slice(0, 40) });
    }
    return out;
  }
  function rand(seed) { // mulberry32
    let a = 0; for (const ch of String(seed)) a = (a * 31 + ch.charCodeAt(0)) | 0;
    return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  function shuffle(a, seed) { const r = rand(seed); a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- controls ----------
  function renderBooks() {
    $('books').innerHTML = '';
    for (const b of BOOKS) {
      const btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = BOOK_SHORT[b.id] || b.name;
      btn.className = b.id === state.book ? 'on' : '';
      btn.onclick = () => { if (state.book === b.id) return; state.book = b.id; state.unit = (b.units[0] || {}).id || null; resetList(); syncControls(); generate(); };
      $('books').appendChild(btn);
    }
  }
  function renderUnits() {
    const b = book(), sel = $('unit');
    $('unitField').style.display = b.kind === 'custom' ? 'none' : '';
    $('unitLabel').textContent = b.kind === 'unit' ? 'Unit' : b.kind === 'category' ? 'Category' : b.kind === 'basic' ? 'List' : 'Theme';
    sel.innerHTML = '';
    for (const u of b.units) {
      const o = document.createElement('option');
      o.value = u.id;
      o.textContent = b.kind === 'unit' ? `${u.label} – ${u.title}` : u.label;
      sel.appendChild(o);
    }
    if (unit()) sel.value = unit().id;
  }
  function resetList() { state.title = null; state.words = null; state.sentences = null; state.grade = null; }
  const segOn = (id, v) => document.querySelectorAll('#' + id + ' button').forEach(x => x.classList.toggle('on', String(x.dataset.v != null ? x.dataset.v : x.dataset.mode) === String(v)));

  function syncControls() {
    renderBooks(); renderUnits();
    const b = book(), u = unit(), custom = isCustom(), o = opt();
    $('title').value = state.title != null ? state.title : (custom ? state.custom.title : defaultTitle(b, u));
    $('words').value = state.words != null ? state.words : (custom ? state.custom.words : listToText(u ? u.words : []));
    $('sentences').value = state.sentences != null ? state.sentences : (custom ? state.custom.sentences : listToText(u && !u.phrases ? u.sentences : []));
    segOn('mode', mode());
    document.querySelector('#mode [data-mode=sentences]').disabled = !hasSentences() || isLetters() || isBlank();
    segOn('traces', o.traces); segOn('traceStyle', o.traceStyle); segOn('writes', o.writes);
    $('traceStyleField').classList.toggle('off', !o.traces);
    $('model').checked = o.model; $('showJa').checked = o.showJa; $('fill').checked = o.fill;
    $('jaCheck').classList.toggle('off', isLetters());
    segOn('size', state.size); segOn('orient', state.orient); segOn('pages', state.pages);
    $('count').value = state.count; segOn('order', state.order);
    segOn('grade', grade()); segOn('case', state.letterCase);
    document.querySelectorAll('#case button').forEach(x => { x.disabled = isLetters(); });
    $('opts').style.display = isBlank() ? 'none' : '';
    $('modeField').style.display = isBlank() ? 'none' : '';
    $('countField').style.display = isBlank() ? 'none' : '';
    $('wordsField').style.display = isBlank() || mode() === 'sentences' ? 'none' : '';
    $('sentField').style.display = isBlank() || mode() === 'words' ? 'none' : '';
  }

  // ---------- generate + draw ----------
  let fontsReady = false;
  function makeModel() {
    const b = book(), u = unit(), o = opt(), md = mode();
    const bad = new Set();
    let items = parseList(md === 'sentences' ? $('sentences').value : $('words').value, bad);
    if (!isLetters() && state.letterCase !== 'as') items = items.map(it => ({ ...it, text: state.letterCase === 'upper' ? it.text.toUpperCase() : it.text.toLowerCase() }));
    if (state.order === 'mix') items = shuffle(items, `${state.book}|${state.unit}|${md}|${state.seed}`);
    const anyJa = items.some(it => it.ja);
    const P = Object.assign({}, o, {
      showJa: o.showJa && anyJa, grade: grade(), size: state.size, orient: state.orient, pages: +state.pages,
      count: state.count, mix: state.order === 'mix', letters: isLetters(),
      keepAll: isCustom() || !!(unit() && unit().keep) || items.length <= 12, blank: isBlank(), sentences: md === 'sentences',
    });
    const L = LY.plan(items, P);
    const title = ($('title').value || '').trim() || defaultTitle(b, u);
    const notes = (L.notes || []).slice();
    if (bad.size) notes.push('Left out characters the handwriting font does not have: ' + [...bad].slice(0, 12).join(' '));
    if (!o.model && !o.traces && !P.showJa && !isBlank()) notes.push('No example, tracing or Japanese is shown – students only get blank lines. Turn on Japanese meaning or an example.');
    else if (!o.model && !o.traces && o.showJa && items.some(it => !it.ja)) notes.push('Some items have no Japanese, so their line is blank: ' + items.filter(it => !it.ja).slice(0, 6).map(it => it.text).join(', '));
    return { title, L, P, kana: grade() === 'low' ? 'kana' : 'kanji', blank: isBlank(), items, notes };
  }

  function scalePages() {
    const avail = $('preview').clientWidth - 44;
    document.querySelectorAll('.page-wrap').forEach(w => {
      const pg = w.firstChild;
      const land = pg.classList.contains('landscape');
      const pageW = (land ? 297 : 210) * 3.7795275591, pageH = (land ? 210 : 297) * 3.7795275591;
      const k = Math.min(land ? 1.15 : 1, Math.max(0.3, avail / pageW));
      w.style.width = pageW * k + 'px'; w.style.height = pageH * k + 'px';
      pg.style.transform = `scale(${k})`;
    });
  }

  function generate() {
    if (!fontsReady) return;
    const m = makeModel();
    const sheet = $('sheetset');
    sheet.innerHTML = '';
    if (m.L.empty) { showNotes(m); return; }
    const pages = R.build(m);
    pages.forEach((p, i) => {
      if (pages.length > 1) { const l = document.createElement('div'); l.className = 'sheet-label'; l.textContent = i ? 'Side 2 / うら' : 'Side 1 / おもて'; sheet.appendChild(l); }
      const w = document.createElement('div'); w.className = 'page-wrap ' + m.L.orient; w.appendChild(p); sheet.appendChild(w);
    });
    $('pageSize').textContent = `@page { size: A4 ${m.L.orient}; margin: 0; }`;
    R.fitAll(sheet);
    scalePages();
    showNotes(m);
    window.__lastModel = m;
    save();
  }

  function showNotes(m) {
    const notes = m.notes.slice();
    const over = document.querySelectorAll('#preview .overflow').length;
    if (over) notes.push(`${over} text box(es) could not shrink enough – shorten the title (marked in pink).`);
    $('notes').innerHTML = notes.length ? '<ul>' + notes.map(n => '<li>' + String(n).replace(/[<>&]/g, '') + '</li>').join('') + '</ul>' : '';
    const L = m.L;
    if (L.empty) { $('status').textContent = m.title; $('sizeHint').textContent = ''; $('wordCounts').textContent = ''; return; }
    const dir = L.orient === 'portrait' ? 'たて portrait' : 'よこ landscape';
    $('paperInfo').textContent = `A4 ${dir} · ${L.pages.length === 2 ? 'double-sided' : '1 side'}`;
    $('status').textContent = m.title;
    const cols = L.cols > 1 ? `, ${L.cols} columns` : '';
    $('sizeHint').textContent = (state.size === 'auto' ? 'Auto picked ' : '') + `four lines ${L.B} mm tall` + cols +
      (L.extra ? `, +${L.extra} extra line${L.extra > 1 ? 's' : ''} each` : '') + '.';
    $('wordCounts').textContent = m.blank ? '' : `${L.used} of ${L.total} on the sheet`;
    $('printHint').innerHTML = L.pages.length === 2
      ? `Double-sided: <b>Two-sided → ${L.orient === 'portrait' ? 'Flip on long edge (長辺とじ)' : 'Flip on short edge (短辺とじ)'}</b>, A4, scale 100%.`
      : 'A4, scale 100% (実際のサイズ), margins none.';
  }

  function save() {
    if (isCustom()) { state.custom.words = $('words').value; state.custom.sentences = $('sentences').value; state.custom.title = $('title').value; }
    store.set(state);
  }

  // ---------- events ----------
  let timer = null;
  const later = fn => { clearTimeout(timer); $('preview').classList.add('busy'); timer = setTimeout(() => { $('preview').classList.remove('busy'); fn(); }, 350); };
  const redo = () => { syncControls(); generate(); };
  $('unit').onchange = () => { state.unit = $('unit').value; resetList(); redo(); };
  $('title').oninput = () => { state.title = $('title').value; later(generate); };
  $('titleReset').onclick = () => { state.title = null; if (isCustom()) state.custom.title = 'WRITING PRACTICE'; redo(); };
  $('words').oninput = () => { state.words = $('words').value; later(generate); };
  $('wordsReset').onclick = () => { state.words = null; if (isCustom()) state.custom.words = ''; redo(); };
  $('sentences').oninput = () => { state.sentences = $('sentences').value; later(generate); };
  $('sentReset').onclick = () => { state.sentences = null; if (isCustom()) state.custom.sentences = ''; redo(); };
  document.querySelectorAll('#mode button').forEach(b => b.onclick = () => { state.mode = b.dataset.mode; redo(); });
  const optSeg = (id, key, num) => document.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => { opt()[key] = num ? +b.dataset.v : b.dataset.v; redo(); });
  optSeg('traces', 'traces', true); optSeg('traceStyle', 'traceStyle'); optSeg('writes', 'writes', true);
  for (const k of ['model', 'showJa', 'fill']) $(k).onchange = () => { opt()[k] = $(k).checked; redo(); };
  const stateSeg = (id, key, num) => document.querySelectorAll('#' + id + ' button').forEach(b => b.onclick = () => { state[key] = num ? +b.dataset.v : b.dataset.v; redo(); });
  stateSeg('size', 'size'); stateSeg('orient', 'orient'); stateSeg('pages', 'pages', true); stateSeg('grade', 'grade'); stateSeg('case', 'letterCase');
  document.querySelectorAll('#order button').forEach(b => b.onclick = () => {
    if (b.dataset.v === 'mix') state.seed = (state.seed || 1) + (state.order === 'mix' ? 1 : 0);
    state.order = b.dataset.v; redo();
  });
  $('count').onchange = () => { state.count = $('count').value; redo(); };
  $('print').onclick = () => window.print();
  window.addEventListener('resize', () => later(scalePages));

  syncControls();
  document.fonts.ready.then(() => Promise.all([
    document.fonts.load('10px "NH RL"', 'Aa|'), document.fonts.load('10px "NH TW"', 'Aa'), document.fonts.load('10px "NH Medium"', 'Aa'),
    document.fonts.load('10px "Luckiest Guy"'),
    document.fonts.load('10px Yomogi', 'うすい字をなぞってから自分で書きましょうやじるしの向きお手本を見て4線日本語英語'),
    document.fonts.load('10px "Noto Sans JP"', '名前年組番月曜日'),
  ])).catch(() => null).then(() => { fontsReady = true; generate(); });

  // hooks for the automated layout tests (tools/test-layout.py)
  window.WS = {
    state, generate, syncControls, books: BOOKS,
    select(bookId, unitId, extra) {
      state.book = bookId; state.unit = unitId; resetList();
      Object.assign(state, extra || {});
      syncControls(); generate();
    },
  };
})();
