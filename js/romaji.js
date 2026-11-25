// Kana -> romaji (Hepburn, passport style: long vowels not written - ゆうき = Yuki, おおの = Ono)
// so a class list typed in hiragana / katakana still works. Kanji cannot be read and is reported.
'use strict';
(function (global) {
  const T = {
    'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
    'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko', 'が': 'ga', 'ぎ': 'gi', 'ぐ': 'gu', 'げ': 'ge', 'ご': 'go',
    'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so', 'ざ': 'za', 'じ': 'ji', 'ず': 'zu', 'ぜ': 'ze', 'ぞ': 'zo',
    'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to', 'だ': 'da', 'ぢ': 'ji', 'づ': 'zu', 'で': 'de', 'ど': 'do',
    'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
    'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho', 'ば': 'ba', 'び': 'bi', 'ぶ': 'bu', 'べ': 'be', 'ぼ': 'bo',
    'ぱ': 'pa', 'ぴ': 'pi', 'ぷ': 'pu', 'ぺ': 'pe', 'ぽ': 'po',
    'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo', 'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
    'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro', 'わ': 'wa', 'ゐ': 'i', 'ゑ': 'e', 'を': 'o', 'ん': 'n', 'ゔ': 'vu',
    'ぁ': 'a', 'ぃ': 'i', 'ぅ': 'u', 'ぇ': 'e', 'ぉ': 'o',
  };
  const Y = { 'ゃ': 'a', 'ゅ': 'u', 'ょ': 'o' };
  const toHira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));

  function kanaToRomaji(input) {
    const s = toHira(String(input).normalize('NFKC'));
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const c = s[i], n = s[i + 1];
      if (c === 'っ') { // double the next consonant (っち -> tchi)
        const nx = romaOf(s, i + 1);
        if (nx.r) out += nx.r.startsWith('ch') ? 't' : nx.r[0];
        continue;
      }
      if (c === 'ー') continue; // long vowel mark: not written
      const r = romaOf(s, i);
      if (!r.r) { out += c; continue; }
      out += r.r; i += r.len - 1;
      void n;
    }
    // passport style long vowels
    out = out.replace(/ou/g, 'o').replace(/oo(?=[^aeiou]|$)/g, 'o').replace(/uu/g, 'u');
    return out;
  }
  function romaOf(s, i) {
    const c = s[i], n = s[i + 1];
    if (!T[c]) return { r: '', len: 1 };
    if (n && Y[n] && /i$/.test(T[c]) && c !== 'い') {
      const base = T[c];
      const head = /^(shi|chi|ji)$/.test(base) ? base.slice(0, -1) : base.slice(0, -1) + 'y';
      return { r: head + Y[n], len: 2 };
    }
    return { r: T[c], len: 1 };
  }

  // Tidy one name: kana -> romaji, Capitalised. Returns { text, problem }
  function tidyName(raw) {
    let s = String(raw || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    if (!s) return { text: '' };
    if (/[぀-ヿ]/.test(s)) s = kanaToRomaji(s);
    if (/[一-鿿]/.test(s)) return { text: s, problem: 'kanji' };
    s = s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z' -]/g, '');
    // all-lower or ALL-CAPS parts become Capitalised; mixed case (McDonald) is kept
    s = s.split(/([ -])/).map(p => /^[a-z']+$|^[A-Z']+$/.test(p) ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p).join('');
    return { text: s };
  }

  global.Romaji = { kanaToRomaji, tidyName };
})(window);
