/**
 * SeedDummyTracker.gs — replaces every real value in the DUMMY NHO tracker
 * with synthetic data, in place.
 * ─────────────────────────────────────────────────────────────────────────────
 * Generated 2026-09-11. Contains 48 fictional hires.
 *
 * WHAT IT DOES
 *   1. Refuses to run against the real tracker (hard ID guard).
 *   2. Rewrites the tracker tab: preamble rows 1-6, header row 7, data rows 8+.
 *   3. Rebuilds the "List " lookup tab with fictional recruiters / HRBPs.
 *   4. Clears the "Errors" log.
 *   5. Scrubs betterup.co addresses out of "Onboarding Process".
 *   6. DELETES the per-cohort Ashby snapshot tabs (all-digit names) — these hold
 *      raw candidate PII and nothing in NHO_beta.gs reads them.
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
function prop_(key) {
  return String(PropertiesService.getScriptProperties().getProperty(key) || "").trim();
}

var DUMMY = {
  get SPREADSHEET_ID() {
    var id = prop_("DUMMY_SPREADSHEET_ID");
    if (!id) {
      throw new Error(
        "ABORT: script property DUMMY_SPREADSHEET_ID is not set. Set it under " +
        "Project Settings -> Script Properties to the id of the sheet you want " +
        "seeded. This script refuses to guess a destination.");
    }
    return id;
  },
  TAB_NAME:       "Cohort Tracker May - December 26",
  HEADER_ROW:     7,
  FIRST_DATA_ROW: 8,
  // Tabs that survive. Everything else whose name is all digits is deleted.
  KEEP_TABS:      ["Cohort Tracker May - December 26", "Errors", "List ", "Imp Links", "Onboarding Process"]
};

// Safety rail: this script must never touch the production tracker.
function assertNotRealTracker_() {
  var real = prop_("REAL_TRACKER_ID");   // optional; blank disables the rail
  if (!real) {
    Logger.log("NOTE: script property REAL_TRACKER_ID is unset, so the " +
               "production-tracker guard is inactive. Check the target id yourself.");
    return;
  }
  if (DUMMY.SPREADSHEET_ID === real) {
    throw new Error("ABORT: DUMMY_SPREADSHEET_ID points at the real tracker.");
  }
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) {}
  if (active && active.getId() === real) {
    throw new Error("ABORT: this script is bound to the real tracker.");
  }
}

var DUMMY_HEADERS = ["CTA Status ", "Manager Email Sent ", "Slack ", "New Hire Kit\n Ordered", "First Name", "Last Name", "Joining Date", "Next Cohort Date", "Personal Email", "Work Email", "Job Title", "Manager Name", "Manager Email", "HRBP", "Notes", "Google Group Created", "Welcome Calll Invitation Sent?", "Location", "Dashboard Link ", "DM to manager ", "DM to new hire ", "HRBP from sheet ", "Department", "Okta Activated", "Device Ship Date"];

// A-Y, one array per hire. Column order matches the live tracker exactly.
var DUMMY_ROWS = [
  ["Onboarded", true, true, true, "Alex", "Carter", new Date(2026,4,11), new Date(2026,4,11), "alex.carter@example.com", "alex.carter@democo.example", "Principal Client Partner", "Morgan Smith", "morgan.smith@democo.example", "Alexis Tran", "Dept: Client Partnership | Recruiter: Elena Voss", "https://groups.google.com/a/democo.example/g/05-11-2026-nho-cohort", true, "Austin, Texas, United States", "", false, false, "Alexis Tran", "Client Partnership", "✓ 2026-05-10", new Date(2026,4,6)],
  ["Onboarded", true, true, true, "Jordan", "Lee", new Date(2026,4,11), new Date(2026,4,11), "jordan.lee@example.com", "jordan.lee@democo.example", "Staff Software Engineer", "Jamie Wilson", "jamie.wilson@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Felix Grant", true, true, "Toronto, Ontario, Canada", "", false, false, "Colin Mercer", "Engineering", "✓ 2026-05-10", new Date(2026,4,6)],
  ["Onboarded", true, true, true, "Taylor", "Morgan", new Date(2026,4,11), new Date(2026,4,11), "taylor.morgan@example.com", "taylor.morgan@democo.example", "Senior Customer Success Manager", "Riley Chen", "riley.chen@democo.example", "Alexis Tran", "Dept: Customer Success | Recruiter: Georgia Pike", true, true, "Denver, Colorado, United States", "", false, false, "Alexis Tran", "Customer Success", "✓ 2026-05-10", new Date(2026,4,6)],
  ["Onboarded", true, true, true, "Casey", "Brown", new Date(2026,4,25), new Date(2026,4,25), "casey.brown@example.com", "casey.brown@democo.example", "Senior Enterprise Account Executive", "Priya Raman", "priya.raman@democo.example", "Bianca Okoro", "Dept: Sales | Recruiter: Hugo Salas", true, true, "Chicago, Illinois, United States", "", false, false, "Bianca Okoro", "Sales", "✓ 2026-05-24", new Date(2026,4,20)],
  ["Joined", true, true, true, "Rowan", "Okafor", new Date(2026,4,25), new Date(2026,4,25), "rowan.okafor@example.com", "rowan.okafor@democo.example", "Senior Product Designer", "Marcus Delaney", "marcus.delaney@democo.example", "Colin Mercer", "Dept: Design | Recruiter: Imani Reid", true, true, "London, England, United Kingdom", "", false, false, "Colin Mercer", "Design", "✓ 2026-05-24", new Date(2026,4,20)],
  ["Onboarded", true, true, true, "Avery", "Nguyen", new Date(2026,5,8), new Date(2026,5,8), "avery.nguyen@example.com", "avery.nguyen@democo.example", "Senior Backend Engineer", "Nina Kovac", "nina.kovac@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Jonas Brekke", true, true, "Singapore", "", false, false, "Colin Mercer", "Engineering", "✓ 2026-06-07", new Date(2026,5,3)],
  ["Onboarded", true, true, true, "Quinn", "Patel", new Date(2026,5,8), new Date(2026,5,8), "quinn.patel@example.com", "quinn.patel@democo.example", "Principal Product Manager", "Theo Barnes", "theo.barnes@democo.example", "Colin Mercer", "Dept: Product | Recruiter: Kira Nolan", true, true, "Seattle, Washington, United States", "", false, false, "Colin Mercer", "Product", "✓ 2026-06-07", new Date(2026,5,3)],
  ["Onboarded", true, true, true, "Skyler", "Rivera", new Date(2026,5,8), new Date(2026,5,8), "skyler.rivera@example.com", "skyler.rivera@democo.example", "Client Delivery Director", "Sofia Marchetti", "sofia.marchetti@democo.example", "Alexis Tran", "Dept: Deployment | Recruiter: Liam Ashby", true, true, "Miami, Florida, United States", "", false, false, "Alexis Tran", "Deployment", "✓ 2026-06-07", new Date(2026,5,3)],
  ["Onboarded", true, true, true, "Devon", "Novak", new Date(2026,5,1), new Date(2026,5,8), "devon.novak@example.com", "devon.novak@democo.example", "Senior Financial Analyst", "Elias Fontaine", "elias.fontaine@democo.example", "Dara Lindgren", "Dept: Finance | Recruiter: Elena Voss", true, true, "", "", false, false, "Dara Lindgren", "Finance", "✓ 2026-06-07", new Date(2026,5,3)],
  ["Onboarded", true, true, true, "Harper", "Bennett", new Date(2026,5,22), new Date(2026,5,22), "harper.bennett@example.com", "harper.bennett@democo.example", "Vice President, Client Partner", "Grace Abbott", "grace.abbott@democo.example", "Alexis Tran", "Dept: Client Partnership | Recruiter: Felix Grant", true, true, "New York, New York, United States", "", false, false, "Alexis Tran", "Client Partnership", "✓ 2026-06-21", new Date(2026,5,17)],
  ["Onboarded", true, true, true, "Emerson", "Hale", new Date(2026,5,15), new Date(2026,5,22), "emerson.hale@example.com", "emerson.hale@democo.example", "Senior Behavioral Scientist", "Omar Haddad", "omar.haddad@democo.example", "Colin Mercer", "Off-cycle start; rolled into the following cohort.", true, true, "Amsterdam, Netherlands", "", false, false, "Colin Mercer", "Behavioral Science", "✓ 2026-06-21", new Date(2026,5,17)],
  ["Onboarded", true, true, true, "Finley", "Iyer", new Date(2026,5,22), new Date(2026,5,22), "finley.iyer@example.com", "finley.iyer@democo.example", "Senior AI Automation Engineer", "Dana Whitfield", "dana.whitfield@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Hugo Salas", true, true, "Bengaluru, India", "", false, false, "Colin Mercer", "Engineering", "✓ 2026-06-21", new Date(2026,5,17)],
  ["Onboarded", true, true, true, "Kendall", "Kowalski", new Date(2026,6,6), new Date(2026,6,6), "kendall.kowalski@example.com", "kendall.kowalski@democo.example", "Account Director, Strategic", "Morgan Smith", "morgan.smith@democo.example", "Bianca Okoro", "Dept: Sales | Recruiter: Imani Reid", true, true, "Dallas, Texas, United States", "", false, false, "Bianca Okoro", "Sales", "✓ 2026-07-05", new Date(2026,6,1)],
  ["Onboarded", true, true, true, "Logan", "Larsen", new Date(2026,6,6), new Date(2026,6,6), "logan.larsen@example.com", "logan.larsen@democo.example", "Customer Success Manager", "Jamie Wilson", "jamie.wilson@democo.example", "Alexis Tran", "Dept: Customer Success | Recruiter: Jonas Brekke", true, true, "Sydney, NSW, Australia", "", false, false, "Alexis Tran", "Customer Success", "✓ 2026-07-05", new Date(2026,6,1)],
  ["Onboarded", true, true, true, "Marley", "Ferraro", new Date(2026,6,6), new Date(2026,6,6), "marley.ferraro@example.com", "marley.ferraro@democo.example", "Engineering Intern", "Riley Chen", "riley.chen@democo.example", "Colin Mercer", "Intern cohort — attends Day 1 and Day 3 sessions only.", true, true, "San Luis Obispo, California, United States", "", false, false, "Colin Mercer", "Engineering", "✓ 2026-07-05", new Date(2026,6,1)],
  ["Joined", true, true, true, "Nico", "Osei", new Date(2026,5,29), new Date(2026,6,6), "nico.osei@example.com", "nico.osei@democo.example", "Engineering Intern", "Priya Raman", "", "Colin Mercer", "Dept: Engineering | Recruiter: Liam Ashby", true, true, "Manchester, England, United Kingdom", "", false, false, "Colin Mercer", "Engineering", "✓ 2026-07-05", new Date(2026,6,1)],
  ["Onboarded", true, true, true, "Peyton", "Pruitt", new Date(2026,6,6), new Date(2026,6,6), "peyton.pruitt@example.com", "peyton.pruitt@democo.example", "Senior Commercial Counsel", "Marcus Delaney", "marcus.delaney@democo.example", "Dara Lindgren", "Dept: Legal | Recruiter: Elena Voss", true, true, "Portland, Oregon, United States", "", false, false, "Dara Lindgren", "Legal", "✓ 2026-07-05", new Date(2026,6,1)],
  ["Onboarded", true, true, true, "Reese", "Quintero", new Date(2026,6,20), new Date(2026,6,20), "reese.quintero@example.com", "reese.quintero@democo.example", "Senior Account Manager", "Nina Kovac", "nina.kovac@democo.example", "Bianca Okoro", "Dept: Account Management | Recruiter: Felix Grant", true, true, "Vancouver, British Columbia, Canada", "", false, false, "Bianca Okoro", "Account Management", "✓ 2026-07-19", new Date(2026,6,15)],
  ["Onboarded", true, true, true, "Sawyer", "Rashid", new Date(2026,6,20), new Date(2026,6,20), "sawyer.rashid@example.com", "sawyer.rashid@democo.example", "Deployment Manager", "Theo Barnes", "theo.barnes@democo.example", "Alexis Tran", "Dept: Deployment | Recruiter: Georgia Pike", true, true, "Berlin, Germany", "", false, false, "Alexis Tran", "Deployment", "✓ 2026-07-19", new Date(2026,6,15)],
  ["Onboarded", true, true, true, "Tatum", "Sorensen", new Date(2026,7,3), new Date(2026,7,3), "tatum.sorensen@example.com", "tatum.sorensen@democo.example", "Principal Client Partner", "Sofia Marchetti", "sofia.marchetti@democo.example", "Alexis Tran", "Dept: Client Partnership | Recruiter: Hugo Salas", true, true, "Minneapolis, Minnesota, United States", "", false, false, "Alexis Tran", "Client Partnership", "✓ 2026-08-02", new Date(2026,6,29)],
  ["Onboarded", true, true, true, "Wren", "Tanaka", new Date(2026,7,3), new Date(2026,7,3), "", "wren.tanaka@democo.example", "Senior Data Analyst", "Elias Fontaine", "elias.fontaine@democo.example", "Colin Mercer", "Dept: Data | Recruiter: Imani Reid", true, true, "Singapore", "", false, false, "Colin Mercer", "Data", "✓ 2026-08-02", new Date(2026,6,29)],
  ["Onboarded", true, true, true, "Blake", "Underwood", new Date(2026,6,27), new Date(2026,7,3), "blake.underwood@example.com", "blake.underwood@democo.example", "People Operations Partner", "Grace Abbott", "grace.abbott@democo.example", "Dara Lindgren", "Dept: People | Recruiter: Jonas Brekke", true, true, "Atlanta, Georgia, United States", "", false, false, "Dara Lindgren", "People", "✓ 2026-08-02", new Date(2026,6,29)],
  ["Onboarded", true, true, true, "Cameron", "Vargas", new Date(2026,7,17), new Date(2026,7,17), "cameron.vargas@example.com", "cameron.vargas@democo.example", "Senior Enterprise Account Executive, EMEA", "Omar Haddad", "omar.haddad@democo.example", "Bianca Okoro", "Dept: Sales | Recruiter: Kira Nolan", true, true, "Madrid, Spain", "", true, true, "Bianca Okoro", "Sales", "✓ 2026-08-16", new Date(2026,7,12)],
  ["Onboarded", true, true, true, "Dakota", "Walsh", new Date(2026,7,17), new Date(2026,7,17), "dakota.walsh@example.com", "dakota.walsh@democo.example", "Senior Customer Success Manager", "Dana Whitfield", "dana.whitfield@democo.example", "Alexis Tran", "Dept: Customer Success | Recruiter: Liam Ashby", true, true, "Dublin, Ireland", "", true, true, "Alexis Tran", "Customer Success", "✓ 2026-08-16", new Date(2026,7,12)],
  ["Onboarded", true, true, true, "Ellis", "Yamada", new Date(2026,7,17), new Date(2026,7,17), "ellis.yamada@example.com", "ellis.yamada@democo.example", "Senior Frontend Engineer", "Morgan Smith", "morgan.smith@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Elena Voss", true, true, "Tokyo, Japan", "", true, true, "Colin Mercer", "Engineering", "✓ 2026-08-16", new Date(2026,7,12)],
  ["Onboarded", true, true, true, "Frankie", "Zielinski", new Date(2026,7,10), new Date(2026,7,17), "frankie.zielinski@example.com", "frankie.zielinski@democo.example", "Security Engineer", "Jamie Wilson", "jamie.wilson@democo.example", "Colin Mercer", "Dept: Information Security | Recruiter: Felix Grant", true, true, "Phoenix, Arizona, United States", "", true, true, "Colin Mercer", "Information Security", "✓ 2026-08-16", new Date(2026,7,12)],
  ["Joined", true, true, true, "Greer", "Ashford", new Date(2026,7,31), new Date(2026,7,31), "greer.ashford@example.com", "greer.ashford@democo.example", "Client Partner", "Riley Chen", "riley.chen@democo.example", "Alexis Tran", "Dept: Client Partnership | Recruiter: Georgia Pike", true, true, "Charlotte, North Carolina, United States", "", true, true, "Alexis Tran", "Client Partnership", "✓ 2026-08-30", new Date(2026,7,26)],
  ["Onboarded", true, true, true, "Hayden", "Beaumont", new Date(2026,7,31), new Date(2026,7,31), "hayden.beaumont@example.com", "hayden.beaumont@democo.example", "Product Marketing Manager", "Priya Raman", "priya.raman@democo.example", "Bianca Okoro", "Dept: Marketing | Recruiter: Hugo Salas", true, true, "Toronto, Ontario, Canada", "", true, true, "Bianca Okoro", "Marketing", "✓ 2026-08-30", new Date(2026,7,26)],
  ["Welcome Call Sent", true, true, true, "Jamie", "Castellanos", new Date(2026,8,14), new Date(2026,8,14), "jamie.castellanos@example.com", "jamie.castellanos@democo.example", "Enterprise Account Executive", "Marcus Delaney", "marcus.delaney@democo.example", "Bianca Okoro", "Dept: Sales | Recruiter: Imani Reid", true, true, "Houston, Texas, United States", "", true, true, "Bianca Okoro", "Sales", "", new Date(2026,8,9)],
  ["Welcome Call Sent", true, true, false, "Kai", "Duarte", new Date(2026,8,14), new Date(2026,8,14), "kai.duarte@example.com", "kai.duarte@democo.example", "Senior Platform Engineer", "Nina Kovac", "nina.kovac@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Jonas Brekke", true, true, "Lisbon, Portugal", "", true, true, "Colin Mercer", "Engineering", "", new Date(2026,8,9)],
  ["Welcome Call Sent", true, true, true, "Lennox", "Ellery", new Date(2026,8,14), new Date(2026,8,14), "lennox.ellery@example.com", "lennox.ellery@democo.example", "Customer Advocate", "Theo Barnes", "theo.barnes@democo.example", "Alexis Tran", "Dept: Customer Success | Recruiter: Kira Nolan", true, true, "Salt Lake City, Utah, United States", "", true, true, "Alexis Tran", "Customer Success", "", new Date(2026,8,9)],
  ["Slack Channel Created", true, true, false, "Micah", "Fontaine", new Date(2026,8,14), new Date(2026,8,14), "micah.fontaine@example.com", "micah.fontaine@democo.example", "Senior Product Manager", "Sofia Marchetti", "sofia.marchetti@democo.example", "Colin Mercer", "Dept: Product | Recruiter: Liam Ashby", true, true, "Montreal, Quebec, Canada", "", true, true, "Colin Mercer", "Product", "", new Date(2026,8,9)],
  ["Slack Channel Created", true, true, true, "Noor", "Grayson", new Date(2026,8,8), new Date(2026,8,14), "noor.grayson@example.com", "noor.grayson@democo.example", "Deployment Specialist", "Elias Fontaine", "elias.fontaine@democo.example", "Alexis Tran", "Dept: Deployment | Recruiter: Elena Voss", true, true, "Singapore", "", true, true, "Alexis Tran", "Deployment", "", new Date(2026,8,9)],
  ["Pending", true, false, true, "Orla", "Holloway", new Date(2026,8,24), new Date(2026,8,28), "orla.holloway@example.com", "orla.holloway@democo.example", "Principal Client Partner", "Grace Abbott", "grace.abbott@democo.example", "Alexis Tran", "Dept: Client Partnership | Recruiter: Felix Grant", false, false, "San Diego, California, United States", "", false, false, "", "Client Partnership", "", new Date(2026,8,23)],
  ["Upcoming", false, false, false, "Remy", "Ibarra", new Date(2026,8,24), new Date(2026,8,28), "remy.ibarra@example.com", "remy.ibarra@democo.example", "Staff Software Engineer", "Omar Haddad", "omar.haddad@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Georgia Pike", false, true, "Austin, Texas, United States", "", false, false, "", "Engineering", "", new Date(2026,8,23)],
  ["Upcoming", true, false, true, "Sasha", "Jensen", new Date(2026,8,24), new Date(2026,8,28), "sasha.jensen@example.com", "sasha.jensen@democo.example", "Senior Enterprise Account Executive", "Dana Whitfield", "dana.whitfield@democo.example", "Bianca Okoro", "Dept: Sales | Recruiter: Hugo Salas", false, false, "London, England, United Kingdom", "", false, false, "", "Sales", "", new Date(2026,8,23)],
  ["Pending", false, false, true, "Teagan", "Kerrigan", new Date(2026,8,24), new Date(2026,8,28), "teagan.kerrigan@example.com", "teagan.kerrigan@democo.example", "Technical Recruiter", "Morgan Smith", "morgan.smith@democo.example", "Dara Lindgren", "Dept: Recruiting | Recruiter: Imani Reid", false, true, "Ottawa, Ontario, Canada", "", false, false, "", "Recruiting", "", new Date(2026,8,23)],
  ["Upcoming", true, false, false, "Wilder", "Lindqvist", new Date(2026,8,28), new Date(2026,8,28), "wilder.lindqvist@example.com", "wilder.lindqvist@democo.example", "Finance Manager", "Jamie Wilson", "jamie.wilson@democo.example", "Dara Lindgren", "Dept: Finance | Recruiter: Jonas Brekke", false, false, "Stockholm, Sweden", "", false, false, "", "Finance", "", new Date(2026,8,23)],
  ["Upcoming", false, false, true, "Zara", "Maddox", new Date(2026,8,28), new Date(2026,8,28), "zara.maddox@example.com", "", "Product Designer", "Riley Chen", "riley.chen@democo.example", "Colin Mercer", "Dept: Design | Recruiter: Kira Nolan", false, true, "Melbourne, Victoria, Australia", "", false, false, "", "Design", "", new Date(2026,8,23)],
  ["Upcoming", false, false, false, "Ainsley", "Nakamura", new Date(2026,9,12), new Date(2026,9,12), "ainsley.nakamura@example.com", "ainsley.nakamura@democo.example", "Senior Data Engineer", "Priya Raman", "priya.raman@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Liam Ashby", false, false, "Singapore", "", false, false, "", "Engineering", "", ""],
  ["Upcoming", false, false, false, "Brennan", "Oyelaran", new Date(2026,9,12), new Date(2026,9,12), "brennan.oyelaran@example.com", "brennan.oyelaran@democo.example", "Customer Success Manager", "Marcus Delaney", "marcus.delaney@democo.example", "Alexis Tran", "Dept: Customer Success | Recruiter: Elena Voss", false, false, "Lagos, Nigeria", "", false, false, "", "Customer Success", "", ""],
  ["Upcoming", false, false, false, "Corin", "Pereira", new Date(2026,9,5), new Date(2026,9,12), "corin.pereira@example.com", "corin.pereira@democo.example", "Client Partner", "Nina Kovac", "nina.kovac@democo.example", "Alexis Tran", "Dept: Client Partnership | Recruiter: Felix Grant", false, false, "Sao Paulo, Brazil", "", false, false, "", "Client Partnership", "", ""],
  ["Upcoming", false, false, false, "Delphine", "Radcliffe", new Date(2026,9,26), new Date(2026,9,26), "delphine.radcliffe@example.com", "delphine.radcliffe@democo.example", "Commercial Counsel", "Theo Barnes", "", "Dara Lindgren", "Dept: Legal | Recruiter: Georgia Pike", false, false, "London, England, United Kingdom", "", false, false, "", "Legal", "", ""],
  ["Upcoming", false, false, false, "Emory", "Stavros", new Date(2026,9,26), new Date(2026,9,26), "", "emory.stavros@democo.example", "Network Operations Engineer", "Sofia Marchetti", "sofia.marchetti@democo.example", "Colin Mercer", "Dept: Network Operations | Recruiter: Hugo Salas", false, false, "Chicago, Illinois, United States", "", false, false, "", "Network Operations", "", ""],
  ["Upcoming", false, false, false, "Frey", "Whitlock", new Date(2026,10,9), new Date(2026,10,9), "frey.whitlock@example.com", "frey.whitlock@democo.example", "Vice President, Key Accounts", "Elias Fontaine", "elias.fontaine@democo.example", "Bianca Okoro", "Exec onboarding path — 1:1 orientation instead of group NHO.", false, false, "", "", false, false, "", "Sales", "", ""],
  ["Upcoming", false, false, false, "Giles", "Ashcombe", new Date(2026,10,9), new Date(2026,10,9), "giles.ashcombe@example.com", "giles.ashcombe@democo.example", "Engineering Manager", "Grace Abbott", "grace.abbott@democo.example", "Colin Mercer", "Dept: Engineering | Recruiter: Jonas Brekke", false, false, "", "", false, false, "", "Engineering", "", ""],
  ["Upcoming", false, false, false, "Halle", "Brightwater", new Date(2026,10,23), new Date(2026,10,23), "halle.brightwater@example.com", "", "Senior People Partner", "Omar Haddad", "omar.haddad@democo.example", "Dara Lindgren", "Dept: People | Recruiter: Kira Nolan", false, false, "Denver, Colorado, United States", "", false, false, "", "People", "", ""],
  ["Upcoming", false, false, false, "Ines", "Calloway", new Date(2026,11,7), new Date(2026,11,7), "ines.calloway@example.com", "", "Principal Product Manager", "Dana Whitfield", "dana.whitfield@democo.example", "Colin Mercer", "Dept: Product | Recruiter: Liam Ashby", false, false, "Barcelona, Spain", "", false, false, "", "Product", "", ""]
];

// ─── PREVIEW (read-only) ─────────────────────────────────────────────────────
function previewDummyTrackerSeed() {
  assertNotRealTracker_();
  var ss    = SpreadsheetApp.openById(DUMMY.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(DUMMY.TAB_NAME);
  Logger.log("Spreadsheet : " + ss.getName());
  Logger.log("Tracker tab : " + (sheet ? "found" : "NOT FOUND — check TAB_NAME"));
  if (sheet) {
    Logger.log("Would clear  : rows " + DUMMY.FIRST_DATA_ROW + "-" + sheet.getLastRow()
               + " (" + Math.max(0, sheet.getLastRow() - DUMMY.FIRST_DATA_ROW + 1) + " existing rows)");
  }
  Logger.log("Would write  : " + DUMMY_ROWS.length + " synthetic hires");
  var doomed = snapshotTabs_(ss);
  Logger.log("Would delete : " + doomed.length + " snapshot tab(s) — " + doomed.join(", "));
  Logger.log("Nothing was changed. Run seedDummyTracker() to apply.");
}

function snapshotTabs_(ss) {
  return ss.getSheets()
    .map(function (s) { return s.getName(); })
    .filter(function (n) {
      return DUMMY.KEEP_TABS.indexOf(n) === -1 && /^\d+$/.test(n.trim());
    });
}

// ─── SEED (destructive — run once) ───────────────────────────────────────────
function seedDummyTracker() {
  assertNotRealTracker_();
  var ss    = SpreadsheetApp.openById(DUMMY.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(DUMMY.TAB_NAME);
  if (!sheet) {
    throw new Error('Tab "' + DUMMY.TAB_NAME + '" not found. Tabs: ' +
      ss.getSheets().map(function (s) { return s.getName(); }).join(", "));
  }

  // 1 ── wipe every existing data row
  var last = sheet.getLastRow();
  if (last >= DUMMY.FIRST_DATA_ROW) {
    sheet.getRange(DUMMY.FIRST_DATA_ROW, 1,
                   last - DUMMY.FIRST_DATA_ROW + 1, sheet.getMaxColumns()).clearContent();
  }

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
}

// ─── SUPPORTING TABS ─────────────────────────────────────────────────────────
function seedListTab_(ss) {
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
    ["NHO Track",   ["Full CTA","Async Only","Executive Path"]],
    ["HRBP",        ["Alexis Tran","Bianca Okoro","Colin Mercer","Dara Lindgren"]]
  ];
  for (var c = 0; c < cols.length; c++) {
    sheet.getRange(1, c + 1).setValue(cols[c][0]);
    var vals = cols[c][1].map(function (v) { return [v]; });
    sheet.getRange(2, c + 1, vals.length, 1).setValues(vals);
  }
}

function clearErrorsTab_(ss) {
  var sheet = ss.getSheetByName("Errors");
  if (!sheet) return;
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 5).setValues([["Timestamp","Error Type","First Name","Last Name","Message"]]);
}

// Replaces any betterup.co address with a demo equivalent, in place.
function scrubOnboardingProcess_(ss) {
  var sheet = ss.getSheetByName("Onboarding Process");
  if (!sheet) return 0;
  var range = sheet.getDataRange();
  var vals  = range.getValues();
  var re    = /[A-Za-z0-9._%+-]+@betterup\.co\b/g;
  var hits  = 0, dirty = false;
  for (var r = 0; r < vals.length; r++) {
    for (var c = 0; c < vals[r].length; c++) {
      if (typeof vals[r][c] === "string" && re.test(vals[r][c])) {
        re.lastIndex = 0;
        vals[r][c] = vals[r][c].replace(re, function () { hits++; return "nho.demo@democo.example"; });
        dirty = true;
      }
      re.lastIndex = 0;
    }
  }
  if (dirty) range.setValues(vals);
  return hits;
}

// Per-cohort Ashby snapshot tabs (all-digit names) hold raw candidate PII.
function deleteSnapshotTabs_(ss) {
  var doomed = snapshotTabs_(ss), gone = [];
  for (var i = 0; i < doomed.length; i++) {
    var s = ss.getSheetByName(doomed[i]);
    if (s) { ss.deleteSheet(s); gone.push(doomed[i]); }
  }
  return gone;
}

// ─── VERIFY ──────────────────────────────────────────────────────────────────
// Run after seeding: fails loudly if any betterup.co string survives anywhere.
function verifyNoRealDataRemains() {
  assertNotRealTracker_();
  var ss = SpreadsheetApp.openById(DUMMY.SPREADSHEET_ID);
  var sheets = ss.getSheets(), found = [];
  for (var i = 0; i < sheets.length; i++) {
    var vals = sheets[i].getDataRange().getValues();
    for (var r = 0; r < vals.length; r++) {
      for (var c = 0; c < vals[r].length; c++) {
        if (typeof vals[r][c] === "string" && /betterup\.co/i.test(vals[r][c])) {
          found.push(sheets[i].getName() + "!" + (r + 1) + "," + (c + 1));
        }
      }
    }
  }
  Logger.log("Tabs remaining: " + sheets.map(function (s) { return s.getName(); }).join(", "));
  Logger.log(found.length
    ? "FAIL — betterup.co still present at: " + found.slice(0, 40).join(" | ")
    : "PASS — no betterup.co references anywhere in the workbook.");
}
