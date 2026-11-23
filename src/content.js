// Hides noise PR rows, shows the hidden count with a toggle, and adds Linear issue buttons.
// GitHub is a single-page app, so everything is re-applied (idempotently) whenever the DOM changes.
(() => {
  let settings = { ...prFocus.DEFAULTS };
  let showHidden = false;
  let queued = false;

  const REASON_LABEL = { bot: 'bot', draft: 'draft', title: 'title match' };

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      apply();
    });
  }

  function apply() {
    for (const list of gh.lists()) applyList(list);
    if (gh.isPrPage()) applyPrPage();
  }

  function applyList(list) {
    const viewer = gh.viewer();
    const counts = {};
    let hidden = 0;
    for (const li of gh.prRows(list)) {
      const pr = gh.readRow(li);
      const reason = prFocus.noiseReason(pr, settings, viewer);
      if (reason) li.dataset.prFocusNoise = reason;
      else delete li.dataset.prFocusNoise;
      if (reason) {
        hidden++;
        counts[reason] = (counts[reason] || 0) + 1;
      }
      renderLinear(gh.rowTitleAnchor(li), prFocus.rowIssues(pr.title, settings));
    }
    list.toggleAttribute('data-pr-focus-show', showHidden);
    renderBar(list, hidden, counts);
  }

  function applyPrPage() {
    const pr = gh.readPrPage();
    if (pr) renderLinear(pr.titleAnchor, prFocus.prPageIssues(pr, settings));
  }

  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text;
  }

  function renderBar(list, hidden, counts) {
    let bar = list.previousElementSibling?.classList.contains('pr-focus-bar') ? list.previousElementSibling : null;
    if (!hidden) {
      bar?.remove();
      return;
    }
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
      list.before(bar);
    }
    const [text, button] = bar.children;
    const detail = Object.entries(counts)
      .map(([reason, n]) => `${n} ${REASON_LABEL[reason]}`)
      .join(', ');
    setText(text, `PR Focus: ${hidden} PR${hidden === 1 ? '' : 's'} ${showHidden ? 'shown dimmed' : 'hidden'} (${detail})`);
    setText(button, showHidden ? 'Hide them' : 'Show them');
    button.setAttribute('aria-pressed', String(showHidden));
  }

  // issues: [{ workspace, key }]
  function renderLinear(anchor, issues) {
    const id = issues.map(({ workspace, key }) => `${workspace}/${key}`).join(',');
    const next = anchor.nextElementSibling;
    const box = next?.classList.contains('pr-focus-linear') ? next : null;
    if ((box?.dataset.id || '') === id) return;
    box?.remove();
    if (!id) return;
    const span = document.createElement('span');
    span.className = 'pr-focus-linear';
    span.dataset.id = id;
    for (const issue of issues) {
      const { key } = issue;
      const a = document.createElement('a');
      a.href = prFocus.linearIssueUrl(issue);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = key;
      a.title = `Open ${key} in Linear`;
      a.addEventListener('click', (e) => e.stopPropagation());
      span.append(a);
    }
    anchor.after(span);
  }

  chrome.storage.sync.get(prFocus.DEFAULTS, (stored) => {
    settings = stored;
    schedule();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) settings[key] = newValue ?? prFocus.DEFAULTS[key];
    schedule();
  });
  new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
})();
