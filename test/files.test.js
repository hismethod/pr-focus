// Which changed files of a PR count as tests or noise. Made-up paths only; no real repository data.
const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/rules.js');

const defaults = rules.DEFAULTS;
const kind = (path, settings = defaults, marked = false) => rules.fileNoise(path, settings, marked);

test('test files by name', () => {
  for (const path of [
    'src/login.test.ts',
    'src/login.spec.tsx',
    'apps/api/test.e2e.ts',
    'apps/api/app.e2e-spec.ts',
    'pkg/auth/token_test.go',
    'lib/parser_test.rb',
    'spec/models/user_spec.rb',
    'scripts/test_cleanup.py',
    'scripts/conftest.py',
    'app/src/main/java/com/acme/LoginTest.java',
    'app/src/main/java/com/acme/LoginTests.java',
    'app/LoginTest.kt',
    'Sources/App/LoginTests.swift',
    'src/Acme.Api/LoginTests.cs',
    'src/LoginTest.php',
  ]) {
    assert.equal(kind(path), 'tests', path);
  }
});

test('test files by folder, at any depth', () => {
  for (const path of [
    'src/core/__tests__/gender.ts',
    'test/helpers.js',
    'packages/web/tests/setup.ts',
    'app/src/test/java/com/acme/Helper.java',
    'Tests/AppTests/Support.swift',
    'src/Acme.Api.Tests/Helpers/Builder.cs',
    'e2e/pages/login.ts',
    'cypress/support/commands.js',
    'src/fixtures/user.json',
    'src/__fixtures__/user.json',
    'src/__mocks__/fs.js',
    'pkg/auth/testdata/token.txt',
  ]) {
    assert.equal(kind(path), 'tests', path);
  }
});

test('lockfiles', () => {
  for (const path of [
    'package-lock.json',
    'npm-shrinkwrap.json',
    'pnpm-lock.yaml',
    'apps/web/yarn.lock',
    'bun.lockb',
    'bun.lock',
    'Cargo.lock',
    'go.sum',
    'services/api/poetry.lock',
    'Pipfile.lock',
    'uv.lock',
    'Gemfile.lock',
    'composer.lock',
    'ios/Podfile.lock',
    'App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved',
    'src/Acme.Api/packages.lock.json',
    'gradle.lockfile',
    'infra/.terraform.lock.hcl',
  ]) {
    assert.equal(kind(path), 'lockfiles', path);
  }
});

test('generated files by name and folder', () => {
  for (const path of [
    'src/components/__snapshots__/Button.tsx.snap',
    'src/Button.tsx.snap',
    'public/app.min.js',
    'public/app.min.css',
    'public/app.js.map',
    'dist/index.js',
    'packages/ui/build/index.js',
    'vendor/github.com/acme/lib/lib.go',
    'node_modules/left-pad/index.js',
    'api/v1/user.pb.go',
    'api/v1/user_pb2.py',
    'lib/models/user.g.dart',
    'src/schema.generated.ts',
    'src/routeTree.gen.ts',
    'api/zz_generated.deepcopy.go',
    'api/types_generated.go',
  ]) {
    assert.equal(kind(path), 'generated', path);
  }
});

test('real changes and look-alike names are kept', () => {
  for (const path of [
    'src/login.ts',
    'src/latest.ts',
    'src/contest/rules.py',
    'src/testing.md',
    'src/attest/index.ts',
    'app/src/main/java/com/acme/Latest.java',
    'app/src/main/java/com/acme/Contest.java',
    'src/protest.go',
    'package.json',
    'pnpm-workspace.yaml',
    'src/lock.ts',
    'src/locksmith/open.go',
    'src/distance.ts',
    'src/builder/index.ts',
    'src/vendors.ts',
    'docs/sitemap.md',
    'src/snapshot.ts',
    'README.md',
  ]) {
    assert.equal(kind(path), null, path);
  }
});

test('a file GitHub marks as generated is hidden even when no glob names it', () => {
  assert.equal(kind('src/schema.graphql', defaults, true), 'generated');
  assert.equal(kind('src/schema.graphql', defaults, false), null);
});

test('a file belongs to the first kind it matches', () => {
  assert.equal(kind('src/__tests__/__snapshots__/login.test.ts.snap'), 'tests');
  // GitHub marks lockfiles as generated too.
  assert.equal(kind('pnpm-lock.yaml', defaults, true), 'lockfiles');
});

test('switching a kind off shows its files, also the ones GitHub marks as generated', () => {
  assert.equal(kind('src/login.test.ts', { ...defaults, diffTests: false }), null);
  assert.equal(kind('dist/index.js', { ...defaults, diffGenerated: false }), null);
  assert.equal(kind('src/schema.graphql', { ...defaults, diffGenerated: false }, true), null);
  const noLockfiles = { ...defaults, diffLockfiles: false };
  assert.equal(kind('pnpm-lock.yaml', noLockfiles, true), null);
  // The other kinds are untouched.
  assert.equal(kind('src/login.test.ts', noLockfiles), 'tests');
});

test('custom globs read like .gitignore lines', () => {
  const custom = (diffGlobs) => ({ ...defaults, diffGlobs });
  // No slash: at any depth. * stays inside one path segment.
  assert.equal(kind('docs/guide/intro.md', custom('*.md')), 'custom');
  assert.equal(kind('intro.md', custom('*.md')), 'custom');
  assert.equal(kind('docs/intro.mdx', custom('*.md')), null);
  // A folder covers everything in it.
  assert.equal(kind('packages/web/storybook/Button.stories.tsx', custom('storybook/')), 'custom');
  assert.equal(kind('packages/web/storybook-utils/index.ts', custom('storybook/')), null);
  // A slash anchors the glob to the repository root.
  assert.equal(kind('src/legacy/api/v1/user.ts', custom('src/legacy/**')), 'custom');
  assert.equal(kind('packages/web/src/legacy/user.ts', custom('src/legacy/**')), null);
  assert.equal(kind('docs/intro.md', custom('docs/*.md')), 'custom');
  assert.equal(kind('docs/guide/intro.md', custom('docs/*.md')), null);
  assert.equal(kind('docs/guide/intro.md', custom('docs/**/*.md')), 'custom');
  assert.equal(kind('docs/intro.md', custom('docs/**/*.md')), 'custom');
  assert.equal(kind('README.md', custom('/README.md')), 'custom');
  assert.equal(kind('docs/README.md', custom('/README.md')), null);
  // ? is one character, and the rest is taken literally.
  assert.equal(kind('migrations/001.sql', custom('00?.sql')), 'custom');
  assert.equal(kind('migrations/0010.sql', custom('00?.sql')), null);
  assert.equal(kind('src/a+b(1).txt', custom('a+b(1).txt')), 'custom');
  assert.equal(kind('src/aab1.txt', custom('a+b(1).txt')), null);
});

test('custom globs: a list by line or comma, on top of the built-in kinds', () => {
  const settings = { ...defaults, diffGlobs: ' *.md \n\n docs/, *.stories.tsx ' };
  assert.equal(kind('README.md', settings), 'custom');
  assert.equal(kind('docs/logo.svg', settings), 'custom');
  assert.equal(kind('src/Button.stories.tsx', settings), 'custom');
  assert.equal(kind('src/Button.tsx', settings), null);
  assert.equal(kind('src/Button.test.tsx', settings), 'tests');
  assert.equal(kind('src/Button.tsx', { ...defaults, diffGlobs: '' }), null);
  // A kind that is switched off can still be named by a glob.
  assert.equal(kind('yarn.lock', { ...defaults, diffLockfiles: false, diffGlobs: 'yarn.lock' }), 'custom');
});

test('path from a file header: direction marks stripped, a rename gives the new path', () => {
  assert.equal(rules.headerPath('‎src/login.ts‎'), 'src/login.ts');
  assert.equal(rules.headerPath('src/old/login.ts renamed to src/new/login.test.ts'), 'src/new/login.test.ts');
  assert.equal(rules.headerPath(undefined), '');
});

test('line counts from a file header', () => {
  assert.deepEqual(rules.lineStat('Lines changed: 19 additions & 2 deletions'), { added: 19, deleted: 2 });
  assert.deepEqual(rules.lineStat(' 2 changes: 1 addition & 1 deletion '), { added: 1, deleted: 1 });
  assert.deepEqual(rules.lineStat('Lines changed: 1,204 additions & 0 deletions'), { added: 1204, deleted: 0 });
  assert.deepEqual(rules.lineStat('Binary file'), { added: 0, deleted: 0 });
  assert.deepEqual(rules.lineStat(undefined), { added: 0, deleted: 0 });
});

test('file mode: three choices in a cycle, and anything else counts as all', () => {
  assert.equal(defaults.diffMode, 'all');
  assert.equal(rules.fileMode('sections'), 'sections');
  assert.equal(rules.fileMode('hide'), 'hide');
  for (const value of ['all', '', undefined, true, 'Hide']) assert.equal(rules.fileMode(value), 'all', String(value));
  assert.equal(rules.nextFileMode('all'), 'sections');
  assert.equal(rules.nextFileMode('sections'), 'hide');
  assert.equal(rules.nextFileMode('hide'), 'all');
  assert.equal(rules.nextFileMode(undefined), 'sections');
});

test('files bar text: what is noise, its size, and what is left, in each mode', () => {
  const rest = { files: 14, added: 378, deleted: 239 };
  // Kinds come in a fixed order whatever order the files were met in.
  const kinds = {
    generated: { files: 1, added: 30, deleted: 4 },
    tests: { files: 2, added: 100, deleted: 10 },
    lockfiles: { files: 1, added: 200, deleted: 20 },
  };
  assert.equal(
    rules.filesBarText({ kinds, rest, mode: 'hide' }),
    'PR Focus: 4 files hidden (2 tests, 1 lockfile, 1 generated) · +330 −34 · 14 files left, +378 −239',
  );
  assert.equal(
    rules.filesBarText({ kinds, rest, mode: 'sections' }),
    'PR Focus: 4 files in sections below (2 tests, 1 lockfile, 1 generated) · +330 −34 · 14 files of code first, +378 −239',
  );
  assert.equal(
    rules.filesBarText({ kinds, rest, mode: 'all' }),
    'PR Focus: tests & noise in 4 of 18 files (2 tests, 1 lockfile, 1 generated) · +330 −34',
  );
  assert.equal(
    rules.filesBarText({
      kinds: { tests: { files: 1, added: 5, deleted: 0 }, custom: { files: 2, added: 0, deleted: 0 } },
      rest: { files: 1, added: 1, deleted: 1 },
      mode: 'hide',
    }),
    'PR Focus: 3 files hidden (1 test, 2 custom) · +5 −0 · 1 file left, +1 −1',
  );
});

test('section heading: the kind, its files and its size', () => {
  assert.equal(rules.sectionText('tests', { files: 4, added: 98, deleted: 7 }), 'Tests · 4 files · +98 −7');
  assert.equal(rules.sectionText('lockfiles', { files: 1, added: 193, deleted: 90 }), 'Lockfiles · 1 file · +193 −90');
  assert.equal(rules.sectionText('custom', { files: 2, added: 0, deleted: 0 }), 'Custom · 2 files · +0 −0');
});
