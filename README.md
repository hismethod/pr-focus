# PR Focus

A Chromium extension (Manifest V3) that hides noise pull requests on GitHub's PR lists so the ones that need a human stand out, and adds a button that opens a PR's Linear issue.

## What it does

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

Pages covered: repository PR lists (`/<owner>/<repo>/pulls`, any filter), the global PR dashboard (`/pulls`, `/pulls/inbox`, `/pulls/authored`, `/pulls/assigned`, `/pulls/involves`, `/pulls/reviews`, `/pulls/search`, saved views), and PR pages (`/<owner>/<repo>/pull/<n>` and its tabs). It keeps working across GitHub's in-page navigation, and when signed out.

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
| Linear workspace | empty | The part after `linear.app/`; a pasted Linear URL also works. |
| Linear team keys | empty | Comma or space separated, for example `ENG, OPS`. Empty accepts any key. |

## Privacy and permissions

- Permissions: `storage`, plus a content script on `https://github.com/*`. It has to run on every GitHub page because GitHub navigates between pages without reloading. Outside PR lists and PR pages it reads nothing.
- No GitHub or Linear token, no network requests, no analytics. It only reads what the page already shows. Linear buttons are plain links.
- [PRIVACY.md](PRIVACY.md) is the privacy policy for a store listing.

## How it works

- `src/rules.js`: pure rule logic (which rows are noise, author parsing, Linear keys, bar text). No DOM. Unit-tested.
- `src/github.js`: **every GitHub DOM selector**, plus the functions that read a PR row or a PR page.
- `src/content.js`: hides rows, draws the count bar and Linear buttons. Re-applied on DOM changes through a `MutationObserver` (batched to one pass per animation frame, so a background tab catches up when it is shown). Each pass removes any bar, button or hidden mark it did not confirm, so a failed read shows rows instead of hiding them.
- `src/options.html` / `src/options.js`: the popup and options page (same file).
- `icons/`: `icon.svg` is the source of the extension icon, a cat head crossed by one highlighted row (an original drawing, not GitHub's mark). The 16, 32, 48 and 128 px PNGs are renders of it. The 128 px one is 96 px artwork with 16 px of transparent padding, as the Chrome Web Store asks. `design/icon-candidates/` keeps the three candidates that were compared; the icon is `b-cat-row.svg`.

No build step and no dependencies.

## Tests

```sh
npm test   # node --test, Node 18 or newer
```

`test/rules.test.js` covers the rules, `test/options.test.js` runs the options page against a fake document and `chrome.storage`, and `test/manifest.test.js` checks the manifest's files, version and permissions. Selectors cannot be unit-tested against GitHub, so check them by hand before a release.

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

## Known limits and fragile spots

- **GitHub markup.** GitHub's React UI hashes its CSS class names, so the selectors in `src/github.js` use only `data-testid` / `data-listview-component` attributes, `href` shapes, octicon class names, the `user-login` meta tag and `header h1`. If GitHub renames those, rows stop being hidden (never the other way round); update `src/github.js`. Checked in a Chromium browser against github.com on 2026-11-23.
- **Dashboard authors.** `/pulls/inbox` and `/pulls/search` show no author link, so the author is read from the row text (`owner/repo#123 • author • Updated`, `owner/repo#123 · author opened`). If GitHub changes that line, bot PRs stop being hidden there and drafts are shown.
- **Hidden rows still count toward GitHub's page size.** A page of 25 can show fewer than 25 PRs, and the Open/Closed counts include hidden PRs.
- **Linear keys** are a pattern (`ABC-123`) with a small deny list (`CVE-`, `UTF-`, `SHA-`, `FIX-`, `RELEASE-`, ...). Without team keys, other look-alikes can produce a button to an issue that does not exist. List rows only see the title.
- The PR page's head branch is read from the last branch link in the header.
- **Copilot PRs are kept on purpose.** A PR opened through GitHub Copilot lists the author as `Copilot`. It opens as a draft, which the draft rule hides, and needs a human review once it is ready.

## Rules considered and skipped

- **Labels** (for example `dependencies`): labels are not rendered in GitHub's compact list density, so the rule would silently stop working there.
- **Extra author list** (your own bot accounts without a `[bot]` suffix, or Copilot): easy to add later; for now a title pattern covers most of them.
- **CI failing / already reviewed / stale**: GitHub renders these lazily or not at all on the list, and reading them reliably would need extra requests.
