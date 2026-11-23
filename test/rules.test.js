// Made-up PRs only; no real repository data.
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/rules.js');

const defaults = rules.DEFAULTS;
const pr = (fields) => ({ title: 'Add login page', author: 'alice', draft: false, ...fields });

test('bot authors count as bots', () => {
  for (const login of [
    'dependabot[bot]',
    'dependabot',
    'dependabot-preview[bot]',
    'renovate[bot]',
    'Renovate',
    'renovate-bot',
    'github-actions[bot]',
    'github-actions',
    'acme-release-helper[bot]',
  ]) {
    assert.equal(rules.isBot(login), true, login);
  }
});

test('people and look-alike names are not bots', () => {
  for (const login of ['alice', 'botanist', 'robot-fan', 'acme-ci-bot', 'dependabot-fan', '', undefined]) {
    assert.equal(rules.isBot(login), false, String(login));
  }
});

test('default settings hide bots only', () => {
  assert.equal(rules.noiseReason(pr({ author: 'dependabot[bot]' }), defaults), 'bot');
  assert.equal(rules.noiseReason(pr({ draft: true }), defaults), null);
  assert.equal(rules.noiseReason(pr({ title: 'chore(deps): bump x' }), defaults), null);
  assert.equal(rules.noiseReason(pr(), defaults), null);
});

test('turning the bot rule off keeps bot PRs', () => {
  assert.equal(rules.noiseReason(pr({ author: 'renovate[bot]' }), { ...defaults, hideBots: false }), null);
});

test('draft rule hides drafts when on', () => {
  const settings = { ...defaults, hideDrafts: true };
  assert.equal(rules.noiseReason(pr({ draft: true }), settings), 'draft');
  assert.equal(rules.noiseReason(pr({ draft: false }), settings), null);
});

test('title pattern is a case-insensitive regex', () => {
  const settings = { ...defaults, titlePattern: '^chore\\(deps\\)|^bump ' };
  assert.equal(rules.noiseReason(pr({ title: 'Chore(deps): update eslint' }), settings), 'title');
  assert.equal(rules.noiseReason(pr({ title: 'Bump lodash from 1 to 2' }), settings), 'title');
  assert.equal(rules.noiseReason(pr({ title: 'Fix bump animation' }), settings), null);
});

test('an invalid title pattern is ignored instead of throwing', () => {
  assert.equal(rules.titleRegex('(unclosed'), null);
  assert.equal(rules.noiseReason(pr(), { ...defaults, titlePattern: '(unclosed' }), null);
});

test('the first matching rule names the reason', () => {
  const all = { hideBots: true, hideDrafts: true, titlePattern: 'bump' };
  assert.equal(rules.noiseReason(pr({ author: 'dependabot[bot]', draft: true, title: 'Bump x' }), all), 'bot');
  assert.equal(rules.noiseReason(pr({ draft: true, title: 'Bump x' }), all), 'draft');
});

test('Linear keys in titles', () => {
  assert.deepEqual(rules.titleKeys('ENG-123 Fix login'), ['ENG-123']);
  assert.deepEqual(rules.titleKeys('feat: sessions (ENG-7, OPS2-45)'), ['ENG-7', 'OPS2-45']);
  assert.deepEqual(rules.titleKeys('[WEB-9] tidy'), ['WEB-9']);
  assert.deepEqual(rules.titleKeys('Fix UTF-8, SHA-256 and CVE-2024-1234'), []);
  assert.deepEqual(rules.titleKeys('lower case eng-123 is ignored'), []);
  assert.deepEqual(rules.titleKeys('Node 20, ES2020, X-1'), []);
  assert.deepEqual(rules.titleKeys(''), []);
});

test('Linear keys in branch names', () => {
  assert.deepEqual(rules.branchKeys('alice/eng-123-fix-login'), ['ENG-123']);
  assert.deepEqual(rules.branchKeys('eng-45'), ['ENG-45']);
  assert.deepEqual(rules.branchKeys('fork-owner:web-9-tidy'), ['WEB-9']);
  assert.deepEqual(rules.branchKeys('release/v1-2'), []);
  assert.deepEqual(rules.branchKeys('fix/login-page'), []);
  assert.deepEqual(rules.branchKeys('feature/eng-12abc'), []);
  assert.deepEqual(rules.branchKeys('dev'), []);
});

test('Linear issue URLs give the workspace and key', () => {
  assert.deepEqual(rules.parseLinearIssueUrl('https://linear.app/acme/issue/ENG-123/fix-login'), {
    workspace: 'acme',
    key: 'ENG-123',
  });
  assert.deepEqual(rules.parseLinearIssueUrl('https://linear.app/acme/issue/eng-5'), { workspace: 'acme', key: 'ENG-5' });
  assert.equal(rules.parseLinearIssueUrl('https://linear.app/acme/review/some-review'), null);
  assert.equal(rules.parseLinearIssueUrl('https://linear.app/docs'), null);
  assert.equal(rules.parseLinearIssueUrl('https://evil.example/linear.app/acme/issue/ENG-1'), null);
  assert.equal(rules.parseLinearIssueUrl(''), null);
});

test('workspace option accepts a slug or a pasted URL, nothing else', () => {
  assert.equal(rules.workspaceSlug(' acme '), 'acme');
  assert.equal(rules.workspaceSlug('https://linear.app/acme/issue/ENG-1'), 'acme');
  assert.equal(rules.workspaceSlug('https://linear.app/acme-co'), 'acme-co');
  assert.equal(rules.workspaceSlug('acme/../x'), '');
  assert.equal(rules.workspaceSlug('a b'), '');
  assert.equal(rules.workspaceSlug(''), '');
  assert.equal(rules.linearIssueUrl('acme', 'ENG-1'), 'https://linear.app/acme/issue/ENG-1');
});

test('PR page keys: title, head branch, then the first Linear link, deduplicated', () => {
  assert.deepEqual(
    rules.prPageKeys({
      title: 'ENG-1 Fix login',
      branch: 'alice/eng-1-fix-login',
      linearHref: 'https://linear.app/acme/issue/ENG-2/x',
    }),
    ['ENG-1', 'ENG-2'],
  );
  assert.deepEqual(
    rules.prPageKeys({ title: 'Fix login', branch: 'main', linearHref: 'https://linear.app/acme/issue/ENG-9/x' }),
    ['ENG-9'],
  );
  assert.deepEqual(rules.prPageKeys({ title: 'Fix login', branch: '', linearHref: '' }), []);
  assert.equal(rules.prPageKeys({ title: 'A-1 AB-1 AB-2 AB-3 AB-4', branch: '', linearHref: '' }).length, 3);
});
