// Pure rule logic, no DOM. Loaded by the content script, the options page and the unit tests.
const prFocus = (() => {
  const DEFAULTS = { hideBots: true, hideDrafts: true, titlePattern: '', linearWorkspace: '' };

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

  // shortcut: prefixes that look like issue keys but never are; add a "team keys" option if false positives remain.
  const NOT_KEYS = new Set(['CVE', 'GHSA', 'HTTP', 'ISO', 'PEP', 'RFC', 'SHA', 'TLS', 'UTF']);
  // Titles: upper-case keys like ENG-123. Branches: Linear's own lower-case form, at the start of a path segment.
  const TITLE_KEY = /\b([A-Z]{2}[A-Z0-9]{0,5})-(\d+)\b/g;
  const BRANCH_KEY = /(?:^|[/:])([a-z]{2}[a-z0-9]{0,5})-(\d+)(?![a-z0-9])/gi;

  function keysIn(text, re) {
    return [...(text || '').matchAll(re)]
      .map((m) => `${m[1]}-${m[2]}`.toUpperCase())
      .filter((key) => !NOT_KEYS.has(key.split('-')[0]));
  }

  const titleKeys = (title) => keysIn(title, TITLE_KEY);
  const branchKeys = (branch) => keysIn(branch, BRANCH_KEY);

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

  const linearIssueUrl = (workspace, key) => `https://linear.app/${workspace}/issue/${key}`;

  // Keys for a PR page: title, then head branch, then the first Linear issue link (PR body or Linear's linkback comment).
  function prPageKeys({ title, branch, linearHref }) {
    const linked = parseLinearIssueUrl(linearHref);
    const keys = [...titleKeys(title), ...branchKeys(branch), ...(linked ? [linked.key] : [])];
    return [...new Set(keys)].slice(0, 3);
  }

  return {
    DEFAULTS,
    isBot,
    titleRegex,
    noiseReason,
    authorInQuery,
    authorFromRowText,
    titleKeys,
    branchKeys,
    parseLinearIssueUrl,
    workspaceSlug,
    linearIssueUrl,
    prPageKeys,
  };
})();

if (typeof module !== 'undefined') module.exports = prFocus;
