# Employee Onboarding Operations

**Employee Onboarding Operations** — a redesign of an existing internal onboarding
dashboard, running entirely on the synthetic demo data in this folder. **No real employee, manager, recruiter or HRBP data.**

Open **`Employee_Onboarding_Operations.html`** in a browser. No server, no build step, no install.

---

## 1. What changed, and what did not

The old dashboard was a single wall of gradient date cards: one card per cohort,
sixteen of them, all competing for attention, with hire detail underneath and an
analytics view bolted alongside. This version keeps every piece of information it
carried and rearranges the experience around the question the team actually opens
it to answer — *what is happening this month, and what do I need to do today?*

**Organised by month, not by date card.** The Cohorts page opens on the current
month with `‹ AUG | September 2026 | OCT ›`, a monthly summary, main cohorts as a
timeline, and off-cycle hires in their own section. Date cards are gone.

**Four real pages** — Cohorts, Analytics, Mandatory Sessions, Pilot Programme — each with
its own job. Previously Sessions was a link out to another web app and never showed
as selected, and the pilot programme was a gradient banner pinned above every view.

### Carried over deliberately

| From the old dashboard | Where it lives now |
|---|---|
| Cohort grid, 14-day "Active" window | Main-cohort timeline; the same rule drives the ACTIVE status |
| "Next" cohort = first cohort ≥ today | `NEXT UP` status, computed the same way |
| Function tabs (GTM, Engineering, …, Pilot, Non-US) | Team filter + cohort-type filter, plus clickable Analytics bars |
| Expandable hire cards, avatar, initials | Expandable hire rows |
| All nine info rows, Missing/Pending colour semantics | Property grid in the expanded row |
| Copy buttons on personal / work / manager email | Same three, now with a failure path |
| Status pills (Slack, Group, Kit, Okta, Device) | Step tags, with the Okta **date** no longer discarded |
| Non-US hires, Device/IT setup, Manager info | Three cards at the foot of the cohort detail |
| Analytics KPIs, 5 bar charts + month chart | Same set, plus a table view on every chart |
| Manager table with search | Same, now also **sortable** by manager / hires / month |
| Pilot members / joined / upcoming | The Pilot Programme page |

### Restored — features whose CSS survived but whose behaviour had been lost

The old file still carried `.hire-search`, `.role-chip`, `.expand-all-btn`,
`.search-count` and `data-search` / `data-role` attributes on every card, but nothing
read them. Those are working again: per-cohort search, role chips, expand/collapse
all, and a live result count.

### Defects fixed rather than reproduced

1. **No HTML escaping.** Every value used to be concatenated into `innerHTML`, and
   emails were interpolated into single-quoted `onclick` attributes — an apostrophe
   in a name broke the copy button. Everything now goes through `textContent`.
2. **UTC date drift.** `new Date().toISOString()` against a Los Angeles sheet could
   flip past/next/active a day early. "Today" is now the dataset's own
   `referenceDate`, and dates parse at local noon.
3. **State loss.** Changing a filter used to wipe the selected cohort and every
   expanded card. State is held in one object and survives.
4. **Analytics ignored the active filter.** The filter row now scopes the page it
   sits on, and the charts say how many hires are in scope.
5. **The Okta date was thrown away** by the pill that displayed it. It is shown.
6. **Keyboard and screen readers.** Rows are real buttons with `aria-expanded`, nav
   carries `aria-current`, charts are focusable with the same tooltip on focus as on
   hover, and every status is icon + text, never colour alone.

---

## 2. Files

| File | Role |
|---|---|
| `Employee_Onboarding_Operations.html` | Shell, design tokens, all CSS. Open this. |
| `operations_dashboard.js` | All application logic — pages, filters, charts, routing |
| `operations_data.js` | **Generated.** `window.ONBOARDING_DATA` — the single source of truth |
| `build_nho_data.py` | Reads both workbooks → `operations_data.js` |
| `generate_dummy_extensions.py` | Generates the companion workbook |
| `rebuild_dashboard.sh` | Runs the two scripts in the correct order |
| `NHO_Tracker_Dummy_Data.xlsx` | The tracker clone (not modified by any of this) |
| `NHO_Dummy_Extensions.xlsx` | **Generated.** Archive + pilot + sessions |

### Rebuilding after a data change

```sh
./rebuild_dashboard.sh        # then reload the page
```

Order matters, which is why the script exists: pilot membership and session attendance
reference tracker hires by work email, so the companion workbook has to be regenerated
against the current roster *before* `operations_data.js` is built.

---

## 3. Data architecture

```
NHO_Tracker_Dummy_Data.xlsx ─┐
                             ├─► build_nho_data.py ─► operations_data.js ─► the dashboard  
NHO_Dummy_Extensions.xlsx  ──┘      (normalise)        (one array)      (derive at render)
```

There is **one** hire array. Cohort counts, monthly roll-ups, every chart, the
needs-attention queue and the pilot page are all derived from it in the browser at
render time — nothing is pre-aggregated. Change a spreadsheet cell, re-run the
rebuild, and every number moves together.

### Why a second workbook

`NHO_Tracker_Dummy_Data.xlsx` is a clone of the live tracker tab, whose columns are
read **by position**. Adding a pilot flag or a session column to it would break the
very contract it exists to demonstrate. The live the previous dashboard already read a
second tab — the pre-May archive — with the same layout, so a companion workbook
mirrors the real architecture instead of inventing one. It holds:

- **Before May 26** — 25 archive hires, Jan–Apr 2026, so the hiring trend has a full
  Jan–Nov shape rather than starting abruptly in May
- **Pilot Programme** — 20 members (mirrors the live script's pilot name list)
- **Mandatory Sessions** / **Session Attendance**

Its vocabulary — departments, job titles, managers, recruiters, HRBPs, locations,
email domains — is **read out of the tracker**, not hardcoded, so the archive can
never introduce a parallel set of names and split the analytics charts in two.

### Derivations ported verbatim from the Apps Script

`build_nho_data.py` contains line-for-line ports of the previous dashboard's date
normaliser, its note parser (`Dept: X | Recruiter: Y`), its department-to-function
mapping (department keywords first, then job-title fallbacks, default `Other`) and its
50-state US check. A hire is classified exactly as it was before.

### Reading a tracker that keeps moving

The tracker is regenerated by a separate process and has already changed its header
row, column count, tab name and date formats. The loader therefore:

- finds the sheet by name **prefix** (the real tab name is 32 characters — one over
  Excel's limit — so any round-trip truncates it) and falls back to whichever sheet
  contains a `First Name` header;
- finds the **header row** by scanning the first twelve rows, as the live script does;
- resolves each column **by header name**, falling back to its fixed position;
- records which columns actually existed in `fieldsPresent`.

That last one matters: a column the tracker does not carry is not the same as a step
left undone. When the tracker has no welcome-call column, that step drops off the
readiness ladder and its attention rule switches off for those rows, instead of
flagging every hire for a field nobody tracks. This is per source, so the archive
(which does carry it) is unaffected.

---

## 4. Status system

| Status | Meaning | Shown as |
|---|---|---|
| `ACTIVE` | Started, still inside the 14-day onboarding window | green dot + text |
| `NEXT UP` | The first cohort on or after the reference date | blue dot + text |
| `UPCOMING` | A later cohort | neutral dot + text |
| `COMPLETED` | Past, outside the window | grey dot + text |
| `OFF-CYCLE` | Joining outside the two-week cadence | amber dot + text |
| `N FLAGS` | Has outstanding actions | red dot + count |

Never colour alone — each is a coloured dot plus a text label, and the flag badges
carry a number.

### Needs attention

Eleven rules, each a precise condition over one hire, limited to hires joining from
two weeks before the reference date onward — the window where action is still
possible. Welcome call, Slack, manager email, Google Group, device, kit, Okta after
start, personal email, manager info, location, and not assigned to a cohort.
Severity orders the list; each row names the people affected.

---

## 5. Charts

Single-series magnitude, so every bar is **one hue** — a value ramp across nominal
categories would double-encode length as colour. Bars are thin, gridlines are
hairlines, the value sits at the bar tip, and hovering or focusing any mark shows a
tooltip. Every chart has a **Table view** toggle, so no value is reachable only by
hovering. Departments beyond the top fourteen fold into an `Other (N more)` bucket
that always sorts last, however large, so it never reads as the leading category.
The chart hue and the status ramp were checked with a contrast validator against the
white surface; the warning and serious steps are darker than the usual reference
values because here they are painted as visible marks.

---

## 6. Theme

Four colours define the product; everything else is derived from them.

| Role | Hex | Where it appears |
|---|---|---|
| Primary | `#2563EB` | Actions, links, every chart bar, selected states |
| Accent | `#00B4D8` | The brand mark, the active-nav rail, one emphasised chart bar |
| Deep | `#0F172A` | Headings, body ink, the brand tile, tooltips |
| Background | `#F8FAFC` | The page plane; cards sit on `#FFFFFF` above it |
| Soft blue | `#E0F2FE` | Tinted surfaces, the pilot-programme tag |

**The accent is deliberately rationed.** `#00B4D8` measures 2.46:1 on white — below
even the 3:1 minimum for a non-text mark — so it is never used for text and never for
a mark a reader has to interpret on its own. It appears where it is both legible and
meaningful: on the deep navy tile, where it reads 7.24:1; as a 2px rail on the active
nav item, which already carries `aria-current`, a tint and a colour change; and as the
single emphasised bar for the current month in the hiring trend, whose value is printed
above it, named in the chart caption, and repeated in the table view. `--accent-2-ink`
(`#0E7490`, 5.36:1) is the readable step for anything that must carry contrast alone.

Every ink level clears 4.5:1 on white, on the page plane and on the hover surface:
`--ink` 17.06:1, `--ink-2` 9.90:1, `--ink-3` 5.19:1. The primary at 4.94:1 on the page
plane is safe as link text. The status ramp is unchanged and still clears 3:1 everywhere.

### Re-theming

Edit the five values in the `theme` block of `demo_config.json`, or set
`DEMO_THEME_PRIMARY` / `_ACCENT` / `_DEEP` / `_BACKGROUND` / `_SOFT`, then rebuild.
They flow through `build_nho_data.py` into the payload and are applied at load as CSS
custom properties. Only those five are overridable — every derived step (hover tints,
ink levels, the cyan ramp) stays in the stylesheet, so a bad override cannot quietly
drop contrast across the whole UI. Non-`#rrggbb` values are rejected at both ends.

## 7. Verification

```sh
node test_dashboard_logic.js     # 30 tests, all passing
```

The tests cover the rules most likely to break silently: date arithmetic across
month, year and DST boundaries; the cohort status ladder including both sides of the
14-day window; search matching (including a name with an apostrophe); the tally and
sort helpers; the off-cycle operational-date choice; and per-source column tracking.
They run against a fixed miniature dataset rather than the generated `operations_data.js`,
because the tracker is regenerated by a separate process and a test that moves with
the data cannot tell a regression from a data change.

The build was also put through a multi-agent review — four reviewers (correctness,
requirements coverage, privacy/data integrity, accessibility) with every finding
independently re-checked by a verifier whose default was to refute it. Thirty-two
findings survived and all thirty-two are fixed. The ones worth knowing about:

| Was | Now |
|---|---|
| A blank cohort cell was filled from the joining date, inventing a one-person cohort and making the "not assigned to a cohort" rule unfireable | Blank stays blank; the rule fires and the hire appears under **Not scheduled** |
| An unmatched column fell back to a fixed index and read the *neighbouring* column's data, while reporting itself as present | Once a sheet has real headers they are used exclusively; position is the contract only for a headerless clone |
| Typing in any search box dropped focus after one keystroke | Focus and caret are restored across the re-render |
| An active global search swallowed every navigation — the URL changed, the view did not | Navigating clears the search |
| The cohort detail silently inherited filters set elsewhere, understating its own KPIs | The filter row is shown on the detail page whenever a filter is active |
| The recruiter chart split shared reqs but the filter compared the whole cell, so some bars selected nothing | Chart, filter and table all read the same split |
| Bar length was measured against a row that also held the value label, so the longest bars were shortened | Bars have their own plot area; length is proportional again |
| Sessions forced sideways page scrolling between 861px and 1080px | A breakpoint covers that band |
| Step pills showed done/not-done by colour alone | They carry a ✓ or – |
| Needs-attention severity was carried by icon colour alone | Each row states CRITICAL / SERIOUS / WARNING, and expands to the full name list |
| Session attendance was read from the attendance sheet, so a hire missing from it was invisible | The audience is derived from cohort membership; attendance is joined onto it |
| The muted text token was 3.35:1 on the page background | Stepped to 4.77:1, clearing AA |
| A spreadsheet cell became a live `href` unchecked | Only `http(s)` URLs are rendered as links |
| The time-series table view was sorted by count, destroying the chronology | Chronological, matching its chart |
| Tracker and archive rows were never de-duplicated | Deduped by work email, then name + cohort, as the live script does |

Two verifier agents failed on an API safeguard error rather than returning a verdict,
so their two findings (both in the accessibility batch) were not adjudicated; the
underlying issues they came from are covered by the fixes above.

## 8. Known limitations

- **Light mode only.** A dark theme would need its own validated colour steps, not an
  automatic inversion.
- The dashboard is **read-only**, like the one it replaces. It never writes to a sheet.
- `rebuild_dashboard.sh` must be re-run after a tracker change; there is no file watcher.
- The automation panel is **descriptive**. It reports what the process does, not
  whether a trigger ran.
