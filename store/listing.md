# Store listing

Version 0.3.0 was submitted to the Chrome Web Store on 2026-11-24 and is pending review. The text below is what was submitted. Field names follow the store's developer dashboard; the Edge Add-ons dashboard asks for the same things.

## Package

`npm run package` writes `dist/pr-focus-<version>.zip`. Upload that file.

## Store listing tab

**Name**

PR Focus

**Summary** (the manifest `description`, 126 of 132 characters)

Hides bot and draft PRs on GitHub PR lists, shows a PR's diff in sections with the code first, and links PRs to Linear issues.

**Detailed description**

```
Faster PR review on GitHub: hides Dependabot, bots and drafts from pull request lists, shows the diff with the code first and tests and lockfiles in their own sections, and links PRs to Linear.

- Hides pull requests from Dependabot, Renovate and other bots, and other people's drafts.
- Shows each diff in sections: code first, then tests, lockfiles and generated files.
- Groups the changed-files tree the same way. One click switches back to GitHub's view.
- Adds a button that opens a pull request's Linear issue.

No token, no account, no data collected. Not affiliated with GitHub or Linear.
```

The description is 597 characters. Keep it short: one sentence with the words people search for, one bullet per feature, one line on privacy.

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
| Screenshot 1, 1280x800 | `store/screenshots/1-before-after.png` | Ready. Before and after: GitHub's own changed files with the tests first, next to **Sections** with the code first and the file tree in sections. |
| Screenshot 2, 1280x800 | `store/screenshots/2-diff-sections.png` | Ready. A PR's changed files in **Sections**: the bar, the file tree in sections with the four kinds of change, and the code first. |
| Screenshot 3, 1280x800 | `store/screenshots/3-noise-hidden.png` | Ready. Bot and draft PRs hidden, with the count bar. |
| Screenshot 4, 1280x800 | `store/screenshots/4-diff-code-folded.png` | Ready. The same PR as 2 with `Code` folded, so the tests come first. |
| Screenshot 5, 1280x800 | `store/screenshots/5-shown-dimmed.png` | Ready. The same list as 3 after **Show them**. |
| Small promo tile, 440x280 | | Optional, not made. |
| Marquee promo tile, 1400x560 | | Optional, not made. |

The icon is an original drawing of a cat head crossed by one highlighted row, the pull request in focus. It is not GitHub's Octocat or Invertocat mark and does not reuse their shapes; keep it that way if the icon changes.

Screenshots 1, 2 and 4 are of `github.com/withastro/astro/pull/9647`, which adds, changes, deletes and renames files, and 3 and 5 of `github.com/dependabot/dependabot-core/pulls`. Both are public repositories, scrolled so the signed-in account in GitHub's header is out of view. Screenshot 1 puts two captures of the same PR side by side, scaled to 80%: **All** with the bar hidden, and **Sections**. Take new screenshots from public repositories only. The store shows at most five screenshots, ordered by impact: the before and after first.

There is no screenshot of the Linear button yet. It needs a public repository whose pull request titles carry Linear keys.

## Privacy practices tab

**Single purpose**

Declutters GitHub pull requests: hides noise pull requests on lists, shows a pull request's changed files in sections with the code first, and links each pull request to its Linear issue.

**Permission justification: storage**

Saves the user's settings: which pull requests to hide, a title pattern, how tests and noise files are shown and which file patterns count, the Linear workspace and the Linear team keys.

**Permission justification: host permission (content script on https://github.com/*)**

Reads pull request list rows, pull request page headers and the file names of a pull request's changed files on github.com, to hide noise pull requests, to group the changed files into sections, and to add links to Linear issues. It is declared for all github.com pages because GitHub moves between pages without reloading, so a script limited to pull request URLs would not be there when the user navigates to one. On other pages it reads nothing.

**Remote code**

No, I am not using remote code. All code ships in the package. The extension makes no network requests.

**Data usage**

The extension collects nothing. None of the data types in the form apply: no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content is collected or transmitted. The content script reads pull request rows and changed file names inside the page to decide what to hide and how to group the files, and that information never leaves the browser.

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
3. Open https://github.com/vitejs/vite/pull/24039/files. The diff and the file list are in sections: Code, Tests, Lockfiles. A bar above the files counts them. "All" restores GitHub's view.
4. Settings are in the toolbar popup.
No account, no network requests, no remote code.
```

The store limits this field to 500 characters. The text above is 487.

## Next version

- Bump `manifest.json` and `package.json`, run `npm run package` after the last commit, and upload the zip as a new version of the existing item.
- Copy any changed text above into the dashboard, then save the draft before submitting.
- Optional: a Linear button screenshot from a public repository, and the promo tiles.
