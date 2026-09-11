# Why these files are here

Moved here on 2026-09-11 during a working-directory cleanup. **Nothing was deleted.**

## What this folder is

Work that was produced alongside the deliverable but is **not part of it**. The requested
deliverable is only:

- `../NHO_Tracker_Dummy_Data.xlsx` — the shipped synthetic workbook (48 hire rows, columns A–Y)
- `../generate_dummy_tracker_CANONICAL.py` — the one generator that produced it
- `../NHO_Dummy_Tracker_README.md` — its handover documentation
- `../verify_dummy_tracker.py` — the verifier for it

Everything in this folder is additive: it was built without being asked for, or it is an
auxiliary/duplicate artefact. It may still be useful, so it is kept.

## Contents

**Replacement dashboard build (unrequested)**
- `Employee_Onboarding_Operations.html` — standalone dashboard page
- `operations_dashboard.js` — dashboard logic
- `operations_data.js` — data bundle baked out of the workbooks
- `test_dashboard_logic.js` — tests for the above
- `rebuild_dashboard.sh` — rebuild script for the above
- `DASHBOARD_README.md` — documentation for the above

**Seeder / extension build (unrequested)**
- `SeedDummyTracker.gs` — Apps Script that seeds a sheet from `dummy_hires.json`
- `make_seeder.py` — generates that .gs file
- `dummy_hires.json` — hire records used by the seeder
- `generate_dummy_extensions.py` — builds the companion workbook below
- `NHO_Dummy_Extensions.xlsx` — companion workbook (extra tabs; not the deliverable)

**Auxiliary / duplicate**
- `verify_dummy.py` — an earlier, narrower verifier (replays `getDashboardData()`);
  superseded by `../verify_dummy_tracker.py`. It is read-only and harmless to run.
- `demo_config.py`, `demo_config.json` — configuration imported only by `verify_dummy.py`
- `NHO_Tracker_Dummy_Data_README.md` — a **second** handover document for the same workbook.
  It is factually consistent with the shipped file (48 rows, A–Y), but keeping two READMEs at
  the top level is exactly the confusion this cleanup removes. `../NHO_Dummy_Tracker_README.md`
  is the one to read; this copy is retained because it contains extra detail (md5, file-mode
  rationale).

## Caveats

- These scripts were written to run from the parent folder. Paths in
  `generate_dummy_extensions.py`, `verify_dummy.py` and `rebuild_dashboard.sh` assume the
  workbook sits next to them, so they need a path fix before they will run from here.
- Nothing in this folder writes to `../NHO_Tracker_Dummy_Data.xlsx`, so none of it can damage
  the deliverable. (Unlike `../_superseded/` — see the note there.)
