// The manifest must point at files that exist, and its version must match package.json (the zip is named after it).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const manifest = require('../manifest.json');

test('every file the manifest names exists', () => {
  const files = [
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
    manifest.action.default_popup,
    manifest.options_ui.page,
    ...manifest.content_scripts.flatMap((script) => [...script.js, ...script.css]),
  ];
  for (const file of files) assert.ok(fs.existsSync(path.join(root, file)), file);
});

test('manifest and package.json carry the same version', () => {
  assert.equal(manifest.version, require('../package.json').version);
});

test('permissions stay at storage plus the github.com content script', () => {
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.equal(manifest.host_permissions, undefined);
  assert.deepEqual(manifest.content_scripts.map((script) => script.matches), [['https://github.com/*']]);
});
