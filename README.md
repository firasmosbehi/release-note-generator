# Automated Release Notes Generator

![CI](https://github.com/firasmosbehi/release-note-generator/actions/workflows/ci.yml/badge.svg)
![Draft Release on Tag](https://github.com/firasmosbehi/release-note-generator/actions/workflows/release-drafter.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

An action-first project that turns tagged releases into polished GitHub Releases. It parses pull request titles that follow Conventional Commits and builds categorized changelog bullets (Features, Fixes, Chores) automatically.

## Features (planned)
- Parse PR titles that follow Conventional Commits.
- Group entries into Features, Fixes, and Chores.
- Draft a GitHub Release when a tag is pushed.
- Configurable templates for release notes output.
- Dry-run mode for CI validation.

## Why
Writing release notes by hand is tedious and error-prone. This project automates the boring parts so teams can ship faster with consistent changelogs.

## Getting Started
Development setup (preview):

```bash
npm ci
npm run lint
npm run test
npm run build
```

This builds the action into `dist/` for use in workflows.

### Usage (preview)
Add a workflow triggered by tags:

```yaml
name: Draft Release Notes

on:
  push:
    tags:
      - '*'

jobs:
  draft:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run build
      - uses: firasmosbehi/release-note-generator@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: false
          heading-level: 2
          empty-message: "No categorized changes found."
          template: "{{sections}}"
          category-map: "{\"perf\":\"Performance\"}"
```

Inputs:
- `github-token` (required): token with `contents:write`, `pull-requests:read`.
- `tag` (optional): override tag name; defaults to the pushed tag.
- `dry-run` (optional, default `false`): skip creating/updating release.
- `heading-level` (optional): markdown heading level for category sections.
- `empty-message` (optional): text shown when no categorized entries.
- `template` (optional): string containing `{{sections}}`, `{{tag}}`, `{{previousTag}}` placeholders.
- `category-map` (optional): JSON object mapping Conventional Commit types to headings.

Expected PR titles: Conventional Commits (e.g., `feat: add config`, `fix(ui): align button`). Non-conformant titles are skipped with a log.

## Roadmap
Roadmap is tracked through GitHub milestones and issues. Open the repository issues tab to see current work.

## Contributing
We welcome pull requests! Please read `CONTRIBUTING.md` for workflow details.

## License
MIT License. See `LICENSE` for details.
