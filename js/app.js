// UI: pick a list, choose how much tracing / writing, preview, print.
'use strict';
(function () {
  const D = window.PS_DATA, LY = window.Layout, R = window.Render, M = window.NH_METRICS;
  const $ = id => document.getElementById(id);
  const BOOKS = D.books.concat([
    { id: 'custom', name: 'My own list', kind: 'custom', grade: 5, units: [] },
    { id: 'names', name: 'Student names', kind: 'names', grade: 5, units: [] },
  ]);
  const BOOK_SHORT = { basics: 'ABC & Basics', lt1: "Let's Try 1", lt2: "Let's Try 2", nh5: 'New Horizon 5', nh6: 'New Horizon 6', mpd: 'Picture Dictionary', theme: 'Themes', custom: 'My own list', names: '✏️ Student names 名前' };
  const DEF_OPT = {
    words: { traces: 2, traceStyle: 'grey', writes: 2, model: false, showJa: true, fill: true },
    sentences: { traces: 1, traceStyle: 'grey', writes: 1, model: false, showJa: true, fill: true },
    names: { traces: 2, traceStyle: 'grey', writes: 2, model: false, showJa: false, fill: true },
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
    students: [], nameForm: { year: '', cls: '' }, nameShow: 'all', nameParts: { first: true, last: true, full: true }, nameOrder: 'fl',
    namesTitle: 'MY NAME',
  }, saved);
  state.opt = { words: Object.assign({}, DEF_OPT.words, (saved.opt || {}).words), sentences: Object.assign({}, DEF_OPT.sentences, (saved.opt || {}).sentences), names: Object.assign({}, DEF_OPT.names, (saved.opt || {}).names) };

  // ---------- list helpers ----------
  const book = () => BOOKS.find(b => b.id === state.book) || BOOKS[0];
  const unit = () => { const b = book(); return b.units.find(u => u.id === state.unit) || b.units[0] || null; };
  const isCustom = () => book().kind === 'custom';
  const isNames = () => book().kind === 'names';
  const isBlank = () => !!(unit() && unit().blank);
  const isLetters = () => !!(unit() && unit().letters);
  const hasSentences = () => isCustom() || !!(unit() && unit().sentences && unit().sentences.length && !unit().phrases);
  const mode = () => (state.mode === 'sentences' && hasSentences() && !isLetters() && !isBlank()) ? 'sentences' : 'words';
  const opt = () => state.opt[isNames() ? 'names' : mode()];
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
    $('unitField').style.display = b.kind === 'custom' || b.kind === 'names' ? 'none' : '';
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
    $('title').value = isNames() ? state.namesTitle : state.title != null ? state.title : (custom ? state.custom.title : defaultTitle(b, u));
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
    // student names mode
    const nm = isNames();
    $('namesPanel').style.display = nm ? '' : 'none';
    for (const id of ['modeField', 'countField', 'wordsField', 'sentField', 'jaCheck', 'fillCheck']) if (nm) $(id).style.display = 'none';
    if (!nm) { $('writesField').style.display = ''; $('jaCheck').style.display = ''; $('fillCheck').style.display = ''; }
    document.querySelector('#orient [data-v=auto]').disabled = nm;
    if (nm) { renderNameList(); syncNameOpts(); }
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
    if (isNames()) return generateNames();
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

  // ---------- student names ----------
  const RT = window.Romaji, XL = window.XLSX_LITE;
  const numCmp = (a, b) => (isFinite(a) && isFinite(b) && a !== '' && b !== '') ? (+a) - (+b) : String(a).localeCompare(String(b), 'ja');
  const classKey = st => `${st.year}|${st.cls}`;
  const classLabel = st => `${st.year || '?'}年${st.cls || '?'}組`;
  function sortStudents() {
    state.students.sort((a, b) => numCmp(a.year, b.year) || numCmp(a.cls, b.cls) || numCmp(a.num, b.num));
  }
  function nextNum(year, cls, after) {
    const nums = state.students.filter(s => s.year === year && s.cls === cls).map(s => +s.num).filter(n => isFinite(n));
    if (after != null && isFinite(+after) && after !== '') {
      // next free number after the one just used
      let n = +after + 1; while (nums.includes(n)) n++; return String(n);
    }
    return String(nums.length ? Math.max(...nums) + 1 : 1);
  }
  let editingId = null, lastClass = null;
  const nf = { year: $('nfYear'), cls: $('nfClass'), num: $('nfNum'), first: $('nfFirst'), last: $('nfLast') };
  const half = v => String(v || '').normalize('NFKC').trim();
  function nameMsg(text, err) { $('nfMsg').textContent = text; $('nfMsg').classList.toggle('err', !!err); }
  function initNameForm() {
    nf.year.value = state.nameForm.year || ''; nf.cls.value = state.nameForm.cls || '';
    lastClass = classKey({ year: half(nf.year.value), cls: half(nf.cls.value) });
    nf.num.value = (nf.year.value || nf.cls.value) ? nextNum(half(nf.year.value), half(nf.cls.value)) : '';
  }
  // A new 年 / 組 typed in: start that class's numbering (1, or after its last student)
  function classChanged() {
    const y = half(nf.year.value), c = half(nf.cls.value), key = classKey({ year: y, cls: c });
    if (key === lastClass || editingId) return;
    lastClass = key;
    nf.num.value = nextNum(y, c);
  }
  nf.year.addEventListener('input', classChanged);
  nf.cls.addEventListener('input', classChanged);

  function addStudent() {
    const year = half(nf.year.value), cls = half(nf.cls.value);
    let num = half(nf.num.value).replace(/[^0-9A-Za-z]/g, '');
    const f = RT.tidyName(nf.first.value), l = RT.tidyName(nf.last.value);
    if (!f.text && !l.text) { nameMsg('Type a first or last name.', true); nf.first.focus(); return; }
    if (f.problem || l.problem) { nameMsg('漢字 can’t be turned into romaji – please type romaji or かな.', true); (f.problem ? nf.first : nf.last).focus(); return; }
    if (!num) num = nextNum(year, cls);
    const rec = { id: editingId || ('s' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), year, cls, num, first: f.text, last: l.text };
    // same 年・組・番 replaces the old entry
    const clash = state.students.find(s => s.id !== rec.id && s.year === year && s.cls === cls && s.num === num);
    state.students = state.students.filter(s => s.id !== rec.id && s !== clash);
    state.students.push(rec); sortStudents();
    nameMsg(`${editingId ? 'Saved' : clash ? 'Replaced' : 'Added'}: ${classLabel(rec)} ${num}番 ${[rec.first, rec.last].filter(Boolean).join(' ')}`);
    const wasEditing = !!editingId;
    editingId = null; $('nameForm').classList.remove('editing'); $('nfAdd').textContent = 'Add ↵';
    state.nameForm = { year, cls };
    lastClass = classKey(rec);
    nf.num.value = wasEditing ? nextNum(year, cls) : nextNum(year, cls, num);
    nf.first.value = ''; nf.last.value = '';
    state.nameShow = state.nameShow === 'all' ? 'all' : classKey(rec);
    focusStudent = rec.id;
    redo();
    nf.first.focus();
  }
  $('nfAdd').onclick = addStudent;
  Object.values(nf).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); addStudent(); } }));

  function editStudent(id) {
    const st = state.students.find(s => s.id === id); if (!st) return;
    editingId = id;
    nf.year.value = st.year; nf.cls.value = st.cls; nf.num.value = st.num; nf.first.value = st.first; nf.last.value = st.last;
    $('nameForm').classList.add('editing'); $('nfAdd').textContent = 'Save ↵';
    nameMsg(`Editing ${classLabel(st)} ${st.num}番 – change it and press Enter.`);
    nf.first.focus();
  }
  function deleteStudent(id) {
    state.students = state.students.filter(s => s.id !== id);
    if (editingId === id) { editingId = null; $('nameForm').classList.remove('editing'); $('nfAdd').textContent = 'Add ↵'; }
    initNameForm(); redo();
  }
  let focusStudent = null;
  function shownStudents() {
    return state.nameShow === 'all' ? state.students : state.students.filter(s => classKey(s) === state.nameShow);
  }
  function renderNameList() {
    const classes = [];
    for (const s of state.students) if (!classes.some(c => classKey(c) === classKey(s))) classes.push(s);
    const sel = $('nShow');
    sel.innerHTML = `<option value="all">All classes (${state.students.length})</option>` +
      classes.map(c => `<option value="${esc(classKey(c))}">${esc(classLabel(c))} (${state.students.filter(s => classKey(s) === classKey(c)).length})</option>`).join('');
    if (state.nameShow !== 'all' && !classes.some(c => classKey(c) === state.nameShow)) state.nameShow = 'all';
    sel.value = state.nameShow;
    $('nCount').textContent = state.students.length ? `${shownStudents().length} sheet${shownStudents().length === 1 ? '' : 's'}` : '';
    $('nExport').disabled = !state.students.length; $('nClear').disabled = !state.students.length;
    let html = '', prev = null;
    for (const s of shownStudents()) {
      if (classKey(s) !== prev) { html += `<div class="nl-head">${esc(classLabel(s))}</div>`; prev = classKey(s); }
      html += `<div class="nl-row" data-id="${s.id}"><span class="who">${esc(s.num)}番</span><span>${esc([s.first, s.last].filter(Boolean).join(' '))}</span>` +
        `<button type="button" data-edit="${s.id}" title="Edit">✎</button><button type="button" data-del="${s.id}" title="Delete">✕</button></div>`;
    }
    $('nameList').innerHTML = html;
    if (focusStudent) { const r = $('nameList').querySelector(`[data-id="${focusStudent}"]`); if (r) { r.classList.add('cur'); r.scrollIntoView({ block: 'nearest' }); } focusStudent = null; }
  }
  $('nameList').onclick = e => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.edit) editStudent(t.dataset.edit);
    if (t.dataset.del) deleteStudent(t.dataset.del);
  };
  $('nShow').onchange = () => { state.nameShow = $('nShow').value; redo(); };
  $('nClear').onclick = () => {
    if (!confirm(`Delete all ${state.students.length} students from this list?`)) return;
    state.students = []; editingId = null; initNameForm(); nameMsg('List cleared.'); redo();
  };
  function syncNameOpts() {
    document.querySelectorAll('#nParts button').forEach(b => b.classList.toggle('on', !!state.nameParts[b.dataset.v]));
    segOn('nOrder', state.nameOrder);
  }
  document.querySelectorAll('#nParts button').forEach(b => b.onclick = () => {
    state.nameParts[b.dataset.v] = !state.nameParts[b.dataset.v];
    if (!Object.values(state.nameParts).some(Boolean)) state.nameParts[b.dataset.v] = true;
    redo();
  });
  document.querySelectorAll('#nOrder button').forEach(b => b.onclick = () => { state.nameOrder = b.dataset.v; redo(); });

  // ----- Excel -----
  const HEAD = ['年 Year', '組 Class', '番 No.', '名 First name', '姓 Last name'];
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const asCell = v => (v !== '' && isFinite(v)) ? +v : v;
  $('nTemplate').onclick = () => download(XL.write([HEAD], { widths: [9, 9, 9, 22, 22] }), 'name-list-template.xlsx');
  $('nExport').onclick = () => download(XL.write([HEAD].concat(state.students.map(s => [asCell(s.year), asCell(s.cls), asCell(s.num), s.first, s.last])), { widths: [9, 9, 9, 22, 22] }), 'name-list.xlsx');

  function parseCSV(text) {
    const delim = text.includes('\t') ? '\t' : ',';
    return text.split(/\r?\n/).map(line => {
      const out = []; let cur = '', q = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
        else if (c === '"') q = true; else if (c === delim) { out.push(cur.trim()); cur = ''; } else cur += c;
      }
      out.push(cur.trim()); return out;
    });
  }
  // Read rows from Excel / CSV: finds the header, fills blank 年・組 down, numbers blank 番
  function importRows(rows) {
    const H = { year: /年|year|grade|学年/i, cls: /組|class|クラス/i, num: /番|no\.?$|number|出席/i, last: /姓|名字|苗字|last|family|surname/i, first: /first|given|^名(\s|$)|名 |下の名前/i, full: /氏名|名前|full|^name$/i };
    let hi = rows.findIndex(r => r.some(c => H.year.test(c) || H.cls.test(c)) && r.some(c => H.first.test(c) || H.last.test(c) || H.full.test(c)));
    let col;
    if (hi >= 0) {
      col = {};
      rows[hi].forEach((c, i) => {
        c = String(c);
        for (const k of ['year', 'cls', 'num', 'last', 'first', 'full']) if (col[k] == null && H[k].test(c) && !Object.values(col).includes(i)) { col[k] = i; break; }
      });
    } else { col = { year: 0, cls: 1, num: 2, first: 3, last: 4 }; hi = -1; }
    let year = '', cls = '', num = null, added = 0, replaced = 0;
    const bad = [];
    rows.slice(hi + 1).forEach((r, ri) => {
      const g = k => col[k] != null ? half(r[col[k]]) : '';
      let fRaw = g('first'), lRaw = g('last');
      if (!fRaw && !lRaw && g('full')) {
        const parts = g('full').split(/[\s　]+/);
        if (/[぀-ヿ一-鿿]/.test(g('full'))) { lRaw = parts[0]; fRaw = parts.slice(1).join(' '); }
        else { fRaw = parts[0]; lRaw = parts.slice(1).join(' '); }
      }
      if (!fRaw && !lRaw) return;
      const y = g('year'), c = g('cls');
      if ((y && y !== year) || (c && c !== cls)) num = null; // new class: numbering restarts
      if (y) year = y; if (c) cls = c;
      let n = g('num').replace(/[^0-9A-Za-z]/g, '');
      if (!n) n = String(num == null ? 1 : +num + 1);
      num = n;
      const f = RT.tidyName(fRaw), l = RT.tidyName(lRaw);
      if (f.problem || l.problem) { bad.push(`row ${hi + ri + 2}`); return; }
      const before = state.students.length;
      state.students = state.students.filter(s => !(s.year === year && s.cls === cls && s.num === n));
      if (state.students.length < before) replaced++;
      state.students.push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), year, cls, num: n, first: f.text, last: l.text });
      added++;
    });
    sortStudents();
    return { added, replaced, bad };
  }
  $('nImport').onchange = async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      let rows;
      if (/\.xlsx$/i.test(file.name)) rows = await XL.read(await file.arrayBuffer());
      else rows = parseCSV(await file.text());
      const r = importRows(rows);
      state.nameShow = 'all';
      let msg = `Imported ${r.added} student${r.added === 1 ? '' : 's'}` + (r.replaced ? ` (${r.replaced} replaced)` : '') + '.';
      if (r.bad.length) msg += ` Skipped ${r.bad.length} with 漢字 names (${r.bad.slice(0, 5).join(', ')}) – use romaji or かな.`;
      nameMsg(msg, !!r.bad.length || !r.added);
      if (state.students.length) { const last = state.students[state.students.length - 1]; state.nameForm = { year: last.year, cls: last.cls }; initNameForm(); }
      redo();
    } catch (err) {
      nameMsg('Could not read that file. Use the Excel template (.xlsx) or a .csv file.', true);
    }
  };

  // ----- name sheets -----
  const SAMPLE = { year: '', cls: '', num: '', first: 'Taro', last: 'Yamada', sample: true };
  function generateNames() {
    const o = opt();
    const P = Object.assign({}, o, {
      grade: grade(), size: state.size, orient: state.orient === 'landscape' ? 'landscape' : 'portrait', pages: +state.pages,
      letterCase: state.letterCase, order: state.nameOrder, parts: state.nameParts,
    });
    const list = shownStudents().length ? shownStudents() : [SAMPLE];
    const title = ($('title').value || '').trim() || 'MY NAME';
    const kana = grade() === 'low' ? 'kana' : 'kanji';
    const sheet = $('sheetset');
    sheet.innerHTML = '';
    const models = [];
    let notes = [];
    for (const st of list) {
      const L = LY.planNames(st, P);
      if (L.empty) { notes = notes.concat(L.notes.map(n => `${[st.first, st.last].join(' ')}: ${n}`)); continue; }
      const m = { title, L, P, kana, names: true, student: st, notes: [] };
      models.push(m);
      R.build(m).forEach((p, i) => {
        const l = document.createElement('div'); l.className = 'sheet-label';
        l.textContent = (st.sample ? 'Example – add your students on the left' : `${classLabel(st)} ${st.num}番 · ${[st.first, st.last].filter(Boolean).join(' ')}`) +
          (L.pages.length > 1 ? (i ? ' · Side 2 / うら' : ' · Side 1 / おもて') : '');
        sheet.appendChild(l);
        const w = document.createElement('div'); w.className = 'page-wrap ' + L.orient; w.appendChild(p); sheet.appendChild(w);
      });
    }
    const orient = models.length ? models[0].L.orient : 'portrait';
    $('pageSize').textContent = `@page { size: A4 ${orient}; margin: 0; }`;
    R.fitAll(sheet);
    scalePages();
    window.__lastModels = models;
    window.__lastModel = models[models.length - 1] || { L: { empty: true }, notes };
    if (list[0].sample) notes.unshift('Showing an example. Add students on the left (or import the Excel template) to make one sheet each.');
    $('notes').innerHTML = notes.length ? '<ul>' + notes.map(n => '<li>' + esc(n) + '</li>').join('') + '</ul>' : '';
    const n = list[0].sample ? 0 : list.length, sides = models.length ? models[0].L.pages.length : 1;
    $('status').textContent = n ? `${n} name sheet${n === 1 ? '' : 's'}` : 'Name sheet example';
    $('paperInfo').textContent = `A4 ${orient === 'portrait' ? 'たて portrait' : 'よこ landscape'} · ${sides === 2 ? 'double-sided' : '1 side'} each`;
    if (models.length) {
      const B = models[0].L.B;
      $('sizeHint').textContent = `Biggest lines ${B} mm, then about ${(B * 0.72).toFixed(1)} and ${(B * 0.56).toFixed(1)} mm. Spare space is filled with writing lines.`;
    }
    $('printHint').innerHTML = (sides === 2
      ? `Double-sided: <b>Two-sided → ${orient === 'portrait' ? 'Flip on long edge (長辺とじ)' : 'Flip on short edge (短辺とじ)'}</b>, A4, scale 100%.`
      : 'A4, scale 100% (実際のサイズ), margins none.') + (n > 1 ? ` Prints ${n} students${sides === 2 ? ' × 2 sides' : ''}.` : '');
    save();
  }
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- events ----------
  let timer = null;
  const later = fn => { clearTimeout(timer); $('preview').classList.add('busy'); timer = setTimeout(() => { $('preview').classList.remove('busy'); fn(); }, 350); };
  const redo = () => { syncControls(); generate(); };
  $('unit').onchange = () => { state.unit = $('unit').value; resetList(); redo(); };
  $('title').oninput = () => { if (isNames()) state.namesTitle = $('title').value; else state.title = $('title').value; later(generate); };
  $('titleReset').onclick = () => { if (isNames()) state.namesTitle = 'MY NAME'; state.title = null; if (isCustom()) state.custom.title = 'WRITING PRACTICE'; redo(); };
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

  initNameForm();
  syncControls();
  document.fonts.ready.then(() => Promise.all([
    document.fonts.load('10px "NH RL"', 'Aa|'), document.fonts.load('10px "NH TW"', 'Aa'), document.fonts.load('10px "NH Medium"', 'Aa'),
    document.fonts.load('10px "Luckiest Guy"'),
    document.fonts.load('10px Yomogi', 'うすい字をなぞってから自分で書きましょうやじるしの向きお手本を見て4線日本語英語'),
    document.fonts.load('10px "Noto Sans JP"', '名前年組番月曜日'),
  ])).catch(() => null).then(() => { fontsReady = true; generate(); });

  // hooks for the automated layout tests (tools/test-layout.py)
  window.WS = {
    state, generate, syncControls, books: BOOKS, importRows, addStudent, nf, initNameForm,
    select(bookId, unitId, extra) {
      state.book = bookId; state.unit = unitId; resetList();
      Object.assign(state, extra || {});
      syncControls(); generate();
    },
  };
})();
