// Pure rule logic, no DOM. Loaded by the content script, the options page and the unit tests.
const prFocus = (() => {
  const DEFAULTS = { hideBots: true, hideDrafts: true, titlePattern: '', linearWorkspace: '', linearTeams: '' };

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
