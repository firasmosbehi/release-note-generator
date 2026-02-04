import {describe, it, expect, beforeEach, vi} from 'vitest';

vi.mock('@actions/core', () => {
  const inputs: Record<string, string> = {};
  const bools: Record<string, boolean> = {};
  return {
    getInput: vi.fn((name: string) => inputs[name] ?? ''),
    getBooleanInput: vi.fn((name: string) => Boolean(bools[name])),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
    __setInputs: (vals: Record<string, string>) => Object.assign(inputs, vals),
    __setBoolInputs: (vals: Record<string, boolean>) => Object.assign(bools, vals),
    __reset: () => {
      for (const key of Object.keys(inputs)) delete inputs[key];
      for (const key of Object.keys(bools)) delete bools[key];
    }
  };
});

vi.mock('@actions/github', () => {
  const context = {
    repo: {owner: 'owner', repo: 'repo'},
    ref: 'refs/tags/v1.1.0'
  };
  const mockOctokit = {
    repos: {
      listTags: vi.fn(),
      get: vi.fn()
    },
    rest: {
      repos: {
        compareCommits: vi.fn(),
        listPullRequestsAssociatedWithCommit: vi.fn(),
        getReleaseByTag: vi.fn(),
        updateRelease: vi.fn(),
        createRelease: vi.fn()
      }
    }
  };
  return {
    context,
    getOctokit: vi.fn(() => mockOctokit),
    __setContext: (vals: Partial<typeof context>) => Object.assign(context, vals),
    __octokit: mockOctokit
  };
});

import * as core from '@actions/core';
import * as github from '@actions/github';
import {main, findPreviousTag, collectCategorizedPRs, findBranchRoot} from '../src/index';

type CoreMock = typeof core & {
  __setInputs: (vals: Record<string, string>) => void;
  __setBoolInputs: (vals: Record<string, boolean>) => void;
  __reset: () => void;
};

type GitHubMock = typeof github & {
  __setContext: (vals: Partial<typeof github.context>) => void;
  __octokit: any;
};

const coreMock = core as CoreMock;
const githubMock = github as GitHubMock;

beforeEach(() => {
  coreMock.__reset();
  vi.clearAllMocks();
  githubMock.__setContext({repo: {owner: 'owner', repo: 'repo'}, ref: 'refs/tags/v1.1.0'});
});

describe('findPreviousTag', () => {
  it('returns the previous tag when found', async () => {
    githubMock.__octokit.repos.listTags.mockResolvedValue({
      data: [{name: 'v1.1.0'}, {name: 'v1.0.0'}]
    });
    const previous = await findPreviousTag(githubMock.__octokit as any, 'owner', 'repo', 'v1.1.0');
    expect(previous).toBe('v1.0.0');
  });

  it('paginates when paginate is available', async () => {
    const paginateMock = vi.fn().mockResolvedValue([
      {name: 'v2.0.0'},
      {name: 'v1.1.0'},
      {name: 'v1.0.0'}
    ]);
    const octo = {...githubMock.__octokit, paginate: paginateMock};
    const previous = await findPreviousTag(octo as any, 'owner', 'repo', 'v1.1.0');
    expect(previous).toBe('v1.0.0');
    expect(paginateMock).toHaveBeenCalled();
  });
});

describe('findBranchRoot', () => {
  it('returns the oldest commit sha of the branch', async () => {
    githubMock.__octokit.repos.listCommits = vi.fn()
      .mockResolvedValueOnce({data: Array.from({length: 100}, (_, i) => ({sha: `sha-${i}`}))})
      .mockResolvedValueOnce({data: [{sha: 'oldest'}]});

    const sha = await findBranchRoot(githubMock.__octokit as any, 'owner', 'repo', 'main');
    expect(sha).toBe('oldest');
  });
});

describe('collectCategorizedPRs', () => {
  it('groups merged PRs by category and ignores duplicates/non-conformant titles', async () => {
    githubMock.__octokit.rest.repos.compareCommits.mockResolvedValue({
      data: {commits: [{sha: 'a'}, {sha: 'b'}]}
    });
    githubMock.__octokit.rest.repos.listPullRequestsAssociatedWithCommit
      .mockResolvedValueOnce({
        data: [
          {number: 1, title: 'feat: add foo', state: 'closed', merged_at: 'x'},
          {number: 2, title: 'bad title', state: 'closed', merged_at: 'x'}
        ]
      })
      .mockResolvedValueOnce({
        data: [
          {number: 1, title: 'feat: add foo', state: 'closed', merged_at: 'x'},
          {number: 3, title: 'fix: patch bug', state: 'closed', merged_at: 'x'}
        ]
      });

    const categorized = await collectCategorizedPRs(
      githubMock.__octokit as any,
      'owner',
      'repo',
      'main',
      'v1.1.0',
      {feat: 'Features', fix: 'Fixes'}
    );

    expect(categorized.Features).toHaveLength(1);
    expect(categorized.Fixes).toHaveLength(1);
    expect(categorized.Features[0].pr).toBe(1);
  });
});

describe('main', () => {
  const baseTags = [{name: 'v1.1.0'}, {name: 'v1.0.0'}];

  const setupCommonMocks = () => {
    githubMock.__octokit.repos.listTags.mockResolvedValue({data: baseTags});
    githubMock.__octokit.repos.get.mockResolvedValue({data: {default_branch: 'main'}});
    githubMock.__octokit.rest.repos.compareCommits.mockResolvedValue({
      data: {commits: [{sha: 'c1'}]}
    });
    githubMock.__octokit.rest.repos.listPullRequestsAssociatedWithCommit.mockResolvedValue({
      data: [{number: 10, title: 'feat: add api', state: 'closed', merged_at: '2026-01-01'}]
    });
  };

  it('sets output and skips release when dry-run is true', async () => {
    setupCommonMocks();
    githubMock.__octokit.rest.repos.getReleaseByTag.mockResolvedValue({data: {id: 99}});
    coreMock.__setInputs({'github-token': 'token', template: '{{sections}}'});
    coreMock.__setBoolInputs({'dry-run': true});

    await main();

    expect(core.setOutput).toHaveBeenCalledWith('release-body', expect.stringContaining('Features'));
    expect(githubMock.__octokit.rest.repos.updateRelease).not.toHaveBeenCalled();
    expect(githubMock.__octokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it('updates an existing release when found', async () => {
    setupCommonMocks();
    githubMock.__octokit.rest.repos.getReleaseByTag.mockResolvedValue({data: {id: 7}});
    coreMock.__setInputs({'github-token': 'token', template: '{{sections}}', 'dry-run': 'false'});
    coreMock.__setBoolInputs({'dry-run': false});

    await main();

    expect(githubMock.__octokit.rest.repos.updateRelease).toHaveBeenCalledWith(
      expect.objectContaining({release_id: 7})
    );
    expect(githubMock.__octokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it('uses override base and head when provided', async () => {
    setupCommonMocks();
    githubMock.__octokit.rest.repos.getReleaseByTag.mockRejectedValue({status: 404});
    coreMock.__setInputs({
      'github-token': 'token',
      base: 'custom-base',
      head: 'custom-head'
    });
    coreMock.__setBoolInputs({'dry-run': false});

    await main();

    expect(githubMock.__octokit.rest.repos.compareCommits).toHaveBeenCalledWith(
      expect.objectContaining({base: 'custom-base', head: 'custom-head'})
    );
  });

  it('creates a release when none exists', async () => {
    setupCommonMocks();
    githubMock.__octokit.rest.repos.getReleaseByTag.mockRejectedValue({status: 404});
    coreMock.__setInputs({'github-token': 'token'});
    coreMock.__setBoolInputs({'dry-run': false});

    await main();

    expect(githubMock.__octokit.rest.repos.createRelease).toHaveBeenCalledWith(
      expect.objectContaining({tag_name: 'v1.1.0'})
    );
  });
});
