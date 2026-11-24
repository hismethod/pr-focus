# Store listing

Version 0.2.0 was submitted to the Chrome Web Store. The text below is for 0.3.0, which is not uploaded. Field names follow the store's developer dashboard; the Edge Add-ons dashboard asks for the same things.

## Package

`npm run package` writes `dist/pr-focus-<version>.zip`. Upload that file.

## Store listing tab

**Name**

PR Focus

**Summary** (the manifest `description`, 123 of 132 characters)

Hides bot and draft PRs on GitHub PR lists, sorts out tests and noise files in a PR's diff, and links PRs to Linear issues.

**Detailed description**

```
PR Focus declutters GitHub pull requests: the list shows the pull requests that need a person, and a pull request's diff shows the code before the tests and the noise.

On pull request lists
- Hides pull requests opened by bots such as Dependabot, Renovate and github-actions, and any author ending in [bot].
- Hides other people's draft pull requests. Your own drafts always stay.
- Optionally hides pull requests whose title matches a regular expression you set.
- Shows how many pull requests are hidden and why, with a button to show them dimmed and to hide them again.

In a pull request's changed files
- Counts the tests, lockfiles and generated files in the diff, with their added and removed lines.
- Sections: shows the code first, then a section each for tests, lockfiles and generated files. A section's heading shows its size and folds it away.
- Hide noise: hides those files in the diff and in the file tree, and says how many files and lines are left.
- All: GitHub's own view. This is the default. Your choice is remembered, and Alt+Shift+F steps through the three.
- You choose what counts: switch each kind off, or add your own file patterns such as *.md or docs/.

Linear
- Adds a button next to a pull request that opens its Linear issue when the title, the branch or a Linear link names one, for example ENG-123. Set your Linear workspace in the options to use it.

Where it works
Repository pull request lists, the pull request dashboard at github.com/pulls, and pull request pages with their changed files.

Privacy
No account, no token, no network requests, no analytics. PR Focus only reads what the GitHub page already shows, and stores your settings in Chrome's sync storage. Linear buttons are plain links.

PR Focus is not affiliated with GitHub or Linear.
```

**Category**

Developer Tools

**Language**

English

**Homepage URL**

https://github.com/hismethod/pr-focus

**Support URL** (optional)

https://github.com/hismethod/pr-focus/issues

**Official URL**

None. It lists only sites verified in Google Search Console, and there is none.

**Mature content**

No

## Graphic assets

| Asset | File | Status |
| --- | --- | --- |
| Store icon, 128x128 | `icons/icon-128.png` | Ready. 96 px artwork with 16 px of transparent padding. |
| Screenshot 1, 1280x800 | `store/screenshots/1-noise-hidden.png` | Ready. Bot and draft PRs hidden, with the count bar. |
| Screenshot 2, 1280x800 | `store/screenshots/2-shown-dimmed.png` | Ready. The same list after **Show them**. |
| Screenshot 3, 1280x800 | `store/screenshots/3-diff-sections.png` | Ready. A PR's changed files in **Sections**: the bar and the code first. |
| Screenshot 4, 1280x800 | `store/screenshots/4-diff-section-heading.png` | Ready. The same PR further down: the `Tests` heading and the test files. |
| Screenshot 5, 1280x800 | `store/screenshots/5-diff-noise-hidden.png` | Ready. The same PR in **Hide noise**. |
| Small promo tile, 440x280 | | Optional, not made. |
| Marquee promo tile, 1400x560 | | Optional, not made. |

The icon is an original drawing of a cat head crossed by one highlighted row, the pull request in focus. It is not GitHub's Octocat or Invertocat mark and does not reuse their shapes; keep it that way if the icon changes.

Screenshots 1 and 2 are of `github.com/dependabot/dependabot-core/pulls`, and 3 to 5 of `github.com/vitejs/vite/pull/24039`. Both are public repositories, scrolled so the signed-in account in GitHub's header is out of view. Take new screenshots from public repositories only. The store shows at most five screenshots.

There is no screenshot of the Linear button yet. It needs a public repository whose pull request titles carry Linear keys.

## Privacy practices tab

**Single purpose**

Declutters GitHub pull requests: hides noise pull requests on lists, sorts tests and noise files out of a pull request's diff, and links each pull request to its Linear issue.

**Permission justification: storage**

Saves the user's settings: which pull requests to hide, a title pattern, how tests and noise files are shown and which file patterns count, the Linear workspace and the Linear team keys.

**Permission justification: host permission (content script on https://github.com/*)**

Reads pull request list rows, pull request page headers and the file names of a pull request's changed files on github.com, to hide noise pull requests, to hide or regroup tests and noise files, and to add links to Linear issues. It is declared for all github.com pages because GitHub moves between pages without reloading, so a script limited to pull request URLs would not be there when the user navigates to one. On other pages it reads nothing.

**Remote code**

No, I am not using remote code. All code ships in the package. The extension makes no network requests.

**Data usage**

The extension collects nothing. None of the data types in the form apply: no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content is collected or transmitted. The content script reads pull request rows and changed file names inside the page to decide what to hide, and that information never leaves the browser.

All three certifications apply:

- Data is not sold or transferred to third parties.
- Data is not used or transferred for purposes unrelated to the single purpose.
- Data is not used or transferred to determine creditworthiness or for lending purposes.

**Privacy policy**

https://github.com/hismethod/pr-focus/blob/main/PRIVACY.md

The Chrome Web Store user data FAQ asks for a privacy policy even when data is only stored locally or in Chrome sync storage, so fill the field in.

## Distribution tab

| Field | Value |
| --- | --- |
| Paid item | No. Free, with no in-app purchases. |
| Visibility | Public |
| Regions | All regions |

## Account page

| Field | Value |
| --- | --- |
| Publisher name | The owner's choice. It shows as "Offered by" on the listing. |
| Contact email | mail@jungmin.me. The store sends a verification link to it. |
| Physical address | Not needed. It is only for items that sell something. |
| Trusted testers | Empty |

## Test instructions tab (optional)

The tab is meant for extensions that need credentials. PR Focus needs none, so these notes are enough.

```
1. Sign in to GitHub. (It also works signed out, on public repositories.)
2. Open https://github.com/dependabot/dependabot-core/pulls. Bot and draft pull requests are hidden. A bar above the list says how many.
3. Open https://github.com/vitejs/vite/pull/24039/files. A bar above the files counts tests and lockfiles. "Sections" moves them below the code. "Hide noise" hides them. "All" restores GitHub's view.
4. Settings are in the toolbar popup.
No account, no network requests, no remote code.
```

The store limits this field to 500 characters. The text above is 497.

## Before submitting

- `manifest.json` and `package.json` are at 0.3.0. Run `npm run package` after the last commit and upload `dist/pr-focus-0.3.0.zip` as a new version of the existing item.
- Replace the summary, the detailed description, the permission justifications and the test instructions with the text above, and add screenshots 3 to 5.
- Optional: a Linear button screenshot from a public repository, and the promo tiles.
