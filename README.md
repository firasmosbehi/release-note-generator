# Automated Release Notes Generator

![CI](https://github.com/firasmosbehi/release-note-generator/actions/workflows/ci.yml/badge.svg)
![Draft Release on Tag](https://github.com/firasmosbehi/release-note-generator/actions/workflows/release-drafter.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

GitHub Action that drafts release notes from merged PR titles (Conventional Commits) whenever a tag is pushed. It groups changes into sections (Features, Fixes, Chores, etc.), renders a configurable template, and updates/creates a draft GitHub Release.

## Quick Start

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
      - uses: firasmosbehi/release-note-generator@v0.1.0
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: false
```

### Inputs

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `github-token` | yes | – | Token with `contents:write` and `pull-requests:read` (use `secrets.GITHUB_TOKEN`). |
| `tag` | no | current tag | Tag to draft the release for. |
| `base` | no | previous tag or branch root | Comparison base ref/sha. |
| `head` | no | current tag | Comparison head ref/sha. |
| `dry-run` | no | `false` | Skip creating/updating the release; just log the body. |
| `heading-level` | no | `2` | Markdown heading level for category sections. |
| `empty-message` | no | `No categorized changes found.` | Message when no entries are found. |
| `template` | no | `{{sections}}` | Template supporting `{{sections}}`, `{{tag}}`, `{{previousTag}}`. |
| `category-map` | no | built-in map | JSON mapping Conventional Commit types to headings. |

### Expected PR Titles

Conventional Commits style, e.g.:
- `feat: add config`
- `fix(ui): align button`
- `chore: bump deps`

Non-conformant titles are skipped (logged).

### Permissions
- `contents: write`
- `pull-requests: read`

### Outputs
- `release-body`: rendered release notes body.

## How It Works
1. Determine current tag and previous tag (or branch root for first release).
2. Compare commits between base/head and gather merged PRs for those commits.
3. Parse PR titles into categories using `category-map`.
4. Render markdown sections and draft/update the GitHub Release (or dry run).

## Local Development
```bash
npm ci
npm run lint
npm run test
npm run build
```
`dist/` is the packaged action referenced by `action.yml`.

## Contributing
PRs welcome! See `CONTRIBUTING.md` for workflow details.

## License
MIT License. See `LICENSE` for details.
