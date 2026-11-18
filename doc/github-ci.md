# GitHub CI (pull requests)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml).

`npm ci` reads [`.npmrc`](../.npmrc) (npm registry only). ESLint uses the official recommended JavaScript config plus type-checked `typescript-eslint` and Prettier. The main jobs use the Node version in [`.nvmrc`](../.nvmrc).

## What runs on a PR

1. **format** — `npm run format`. If files change:
   - **PR from a branch in this repo:** the workflow commits with message `style: apply Prettier (automated)` and pushes to your PR branch. This is the only job with `contents: write`.
   - **PR from a fork:** pushing the branch is not allowed from Actions; the job **fails** with an error. Run `npm run format` locally, commit, and push.

2. **lint** — runs after **format**, against the latest tree (including any formatting commit):
   - `npm audit --audit-level=high` fails on high or critical advisories;
   - `npm run lint:ci` (`eslint … --max-warnings 0`) fails on any error or warning;
   - `npm run test:ci` runs Jest serially with coverage and enforces the thresholds in `jest.config.cjs`;
   - `npm run build` type-checks with `tsc` (Jest uses SWC, which does not type-check) and emits `dist/`.

3. **node-22** — runs Jest and the build on Node 22, the minimum major allowed by `engines.node`.

## Dependency updates

[`.github/dependabot.yml`](../.github/dependabot.yml) opens weekly grouped npm PRs and monthly GitHub Actions PRs. It skips TypeScript majors until `typescript-eslint` supports them, and `@types/node` majors so the types match the minimum supported runtime.

`package.json` `overrides` pin patched `glob` and `minimatch` versions for dev tooling (Jest coverage, nodemon) until upstream ranges include the fixes. Remove an override once `npm ls <name>` shows upstream already resolves a patched version.

## Requiring a pull request (no direct merge to `master`)

GitHub cannot enforce “only PRs” from YAML alone. Configure branch protection:

1. Repo **Settings** → **Branches** → **Add branch protection rule** (or edit existing).
2. Branch name pattern: `master` (or your default branch).
3. Enable **Require a pull request before merging**.
4. Optionally enable **Require status checks to pass before merging** and select the **CI** workflow jobs (**format**, **lint**, **node-22**).

Direct pushes to the protected branch are then blocked unless allowed for admins (you can disable admin bypass for stricter rules).

## Deploy

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) is a manual `workflow_dispatch` job. It validates the branch name, connects over SSH with `StrictHostKeyChecking=accept-new` (a changed host key aborts the deploy), and runs [`deploy.sh`](../.github/workflows/deploy.sh) on the server, which installs with `npm ci`, builds, and restarts the `ai-phone-agent-service` pm2 process.

Required secrets: `SSH_HOST`, `SSH_USER`, `SSH_PRIVATE_KEY`, `DEPLOY_PATH`.

## Local commands

```sh
npm run format
npm run lint      # with --fix
npm run lint:ci   # strict; same as CI
npm test          # watch-free local unit test run
npm run test:coverage
npm run test:ci   # same as CI
npm run build
npm audit --audit-level=high
```
