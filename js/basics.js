// Ready-made lists for handwriting practice that are not textbook units (alphabet, months, days...),
// plus clean-up of the Picture Dictionary lists so sequences come out in their natural order.
'use strict';
(function (global) {
  const D = global.PS_DATA;
  const W = s => s.trim().split('\n').map(l => { const [en, ja] = l.split('=').map(x => x.trim()); return { en, ja: ja || '' }; });
  const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

  const MONTHS = W(`
    January = 1月
    February = 2月
    March = 3月
    April = 4月
    May = 5月
    June = 6月
    July = 7月
    August = 8月
    September = 9月
    October = 10月
    November = 11月
    December = 12月`);
  const DAYS = W(`
    Sunday = 日曜日
    Monday = 月曜日
    Tuesday = 火曜日
    Wednesday = 水曜日
    Thursday = 木曜日
    Friday = 金曜日
    Saturday = 土曜日`);
  const NUM1 = W(`
    one = 1
    two = 2
    three = 3
    four = 4
    five = 5
    six = 6
    seven = 7
    eight = 8
    nine = 9
    ten = 10`);
  const NUM2 = W(`
    eleven = 11
    twelve = 12
    thirteen = 13
    fourteen = 14
    fifteen = 15
    sixteen = 16
    seventeen = 17
    eighteen = 18
    nineteen = 19
    twenty = 20`);
  const TENS = W(`
    ten = 10
    twenty = 20
    thirty = 30
    forty = 40
    fifty = 50
    sixty = 60
    seventy = 70
    eighty = 80
    ninety = 90
    one hundred = 100`);
  const ORD = W(`
    first = 1日 / 1番目
    second = 2日 / 2番目
    third = 3日 / 3番目
    fourth = 4日 / 4番目
    fifth = 5日 / 5番目
    sixth = 6日 / 6番目
    seventh = 7日 / 7番目
    eighth = 8日 / 8番目
    ninth = 9日 / 9番目
    tenth = 10日 / 10番目`);
  const SEASONS = W(`
    spring = 春
    summer = 夏
    fall = 秋
    winter = 冬`);
  const COLORS = W(`
    red = 赤
    blue = 青
    yellow = 黄色
    green = 緑
    pink = ピンク
    orange = オレンジ
    purple = むらさき
    brown = 茶色
    black = 黒
    white = 白`);
  const GREET = W(`
    Hello. = こんにちは。
    Good morning. = おはようございます。
    Good afternoon. = こんにちは。（午後）
    Goodbye. = さようなら。
    See you. = またね。
    Thank you. = ありがとう。
    You're welcome. = どういたしまして。
    I'm sorry. = ごめんなさい。
    How are you? = 元気ですか？
    I'm fine. = 元気です。
    Nice to meet you. = はじめまして。`);

  const S = W;
  const units = [
    { id: 'b-upper', label: 'ABC – capital letters (大文字)', title: 'ABC', words: UP.map(c => ({ en: c, ja: '' })), letters: true, sentences: [] },
    { id: 'b-lower', label: 'abc – small letters (小文字)', title: 'abc', words: UP.map(c => ({ en: c.toLowerCase(), ja: '' })), letters: true, sentences: [] },
    { id: 'b-pairs', label: 'Aa – capital + small', title: 'Aa Bb Cc', words: UP.map(c => ({ en: c + c.toLowerCase(), ja: '' })), letters: true, sentences: [] },
    { id: 'b-months', label: 'Months (1月–12月)', title: 'Months', words: MONTHS,
      sentences: S(`
        When is your birthday? = たんじょう日はいつですか？
        My birthday is April first. = わたしのたんじょう日は4月1日です。
        My birthday is May fifth. = わたしのたんじょう日は5月5日です。
        My birthday is July seventh. = わたしのたんじょう日は7月7日です。
        My birthday is December tenth. = わたしのたんじょう日は12月10日です。
        I like August. = 8月がすきです。`) },
    { id: 'b-days', label: 'Days of the week (曜日)', title: 'Days of the Week', words: DAYS,
      sentences: S(`
        What day is it? = 何曜日ですか？
        It's Monday. = 月曜日です。
        It's Friday today. = 今日は金曜日です。
        I like Saturdays. = 土曜日がすきです。
        I have music on Tuesdays. = 火曜日に音楽があります。`) },
    { id: 'b-num1', label: 'Numbers 1–10', title: 'Numbers 1-10', words: NUM1,
      sentences: S(`
        How many? = いくつ？
        Three apples. = りんご3こ。
        I have two pencils. = えんぴつを2本持っています。
        Five dogs. = 犬5ひき。`) },
    { id: 'b-num2', label: 'Numbers 11–20', title: 'Numbers 11-20', words: NUM2,
      sentences: S(`
        I'm eleven. = わたしは11さいです。
        I'm twelve years old. = わたしは12さいです。
        Fifteen cards, please. = カードを15まいください。`) },
    { id: 'b-tens', label: 'Numbers 10–100', title: 'Numbers 10-100', words: TENS,
      sentences: S(`
        It's five hundred yen. = 500円です。
        It's eight hundred yen. = 800円です。`) },
    { id: 'b-ord', label: 'First – tenth (1日–10日)', title: 'First to Tenth', words: ORD,
      sentences: S(`
        My birthday is April first. = わたしのたんじょう日は4月1日です。
        My birthday is May fifth. = わたしのたんじょう日は5月5日です。`) },
    { id: 'b-seasons', label: 'Seasons (きせつ)', title: 'Seasons', words: SEASONS,
      sentences: S(`
        I like summer. = 夏がすきです。
        I like winter. = 冬がすきです。
        In spring, you can see cherry blossoms. = 春には、さくらを見ることができます。`) },
    { id: 'b-colors', label: 'Colors (色)', title: 'Colors', words: COLORS,
      sentences: S(`
        I like blue. = 青がすきです。
        Do you like red? = 赤はすきですか？
        Yes, I do. = はい、すきです。
        No, I don't. = いいえ、すきではありません。`) },
    { id: 'b-greet', label: 'Greetings (あいさつ)', title: 'Greetings', words: GREET, sentences: GREET, phrases: true },
    { id: 'b-blank', label: 'Blank 4-line paper (4線だけ)', title: 'Writing Practice', words: [], sentences: [], blank: true },
  ];
  for (const u of units) u.keep = !u.blank;
  D.books.unshift({ id: 'basics', name: 'Basics', kind: 'basic', grade: 3, units });

  // Picture Dictionary: put sequences in their natural order and drop the heading words
  // ("months", "days", "numbers"...) that only make sense as a card title.
  const mpd = D.books.find(b => b.id === 'mpd');
  if (mpd) {
    const ORDER = {
      'pd-months': MONTHS.map(w => w.en),
      'pd-days-of-the-week': DAYS.map(w => w.en).concat(['one week']),
      'pd-seasons': ['spring', 'summer', 'fall', 'winter'],
    };
    const DROP = { 'pd-months': ['months'], 'pd-days-of-the-week': ['days'], 'pd-numbers': ['numbers'], 'pd-seasons': ['seasons'], 'pd-colors': ['colors'], 'pd-dates': ['date'] };
    for (const u of mpd.units) {
      if (ORDER[u.id] || u.id === 'pd-numbers' || u.id === 'pd-colors') u.keep = true;
      if (DROP[u.id]) u.words = u.words.filter(w => !DROP[u.id].includes(w.en));
      const ord = ORDER[u.id];
      if (ord) u.words.sort((a, b) => ord.indexOf(a.en) - ord.indexOf(b.en));
    }
  }
})(window);
