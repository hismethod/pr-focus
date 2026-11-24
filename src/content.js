// Hides noise PR rows with a count and a toggle, sorts tests and noise files out of a PR's changed files
// (in sections below the code, or hidden), and adds Linear issue buttons.
// GitHub is a single-page app, so everything is re-applied (idempotently) whenever the DOM changes.
(() => {
  let settings = { ...prFocus.DEFAULTS };
  let showHidden = false;
  let queued = false;
  // The bar of each list and the button box of each title, found again wherever the page moves things.
  const bars = new WeakMap();
  const boxes = new WeakMap();
  // The section headings of a list of changed files, by kind of noise.
  const sections = new WeakMap();
  // The kinds whose section is folded, until the tab reloads.
  const collapsed = new Set();
  // What the current pass drew or marked: bars, section headings, button boxes and noise rows. Anything else of ours is left over.
  let drawn = new Set();
  // The bar above the changed files, which the keyboard shortcut needs on the page.
  let filesBar;

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
      for (const el of document.querySelectorAll('.pr-focus-bar, .pr-focus-section, .pr-focus-linear')) if (!drawn.has(el)) el.remove();
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

  // The changed files of a PR. Files and the tree items of noise files are only marked here. content.css moves or
  // hides the marked ones while the bar (or a section's heading) is on the page, so nothing is hidden without the
  // button that shows it again.
  function applyFiles() {
    const list = gh.diffList();
    if (!list) return;
    // Sums of each kind of noise and of the code: { files, added, deleted }.
    const kinds = {};
    const rest = { files: 0, added: 0, deleted: 0 };
    // Diff anchor of each noise file, which its tree item links to.
    const reasons = new Map();
    for (const { el, id, path, generated, added, deleted } of gh.diffFiles(list)) {
      const reason = prFocus.fileNoise(path, settings, generated);
      // Every file is marked on every pass: the page may reuse an element for another file.
      markFile(el, reason || 'code');
      const sum = reason ? (kinds[reason] ||= { files: 0, added: 0, deleted: 0 }) : rest;
      sum.files++;
      sum.added += added;
      sum.deleted += deleted;
      if (reason) reasons.set(id, reason);
    }
    if (!reasons.size) return;
    const mode = prFocus.fileMode(settings.diffMode);
    const buttons = Object.entries(prFocus.FILE_MODE_LABEL).map(([value, label]) => ({
      label,
      pressed: value === mode,
      onClick: () => setFileMode(value),
    }));
    filesBar = renderBar(list, prFocus.filesBarText({ kinds, rest, mode }), buttons);
    setAttr(filesBar, 'data-pr-focus-mode', mode);
    setAttr(filesBar, 'title', 'Alt+Shift+F (Option+Shift+F on a Mac) steps through All, Sections and Hide noise');
    if (mode === 'sections') for (const kind of Object.keys(kinds)) renderSection(list, kind, kinds[kind]);
    // A folder of the tree is marked when everything in it is noise: with the kind its items share, or 'mixed'.
    // Items come parents first, so the walk runs backwards and each item reports to its folder. A folder GitHub
    // keeps collapsed holds no items here, so it reports nothing and stays unmarked.
    // inside: folder -> the kind of its items so far, or false once one of them is not noise.
    const inside = new Map();
    for (const { li, folder } of gh.treeItems().reverse()) {
      const reason = inside.has(li) ? inside.get(li) : reasons.get(gh.treeFileId(li));
      markFile(li, reason);
      if (!folder) continue;
      const kind = inside.get(folder);
      inside.set(folder, !reason || kind === false ? false : kind === undefined || kind === reason ? reason : 'mixed');
    }
  }

  function markFile(el, reason) {
    if (!reason) delete el.dataset.prFocusFile;
    else if (el.dataset.prFocusFile !== reason) el.dataset.prFocusFile = reason;
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

  // The heading of one kind of noise in Sections mode: the kind, its size, and a button that folds its files away.
  // It is put first in the list, and content.css orders it to just above the files of its kind.
  function renderSection(list, kind, sum) {
    if (!sections.has(list)) sections.set(list, new Map());
    let section = sections.get(list).get(kind);
    if (!section) {
      section = document.createElement('div');
      section.className = 'pr-focus-section';
      section.dataset.prFocusSection = kind;
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => {
        if (!collapsed.delete(kind)) collapsed.add(kind);
        schedule();
      });
      section.append(button);
      sections.get(list).set(kind, section);
    }
    if (section.parentElement !== list) list.prepend(section);
    drawn.add(section);
    section.toggleAttribute('data-pr-focus-collapsed', collapsed.has(kind));
    setAttr(section.firstChild, 'aria-expanded', !collapsed.has(kind));
    setText(section.firstChild, prFocus.sectionText(kind, sum));
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
    // Alt+Shift+F steps through All, Sections and Hide noise. GitHub and Chrome leave the combination free.
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
