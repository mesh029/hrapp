# HR App Next Fixes (Step-by-Step)

Only active work items and their progress.

## Progress Board

| Step | Task | Status | Notes |
|---|---|---|---|
| 1 | Timesheet detail page to mirror leave approval actions (approve, final decline, decline+route back) | Completed | Added action panel on timesheet detail with comment enforcement and reroute step selection. |
| 2 | Confirm leave accrual default is **1.75 days/month** and visible in admin config | Completed | Added admin page at `/administration/leave-accrual`; API access fixed; verified default annual config is 1.75/month. |
| 3 | Admin accrual controls by scope (roles/categories/users) with contract start/end windows | Completed | Added `/api/leave/accrual/apply` + UI scope selectors (roles/categories/users/location/staff-type); contract windows enforced during calculation. |
| 4 | Admin override/adjust leave balances (manual corrections) | Pending | Confirm UI + API behavior and fix edge cases. |
| 5 | Auto-add approved leave days into timesheet entries | Completed | Confirmed existing `leave-workflow` -> `addLeaveEntryToTimesheet()` integration on final leave approval. |
| 6 | End-to-end validation: leave submit + timesheet submit + approval transitions | Pending | Run focused test script after fixes above. |
| 7 | Dashboard upgrade for Admin/HR (live cards + meaningful graphs) | Completed | Replaced placeholder logic and added analytics cards (leave, timesheet, contract/leave health). |

## Known Risks To Handle During Steps

- Workflow notifications sometimes point to workflow context only; keep routing users to the exact leave/timesheet record where possible.
- Scope drift risk: approver visibility can become too narrow/too broad if location and permission scope checks disagree.
- Re-approval loops need strict comment trails so every decline/reroute reason is auditable.