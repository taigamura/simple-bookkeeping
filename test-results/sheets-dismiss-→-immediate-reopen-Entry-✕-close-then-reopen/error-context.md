# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sheets.spec.ts >> dismiss → immediate reopen >> Entry: ✕ close, then reopen
- Location: e2e/sheets.spec.ts:94:7

# Error details

```
Error: reopen after ✕ close

expect(locator).toBeVisible() failed

Locator: getByTestId('entry-sheet')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - reopen after ✕ close with timeout 5000ms
  - waiting for getByTestId('entry-sheet')

```

```yaml
- text: July 2026
- button "Previous month": 
- button "Next month": 
- button "Settings": 
- text: In ¥0 Out ¥0 Net +¥0 S M T W T F S
- button "Day 1": "1"
- button "Day 2": "2"
- button "Day 3": "3"
- button "Day 4": "4"
- button "Day 5": "5"
- button "Day 6": "6"
- button "Day 7": "7"
- button "Day 8": "8"
- button "Day 9": "9"
- button "Day 10": "10"
- button "Day 11": "11"
- button "Day 12": "12"
- button "Day 13": "13"
- button "Day 14": "14"
- button "Day 15": "15"
- button "Day 16": "16"
- button "Day 17": "17"
- button "Day 18": "18"
- button "Day 19": "19"
- button "Day 20": "20"
- button "Day 21": "21"
- button "Day 22": "22"
- button "Day 23": "23"
- button "Day 24": "24"
- button "Day 25": "25"
- button "Day 26": "26"
- button "Day 27": "27"
- button "Day 28": "28"
- button "Day 29": "29"
- button "Day 30": "30"
- text: S M T W T F S
- button "Day 1": "1"
- button "Day 2": "2"
- button "Day 3": "3"
- button "Day 4": "4"
- button "Day 5": "5"
- button "Day 6": "6"
- button "Day 7": "7"
- button "Day 8": "8"
- button "Day 9": "9"
- button "Day 10": "10"
- button "Day 11": "11"
- button "Day 12": "12"
- button "Day 13": "13"
- button "Day 14": "14"
- button "Day 15": "15"
- button "Day 16": "16"
- button "Day 17": "17"
- button "Day 18": "18"
- button "Day 19": "19"
- button "Day 20": "20"
- button "Day 21": "21"
- button "Day 22": "22"
- button "Day 23": "23"
- button "Day 24": "24"
- button "Day 25": "25"
- button "Day 26": "26"
- button "Day 27": "27"
- button "Day 28": "28"
- button "Day 29": "29"
- button "Day 30": "30"
- button "Day 31": "31"
- text: S M T W T F S
- button "Day 1": "1"
- button "Day 2": "2"
- button "Day 3": "3"
- button "Day 4": "4"
- button "Day 5": "5"
- button "Day 6": "6"
- button "Day 7": "7"
- button "Day 8": "8"
- button "Day 9": "9"
- button "Day 10": "10"
- button "Day 11": "11"
- button "Day 12": "12"
- button "Day 13": "13"
- button "Day 14": "14"
- button "Day 15": "15"
- button "Day 16": "16"
- button "Day 17": "17"
- button "Day 18": "18"
- button "Day 19": "19"
- button "Day 20": "20"
- button "Day 21": "21"
- button "Day 22": "22"
- button "Day 23": "23"
- button "Day 24": "24"
- button "Day 25": "25"
- button "Day 26": "26"
- button "Day 27": "27"
- button "Day 28": "28"
- button "Day 29": "29"
- button "Day 30": "30"
- text: S M T W T F S
- button "Day 1": "1"
- button "Day 2": "2"
- button "Day 3": "3"
- button "Day 4": "4"
- button "Day 5": "5"
- button "Day 6": "6"
- button "Day 7": "7"
- button "Day 8": "8"
- button "Day 9": "9"
- button "Day 10": "10"
- button "Day 11": "11"
- button "Day 12": "12"
- button "Day 13": "13"
- button "Day 14": "14"
- button "Day 15": "15"
- button "Day 16": "16"
- button "Day 17": "17"
- button "Day 18": "18"
- button "Day 19": "19"
- button "Day 20": "20"
- button "Day 21": "21"
- button "Day 22": "22"
- button "Day 23": "23"
- button "Day 24": "24"
- button "Day 25": "25"
- button "Day 26": "26"
- button "Day 27": "27"
- button "Day 28": "28"
- button "Day 29": "29"
- button "Day 30": "30"
- button "Day 31": "31"
- text: S M T W T F S
- button "Day 1": "1"
- button "Day 2": "2"
- button "Day 3": "3"
- button "Day 4": "4"
- button "Day 5": "5"
- button "Day 6": "6"
- button "Day 7": "7"
- button "Day 8": "8"
- button "Day 9": "9"
- button "Day 10": "10"
- button "Day 11": "11"
- button "Day 12": "12"
- button "Day 13": "13"
- button "Day 14": "14"
- button "Day 15": "15"
- button "Day 16": "16"
- button "Day 17": "17"
- button "Day 18": "18"
- button "Day 19": "19"
- button "Day 20": "20"
- button "Day 21": "21"
- button "Day 22": "22"
- button "Day 23": "23"
- button "Day 24": "24"
- button "Day 25": "25"
- button "Day 26": "26"
- button "Day 27": "27"
- button "Day 28": "28"
- button "Day 29": "29"
- button "Day 30": "30"
- button "Day 31": "31"
- text: S M T W T F S
- button "Day 1": "1"
- button "Day 2": "2"
- button "Day 3": "3"
- button "Day 4": "4"
- button "Day 5": "5"
- button "Day 6": "6"
- button "Day 7": "7"
- button "Day 8": "8"
- button "Day 9": "9"
- button "Day 10": "10"
- button "Day 11": "11"
- button "Day 12": "12"
- button "Day 13": "13"
- button "Day 14": "14"
- button "Day 15": "15"
- button "Day 16": "16"
- button "Day 17": "17"
- button "Day 18": "18"
- button "Day 19": "19"
- button "Day 20": "20"
- button "Day 21": "21"
- button "Day 22": "22"
- button "Day 23": "23"
- button "Day 24": "24"
- button "Day 25": "25"
- button "Day 26": "26"
- button "Day 27": "27"
- button "Day 28": "28"
- button "Day 29": "29"
- button "Day 30": "30"
- text: Mon, Jul 13 +¥0 No entries this day. Tap ＋ to add one.
- tab "Calendar":  Calendar
- button "Add entry": 
- tab "Summary":  Summary
```

# Test source

```ts
  1   | /**
  2   |  * Shared driver for the sheet-regression suite (#58). Drives the exported Expo
  3   |  * web build exactly the way the user does: real page loads, taps at the
  4   |  * physical coordinates of the controls, no synthetic state.
  5   |  *
  6   |  * Selectors are the app's own accessibility labels (i18n/strings.ts, pinned to
  7   |  * en-US in playwright.config.ts) plus the three sheet testIDs threaded through
  8   |  * nav/BottomSheet.tsx — no bespoke test hooks beyond those anchors.
  9   |  */
  10  | import { expect, type Locator, type Page } from '@playwright/test';
  11  | 
  12  | /** How long a tapped sheet gets to become visible before we call the open failed. */
  13  | export const OPEN_TIMEOUT = 5_000;
  14  | 
  15  | export type SheetId = 'entry-sheet' | 'settings-sheet' | 'budgets-sheet';
  16  | 
  17  | /**
  18  |  * A fresh cold page load: navigate, then wait for the app to pass its
  19  |  * fonts/persisted-state gate (the tab bar's ＋ FAB appearing is that signal).
  20  |  * Returns the fixed screen coordinates of the ＋ FAB and the Settings gear so
  21  |  * callers can tap like a finger does — at the position, immediately, without
  22  |  * Playwright's stability waits softening the first-tap race.
  23  |  */
  24  | export async function coldLoad(page: Page) {
  25  |   await page.goto('/');
  26  |   const fab = page.getByLabel('Add entry', { exact: true });
  27  |   await expect(fab).toBeVisible();
  28  |   const gear = page.getByLabel('Settings', { exact: true });
  29  |   const fabBox = (await fab.boundingBox())!;
  30  |   const gearBox = (await gear.boundingBox())!;
  31  |   return {
  32  |     fab: { x: fabBox.x + fabBox.width / 2, y: fabBox.y + fabBox.height / 2 },
  33  |     gear: { x: gearBox.x + gearBox.width / 2, y: gearBox.y + gearBox.height / 2 },
  34  |   };
  35  | }
  36  | 
  37  | /** Raw tap at screen coordinates — no actionability waits, like a real finger. */
  38  | export async function tapAt(page: Page, point: { x: number; y: number }) {
  39  |   await page.mouse.click(point.x, point.y);
  40  | }
  41  | 
  42  | export function sheet(page: Page, id: SheetId): Locator {
  43  |   return page.getByTestId(id);
  44  | }
  45  | 
  46  | /** Assert the sheet's content view is visible and inside the viewport. */
  47  | export async function expectSheetOpen(
  48  |   page: Page,
  49  |   id: SheetId,
  50  |   message?: string,
  51  | ) {
  52  |   const content = sheet(page, id);
> 53  |   await expect(content, message).toBeVisible({ timeout: OPEN_TIMEOUT });
      |                                  ^ Error: reopen after ✕ close
  54  |   const viewport = page.viewportSize()!;
  55  |   // gorhom marks the content view visible at the START of the ~300ms slide-up
  56  |   // present animation, so a box sampled the instant `toBeVisible` resolves
  57  |   // catches the sheet still translated below the fold (box bottom overshoots
  58  |   // the viewport). Retry the geometry assertions until the sheet settles into
  59  |   // the viewport (#63) — a sheet that never rises still fails at OPEN_TIMEOUT.
  60  |   await expect(async () => {
  61  |     const box = (await content.boundingBox())!;
  62  |     expect(box.y, `${id} top edge should be on screen${message ? ` — ${message}` : ''}`)
  63  |       .toBeGreaterThanOrEqual(0);
  64  |     expect(
  65  |       box.y + box.height,
  66  |       `${id} should rise into the viewport, not sit collapsed below it${message ? ` — ${message}` : ''}`,
  67  |     ).toBeLessThanOrEqual(viewport.height + 1);
  68  |   }).toPass({ timeout: OPEN_TIMEOUT });
  69  | }
  70  | 
  71  | /** Wait for a sheet to be fully gone (gorhom unmounts children after dismiss). */
  72  | export async function expectSheetGone(page: Page, id: SheetId) {
  73  |   await expect(sheet(page, id)).toBeHidden({ timeout: OPEN_TIMEOUT });
  74  | }
  75  | 
  76  | /**
  77  |  * Dismiss the currently-open sheet by tapping the dimmed backdrop — a point
  78  |  * horizontally centered in the phone frame, safely above the sheet's top edge.
  79  |  */
  80  | export async function tapBackdrop(page: Page, id: SheetId) {
  81  |   const box = (await sheet(page, id).boundingBox())!;
  82  |   expect(box.y, 'need visible backdrop above the sheet to tap').toBeGreaterThan(70);
  83  |   await page.mouse.click(page.viewportSize()!.width / 2, box.y - 40);
  84  | }
  85  | 
  86  | /**
  87  |  * Ghost-overlay probe (#60): after a dismissal — or a failed open — a tap on a
  88  |  * calendar day must still register. If an invisible layer is eating taps, the
  89  |  * day never becomes selected and this fails.
  90  |  *
  91  |  * Selection is read off the tile's own background, not `aria-selected`:
  92  |  * react-native-web does not emit `aria-selected` for `accessibilityRole=
  93  |  * "button"` (the DayCell role), so the attribute is always absent even for the
  94  |  * visibly-selected day. The selected day is the only cell painted a solid
  95  |  * accent tile; every other day is transparent, so "background stopped being
  96  |  * transparent" is the truthful signal that the tap landed and selection moved.
  97  |  */
  98  | async function dayIsSelected(cell: Locator): Promise<boolean> {
  99  |   const bg = await cell.evaluate((el) => getComputedStyle(el).backgroundColor);
  100 |   return bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent';
  101 | }
  102 | 
  103 | export async function expectCalendarTappable(page: Page, message?: string) {
  104 |   // Two candidate days so the probe works whatever day is already selected.
  105 |   for (const day of [3, 4]) {
  106 |     const cell = await visibleDay(page, day);
  107 |     if (await dayIsSelected(cell)) continue;
  108 |     await tapAt(page, await center(cell));
  109 |     await expect(
  110 |       async () => expect(await dayIsSelected(cell)).toBe(true),
  111 |       `calendar day ${day} tap did not register — tap-eating ghost overlay?${message ? ` — ${message}` : ''}`,
  112 |     ).toPass({ timeout: 2_000 });
  113 |     return;
  114 |   }
  115 |   throw new Error('both probe days were already selected — cannot happen');
  116 | }
  117 | 
  118 | /**
  119 |  * The month pager keeps neighbor months mounted offscreen, so a day label can
  120 |  * match several cells; pick the one inside the viewport.
  121 |  */
  122 | export async function visibleDay(page: Page, day: number): Promise<Locator> {
  123 |   const cells = page.getByLabel(`Day ${day}`, { exact: true });
  124 |   const width = page.viewportSize()!.width;
  125 |   for (const cell of await cells.all()) {
  126 |     const box = await cell.boundingBox();
  127 |     if (box && box.x >= 0 && box.x + box.width <= width + 1) return cell;
  128 |   }
  129 |   throw new Error(`no on-screen calendar cell for day ${day}`);
  130 | }
  131 | 
  132 | export async function center(locator: Locator): Promise<{ x: number; y: number }> {
  133 |   const box = (await locator.boundingBox())!;
  134 |   return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  135 | }
  136 | 
  137 | /**
  138 |  * Dead zone below the sheet's content (#61): distance from the bottom of the
  139 |  * lowest rendered child to the bottom of the sheet's content view. With
  140 |  * dynamic content-height sizing this should be ~0 (the view's own bottom
  141 |  * padding is outside the children, so it never counts as dead zone).
  142 |  */
  143 | export async function deadZoneBelowContent(page: Page, id: SheetId): Promise<number> {
  144 |   return sheet(page, id).evaluate((el) => {
  145 |     // Deepest rendered boxes, not direct children: a fixed-height scroll
  146 |     // container would otherwise mask blank space under its last row. Scrollable
  147 |     // content extending past the sheet yields a negative gap — no dead zone.
  148 |     let maxBottom = Number.NEGATIVE_INFINITY;
  149 |     for (const c of el.querySelectorAll('*')) {
  150 |       if (c.children.length > 0) continue;
  151 |       const r = c.getBoundingClientRect();
  152 |       if (r.height > 0 && r.width > 0) maxBottom = Math.max(maxBottom, r.bottom);
  153 |     }
```