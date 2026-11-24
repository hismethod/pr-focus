# PR Focus

A Chromium extension (Manifest V3) that hides noise pull requests on GitHub's PR lists so the ones that need a human stand out, sorts tests and noise files out of a PR's diff, and adds a button that opens a PR's Linear issue.

## What it does

### On PR lists

- **Hides bot PRs** (on by default): authors `dependabot`, `renovate`, `renovate-bot`, `github-actions`, and any author ending in `[bot]` (for example `dependabot[bot]`, `renovate[bot]`).
- **Hides other people's draft PRs** (on by default). Your own drafts are never hidden, and neither is a draft whose author cannot be read.
- **Optional rule**, off by default: **titles matching a regular expression** (case-insensitive), for example `^chore\(deps\)|^bump `.
- **Hidden count and toggle**: a bar above the list says how many PRs are hidden and why (`PR Focus: 7 PRs hidden (4 bot, 3 draft)`). Its **Show them** button shows the hidden rows dimmed; **Hide them** hides them again. The choice lasts until the tab reloads.
- **Ticked rows stay visible.** A hidden row you tick is shown dimmed while it is ticked, and the bar says so (`5 PRs hidden, 2 shown because selected`). GitHub's select-all checkbox ticks every row, so a bulk action never reaches rows you cannot see.
- **Linear button**: a `↗ ENG-123` button that opens `https://linear.app/<workspace>/issue/ENG-123`.
  - On **PR list rows** when the title contains a key like `ENG-123`. Branch names and Linear links are not shown on list rows, so only the title is used there. Needs the workspace option.
  - On the **PR page**, next to the title: keys in the title, in the head branch name (Linear's `user/eng-123-some-title` form), and the issue from a Linear link on the page. The link in Linear's own linkback comment is preferred; otherwise the first Linear issue link on the page. Up to three buttons.
  - Title and branch keys open in the workspace from the option. When the option is empty, they use the workspace of the page's Linear link. The linked issue always opens with its own link's workspace. If no workspace is known, no button is shown.
  - Set **Team keys** (for example `ENG, OPS`) to get buttons only for those prefixes. Without it, anything shaped like `ABC-123` in a title gets a button, including Jira keys in other repositories.

### In a PR's changed files

A bar above the changed files counts the tests and noise in the diff and offers two ways to show the files. The choice is remembered for every PR, and **Alt+Shift+F** switches it.

| Mode | What you see | Bar text |
| --- | --- | --- |
| **All** (default) | GitHub's own view. | `PR Focus: tests & noise in 5 of 10 files (4 tests, 1 lockfile) · +291 −97` |
| **Sections** | The code first, then a section for each kind of noise, in the diff and in the file list on the left. | `5 files in sections below (4 tests, 1 lockfile) · +291 −97 · 5 files of code first, +26 −17` |

In **Sections**:

- **The diff** has a heading above each section with its file count and line counts (`Code · 5 files · +26 −17`, `Tests · 4 files · +98 −7`). The sections come in the order Code, Tests, Lockfiles, Generated, Custom.
- **The file list on the left** is PR Focus's own list in the place of GitHub's file tree, with the same sections and headings. Inside a section the files are a folder tree like GitHub's: a chain of folders with nothing else in them is one row (`packages/vite/src/node/__tests__`). Each file shows its added and removed lines. A click goes to the file through GitHub's own link, so the page moves as it does from GitHub's tree.
- **A heading folds its section** in both places at once. Folding Code brings the tests to the top.
- **GitHub's filter still works.** The filter field and its options take files out of the page, and the sections and the list follow.
- **Viewed files** are dimmed and ticked in the list.

Four kinds of file count as noise. Each built-in kind can be switched off in the options.

- **Tests**: `*.test.*`, `*.spec.*`, `*.e2e.*`, `*.e2e-spec.*`, `*_test.*`, `test_*.py`, `conftest.py`, `*_spec.rb`, `*Test.java`, `*Tests.java`, `*Test.kt`, `*Tests.kt`, `*Tests.swift`, `*Test.cs`, `*Tests.cs`, `*Test.php`, and anything in the folders `__tests__`, `test`, `tests`, `Tests`, `*.Tests`, `e2e`, `cypress`, `fixtures`, `__fixtures__`, `__mocks__`, `testdata`.
- **Lockfiles**: `*.lock` (yarn, Cargo, poetry, Gemfile, composer, Podfile, Pipfile, uv, bun, deno, flake, mix, pubspec), `package-lock.json`, `npm-shrinkwrap.json`, `pnpm-lock.yaml`, `bun.lockb`, `go.sum`, `Package.resolved`, `packages.lock.json`, `gradle.lockfile`, `.terraform.lock.hcl`.
- **Generated**: files GitHub itself marks as generated, `*.snap`, `*.min.js`, `*.min.css`, `*.map`, `*.pb.go`, `*_pb2.py`, `*.g.dart`, `*.generated.*`, `*.gen.*`, `*_generated.*`, and anything in the folders `__snapshots__`, `dist`, `build`, `vendor`, `node_modules`.
- **Custom**: your own globs, one per line. They read like `.gitignore` lines: `*` stays inside a folder, `**` crosses folders, a glob without a slash matches at any depth (`*.md`), a glob with a slash starts at the repository root (`src/legacy/**`), and a folder covers everything in it (`docs/`).

A file belongs to the first kind it matches, in the order above. Switching a kind off shows its files even when GitHub marks them as generated.

### Pages covered

Repository PR lists (`/<owner>/<repo>/pulls`, any filter), the global PR dashboard (`/pulls`, `/pulls/inbox`, `/pulls/authored`, `/pulls/assigned`, `/pulls/involves`, `/pulls/reviews`, `/pulls/search`, saved views), and PR pages (`/<owner>/<repo>/pull/<n>` and its tabs), including the changed files in both of GitHub's views: the newer one at `/pull/<n>/changes` and the older one at `/pull/<n>/files`. It keeps working across GitHub's in-page navigation, and when signed out.

## Install (load unpacked)

1. Open `chrome://extensions` (in Edge: `edge://extensions`, in Brave: `brave://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick **this repository's root folder**, the one that contains `manifest.json`.
4. Open a GitHub PR list. Settings are in the toolbar popup (puzzle icon > PR Focus) and on the extension's **Details > Extension options** page.

After changing the code, click the reload icon on the extension's card and reload the GitHub tab. Needs Chrome 105 or newer.

## Settings

Stored in `chrome.storage.sync`, so they follow your browser profile. Only the settings you change are stored; the rest follow the defaults below.

| Setting | Default | |
| --- | --- | --- |
| PRs opened by bots | on | |
| Draft PRs | on | Never your own drafts. |
| Titles matching | empty | Invalid patterns are ignored and flagged. A pattern that matches every title is flagged too. |
| Tests & noise in a PR's changed files | All | All or Sections. The same choice as the buttons above the changed files. |
| Tests | on | |
| Lockfiles | on | |
| Generated files | on | Includes files GitHub marks as generated. |
| Custom globs | empty | One per line, read like `.gitignore` lines. |
| Linear workspace | empty | The part after `linear.app/`; a pasted Linear URL also works. |
| Linear team keys | empty | Comma or space separated, for example `ENG, OPS`. Empty accepts any key. |

## Privacy and permissions

- Permissions: `storage`, plus a content script on `https://github.com/*`. It has to run on every GitHub page because GitHub navigates between pages without reloading. Outside PR lists and PR pages it reads nothing. In a PR's changed files it reads each file's path and line counts.
- No GitHub or Linear token, no network requests, no analytics. It only reads what the page already shows. Linear buttons are plain links.
- [PRIVACY.md](PRIVACY.md) is the privacy policy for a store listing.

## How it works

- `src/rules.js`: pure rule logic (which rows and files are noise, globs, author parsing, Linear keys, bar text). No DOM. Unit-tested.
- `src/github.js`: **every GitHub DOM selector**, plus the functions that read a PR row, a PR page, the changed files and the file tree.
- `src/content.js`: hides rows, marks changed files, draws the bars, section headings, the sectioned file list and Linear buttons. Re-applied on DOM changes through a `MutationObserver` (batched to one pass per animation frame, so a background tab catches up when it is shown). Each pass removes any bar, heading, list, button or hidden mark it did not confirm, so a failed read shows rows instead of hiding them.
- `src/content.css`: the rules that hide and move things. For changed files, `content.js` only marks each file with its kind. The CSS reorders marked files, folds a section and hides GitHub's file tree only while the bar, the section's heading or our own file list is on the page. If one of them cannot be drawn, the page is GitHub's again.
- **Sections does not move any of GitHub's elements.** GitHub's list of files is a flex column, so CSS `order` puts the code first and each kind below its heading. The headings are the only elements added to that list. React keeps rendering its own children in its own order, and lazily loaded diffs keep loading.
- **GitHub's file tree is hidden, not changed.** Our list is inserted right before it, and one CSS rule hides whatever follows our list. The list is built from the file headers GitHub has on the page (they are all there before the diffs load) plus the files only the tree lists.

No build step and no dependencies.

## Tests

```sh
npm test   # node --test, Node 18 or newer
```

`test/rules.test.js` covers the PR list and Linear rules, `test/files.test.js` covers which changed files are noise (made-up paths), `test/options.test.js` runs the options page against a fake document and `chrome.storage`, and `test/manifest.test.js` checks the manifest's files, version and permissions. Selectors cannot be unit-tested against GitHub, so check them by hand before a release.

## Release

```sh
npm run package   # writes dist/pr-focus-<version>.zip from the committed manifest.json, src and icons
```

The zip is built from the last commit, so commit first. Bump `version` in `manifest.json` and `package.json` together (a test compares them). The store listing text, permission justifications and screenshots are in [store/](store/listing.md).

Check by hand before each release, with the extension loaded:

1. A public repository's PR list, for example `github.com/dependabot/dependabot-core/pulls`: bot and draft PRs are hidden, the bar shows the count, **Show them** and **Hide them** work.
2. Page 2 of that list through GitHub's own pagination link: the bar and the toggle state carry over.
3. `github.com/pulls` (the inbox): bot PRs are hidden, your own PRs and drafts stay.
4. A PR page with a Linear link: the Linear button sits next to the title.
5. The same public list signed out: turn on **Allow in Incognito** on the extension's details page and open the list in an incognito window. Rows are still hidden.
6. A repository where you can tick rows: select all, and the bar says the hidden rows are shown because selected.
7. The changed files of a PR with tests and a lockfile, for example `github.com/vitejs/vite/pull/24039/files`: the bar counts them. **Sections** puts the code first with `Code`, `Tests` and `Lockfiles` headings, and the file list on the left shows the same three sections in place of GitHub's tree. **All** brings GitHub's view and tree back.
8. In Sections: click a file in the list and the page goes to it. Fold `Code` in the list and the code folds in the diff too. Type in GitHub's filter field and both follow.
9. On that PR, go to the Commits tab and back to Files changed through GitHub's own tabs: the bar and the mode carry over. Open another PR: the mode is the same.
10. The same PR signed out (the older files view): Sections works there too.

When you load the unpacked folder for development, switch off any other copy of PR Focus first (the Web Store one). Two copies remove each other's bars.

## Known limits and fragile spots

- **GitHub markup.** GitHub's React UI hashes its CSS class names, so the selectors in `src/github.js` use only `data-testid` / `data-listview-component` attributes, `href` shapes, octicon class names, the `user-login` meta tag and `header h1`. If GitHub renames those, rows stop being hidden (never the other way round); update `src/github.js`. Checked in a Chromium browser against github.com on 2026-11-23.
- **Dashboard authors.** `/pulls/inbox` and `/pulls/search` show no author link, so the author is read from the row text (`owner/repo#123 • author • Updated`, `owner/repo#123 · author opened`). If GitHub changes that line, bot PRs stop being hidden there and drafts are shown.
- **Changed files markup.** Files are read from GitHub's file headers: the path, the `Lines changed: 19 additions & 2 deletions` text for screen readers, and the diff anchor that ties a file to its tree entry. The newer view is found through `data-testid="progressive-diffs-list"`, the older one through `#files .file`. If GitHub renames those, the bar does not appear and every file shows. Checked on 2026-11-24, signed in (newer view, split layout) and signed out (older view, unified layout).
- **Sections depends on GitHub's list being a flex column.** If GitHub lays the list out another way, files stay in GitHub's order and the headings gather at the top. In the older view the CSS flattens GitHub's batch containers (`.js-diff-progressive-container`, `copilot-diff-entry`) to get one column.
- **Our file list depends on where GitHub's tree is.** It is found through `ul[aria-label="File Tree"]`. When GitHub's tree is not on the page (you closed the file tree panel), there is no list, and the diff is still in sections.
- **The list is simpler than GitHub's tree.** Its folders do not fold, it has no file type icons and no marker for the file you are at, and it is not a keyboard tree: Tab moves through the files. All shows GitHub's tree again.
- **Sections changes what you see, not GitHub's order.** GitHub's own next and previous file keys and the tab order in the diff follow GitHub's order, so they jump between sections.
- **Folded sections are not remembered.** They open again when the tab reloads. The mode is remembered.
- **Viewed is read from the newer view only.** The older view's Viewed checkbox is not read. Viewed state was checked by setting the button's state in the page, not by marking a real file as viewed.
- **Counts cover the files GitHub has put on the page.** The newer view lists every file up front. The older view adds files in batches while you scroll, so its counts grow.
- **Generated files are known while GitHub shows its note.** GitHub marks a generated file by showing "Some generated files are not rendered by default" in place of the diff. After you load that diff the note is gone, and the file counts as generated only if a glob names it.
- **Alt+Shift+F** was checked on macOS against GitHub's own shortcut list (GitHub uses Option+Shift+R, not F). It was not checked on Windows or Linux. It does nothing while you type in a field.
- **Hidden rows still count toward GitHub's page size.** A page of 25 can show fewer than 25 PRs, and the Open/Closed counts include hidden PRs.
- **Linear keys** are a pattern (`ABC-123`) with a small deny list (`CVE-`, `UTF-`, `SHA-`, `FIX-`, `RELEASE-`, ...). Without team keys, other look-alikes can produce a button to an issue that does not exist. List rows only see the title.
- The PR page's head branch is read from the last branch link in the header.
- **Copilot PRs are kept on purpose.** A PR opened through GitHub Copilot lists the author as `Copilot`. It opens as a draft, which the draft rule hides, and needs a human review once it is ready.

## Rules considered and skipped

- **A `spec/` folder as tests**: it holds RSpec tests in Ruby projects and API specifications elsewhere. `*_spec.rb` is covered; add `spec/` as a custom glob if you want the folder.
- **Regrouping GitHub's own file tree**: its items are nested by folder and belong to React, so moving them is unsafe. Sections hides the tree and draws its own list instead.
- **A Hide noise mode** that hid the noise files altogether: removed before 0.3.0 was released. Folding a section does the same for one kind at a time.

- **Labels** (for example `dependencies`): labels are not rendered in GitHub's compact list density, so the rule would silently stop working there.
- **Extra author list** (your own bot accounts without a `[bot]` suffix, or Copilot): easy to add later; for now a title pattern covers most of them.
- **CI failing / already reviewed / stale**: GitHub renders these lazily or not at all on the list, and reading them reliably would need extra requests.
