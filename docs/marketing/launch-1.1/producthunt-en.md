# Product Hunt draft: Suito AI (Suito 1.1.0)

DRAFT. Launch only after 1.1.0 is live on the App Store. PH launches go live at 12:01 AM Pacific (17:01 JST in winter).

**Name:** Suito

**Link:** https://apps.apple.com/app/id6788700694

**Tagline** (47/60):
A private calendar budget app with on-device AI

Alternatives:
- Budget app for iPhone whose AI never leaves the phone (53)
- Log spending in plain words, with AI that stays on-device (57)

**Description** (239/260):
Log spending on a calendar in a few taps, or just type "lunch 12.50", speak it, or scan a receipt. Suito's AI runs on your iPhone with Apple's Foundation Models. No account, no ads, no tracking: the App Store label says Data Not Collected.

**Topics:** iPhone, Personal Finance, Artificial Intelligence, Privacy, Apple

**Pricing:** Free (no in-app purchases)

**Media (in order):**
1. [VIDEO 30–45 s: type "lunch 12.50" → form fills → Save; hold the orb, speak an entry; receipt scan]
2. [IMAGE: Calendar with the orb]
3. [IMAGE: monthly letter card on Summary]
4. [IMAGE: Ask sheet answering a question about the month]
5. [IMAGE: Siri adding an entry / Spotlight result]
6. [IMAGE: "Ask another AI" prompt preview]
(Reuse the existing App Store panels from the appstore-marketing skill where they fit; PH gallery size: check the current PH upload guide, commonly cited as 1270×760.)

---

## Maker's first comment

Hi Product Hunt, I'm Taiga, and I build Suito on my own.

Suito is a calendar budget app for iPhone: tap a day, enter an amount, pick a category. It has no account, no server, no bank linking and no ads, and everything stays on the phone.

The reason most people stop keeping a budget, as far as I can tell, is that logging every day is a chore. So 1.1 adds Suito AI, built on Apple's on-device Foundation Models:

- Type "lunch 12.50" (or 「昨日 スタバ 620」 in Japanese) and the amount, category, date and note fill in. You still tap Save.
- Hold the orb and say it, or scan a receipt.
- At the start of a month, a short letter about last month. You can also ask questions about your own spending.
- On any iOS 26 iPhone, Siri can add entries and answer summaries, and Spotlight finds past entries.

A few decisions I'd love feedback on:

1. Code computes every number; the model only writes the words. It cites facts by ID and the app fills in exact amounts, so the AI can't get your totals wrong. Sentences that scold you ("overspent", "wasteful") are dropped.
2. Speech recognition is on-device only and receipt photos are never saved. Apple's larger cloud model is left out of this release because I couldn't confirm it keeps "Data Not Collected" true.
3. If you want a bigger model, "Ask another AI" shows you a prepared prompt with your totals first, and you send it to ChatGPT or any other app through the share sheet yourself.

The app is built with Expo / React Native, with a small Swift module for the model, Siri and Spotlight. The AI features need an iPhone with Apple Intelligence; everything else works on any iPhone with iOS 26 or later. English and Japanese are both fully supported.

It's free with no in-app purchases. I'd be glad to hear what feels useful and what feels off.
