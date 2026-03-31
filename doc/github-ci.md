# GitHub CI (pull requests)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

## What runs on a PR

1. **Prettier** — `npm run format`. If files change:
   - **PR from a branch in this repo:** the workflow commits with message `style: apply Prettier (automated)` and pushes to your PR branch.
   - **PR from a fork:** pushing the branch is not allowed from Actions; the job **fails** with an error. Run `npm run format` locally, commit, and push.

2. **ESLint** — `npm run lint:ci` (`eslint … --max-warnings 0`). Any **error** or **warning** fails the job (warnings are not ignored).

The **lint** job runs **after** the **format** job so it lints the latest tree (including any formatting commit).

## Requiring a pull request (no direct merge to `master`)

GitHub cannot enforce “only PRs” from YAML alone. Configure branch protection:

1. Repo **Settings** → **Branches** → **Add branch protection rule** (or edit existing).
2. Branch name pattern: `master` (or your default branch).
3. Enable **Require a pull request before merging**.
4. Optionally enable **Require status checks to pass before merging** and select the **CI** workflow jobs (**format**, **lint** — or require only **lint** if you prefer; both are part of the same workflow file).

Direct pushes to the protected branch are then blocked unless allowed for admins (you can disable admin bypass for stricter rules).

## Local commands

```sh
npm run format
npm run lint      # with --fix
npm run lint:ci   # strict; same as CI
```
