// Every GitHub DOM selector lives here. GitHub's React markup hashes its class names,
// so these use only data-* attributes, octicon classes, hrefs and tag structure.
// Checked against github.com on 2026-11-23 (repo /pulls, /pulls/* dashboard, PR page), signed in and signed out.
const gh = (() => {
  const SEL = {
    // PR and issue lists share this list component; PR rows are told apart by their title link's /pull/ href.
    // (data-hovercard-type="pull_request" is not in the server-rendered HTML, only after the page's scripts ran.)
    list: 'ul[data-listview-component="items-list"]',
    rowTitleLink: 'h3 a[href*="/pull/"]',
    rowAuthor: '[data-testid="author-filter-link"]',
    draftIcon: '.octicon-git-pull-request-draft',
    // Login of the signed-in user; the tag is there with an empty value when signed out.
    viewer: 'meta[name="user-login"]',
    // PR page (/owner/repo/pull/123 and its tabs).
    prTitle: 'header h1',
    prBranchLinks: 'header a[href*="/tree/"]',
    // Not our own buttons: they are Linear issue links too, and reading them back would pin a stale workspace.
    linearIssueLink: 'a[href^="https://linear.app/"][href*="/issue/"]:not(.pr-focus-linear a)',
    // A comment by Linear's GitHub app. Its linkback names the issue the PR is linked to.
    linearBotComment: 'article:has([data-testid="comment-header"] a[href^="/apps/linear"])',
  };

  const lists = () => document.querySelectorAll(SEL.list);

  const viewer = () => document.querySelector(SEL.viewer)?.content || '';

  const prRows = (list) => [...list.children].filter((li) => li.querySelector(SEL.rowTitleLink));

  // Row text without the title, so a title cannot pose as the row's "owner/repo#123 • author •" line.
  function textOutsideTitle(li) {
    let text = '';
    const walker = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    for (let node; (node = walker.nextNode()); ) if (!node.parentElement.closest('h3')) text += node.data;
    return text;
  }

  // The author link's href carries the login in its author: filter. Dashboard views such as
  // /pulls/inbox and /pulls/search have no author link, only text.
  function rowAuthor(li) {
    const link = li.querySelector(SEL.rowAuthor);
    if (!link) return prFocus.authorFromRowText(textOutsideTitle(li));
    return prFocus.authorInQuery(new URLSearchParams(link.search).get('q')) || link.textContent.trim();
  }

  function readRow(li) {
    return {
      title: li.querySelector(SEL.rowTitleLink).textContent.trim(),
      author: rowAuthor(li),
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
      // Linear's own linkback first; otherwise the first Linear issue link on the page (usually the PR body).
      linearHref:
        (document.querySelector(`${SEL.linearBotComment} ${SEL.linearIssueLink}`) || document.querySelector(SEL.linearIssueLink))
          ?.href || '',
    };
  }

  return { viewer, lists, prRows, readRow, rowTitleAnchor, isPrPage, readPrPage };
})();
