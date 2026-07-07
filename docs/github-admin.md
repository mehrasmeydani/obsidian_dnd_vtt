# GitHub admin cheatsheet

Owner-only operations for this repo. Requires `gh auth login` with admin scope.
Repo: `mehrasmeydani/obsidian_dnd_vtt`.

## 1. Add collaborators (Write access)

```bash
gh api -X PUT repos/mehrasmeydani/obsidian_dnd_vtt/collaborators/HANDLE -f permission=push
```

- `permission=push` = **Write** (push branches, open PRs; cannot change repo settings).
- Success: HTTP 201 + an invitation JSON (or 204 if already a collaborator).
- The invitee must **accept the emailed invite** before they appear or can be assigned issues.
- Repeat per person.

Common errors:
- **404** → the username doesn't exist / is misspelled. Verify with
  `gh api users/HANDLE --jq .login` (use the login from their profile URL, not a display name or email).
- **422** → usually you're inviting yourself (the owner can't be a collaborator),
  or an invite is already pending. Check pending invites:
  `gh api repos/mehrasmeydani/obsidian_dnd_vtt/invitations --jq '.[].invitee.login'`

List / remove:
```bash
gh api repos/mehrasmeydani/obsidian_dnd_vtt/collaborators --jq '.[].login'   # current collaborators
gh api -X DELETE repos/mehrasmeydani/obsidian_dnd_vtt/collaborators/HANDLE    # remove someone
```

For per-area review routing, add them to `.github/CODEOWNERS`
(e.g. `src/data/content/  @some-handle`).

## 3. Branch protection management

Protection on `main` requires: `test-and-build` CI green + 1 approving review +
code-owner review; stale approvals dismissed on new commits; linear history;
no force-push/deletion. It is defined in `scripts/github-setup.sh`.

**`enforce_admins` is currently `false`** — the rules do NOT bind admins (you),
so you keep an escape hatch while solo. Flip it once the team is self-sufficient
and you want the PR gate to apply to everyone:

```bash
# make the rules apply to admins too
gh api -X POST   repos/mehrasmeydani/obsidian_dnd_vtt/branches/main/protection/enforce_admins
# exempt admins again (escape hatch back on)
gh api -X DELETE repos/mehrasmeydani/obsidian_dnd_vtt/branches/main/protection/enforce_admins
# check current state
gh api repos/mehrasmeydani/obsidian_dnd_vtt/branches/main/protection/enforce_admins --jq .enabled
```

Other protection ops:
```bash
# view full protection config
gh api repos/mehrasmeydani/obsidian_dnd_vtt/branches/main/protection

# temporarily remove all protection (e.g. to push a bootstrap commit), then restore
gh api -X DELETE repos/mehrasmeydani/obsidian_dnd_vtt/branches/main/protection
./scripts/github-setup.sh   # re-applies the protection block
```

Merging your own PR while solo (bypasses the 1-approval gate):
```bash
gh pr merge --squash --admin
```
