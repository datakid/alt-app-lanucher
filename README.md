# فهرست — Fihrist v4

A bilingual (Arabic / English) keyboard-first index of pharmacy and insurance tools. Opens from `file://` with no server; updates itself from `fihrist.json` when it's served over http(s).

## Files
| Path | Role |
|---|---|
| `index.html` | Page shell; sets theme, language and density before first paint |
| `favicon.svg` | The seal: a drawn ف (filled shape with an open loop) in bone on an ink squircle, with a madder diamond dot. The same shape is inlined in the header and in the empty state |
| `fihrist.json` | **Editable data source.** Edit this file and bump `revision` |
| `js/data.js` | Built-in copy of the data (`window.FIHRIST_SEED`), so the app works offline / from `file://` |
| `js/core.js` | Store, schema validator, data loading, Arabic/Franco normalisation, fuzzy search, icons |
| `js/strings.js` | AR / EN UI strings |
| `js/app.js` | Rendering, rows, tabs, caret, open/pin/copy, toasts |
| `js/ui.js` | Sheets (tool, settings, shortcuts), input, drag-and-drop import, boot |
| `css/app.css` | All styles |
| `fihrist.schema.json` | JSON Schema for `fihrist.json`: completion, hovers (bilingual, with colour tables), snippets, and plain-language error messages in VS Code and any editor that supports JSON Schema |
| `.vscode/settings.json` | Links the schema, smooth scrolling and caret, bracket and token colours from the Fihrist pigments (separate light and dark sets) |

## Editing in VS Code
- Open the folder. `fihrist.json` picks up the schema through `"$schema": "./fihrist.schema.json"` and `.vscode/settings.json`.
- Inside `tools`, type `{` and choose **Tool · single link** or **Tool · with variants**. Inside `variants`, choose **Variant**. Tab moves through the fields; `pigment`, `group` and `icon` show drop-down choices.
- Hover any key to see what it does. Hover `pigment` to see every colour with its light and dark hex.
- Errors explain the fix in plain words, for example *"This tool has variants, so the link belongs on each variant. Remove "url"."*
- **Export data** writes a file that passes the schema: the `$schema` line first, empty fields dropped, one line per tool and one line per variant. It matches the hand-written layout, so git diffs stay small.

## How data updates
1. On load the app uses the built-in data (`js/data.js`). If a cached copy has a **higher `revision`** (or was imported by hand), it uses that instead.
2. When the browser is idle on http(s), it fetches `fihrist.json`. If `revision` is higher, it shows an **"Update available · Apply"** toast and caches the new data.
3. Under `file://`, use **Settings → Import JSON file**, or drag and drop `fihrist.json` onto the page.
4. **Settings → Revert to built-in data** drops the cached copy.
5. To ship a new built-in copy, paste the JSON after `window.FIHRIST_SEED =` in `js/data.js`.

Validation errors name the exact tool and field, for example `Tool #3 (parser): variant "alt" has an invalid url`.

### Schema (`fihrist/4`)
- `groups[]`: `id`, `ar`, `en`, `icon` (`layers|calc|flask|printer|star|box`)
- `tools[]`: `id`, `group`, `pigment` (`indigo|verdigris|madder|orpiment|lapis|malachite|tyrian|bone`), `ar`, `en`, `dar`, `den`, `aliases[]`, `since` (YYYY-MM-DD; shows a "New" flag for 21 days), `closed`, then **either** `url` **or** `variants[]` (`id`, `ar`, `en`, `url`, optional `dar`, `den`, `closed`) plus `def` (index of the default variant).

## Features
- Fuzzy search in Arabic, English and Franco-Arabic: ignores tashkeel, unifies alef/yaa/taa-marbuta, handles Persian letters and Arabic-Indic digits.
- **Wrong keyboard layout fix:** if typing gives no results, the app suggests the same keys on the other layout (`lhv` → `مار`).
- Tabs: All, Pinned, **Recent** (new), then each group. `⌥1–9` jumps to a tab; arrow keys move between focused tabs; Esc goes back to All.
- Pins with **Undo**. Reorder pins with `⌥↑/↓` in the Pinned tab.
- Tool sheet: versions, open, new tab, pin, copy link, **Fihrist deep link** (`#tool-id`), share, and **usage stats** (times opened, last used).
- Settings sheet: theme, **density (cozy/compact)**, **default open in same or new tab**, check for updates, import/export data, back up and restore preferences, clear history (with undo).
- Shortcuts panel (`?`). Arrow navigation wraps around. Number keys jump to a row by its number.
- Preferences sync live across open tabs (`storage` event). Old v2/v3 preferences migrate automatically.
- Offline/online toasts. Print styles. Reduced-motion and forced-colors support.

## Design system (v4.1 polish)
- **Focus:** rounded focus outlines that follow each control's corners (`outline` with `outline-offset`). No more rectangle boxes. The search field is a raised rounded card; when focused it gets a soft seal-coloured halo instead of an outline.
- **Rows:** rounded hover/active surfaces, hairline dividers that hide next to the active row, a short pigment caret, and folio numbers that take the row's colour when active.
- **Closed tools:** a small "Closed" pill next to the title and a dimmed title. The old strike-through is gone.
- **Chrome:** a pill group for the header controls, tabs that fade out at the scroll edges, a gradient line on top of sheets, raised segmented controls and a deeper toast.
- **Dark theme:** brighter muted text so it is easier to read.
- Speed: hover is throttled with requestAnimationFrame, preconnect is skipped on `file://`, the update check runs when idle, and Latin fonts load only in English.

## URIs
- `index.html?q=<query>`: start with a search
- `index.html#<tool-id>`: start with that tool selected

## Not yet implemented / next steps
- Service worker for full offline caching of fonts (fonts currently fall back to local metrics-matched faces).
- A visual editor for `fihrist.json` inside the app.
- A build step that regenerates `js/data.js` from `fihrist.json` automatically.

## Storage
`localStorage`: `fihrist:v4` (prefs, pins, visits, last variant) and `fihrist:data:v4` (cached or imported data). No backend or tables.
