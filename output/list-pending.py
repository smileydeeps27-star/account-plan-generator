#!/usr/bin/env python3
"""
list-pending.py

Reads Batch Status Tracker.xlsx and outputs JSON describing the next N
pending accounts. Used by /api/batch-queue.

Pending = Status column (col I) is NOT "Complete".

CLI:
    python3 output/list-pending.py [--size N] [--cp NAME] [--type TYPE]

Output:
    {"pending": [{...}, ...], "count": N}
"""

import argparse
import json
import os
import sys

import openpyxl

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TRACKER = os.path.join(REPO_ROOT, "output", "FY27 Account Plans", "Batch Status Tracker.xlsx")
META_FILE = os.path.join(REPO_ROOT, "output", "account-metadata.json")

# GTM Industry / Sub-Industry -> form dropdown value
INDUSTRY_MAP = {
    "High Tech": "Hi-Tech",
    "Hi-Tech": "Hi-Tech",
    "Consumer Products": "CPG / FMCG",
    "CPG": "CPG / FMCG",
    "FMCG": "CPG / FMCG",
    "Wholesale Distribution": "Retail",
    "Utilities": "Energy",
    "Energy": "Energy",
    "Automotive": "Automotive",
    "Telecommunications": "Telecommunications",
    "Industrial Manufacturing": "Manufacturing",
    "Manufacturing": "Manufacturing",
    "Travel and Transportation": "Manufacturing",
    "Retail": "Retail",
    "Aerospace & Defense": "Aerospace & Defense",
    "Healthcare": "Healthcare",
    "Pharmaceuticals": "Pharmaceuticals",
    "Pharma": "Pharmaceuticals",
    "Financial Services": "Financial Services",
    "Chemicals": "Chemicals",
}

DEFAULT_REVENUE = "$5B - $20B"


def map_industry(gtm, sub):
    if gtm and gtm in INDUSTRY_MAP:
        return INDUSTRY_MAP[gtm]
    if sub and sub in INDUSTRY_MAP:
        return INDUSTRY_MAP[sub]
    return "Manufacturing"


def load_overrides():
    """Per-account overrides for industry/revenue. JSON shape:
       { "AccountName": {"industry": "...", "revenue": "..."}, ... }
    """
    if not os.path.exists(META_FILE):
        return {}
    try:
        with open(META_FILE) as f:
            return json.load(f)
    except Exception as e:
        print(f"WARN: failed to load {META_FILE}: {e}", file=sys.stderr)
        return {}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=10, help="Max accounts to return (default 10)")
    ap.add_argument("--cp", default="", help="Filter by Client Partner name")
    ap.add_argument("--type", default="", help="Filter by Account Type (Key Account / Target Account / Other Account)")
    args = ap.parse_args()

    if not os.path.exists(TRACKER):
        print(json.dumps({"error": f"Tracker not found: {TRACKER}"}))
        sys.exit(1)

    overrides = load_overrides()
    wb = openpyxl.load_workbook(TRACKER, data_only=True)
    ws = wb.active

    pending = []
    total_pending = 0
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row or len(row) < 2:
            continue
        num = row[0]
        account = row[1]
        cp = row[2] if len(row) > 2 else None
        territory = row[3] if len(row) > 3 else None
        account_type = row[4] if len(row) > 4 else None
        gtm = row[5] if len(row) > 5 else None
        sub = row[6] if len(row) > 6 else None
        status = row[8] if len(row) > 8 else None

        if not account:
            continue
        if status == "Complete":
            continue

        # Apply filters
        if args.cp and (cp or "").strip().lower() != args.cp.strip().lower():
            continue
        if args.type and (account_type or "").strip().lower() != args.type.strip().lower():
            continue

        total_pending += 1
        if len(pending) >= args.size:
            continue

        ov = overrides.get(account, {}) if isinstance(overrides, dict) else {}
        industry = ov.get("industry") or map_industry(gtm, sub)
        revenue = ov.get("revenue") or DEFAULT_REVENUE

        pending.append({
            "row": num,
            "name": account,
            "cp": cp or "",
            "territory": territory or "",
            "accountType": account_type or "",
            "gtmIndustry": gtm or "",
            "subIndustry": sub or "",
            "industry": industry,
            "revenue": revenue,
        })

    out = {
        "pending": pending,
        "count": len(pending),
        "totalPending": total_pending,
        "filters": {"cp": args.cp, "type": args.type, "size": args.size},
    }
    print(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
