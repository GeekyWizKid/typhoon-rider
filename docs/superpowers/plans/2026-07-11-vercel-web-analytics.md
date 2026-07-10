# Vercel Web Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable Vercel Web Analytics on the production Typhoon Rider site so Vercel reports visitors and page views.

**Architecture:** Keep the application as a static Vite and Phaser build. Add Vercel's framework-neutral browser package and invoke its `inject` bootstrap once from the existing application entry point, independently of the Phaser runtime.

**Tech Stack:** TypeScript 5, Vite 6, Phaser 3, `@vercel/analytics` 2, GitHub, Vercel

---

### Task 1: Establish A Clean Build Baseline

**Files:**
- Verify: `package.json`
- Verify: `package-lock.json`

- [ ] **Step 1: Install the repository's locked dependencies**

Run:

```bash
npm ci
```

Expected: npm exits with status 0 and installs the dependencies from `package-lock.json` without changing tracked files.

- [ ] **Step 2: Run the existing production build**

Run:

```bash
npm run build
```

Expected: `tsc --noEmit` and `vite build` both succeed, and Vite writes the production bundle to `dist/`.

### Task 2: Add The Analytics Bootstrap

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/main.ts`

The approved design treats this third-party bootstrap as a configuration integration and explicitly does not add a test framework to this repository. The production TypeScript build and live browser request are the acceptance checks.

- [ ] **Step 1: Install the official Vercel Analytics package**

Run:

```bash
npm install @vercel/analytics@^2.0.1
```

Expected: `package.json` declares `@vercel/analytics` under `dependencies`, and `package-lock.json` locks the resolved package.

- [ ] **Step 2: Initialize analytics from the application entry point**

Add the external import near the top of `src/main.ts`:

```typescript
import { inject } from "@vercel/analytics";
import Phaser from "phaser";
```

Invoke it once after the imports and before game objects are constructed:

```typescript
inject();

const simulation = new GameSimulation();
```

- [ ] **Step 3: Run the complete production build**

Run:

```bash
npm run build
```

Expected: TypeScript reports no errors, Vite exits with status 0, and the production bundle is generated.

- [ ] **Step 4: Review the exact implementation diff**

Run:

```bash
git diff --check
git diff -- package.json package-lock.json src/main.ts
```

Expected: no whitespace errors; the diff contains only the new dependency, lockfile data, import, and one `inject()` call.

- [ ] **Step 5: Commit the implementation**

Run:

```bash
git add package.json package-lock.json src/main.ts
git commit -m "feat: enable Vercel Web Analytics"
```

Expected: one implementation commit is created with only the three intended files.

### Task 3: Publish And Verify Production

**Files:**
- Verify: Git commit and deployment state only

- [ ] **Step 1: Push the linear commit history to GitHub `main`**

Run from the approved feature worktree:

```bash
git push origin HEAD:main
```

Expected: GitHub accepts a fast-forward update to `GeekyWizKid/typhoon-rider` on `main`.

- [ ] **Step 2: Wait for Vercel's GitHub deployment status**

Resolve the pushed commit SHA and query its combined status:

```bash
COMMIT_SHA="$(git rev-parse HEAD)"
gh api "repos/GeekyWizKid/typhoon-rider/commits/${COMMIT_SHA}/status"
```

Expected: the `Vercel` status changes to `success` with description `Deployment has completed`.

- [ ] **Step 3: Confirm the production alias serves the new build**

Run:

```bash
curl --fail --silent --show-error --head https://typhoon-rider.vercel.app/
```

Expected: HTTP 200 from Vercel after the deployment timestamp.

- [ ] **Step 4: Verify analytics in a real production browser session**

Run:

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" open https://typhoon-rider.vercel.app/
"$PWCLI" snapshot
"$PWCLI" network
"$PWCLI" console
```

Expected: the game page loads, the network log contains a successful request under `/_vercel/insights/`, and the console contains no analytics initialization error.

- [ ] **Step 5: Confirm the analytics endpoint directly**

Run:

```bash
curl --fail --silent --show-error --head https://typhoon-rider.vercel.app/_vercel/insights/script.js
```

Expected: the production alias returns the Vercel Analytics script successfully.

- [ ] **Step 6: Confirm repository synchronization**

Run:

```bash
git status --short --branch
git rev-parse HEAD
git rev-parse origin/main
```

Expected: the worktree is clean and `HEAD` equals `origin/main`.
