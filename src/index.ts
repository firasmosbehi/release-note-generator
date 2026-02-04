import * as core from '@actions/core';
import * as github from '@actions/github';
import {Octokit} from '@octokit/rest';
import {buildCategoryMap, parseTitle, CategoryMap} from './parser';
import {renderBody, Categorized} from './renderer';

export async function findPreviousTag(octokit: Octokit & {paginate?: Octokit['paginate']}, owner: string, repo: string, currentTag: string): Promise<string | null> {
  const tags = await (octokit.paginate
    ? octokit.paginate(octokit.repos.listTags, {owner, repo, per_page: 100})
    : (await octokit.repos.listTags({owner, repo, per_page: 100})).data);

  const idx = tags.findIndex((tag: any) => tag.name === currentTag);
  if (idx === -1) return null;
  const prev = tags[idx + 1];
  return prev ? prev.name : null;
}

export async function findBranchRoot(octokit: Octokit, owner: string, repo: string, branch: string): Promise<string> {
  let page = 1;
  let lastSha = '';
  let hasMore = true;

  // listCommits returns newest-first; walk pages until the oldest commit is reached.
  while (hasMore) {
    const {data: commits} = await octokit.repos.listCommits({owner, repo, sha: branch, per_page: 100, page});
    if (commits.length === 0) break;
    lastSha = commits[commits.length - 1].sha;
    if (commits.length < 100) {
      hasMore = false;
    } else {
      page += 1;
    }
  }

  return lastSha;
}

export async function collectCategorizedPRs(octokit: Octokit, owner: string, repo: string, base: string, head: string, categoryMap: CategoryMap): Promise<Categorized> {
  const {data: comparison} = await octokit.rest.repos.compareCommits({owner, repo, base, head});

  const seenPrs = new Set<number>();
  const categorized: Categorized = {};

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

      const parsed = parseTitle(pr.title, categoryMap);
      if (!parsed) {
        core.info(`Skipping non-conformant PR title: #${pr.number} ${pr.title}`);
        continue;
      }

      if (!categorized[parsed.category]) categorized[parsed.category] = [];
      categorized[parsed.category].push({summary: parsed.summary, pr: pr.number, category: parsed.category});
    }
  }

  return categorized;
}

export async function main(): Promise<void> {
  try {
    const token = core.getInput('github-token', {required: true});
    const explicitTag = core.getInput('tag');
    const dryRun = core.getBooleanInput('dry-run');
    const categoryOverride = core.getInput('category-map');
    const template = core.getInput('template') || '{{sections}}';
    const emptyMessage = core.getInput('empty-message') || 'No categorized changes found.';
    const headingLevel = Number(core.getInput('heading-level') || '2');
    const overrideBase = core.getInput('base');
    const overrideHead = core.getInput('head');

    const ctx = github.context;
    const {owner, repo} = ctx.repo;
    const refTag = explicitTag || ctx.ref.replace('refs/tags/', '');

    const octokit = github.getOctokit(token);

    if (!refTag) {
      core.setFailed('No tag provided or found in context.');
      return;
    }

    const categoryMap = buildCategoryMap(categoryOverride);

    const previousTag = await findPreviousTag(octokit, owner, repo, refTag);
    core.info(`Current tag: ${refTag}`);
    core.info(`Previous tag: ${previousTag ?? 'none (initial release)'}`);

    // Determine comparison base
    const compareBase = overrideBase || (previousTag
      ? previousTag
      : await findBranchRoot(octokit, owner, repo, (await octokit.repos.get({owner, repo})).data.default_branch));

    const compareHead = overrideHead || refTag;

    if (!compareBase || !compareHead) {
      core.setFailed('Comparison base and head must be defined.');
      return;
    }

    const categorized = await collectCategorizedPRs(octokit, owner, repo, compareBase, compareHead, categoryMap);

    const body = renderBody(categorized, {
      headingLevel: Number.isFinite(headingLevel) && headingLevel >= 1 ? headingLevel : 2,
      emptyMessage,
      template,
      tag: refTag,
      previousTag
    });

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

if (process.env.NODE_ENV !== 'test') {
  void main();
}
