#!/usr/bin/env bash
# One-time GitHub setup for ticketing + PR rules. Run after `gh auth login`.
# Safe to re-run: label creation is idempotent-ish (ignores "already exists").
set -euo pipefail

REPO="mehrasmeydani/obsidian_dnd_vtt"

echo "==> 1. Auth check"
gh auth status || { echo "Run: gh auth login"; exit 1; }

echo "==> 2. Labels"
mklabel() { gh label create "$1" --color "$2" --description "$3" --repo "$REPO" 2>/dev/null \
            || gh label edit "$1" --color "$2" --description "$3" --repo "$REPO"; }
mklabel ticket       0e8a16 "Feature or task"
mklabel bug          d73a4a "Something broke"
mklabel needs-check  fbca04 "Merged + CI green, awaiting manual Obsidian check"
mklabel blocked      b60205 "Waiting on a dependency"
mklabel p1           b60205 "Priority 1"
mklabel p2           d93f0b "Priority 2"
mklabel p3           fbca04 "Priority 3"
mklabel p4           c2e0c6 "Priority 4"
mklabel phase-1      1d76db "Roadmap phase 1"
mklabel phase-2      1d76db "Roadmap phase 2"
mklabel phase-3      1d76db "Roadmap phase 3"

echo "==> 3. Collaborators (edit usernames, then uncomment)"
# gh api -X PUT "repos/$REPO/collaborators/USERNAME" -f permission=push   # push = Write
# Invited users must accept the emailed invite before they appear.

echo "==> 4. Branch protection on main"
# Requires: passing 'test-and-build' check, 1 approving review, code-owner review,
# stale approvals dismissed on new commits. enforce_admins=false so you keep an
# escape hatch; set true once the team is self-sufficient.
gh api -X PUT "repos/$REPO/branches/main/protection" \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test-and-build"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "require_code_owner_reviews": true,
    "dismiss_stale_reviews": true
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON

echo "==> 5. Default merge = squash (optional, keeps main linear)"
gh api -X PATCH "repos/$REPO" \
  -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false \
  -F delete_branch_on_merge=true >/dev/null

echo "==> Done."
