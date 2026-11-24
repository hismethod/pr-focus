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
  // What the current pass drew or marked: bars, section headings, file lists, button boxes and noise rows. Anything else of ours is left over.
  let drawn = new Set();
  // The bar above the changed files, which the keyboard shortcut needs on the page.
  let filesBar;
  // The elements this script adds to the page.
  const OURS = '.pr-focus-bar, .pr-focus-section, .pr-focus-files, .pr-focus-linear';

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
      for (const el of document.querySelectorAll(OURS)) if (!drawn.has(el)) el.remove();
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
    for (const { el, kind } of files) markFile(el, kind);
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
      bar.className = 'pr-focus-bar';
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
      heading.className = 'pr-focus-section';
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

  // Our own list of the changed files, by section, in the place of GitHub's file tree: that tree is nested by
  // folder and cannot be regrouped. The list sits right before the tree and content.css hides whatever follows
  // the list, so GitHub's tree is back whenever the list is not drawn. A file is a link to GitHub's own anchor.
  function renderFileList(tree, sectionList) {
    let own = fileLists.get(tree);
    if (!own) {
      const nav = element('nav', 'pr-focus-files');
      nav.setAttribute('aria-label', 'Changed files by kind');
      nav.addEventListener('click', (e) => {
        const kind = e.target.closest('button')?.parentElement.dataset.prFocusSection;
        if (kind) return fold(kind);
        // A file: GitHub's own tree link for it does the scrolling, so the list moves the page exactly as the tree
        // it stands in for. Without that link (a folder GitHub keeps collapsed) the plain anchor link is followed.
        const link = e.target.closest('a');
        const theirs = link && !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) && gh.treeLink(tree, link.hash);
        if (!theirs) return;
        e.preventDefault();
        theirs.click();
      });
      fileLists.set(tree, (own = { nav }));
    }
    const { nav } = own;
    if (nav.nextElementSibling !== tree) tree.before(nav);
    drawn.add(nav);
    // Rebuilt only when what it shows changed: a rebuild changes the page, and every change starts another pass.
    const shows = JSON.stringify(
      sectionList.map((section) => [
        prFocus.sectionText(section),
        collapsed.has(section.kind),
        section.rows.map(({ depth, dir, file: f }) => (dir ? [depth, dir] : [depth, f.id, f.name, f.added, f.deleted, f.viewed])),
      ]),
    );
    if (own.shows === shows) return;
    own.shows = shows;
    nav.replaceChildren(
      ...sectionList.map((section) => {
        const open = !collapsed.has(section.kind);
        const block = element('div', 'pr-focus-files-section');
        block.dataset.prFocusSection = section.kind;
        block.toggleAttribute('data-pr-focus-collapsed', !open);
        const button = element('button', '', prFocus.sectionText(section));
        button.type = 'button';
        button.setAttribute('aria-expanded', open);
        block.append(button);
        for (const { depth, dir, file } of open ? section.rows : []) {
          const row = dir ? element('div', 'pr-focus-files-folder', dir) : element('a', 'pr-focus-files-file');
          // Indented by its depth in the section's folder tree.
          row.style.paddingLeft = `${8 + depth * 12}px`;
          block.append(row);
          if (dir) continue;
          row.href = `#${file.id}`;
          row.title = file.viewed ? `${file.path} (viewed)` : file.path;
          row.toggleAttribute('data-viewed', !!file.viewed);
          row.append(element('span', 'pr-focus-files-name', file.name));
          if (file.added) row.append(element('span', 'pr-focus-files-added', `+${file.added}`));
          if (file.deleted) row.append(element('span', 'pr-focus-files-deleted', `−${file.deleted}`));
        }
        return block;
      }),
    );
  }

  // issues: [{ workspace, key }]
  function renderLinear(anchor, issues) {
    if (!issues.length) return;
    const id = issues.map(({ workspace, key }) => `${workspace}/${key}`).join(',');
    let box = boxes.get(anchor);
    if (box?.dataset.id !== id) {
      box = document.createElement('span');
      box.className = 'pr-focus-linear';
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
