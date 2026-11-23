# PR Focus

A Chromium extension (Manifest V3) that hides noise pull requests on GitHub's PR lists so the ones that need a human stand out, and adds a button that opens a PR's Linear issue.

## What it does

- **Hides bot PRs** (on by default): authors `dependabot`, `renovate`, `renovate-bot`, `github-actions`, and any author ending in `[bot]` (for example `dependabot[bot]`, `renovate[bot]`).
- **Hides draft PRs** (on by default).
- **Optional rule**, off by default: **titles matching a regular expression** (case-insensitive), for example `^chore\(deps\)|^bump `.
- **Hidden count and toggle**: a bar above the list says how many PRs are hidden and why (`PR Focus: 7 PRs hidden (4 bot, 3 draft)`). Its **Show them** button shows the hidden rows dimmed; **Hide them** hides them again. The choice lasts until the tab reloads. A row you tick stays visible (dimmed) while it is ticked, so GitHub's select-all checkbox never selects rows you cannot see.
- **Linear button**: a `↗ ENG-123` button that opens `https://linear.app/<workspace>/issue/ENG-123`.
  - On **PR list rows** when the title contains a key like `ENG-123`. Branch names and Linear links are not shown on list rows, so only the title is used there. Needs the workspace option.
  - On the **PR page**, next to the title, from the title, the head branch name (Linear's `user/eng-123-some-title` form), and the first `linear.app/<workspace>/issue/<KEY>` link on the page. That link usually comes from the PR body or from Linear's own linkback comment. Up to three buttons.
  - The workspace slug comes from a Linear issue link on the page when there is one, otherwise from the option. If neither is known, no button is shown.

Pages covered: repository PR lists (`/<owner>/<repo>/pulls`, any filter), the global PR dashboard (`/pulls`, `/pulls/inbox`, `/pulls/authored`, `/pulls/assigned`, `/pulls/involves`, `/pulls/reviews`, saved views), and PR pages (`/<owner>/<repo>/pull/<n>` and its tabs). It keeps working across GitHub's in-page navigation.

## Install (load unpacked)

1. Open `chrome://extensions` (in Edge: `edge://extensions`, in Brave: `brave://extensions`).
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick **this repository's root folder**, the one that contains `manifest.json`.
4. Open a GitHub PR list. Settings are in the toolbar popup (puzzle icon > PR Focus) and on the extension's **Details > Extension options** page.

After changing the code, click the reload icon on the extension's card and reload the GitHub tab.

## Settings

Stored in `chrome.storage.sync`, so they follow your browser profile. Only the settings you change are stored; the rest follow the defaults below.

| Setting | Default | |
| --- | --- | --- |
| PRs opened by bots | on | |
| Draft PRs | on | |
| Titles matching | empty | Invalid patterns are ignored and flagged in the popup. |
| Linear workspace | empty | The part after `linear.app/`; a pasted Linear URL also works. |

## Privacy and permissions

- Permissions: `storage`, plus a content script on `https://github.com/*`. It has to run on every GitHub page because GitHub navigates between pages without reloading.
- No GitHub or Linear token, no network requests, no analytics. It only reads what the page already shows. Linear buttons are plain links.

## How it works

- `src/rules.js`: pure rule logic (which rows are noise, Linear key detection). No DOM. Unit-tested.
- `src/github.js`: **every GitHub DOM selector**, plus the functions that read a PR row or a PR page.
- `src/content.js`: hides rows, draws the count bar and Linear buttons. Re-applied on DOM changes through a `MutationObserver` (batched to one pass per animation frame).
- `src/options.html` / `src/options.js`: the popup and options page (same file).
- `icons/`: `icon.svg` is the source of the extension icon; the 16, 32, 48 and 128 px PNGs are renders of it.

No build step and no dependencies.

## Tests

```sh
npm test   # node --test, Node 18 or newer
```

## Known limits and fragile spots

- **GitHub markup.** GitHub's React UI hashes its CSS class names, so the selectors in `src/github.js` use only `data-testid` / `data-listview-component` / `data-hovercard-type` attributes, octicon class names and `header h1`. If GitHub renames those, rows stop being hidden; update `src/github.js`. Checked against github.com on 2026-11-23.
- **Inbox author.** `/pulls/inbox` shows no author link, so the author is read from the `owner/repo#123 • author • Updated` text. Bot PRs in the inbox were not available to check.
- **Hidden rows still count toward GitHub's page size.** A page of 25 can show fewer than 25 PRs, and the Open/Closed counts include hidden PRs.
- **Linear keys** are a pattern (`ABC-123`) with a small deny list (`CVE-`, `UTF-`, `SHA-`, ...). Other look-alikes can produce a button to an issue that does not exist. List rows only see the title. The PR page uses the *first* Linear issue link, which can be a related issue rather than the linked one when the PR body mentions several.
- The PR page's head branch is read from the second branch link in the header.

## Rules considered and skipped

- **Labels** (for example `dependencies`): labels are not rendered in GitHub's compact list density, so the rule would silently stop working there.
- **Extra author list** (your own bot accounts without a `[bot]` suffix): easy to add later; for now a title pattern covers most of them.
- **CI failing / already reviewed / stale**: GitHub renders these lazily or not at all on the list, and reading them reliably would need extra requests.
