---
name: daily-homepage
description: Generate, validate, archive, commit, push, and verify a new daily design for the iamwilllee portfolio homepage. Use for the scheduled daily homepage publication or when the user explicitly asks to run the daily homepage workflow.
---

# Daily Homepage

Create one fresh visual treatment for the portfolio while keeping `README.md` as the only source of project content.

## Boundaries

- Work from an up-to-date `origin/main`, preferably in an isolated clean worktree.
- Never edit project names, descriptions, links, or image choices outside `README.md`. Run the existing sync script before designing.
- Preserve `<!-- projects:start -->` and `<!-- projects:end -->` in `portfolio/index.html`.
- Do not copy source code, written copy, or media from inspiration sites. Translate only abstract traits such as scale, spacing, rhythm, palette, borders, and composition.
- Do not add dependencies unless the existing stack cannot express the design.
- Never force-push, rewrite history, or discard unrelated changes.
- Commit and push only when the invoking user message or saved automation prompt explicitly authorizes publishing.

## Draw a reference

1. Run `corepack pnpm pick:inspiration` and preserve its complete JSON result.
2. Open the selected listing page with a real browser, go to the generated page, and select the generated card position. Do not default to the first card.
3. Resolve and visit the selected live site. If the listing or site is unavailable, redraw, at most three times.
4. Compare `portfolio/history/versions.json`. Do not reuse the same reference URL from the recent archive.
5. Record the draw, reference name and URLs, and abstract interpretation in `portfolio/design-manifest.json`.

## Design and archive

1. Run `corepack pnpm sync:portfolio` so website content matches `README.md`.
2. Redesign `portfolio/index.html` and `portfolio/css/style.css`; reuse `portfolio/js/theme.js` when possible.
3. Keep a visible `History` link to `history/` and preserve accessible focus states, semantic headings, reduced-motion behavior, and light/dark theme support.
4. Run `corepack pnpm archive:portfolio -- --date YYYY-MM-DD` using the current Asia/Shanghai date. This freezes the published page under `portfolio/history/YYYY-MM-DD/` and updates the archive index.

## Verify before publishing

Run:

```sh
corepack pnpm test
corepack pnpm check:portfolio
corepack pnpm check:history
```

Preview the site and visually inspect the homepage, history index, and new snapshot at 1280px, 375px, and 320px. Check horizontal overflow, image loading, navigation, archived assets, and dark mode. Fix every regression introduced by this run.

## Publish safely

1. Fetch `origin/main`. If it advanced, rebase once and rerun all verification. Stop on conflicts instead of guessing.
2. Commit only the focused daily homepage, manifest, and history files with `daily homepage: YYYY-MM-DD`.
3. Push `HEAD:main` without force.
4. Verify that `origin/main` contains the commit.
5. Verify the `Deploy Portfolio to GitHub Pages` workflow and the resulting Pages deployment. Report a failed or missing deployment honestly; a successful push alone is not a successful publication.
