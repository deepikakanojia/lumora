# -*- coding: utf-8 -*-
"""Emits SeedDummyTracker.gs from dummy_hires.json."""
import json, datetime as dt
from demo_config import REAL_DOMAIN, demo_replacement_address

# The domain to scrub is configuration, never a literal in source. Blank by
# default, which emits a scrubber whose pattern can never match -- so an
# unconfigured checkout cannot claim a clean bill of health it has not earned.
SCRUB_DOMAIN    = REAL_DOMAIN
SCRUB_DOMAIN_RE = REAL_DOMAIN.replace(".", "\\\\.") if REAL_DOMAIN else "(?!)"
SCRUB_LABEL     = REAL_DOMAIN or "<no real domain configured>"
DEMO_ADDR       = demo_replacement_address()

spec = json.load(open("dummy_hires.json"))
rows, headers, tab = spec["rows"], spec["headers"], spec["tab"]

def js(v):
    if v is None or v == "":
        return '""'
    if isinstance(v, dict) and "__date__" in v:
        y, m, d = map(int, v["__date__"].split("-"))
        return f"new Date({y},{m-1},{d})"
    if isinstance(v, bool):
        return "true" if v else "false"
    s = str(v).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
    return f'"{s}"'

body = ",\n".join("  [" + ", ".join(js(v) for v in r) + "]" for r in rows)
hdrs = ", ".join(js(h) for h in headers)

GS = f'''/**
 * SeedDummyTracker.gs — replaces every real value in the DUMMY Onboarding tracker
 * with synthetic data, in place.
 * ─────────────────────────────────────────────────────────────────────────────
 * Generated {dt.date.today():%Y-%m-%d}. Contains {len(rows)} fictional hires.
 *
 * WHAT IT DOES
 *   1. Refuses to run against the real tracker (hard ID guard).
 *   2. Rewrites the tracker tab: preamble rows 1-6, header row 7, data rows 8+.
 *   3. Rebuilds the "List " lookup tab with fictional recruiters / HRBPs.
 *   4. Clears the "Errors" log.
 *   5. Scrubs {SCRUB_LABEL} addresses out of "Onboarding Process".
 *   6. DELETES the per-cohort Ashby snapshot tabs (all-digit names) — these hold
 *      raw candidate PII and nothing in the onboarding Apps Script reads them.
 *
 * HOW TO RUN
 *   Extensions → Apps Script on the DUMMY sheet → paste this as a new file.
 *   Run previewDummyTrackerSeed() first (read-only, logs the plan).
 *   Then run seedDummyTracker().
 */

// ─── TARGET ──────────────────────────────────────────────────────────────────
// NO SPREADSHEET ID IS HARD-CODED IN THIS FILE, AND NONE MAY EVER BE ADDED.
// This is a WRITE script: it overwrites rows and deletes tabs. A literal id in
// a file that gets copied, pasted and shared is one careless paste away from
// pointing a destructive run at the wrong workbook — and naming the production
// tracker here also leaked it into a folder meant to be handed out.
//
// Both ids now come from Script Properties, which live in the Apps Script
// project and are never part of this source:
//   DUMMY_SPREADSHEET_ID  (required) — the workbook to seed.
//   REAL_TRACKER_ID       (optional) — the production tracker, so the rail
//                                      below can refuse to run against it.
// Set them under Project Settings → Script Properties.
function prop_(key) {{
  return String(PropertiesService.getScriptProperties().getProperty(key) || "").trim();
}}

var DUMMY = {{
  get SPREADSHEET_ID() {{
    var id = prop_("DUMMY_SPREADSHEET_ID");
    if (!id) {{
      throw new Error(
        "ABORT: script property DUMMY_SPREADSHEET_ID is not set. Set it under " +
        "Project Settings -> Script Properties to the id of the sheet you want " +
        "seeded. This script refuses to guess a destination.");
    }}
    return id;
  }},
  TAB_NAME:       {js(tab)},
  HEADER_ROW:     7,
  FIRST_DATA_ROW: 8,
  // Tabs that survive. Everything else whose name is all digits is deleted.
  KEEP_TABS:      [{js(tab)}, "Errors", "List ", "Imp Links", "Onboarding Process"]
}};

// Safety rail: this script must never touch the production tracker.
function assertNotRealTracker_() {{
  var real = prop_("REAL_TRACKER_ID");   // optional; blank disables the rail
  if (!real) {{
    Logger.log("NOTE: script property REAL_TRACKER_ID is unset, so the " +
               "production-tracker guard is inactive. Check the target id yourself.");
    return;
  }}
  if (DUMMY.SPREADSHEET_ID === real) {{
    throw new Error("ABORT: DUMMY_SPREADSHEET_ID points at the real tracker.");
  }}
  var active = null;
  try {{ active = SpreadsheetApp.getActiveSpreadsheet(); }} catch (e) {{}}
  if (active && active.getId() === real) {{
    throw new Error("ABORT: this script is bound to the real tracker.");
  }}
}}

var DUMMY_HEADERS = [{hdrs}];

// A-Y, one array per hire. Column order matches the live tracker exactly.
var DUMMY_ROWS = [
{body}
];

// ─── PREVIEW (read-only) ─────────────────────────────────────────────────────
function previewDummyTrackerSeed() {{
  assertNotRealTracker_();
  var ss    = SpreadsheetApp.openById(DUMMY.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(DUMMY.TAB_NAME);
  Logger.log("Spreadsheet : " + ss.getName());
  Logger.log("Tracker tab : " + (sheet ? "found" : "NOT FOUND — check TAB_NAME"));
  if (sheet) {{
    Logger.log("Would clear  : rows " + DUMMY.FIRST_DATA_ROW + "-" + sheet.getLastRow()
               + " (" + Math.max(0, sheet.getLastRow() - DUMMY.FIRST_DATA_ROW + 1) + " existing rows)");
  }}
  Logger.log("Would write  : " + DUMMY_ROWS.length + " synthetic hires");
  var doomed = snapshotTabs_(ss);
  Logger.log("Would delete : " + doomed.length + " snapshot tab(s) — " + doomed.join(", "));
  Logger.log("Nothing was changed. Run seedDummyTracker() to apply.");
}}

function snapshotTabs_(ss) {{
  return ss.getSheets()
    .map(function (s) {{ return s.getName(); }})
    .filter(function (n) {{
      return DUMMY.KEEP_TABS.indexOf(n) === -1 && /^\\d+$/.test(n.trim());
    }});
}}

// ─── SEED (destructive — run once) ───────────────────────────────────────────
function seedDummyTracker() {{
  assertNotRealTracker_();
  var ss    = SpreadsheetApp.openById(DUMMY.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(DUMMY.TAB_NAME);
  if (!sheet) {{
    throw new Error('Tab "' + DUMMY.TAB_NAME + '" not found. Tabs: ' +
      ss.getSheets().map(function (s) {{ return s.getName(); }}).join(", "));
  }}

  // 1 ── wipe every existing data row
  var last = sheet.getLastRow();
  if (last >= DUMMY.FIRST_DATA_ROW) {{
    sheet.getRange(DUMMY.FIRST_DATA_ROW, 1,
                   last - DUMMY.FIRST_DATA_ROW + 1, sheet.getMaxColumns()).clearContent();
  }}

  // 2 ── preamble rows 1-6 (same shape, no real content)
  sheet.getRange(1, 1).setValue("NEW HIRE COHORT TRACKING");
  sheet.getRange(1, 7).setValue("DEMO TRACKER — 100% synthetic data. Safe for training and handover.");
  sheet.getRange(1, 8, 4, 1).setValues([
    ["IWD 1: Friday, March 20, 2026"], ["IWD 2: Friday, April 10, 2026"],
    ["IWD 3: Friday, August 7, 2026"], ["IWD 4: Friday, September 25, 2026"]]);
  sheet.getRange(1, 9).setValue("Company Breaks 2026");
  sheet.getRange(2, 9, 5, 2).setValues([
    ["End of Winter Break (New Year's Day)", new Date(2026, 0, 1)],
    ["Start Summer Break",                   new Date(2026, 5, 29)],
    ["End Summer Break",                     new Date(2026, 6, 3)],
    ["Start Winter Break",                   new Date(2026, 11, 24)],
    ["End Winter Break (New Year's Day)",    new Date(2027, 0, 1)]]);
  sheet.getRange(1, 15).setValue("Recruiter");
  sheet.getRange(1, 22).setValue("HRBP (Auto)");
  sheet.getRange(1, 23).setValue("Department");

  // 3 ── header row 7 (labels must stay byte-identical to the live tracker)
  sheet.getRange(DUMMY.HEADER_ROW, 1, 1, DUMMY_HEADERS.length).setValues([DUMMY_HEADERS]);

  // 4 ── data rows
  sheet.getRange(DUMMY.FIRST_DATA_ROW, 1, DUMMY_ROWS.length, DUMMY_HEADERS.length)
       .setValues(DUMMY_ROWS);

  // 5 ── number formats the dashboard and manager-email job depend on
  var n = DUMMY_ROWS.length;
  sheet.getRange(DUMMY.FIRST_DATA_ROW,  7, n, 1).setNumberFormat("yyyy-mm-dd");   // G Joining Date
  sheet.getRange(DUMMY.FIRST_DATA_ROW,  8, n, 1).setNumberFormat("mmm d, yyyy");  // H Next Cohort Date
  sheet.getRange(DUMMY.FIRST_DATA_ROW, 25, n, 1).setNumberFormat("yyyy-mm-dd");   // Y Device Ship Date

  seedListTab_(ss);
  clearErrorsTab_(ss);
  var scrubbed = scrubOnboardingProcess_(ss);
  var deleted  = deleteSnapshotTabs_(ss);

  SpreadsheetApp.flush();
  Logger.log("seedDummyTracker: wrote " + n + " synthetic hires to rows "
             + DUMMY.FIRST_DATA_ROW + "-" + (DUMMY.FIRST_DATA_ROW + n - 1));
  Logger.log("seedDummyTracker: deleted " + deleted.length + " snapshot tab(s): " + deleted.join(", "));
  Logger.log("seedDummyTracker: scrubbed " + scrubbed + " address(es) from Onboarding Process");
  Logger.log("seedDummyTracker: DONE — no real data remains.");
}}

// ─── SUPPORTING TABS ─────────────────────────────────────────────────────────
function seedListTab_(ss) {{
  var sheet = ss.getSheetByName("List ") || ss.insertSheet("List ");
  sheet.clearContents();
  var cols = [
    ["Departments", ["Account Management","Behavioral Science","CE&S Admin","Client Partnership",
                     "Customer Success","Data","Deployment","Design","Engineering","Finance",
                     "Human Resources","Information Security","Legal","Marketing","Network Operations",
                     "Operations","People","Product","Recruiting","Revenue Operations","Sales"]],
    ["Recruiters",  ["Elena Voss","Felix Grant","Georgia Pike","Hugo Salas",
                     "Imani Reid","Jonas Brekke","Kira Nolan","Liam Ashby"]],
    ["Locations",   ["US","EMEA","APAC","LATAM","Canada"]],
    ["Offer Status",["Accepted","Pending","Rescinded"]],
    ["BGC Status",  ["Cleared","Pending","Failed"]],
    ["Conversion",  ["No","Yes"]],
    ["Onboarding Track",   ["Full CTA","Async Only","Executive Path"]],
    ["HRBP",        ["Alexis Tran","Bianca Okoro","Colin Mercer","Dara Lindgren"]]
  ];
  for (var c = 0; c < cols.length; c++) {{
    sheet.getRange(1, c + 1).setValue(cols[c][0]);
    var vals = cols[c][1].map(function (v) {{ return [v]; }});
    sheet.getRange(2, c + 1, vals.length, 1).setValues(vals);
  }}
}}

function clearErrorsTab_(ss) {{
  var sheet = ss.getSheetByName("Errors");
  if (!sheet) return;
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 5).setValues([["Timestamp","Error Type","First Name","Last Name","Message"]]);
}}

// Replaces any {SCRUB_LABEL} address with a demo equivalent, in place.
function scrubOnboardingProcess_(ss) {{
  var sheet = ss.getSheetByName("Onboarding Process");
  if (!sheet) return 0;
  var range = sheet.getDataRange();
  var vals  = range.getValues();
  var re    = /[A-Za-z0-9._%+-]+@{SCRUB_DOMAIN_RE}\\b/g;
  var hits  = 0, dirty = false;
  for (var r = 0; r < vals.length; r++) {{
    for (var c = 0; c < vals[r].length; c++) {{
      if (typeof vals[r][c] === "string" && re.test(vals[r][c])) {{
        re.lastIndex = 0;
        vals[r][c] = vals[r][c].replace(re, function () {{ hits++; return "{DEMO_ADDR}"; }});
        dirty = true;
      }}
      re.lastIndex = 0;
    }}
  }}
  if (dirty) range.setValues(vals);
  return hits;
}}

// Per-cohort Ashby snapshot tabs (all-digit names) hold raw candidate PII.
function deleteSnapshotTabs_(ss) {{
  var doomed = snapshotTabs_(ss), gone = [];
  for (var i = 0; i < doomed.length; i++) {{
    var s = ss.getSheetByName(doomed[i]);
    if (s) {{ ss.deleteSheet(s); gone.push(doomed[i]); }}
  }}
  return gone;
}}

// ─── VERIFY ──────────────────────────────────────────────────────────────────
// Run after seeding: fails loudly if any {SCRUB_LABEL} string survives anywhere.
function verifyNoRealDataRemains() {{
  assertNotRealTracker_();
  var ss = SpreadsheetApp.openById(DUMMY.SPREADSHEET_ID);
  var sheets = ss.getSheets(), found = [];
  for (var i = 0; i < sheets.length; i++) {{
    var vals = sheets[i].getDataRange().getValues();
    for (var r = 0; r < vals.length; r++) {{
      for (var c = 0; c < vals[r].length; c++) {{
        if (typeof vals[r][c] === "string" && /{SCRUB_DOMAIN_RE}/i.test(vals[r][c])) {{
          found.push(sheets[i].getName() + "!" + (r + 1) + "," + (c + 1));
        }}
      }}
    }}
  }}
  Logger.log("Tabs remaining: " + sheets.map(function (s) {{ return s.getName(); }}).join(", "));
  Logger.log(found.length
    ? "FAIL — {SCRUB_LABEL} still present at: " + found.slice(0, 40).join(" | ")
    : "PASS — no {SCRUB_LABEL} references anywhere in the workbook.");
}}
'''
open("SeedDummyTracker.gs", "w").write(GS)
print("wrote SeedDummyTracker.gs", len(GS), "bytes,", len(rows), "hire rows")
