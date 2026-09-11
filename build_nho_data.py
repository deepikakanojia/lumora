# Builds operations_data.js — the single source of truth the redesigned dashboard reads.
#
#   NHO_Tracker_Dummy_Data.xlsx  (tab "Cohort Tracker May - December 26")
#   NHO_Dummy_Extensions.xlsx    (Before May 26 / Pilot Programme / Mandatory Sessions
#                                 / Session Attendance)
#            |
#            v   this script — normalisation + the derivations ported from Code.js
#       operations_data.js  ->  window.ONBOARDING_DATA = { hires, sessions, attendance, ... }
#
# The dashboard computes EVERY count, chart and roll-up from window.ONBOARDING_DATA.hires
# at render time. Nothing is pre-aggregated here, so editing a spreadsheet cell and
# re-running this script updates the whole dashboard — no HTML edits.
#
# The derivation functions below (normalize_date, parse_note_parts, dept_to_function,
# is_us_loc) are line-for-line ports of their counterparts in the live Apps Script,
# so the redesign classifies hires exactly the way the current dashboard does.
import datetime as dt
import os
import json, re, sys
from openpyxl import load_workbook

try:
    from demo_config import THEME
except ImportError:           # config module absent -> the CSS defaults stand
    THEME = {}

BASE       = os.path.dirname(os.path.abspath(__file__))   # this file's own folder
# Canonical workbook now ships one folder up (see ../_extras/WHY_THIS_IS_HERE.md);
# fall back to a local copy so this still works if that ever changes.
_LOCAL = BASE + "/NHO_Tracker_Dummy_Data.xlsx"
_PARENT = os.path.dirname(BASE) + "/NHO_Tracker_Dummy_Data.xlsx"
MAIN       = _LOCAL if os.path.exists(_LOCAL) else _PARENT
MAIN_TAB   = "Cohort Tracker May - December 26"
EXT        = BASE + "/NHO_Dummy_Extensions.xlsx"
OUT        = BASE + "/operations_data.js"
REFERENCE  = dt.date(2026, 9, 11)     # the tracker's fixed "today"

MONTHS = {"jan":"01","feb":"02","mar":"03","apr":"04","may":"05","jun":"06",
          "jul":"07","aug":"08","sep":"09","oct":"10","nov":"11","dec":"12"}

def normalize_date(raw):
    """Port of normalizeDate_() — accepts a Date cell, YYYY-MM-DD, 'MMM dd, yyyy'
    or M/D/YYYY and returns YYYY-MM-DD. Returns '' when nothing parses."""
    if raw is None or raw == "":
        return ""
    if isinstance(raw, dt.datetime):
        return raw.date().isoformat()
    if isinstance(raw, dt.date):
        return raw.isoformat()
    s = str(raw).strip()
    s = s.replace("✓", "").strip()              # the Okta column prefixes a tick
    if re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        return s
    m = re.match(r"([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})", s)
    if m:
        mon = MONTHS.get(m.group(1).lower()[:3])
        if mon:
            return "%s-%s-%s" % (m.group(3), mon, m.group(2).zfill(2))
    m = re.match(r"(\d{1,2})[/-](\d{1,2})[/-](\d{4})", s)
    if m:
        return "%s-%s-%s" % (m.group(3), m.group(1).zfill(2), m.group(2).zfill(2))
    return ""

def parse_note_parts(cell):
    """Port of parseNoteParts_(). Column O is structured as
    'Dept: X | Recruiter: Y'; with neither label the whole cell is the recruiter."""
    s = str(cell or "").strip()
    out = {"dept": "", "recruiter": ""}
    if not s:
        return out
    d = re.search(r"Dept:\s*([^|]+)", s, re.I)
    r = re.search(r"Recruiter:\s*([^|]+)", s, re.I)
    if d or r:
        out["dept"]      = d.group(1).strip() if d else ""
        out["recruiter"] = r.group(1).strip() if r else ""
    else:
        out["recruiter"] = s
    return out

def dept_to_function(dept, job_title):
    """Port of deptToFunction_(). Department first, job title as the fallback."""
    d = (dept or "").lower()
    j = (job_title or "").lower()
    has = lambda hay, *needles: any(n in hay for n in needles)

    if has(d, "sales", "customer success", "gtm", "network op", "deployment",
              "client partner", "client delivery", "client partnership", "account") \
       or has(j, "account executive", "client partner"):
        return "GTM"
    if "engineering" in d:                                   return "Engineering"
    if has(d, "product", "design", "studios"):               return "Product"
    if has(d, "finance", "legal"):                           return "Finance & Legal"
    if has(d, "marketing", "brand", "growth"):               return "Marketing"
    if has(d, "human resources", "people", "recruiting", "talent"):
        return "People & HR"
    if has(d, "information security", "information technology", "infosec", "security"):
        return "InfoSec / IT"
    if has(d, "labs", "research", "behavioral science", "analytics", "insights", "science"):
        return "Labs & Research"
    if has(d, "business operations", "operations", "strategy", "cdl"):
        return "Business Ops"
    if has(d, "customer advoca", "customer support", "enablement", "coach"):
        return "GTM"

    if has(j, "security", "infosec"):                        return "InfoSec / IT"
    if has(j, "engineer", "developer", "devops"):            return "Engineering"
    if has(j, "scientist", "behavioral", "research", "data", "insight"):
        return "Labs & Research"
    if has(j, "designer", "product manager", "product", "design"):
        return "Product"
    if has(j, "marketing", "brand", "communications"):       return "Marketing"
    if has(j, "recruit", "talent", "people", "hr ", "learning"):
        return "People & HR"
    if has(j, "finance", "legal", "counsel", "accountant", "revenue"):
        return "Finance & Legal"
    if has(j, "sales", "account", "client", "customer", "deployment", "enablement",
              "partner", "gtm", "change activation"):
        return "GTM"
    if has(j, "operations", "strategy", "chief of staff"):   return "Business Ops"
    return "Other"

US_STATES = ["alabama","alaska","arizona","arkansas","california","colorado","connecticut",
    "delaware","florida","georgia","hawaii","idaho","illinois","indiana","iowa","kansas",
    "kentucky","louisiana","maine","maryland","massachusetts","michigan","minnesota",
    "mississippi","missouri","montana","nebraska","nevada","new hampshire","new jersey",
    "new mexico","new york","north carolina","north dakota","ohio","oklahoma","oregon",
    "pennsylvania","rhode island","south carolina","south dakota","tennessee","texas",
    "utah","vermont","virginia","washington","west virginia","wisconsin","wyoming",
    "district of columbia"]

def is_us_loc(loc):
    """Port of the dashboard's own isUSLoc_() — note this is the FRONT-END rule
    (50 states + 'united states'/'usa'), not the narrower isUSLocation_() the
    Team-channel notification path uses."""
    l = (loc or "").lower()
    if "united states" in l or "usa" in l:
        return True
    return any(st in l for st in US_STATES)

def region_of(loc):
    """Coarse bucket for the analytics page. Unknown is kept as a real category —
    missing location data is an operational fact, not something to hide."""
    if not (loc or "").strip():
        return "Unknown", ""
    if is_us_loc(loc):
        return "United States", "United States"
    country = loc.split(",")[-1].strip()
    if country.lower() == "canada":
        return "Canada", country
    if country.lower() in ("united kingdom", "uk", "england", "scotland", "wales"):
        return "United Kingdom", "United Kingdom"
    return "Other / International", country

def truthy_str(v):
    """Column P is a truthy-STRING check in the live script: the literal text
    'false' counts as not-done, and so does a blank."""
    s = str(v or "").strip()
    return bool(s) and s.lower() != "false"

def as_bool(v):
    if isinstance(v, bool):
        return v
    return str(v or "").strip().lower() in ("true", "yes", "y", "1", "✓")

# Canonical column order, and the header text each one is known by. The live
# script reads A-R positionally, so position stays the primary contract — but the
# tracker is regenerated by a separate process that has already moved the header
# row once, so each column is resolved BY HEADER NAME first and falls back to its
# fixed index. That survives a header-row move without abandoning the positional
# contract.
COLUMN_ALIASES = [
    ("ctaStatus",        0,  ["cta status"]),
    ("managerEmailSent", 1,  ["manager email sent"]),
    ("slack",            2,  ["team channel", "slack"]),
    ("kitOrdered",       3,  ["new hire kit ordered", "kit ordered"]),
    ("first",            4,  ["first name"]),
    ("last",             5,  ["last name"]),
    ("startDate",        6,  ["joining date", "start date"]),
    ("cohortDate",       7,  ["next cohort date", "onboarding cohort", "cohort date"]),
    ("personalEmail",    8,  ["personal email"]),
    ("workEmail",        9,  ["work email"]),
    ("jobTitle",        10,  ["job title"]),
    ("managerName",     11,  ["manager name"]),
    ("managerEmail",    12,  ["manager email"]),
    ("hrbp",            13,  ["hrbp"]),
    ("notes",           14,  ["notes", "recruiter"]),
    ("googleGroup",     15,  ["google group created"]),
    ("welcomeCallSent", 16,  ["welcome calll invitation sent?", "welcome call invitation sent?",
                              "welcome call sent"]),
    ("location",        17,  ["location"]),
    ("dashboardLink",   18,  ["dashboard link"]),
    ("dmManager",       19,  ["dm to manager"]),
    ("dmHire",          20,  ["dm to new hire"]),
    ("hrbpSheet",       21,  ["hrbp from sheet"]),
    ("department",      22,  ["department"]),
    ("oktaActivated",   23,  ["okta activated"]),
    ("deviceShipDate",  24,  ["device ship date"]),
]

def norm_header(h):
    return re.sub(r"\s+", " ", str(h or "").replace("\n", " ")).strip().lower()

def find_sheet(wb, prefix):
    """The tracker tab name is 32 characters — one over Excel's limit — so any
    round-trip through Excel truncates it to 31. Match on a prefix, then fall
    back to whichever sheet actually contains a "First Name" header."""
    for name in wb.sheetnames:
        if name.strip().lower().startswith(prefix.strip().lower()[:28]):
            return wb[name]
    for name in wb.sheetnames:
        ws = wb[name]
        for r in ws.iter_rows(min_row=1, max_row=12, values_only=True):
            if any(norm_header(c) == "first name" for c in r):
                return ws
    raise KeyError("no hire sheet found in %s" % wb.sheetnames)

FIELDS_PRESENT = {}

def read_hires(path, tab, source):
    wb  = load_workbook(path, data_only=True)
    ws  = find_sheet(wb, tab)
    rows = [list(r) for r in ws.iter_rows(values_only=True)]
    # The tracker can carry rows of holiday / IWD metadata above its header row,
    # so the header is located by scanning for "First Name" — the same way the
    # live getDashboardData() does it.
    hdr = next((i for i, r in enumerate(rows[:12])
                if any(norm_header(c) == "first name" for c in r)), 0)
    header = [norm_header(c) for c in rows[hdr]]
    matched, present = {}, set()
    for key, pos, names in COLUMN_ALIASES:
        found = next((header.index(n) for n in names if n in header), None)
        if found is not None:
            matched[key] = found
            present.add(key)

    # Position is the contract only when there is nothing better. If the sheet
    # carries recognisable headers, trust them exclusively: falling back to a
    # fixed index for an unmatched key would silently read the NEIGHBOURING
    # column's data and then report the field as present.
    headed = len(matched) >= 3
    idx = {}
    for key, pos, names in COLUMN_ALIASES:
        if key in matched:
            idx[key] = matched[key]
        elif headed:
            idx[key] = None            # genuinely absent
        else:
            idx[key] = pos             # headerless clone: positional contract
            present.add(key)
    FIELDS_PRESENT[source] = sorted(present)

    width = max([i for i in idx.values() if i is not None] + [0]) + 1
    out = []
    for raw in rows[hdr + 1:]:
        raw = list(raw) + [None] * (width - len(raw))
        r = [None] * 25
        for key, pos, _ in COLUMN_ALIASES:
            src_i = idx[key]
            if pos < 25 and src_i is not None and src_i < len(raw):
                r[pos] = raw[src_i]
        # A row is a hire if it has a name at all. The live script drops a row
        # only when BOTH names are blank, so a surname-only row is kept and
        # rendered rather than silently disappearing.
        if not r[4] and not r[5]:
            continue
        note      = parse_note_parts(r[14])
        dept      = (r[22] or note["dept"] or "").strip()
        title     = (r[10] or "").strip()
        loc       = (r[17] or "").strip()
        region, country = region_of(loc)
        start     = normalize_date(r[6])
        # No coalescing: a blank cohort cell means the hire has not been placed
        # in a cohort yet. Filling it from the joining date would fabricate a
        # one-person cohort AND make the "not assigned to a cohort" rule
        # unfireable. The display layer falls back where it needs to.
        cohort    = normalize_date(r[7])
        first, last = str(r[4]).strip(), str(r[5] or "").strip()
        out.append({
            "id":               "%s-%s-%s" % (source, start, (first + last).lower()),
            "first":            first,
            "last":             last,
            "name":             (first + " " + last).strip(),
            "initials":         (first[:1] + last[:1]).upper(),
            "startDate":        start,
            "cohortDate":       cohort,
            # Off-cycle: the joining date is not the cohort date it was rolled into.
            # Same meaning as isOffCycleStart_(), expressed against the tracker's
            # own two date columns rather than the hardcoded cadence list.
            "offCycle":         bool(start and cohort and start != cohort),
            "unassigned":       bool(not cohort),
            "personalEmail":    (r[8]  or "").strip(),
            "workEmail":        (r[9]  or "").strip(),
            "jobTitle":         title,
            "managerName":      (r[11] or "").strip(),
            "managerEmail":     (r[12] or "").strip(),
            "hrbp":             (r[13] or r[21] or "").strip(),
            "recruiter":        note["recruiter"],
            "department":       dept,
            "fn":               dept_to_function(dept, title),
            "location":         loc,
            "region":           region,
            "country":          country,
            "nonUS":            bool(loc) and not is_us_loc(loc),
            "ctaStatus":        (r[0]  or "").strip(),
            "managerEmailSent": as_bool(r[1]),
            "slack":            as_bool(r[2]),
            "kitOrdered":       as_bool(r[3]),
            "googleGroup":      str(r[15] or "").strip(),
            "googleGroupDone":  truthy_str(r[15]),
            "welcomeCallSent":  as_bool(r[16]),
            "dashboardLink":    str(r[18] or "").strip(),
            "dmManager":        as_bool(r[19]),
            "dmHire":           as_bool(r[20]),
            "oktaActivated":    normalize_date(r[23]),
            "deviceShipDate":   normalize_date(r[24]),
            "source":           source,
        })
    return out

def read_table(path, tab):
    wb = load_workbook(path, data_only=True)
    if tab not in wb.sheetnames:
        return []
    ws   = wb[tab]
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return []
    head = [str(h or "").strip() for h in rows[0]]
    out  = []
    for r in rows[1:]:
        if not any(c is not None and str(c).strip() for c in r):
            continue
        rec = {}
        for k, v in zip(head, r):
            if isinstance(v, (dt.datetime, dt.date)):
                v = normalize_date(v)
            rec[k] = "" if v is None else v
        out.append(rec)
    return out

def read_company_breaks(path, tab):
    """Rows 1-6 above the tracker header carry the IWD days and company breaks.
    They are real operational context for onboarding, so they travel with the data."""
    ws   = find_sheet(load_workbook(path, data_only=True), tab)
    # Only the rows ABOVE the header row hold this metadata; if the header is on
    # row 1 the tracker simply has no company-break block and we return nothing.
    rows = [list(r) for r in ws.iter_rows(min_row=1, max_row=12, values_only=True)]
    hdr  = next((i for i, r in enumerate(rows)
                 if any(norm_header(c) == "first name" for c in r)), 0)
    rows = rows[:hdr]
    iwd, breaks = [], []
    for r in rows:
        r = list(r) + [None] * (25 - len(r))
        if r[7] and str(r[7]).strip().upper().startswith("IWD"):
            iwd.append(str(r[7]).strip())
        label, when = r[8], normalize_date(r[9])
        if label and when and "Company Breaks" not in str(label):
            breaks.append({"label": str(label).strip(), "date": when})
    return {"iwd": iwd, "breaks": breaks}

# ------------------------------------------------------------------ assemble
def main():
    hires = read_hires(MAIN, MAIN_TAB, "tracker") + read_hires(EXT, "Before May 26", "archive")

    # Dedup the way the live getDashboardData() does: work email is the
    # strongest key, name+cohort the fallback. The tracker wins over the
    # archive because it is read first.
    seen, deduped, dropped = set(), [], 0
    for hire in hires:
        key = (hire["workEmail"].strip().lower() or
               "%s|%s|%s" % (hire["first"].lower(), hire["last"].lower(), hire["cohortDate"]))
        if key in seen:
            dropped += 1
            continue
        seen.add(key)
        deduped.append(hire)
    if dropped:
        print("deduplicated: %d duplicate hire row(s) dropped" % dropped)
    hires = deduped
    hires.sort(key=lambda h: (h["startDate"], h["last"], h["first"]))

    pilot        = read_table(EXT, "Pilot Programme")
    sessions    = read_table(EXT, "Mandatory Sessions")
    attendance  = read_table(EXT, "Session Attendance")

    # Stamp Pilot membership onto the hire records so the dashboard can filter on
    # h.pilot exactly like the current front-end does.
    pilot_by_email = {str(c.get("Work Email", "")).lower(): c for c in pilot}
    for h in hires:
        c = pilot_by_email.get(h["workEmail"].lower())
        h["pilot"]       = bool(c)
        h["pilotTrack"]  = c.get("Track", "")        if c else ""
        h["pilotCoach"]  = c.get("Coach", "")        if c else ""
        h["pilotStatus"] = c.get("Pilot Status", "") if c else ""

    # Official cadence = every distinct cohort date that has at least one hire,
    # plus any cohort the tracker names but has not filled yet.
    cohort_dates = sorted({h["cohortDate"] for h in hires if h["cohortDate"]})

    # Informational only — which parts of the Onboarding process a human still performs
    # versus which ones a scheduled trigger performs. Sourced from the live script's
    # trigger set; nothing is listed as automated unless a trigger actually sends it.
    automation = {
        "manual": [
            "Review the dashboard for the upcoming cohort",
            "Identify upcoming hires and confirm start dates",
            "Create the hiring-manager email",
            "Review and correct that email",
            "Send the hiring-manager email",
            "Create the cohort Google Group",
            "Add new hires to the group",
            "Create the cohort Team channel",
            "Post the Day 1 message",
        ],
        "automated": [
            "Day 2 onward onboarding Team messages (Day 2, 3, 6, 10)",
            "New-hire Team DMs where a Team account is matched",
            "Manager DMs for the upcoming cohort",
            "Thursday pre-cohort notice",
            "Friday reminder and data audit",
            "30-day survey",
            "Non-US hire notification to the IT/HR channel",
        ],
    }

    payload = {
        "referenceDate": REFERENCE.isoformat(),
        "source": {
            "tracker":    "NHO_Tracker_Dummy_Data.xlsx / " + MAIN_TAB,
            "extensions": "NHO_Dummy_Extensions.xlsx",
            "note": "100% synthetic demo data. No real employee, manager, recruiter or HRBP.",
        },
        "fieldsPresent": FIELDS_PRESENT,
        "cohortDates":   cohort_dates,
        "hires":         hires,
        "pilot":          pilot,
        "sessions":      sessions,
        "attendance":    attendance,
        "companyCalendar": read_company_breaks(MAIN, MAIN_TAB),
        "automation":    automation,
        # The five brand colours, so the dashboard can be re-themed from the
        # same config point that carries the product and client names.
        "theme":         THEME,
    }

    body = json.dumps(payload, indent=1, ensure_ascii=False)
    with open(OUT, "w") as f:
        f.write("// GENERATED FILE — do not edit by hand.\n")
        f.write("// Rebuild with:  python3 build_nho_data.py\n")
        f.write("// Source: NHO_Tracker_Dummy_Data.xlsx + NHO_Dummy_Extensions.xlsx\n")
        f.write("// 100%% synthetic demo data.\n")
        f.write("window.ONBOARDING_DATA = " + body + ";\n")

    joined   = sum(1 for h in hires if h["startDate"] and h["startDate"] <= REFERENCE.isoformat())
    print("hires:        %d  (tracker %d + archive %d)" % (
        len(hires),
        sum(1 for h in hires if h["source"] == "tracker"),
        sum(1 for h in hires if h["source"] == "archive")))
    print("joined:       %d   upcoming: %d" % (joined, len(hires) - joined))
    print("cohorts:      %d" % len(cohort_dates))
    print("off-cycle:    %d" % sum(1 for h in hires if h["offCycle"]))
    print("pilot:         %d" % sum(1 for h in hires if h["pilot"]))
    print("sessions:     %d   attendance: %d" % (len(sessions), len(attendance)))
    print("-> %s" % OUT)


if __name__ == "__main__":
    main()
