# Changelog

## 5.0 — 2026-10-28

### Added
- Today shelf: pinned and most-used tools as swipeable cards.
- Command mode: type `>` to change settings and run data actions from the search box.
- `g` then a key opens a tool that has a `kbd` in `fihrist.json`.
- Installable app: manifest, PNG icons, install shortcuts for Pinned and Recent, `?tab=` start parameter.
- Update flow: a new version waits in the background and a toast offers **Reload**.
- QR code for any tool's link in the tool sheet.
- 14-day usage chart in the tool sheet; visits now keep a per-day count.
- Data format `fihrist/5`: `kbd` and `tags` on tools, group icons `pill`, `chart` and `doc`.
- Settings: motion (auto or reduced) and a Today shelf switch. What's-new notice on the first run after upgrading.
- `tools/regress.js`: a 28-query search snapshot taken from v4, wired into `node tools/build.js --check`.

### Changed
- New visual system (Ink & Pigment v5) in `css/tokens.css` and `css/app.css`: search bar with in-field count and scope pill, sliding indicator on tabs, versions and segmented controls, cards in settings.
- Sheets are real `<dialog>` elements with spring drag-to-dismiss, focus return and Esc.
- Preferences are stored under `fihrist:v5`; the cached data under `fihrist:data:v5`. Old keys are migrated and kept.

### Fixed
- Typing no longer repaints every row and rebuilds the list on every keystroke; rows are reused and only changed text is updated.
- Rows no longer flicker when you type fast; the staggered entry animation is gone.
- The caret no longer measures the page on every move; its position is cached and measured once per change.
- Moving the mouse no longer steals the selection, changes the URL or moves the caret.
- Blur effects are lighter: the header glass only turns on for capable devices, the sheet backdrop has no blur and the fixed gradient layer is gone.
- Whole-page view transitions are gone for pinning and language; only the theme switch uses one, as a circular reveal.
- Saving preferences no longer blocks the open path; they are written when the browser is idle and always before a tool opens.
- The open transition no longer stretches the title; it reveals the tool's colour instead of scaling it.
- The app can be installed properly, and iOS gets a PNG touch icon.
- Google Fonts no longer block first paint.
- Tabs, versions and segmented controls glide instead of jumping.
- The page no longer shifts while it loads (layout shift 0), and the result count has enough contrast.

### Kept
- Search ranking, normalisation and the wrong-layout suggestion are unchanged; all 28 regression queries match v4.
- Every v4 feature and shortcut, tool data, ids, URLs and the eight pigment colours.
- Existing `fihrist.json` files (format `fihrist/4`) still load and import.
