# Suito 1.1.0 launch checklist

DRAFT plan. Nothing here has been posted. All times JST; November = US Pacific Standard Time (PT = JST − 17 h), US Eastern (ET = JST − 14 h).

## Before anything goes out

- [ ] 1.1.0 is **READY_FOR_SALE** (as of 2026-11-06 it is only on TestFlight, build 73, not submitted for review). Every draft assumes the AI features are live.
- [ ] Decide which orb ships. Build 73 has the floating Calendar orb; the uncommitted change moves it into the tab bar's accessory strip. Screenshots and video must match the shipped build. The drafts only say "hold the orb / tap the orb" and don't name its position.
- [ ] Device-check what the posts claim: plain-words entry (JA + EN), voice entry offline, receipt OCR on a real JP receipt, monthly letter, Ask, Siri add + summary, Spotlight, "Ask another AI" / 「ChatGPTで聞く」 hand-off, and the hidden AI state on a non-Apple-Intelligence iPhone.
- [ ] App Store listing updated for AI (`store.config.json`: AI家計簿, オフラインAI keywords; description still says nothing about AI). Posts send people to the listing, so it should mention the feature they came for.
- [ ] Capture media once, reuse everywhere: 10 s plain-words entry video (JA and EN), orb voice entry, receipt scan, monthly letter card, Siri, Spotlight, native tab bar. Use the `appstore-marketing` skill for framed panels.
- [ ] Re-read every draft for relative dates (本日/昨日) against the real posting time (VOICE.md rule 13).
- [ ] Note: 1.1.0 raises the minimum to iOS 26. Mention it where people will install (note, Reddit, PH already do).

## Posting order

D0 = the first weekday after 1.1.0 goes live. Spread over a week so you can answer replies on each.

| When (JST) | Where | File | Notes |
|---|---|---|---|
| D0 (Tue/Wed) 07:30–08:30 | **Zenn** | `zenn-ja.md` | Set `published: true`. Weekday morning commute is when Zenn trend lists pick up new posts. Add the Zenn URL to JA-S2. |
| D0 12:00–12:30 | **X JA thread** | `x-threads.md` | Pin it. Lunch is a JP peak. Link only in the last post. |
| D0 20:30–22:00 | **note** | `qiita-or-note-ja.md` | Evening is note's reading peak. Share once on X with a one-line quote. |
| D0 22:00–23:00 | **X EN thread** | `x-threads.md` | 22:00 JST = 08:00 ET / 05:00 PT, US morning. |
| D1 21:00 | X JA-S1 | | Video post, standalone. |
| D2 17:01 | **Product Hunt** | `producthunt-en.md` | PH day starts 00:01 PT = 17:01 JST. Post the first comment right away. Be around 17:00–翌 02:00 JST for US daytime replies. Tue–Thu is most crowded; a Fri/weekend launch is quieter but gets less traffic. |
| D2 or D3 22:00–23:00 | **Hacker News, Show HN** (optional) | reuse Reddit r/apple text | 08:00–09:00 ET. See caveats below. |
| D3 22:00 | **r/iosapps** | `reddit-en.md` | US morning. Dev flair. |
| D4 12:00 | X JA-S2 (Zenn link), X EN-S2 | | Developer angle. |
| Next Sun PT → Mon 01:00–03:00 JST | **r/apple** | `reddit-en.md` | Sunday 08:00–10:00 PT. Sunday-only rule is California time; Sunday 17:00 JST is 00:00 PT Sunday (allowed but dead hours). Use Reddit's scheduler if you don't want to stay up. |
| D6–D7 | X JA-S3 / EN-S3 | | Liquid Glass story; works any time, good filler for a quiet day. |

## Community caveats

**Zenn** (tech). Technical articles only, which this is. Topics are max 5, lowercase alphanumeric. Ending with an App Store link is normal; an article that is mostly ads is not. Check the guidelines once: https://zenn.dev/terms

**Qiita** (skipped for the note post). Qiita's guidelines are for programming knowledge; a user-facing app announcement can be flagged as promotion. If you want Qiita, post a *technical* piece (for example only the Foundation Models + React Native bridge part of the Zenn article) and avoid duplicating the Zenn text word for word. Check: https://qiita.com/terms and the community guideline.

**note**. No rules problem. No tables (they break on paste), no H1 in the body, title goes in the title field. Author display name is ベンガル (per VOICE.md); decide whether to post as that or under your real name, since the Zenn/X posts are under your own name.

**X（ツイッター）**. Posts with external links in the first post get less reach; link in the last post or a reply. Don't repost the identical text from multiple accounts.

**Product Hunt**. One launch per product version; don't ask for upvotes (PH discourages it and is known to demote launches that do). Asking people to "check it out / leave feedback" is fine. Hunter = yourself is fine. Recheck gallery image size in the upload form.

**Hacker News, Show HN**. Show HN is for things people can try now: an App Store link to a free app qualifies. Title like `Show HN: Suito, a budget app built on Apple's on-device model (no account)`. Write the text plainly and technically, no marketing copy, and don't ask anyone to upvote (vote rings are penalized). HN's audience leans away from iOS-only consumer apps, so this is optional; the technical angle (numbers from code, model only words them; Siri reading a JS snapshot) is what would interest them. Rules: https://news.ycombinator.com/showhn.html

**Reddit**. See the rule check at the top of `reddit-en.md`; I could not read the sidebars directly, only third-party mirrors. Key points: r/apple Sundays only (California time), developer self-post only, and mods want you to be an active member; r/iosapps once per 30 days with dev flair, and one guide says AI-wrapper apps are banned (Suito isn't one, but confirm). Disclose that you're the developer in every comment where you mention the app.

## After launch

- [ ] Reply to every comment within the first few hours on each platform.
- [ ] Watch ASC Analytics: impressions → product page views → downloads, compared with the pre-launch baseline (see `docs/agents/current-state.md`).
- [ ] Log what each channel brought (ASC "Sources" if available) in `docs/agents/current-state.md` so the next launch has numbers.
