# فهرست — Fihrist v5

A bilingual (Arabic / English) keyboard-first index of pharmacy and insurance tools. Opens from `file://` with no server; when it is served over http(s) it installs as an app, works offline and updates itself from `fihrist.json`.

## Files
| Path | Role |
|---|---|
| `index.html` | Page shell; sets theme, language, density and motion before first paint |
| `manifest.webmanifest` | Install manifest: name, colours, icons and the Pinned / Recent shortcuts |
| `icons/` | PNG icons for install (`icon-192`, `icon-512`, `maskable-512`) and `apple-touch-180` for iOS |
| `favicon.svg` | The seal: a drawn ف (filled shape with an open loop) in bone on an ink squircle, with a madder diamond dot. The same shape is inlined in the header and in the empty state |
| `fihrist.json` | **Editable data source.** Edit this file and bump `revision` |
| `js/data.js` | Built-in copy of the data (`window.FIHRIST_SEED`), so the app works offline / from `file://`. **Generated** from `fihrist.json`, do not edit by hand |
| `tools/build.js` | Validates `fihrist.json` with the app's own validator, regenerates `js/data.js`, stamps the service worker version (text and binary files are both hashed), and checks the manifest icons exist. `node tools/build.js --check` also runs the search regression and fails if anything differs |
| `tools/regress.js` | Runs 28 search queries in Arabic and English and compares ids, versions, scores and highlight ranges with `tools/regress.snap.json`, a snapshot taken from v4. It reads `tools/regress.fixture.json`, a frozen copy of the data, so editing `fihrist.json` never changes the snapshot. Only an intentional ranking change needs `node tools/regress.js --snap` |
| `tools/lint.js` | Fails on any comment, `console.log` outside `F.perf`, or `debugger` in the shipped files |
| `tools/bench.js` | Index and query timings on the real data and two generated fixtures, with budgets |
| `tools/regress55.js` | 40 search expectations (links, hosts, descriptions, scopes) in Arabic and English |
| `tools/regress-mine.js` | Personal-links checks: CSV and XLSX parsing, merge, replace, export round trips, the 600-link fixture |
| `tools/make-template.js` | Writes the files in `templates/` |
| `tools/fixtures/make-big.js` | Generates the 500 and 1500 tool fixtures and the 600-link CSV and XLSX (fixed seed; the generated files are not committed) |
| `tools/loader.js` | Node `vm` harness shared by the tools above |
| `templates/` | `fihrist-links-template.xlsx` and `.csv`: the import template for My links |
| `qa/` | Playwright harness: screenshots, pixel measurements, behaviour, performance. See `qa/README.md` |
| `sw.js` | Service worker (http/https only). Precaches the app shell and caches Google Fonts after their first load. A new version waits until you press **Reload** in the toast. `VERSION` is stamped by `tools/build.js`, do not edit it by hand |
| `js/core.js` | Store, schema validator, data loading, Arabic/Franco normalisation, search index and ranking, icons |
| `js/strings.js` | AR / EN UI strings |
| `js/motion.js` | Frame scheduler (reads then writes), FLIP, sliding indicators, springs |
| `js/app.js` | Keyed rendering, rows, tabs, caret, Today shelf, open/pin/copy, toasts |
| `js/palette.js` | Command mode (`>`) and the `g` + key hotkeys |
| `js/ui.js` | Sheets, input, gestures, drag-and-drop import, service worker updates, boot |
| `js/xlsx.js` | Small spreadsheet reader and writer (zip, inflate, XML). Loaded on demand |
| `js/mine-core.js` | My links: CSV and XLSX mapping, merge, export, templates. Loaded on demand |
| `js/mine-ui.js` | My links: add and edit sheet, import preview. Loaded on demand |
| `js/qr.js` | A small QR encoder (byte mode, error correction M, versions 1–6) used by the tool sheet |
| `css/tokens.css` | Colour, spacing, radius, motion and type tokens |
| `css/app.css` | All component styles |
| `fihrist.schema.json` | JSON Schema for `fihrist.json`: completion, bilingual hovers (with colour tables), snippets and plain-language errors in VS Code and any editor that supports JSON Schema |

## Editing in VS Code
- Open the folder. `fihrist.json` picks up the schema through `"$schema": "./fihrist.schema.json"`.
- Inside `tools`, type `{` and choose **Tool · single link** or **Tool · with variants**. Inside `variants`, choose **Variant**. Tab moves through the fields; `pigment`, `group` and `icon` show drop-down choices.
- Hover any key to see what it does. Hover `pigment` to see every colour with its light and dark hex.
- Errors explain the fix in plain words, for example *"This tool has variants, so the link belongs on each variant. Remove "url"."*
- Optional `lexicon`: `{ "term": ["synonym", "مرادف"] }` teaches description search your own words (up to 200 terms, 10 synonyms each).
- **Export data** writes a file that passes the schema: the `$schema` line first, empty fields dropped, one line per tool and one line per variant, so git diffs stay small.

## How data updates
1. On load the app uses the built-in data (`js/data.js`). If a cached copy has a **higher `revision`** (or was imported by hand), it uses that instead.
2. When the browser is idle on http(s), it fetches `fihrist.json`. If `revision` is higher, it shows an **"Update available · Apply"** toast and caches the new data.
3. When the app files themselves change, the browser installs the new service worker in the background and waits. A toast says **"New version of Fihrist · Reload"**. Pressing Reload activates it and reloads once. Nothing reloads on its own.
4. Under `file://`, use **Settings → Import file**, or drag and drop `fihrist.json` onto the page. There is no service worker and no auto-update there.
5. **Settings → Revert to built-in data** drops the cached copy.
6. To ship a new built-in copy, edit `fihrist.json`, bump `revision`, then run `node tools/build.js`. It stops with the tool and field name if the data is invalid. Run `node tools/build.js --check` before committing: it confirms `js/data.js` and `sw.js` are in sync, that every file in the shell list and every manifest icon exists, and that search results still match the v4 snapshot.

Validation errors name the exact tool and field, for example `Tool #3 (parser): variant "alt" has an invalid url`.

### Schema (`fihrist/5`)
Files tagged `fihrist/4`, or with no `format`, still load. Export always writes `fihrist/5`.
- `groups[]`: `id`, `ar`, `en`, `icon` (`layers|calc|flask|printer|star|box|pill|chart|doc`)
- `tools[]`: `id`, `group`, `pigment` (`indigo|verdigris|madder|orpiment|lapis|malachite|tyrian|bone`), `ar`, `en`, `dar`, `den`, `aliases[]`, `tags[]`, `kbd`, `since` (YYYY-MM-DD; shows a "New" flag for 21 days), `closed`, then **either** `url` **or** `variants[]` (`id`, `ar`, `en`, `url`, optional `dar`, `den`, `aliases[]`, `closed`) plus `def` (index of the default variant).
- `tags` are extra search words that never appear on screen. They rank a little below aliases and never show as the "why" hint.
- `kbd` is one character, `a`–`z` or `0`–`9`. Press `g`, then that key, to open the tool. A key can belong to one tool only; a repeated key is ignored. No built-in tool has a `kbd` yet, so the hotkey is opt-in.

Rule for aliases: a word that points at ONE version goes in that variant's `aliases`; a word for the tool in general stays in the tool's `aliases`. Never put the same word in both.

## Features
- Search in Arabic, English and Franco-Arabic: ignores tashkeel, unifies alef/yaa/taa-marbuta, handles Persian letters and Arabic-Indic digits.
- **Multi-word, cross-field search:** words can come from different fields (`parser alt`, `drug list full`, `qarar 460`), in any order. Typos are tolerated, the Arabic article (ال) is ignored, and a digit can pick a version (`paid 2`).
- **In other sections / partial matches:** search always covers every tool. On a tab, other sections' hits follow under their own band; if no tool matches every word, the closest ones show under a "Partial matches" band.
- **Variant search:** typing a version's name, alias, id or site name switches that row to the version: its chip lights up, its name shows next to the title, and Enter opens it. `⌥←/→` changes the version while searching. The chip highlight glides between versions.
- **Wrong keyboard layout fix:** if typing gives no results, the app suggests the same keys on the other layout (`lhv` → `مار`).
- **Today shelf:** pinned and most-used tools as cards above the list. It shows on the All tab when the search box is empty and at least two tools qualify. Hide it with the button (with Undo), in Settings, or with `⌥S`.
- **Command mode:** type `>` in the search box. Change theme, language, density, motion, where tools open and the shelf; check, import, export or revert data; back up or restore preferences; clear history; show shortcuts and what's new. Each command confirms with a toast.
- **Search by link and by description (5.5):** paste or type part of a link (`lx-parser.vercel`) and the tool and version open. Describe what you want (`converts handwriting to font`, `تحويل خط اليد`) when nothing matches by words. `@host` searches hosts only; `#group words` searches inside a group (`#print font`). A link that matches nothing offers **Open this link**.
- **My links (5.5):** Settings, the tool sheet and command mode (`>add`, `>import`, `>template`, `>export`) manage personal links. Import `.xlsx`, `.csv` or a Fihrist `.json`; one sheet is one group; repeat a name on rows with different links to make versions. See `templates/`.
- **Keyword templates (5.5):** a link with `{q}` or `%s` shows a `{q}` pill. Type to find it, press **Tab**, type the argument and press Enter. Backspace on an empty argument or Esc leaves it.
- **Hotkeys:** `g` then a tool's `kbd` key opens it (with the search box empty and not focused).
- Tabs: All, Pinned, **Recent**, then each group, with a sliding indicator. `⌥1–9` jumps to a tab; arrow keys move between focused tabs; Esc goes back to All. `?tab=pinned` or `?tab=recent` start on that tab.
- Pins with **Undo**. Reorder pins with `⌥↑/↓` in the Pinned tab; rows slide to their new place.
- Tool sheet: versions with a sliding thumb, open, new tab, pin, copy link, **Fihrist deep link** (`#tool-id`), share, **QR code** for the tool's link, and **usage stats** (times opened, last used, a 14-day chart). It is a real dialog: Esc, backdrop click, focus return, and on phones a drag-to-dismiss with a spring flick.
- Settings sheet in cards: appearance (theme, density, motion), behaviour (default open in same or new tab, Today shelf), data, and preferences.
- Shortcuts panel (`?`). Arrow navigation wraps around. Number keys jump to a row by its number (when the search box is not focused).
- Preferences sync live across open tabs (`storage` event). Old v2, v3 and v4 preferences migrate automatically and the old keys are left in place.
- Installable app with offline support. Offline/online toasts. Print styles. Reduced-motion (system setting or in-app) and forced-colors support.

## Design system (Ink & Pigment v5.5)
- **Pills:** four heights (18, 22, 30, 36 px) with matching horizontal padding and label sizes, all in `--f-ui` (Readex Pro). Text is centred by size-specific nudge tokens (`--n-xs … --n-lg`), measured at 1x, 2x and 3x. Indicators sit in the padding as diamonds.
- **Ruled margin, rubric bands, diamond rule:** a hairline on the inline-start edge of the list that the caret rides on; group bands in the seal colour that end in a diamond.
- **Tokens** live in `css/tokens.css`: ink and canvas colours (light and dark), the eight pigments, a 4-based spacing scale, radii, durations, an ease-out curve and a spring curve.
- **Search bar:** a raised card with the result count and a scope pill inside the field. The sticky bar condenses and gains a shadow on scroll. Glass blur is used only where the device can afford it (`.no-glass` is added on 4-core or low-memory devices).
- **Motion:** only `transform` and `opacity` animate, except one small sliding indicator that also animates its width. Rows move with FLIP; the caret is one element whose position is cached, not measured on every move; the open transition is a clip-path reveal so text never stretches.
- **Rows:** keyed and reused between keystrokes, with `content-visibility: auto`. Hover no longer moves the selection; a mouse move after a key press only dims the caret.
- **Surfaces:** the Today shelf, tiles in the tool sheet, cards in settings and a progress hairline on toasts. The sheet scrim is a plain layer inside the dialog, not `::backdrop`, so a drag can fade it in every browser.
- **Closed tools:** a small "Closed" pill next to the title and a dimmed title.
- **Speed:** fonts load without blocking first paint, the update check runs when idle, preferences are written when the browser is idle and always before a tool opens, and Latin fonts load only in English.

## URIs
- `index.html?q=<query>`: start with a search. The `@` and `#` prefixes work here too, for example `?q=%23print%20font`
- `index.html#<tool-id>`: select that tool once on load (switches to All and clears the search if the tool is hidden). The address bar no longer keeps the hash afterwards
- `index.html?tab=<tab-id>`: start on a tab (`pinned`, `recent`, or a group id)

## Storage
`localStorage`: `fihrist:mine:v1` (your personal links, 1.5 MB at most; separate from built-in data and untouched by Revert); `fihrist:v5` (prefs, pins, visits with a per-day count, last variant, shelf, motion, what's-new flag) and `fihrist:data:v5` (cached or imported data). The old `fihrist:v4`, `v3`, `v2` and `fihrist:data:v4` keys are read once for migration and never deleted. `sessionStorage`: one flag, `fihrist:settled`, so the seal's ink settle plays once per session. No backend or tables.
