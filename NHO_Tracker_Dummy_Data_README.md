# NHO_Tracker_Dummy_Data.xlsx — handover / training documentation

File: `./NHO_Tracker_Dummy_Data.xlsx`
md5 `8399e1fc7950c5ef12d06dee46a90172` · 13,251 bytes · file mode `0444` (read-only on purpose — see §7)

---

## 1. What this file is

A **fully synthetic clone of the onboarding cohort tracker**. It reproduces the tab name, the column
order, the data types, the date string formats and the status-flag semantics that the Onboarding Apps
Script (`Code.gs`) expects — but **every person, email address, group URL and meeting link in it
is invented**. It contains no real employee, no real manager, no real recruiter, no Slack ID, no
spreadsheet ID and no credential of any kind. It is safe to screen-share, attach to a ticket,
commit to a repo, hand to a new joiner, or use as the backing sheet for a demo dashboard.

| Property | Value |
|---|---|
| Worksheet tab name | `Cohort Tracker May - December 26` (32 characters — matches `CONFIG.TRACKER_SHEET_NAME` exactly) |
| Worksheets | 1 (no hidden tabs, no `Errors` tab, no banner rows) |
| Header row | Row **1** |
| First data row | Row **2** |
| Data rows | **48 hires** (sheet rows 2–49) |
| Columns | **25**, A → Y |
| Freeze panes | `A2` |
| Reference "today" | **2026-09-11** — every lifecycle decision in the file (what is Past / Active / Next / Upcoming, who has Okta, who has a device) was computed against this fixed date, not against the real clock |
| Email domains | `@example.com` (work + manager) and `@example.net` (personal) — both IANA/RFC 2606 reserved, so nothing can ever be delivered to a real inbox |
| Cell types | 873 strings, 250 booleans, 77 empty. **Zero `datetime` cells** — all dates are text (see §4c) |
| Data validation | none (no checkboxes, no dropdowns — see §4b note) |

Cohort spread (column H), relative to 2026-09-11:

```
May 11  2      Jul 13  3      Sep 08  5  <- Active (running)
May 25  0      Jul 27  4      Sep 21  7  <- Next, and the busiest date in the file
Jun 08  4      Aug 10  5      Oct 05  4
Jun 22  3      Aug 24  3      Oct 19  3
Jul 06  2                     Nov 02  1
                              Nov 30  2
                              Dec 14  0
```

**Sixteen tiles, no seventeenth.** Every value in column H is the display form of one of the 16
`CONFIG.COHORT_DATES` (Code.gs:133-139). An earlier build invented a `Sep 24, 2026` cohort and
parked four hires on it; that date is not in `CONFIG.COHORT_DATES`, so `isOffCycleStart_`
(Code.gs:3557) fired on all four and `getDashboardData` rendered a 17th tile the demo script could
not account for. Those four hires now sit in the `Sep 21, 2026` cohort, which is both the **Next**
tile and the file's deliberate busy date (7 hires) — the multi-hire cohort the brief asked for,
on a date the automation actually recognises.

`May 25, 2026` and `Dec 14, 2026` deliberately have **no hires** so the dashboard's "No hires"
empty-tile state is exercised. May 25 is Memorial Day in `CONFIG.US_HOLIDAYS_2026`.

**Exactly two rows are off-cycle** — column G is not itself a cohort date, so `isOffCycleStart_`
fires twice on a full scan and no more:

| Sheet row | Hire | Joining date (G) | Cohort (H) | Why it is here |
|---|---|---|---|---|
| 32 | Kwame Osei | `2026-09-02` | `Sep 08, 2026` | starts mid-cycle, parked on the cohort that is **running now** |
| 34 | Jonas Sorensen | `2026-09-14` | `Sep 21, 2026` | starts after a cohort has begun, parked on the **next** one |

Two is the smallest number that still proves column H is a distinct concept from column G in both
directions, and both sit in the September window so they are visible in one screenful. Every other
row starts exactly on its cohort date.

---

## 2. Columns / fields created

One row per column, in sheet order. "Example" values are taken verbatim from the file.

| Col | Header | Data type | Format | Example synthetic value | Purpose |
|---|---|---|---|---|---|
| A | `CTA Status` | string | text (`@`); three states | `Onboarded` (23) / `In Progress` (5) / blank (20) | CTA programme state. Rendered as a green pill on the hire card — **and only ever green** (see the vocabulary note below §2). |
| B | `Manager Email Sent` | boolean | `General`; real `TRUE`/`FALSE` | `TRUE` (38) / `FALSE` (10) | Idempotency gate — stops the manager Day-1 DM from re-sending. |
| C | `Slack` | boolean | `General` | `TRUE` (38) / `FALSE` (10) | The cohort Slack channel `onboarding-<yyyy-MM-dd>` exists and hires were added. |
| D | `New Hire Kit Ordered` | boolean | `General` | `TRUE` (34) / `FALSE` (14) | Swag/welcome kit ordered. Human-maintained; no script writes it. |
| E | `First Name` | string | text | `Imani` | Hire identity; dedup key part; header-row anchor for two readers. |
| F | `Last Name` | string | text | `Carter` | Hire identity; dedup key part. |
| G | `Joining Date` | string | text, `yyyy-MM-dd` | `2026-09-21` | Actual start date. Drives cohort assignment and the off-cycle alert. |
| H | `Next Cohort Date` | string | text, `MMM dd, yyyy` (**day zero-padded**) | `Sep 21, 2026` | The onboarding cohort the hire belongs to. **The join key for the entire automation.** |
| I | `Personal Email` | string | text | `imani.carter@example.net` | Pre-start contact; Google Group membership; strongest dedup key. Blank on 2 rows. |
| J | `Work Email` | string | text | `imani.carter@example.com` | Corporate address. Row key for manager-DM state and the Okta/IT sync. Blank on 4 rows. |
| K | `Job Title` | string | text | `Engineering Manager` | Role. Feeds the dashboard role chips (`Intern` / `HRBP` / `Manager`). |
| L | `Manager Name` | string | text | `Riley Chen` | Hiring manager. 11 distinct managers across 48 hires. |
| M | `Manager Email` | string | text | `riley.chen@example.com` | **Derived** from column L. The Slack lookup key for every manager DM. |
| N | `HRBP` | string | text | `Priya Raman` (19) / `Dominic Shaw` (16) / `Marisol Vega` (11) | HR business partner. Human-filled; blank on **2** rows → a small "Not assigned" bar in analytics. |
| O | `Recruiter` | string | text | `Colette Byrne` (14), `Erin Maddox` (10), `Tobias Winters` (9), `Renata Lombardi` (8), `Malik Osborne` (7) | Recruiter, never blank. Recruiters own req families (eng / GTM / product+design+marketing / finance+legal+ops / people+security), with three cross-cover exceptions. Legacy `Dept: X \| Recruiter: Y` form also parses — see §3. |
| P | `Google Group Created` | **mixed**: URL string or boolean `FALSE` | text (`@`) | `https://groups.google.com/a/example.com/g/09-08-2026` (38 rows) / `FALSE` (10) | Cohort Google Group. The slug is the cohort in `MM-DD-YYYY`, matching `google_group_email` at Code.gs:1029. **Identical on every row of a cohort** (see below). Mixed type is deliberate and mirrors `Code.gs` — see §3 and §4c. |
| Q | `Google Group Meeting Link` | string (URL) or blank | text | `https://meet.google.com/tls-pgpz-hlb` | Welcome-call Meet link. **One link per cohort, identical on every row of that cohort** — Code.gs:2381 loops a cohort and stamps the same link on all of them, so 48 distinct links was a state the automation can never produce. Write-only: nothing reads it. |
| R | `Location` | string | text | `Bengaluru, India` / `Austin, Texas, United States` | Work location, in **one** format with two shapes (see below). Drives the non-US IT-provisioning alert and the UK/EMEA Slack add-on. |
| S | `Dashboard Link` | string | text | `https://example.com/nho-dashboard?cohort=2026-05-11&hire=sanne.visser` | **Manual column — no code reads or writes it.** Now populated with the per-hire deep link an operator would paste into a ticket. |
| T | `DM to manager` | boolean | `General` | `TRUE` (31) / `FALSE` (17) | Record that the manager Day-1 Slack DM went out. |
| U | `DM to new hire` | boolean | `General` | `TRUE` (31) / `FALSE` (17) | Record that the new-hire Day-1 Slack DM went out. |
| V | `HRBP from sheet` | string | text | `Priya Raman` (mirrors N) | **Manual column — no code reads or writes it.** Now a straight mirror of column N, which is the only reason a real sheet keeps both: you eyeball N against the V lookup and spot drift. Blank wherever N is blank. |
| W | `Department` | string | text | `Engineering` | Source department. Mapped to a dashboard function tab by `deptToFunction_`. |
| X | `Okta Activated` | string | text, `✓ yyyy-MM-dd` | `✓ 2026-09-08` (27 rows) / blank (21) | Okta account live. The pill shows only the check mark, never the date. |
| Y | `Device Ship Date` | string | text, `yyyy-MM-dd` **or** the literal `ordered` | `2026-09-01`, `ordered` (3 rows), blank (16) | Laptop shipped. `ordered` is the real sentinel used when Slack carried no date. |

### Department → dashboard function tab

13 departments are used, and **every one maps to a named tab** (no hire falls into the hidden
`Other` bucket, so the tab counts sum exactly to the "All" count):

`Engineering` → Engineering (14) · `Sales` + `Customer Success` → GTM (10) ·
`Product` + `Design` → Product (6) · `Finance` + `Legal` → Finance & Legal (4) ·
`People` + `Recruiting` → People & HR (4) · `Information Security` → InfoSec / IT (3) ·
`Marketing` → Marketing (3) · `Behavioral Science` → Labs & Research (2) ·
`Business Operations` → Business Ops (2).

### The completion ladder (why no row is impossible)

Every row carries one integer "depth" 0–8, and each step is on **iff depth ≥ step**. Because the
mapping is monotone you can never find a row that has, say, a Google Group but no work email:

| Step | Turns on | Columns |
|---|---|---|
| 1 | Work email assigned | J |
| 2 | Manager notified | B, and T/U once the cohort has started |
| 3 | Cohort Slack channel exists | C |
| 4 | Google Group created | P (URL), Q (Meet link) |
| 5 | New-hire kit ordered | D |
| 6 | Laptop shipped or ordered | Y |
| 7 | Okta account activated | X |
| 8 | CTA closed out | A = `Onboarded` |

Cohorts are provisioned as a **batch**, so no cohort straddles step 4: either every row in it has
a Google Group and a Meet link, or none does. That is what makes columns P and Q identical inside
each column-H group, which is the only state `Code.gs` can actually produce.

### Column A vocabulary — and why it is short

`Onboarded` · `In Progress` · blank. Nothing else, ever.

The dashboard renders this cell as
`'<span class="pill green">🎯 ' + hire.ctaStatus + '</span>'` (`getDashboardHtml_`, Code.gs:3503,
rendered line 341). The class is **hardcoded `green`** — there is no status→colour map, and the
literal is interpolated raw. So *any* word you put in column A paints as a success: `No Show`,
`Dropped`, `Declined` and `Incomplete` would all render as a green tick next to a target emoji.
The vocabulary is therefore restricted to affirmative states, and the generator asserts it.

| Value | Meaning | Where it appears |
|---|---|---|
| `Onboarded` | Terminal. The CTA Closing Call (Code.gs:1734) has run and L&D closed the row out. | 23 rows, all in cohorts that have finished or are running |
| `In Progress` | The hire is inside, or has been through, the cohort; the row is not closed out. | 5 rows |
| blank | Nothing recorded — the cohort has not started, or the row is still waiting on a human. | 20 rows |

Blank renders as **absence**, not as an "off" pill: `if (hire.ctaStatus)` guards the whole span,
so a blank hire's pill row is simply one pill shorter. This is the only field on the card with a
two-state *green pill / nothing at all* render; Slack, Group, Kit, Okta and Device each emit a
grey `—` pill when false. No future cohort carries a value, because a completion badge on a hire
who has not had a first day is a visible contradiction the renderer cannot soften.

### Column R format — one format, two shapes

| Shape | Used for | Example |
|---|---|---|
| `City, <Full State Name>, United States` | every US row | `Austin, Texas, United States` |
| `City, <Full Country Name>` | every non-US row | `Bengaluru, India` |

Both tokens on the US rows are load-bearing, because the two classifiers do not share a
vocabulary:

- `isUSLocation_` (Code.gs:2156) knows **no state names** beyond Hawaii and DC. It keys on
  `united states` / `usa` / the DC variants. Drop the `, United States` suffix and Code.gs
  Slack-blasts the non-US IT channel about an Austin hire.
- `isUSLoc_` (the dashboard, `getDashboardHtml_` rendered line 200) has the **50 full state
  names** but no city fallback. Write `TX` instead of `Texas` and the dashboard shows a globe and
  files the row under the Non-US tab.

Carrying both tokens makes the two agree on every row, and keeps the row correct if either
implementation is later fixed. Two-letter state codes are banned outright: **neither** classifier
recognises them.

Non-US rows drop the subdivision entirely, because every observed collision was a subdivision.
`CONFIG.UK_KEYWORDS` (Code.gs:110) contains the bare token `uk` and is matched with an unanchored
`indexOf` at Code.gs:1856 and 1945, so `Sydney, New South Wales, Australia` matched on `wales` and
would have pulled the UK/EMEA contact into an Australian hire's cohort Slack. `Sydney, Australia`
does not. The generator re-runs both classifiers plus the UK-keyword test over every distinct
value and fails the build on any disagreement.

### Deliberate deviations from the brief

Two places where this file does **not** do the literal thing that was asked for. Both are called
out here so the difference is visible, not buried.

1. **`HRBP A/B/C` and `Recruiter A/B/C` were replaced with invented person names.** The brief
   listed those labels as examples, but its closing emphasis was *"Don't use things like 'XYZ'
   everywhere. For a demo, that can make the dashboard look obviously fake and won't properly
   demonstrate the workflow."* Columns N and O are not just card fields — they are the **axis
   labels of two of the seven analytics cards** ("Hires by HRBP", "Hires by recruiter"), so a
   placeholder there is the most visible fake thing on the screen. Three HRBPs and five
   recruiters now carry names in the same fictional register as the hires and managers. They are
   invented; no real person is named anywhere in this file. Blank HRBP cells were also cut from
   9 to 2, so "Not assigned" stops reading as an operational failure.
2. **Columns S and V are populated, not blank.** Both are manual human columns — no code in
   `Code.gs` reads or writes either, and `getDashboardData` skips indices 18 and 21 outright — so
   blank was defensible and is what the earlier build shipped. But it left two of the 25 columns
   looking like dead layout padding in a file whose job is to demonstrate the workflow. S now
   carries a per-hire deep link; V mirrors N, which is the only reason a sheet keeps both columns.
   **Neither affects any automation**: change them, blank them, or delete their contents and
   nothing downstream notices.

---

## 3. Apps Script field mapping

All line numbers refer to the copy of the Onboarding Apps Script read for this work:
`/Users/azilen/.claude/jobs/cc36eb56/tmp/Code.gs` (4,378 lines).

**The golden rule:** columns A–R are addressed **positionally** (`row[0]` … `row[17]`,
`setValue` on column numbers 2, 3, 8, 10, 16, 17). Not one of the A–R *headers* is ever read.
Columns W, X and Y are the opposite — they are found by **header text** and their position does
not matter. Code.gs:3507-3511 states it outright: *"Never insert or move columns between A–R."*

### 3.1 Ashby "New Hire Added!" Gmail import

Trigger `checkGmailForNewHires` → `processNewHireEmail` → `parseAshbyTable_` (Code.gs:928-978) →
`buildDerivedFields_` → `validateFields_` → `isDuplicate_` → `appendToTracker_`.

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| E, F | `isDuplicate_` (1066-1067) | `appendToTracker_` (1103-1104) | Name split is on the **last space**. A middle name moved into F creates a second row for the same person. |
| G | `isDuplicate_` (1062-1064) | `appendToTracker_` (1106) | Must be ISO `yyyy-MM-dd`. Any other text kills dedup and breaks the cohort comparison. |
| H | — | `appendToTracker_` (1094-1096) | Written as `MMM dd, yyyy`. If the start date is later than the last `CONFIG.COHORT_DATES` entry, H is written **empty** and the hire is invisible to every scanner. |
| I | `isDuplicate_` (1065, 1071) | `appendToTracker_` (1105) | **Always `""` on this path** — Ashby's alert email never carries a personal address. The script Slack-warns "fill column I manually". |
| J, M | — | `appendToTracker_` (1107, 1110) | Both **derived**, not parsed: `first.last@<domain>`, non-alphanumerics stripped. A hyphenated or compound manager name silently yields an unroutable address. |
| P, Q, R | — | *(never written on this path)* | `appendToTracker_` writes **15 columns only** (A–O, Code.gs:1102-1119). Gmail-sourced hires land with P/Q/R empty, so their Group pill is grey and they are skipped by the non-US alert. |

### 3.2 HR report (CSV / XLSX) import

`checkGmailForHRReport` (subject-string match, Code.gs:223) → `parseHRReportRows_` (420-482) →
`appendToTrackerHRReport_` (596-646) or `updateExistingHireFromReport_` (648-712) →
`auditTrackerForIssues_` (729-763).

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| A–R (all 18) | `auditTrackerForIssues_` (indices 8, 9, 10, 11, 17) | `appendToTrackerHRReport_` (597-622), which also copies data validation from the row above over columns 1–18 (632-635) | This is the only path that writes the full 18 columns. Insert a column anywhere in A–R and the row literal writes every value one cell to the left. |
| I, J, K, L, M, O, R | `updateExistingHireFromReport_` match keys row[4], row[5], row[6], row[8] | `fill()` at hard-coded indices 8, 9, 10, 11, 12, 14, 17 (679-692) | CSV is treated as source of truth: a non-empty cell that differs is **overwritten** and reported as a discrepancy. Processing an older report after a newer one lets the stale value win (3992-4002). |
| W `Department` | `getDeptCol_` (3534-3548) | same, plus 639 / 699 | Located by the **lowercase-exact header `department`, scanned on row 1 only**. If absent it silently appends a brand-new far-right `Department` column that nothing else reads. |
| I, J, K, L, R | `auditTrackerForIssues_` (750-754) | — | Blank values on a future-dated row are reported to Slack as `missing: personal email / work email / job title / manager / location`. |

### 3.3 `manualAddHire()`

`manualAddHire()` (Code.gs:800-832) → `buildDerivedFields_` → `processHire_` → `validateFields_`
→ `isDuplicate_` → `appendToTracker_` (15 columns, A–O).

The `HIRES` array takes plain objects with **exactly these six keys** (spelling is load-bearing,
order is not). Values below are synthetic:

```javascript
var HIRES = [
  {
    first_name:     "Imani",
    last_name:      "Carter",
    personal_email: "imani.carter@example.net",
    start_date:     "2026-09-24",          // MUST be ISO yyyy-MM-dd
    job_title:      "Engineering Manager",
    manager_name:   "Riley Chen"
  },
  {
    first_name:     "Wen",
    last_name:      "Lee",
    personal_email: "wen.lee@example.net",
    start_date:     "2026-09-24",
    job_title:      "Customer Success Manager",
    manager_name:   "Naomi Wilson"
  }
];
```

Notes on that shape:

- **`start_date` is NOT normalised on this path.** `manualAddHire` never calls `normalizeDate_`.
  A human format such as `"Sep 21, 2026"` or `"9/21/2026"` makes every
  `CONFIG.COHORT_DATES[i] >= d.start_date` string comparison false (1027-1032), so `onboarding_cohort`
  stays `null`, **column H is written empty**, and the hire is invisible to every scanner while
  still appearing in the sheet.
- **Placeholder guard** (812-815): an entry is skipped outright if `first_name === "First"`,
  `last_name === "Last"`, `job_title === "Job Title"` or `start_date === "YYYY-MM-DD"`.
- `personal_email` is **not** required by `validateFields_` (1040-1049); the other four
  (`first_name`, `last_name`, `start_date`, `job_title`) are.
- There is **no `location`, `department` or `recruiter` key**. Manual hires always land with
  column R and the Department column blank, which means the audit flags them forever and the
  non-US alert skips them.
- Extra keys are silently ignored.

### 3.4 Thursday notice / Friday reminder (`dailyScanner`)

`dailyScanner` (1266) iterates `CONFIG.COHORT_DATES` and fires at cohort −4 and −3 days.

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| H | `getCohortHires_` (1395-1441), exact `!==` match at 1409 | — | **This is the single most fragile dependency in the system.** See §4c. |
| E, F, G, I, J, K, L, M, R | `getCohortHires_` (1424-1435) | — | These become the hire objects every downstream message renders. A blank J is re-derived from E+F (1416-1418). |
| I | Friday checklist (2088-2112), Thursday notice text (1456-1458) | — | A blank personal email renders as a bare work address with a dangling separator in the Slack checklist. |

### 3.5 Google Group creation

`fridayAfternoonScanner` (2062-2139) → `createOnboardingGoogleGroup_` (2279-2361) →
`markGoogleGroupInTracker_` (2362-2386).

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| H | `markGoogleGroupInTracker_` (2375-2377) | — | Same exact `MMM dd, yyyy` match. A mismatch means no row is ever stamped. |
| I, J | `createOnboardingGoogleGroup_` (2325-2334) | — | The member list. Empty strings are filtered, so a blank I silently drops that hire from the group with no error. |
| P | dashboard only | `setValue` on **column 16** (2380) | Written as a **URL string**, overwriting the boolean `false` seeded at 621. Move P and the URL lands in whatever now sits at column 16. |
| Q | *(nothing)* | `setValue` on **column 17** (2381) | Write-only. No reader exists. |

### 3.6 Slack channel creation

`mondayScanner` (1799) → `findSlackChannel_` (1237-1254) → `markSlackChannelInTracker_` (2517-2550).

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| H | `markSlackChannelInTracker_` (2534-2537) | — | Exact `MMM dd, yyyy` match again. |
| C | `if (!row[2])` guard (2538) | `setValue(true)` on **column 3** (2539) | Turn C into a text enum (`Yes` / `Done`) and `setValue(true)` writes a raw boolean against it, while the dashboard's `row[2] === true \|\| String(row[2]).toLowerCase() === 'true'` (3463) stops matching anything a human typed. |
| J | `getSlackUserId_` per hire (1869-1932) | — | Unresolved addresses are parked in a `pendingSlack_<cohortDate>` property and retried hourly. |
| R | UK/EMEA keyword test (1853-1864), `addTeamMembersToSlackChannel_` (4280-4284) | — | Matches `CONFIG.UK_KEYWORDS`. The substring `uk` also matches inside unrelated words. |

### 3.7 Manager email / DM

`sendManagerFridayDMs_` (1502-1544) and `sendManagerDMs_` (1975-2033).

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| M | grouping + `users.lookupByEmail` (1975-2030) | `buildDerivedFields_` (1017-1021) | Derived from column L, never supplied by Ashby. A wrong address just logs "manager not on Slack" and sends nothing. Hand-correcting M without correcting L is not detected. |
| L | `getCohortHires_` (row[11]) | ingest paths | Multi-manager Ashby values are truncated at the first comma (448-449). |
| J | row-locator, case-insensitive match at 2005 | — | If J is blank or mismatched, `rowNums` stays empty, **column B is never marked**, and the DM re-sends on the next run. |
| B | 2006-2008 — accepts `true`, `'TRUE'` or `'true'` | `setValue(true)` on **column 2** (2027); reset to `false` at 3212 and 3253 | The send-once gate. If any hire in a manager's group already has B truthy, the whole group is skipped. |
| T, U | *(nothing)* | *(nothing)* | Display-only columns; no code path touches them. |

### 3.8 Dashboard feed

> ### ⚠️ `Dashboard.html` is dead code. Do not read it, do not demo from it.
>
> `doGet()` (Code.gs:3364) returns `HtmlService.createHtmlOutput(getDashboardHtml_())`.
> `createHtmlOutputFromFile` appears **nowhere** in `Code.gs`, so nothing in the project ever
> serves a standalone `Dashboard.html`. The UI a user actually sees is `getDashboardHtml_()`
> (Code.gs:3502-3504) — a ~577-line HTML document held as **one escaped JavaScript string
> literal on line 3503**.
>
> This matters because the two files disagree, and the dead one is the friendlier read. Every
> statement about the dashboard in this document — the cohort tile states, the pill colours, the
> counters, the location classifier, the function tabs — was re-derived from `getDashboardHtml_()`
> and the server functions it calls, **not** from the `.html` file. Two specific claims that
> circulate from reading the dead file and are false of the deployed dashboard:
>
> - *"the US classifier has a two-letter `US_ABBREVS` list whose `, ca` entry matches `, canada`."*
>   There is no abbreviation list anywhere in `Code.gs` or in the rendered HTML. The deployed
>   `isUSLoc_` holds 50 **full** state names plus `district of columbia`. `Toronto, Canada`,
>   `Amsterdam, Netherlands` and `Bengaluru, India` all classify correctly.
> - *"columns S/T/U are Department / Okta Activated / Device Ship Date."* In this 25-column
>   layout S/T/U are `Dashboard Link` / `DM to manager` / `DM to new hire`; Department, Okta
>   Activated and Device Ship Date are **W / X / Y**, and the dashboard finds all three by header
>   text, not by position.
>
> `FIELD_MAP.md` in this folder repeats both claims. Where the two disagree, this README describes
> the delivered file and the deployed dashboard.

`doGet()` (3364) → `HtmlService.createHtmlOutput(getDashboardHtml_())` → one
`google.script.run.getDashboardData()` call (3373-3500).

| Column | Read by | Written by | What breaks if changed |
|---|---|---|---|
| H | `cohortKey_` (3391-3399) | — | More tolerant than the scanners: accepts a Date, ISO, or anything `normalizeDate_` parses. A row with an unparseable H is **silently dropped** from the dashboard. |
| A | `ctaStatus` (3466) | — | **Any non-empty value renders as a green success pill** `🎯 <text>` — there is no status→colour map. Writing `No Show` or `Pending` here would display a failure as a success. This is why column A in this file only ever holds `Onboarded`, `In Progress` or blank. |
| C, D | `=== true \|\| 'true'` (3463, 3465) | — | Strict-ish truthiness. |
| P | `String(row[15]).trim() !== '' && .toLowerCase() !== 'false'` (3464) | — | Looser: **any** non-empty text other than the literal `false` turns the Group pill green — including `N/A` or a spilled error string. |
| G | formatted `MMM dd, yyyy` if a Date, else passed through verbatim (3440-3442) | — | Because the dummy file stores G as text, cards show `2026-09-21` while the cohort heading above shows `September 21, 2026`. Two formats on one card — cosmetic, and the safer trade (§4c). |
| E, F, I, J, K, L, M, N, O, R | 3448-3470 | — | Rendered on the hire card. Blank I → red `Missing`; blank J → orange `Pending`; blank N → the HRBP row is omitted entirely. |
| O | `parseNoteParts_` (3516-3530) | — | Accepts `Dept: X \| Recruiter: Y` **or**, when neither label is present, treats the whole cell as the recruiter name. The dummy file uses the bare form. |
| W, X, Y | located by lowercase-exact header text (3413-3416) | X, Y by `syncItOnboardingFromSlack` (3691, 3695) | Rename any of the three and the index falls to −1, the field becomes `''`, the pill goes grey, and nothing errors. |

---

## 4. Fields that MUST remain unchanged

### (a) Exact tab name

- **`Cohort Tracker May - December 26`** — 32 characters, including the trailing ` 26`.
  `getTrackerSheet()` (Code.gs:168-182) does a literal `getSheetByName(CONFIG.TRACKER_SHEET_NAME)`
  and **throws** on a miss: *"Sheet ... not found. Available tabs: ... Update
  CONFIG.TRACKER_SHEET_NAME to match exactly."* There is no fuzzy or prefix fallback. Every
  sheet-touching function funnels through that helper — `appendToTrackerHRReport_` (626),
  `appendToTracker_` (1116), `getCohortHires_` (1396), `markGoogleGroupInTracker_` (2366),
  `markSlackChannelInTracker_` (2526), `getDashboardData` (3386), `allCohortDatesFromTracker_`
  (4336) — plus the direct lookups at 170, 1977 and 3319. Rename the tab by one character and
  **every trigger dies**.
- Caveat: 32 characters exceeds the xlsx worksheet-name limit of 31. openpyxl writes it verbatim
  and emits only a cosmetic warning ("Some applications may not be able to read the file"); the
  name survives a Google Sheets import intact. **Desktop Excel may refuse or truncate it** — if
  Excel truncates to `Cohort Tracker May - December 2`, rename the tab back to the full 32
  characters before pointing any script at it.

### (b) Column POSITION-critical — the script writes and reads by index

Columns **A through R are addressed positionally and nothing else**. Code.gs:3507-3511 is
explicit: *"Never insert or move columns between A–R."* Inserting, deleting or reordering any
column in that range shifts every downstream read by one — silently, with no error.

| Col | Index | Why the position is load-bearing |
|---|---|---|
| A | `row[0]` | Dashboard `ctaStatus` (3466). |
| B | `row[1]` / `setValue` col **2** | Manager-DM send-once gate: read at 2006, written at 2027, reset at 3212 and 3253. |
| C | `row[2]` / `setValue` col **3** | Slack-channel flag, written at 2539, read at 2538 and 3463. |
| D | `row[3]` | Kit-ordered pill (3465). |
| E | `row[4]` | Row-existence sentinel — a blank E makes the loops at 1404, 2373, 2533 and 4341 `continue` and skip the row. Also a dedup key (1066). |
| F | `row[5]` | Dedup key (1067); work-email re-derivation (1416-1418). |
| G | `row[6]` | Dedup key (1062-1064); audit's past-hire skip (744); off-cycle test (3557-3559). |
| H | `row[7]` / `setValue` col **8** | The cohort join key — see (c). |
| I | `row[8]` | Strongest dedup key (1065, 1071); Google Group member list (2325-2334). |
| J | `row[9]` / `setValue` col **10** | Manager-DM row locator (2005); Okta sync join key (3331, 3688). |
| K | `row[10]` | Job title; dashboard role chips. |
| L | `row[11]` | Manager name; source of the derived manager email. |
| M | `row[12]` | Manager email — the Slack lookup and DM grouping key (1975-2030). |
| N | `row[13]` | HRBP (dashboard only, 3458). |
| O | `row[14]` | Recruiter / legacy notes (3448 → `parseNoteParts_` 3516-3530). |
| P | `row[15]` / `setValue` col **16** | Google Group URL written at 2380. |
| Q | `row[16]` / `setValue` col **17** | Meet link written at 2381. |
| R | `row[17]` | Location → non-US alert (2574-2608) and UK/EMEA channel add (1853-1864). |

Also position-critical in a different sense: **the header must stay on row 1 and data must start
on row 2**. Sixteen independent readers loop `for (var i = 1; i < values.length; i++)` — Code.gs
449, 657, 735, 1060, 1402, 2000, 2371, 2531, 2807, 2828, 3231, 3248, 3327, 3419, 3920, 4339.
Insert a banner or title row above the header and row 2 is parsed as a hire while every real hire
shifts down by one. (The production sheet's 6-row merged banner with headers on row 7 is a
*defect*, not the contract — it is what forces `getDeptCol_` to keep creating a duplicate
far-right `Department` column.)

Columns **S, T, U and V** appear nowhere in `Code.gs` under any positional or header lookup. They
are safe to keep for layout fidelity, but note they widen `getLastColumn()`, which is what
`getDeptCol_` and `ensureCol` use when appending a new column at the far right.

### (c) FORMAT-critical — string-matched date formats and enum spellings

1. **Column H must be the string `MMM dd, yyyy` with a zero-padded day** — `Sep 08, 2026`, never
   `Sep 8, 2026`, never `September 8, 2026`, never `2026-09-08`.
   `getCohortHires_` builds `Utilities.formatDate(new Date(cohortDate + "T12:00:00"),
   CONFIG.TIMEZONE, "MMM dd, yyyy")` and then does a strict `if (cohortCell !== display) continue;`
   — **Code.gs:1409 string-matches column H against `'MMM dd, yyyy'`**. The identical comparison
   is repeated in `markSlackChannelInTracker_` (2535) and `markGoogleGroupInTracker_` (2377).
   There is no fuzzy fallback on any of the three. A single non-padded day yields **zero hires and
   zero messages** — and the failure is silent, because the scanners simply log "no hires yet in
   tracker". Worse, the dashboard's `cohortKey_` (3391-3399) *is* tolerant, so the cohort still
   renders perfectly on screen while no automation fires for it at all.
2. **Column G must be ISO `yyyy-MM-dd` text.** `isDuplicate_` (1063) and
   `syncOktaEmailsToTracker` (3336) format a Date cell with the literal `"UTC"`, while
   `auditTrackerForIssues_` (743), `getCohortHires_` (1414), `removeDuplicateHires` (2807) and
   `getDashboardData` (3435) use `CONFIG.TIMEZONE` — so **a real Date cell normalises to two
   different calendar days depending on which function reads it**, breaking dedup and the Okta
   join. Additionally `isOffCycleStart_` (3558) does
   `CONFIG.COHORT_DATES.indexOf(String(startDate||"").trim()) === -1`; a Date object stringifies
   to `"Mon Sep 21 2026 00:00:00 GMT..."`, never matches, and would fire a false off-cycle Slack
   alert on **every single hire**. This is why all of G, H, X and Y in this file are Python
   strings with `number_format = '@'` and there is not one `datetime` cell in the workbook.
3. **Column X must be `✓ yyyy-MM-dd`** — the check mark, one space, then the ISO date. That is the
   only shape the writer emits (Code.gs:3693) and it is only written when the cell is currently
   blank (3692).
4. **Column Y must be `yyyy-MM-dd` or the exact lowercase literal `ordered`.** The value is
   rebuilt from a DD-MM-YYYY Slack pattern into ISO, else the sentinel (Code.gs:3648-3651). The
   raw cell text is printed straight into the dashboard pill (`💻 Device ordered`).
5. **Column A must stay `Onboarded` or empty.** The dashboard hardcodes
   `if (hire.ctaStatus) { html += '<span class="pill green">🎯 ' + hire.ctaStatus }` — there is
   no status→colour map anywhere. Writing `Pending`, `No Show`, `Rescheduled` or `N/A` renders a
   **failure state as a green success pill**. There is no enum validation in the script, so
   nothing will stop you; the constraint lives only here.
6. **Columns B, C, D, T, U must stay real booleans.** Readers accept `true` or the strings
   `'TRUE'`/`'true'` only (Code.gs:2006, 3463, 3465). Convert them to a text enum (`Yes`, `Done`)
   and `setValue(true)` at 2027/2539 writes a raw boolean into a validated cell while the
   dashboard stops matching anything a human typed.
7. **Column P is dual-typed on purpose.** Boolean `FALSE` when not done (seeded at Code.gs:621),
   a URL string when done (overwritten at 2380, whose own comment reads *"col P = clickable group
   link (not a checkbox)"*). The dashboard rule at 3464 accepts both. Do not "fix" it to a pure
   checkbox — any future code doing `row[15] === true` would read false for every row that
   actually has a group.
8. **Column O accepts two shapes and only two**: a bare recruiter name, or
   `Dept: <value> | Recruiter: <value>`. `parseNoteParts_` (3516-3530) looks for those two
   case-insensitive labels separated by a pipe and, finding neither, assigns **the entire cell**
   to `recruiter`. Free-text notes here silently become a recruiter name. Also: the *Hires by
   recruiter* chart splits the cell on commas, so a comma in a recruiter value double-counts it.
9. **No apostrophes, double quotes, `<` or `>` in any cell.** The dashboard builds all markup by
   string concatenation with zero escaping: `personalEmail`, `workEmail` and `managerEmail` are
   interpolated into single-quoted `onclick="copyText('…')"` literals (an apostrophe produces a
   `SyntaxError` and a dead Copy button), and `jobTitle`/`managerName`/`hrbp` go into
   double-quoted `data-search` / `data-role` attributes that strip only `"`, `<` and `>`.

### (d) Header-text-critical — located by header string, not by position

These four headers are matched by **text**, and each fails differently:

| Header | Matched how | Where | Failure mode if renamed |
|---|---|---|---|
| `Department` (col W) | trimmed, **lowercased** equality against `department`, **row 1 only** | `getDeptCol_` Code.gs:3534-3548; dashboard 3413 | If absent and `createIfMissing` is true, the script **appends a brand-new far-right `Department` column** (3542-3546) that no other function reads — the data silently splits across two columns. |
| `Okta Activated` (col X) | **case-sensitive exact** for the writer; lowercased-exact for the reader | `ensureCol` 3676 (3667-3675); dashboard 3414 | Writer creates a duplicate far-right column; reader's index falls to −1, the field becomes `''`, and the Okta pill is permanently grey with no error. |
| `Device Ship Date` (col Y) | same as above | `ensureCol` 3677; dashboard 3416 | Same: duplicate column created, pill permanently grey. |
| `First Name` (col E) | **case-sensitive exact literal** `First Name` | `syncItOnboardingFromSlack` 3659-3663; dashboard header scan 3406 | `syncItOnboardingFromSlack` **throws `"Header row not found."`** and the whole IT sync aborts. |
| `Last Name` (col F), `Work Email` (col J) | case-sensitive exact, via `colIdx()` | 3678-3683 | `colIdx` returns −1, `String(row[-1] \|\| '')` evaluates to `''`, and the sync **silently fills nothing** — no error, no log. |

Headers A–D, G, H, I, K–R and S–V are never read by any code path and their wording is cosmetic.
That is why this file uses the cleaned human labels `Joining Date`, `Next Cohort Date`,
`New Hire Kit Ordered` and `Recruiter` rather than the production sheet's
`Start Date` / `Onboarding Cohort` / `New Hire Kit\n Ordered` / `Notes`, and why the production typo
`Welcome Calll Invitation Sent?` was not reproduced at column Q.

---

## 5. Demo walkthrough

Everything below is real data from this file. Reference "today" is **2026-09-11**.

**Step 1 — a new hire arrives.** Ashby sends the *"New Hire Added!"* alert, or the weekly HR
report CSV lands. `parseAshbyTable_` / `parseHRReportRows_` extracts name, start date, job title,
hiring manager, department, location and recruiter.

**Step 2 — the tracker row is created.** `buildDerivedFields_` fills in the pieces Ashby does not
send. Take **Imani Carter**, sheet row 37:

| Field | Value | Where it came from |
|---|---|---|
| E / F | `Imani` / `Carter` | Ashby, split on the last space |
| G `Joining Date` | `2026-09-21` | Ashby, normalised to ISO |
| H `Next Cohort Date` | `Sep 21, 2026` | derived — first `CONFIG.COHORT_DATES` entry **≥** the start date. The bound is inclusive, so a hire starting exactly on a cohort date gets that cohort, not the next one |
| J `Work Email` | `imani.carter@example.com` | **derived** from E + F |
| L / M | `Riley Chen` / `riley.chen@example.com` | manager name from Ashby, email **derived** from it |
| K `Job Title` | `Engineering Manager` | Ashby |
| R `Location` | `San Francisco, California, United States` | Ashby |
| W `Department` | `Engineering` | Ashby → routed to the **Engineering** function tab |
| P / Q | `…/g/09-21-2026` / `https://meet.google.com/tls-pgpz-hlb` | **cohort-level** — the same two values sit on all 7 rows of this cohort |

**Step 3 — open the dashboard.** `doGet()` serves the embedded HTML string from
`getDashboardHtml_()` — *not* the `Dashboard.html` file, which is dead code. One
`getDashboardData()` call returns every cohort at once and all filtering after that is
client-side. The header reads **Onboarding Cohort Dashboard**, the section title reads
**Cohorts (2026)**, and the sort toggle defaults to descending (`↓ Dec → Jan`).

**Step 4 — the cohort / date view.** Exactly **16 tiles** render — the 16 `CONFIG.COHORT_DATES`,
no more. (`getDashboardData` pre-seeds all 16, then adds a tile for any column-H value outside
that list. There are none, so the grid and the automation agree on what a cohort is.)

- `Mon, Sep 8` — **Active** (grey tile, blue inset ring): started 3 days ago and still inside its
  14-day window. It also carries the hard-coded yellow chip **`Mon Sep 7 = Labor Day`**. 5 hires.
- `Mon, Sep 21` — **Next** (blue): the earliest cohort still in the future, and the busiest date
  in the file. **7 hires.**
- `Mon, Oct 5` · `Mon, Oct 19` · `Mon, Nov 2` · `Mon, Nov 30` · `Mon, Dec 14` — **Upcoming** (pink).
- Everything from `May 11` to `Aug 24` — **Past** (grey).
- `May 25` and `Dec 14` read **No hires**.

**Step 5 — click `Mon, Sep 21`.** The heading becomes
**📅 Monday, September 21, 2026 Cohort**, subtitle **7 hires — A to Z**. Cards sort on
`firstName + ' ' + lastName`, so the order is:

| # | Hire | Job title | Location | Manager | HRBP | Pills |
|---|---|---|---|---|---|---|
| 1 | **Elena Castillo** | Senior Financial Analyst | Chicago, Illinois, United States | Cameron Reid | Marisol Vega | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit — · 🔐 Okta — · 💻 Device — |
| 2 | **Imani Carter** | Engineering Manager | San Francisco, California, United States | Riley Chen | Priya Raman | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit ✓ · 🔐 Okta — · 💻 Device **ordered** |
| 3 | **Jonas Sorensen** | Enterprise Account Executive | Munich, Germany | Gregory Smith | Dominic Shaw | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit ✓ · 🔐 Okta — · 💻 Device `2026-09-12` |
| 4 | **Maya Vasquez** | Associate Product Manager | Denver, Colorado, United States | Anjali Patel | Priya Raman | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit — · 🔐 Okta — · 💻 Device — |
| 5 | **Rohan Brown** | Engineering Intern | Bengaluru, India | Riley Chen | Priya Raman | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit — · 🔐 Okta — · 💻 Device — |
| 6 | **Wen Lee** | Customer Success Manager | Singapore, Singapore | Naomi Wilson | Dominic Shaw | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit ✓ · 🔐 Okta — · 💻 Device — |
| 7 | **Xavier Morgan** | Senior Product Designer | Brooklyn, New York, United States | Anjali Patel | Marisol Vega | 💬 Slack ✓ · 👥 Group ✓ · 📦 Kit — · 🔐 Okta — · 💻 Device — |

**No card in this cohort shows a 🎯 CTA pill**, and that is the point: the cohort has not started,
so there is nothing to close out. Every one of the seven shares the same Google Group URL and the
same Meet link, because the group and the welcome call belong to the cohort, not to the hire.

Two callout blocks render beneath the grid:

- 🌍 **Non-US Hires — IT Setup Required** (red): **Jonas Sorensen** 🇩🇪, **Rohan Brown** 🇮🇳 and
  **Wen Lee** 🇸🇬.
- 💻 **No Device Yet — 5 hire(s)** (orange): Elena Castillo, Maya Vasquez, Rohan Brown, Wen Lee,
  Xavier Morgan. Imani Carter is excluded because her column Y holds the `ordered` sentinel, which
  is non-empty; Jonas Sorensen because his holds a date.

Role chips on this cohort: **🎓 Intern** → 1 (Rohan Brown), **👔 Manager** → 3 (Imani Carter,
Wen Lee, Maya Vasquez — the chip matches the *job title* text, not the manager field),
**🧑‍💼 HRBP** → 0.

**Step 6 — individual detail.** Click Imani Carter's card to expand it. The avatar shows `IC`;
the rows are Start Date `2026-09-21`, Job Title, Personal Email `imani.carter@example.net` with a
Copy button, Work Email `imani.carter@example.com` with a Copy button, Location with a 🇺🇸 flag,
Manager `Riley Chen` (+ Copy, bound to the manager email), HRBP `Priya Raman`, Department
`Engineering`, Recruiter `Colette Byrne`.

**Step 7 — onboarding status.** The pill row is the status story. Imani Carter is at ladder depth
6: work email issued, manager notified, Slack channel created, Google Group created, kit ordered,
laptop `ordered` — but **no Okta yet** and **no CTA status**, which is exactly right for a cohort
that has not started. Three contrasts, one per CTA state:

| Hire | Cohort | Column A | What the card shows |
|---|---|---|---|
| **Lucia Sinclair** (Account Executive, Chicago) | `Jun 08, 2026` — Past | `Onboarded` | depth 8 — all five pills green, `💻 Device 2026-06-02`, `🔐 Okta ✓`, plus the green `🎯 Onboarded` pill |
| **Victor Adeyemi** (Senior Software Engineer, Austin) | `Sep 08, 2026` — **Active** | `In Progress` | depth 5 — Slack, Group and Kit green, Okta and Device still grey, and a green `🎯 In Progress` pill. This is the row that shows a CTA pill and an Active badge on the same card |
| **Imani Carter** | `Sep 21, 2026` — Next | blank | depth 6 — no CTA pill at all, so the pill row is one item shorter than Victor's |

**Contrast cases worth showing:**

- **Talia Bergman** (Nov 02, sheet row 47) — just landed from Ashby, depth 0: personal email
  renders red **Missing**, work email orange **Pending**, every pill grey, no CTA pill.
- **Kwame Osei** (sheet row 32) — one of only **two** off-cycle joiners: column G is `2026-09-02`
  but column H is `Sep 08, 2026`. `isOffCycleStart_` flags him and the script Slack-alerts
  *"correct column H yourself"*. The other is **Jonas Sorensen** (row 34, `2026-09-14` →
  `Sep 21, 2026`). **No third row does this** — if a scan produces more than two off-cycle
  alerts, something has edited the sheet.
- Every other row starts exactly on a `CONFIG.COHORT_DATES` date, and every column-H value is one
  of those 16. There is no off-cycle *cohort*, so there is no tile the scanners cannot see.

**Analytics view** (📊 Analytics, aggregated over the whole payload and unaffected by the
function tabs): Total hires tracked **48** · Already joined **31** · Starting soon **17** ·
Teams / functions **9** · Hiring managers **11**. Region chart: United States 25 · Other / Intl 15 ·
Canada 4 · United Kingdom 4. Hires by HRBP: Priya Raman 19 · Dominic Shaw 16 · Marisol Vega 11 ·
Not assigned 2. Hires by recruiter: Colette Byrne 14 · Erin Maddox 10 · Tobias Winters 9 ·
Renata Lombardi 8 · Malik Osborne 7.

The **CESO** tab reads **0** and the CESO banner stays hidden. That is expected, not a bug:
`getCesoNames_` (Code.gs:3577) opens an external roster spreadsheet by a hard-coded ID, no
synthetic name can match a real one, and the `try/catch` at Code.gs:3486-3496 swallows any read
failure. **Clicking that tab blanks every cohort tile to "No hires"** — see §6.2 #2 before you
demo with the nav bar visible.

---

## 6. Connecting a safe demo automation

> **Do not point the production script at this file.** Make a **copy** of the Apps Script project
> first and change the values below in the copy only.

### 6.1 CONFIG keys to swap (key names only — never paste a real ID into this repo)

| CONFIG key | Change to |
|---|---|
| `SPREADSHEET_ID` | the ID of **your** uploaded copy of `NHO_Tracker_Dummy_Data.xlsx` (import it to Google Sheets first) |
| `TRACKER_SHEET_NAME` | leave as-is — this file already uses the exact 32-character name. Verify after import that Sheets did not truncate it. |
| `BETA_CHANNEL` | a private throwaway Slack channel you own |
| `NON_US_CHANNEL` | the same throwaway channel |
| `HR_OPS_CHANNEL` | the same throwaway channel |
| `SLACK_CHANNEL_ALWAYS` | the same throwaway channel |
| `SLACK_CHANNEL_UK` | the same throwaway channel |
| `DEEPIKA_SLACK_ID`, `FABIA_SLACK_ID` | your own Slack member ID, or blank |
| `PROGRAM_LEAD_EMAIL` | your own work address, or blank |
| `NON_US_NOTIFY_TAGS` | empty string — otherwise the demo @-mentions real people |
| `GOOGLE_GROUP_MEMBERS`, `SLACK_9AM_MEMBERS`, `SLACK_ALLJOINED_MEMBERS`, `SLACK_OPTIONAL_MEMBERS`, `HR_OPS_TEAM` | empty arrays |
| `OOO_NAME_MAP` | empty object |
| `COHORT_DATES` | leave as-is — this file's column H is drawn from it |
| `TIMEZONE` | leave as-is (`America/Los_Angeles`) — every date comparison depends on it |

Script-properties / auth to replace: the Slack bot token stored in `PropertiesService` must be a
token for a **test workspace**, and the Google Admin Directory scope must be removed or pointed at
a test domain. Never reuse the production token. If a production token has ever been pasted into a
chat, a file or a commit, **rotate it before continuing**.

### 6.2 ⚠️ HARD PREREQUISITE — swapping `CONFIG.SPREADSHEET_ID` is NOT enough

**Read this before you point any script copy at this workbook.** Two production data sources are
reached by constants that live **inside function bodies, independent of `CONFIG`**. Changing
`CONFIG.SPREADSHEET_ID` does not touch either of them, and there is no feature flag for either.
Cannot be fixed in the xlsx — it must be fixed in your copy of the script.

| # | Function | Constant | Line | What it opens | Must do before any demo |
|---|---|---|---|---|---|
| 1 | `getArchiveHires_()` (Code.gs:3038-3136) | `ARCHIVE_ID` | Code.gs:3039 | a separate **live production archive spreadsheet** of real 2025–2026 hires | make the function `return []` on its first line, **or** repoint the constant at an empty workbook you own |
| 2 | `getCesoNames_()` (Code.gs:3577-3597) | `CESO_SHEET_ID` | Code.gs:3578 | a separate **live production team roster**, read on every single page load | make the function `return {}` on its first line, **or** repoint the constant at a demo sheet you own |
| 3 | second tracker tab | `EARLY_TAB_GID` | Code.gs:3385 | a tab inside whatever `CONFIG.SPREADSHEET_ID` points at | harmless once #1 is done — this workbook has no such tab, and the `if (!sheet) return;` guard skips it |
| 4 | header button "🗓️ Mandatory Sessions" | `MANDATORY_SESSIONS_URL` | inside the HTML string at Code.gs:3503 (rendered line 152) | a **live production `/exec` web app**, opened in a new tab | blank it, or point it at a placeholder. Its only guard is a check for the literal text `PASTE_YOUR`, which a real URL passes |

Why #1 is the serious one. `getArchiveHires_` results are **merged into the same cohort buckets**
as the tracker rows (Code.gs:3474-3484) with `source:'archive'` and **no visual marker** — real
names, personal email addresses, job titles, hiring managers and locations render on the grid
indistinguishably from the synthetic rows, and are added to the KPI totals, the month chart, the
region chart and the manager table. It also corrupts the demo numerically: archive rows whose
cohort year is missing default to 2025, and the rest snap to the first `CONFIG.COHORT_DATES` entry
on or after their start date, so real people either spawn brand-new 2025 tiles or pile onto the
`2026-05-11` tile.

**Do not rely on it failing.** The whole body sits in a `try/catch` that only `Logger.log`s
(Code.gs:3132-3134), so if the demo account *cannot* read the archive you get a clean `[]` and
notice nothing — and if it *can*, you get production PII on a shared screen with no error either
way. The two outcomes are indistinguishable from the UI. Stub it explicitly.

Why #2 matters less but still matters. `getCesoNames_` returns names only and nothing it reads is
ever rendered, so no production PII reaches the screen. But the demo silently touches a live HR
sheet on every page load, for a feature that will show **0** regardless — synthetic names cannot
match real ones. As shipped that means the CESO banner is hidden (`renderCeso` returns early at 0
members), the CESO nav tab reads a hard `0`, and clicking that tab blanks every cohort tile to
"No hires". An audience clicking the second tab in the nav will conclude the dashboard is broken.
Either seed a demo-owned sheet with a handful of this file's first/last name pairs (any tab with
`First Name` and `Last Name` headers in its first 10 rows), or hide the tab and banner for the demo.

None of the four IDs are reproduced anywhere in this repository, and they must not be. Refer to
them by constant name and line number only.

### 6.3 Side effects to disable before the first run

Stub these to a log statement in your copy, or confirm every destination points at the throwaway
channel / test group:

| What fires | Where | Risk if left live |
|---|---|---|
| Slack channel creation `onboarding-<yyyy-MM-dd>` | `findSlackChannel_` / `mondayScanner` (1799-1939) | Creates real public channels in the real workspace. |
| Slack DMs to managers | `sendManagerFridayDMs_` (1502), `sendManagerDMs_` (1975) | DMs real people about hires who do not exist. Note the derived addresses here are `@example.com` and will not resolve — but do not rely on that. |
| Slack channel posts | Thursday notice, Friday reminder, Day 2/3/6/10 messages | Posts to whatever `CONFIG.*_CHANNEL` points at. |
| Google Group creation + member add | `createOnboardingGoogleGroup_` (2279-2361) | Calls the Admin Directory API against the real domain and adds members. |
| Calendar welcome-event add | `addHiresToWelcomeMeeting*` (2254+) | Writes real calendar invites. |
| Gmail polling | `checkGmailForNewHires` (subject match), `checkGmailForHRReport` (223) | Reads the real mailbox and would ingest real hires **into your dummy sheet**. Delete these triggers in the copy. |
| Off-cycle Slack alert | `sendOffCycleAlert_` (3561-3574) | **Exactly two** rows in this file are off-cycle (Kwame Osei, Jonas Sorensen) — expect 2 alerts on the first scan, and treat any other number as a data defect. |

Disable **all time-driven triggers** in the copied project before you do anything else, then
re-enable only the one you want to demonstrate.

**Data-handling note:** this workbook is synthetic and carries no PII, so it can be uploaded and
shared freely. The moment you point a script copy at a *real* tracker ID, the same script becomes
a PII pipeline — at that point Slack channels, Google Groups and outbound mail are all
sensitive-data destinations and need the usual approvals.

---

## 7. Regenerating

| | |
|---|---|
| Canonical generator | `./generate_dummy_tracker_CANONICAL.py` |
| Upstream copy | `/Users/azilen/.claude/jobs/cc36eb56/tmp/generate_dummy_tracker.py` |
| Seed | `random.seed(42)` — plus a second, independent stream `random.Random(20260924)` used solely to draw one Google Meet code per row |
| Anchor date | `TODAY = date(2026, 9, 11)` — hard-coded. The script never calls `date.today()`, so re-running it next month produces the identical file. |
| Output path | `OUT_PATH = "./NHO_Tracker_Dummy_Data.xlsx"` |
| Reproducibility | Byte-for-byte deterministic. A clean re-run reproduces md5 `8399e1fc7950c5ef12d06dee46a90172`. **Any other hash means something else wrote that path.** |
| How that is achieved | Document properties and zip member timestamps are pinned — and the writer bypasses `wb.save()`, calling `openpyxl.writer.excel.ExcelWriter` directly. `save_workbook` overwrites `workbook.properties.modified` with the wall clock (`writer/excel.py:292`) **after** the generator pins it, so before this was fixed every rebuild produced a different md5 and the integrity claim above was untrue. |

Run it with:

```bash
python3 "./generate_dummy_tracker_CANONICAL.py"
```

The generator writes atomically (`tempfile.mkstemp` → `wb.save` → `os.replace`), runs ~38
self-checks against the bytes it just wrote (ladder monotonicity, no `datetime` cells, no
`' " < >` characters, date-format regexes, stage caps, department→function coverage, role-chip
coverage, reserved email domains), and then **re-hashes the file after verification** — if the
bytes moved mid-run it exits non-zero rather than signing off on a file it did not produce.

**The delivered workbook ships as `0444` (read-only) on purpose.** Several other generator
scripts in this folder were written to the same path and clobbered it mid-verification; the read
lock turns that race into a visible `PermissionError` instead of a silent overwrite. To edit the
file by hand:

```bash
chmod 644 "./NHO_Tracker_Dummy_Data.xlsx"
```

Superseded generators are parked alongside as `superseded_*.py.bak` and no longer target the
deliverable path. Note that `FIELD_MAP.md` in this folder describes an **earlier, different**
layout (headers on row 7, `Notes` at column O, real Date values, extra `Errors` / `List ` tabs);
where the two documents disagree, **this README describes the delivered file**.
