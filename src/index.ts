import * as core from '@actions/core';
import * as github from '@actions/github';
import {Octokit} from '@octokit/rest';

// Map Conventional Commit types to release note categories
const CATEGORY_MAP: Record<string, string> = {
  feat: 'Features',
  fix: 'Fixes',
  chore: 'Chores',
  docs: 'Docs',
  refactor: 'Refactors'
};

interface ParsedTitle {
  category: string;
  summary: string;
}

function parseTitle(title: string): ParsedTitle | null {
  const match = title.match(/^(\w+)(?:\([^)]*\))?:\s+(.+)/);
  if (!match) return null;
  const [, type, summary] = match;
  const category = CATEGORY_MAP[type.toLowerCase()] ?? 'Other';
  return {category, summary};
}

async function findPreviousTag(octokit: Octokit, owner: string, repo: string, currentTag: string): Promise<string | null> {
  const {data: tags} = await octokit.repos.listTags({owner, repo, per_page: 100});
  const idx = tags.findIndex(tag => tag.name === currentTag);
  if (idx === -1) return null;
  const prev = tags[idx + 1];
  return prev ? prev.name : null;
}

async function main(): Promise<void> {
  try {
    const token = core.getInput('github-token', {required: true});
    const explicitTag = core.getInput('tag');
    const dryRun = core.getBooleanInput('dry-run');

    const ctx = github.context;
    const {owner, repo} = ctx.repo;
    const refTag = explicitTag || ctx.ref.replace('refs/tags/', '');

    const octokit = github.getOctokit(token);

    if (!refTag) {
      core.setFailed('No tag provided or found in context.');
      return;
    }

    const previousTag = await findPreviousTag(octokit, owner, repo, refTag);
    core.info(`Current tag: ${refTag}`);
    core.info(`Previous tag: ${previousTag ?? 'none (initial release)'}`);

    // Determine base and head for comparison
    let baseRef: string | undefined;
    if (previousTag) {
      baseRef = previousTag;
    }

    // If no previous tag, compare from the beginning of the repository
    const compareBase = baseRef ?? (await octokit.repos.get({owner, repo})).data.default_branch;

    const {data: comparison} = await octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: compareBase,
      head: refTag
    });

    const seenPrs = new Set<number>();
    const categorized: Record<string, {summary: string; pr: number}[]> = {};

    for (const commit of comparison.commits) {
      const {data: prs} = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
        owner,
        repo,
        commit_sha: commit.sha
      });

      for (const pr of prs) {
        if (pr.state !== 'closed' || !pr.merged_at) continue;
        if (seenPrs.has(pr.number)) continue;
        seenPrs.add(pr.number);

        const parsed = parseTitle(pr.title);
        if (!parsed) {
          core.info(`Skipping non-conformant PR title: #${pr.number} ${pr.title}`);
          continue;
        }

        if (!categorized[parsed.category]) {
          categorized[parsed.category] = [];
        }

        categorized[parsed.category].push({summary: parsed.summary, pr: pr.number});
      }
    }

    const sections = Object.entries(categorized)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, items]) => {
        const bullets = items
          .sort((x, y) => x.pr - y.pr)
          .map(item => `- ${item.summary} (#${item.pr})`)
          .join('\n');
        return `## ${category}\n${bullets}`;
      });

    const body = sections.length > 0 ? sections.join('\n\n') : 'No categorized changes found.';

    core.setOutput('release-body', body);

    if (dryRun) {
      core.info('Dry run enabled; not creating or updating a release.');
      core.info(body);
      return;
    }

    // Try to update existing release by tag; fallback to create
    let releaseId: number | null = null;
    try {
      const existing = await octokit.rest.repos.getReleaseByTag({owner, repo, tag: refTag});
      releaseId = existing.data.id;
    } catch (error: any) {
      if (error.status !== 404) throw error;
    }

    if (releaseId) {
      await octokit.rest.repos.updateRelease({
        owner,
        repo,
        release_id: releaseId,
        body,
        name: refTag,
        draft: true
      });
      core.info(`Updated existing release for ${refTag}.`);
    } else {
      await octokit.rest.repos.createRelease({
        owner,
        repo,
        tag_name: refTag,
        name: refTag,
        body,
        draft: true
      });
      core.info(`Created draft release for ${refTag}.`);
    }
  } catch (error: any) {
    core.setFailed(error.message ?? String(error));
  }
}

void main();
