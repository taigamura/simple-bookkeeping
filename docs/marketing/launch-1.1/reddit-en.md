# Reddit drafts: Suito 1.1.0

DRAFT. Post only after 1.1.0 is live. Post from your own account, reply to every comment yourself, and don't ask anyone to upvote.

## Rule check (2026-11-06; Reddit itself blocked automated reads, so these come from third-party rule mirrors and guides; open each sidebar + pinned post and confirm before posting)

**r/apple**
- Self-promotion is reported as **Sundays only (California time), developers only, self-post (text) only**. Sunday in California = Sunday 17:00 JST to Monday 17:00 JST (PST, winter).
- Mods are reported to remove promo from accounts that don't take part in the sub otherwise. Comment normally there for a while first.
- Anecdotes say some compliant posts still get removed. If it's removed, don't repost; message the mods once.
- Sources: [threadotter.com/subreddit-rules/apple](https://www.threadotter.com/subreddit-rules/apple), [pulsefox.io/subreddits/apple](https://pulsefox.io/subreddits/apple), [threadfox.vip/rules/apple](https://threadfox.vip/rules/apple), [r/iOSProgramming thread on r/apple self-promo](https://axebps-redlib.hf.space/r/iOSProgramming/comments/1j7e8rc/whats_going_on_with_self_promotion_on_rapple_sub).

**r/iosapps**
- Reported: self-promo allowed **at most once per developer every 30 days** (counted from your last app post, even a removed one), with the dev/self-promotion flair; one guide adds a minimum of ~10 karma in the sub.
- **One guide says generative-AI / AI-wrapper apps aren't allowed** and links must go to the App Store or TestFlight. Suito is not a wrapper (no API, no server; the AI is Apple's on-device model and the core app is a plain budget app), but check the current wording. If the rule bans any "AI app", lead with the budget app and keep AI as one feature, or skip this sub.
- Sources: [leadsrover.io/subreddits/r/iosapps](https://leadsrover.io/subreddits/r/iosapps), [replyhey.com/subreddits/iosapps](https://www.replyhey.com/subreddits/iosapps), [okara.ai list](https://okara.ai/blog/subreddits-that-allow-self-promotion), [screenfast.app guide](https://screenfast.app/blog/reddit-promotion-indie-ios-app).

Common to both: say plainly you're the developer, state the price (free, no IAP), and answer questions. Don't cross-post the same text on the same day.

---

## r/iosapps

**Flair:** the dev / self-promotion flair the sidebar names

**Title:**
[Dev] Suito: a calendar budget app with on-device AI. Free, no ads, no account

**Body:**

Hi all, I'm the developer of Suito, a budget app built around a calendar: tap a day, enter an amount, pick a category. It has no account, no server, no bank linking and no ads, and everything stays on your iPhone.

Version 1.1 adds some AI, all of it running on the phone with Apple's Foundation Models:

- Type "lunch 12.50" and the amount, category, date and note fill in. You still tap Save.
- Hold the orb and say the entry, or scan a receipt.
- A short letter about last month when a new month starts, and an Ask sheet for questions about your own spending.
- Siri can add entries and give summaries, and Spotlight finds past entries (any iPhone on iOS 26, no Apple Intelligence needed).

A few things I cared about:

- The app computes every number; the model only writes the sentences. It refers to amounts by ID and the app fills them in, so it can't miscount your month.
- Speech recognition is on-device only, receipt photos aren't saved, and the privacy label is still Data Not Collected.
- If you want a bigger model, "Ask another AI" shows you the exact prompt with your totals first, and you send it to ChatGPT or anything else through the share sheet yourself.

Price: free, no in-app purchases. Needs iOS 26; the AI features need an Apple Intelligence iPhone. English and Japanese.

https://apps.apple.com/app/id6788700694

I'm a solo dev, so any feedback is welcome, especially on how the plain-words entry handles your own phrasing.

[IMAGE or short VIDEO: plain-words entry filling the form. Image posts may not allow a body; if so, put the text above in the first comment]

---

## r/apple (Sunday, California time, text post)

**Title:**
I built a budget app that uses Apple's on-device Foundation Models, with Siri and Spotlight support. Some notes from building it

**Body:**

I'm a solo developer and I make Suito, a calendar budget app for iPhone. Version 1.1 adds features built on Apple's on-device model, and I wanted to share what worked and what didn't, since there still aren't many shipped apps using it.

**What the on-device model does well here**

Turning a short phrase into structured data. "lunch 12.50" becomes amount, category, date and note through guided generation, with the category picked from the user's own list. Same for a spoken entry (on-device speech recognition only) and for a receipt read with Vision OCR.

**What I didn't let it do**

Numbers. The app computes every total and the model cites them by ID, so a letter about last month can't contain a made-up amount. Any sentence with a stray digit, an unknown ID or a scolding word is dropped and nothing is shown.

**Siri and Spotlight**

App Intents work on any iOS 26 iPhone, even without Apple Intelligence: add an entry, period summary, spending by category, find entries. The app is React Native, so the JS side writes a JSON snapshot after every save and the Swift intents just read it. Siri's answers come from the same code as the app's screens. Compiling the intents into the main app target meant I didn't need an App Group.

**Liquid Glass**

I tried to rebuild the tab bar's Liquid Glass myself six times and none of them looked right. Placing a glass view inside my own layout rendered flat glass; the refraction and the moving lens seem to belong to UITabBar itself. I switched to the system tab bar.

**Privacy**

The label stays Data Not Collected. I left Apple's Private Cloud Compute model out of this release because I couldn't confirm whether an app's requests to it count as data collection. If anyone has a primary source on that, I'd really like to read it.

The app is free with no ads or in-app purchases: https://apps.apple.com/app/id6788700694

Happy to answer questions about Foundation Models from React Native.
