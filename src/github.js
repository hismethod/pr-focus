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
    // The React header's Viewed button is labelled "Viewed" or "Not Viewed" and pressed when the file is viewed.
    viewedButton: 'button[aria-label$="Viewed"][aria-pressed="true"]',
    // The file tree beside the diffs, the same roles in both views. A file's item links to its diff.
    tree: 'ul[aria-label="File Tree"]',
    treeItem: 'li[role="treeitem"]',
    treeLink: 'a[href^="#diff-"]',
    // The older tree keeps each file's path in a hidden text for its filter; the React tree keeps it in the item's id.
    treePathOlder: '[data-filterable-item-text]',
    // The octicon by which GitHub's tree shows how a file changed: file-added, file-diff, file-removed or
    // file-moved in the React tree, diff-added, diff-modified, diff-removed or diff-renamed in the older one.
    treeStatusIcon: 'svg[class*="octicon-file-"], svg[class*="octicon-diff-"]',
    // Parts of a row of the React tree (Primer's TreeView). These class names are not hashed, so they outlive a
    // restyle: the row's box, the indent lines and what holds them, a folder's chevron, the icon and the name.
    treeRowBox: '.PRIVATE_TreeView-item-container',
    treeLevelLine: '.PRIVATE_TreeView-item-level-line',
    treeLevelLines: '[style*="spacer"] > div',
    treeToggle: '.PRIVATE_TreeView-item-toggle',
    treeIcon: '.PRIVATE_TreeView-item-visual',
    treeName: '.PRIVATE_TreeView-item-content-text > *',
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

  // The files of a diff list: { el, id, path, generated, viewed, added, deleted }. el is the element that holds
  // the file and id the file's diff anchor, which a link to the file names. A file whose path cannot be read is
  // left out, so nothing happens to it.
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
        viewed: !!header.querySelector(SEL.viewedButton),
        ...prFocus.lineStat(stat),
      });
    }
    return files;
  }

  // GitHub's file tree, or null when the page has none (the user can hide it).
  const tree = () => document.querySelector(SEL.tree);

  // The files GitHub's tree lists: { id, path }. id is the file's diff anchor. A folder's item is skipped: it holds
  // other items, or nothing while GitHub keeps it collapsed.
  function treeFiles(root) {
    const files = [];
    for (const li of root.querySelectorAll(SEL.treeItem)) {
      if (li.querySelector(SEL.treeItem)) continue;
      const id = (li.querySelector(SEL.treeLink)?.hash || '').slice(1);
      const path = li.querySelector(SEL.treePathOlder)?.textContent.trim() || li.id;
      if (id && path) files.push({ id, path });
    }
    return files;
  }

  // The last word of that octicon's name, as the change it stands for.
  const STATUS = { added: 'added', diff: 'modified', modified: 'modified', removed: 'deleted', moved: 'renamed', renamed: 'renamed' };

  // How each file changed, as GitHub's own tree shows it, by the hash of the file's link: { status, icon }.
  // status is 'added' | 'modified' | 'deleted' | 'renamed', or '' when the tree does not say; icon is GitHub's octicon.
  function treeStatuses(root) {
    const statuses = new Map();
    for (const li of root.querySelectorAll(SEL.treeItem)) {
      const hash = !li.querySelector(SEL.treeItem) && li.querySelector(SEL.treeLink)?.hash;
      if (!hash) continue;
      const icon = li.querySelector(SEL.treeStatusIcon);
      const word = /octicon-(?:file|diff)-(\w+)/.exec(icon?.getAttribute('class') || '')?.[1];
      statuses.set(hash, { status: STATUS[word] || '', icon });
    }
    return statuses;
  }

  // GitHub's closed folder icon (octicon file-directory-fill), as GitHub's own pages draw it. The React tree only
  // holds the icon of the state each folder is in, and all its folders start open.
  const FOLDER_CLOSED =
    'M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75Z';

  // What our own tree is copied from, so that GitHub's styles draw it the same in every theme: the tree's root,
  // a folder's row (an open one if there is one), a file's row, an indent line, and each file's row by the hash
  // of its link (a file's icon says whether it was added, changed or removed).
  // null when the tree is not the React one (the older view) or has no file yet.
  function treeSamples(root) {
    const rows = [...root.querySelectorAll(SEL.treeItem)].filter((li) => li.querySelector(SEL.treeRowBox));
    const folders = rows.filter((li) => li.hasAttribute('aria-expanded') && li.querySelector(SEL.treeToggle));
    const files = new Map();
    for (const li of rows) {
      const hash = !li.hasAttribute('aria-expanded') && li.querySelector(SEL.treeLink)?.hash;
      if (hash) files.set(hash, li);
    }
    if (!files.size) return null;
    const folder = folders.find((li) => li.getAttribute('aria-expanded') === 'true') || folders[0];
    return { root, folder, files, file: files.values().next().value, line: root.querySelector(SEL.treeLevelLine) };
  }

  // An empty copy of the tree's root for a tree of our own. It must not carry GitHub's label: that is how GitHub's
  // tree is found.
  function treeRootCopy(samples, label) {
    const ul = samples.root.cloneNode(false);
    ul.removeAttribute('id');
    ul.setAttribute('aria-label', label);
    return ul;
  }

  // A copy of one of GitHub's tree rows to fill in: { li, text, tail, group }, or null when the row is not built
  // the way it is read here. text takes the name (a file's is its link), tail whatever goes after the name, and
  // group the rows inside a folder. hash names a file, so that the copy is of that file's own row, icon included.
  function treeRowCopy(samples, { folder, open, level, hash }) {
    const sample = folder ? samples.folder : samples.files.get(hash) || samples.file;
    // Only the row itself is copied: a folder's item also holds every row inside the folder.
    const box = sample?.querySelector(SEL.treeRowBox)?.cloneNode(true);
    const text = box?.querySelector(SEL.treeName);
    const lines = box?.querySelector(SEL.treeLevelLines);
    if (!text || !lines || (level > 1 && !samples.line)) return null;
    const li = sample.cloneNode(false);
    li.append(box);
    // The copy is not GitHub's row: no ids (they must stay unique) and none of its labels and state.
    for (const el of [li, ...li.querySelectorAll('*')]) {
      for (const name of ['id', 'aria-label', 'aria-labelledby', 'aria-describedby', 'aria-current']) el.removeAttribute(name);
    }
    li.setAttribute('aria-level', level);
    li.setAttribute('aria-selected', 'false');
    li.tabIndex = 0;
    box.style.setProperty('--level', level);
    lines.replaceChildren(...Array.from({ length: level - 1 }, () => samples.line.cloneNode(false)));
    const row = { li, text, tail: text.parentElement.parentElement };
    if (!folder) return row;
    li.setAttribute('aria-expanded', open);
    // The sample is drawn in its own state. For the other state its chevron is turned, and a folder that was open
    // gets the closed icon.
    const wasOpen = sample.getAttribute('aria-expanded') === 'true';
    const chevron = li.querySelector(`${SEL.treeToggle} svg`);
    if (chevron && open !== wasOpen) chevron.style.transform = `rotate(${open ? 90 : -90}deg)`;
    const icon = li.querySelector(`${SEL.treeIcon} svg`);
    if (icon && wasOpen && !open) {
      icon.querySelector('path')?.setAttribute('d', FOLDER_CLOSED);
      icon.classList.replace('octicon-file-directory-open-fill', 'octicon-file-directory-fill');
    }
    row.group = document.createElement('ul');
    row.group.setAttribute('role', 'group');
    row.group.style.cssText = 'list-style: none; padding: 0; margin: 0;';
    return row;
  }

  // The pull request the page is on, "/owner/repo/pull/123", or ''.
  const prKey = () => (/^\/[^/]+\/[^/]+\/pull\/\d+/.exec(location.pathname) || [''])[0];

  // The tree's own link to a file's diff anchor ("#diff-..."), or undefined.
  const treeLink = (root, hash) => [...root.querySelectorAll(SEL.treeLink)].find((a) => a.hash === hash);

  return { viewer, lists, prRows, readRow, rowTitleAnchor, isListPage, isPrPage, readPrPage, diffList, diffFiles, tree, treeFiles, treeLink, treeStatuses, treeSamples, treeRootCopy, treeRowCopy, prKey };
})();
