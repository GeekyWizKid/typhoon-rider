# Vercel Web Analytics Design

## Goal

Enable Vercel Web Analytics for the existing Vite and Phaser application so the
Vercel dashboard reports visitors and page views after the production site is
visited.

## Scope

- Add the official `@vercel/analytics` browser package.
- Initialize analytics once from the existing Vite entry point, `src/main.ts`.
- Preserve all game behavior, visuals, controls, and audio.
- Do not add Speed Insights, Google Analytics, custom events, consent UI, or a
  separate analytics service.

## Architecture

The application remains a static Vite deployment. The entry point imports the
framework-neutral `inject` function from `@vercel/analytics` and invokes it once
during startup. On a Vercel production deployment, the package loads Vercel's
first-party analytics script and records page views for the project.

No analytics state is shared with Phaser. Failure to load the analytics script
must not block game startup or change the player experience.

## Files

- `package.json`: declare the `@vercel/analytics` runtime dependency.
- `package-lock.json`: lock the installed package version and integrity data.
- `src/main.ts`: import and initialize Vercel Web Analytics once.

## Verification

The repository has no automated test runner, and this change is limited to a
third-party bootstrap integration. No new test framework will be introduced.
Verification consists of:

1. Running the existing production build, which includes TypeScript checking.
2. Confirming the committed production deployment succeeds on Vercel.
3. Visiting the production site and confirming requests to Vercel's
   `/_vercel/insights/` endpoint are emitted without console errors.
4. Confirming the Vercel Analytics setup screen begins reporting visitor or page
   view data after processing.

## Delivery

Commit the dependency and entry-point changes to `main`, push them to GitHub,
and use the repository's existing Vercel integration to create the production
deployment. No manual project migration or domain change is required.
