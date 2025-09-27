# Contributing to Reading Helper

Thanks for your interest in improving Reading Helper! Contributions of all sizes are welcome.

This project is source-available under a non-commercial license (see LICENSE). You may use, tweak, and improve it; commercial use or redistribution requires permission from the author.

## Quick Start

1. Fork and clone this repo
2. Copy `secrets.example.json` → `secrets.json` and add your Gemini API key
3. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable Developer mode
   - Click "Load unpacked" and select this folder
4. Make changes, click "Reload" on the extension, and refresh a page to test

## Development Checklist

- Hover card: Highlight / Bold / Contrast / Remove / Search / Meaning
- Popup toolbox: Focus mode, list of highlights, jump to highlight
- Persistence: reload the page and verify highlights remain
- Contrast/readability: dark UI, meaning box text is legible
- No errors in content script or service worker console

## Branching & Commits

- Branch from `master`: `feat/...`, `fix/...`, `docs/...`, `refactor/...`
- Keep PRs focused and small when possible
- Describe changes clearly; include screenshots/GIFs for UI updates

## Code Style & Guidelines

- Defensive DOM code: guard selections/ranges and node connectivity
- Prefer small utilities for repeated logic
- Avoid new permissions unless necessary; document why when added
- Keep UI accessible (labels/ARIA, focus states, color contrast)

## Testing

There are no automated tests yet; please perform a manual pass covering the checklist above. If you add new user-facing behavior, add/update docs.

## Submitting a PR

- Link related issues (e.g., `Closes #123`)
- Explain what changed and why
- Provide before/after visuals for UI where relevant
- Confirm you did a manual test pass

## Questions & Ideas

Open a GitHub Issue (bug/feature) or start a Discussion. If you’re unsure where to start, comment on a “good first issue” and we’ll help you pick something up.
