// Shared by the toolbar popup and the options page. Every input's id is a settings key.
const inputs = Object.keys(prFocus.DEFAULTS).map((key) => document.getElementById(key));
// Only edited keys are saved, so a page opened earlier cannot write its old values over newer ones.
const dirty = new Set();
let timer;

const valueOf = (input) => (input.type === 'checkbox' ? input.checked : input.value.trim());

function showErrors() {
  const { titlePattern, linearWorkspace } = Object.fromEntries(inputs.map((i) => [i.id, valueOf(i)]));
  document.getElementById('titlePatternError').hidden = !titlePattern || !!prFocus.titleRegex(titlePattern);
  document.getElementById('linearWorkspaceError').hidden = !linearWorkspace || !!prFocus.workspaceSlug(linearWorkspace);
}

function save() {
  clearTimeout(timer);
  chrome.storage.sync.set(Object.fromEntries(inputs.filter((i) => dirty.has(i.id)).map((i) => [i.id, valueOf(i)])));
  dirty.clear();
}

function load() {
  chrome.storage.sync.get(prFocus.DEFAULTS, (settings) => {
    for (const input of inputs) {
      // The field being edited is left alone, or a save would rewrite it under the cursor.
      if (input === document.activeElement || dirty.has(input.id)) continue;
      input[input.type === 'checkbox' ? 'checked' : 'value'] = settings[input.id];
    }
    showErrors();
  });
}

load();
// Follow changes made in another popup or options page.
chrome.storage.onChanged.addListener(load);

// Debounced while typing (storage.sync allows ~120 writes a minute), immediate on change.
document.addEventListener('input', (e) => {
  dirty.add(e.target.id);
  showErrors();
  clearTimeout(timer);
  timer = setTimeout(save, 400);
});
document.addEventListener('change', save);
