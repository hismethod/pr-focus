// Shared by the toolbar popup and the options page. Every input's id is a settings key.
const inputs = Object.keys(prFocus.DEFAULTS).map((key) => document.getElementById(key));
let timer;

const valueOf = (input) => (input.type === 'checkbox' ? input.checked : input.value.trim());

function showErrors() {
  const { titlePattern, linearWorkspace } = Object.fromEntries(inputs.map((i) => [i.id, valueOf(i)]));
  document.getElementById('titlePatternError').hidden = !titlePattern || !!prFocus.titleRegex(titlePattern);
  document.getElementById('linearWorkspaceError').hidden = !linearWorkspace || !!prFocus.workspaceSlug(linearWorkspace);
}

function save() {
  clearTimeout(timer);
  chrome.storage.sync.set(Object.fromEntries(inputs.map((i) => [i.id, valueOf(i)])));
}

chrome.storage.sync.get(prFocus.DEFAULTS, (settings) => {
  for (const input of inputs) input[input.type === 'checkbox' ? 'checked' : 'value'] = settings[input.id];
  showErrors();
});

// Debounced while typing (storage.sync allows ~120 writes a minute), immediate on change.
document.addEventListener('input', () => {
  showErrors();
  clearTimeout(timer);
  timer = setTimeout(save, 400);
});
document.addEventListener('change', save);
