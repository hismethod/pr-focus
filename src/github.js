// Every GitHub DOM selector lives here. GitHub's React markup hashes its class names,
// so these use only data-* attributes, octicon classes, hrefs and tag structure.
// Checked against github.com on 2026-11-23 (repo /pulls, /pulls/* dashboard, PR page).
const gh = (() => {
  const SEL = {
    // PR and issue lists share this list component; PR rows are told apart by their title link.
    list: 'ul[data-listview-component="items-list"]',
    rowTitleLink: 'h3 a[data-hovercard-type="pull_request"]',
    rowAuthor: '[data-testid="author-filter-link"]',
    draftIcon: '.octicon-git-pull-request-draft',
    // PR page (/owner/repo/pull/123 and its tabs).
    prTitle: 'header h1',
    prBranchLinks: 'header a[href*="/tree/"]',
    // Not our own buttons: they are Linear issue links too, and reading them back would pin a stale workspace.
    linearIssueLink: 'a[href^="https://linear.app/"][href*="/issue/"]:not(.pr-focus-linear a)',
  };

  const lists = () => document.querySelectorAll(SEL.list);

  const prRows = (list) => [...list.children].filter((li) => li.querySelector(SEL.rowTitleLink));

  // The inbox view (/pulls/inbox) has no author link, only "owner/repo#123 • author • Updated ...".
  const authorFromText = (li) => (/#\d+\s+•\s+([^\s•]+)\s+•/.exec(li.textContent) || [])[1] || '';

  function readRow(li) {
    return {
      title: li.querySelector(SEL.rowTitleLink).textContent.trim(),
      author: li.querySelector(SEL.rowAuthor)?.textContent.trim() || authorFromText(li),
      draft: !!li.querySelector(SEL.draftIcon),
    };
  }

  // Element the row's Linear buttons go after.
  const rowTitleAnchor = (li) => li.querySelector(SEL.rowTitleLink).closest('h3');

  const isPrPage = () => /^\/[^/]+\/[^/]+\/pull\/\d+/.test(location.pathname);

  function readPrPage() {
    const h1 = document.querySelector(SEL.prTitle);
    if (!h1) return null;
    const branches = document.querySelectorAll(SEL.prBranchLinks);
    return {
      titleAnchor: h1,
      title: h1.textContent,
      // The header lists the base branch first and the head branch last.
      branch: branches.length > 1 ? branches[branches.length - 1].textContent.trim() : '',
      linearHref: document.querySelector(SEL.linearIssueLink)?.href || '',
    };
  }

  // Workspace slug from any Linear issue link on the page, if there is one.
  const linearWorkspaceOnPage = () =>
    prFocus.parseLinearIssueUrl(document.querySelector(SEL.linearIssueLink)?.href)?.workspace || '';

  return { lists, prRows, readRow, rowTitleAnchor, isPrPage, readPrPage, linearWorkspaceOnPage };
})();
