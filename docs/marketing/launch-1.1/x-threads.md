# X（ツイッター）drafts: Suito 1.1.0 "Suito AI"

DRAFT. Post only after 1.1.0 is live. Limits: JA ≤140 chars per post, EN ≤280 per post (counted 2026-11-06 with links as 23: every post also fits X's weighted 280 limit, JA chars counting 2; the longest is EN-S3 at 279, so re-check after any edit). Put the App Store link in the LAST post of a thread (X tends to show link posts less), or in a reply. Media markers: `[画像]` / `[動画]` / `[IMAGE]` / `[VIDEO]`.

App Store: https://apps.apple.com/app/id6788700694

---

## JA thread (6 posts)

**1/6**
家計簿アプリ Suito に「Suito AI」を入れました。

Apple の Foundation Models を使っていて、AI は iPhone の中だけで動きます。記録が外に送られることはありません。

[動画：「昨日 スタバ 620」と書いて入力画面が埋まる 10 秒]

**2/6**
できること
・「昨日 スタバ 620」で金額・カテゴリ・日付が埋まる
・オーブを長押しして話しても入力できる
・レシートを撮ると読み取って入力
・先月のふりかえりの手紙
・家計について質問できる

保存は自分で押す形にしています。

[画像：オーブ長押し中の画面]

**3/6**
数字はすべてアプリのコードで計算して、AI には言い回しだけを任せています。

AI が金額を間違えると家計簿として使えないので、ここは一番気をつけたところです。「使いすぎ」のような責める言葉も出さないようにしました。

[画像：ふりかえりの手紙カード]

**4/6**
iOS 26 の iPhone なら、Siri から記録の追加や今月の収支の確認ができます。Spotlight で過去の記録も探せます。

もっと詳しく相談したいときは、集計済みの質問文を共有シートで ChatGPT に渡せます。送るのは自分で、Suito からは何も送りません。

**5/6**
音声も iPhone の中で文字にしていて、レシートの写真は保存しません。

App Store のプライバシー表示は引き続き「データの収集なし」です。アカウント登録も広告もありません。

**6/6**
Suito は無料で、アプリ内課金もありません。AI 機能は Apple Intelligence 対応の iPhone で使えます。

個人開発なので、感想や不具合はリプライでもらえると嬉しいです。
https://apps.apple.com/app/id6788700694

---

## JA standalone posts (3)

**JA-S1（入力）**
家計簿は記録が面倒で続かない、と感じていたので、書くだけで入力できるようにしました。

「昨日 スタバ 620」で金額・カテゴリ・日付が埋まります。AI は iPhone の中だけで動きます。

[動画：入力が埋まる様子]
https://apps.apple.com/app/id6788700694

**JA-S2（開発者向け）**
Expo（React Native）のアプリから Apple の Foundation Models を呼んでいます。

数字は JS 側で計算し、モデルには `{f:budget-left}` のような ID で文中に引用させるだけにしました。設計は Zenn に書きました。

[Zenn 記事のリンク]

**JA-S3（Liquid Glass）**
タブバーの Liquid Glass を自作で 6 回作り直したけど、どれもネイティブに見えなかった。

結局 OS の UITabBar をそのまま使うのが一番早かったです。屈折やレンズの動きはタブバー自体が持っている効果のようでした。

[画像：ネイティブのタブバー]

---

## EN thread (5 posts)

**1/5**
I just shipped Suito AI, an update to my calendar budget app for iPhone.

It runs on Apple's on-device Foundation Models. Your entries never leave the phone: no account, no cloud, no ads.

[VIDEO: typing "lunch 12.50" fills the entry form, ~10 s]

**2/5**
What it does:
- Type "lunch 12.50" and amount, category and date fill in
- Hold the orb and say it instead
- Scan a receipt to fill an entry
- A short letter about last month
- Ask questions about your own spending

You still tap Save yourself.

[IMAGE: orb listening]

**3/5**
One rule I kept: code computes every number, the model only writes the words.

The model cites facts by ID and the app fills in the exact amounts. If a sentence has a stray digit or scolds you, it gets dropped and nothing is shown.

[IMAGE: monthly letter card]

**4/5**
On any iOS 26 iPhone, Siri can add entries and answer "how much did I spend this month", and Spotlight finds past entries.

Want a bigger model? "Ask another AI" shows you the exact prompt first, then opens the share sheet for ChatGPT or any app. You send it, not Suito.

**5/5**
Speech recognition is on-device, receipt photos are never saved, and the App Store label still says Data Not Collected.

Free, no ads, no in-app purchases. AI features need an Apple Intelligence iPhone. Solo dev, feedback welcome.
https://apps.apple.com/app/id6788700694

---

## EN standalone posts (3)

**EN-S1 (privacy)**
Suito has no account, no server and no bank linking.

Version 1.1 adds AI that runs entirely on your iPhone with Apple's Foundation Models. Data Not Collected, free, no ads.

[VIDEO: voice entry with the orb]
https://apps.apple.com/app/id6788700694

**EN-S2 (dev)**
Building on-device AI into an Expo / React Native app: one JS interface for everything native, a deterministic fake for Playwright screenshots, and a rule that the model never produces a number on its own.

Write-up coming. App: https://apps.apple.com/app/id6788700694

**EN-S3 (Liquid Glass)**
I rebuilt my tab bar's Liquid Glass by hand six times. None of them looked native.

Switching to the system UITabBar was the answer for me. As far as I can tell, the refraction and the morphing lens belong to the bar itself; a glass view inside your own layout just renders flat.

[IMAGE: native tab bar]
