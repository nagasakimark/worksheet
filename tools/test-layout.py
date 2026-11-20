#!/usr/bin/env python3
"""Renders every word list (words + sentences, several option mixes) in headless Chrome and checks:
  - every writing band and label stays inside the white panel of its page
  - bands never overlap each other or the header
  - no header text box had to be cut off
  - the sheet never uses more pages than chosen
Usage:  python3 tools/test-layout.py [--quick]      (opens index.html straight from disk)
Needs:  pip install playwright  (uses /usr/bin/google-chrome if present)
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = 'file://' + os.path.join(ROOT, 'index.html')
QUICK = '--quick' in sys.argv

CHECK_JS = r"""
() => {
  const probs = [];
  const m = window.__lastModel;
  if (!m || m.L.empty) return { probs: ['nothing drawn: ' + ((m && m.notes) || []).join(' ')], pages: 0 };
  const pages = document.querySelectorAll('#sheetset .page');
  pages.forEach((pg, pi) => {
    const W = pg.classList.contains('landscape') ? 297 : 210, H = W === 297 ? 210 : 297;
    pg.querySelectorAll('.overflow').forEach(e => probs.push(`p${pi + 1} text does not fit: "${e.textContent.slice(0, 40)}"`));
    const boxes = [];
    pg.querySelectorAll('svg.bands text').forEach(t => {
      const b = t.getBBox();
      // line rows: the full band. letters: their glyph box
      if (b.x < 6.4 || b.y < 6.4 || b.x + b.width > W - 6.4 || b.y + b.height > H - 6.4)
        probs.push(`p${pi + 1} outside panel: ${t.getAttribute('class')} "${t.textContent.slice(0, 20)}" ${b.x.toFixed(1)},${b.y.toFixed(1)} ${b.width.toFixed(1)}x${b.height.toFixed(1)}`);
      if (t.classList.contains('nh-lines')) boxes.push(b);
    });
    // header bottom
    const hb = pi === 0 ? 39.3 : 20.6;
    for (const b of boxes) if (b.y < hb) probs.push(`p${pi + 1} band under header at y=${b.y.toFixed(1)}`);
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], c = boxes[j];
      const ox = Math.min(a.x + a.width, c.x + c.width) - Math.max(a.x, c.x);
      const oy = Math.min(a.y + a.height, c.y + c.height) - Math.max(a.y, c.y);
      if (ox > 0.5 && oy > 0.5) probs.push(`p${pi + 1} bands overlap`);
    }
  });
  if (pages.length > m.P.pages) probs.push(`too many pages: ${pages.length}`);
  return { probs, pages: pages.length, B: m.L.B, cols: m.L.cols, orient: m.L.orient, used: m.L.used, total: m.L.total };
}
"""

CONFIGS = [
    {},
    {'pages': 2, 'size': 'auto'},
    {'grade': 'low', 'orient': 'landscape'},
    {'size': 'xl', 'pages': 1},
]
OPTS = [
    {'traces': 2, 'traceStyle': 'grey', 'writes': 2, 'model': False, 'showJa': True, 'fill': True},
    {'traces': 3, 'traceStyle': 'arrow', 'writes': 3, 'model': True, 'showJa': True, 'fill': True},
    {'traces': 0, 'traceStyle': 'grey', 'writes': 1, 'model': False, 'showJa': True, 'fill': False},
]


async def main():
    async with async_playwright() as p:
        exe = '/usr/bin/google-chrome' if os.path.exists('/usr/bin/google-chrome') else None
        b = await p.chromium.launch(executable_path=exe)
        pg = await b.new_page(viewport={'width': 1400, 'height': 900})
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL)
        await pg.wait_for_function('window.__lastModel')
        lists = await pg.evaluate("WS.books.flatMap(b => b.units.map(u => [b.id, u.id, !!(u.sentences && u.sentences.length && !u.phrases)]))")
        lists.append(['custom', None, True])
        if QUICK: lists = lists[::5]
        await pg.evaluate("""() => { const s = WS.state; s.custom.words = 'apple = りんご\\nwatermelon = すいか\\nI like dogs.\\nsupercalifragilistic'; s.custom.sentences = 'I want to go to Italy because I want to eat pizza and see old buildings. = イタリア'; }""")
        fails = 0; runs = 0
        for book, unit, has_s in lists:
            for mode in (['words', 'sentences'] if has_s else ['words']):
                for ci, cfg in enumerate(CONFIGS if not QUICK else CONFIGS[:2]):
                    for oi, opt in enumerate(OPTS if not QUICK else OPTS[:2]):
                        extra = dict(cfg, mode=mode, count='auto', order='list')
                        await pg.evaluate("([o, mode]) => { Object.assign(WS.state.opt[mode], o); }", [opt, mode])
                        await pg.evaluate("([b, u, e]) => WS.select(b, u, e)", [book, unit, extra])
                        r = await pg.evaluate(CHECK_JS)
                        runs += 1
                        if r['probs']:
                            fails += 1
                            print(f'FAIL {book}/{unit} {mode} cfg{ci} opt{oi}:', r['probs'][:4])
        print(f'{runs} sheets checked, {fails} with problems' + (f', JS errors: {errs[:3]}' if errs else ''))
        await b.close()
        sys.exit(1 if fails or errs else 0)

asyncio.run(main())
