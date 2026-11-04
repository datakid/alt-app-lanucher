# Changelog

## 5.0.1 — 2026-11-04

### Fixed
- Selecting a row no longer writes `#tool-id` into the address bar, so a reload or bookmark no longer re-highlights a tool for no visible reason. A `#tool-id` link selects once.
- Typing a digit into the empty search box works, so `460` can be searched.
- Imported or stored preferences are validated: a bad language, theme or visit entry can no longer crash the app on every load. Pins are deduplicated.
- Importing a prefs file without `prefs` shows an invalid-file toast instead of recursing.
- Ids such as `constructor` or `__proto__` in pins, visits or data can no longer crash the app. Id-keyed maps have no prototype.
- Enter on a toast button or on the search clear and scope buttons no longer opens the active tool.
- The open transition clears itself if navigation does not happen.
- A fractional `def` falls back to a valid version.
- Group and tool ids are format-checked, reserved group ids are rejected, and a null variant gives a readable error.
- Pins for tools missing from imported data are hidden, not deleted, and return after a revert.
- The background update check no longer replaces an imported file before you press Apply.
- The tool sheet refreshes after a version switch (Open state, flag, description).
- The sheet's Open button and Enter respect the "open in new tab" setting.
- Rows outside the current list no longer keep a stale search version.
- Another tab's changes no longer clear your selection or switch your tab; motion is re-applied, and changes made while a sheet is open apply when it closes.
- `#tool-id` links work when the tool is outside the saved tab, and on `hashchange`.
- `?` and `g` hotkeys work on the Arabic keyboard layout.
- Settings offers Reload when an app update is waiting after the toast expired.
- Export keeps the data as written: no invented `ar`, `en`, `dar`, `den` or group icons, and revision 0 stays 0.
- `node tools/build.js --check` uses a frozen regression fixture, so data edits no longer fail it.
- A future `since` date no longer shows "New".
- Reopening the sheet during its close animation no longer closes the new sheet.
- A full-storage save failure shows a toast instead of failing silently.
- Clear history also clears remembered versions, and Undo restores them.
- The shortcuts sheet shows `Ctrl` on non-Mac systems; the copy fallback no longer reports success when it fails; the search field has an accessible name; the manifest splash colours match; `build.js` handles a minified `fihrist.json`; unused strings removed; the version is defined once as `F.VERSION`.

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
