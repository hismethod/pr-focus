// Pure rule logic, no DOM. Loaded by the content script, the options page and the unit tests.
const prFocus = (() => {
  const DEFAULTS = {
    hideBots: true,
    hideDrafts: true,
    titlePattern: '',
    linearWorkspace: '',
    linearTeams: '',
    // A PR's changed files. diffMode is the All / Sections choice; the rest say what counts as noise.
    diffMode: 'sections',
    diffTests: true,
    diffLockfiles: true,
    diffGenerated: true,
    diffGlobs: '',
  };

  const BOT_LOGINS = ['dependabot', 'dependabot-preview', 'renovate', 'renovate-bot', 'github-actions'];

  function isBot(author) {
    const login = (author || '').trim().toLowerCase();
    return login.endsWith('[bot]') || BOT_LOGINS.includes(login);
  }

  // Case-insensitive RegExp, or null when the pattern is empty or invalid.
  function titleRegex(pattern) {
    if (!pattern) return null;
    try {
      return new RegExp(pattern, 'i');
    } catch {
      return null;
    }
  }

  // Why a PR row counts as noise under these settings ('bot' | 'draft' | 'title'), or null to keep it.
  // viewer is the signed-in login. A draft is hidden only when its author is known and is someone else,
  // so the viewer's own drafts always stay.
  function noiseReason(pr, settings, viewer) {
    if (settings.hideBots && isBot(pr.author)) return 'bot';
    const others = pr.author && pr.author.toLowerCase() !== (viewer || '').toLowerCase();
    if (settings.hideDrafts && pr.draft && others) return 'draft';
    const re = titleRegex(settings.titlePattern);
    if (re && re.test(pr.title || '')) return 'title';
    return null;
  }

  // Login in an author link's search query: "is:pr state:open author:dependabot[bot]" -> "dependabot[bot]".
  const authorInQuery = (query) => (/(?:^|\s)author:(\S+)/.exec(query || '') || [])[1] || '';

  // Author of a dashboard row that has no author link, from the row's text outside the title:
  // "owner/repo#123 • author • Updated ..." (inbox) or "owner/repo#123 · author opened ..." (search).
  // The owner/repo#123 part is required, so a title like "Fix #1 • dependabot • typo" cannot name the author.
  const ROW_AUTHOR = /[\w.-]+\/[\w.-]+\s*#\s*\d+\s*[•·]\s*([^\s•·]+)\s*(?:[•·]|opened\b)/;
  const authorFromRowText = (text) => (ROW_AUTHOR.exec(text || '') || [])[1] || '';

  const REASON_LABEL = { bot: 'bot', draft: 'draft', title: 'title match' };

  // Text of the count bar. counts is { reason: rows }; selected of those rows are ticked and so stay visible.
  function barText({ counts, selected, showHidden }) {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const prs = (n) => `${n} PR${n === 1 ? '' : 's'}`;
    let state = `${prs(total)} hidden`;
    if (showHidden) state = `${prs(total)} shown dimmed`;
    else if (selected >= total) state = `${prs(total)} shown because selected`;
    else if (selected) state = `${prs(total - selected)} hidden, ${selected} shown because selected`;
    const detail = Object.entries(counts).map(([reason, n]) => `${n} ${REASON_LABEL[reason]}`);
    return `PR Focus: ${state} (${detail.join(', ')})`;
  }

  // Kinds of noise among a PR's changed files, in the order they are tried, each with its settings key and globs.
  const FILE_KINDS = {
    tests: {
      setting: 'diffTests',
      globs: [
        ...['*.test.*', '*.spec.*', '*.e2e.*', '*.e2e-spec.*', '*_test.*', 'test_*.py', 'conftest.py', '*_spec.rb'],
        ...['*Test.java', '*Tests.java', '*Test.kt', '*Tests.kt', '*Tests.swift', '*Test.cs', '*Tests.cs', '*Test.php'],
        ...['__tests__/', 'test/', 'tests/', 'Tests/', '*.Tests/', 'e2e/', 'cypress/'],
        ...['fixtures/', '__fixtures__/', '__mocks__/', 'testdata/'],
      ],
    },
    lockfiles: {
      setting: 'diffLockfiles',
      globs: [
        // *.lock: yarn, Cargo, poetry, Gemfile, composer, Podfile, Pipfile, uv, bun, deno, flake, mix, pubspec.
        ...['*.lock', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'bun.lockb', 'go.sum'],
        ...['Package.resolved', 'packages.lock.json', 'gradle.lockfile', '.terraform.lock.hcl'],
      ],
    },
    generated: {
      setting: 'diffGenerated',
      globs: [
        ...['__snapshots__/', '*.snap', '*.min.js', '*.min.css', '*.map', 'dist/', 'build/', 'vendor/', 'node_modules/'],
        ...['*.pb.go', '*_pb2.py', '*.g.dart', '*.generated.*', '*.gen.*', '*_generated.*'],
      ],
    },
  };

  const GLOB_PART = new Map([
    ['**/', '(?:.*/)?'],
    ['**', '.*'],
    ['*', '[^/]*'],
    ['?', '[^/]'],
  ]);

  // One glob as RegExp source over a repository path, read like a .gitignore line: * stays inside a path segment,
  // ** crosses segments, a glob without a slash matches at any depth, and a folder covers everything in it.
  function globSource(glob) {
    const anchored = glob.replace(/\/$/, '').includes('/');
    const body = glob
      .replace(/^\/|\/$/g, '')
      .split(/(\*\*\/|\*\*|\*|\?)/)
      .map((part) => GLOB_PART.get(part) ?? part.replace(/[.+^${}()|[\]\\]/g, '\\$&'))
      .join('');
    return `${anchored ? '^' : '(?:^|/)'}${body}(?:/|$)`;
  }

  // "*.md, docs/" or one glob per line -> ['*.md', 'docs/']
  const globList = (input) => (input || '').split(/[\n,]+/).map((glob) => glob.trim()).filter(Boolean);

  // Globs -> one RegExp, or null for an empty list.
  const globRegex = (globs) => (globs.length ? new RegExp(globs.map(globSource).join('|')) : null);

  for (const kind of Object.values(FILE_KINDS)) kind.re = globRegex(kind.globs);

  // The custom globs option compiled once per value: every file of a diff is tried on every pass.
  let customInput;
  let customRe;
  function customGlobs(input) {
    if (input !== customInput) [customInput, customRe] = [input, globRegex(globList(input))];
    return customRe;
  }

  const builtIn = new Map();

  // Which kind of noise a changed file is under these settings ('tests' | 'lockfiles' | 'generated', or 'custom'
  // for the user's own globs), or null for code. marked: GitHub itself collapsed the file as generated.
  // A file belongs to the first kind it matches, so switching that kind off shows it even when GitHub marks it.
  function fileNoise(path, settings, marked) {
    // The built-in kind of a path never changes, and every file of a diff is asked about on every pass.
    if (!builtIn.has(path)) builtIn.set(path, Object.keys(FILE_KINDS).find((name) => FILE_KINDS[name].re.test(path)));
    const kind = builtIn.get(path) || (marked ? 'generated' : null);
    if (kind && settings[FILE_KINDS[kind].setting]) return kind;
    return customGlobs(settings.diffGlobs)?.test(path) ? 'custom' : null;
  }

  // Path in a file header of the diff: GitHub wraps it in direction marks and writes a rename as "old renamed to new".
  const headerPath = (text) =>
    (text || '')
      .replace(/[‎‏]/g, '')
      .trim()
      .replace(/^.* renamed to /, '');

  // "Lines changed: 19 additions & 2 deletions" or "21 changes: 19 additions & 2 deletions" -> { added: 19, deleted: 2 }.
  // Zeros when the text carries no counts (a binary file).
  function lineStat(text) {
    const m = /([\d,]+) additions? & ([\d,]+) deletions?/.exec(text || '');
    const number = (digits) => Number(digits.replace(/,/g, ''));
    return m ? { added: number(m[1]), deleted: number(m[2]) } : { added: 0, deleted: 0 };
  }

  // How a PR's changed files are shown: as GitHub shows them, or in sections with the code first and each kind of
  // noise below it. Anything else that reaches the setting counts as the default.
  const FILE_MODE_LABEL = { all: 'All', sections: 'Sections' };
  const FILE_MODES = Object.keys(FILE_MODE_LABEL);
  const fileMode = (value) => (FILE_MODES.includes(value) ? value : DEFAULTS.diffMode);
  const nextFileMode = (value) => FILE_MODES[(FILE_MODES.indexOf(fileMode(value)) + 1) % FILE_MODES.length];

  // The order sections come in: the code, then each kind of noise.
  const SECTION_KINDS = ['code', ...Object.keys(FILE_KINDS), 'custom'];

  // The files of one section as a folder tree like GitHub's own: [{ name, path, children } | { file }], folders
  // before files, both in the order met. file gains its name. A chain of folders that hold nothing but the next
  // folder is one node, as in GitHub's tree: name is "src/modules/core" and path the whole path of its last folder.
  function fileTree(files) {
    const root = { dirs: new Map(), files: [] };
    for (const file of files) {
      const parts = file.path.split('/');
      let node = root;
      for (const part of parts.slice(0, -1)) {
        if (!node.dirs.has(part)) node.dirs.set(part, { dirs: new Map(), files: [] });
        node = node.dirs.get(part);
      }
      node.files.push({ ...file, name: parts[parts.length - 1] });
    }
    const build = (node, prefix) => [
      ...[...node.dirs].map(([name, inside]) => {
        while (inside.dirs.size === 1 && !inside.files.length) {
          const [[next, deeper]] = inside.dirs;
          name += `/${next}`;
          inside = deeper;
        }
        return { name, path: prefix + name, children: build(inside, `${prefix}${name}/`) };
      }),
      ...node.files.map((file) => ({ file })),
    ];
    return build(root, '');
  }

  // A PR's files grouped for Sections mode. files is [{ path, kind, added, deleted, ... }] in GitHub's order, kind
  // being 'code' or a kind of noise. Returns the sections that have files, in the order above:
  // [{ kind, files, added, deleted, tree }], tree being fileTree() of the section's files.
  function fileSections(files) {
    return SECTION_KINDS.map((kind) => {
      const own = files.filter((file) => file.kind === kind);
      const section = { kind, files: own.length, added: 0, deleted: 0, tree: fileTree(own) };
      for (const file of own) {
        section.added += file.added;
        section.deleted += file.deleted;
      }
      return section;
    }).filter((section) => section.files);
  }

  const fileCount = (n) => `${n} file${n === 1 ? '' : 's'}`;
  const lineCount = ({ added, deleted }) => `+${added} −${deleted}`;

  // Text of the bar above a PR's changed files, from the sections fileSections() returns.
  function filesBarText(sections, mode) {
    const code = sections.find((section) => section.kind === 'code') || { files: 0, added: 0, deleted: 0 };
    const kinds = sections.filter((section) => section.kind !== 'code');
    const noise = { files: 0, added: 0, deleted: 0 };
    for (const kind of kinds) for (const key of Object.keys(noise)) noise[key] += kind[key];
    const detail = kinds.map(({ kind, files }) => `${files} ${files === 1 ? kind.replace(/s$/, '') : kind}`);
    const what = `(${detail.join(', ')}) · ${lineCount(noise)}`;
    if (mode === 'sections')
      return `PR Focus: ${fileCount(noise.files)} in sections below ${what} · ${fileCount(code.files)} of code first, ${lineCount(code)}`;
    return `PR Focus: tests & noise in ${noise.files} of ${fileCount(noise.files + code.files)} ${what}`;
  }

  // Heading of one section: "Tests · 4 files · +98 −7".
  const sectionText = ({ kind, files, added, deleted }) =>
    `${kind[0].toUpperCase()}${kind.slice(1)} · ${fileCount(files)} · ${lineCount({ added, deleted })}`;

  // Prefixes that look like issue keys but never are. Not used when the team keys option lists the real ones.
  const NOT_KEYS = new Set([
    ...['CVE', 'GHSA', 'HTTP', 'ISO', 'PEP', 'RFC', 'SHA', 'TLS', 'UTF'],
    ...['BUGFIX', 'FEATURE', 'FIX', 'HOTFIX', 'RELEASE'],
  ]);
  // Titles: upper-case keys like ENG-123.
  const TITLE_KEY = /\b([A-Z]{2}[A-Z0-9]{0,5})-(\d+)\b/g;
  // Branches: Linear's own form at the start of a path segment, "eng-123" or "eng-123-some-title".
  // A version such as "eslint-9.x" or "lodash-4.17.21" is not one.
  const BRANCH_KEY = /(?:^|[/:])([a-z]{2}[a-z0-9]{0,5})-(\d+)(?=-|$)/gi;

  // Team keys option: "ENG, ops" -> Set { 'ENG', 'OPS' }. An empty set means any key.
  const teamKeys = (input) => new Set((input || '').toUpperCase().split(/[\s,]+/).filter(Boolean));

  function keysIn(text, re, teams) {
    return [...(text || '').matchAll(re)]
      .filter((m) => (teams?.size ? teams.has(m[1].toUpperCase()) : !NOT_KEYS.has(m[1].toUpperCase())))
      .map((m) => `${m[1]}-${m[2]}`.toUpperCase());
  }

  const titleKeys = (title, teams) => keysIn(title, TITLE_KEY, teams);
  const branchKeys = (branch, teams) => keysIn(branch, BRANCH_KEY, teams);

  // https://linear.app/<workspace>/issue/<KEY>/... -> { workspace, key }
  function parseLinearIssueUrl(href) {
    const m = /^https:\/\/linear\.app\/([\w-]+)\/issue\/([A-Za-z0-9]+-\d+)(?:[/?#]|$)/.exec(href || '');
    return m ? { workspace: m[1], key: m[2].toUpperCase() } : null;
  }

  // Accepts "acme" or a pasted "https://linear.app/acme/..." URL; returns '' for anything else.
  function workspaceSlug(input) {
    const value = (input || '').trim();
    const fromUrl = /^https?:\/\/linear\.app\/([\w-]+)/.exec(value);
    const slug = fromUrl ? fromUrl[1] : value;
    return /^[\w-]+$/.test(slug) ? slug : '';
  }

  const linearIssueUrl = ({ workspace, key }) => `https://linear.app/${workspace}/issue/${key}`;

  const uniqueByKey = (issues) => issues.filter((issue, i) => issues.findIndex((x) => x.key === issue.key) === i);

  // Linear issues to link from a PR list row: the keys in its title, in the workspace from the option.
  function rowIssues(title, settings) {
    const workspace = workspaceSlug(settings.linearWorkspace);
    if (!workspace) return [];
    return uniqueByKey(titleKeys(title, teamKeys(settings.linearTeams)).map((key) => ({ workspace, key })));
  }

  // Linear issues to link from a PR page, at most three: title keys, head-branch keys, then the page's Linear link.
  // Title and branch keys use the workspace from the option, and the link's workspace only when the option is empty:
  // a link in the PR body must not redirect them. The linked issue keeps the workspace of its own link.
  function prPageIssues({ title, branch, linearHref }, settings) {
    const linked = parseLinearIssueUrl(linearHref);
    const teams = teamKeys(settings.linearTeams);
    const workspace = workspaceSlug(settings.linearWorkspace) || linked?.workspace || '';
    const named = workspace ? [...titleKeys(title, teams), ...branchKeys(branch, teams)] : [];
    const issues = named.map((key) => ({ workspace, key }));
    if (linked) issues.push(linked);
    return uniqueByKey(issues).slice(0, 3);
  }

  return {
    DEFAULTS,
    isBot,
    titleRegex,
    noiseReason,
    authorInQuery,
    authorFromRowText,
    barText,
    fileNoise,
    headerPath,
    lineStat,
    FILE_MODE_LABEL,
    fileMode,
    nextFileMode,
    fileSections,
    filesBarText,
    sectionText,
    teamKeys,
    titleKeys,
    branchKeys,
    parseLinearIssueUrl,
    workspaceSlug,
    linearIssueUrl,
    rowIssues,
    prPageIssues,
  };
})();

if (typeof module !== 'undefined') module.exports = prFocus;
