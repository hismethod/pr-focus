// Hides noise PR rows, shows the hidden count with a toggle, and adds Linear issue buttons.
// GitHub is a single-page app, so everything is re-applied (idempotently) whenever the DOM changes.
(() => {
  let settings = { ...prFocus.DEFAULTS };
  let showHidden = false;
  let queued = false;
  // The bar of each list and the button box of each title, found again wherever the page moves things.
  const bars = new WeakMap();
  const boxes = new WeakMap();
  // What the current pass drew or marked: bars, button boxes and noise rows. Anything else of ours is left over.
  let drawn = new Set();

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
    // Only PR lists and PR pages are read; on busy pages such as Actions logs a pass is just the two cleanup queries below.
    if (gh.isListPage()) for (const list of gh.lists()) applyList(list);
    if (gh.isPrPage()) applyPrPage();
    for (const el of document.querySelectorAll('.pr-focus-bar, .pr-focus-linear')) if (!drawn.has(el)) el.remove();
    // A row only stays hidden while a pass still finds it to be noise (the page may reuse a row for another item).
    for (const li of document.querySelectorAll('[data-pr-focus-noise]')) if (!drawn.has(li)) delete li.dataset.prFocusNoise;
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
    renderBar(list, counts, selected);
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

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function renderBar(list, counts, selected) {
    if (!Object.keys(counts).length) return;
    let bar = bars.get(list);
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'pr-focus-bar';
      bar.setAttribute('role', 'status');
      const text = document.createElement('span');
      const button = document.createElement('button');
      button.type = 'button';
      button.addEventListener('click', () => {
        showHidden = !showHidden;
        schedule();
      });
      bar.append(text, button);
      bars.set(list, bar);
    }
    if (bar.nextElementSibling !== list) list.before(bar);
    drawn.add(bar);
    const [text, button] = bar.children;
    setText(text, prFocus.barText({ counts, selected, showHidden }));
    setText(button, showHidden ? 'Hide them' : 'Show them');
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
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? prFocus.DEFAULTS[key];
    schedule();
  });
})();
