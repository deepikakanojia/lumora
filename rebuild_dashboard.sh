#!/bin/sh
# Rebuilds everything the dashboard reads, in the only order that is correct.
#
#   1. generate_dummy_extensions.py  reads the tracker and regenerates the
#      companion workbook against the CURRENT roster. It must run first —
#      Pilot membership and session attendance reference tracker hires by work
#      email, so running it after a tracker change is what keeps them matched.
#   2. build_nho_data.py             merges both workbooks into operations_data.js.
#
# Run this after ANY change to NHO_Tracker_Dummy_Data.xlsx, then reload
# Employee_Onboarding_Operations.html in the browser.
set -e
cd "$(dirname "$0")"
echo "1/2  regenerating companion workbook from the current tracker…"
python3 generate_dummy_extensions.py
echo
echo "2/2  building operations_data.js…"
python3 build_nho_data.py
echo
echo "Done. Open Employee_Onboarding_Operations.html (or reload it) to see the result."
