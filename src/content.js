// Hides noise PR rows with a count and a toggle, shows a PR's changed files in sections (the code first, then
// tests and each kind of noise) in the diff and in the file list, and adds Linear issue buttons.
// GitHub is a single-page app, so everything is re-applied (idempotently) whenever the DOM changes.
(() => {
  let settings = { ...prFocus.DEFAULTS };
  let showHidden = false;
  let queued = false;
  // The bar of each list and the button box of each title, found again wherever the page moves things.
  const bars = new WeakMap();
  const boxes = new WeakMap();
  // The section headings of a list of changed files, by kind.
  const sections = new WeakMap();
  // Our own file list for each file tree of GitHub's: { nav, shows }.
  const fileLists = new WeakMap();
  // The kinds whose section is folded, in the diff and in the file list, until the tab reloads.
  const collapsed = new Set();
  // The folders closed in our file list, as "<the pull request> <kind>/<folder path>", until the tab reloads.
  const closedFolders = new Set();
  // The diff anchor of each changed file's element, and of the file the page is at.
  const fileIds = new WeakMap();
  let currentFile = '';
  // Our file list while it is on the page, and whether a look at where the page is at is already queued.
  let filesNav;
  let tracking = false;
  // What the current pass drew or marked: bars, section headings, file lists, button boxes and noise rows. Anything else of ours is left over.
  let drawn = new Set();
  // The bar above the changed files, which the keyboard shortcut needs on the page.
  let filesBar;
  // Every element this script adds to the page carries this class next to its own, so finding them all is one
  // search for one class: on a big diff that search is most of a pass.
  const OURS = 'pr-focus';

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  function apply() {
    drawn = new Set();
    try {
      // Only PR lists and PR pages are read; on busy pages such as Actions logs a pass is just the cleanup below.
      if (gh.isListPage()) for (const list of gh.lists()) applyList(list);
      if (gh.isPrPage()) {
        applyPrPage();
        applyFiles();
      }
    } finally {
      // Whatever of ours this pass did not confirm goes, also when the pass failed: an unconfirmed bar is removed,
      // and with it everything that bar hides.
      for (const el of document.querySelectorAll(`.${OURS}`)) if (!drawn.has(el)) el.remove();
      // A row only stays marked while a pass still finds it to be noise (the page may reuse a row for another item).
      for (const list of gh.lists()) for (const li of list.children) if (!drawn.has(li)) delete li.dataset.prFocusNoise;
    }
  }

  function applyList(list) {
    const viewer = gh.viewer();
    // Every row is read and the bar drawn before any row is hidden, so a failure cannot leave rows hidden without the toggle.
    const rows = gh.prRows(list).map((li) => {
      const pr = gh.readRow(li);
      return { li, pr, reason: prFocus.noiseReason(pr, settings, viewer) };
    });
    const counts = {};
    let selected = 0;
    for (const { pr, reason } of rows) {
      if (!reason) continue;
      counts[reason] = (counts[reason] || 0) + 1;
      if (pr.ticked) selected++;
    }
    if (Object.keys(counts).length) {
      const onClick = () => {
        showHidden = !showHidden;
        schedule();
      };
      const text = prFocus.barText({ counts, selected, showHidden });
      renderBar(list, text, [{ label: showHidden ? 'Hide them' : 'Show them', onClick }]);
    }
    list.toggleAttribute('data-pr-focus-show', showHidden);
    for (const { li, pr, reason } of rows) {
      if (reason) {
        li.dataset.prFocusNoise = reason;
        drawn.add(li);
      }
      renderLinear(gh.rowTitleAnchor(li), prFocus.rowIssues(pr.title, settings));
    }
  }

  function applyPrPage() {
    const pr = gh.readPrPage();
    if (pr) renderLinear(pr.titleAnchor, prFocus.prPageIssues(pr, settings));
  }

  // The changed files of a PR. Each file is only marked with its kind here. content.css reorders the marked files,
  // folds a section and hides GitHub's file tree only while the bar, the section's heading or our own file list is
  // on the page, so when one of them cannot be drawn the page is GitHub's again.
  function applyFiles() {
    const list = gh.diffList();
    if (!list) return;
    const kindOf = (path, generated) => prFocus.fileNoise(path, settings, generated) || 'code';
    const files = gh.diffFiles(list).map((file) => ({ ...file, kind: kindOf(file.path, file.generated) }));
    // Every file is marked on every pass: the page may reuse an element for another file.
    for (const { el, id, kind } of files) {
      markFile(el, kind);
      fileIds.set(el, id);
    }
    // Files GitHub's tree lists whose diff is not on the page yet (the older view adds diffs in batches). Their
    // line counts are not known. GitHub's own filter takes files out of both, so the lists follow it.
    const tree = gh.tree();
    const known = new Set(files.map((file) => file.id));
    for (const { id, path } of tree ? gh.treeFiles(tree) : []) {
      if (!known.has(id)) files.push({ id, path, kind: kindOf(path, false), added: 0, deleted: 0 });
    }
    const sections = prFocus.fileSections(files);
    if (sections.every((section) => section.kind === 'code')) return;
    const mode = prFocus.fileMode(settings.diffMode);
    const buttons = Object.entries(prFocus.FILE_MODE_LABEL).map(([value, label]) => ({
      label,
      pressed: value === mode,
      onClick: () => setFileMode(value),
    }));
    filesBar = renderBar(list, prFocus.filesBarText(sections, mode), buttons);
    setAttr(filesBar, 'data-pr-focus-mode', mode);
    setAttr(filesBar, 'title', 'Alt+Shift+F (Option+Shift+F on a Mac) switches between All and Sections');
    if (mode !== 'sections') return;
    for (const section of sections) renderSection(list, section);
    if (tree) renderFileList(tree, sections);
    trackCurrent();
  }

  function markFile(el, kind) {
    if (el.dataset.prFocusFile !== kind) el.dataset.prFocusFile = kind;
  }

  function setFileMode(mode) {
    settings.diffMode = mode;
    schedule();
    // Remembered for the next PR and other tabs. If the write fails, only the memory is lost.
    chrome.storage.sync.set({ diffMode: mode });
  }

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function setAttr(el, name, value) {
    if (el.getAttribute(name) !== String(value)) el.setAttribute(name, value);
  }

  // A bar before an element: a status text and buttons, [{ label, pressed, onClick }]. The buttons of a bar stay
  // the same ones; pressed is given when they are choices, of which one is the current.
  function renderBar(before, text, buttons) {
    let bar = bars.get(before);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = `${OURS} pr-focus-bar`;
      bar.setAttribute('role', 'status');
      bar.append(document.createElement('span'));
      for (const { onClick } of buttons) {
        const button = document.createElement('button');
        button.type = 'button';
        button.addEventListener('click', onClick);
        bar.append(button);
      }
      bars.set(before, bar);
    }
    if (bar.nextElementSibling !== before) before.before(bar);
    drawn.add(bar);
    setText(bar.firstChild, text);
    buttons.forEach(({ label, pressed }, i) => {
      const button = bar.children[i + 1];
      setText(button, label);
      if (pressed !== undefined) setAttr(button, 'aria-pressed', pressed);
    });
    return bar;
  }

  function fold(kind) {
    if (!collapsed.delete(kind)) collapsed.add(kind);
    schedule();
  }

  // The heading of one section above its files in the diff: the kind, its size, and a button that folds the
  // section. It is put first in the list, and content.css orders it to just above the files of its kind.
  function renderSection(list, section) {
    const { kind } = section;
    if (!sections.has(list)) sections.set(list, new Map());
    let heading = sections.get(list).get(kind);
    if (!heading) {
      heading = document.createElement('div');
      heading.className = `${OURS} pr-focus-section`;
      heading.dataset.prFocusSection = kind;
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => fold(kind));
      heading.append(button);
      sections.get(list).set(kind, heading);
    }
    if (heading.parentElement !== list) list.prepend(heading);
    drawn.add(heading);
    heading.toggleAttribute('data-pr-focus-collapsed', collapsed.has(kind));
    setAttr(heading.firstChild, 'aria-expanded', !collapsed.has(kind));
    setText(heading.firstChild, prFocus.sectionText(section));
  }

  const element = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  };

  // A row of our own making, for a tree that cannot be copied from GitHub's (the older view): { li, text, tail, group },
  // as gh.treeRowCopy() gives them. content.css draws it.
  function plainRow({ folder, open, level }) {
    const li = element('li', 'pr-focus-files-row');
    li.setAttribute('role', 'treeitem');
    li.setAttribute('aria-level', level);
    li.tabIndex = 0;
    const tail = element('div', 'pr-focus-files-box');
    tail.style.paddingLeft = `${level * 12}px`;
    const text = element(folder ? 'span' : 'a', 'pr-focus-files-name');
    tail.append(text);
    li.append(tail);
    if (!folder) return { li, text, tail, plain: true };
    li.setAttribute('aria-expanded', open);
    const group = element('ul', '');
    group.setAttribute('role', 'group');
    return { li, text, tail, group };
  }

  // The rows of a section's folder tree. make gives an empty row: a copy of GitHub's own, or a plain one.
  // A row is known by data-pr-focus-row: a file's diff anchor, or a folder's kind and path.
  // statuses says how each file changed. A copy of GitHub's row already carries the file's own icon for it; a plain
  // row gets a copy of that icon. content.css colors it.
  function treeRows(make, statuses, nodes, kind, level) {
    return nodes.map(({ file, name, path, children }) => {
      if (file) {
        const row = make({ level, hash: `#${file.id}` });
        const { status, icon } = statuses.get(`#${file.id}`) || {};
        row.li.dataset.prFocusRow = file.id;
        if (status) row.li.dataset.prFocusStatus = status;
        if (icon && row.plain) row.tail.prepend(icon.cloneNode(true));
        row.li.title = [file.path, status, file.viewed && 'viewed'].filter(Boolean).join(', ');
        row.li.toggleAttribute('data-viewed', !!file.viewed);
        row.text.textContent = file.name;
        row.text.href = `#${file.id}`;
        const lines = element('span', 'pr-focus-files-lines');
        if (file.added) lines.append(element('span', 'pr-focus-files-added', `+${file.added}`));
        if (file.deleted) lines.append(element('span', 'pr-focus-files-deleted', `−${file.deleted}`));
        row.tail.append(lines);
        return row.li;
      }
      const key = `${kind}/${path}`;
      const open = !closedFolders.has(`${gh.prKey()} ${key}`);
      const row = make({ folder: true, open, level });
      row.li.dataset.prFocusRow = key;
      row.li.title = path;
      row.text.textContent = name;
      // Like GitHub's tree, a closed folder holds no rows.
      if (open) {
        row.group.append(...treeRows(make, statuses, children, kind, level + 1));
        row.li.append(row.group);
      }
      return row.li;
    });
  }

  // What a section's tree shows, for telling whether it changed.
  const treeShows = (statuses, nodes, kind) =>
    nodes.map(({ file: f, name, path, children }) =>
      f
        ? [f.id, f.name, f.added, f.deleted, f.viewed, statuses.get(`#${f.id}`)?.status]
        : [name, closedFolders.has(`${gh.prKey()} ${kind}/${path}`), treeShows(statuses, children, kind)],
    );

  // Our own list of the changed files, by section, in the place of GitHub's file tree: that tree is nested by
  // folder and belongs to React, so it cannot be regrouped. The list sits right before the tree and content.css
  // hides whatever follows the list, so GitHub's tree is back whenever the list is not drawn.
  // Under each section's heading is a tree made of copies of GitHub's own rows, so it looks and themes the same:
  // chevrons that open and close a folder, icons, indent lines, and a mark on the file the page is at.
  function renderFileList(tree, sectionList) {
    let own = fileLists.get(tree);
    if (!own) {
      const nav = element('nav', `${OURS} pr-focus-files`);
      nav.setAttribute('aria-label', 'Changed files by kind');
      nav.addEventListener('click', (e) => {
        const kind = e.target.closest('button')?.parentElement.dataset.prFocusSection;
        if (kind) return fold(kind);
        const row = e.target.closest('[role="treeitem"]');
        if (!row) return;
        if (row.hasAttribute('aria-expanded')) {
          const key = `${gh.prKey()} ${row.dataset.prFocusRow}`;
          if (!closedFolders.delete(key)) closedFolders.add(key);
          return schedule();
        }
        // A file. With a modifier key the link is left to the browser (a new tab). Otherwise GitHub's own tree
        // link does the scrolling, so the page moves exactly as it does from the tree this list stands in for.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        const { hash } = row.querySelector('a');
        const theirs = gh.treeLink(tree, hash);
        if (theirs) theirs.click();
        else location.hash = hash;
      });
      // Enter and Space on a row do what a click does.
      nav.addEventListener('keydown', (e) => {
        if ((e.key !== 'Enter' && e.key !== ' ') || !e.target.matches('[role="treeitem"]')) return;
        e.preventDefault();
        e.target.click();
      });
      fileLists.set(tree, (own = { nav }));
    }
    const { nav } = own;
    if (nav.nextElementSibling !== tree) tree.before(nav);
    drawn.add(nav);
    filesNav = nav;
    const samples = gh.treeSamples(tree);
    const statuses = gh.treeStatuses(tree);
    // Rebuilt only when what it shows changed: a rebuild changes the page, and every change starts another pass.
    const shows = JSON.stringify([
      !!samples,
      sectionList.map((section) => [prFocus.sectionText(section), collapsed.has(section.kind), treeShows(statuses, section.tree, section.kind)]),
    ]);
    if (own.shows === shows) return;
    own.shows = shows;
    const make = (row) => (samples && gh.treeRowCopy(samples, row)) || plainRow(row);
    // The row the keyboard is on is found again after the rebuild.
    const focused = nav.contains(document.activeElement) && document.activeElement.dataset.prFocusRow;
    nav.replaceChildren(
      ...sectionList.map((section) => {
        const open = !collapsed.has(section.kind);
        const block = element('div', 'pr-focus-files-section');
        block.dataset.prFocusSection = section.kind;
        block.toggleAttribute('data-pr-focus-collapsed', !open);
        const button = element('button', '', prFocus.sectionText(section));
        button.type = 'button';
        button.dataset.prFocusRow = `section ${section.kind}`;
        button.setAttribute('aria-expanded', open);
        block.append(button);
        if (!open) return block;
        const label = `${section.kind} files`;
        const root = samples ? gh.treeRootCopy(samples, label) : element('ul', 'pr-focus-files-tree');
        root.setAttribute('role', 'tree');
        root.setAttribute('aria-label', label);
        root.append(...treeRows(make, statuses, section.tree, section.kind, 1));
        block.append(root);
        return block;
      }),
    );
    if (focused) [...nav.querySelectorAll('[data-pr-focus-row]')].find((el) => el.dataset.prFocusRow === focused)?.focus();
    markCurrent();
  }

  // The file the page is at: the one under a point just below GitHub's sticky bars, or further down while the
  // list of files starts lower than that. Its row in our list is marked the way GitHub marks the row of a file
  // it was asked to go to. GitHub's own tree does not follow the scroll; ours does.
  function trackCurrent() {
    if (tracking || !filesNav?.isConnected) return;
    tracking = true;
    requestAnimationFrame(() => {
      tracking = false;
      const list = filesNav.isConnected && gh.diffList();
      if (!list) return;
      const box = list.getBoundingClientRect();
      const y = Math.min(Math.max(box.top + 90, 150), innerHeight - 10);
      const id = fileIds.get(document.elementFromPoint(box.left + 24, y)?.closest('[data-pr-focus-file]'));
      // Between two files (a section's heading, a gap) the last file stays marked.
      if (!id || id === currentFile) return;
      currentFile = id;
      markCurrent();
    });
  }

  function markCurrent() {
    for (const row of filesNav.querySelectorAll('[role="treeitem"]:not([aria-expanded])')) {
      const current = row.dataset.prFocusRow === currentFile;
      if ((row.getAttribute('aria-current') === 'true') === current) continue;
      row.setAttribute('aria-selected', current);
      if (current) row.setAttribute('aria-current', 'true');
      else row.removeAttribute('aria-current');
    }
  }

  // issues: [{ workspace, key }]
  function renderLinear(anchor, issues) {
    if (!issues.length) return;
    const id = issues.map(({ workspace, key }) => `${workspace}/${key}`).join(',');
    let box = boxes.get(anchor);
    if (box?.dataset.id !== id) {
      box = document.createElement('span');
      box.className = `${OURS} pr-focus-linear`;
      box.dataset.id = id;
      for (const issue of issues) {
        const a = document.createElement('a');
        a.href = prFocus.linearIssueUrl(issue);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = issue.key;
        a.title = `Open ${issue.key} in Linear`;
        a.addEventListener('click', (e) => e.stopPropagation());
        box.append(a);
      }
      boxes.set(anchor, box);
    }
    if (box.previousElementSibling !== anchor) anchor.after(box);
    drawn.add(box);
  }

  chrome.storage.sync.get(prFocus.DEFAULTS, (stored) => {
    settings = { ...settings, ...stored };
    // Watching starts once the settings are known, so nothing is hidden by a default the user turned off.
    new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
    // Ticking a row changes no child list, but the bar has to say that the row is shown.
    document.addEventListener('change', schedule, true);
    // The file list marks the file the page is at. Scrolling changes no element, so it is watched for by itself.
    document.addEventListener('scroll', trackCurrent, { capture: true, passive: true });
    // Alt+Shift+F switches between All and Sections. GitHub and Chrome leave the combination free.
    // It acts only while the bar is on the page, and never while typing.
    document.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyF' || !e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey || e.repeat) return;
      if (!filesBar?.isConnected || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      setFileMode(prFocus.nextFileMode(settings.diffMode));
    });
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? prFocus.DEFAULTS[key];
    schedule();
  });
})();
