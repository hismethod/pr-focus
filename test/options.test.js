// options.js against a fake document and a fake chrome.storage: which keys it saves and which fields it leaves alone.
const test = require('node:test');
const assert = require('node:assert/strict');
const prFocus = require('../src/rules.js');

function openOptions(stored = {}) {
  const elements = {};
  const el = (id) =>
    (elements[id] ||= { id, type: typeof prFocus.DEFAULTS[id] === 'boolean' ? 'checkbox' : 'text', value: '', hidden: true });
  const on = {};
  const page = { el, on, stored, writes: [], failing: false };
  const document = { activeElement: null, hidden: false, getElementById: el, addEventListener: (type, fn) => (on[type] = fn) };
  const chrome = {
    runtime: {},
    storage: {
      onChanged: { addListener: (fn) => (on.storage = fn) },
      sync: {
        get: (defaults, done) => done({ ...defaults, ...stored }),
        set(values, done) {
          page.writes.push(values);
          chrome.runtime.lastError = page.failing ? { message: 'quota' } : undefined;
          if (!page.failing) Object.assign(stored, values);
          done();
        },
      },
    },
  };
  Object.assign(globalThis, { prFocus, document, chrome, addEventListener: (type, fn) => (on[type] = fn) });
  delete require.cache[require.resolve('../src/options.js')];
  require('../src/options.js');
  page.document = document;
  // An edit as the browser reports it: the field changes, then an input event (which starts the debounce).
  page.edit = (id, value) => {
    el(id)[el(id).type === 'checkbox' ? 'checked' : 'value'] = value;
    on.input({ target: el(id) });
  };
  return page;
}

test('fields show the stored settings, or the defaults', () => {
  const page = openOptions({ linearWorkspace: 'acme' });
  assert.equal(page.el('linearWorkspace').value, 'acme');
  assert.equal(page.el('hideDrafts').checked, true);
});

test('only the edited setting is saved', () => {
  const page = openOptions({ titlePattern: 'old', linearWorkspace: 'acme' });
  page.edit('hideDrafts', false);
  page.on.change();
  assert.deepEqual(page.writes, [{ hideDrafts: false }]);
});

test('a change made elsewhere refreshes the fields, except the one being edited', () => {
  const page = openOptions();
  page.document.activeElement = page.el('titlePattern');
  page.el('titlePattern').value = 'typing';
  Object.assign(page.stored, { titlePattern: 'elsewhere', linearWorkspace: 'other' });
  page.on.storage();
  assert.equal(page.el('linearWorkspace').value, 'other');
  assert.equal(page.el('titlePattern').value, 'typing');
});

test('closing the page saves an edit that is still waiting for the debounce', () => {
  const page = openOptions();
  page.edit('titlePattern', '^bump');
  page.on.pagehide();
  assert.deepEqual(page.writes, [{ titlePattern: '^bump' }]);
});

test('a failed save is shown and sent again with the next save', () => {
  const page = openOptions();
  page.failing = true;
  page.edit('hideBots', false);
  page.on.change();
  assert.equal(page.el('saveError').hidden, false);
  page.failing = false;
  page.edit('linearTeams', 'eng');
  page.on.change();
  assert.deepEqual(page.writes[1], { hideBots: false, linearTeams: 'eng' });
  assert.equal(page.el('saveError').hidden, true);
});

test('a pattern that matches every title is flagged, an invalid one too', () => {
  const page = openOptions();
  page.edit('titlePattern', 'a|');
  assert.equal(page.el('titlePatternAll').hidden, false);
  assert.equal(page.el('titlePatternError').hidden, true);
  page.edit('titlePattern', '(');
  assert.equal(page.el('titlePatternAll').hidden, true);
  assert.equal(page.el('titlePatternError').hidden, false);
  page.on.change();
});
