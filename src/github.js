// Every GitHub DOM selector lives here. GitHub's React markup hashes its class names,
// so these use only data-* attributes, octicon classes, hrefs and tag structure.
// Checked against github.com on 2026-11-23 (repo /pulls, /pulls/* dashboard, PR page), signed in and signed out,
// and on 2026-11-24 (a PR's changed files).
const gh = (() => {
  const SEL = {
    // PR and issue lists share this list component; PR rows are told apart by their title link's /pull/ href.
    // (data-hovercard-type="pull_request" is not in the server-rendered HTML, only after the page's scripts ran.)
    list: 'ul[data-listview-component="items-list"]',
    rowTitleLink: 'h3 a[href*="/pull/"]',
    rowAuthor: '[data-testid="author-filter-link"]',
    draftIcon: '.octicon-git-pull-request-draft',
    // A ticked row checkbox, native or ARIA. Keep in step with the :has() rule in content.css.
    rowTicked: 'input[type="checkbox"]:checked, [aria-checked="true"]',
    // Login of the signed-in user; the tag is there with an empty value when signed out.
    viewer: 'meta[name="user-login"]',
    // PR page (/owner/repo/pull/123 and its tabs).
    prTitle: 'header h1',
    prBranchLinks: 'header a[href*="/tree/"]',
    // Not our own buttons: they are Linear issue links too, and reading them back would pin a stale workspace.
    linearIssueLink: 'a[href^="https://linear.app/"][href*="/issue/"]:not(.pr-focus-linear a)',
    // A comment by Linear's GitHub app. Its linkback names the issue the PR is linked to.
    linearBotComment: 'article:has([data-testid="comment-header"] a[href^="/apps/linear"])',
    // A PR's changed files. Two markups are live: the React view at /pull/<n>/changes (signed in; /files redirects
    // there) and the older view at /pull/<n>/files (signed out). Each selector names the React one first.
    diffList: '[data-testid="progressive-diffs-list"], #files.js-diff-container',
    // The older view marks each file .file, at some depth: it adds files in batches.
    diffFile: '.file[id^="diff-"]',
    // The React list wraps each file in a child, and the file's diff anchor is that child's own child.
    diffAnchor: ':scope > [id^="diff-"]',
    // Path and line counts are read inside the file's header, which comes before the diff.
    diffHeader: '[data-diff-header-wrapper], .file-header',
    // The React header shows the path, and a rename as visible short paths plus the full ones for screen readers.
    diffPath: 'h3 code',
    diffPathSpoken: 'h3 code .sr-only',
    // "Lines changed: 19 additions & 2 deletions" (React), "21 changes: 19 additions & 2 deletions" (older).
    diffStat: '.sr-only',
    diffTable: 'table',
    // "Some generated files are not rendered by default. Learn more about ...", shown in place of the diff.
    generatedNote: 'a[href*="customizing-how-changed-files-appear-on-github"]',
    // The file tree beside the diffs, the same roles in both views. A file's item links to its diff.
    tree: 'ul[aria-label="File Tree"]',
    treeItem: 'li[role="treeitem"]',
    treeLink: 'a[href^="#diff-"]',
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
      ticked: !!li.querySelector(SEL.rowTicked),
    };
  }

  // Element the row's Linear buttons go after.
  const rowTitleAnchor = (li) => li.querySelector(SEL.rowTitleLink).closest('h3');

  // PR lists: the dashboard (/pulls and its views) and a repository's /pulls.
  const isListPage = () => /^\/pulls(\/|$)|^\/[^/]+\/[^/]+\/pulls(\/|$)/.test(location.pathname);

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

  const diffList = () => document.querySelector(SEL.diffList);

  // The files of a diff list: { el, id, path, generated, added, deleted }. el is the element to hide and id the
  // file's diff anchor, which its tree item links to. A file whose path cannot be read is left out, so it stays.
  // A loaded diff can be thousands of rows, so nothing here searches one: a big PR is read on every pass.
  function diffFiles(list) {
    const files = [];
    const older = list.id === 'files';
    for (const el of older ? list.querySelectorAll(SEL.diffFile) : list.children) {
      const anchor = older ? el : el.querySelector(SEL.diffAnchor);
      const header = anchor && el.querySelector(SEL.diffHeader);
      if (!header) continue;
      const name = header.querySelector(SEL.diffPathSpoken) || header.querySelector(SEL.diffPath);
      const path = el.dataset.tagsearchPath || prFocus.headerPath(name?.textContent);
      if (!path) continue;
      const stat = [...header.querySelectorAll(SEL.diffStat)].map((node) => node.textContent).find((text) => /addition/.test(text));
      // The note only stands in for a diff that is not loaded.
      const note = el.querySelector(SEL.diffTable) ? null : el.querySelector(SEL.generatedNote);
      files.push({
        el,
        id: anchor.id,
        path,
        generated: /generated/i.test(note?.parentElement.textContent || ''),
        ...prFocus.lineStat(stat),
      });
    }
    return files;
  }

  // Items of the file tree, parents before children: { li, folder }. folder is the item that holds this one, or null.
  function treeItems() {
    const tree = document.querySelector(SEL.tree);
    if (!tree) return [];
    return [...tree.querySelectorAll(SEL.treeItem)].map((li) => ({ li, folder: li.parentElement.closest(SEL.treeItem) }));
  }

  // Diff anchor of a file's tree item. Not for a folder's item: that would find the first file in it.
  const treeFileId = (li) => (li.querySelector(SEL.treeLink)?.hash || '').slice(1);

  return { viewer, lists, prRows, readRow, rowTitleAnchor, isListPage, isPrPage, readPrPage, diffList, diffFiles, treeItems, treeFileId };
})();
