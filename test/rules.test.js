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

test('author from an author link query', () => {
  assert.equal(rules.authorInQuery('is:pr state:open author:dependabot[bot]'), 'dependabot[bot]');
  assert.equal(rules.authorInQuery('author:alice is:open'), 'alice');
  assert.equal(rules.authorInQuery('is:pr coauthor:alice'), '');
  assert.equal(rules.authorInQuery(null), '');
});

test('author from dashboard row text', () => {
  assert.equal(rules.authorFromRowText('acme/web#123 • dependabot[bot] • Updated Nov 4'), 'dependabot[bot]');
  assert.equal(rules.authorFromRowText('acme/web#123·alice opened Nov 4, 2026·2 tasks'), 'alice');
  assert.equal(rules.authorFromRowText('acme-co/my.repo #7 · bob opened yesterday'), 'bob');
  assert.equal(rules.authorFromRowText(''), '');
});

test('a PR title cannot name the row author', () => {
  // The reader passes the row text without the title; even with it, the owner/repo#123 form is required.
  assert.equal(rules.authorFromRowText('Fix #1 • dependabot • typo'), '');
  assert.equal(rules.authorFromRowText('Fix #1 • dependabot • typo acme/web#9 • alice • Updated'), 'alice');
});

test('default settings hide bots and drafts', () => {
  assert.equal(rules.noiseReason(pr({ author: 'dependabot[bot]' }), defaults), 'bot');
  assert.equal(rules.noiseReason(pr({ draft: true }), defaults), 'draft');
  assert.equal(rules.noiseReason(pr({ title: 'chore(deps): bump x' }), defaults), null);
  assert.equal(rules.noiseReason(pr(), defaults), null);
});

test('turning the bot rule off keeps bot PRs', () => {
  assert.equal(rules.noiseReason(pr({ author: 'renovate[bot]' }), { ...defaults, hideBots: false }), null);
});

test("the viewer's own drafts are never hidden", () => {
  assert.equal(rules.noiseReason(pr({ draft: true, author: 'alice' }), defaults, 'alice'), null);
  assert.equal(rules.noiseReason(pr({ draft: true, author: 'Alice' }), defaults, 'alice'), null);
  assert.equal(rules.noiseReason(pr({ draft: true, author: 'bob' }), defaults, 'alice'), 'draft');
  // Signed out: everyone else's drafts are still hidden.
  assert.equal(rules.noiseReason(pr({ draft: true, author: 'bob' }), defaults, ''), 'draft');
});

test('a draft whose author could not be read is kept', () => {
  assert.equal(rules.noiseReason(pr({ draft: true, author: '' }), defaults, 'alice'), null);
});

test('turning the draft rule off keeps draft PRs', () => {
  assert.equal(rules.noiseReason(pr({ draft: true }), { ...defaults, hideDrafts: false }), null);
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

test('versions and work-type prefixes in branch names are not Linear keys', () => {
  for (const branch of [
    'renovate/eslint-9.x',
    'renovate/node-20.x',
    'dependabot/npm_and_yarn/lodash-4.17.21',
    'hotfix-3',
    'release-1',
    'feature-2-login',
    'alice/eng-12_fix',
  ]) {
    assert.deepEqual(rules.branchKeys(branch), [], branch);
  }
});

test('team keys option limits which prefixes count as keys', () => {
  const teams = rules.teamKeys(' eng, ops2  web');
  assert.deepEqual([...teams], ['ENG', 'OPS2', 'WEB']);
  assert.deepEqual(rules.titleKeys('KAFKA-12345: [SPARK-4501][SQL] ENG-7 and GPT-4', teams), ['ENG-7']);
  assert.deepEqual(rules.branchKeys('alice/ops2-45-fix', teams), ['OPS2-45']);
  assert.deepEqual(rules.branchKeys('alice/abc-45-fix', teams), []);
  // Listing a prefix from the built-in deny list turns it into a key.
  assert.deepEqual(rules.titleKeys('FIX-12 login', rules.teamKeys('fix')), ['FIX-12']);
  // No team keys: any key of that form.
  assert.deepEqual(rules.titleKeys('KAFKA-12345 ENG-7', rules.teamKeys('')), ['KAFKA-12345', 'ENG-7']);
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
  assert.equal(rules.linearIssueUrl({ workspace: 'acme', key: 'ENG-1' }), 'https://linear.app/acme/issue/ENG-1');
});

const linear = (fields) => ({ ...defaults, ...fields });
const urls = (issues) => issues.map(rules.linearIssueUrl);

test('list row issues: title keys in the workspace from the option', () => {
  assert.deepEqual(rules.rowIssues('ENG-1 and ENG-1 again (OPS-2)', linear({ linearWorkspace: 'acme' })), [
    { workspace: 'acme', key: 'ENG-1' },
    { workspace: 'acme', key: 'OPS-2' },
  ]);
  assert.deepEqual(rules.rowIssues('ENG-1 (OPS-2)', linear({ linearWorkspace: 'acme', linearTeams: 'ops' })), [
    { workspace: 'acme', key: 'OPS-2' },
  ]);
  assert.deepEqual(rules.rowIssues('ENG-1', linear({})), []);
});

test('PR page issues: title, head branch, then the Linear link, deduplicated, at most three', () => {
  const settings = linear({ linearWorkspace: 'acme' });
  assert.deepEqual(
    urls(
      rules.prPageIssues(
        { title: 'ENG-1 Fix login', branch: 'alice/eng-1-fix-login', linearHref: 'https://linear.app/acme/issue/ENG-2/x' },
        settings,
      ),
    ),
    ['https://linear.app/acme/issue/ENG-1', 'https://linear.app/acme/issue/ENG-2'],
  );
  assert.deepEqual(rules.prPageIssues({ title: 'Fix login', branch: '', linearHref: '' }, settings), []);
  assert.equal(rules.prPageIssues({ title: 'AB-1 AB-2 AB-3 AB-4', branch: '', linearHref: '' }, settings).length, 3);
});

test('PR page issues: the workspace option wins over a link on the page for title and branch keys', () => {
  const pr = { title: 'ENG-12 Fix login', branch: 'main', linearHref: 'https://linear.app/vendor/issue/VEN-4/x' };
  assert.deepEqual(urls(rules.prPageIssues(pr, linear({ linearWorkspace: 'acme' }))), [
    'https://linear.app/acme/issue/ENG-12',
    'https://linear.app/vendor/issue/VEN-4',
  ]);
  // No workspace option: the page link's workspace is all there is.
  assert.deepEqual(urls(rules.prPageIssues(pr, linear({}))), [
    'https://linear.app/vendor/issue/ENG-12',
    'https://linear.app/vendor/issue/VEN-4',
  ]);
  // Neither: no button for the title key.
  assert.deepEqual(rules.prPageIssues({ ...pr, linearHref: '' }, linear({})), []);
});

test('PR page issues: the linked issue shows even when team keys leave out its prefix', () => {
  const pr = { title: 'ENG-12 KAFKA-9', branch: '', linearHref: 'https://linear.app/acme/issue/OPS-3/x' };
  assert.deepEqual(urls(rules.prPageIssues(pr, linear({ linearWorkspace: 'acme', linearTeams: 'ENG' }))), [
    'https://linear.app/acme/issue/ENG-12',
    'https://linear.app/acme/issue/OPS-3',
  ]);
});
