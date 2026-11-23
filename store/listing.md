# Store listing

Prepared, not submitted. Where to publish is not decided yet. Field names follow the Chrome Web Store developer dashboard; the Edge Add-ons dashboard asks for the same things.

## Package

`npm run package` writes `dist/pr-focus-<version>.zip`. Upload that file.

## Store listing tab

**Name**

PR Focus

**Summary** (the manifest `description`, 128 of 132 characters)

Hides bot and draft pull requests on GitHub PR lists so the ones that need you stand out, and links each PR to its Linear issue.

**Detailed description**

```
PR Focus declutters GitHub pull request lists so the pull requests that need a person stand out.

What it does
- Hides pull requests opened by bots such as Dependabot, Renovate and github-actions, and any author ending in [bot].
- Hides other people's draft pull requests. Your own drafts always stay.
- Optionally hides pull requests whose title matches a regular expression you set.
- Shows how many pull requests are hidden and why, with a button to show them dimmed and to hide them again.
- Adds a button next to a pull request that opens its Linear issue when the title, the branch or a Linear link names one, for example ENG-123. Set your Linear workspace in the options to use it.

Where it works
Repository pull request lists, the pull request dashboard at github.com/pulls, and pull request pages.

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
| Small promo tile, 440x280 | | Optional, not made. |
| Marquee promo tile, 1400x560 | | Optional, not made. |

The icon is an original drawing of a cat head crossed by one highlighted row, the pull request in focus. It is not GitHub's Octocat or Invertocat mark and does not reuse their shapes; keep it that way if the icon changes.

Both screenshots are of `github.com/dependabot/dependabot-core/pulls`, a public repository, scrolled so the signed-in account in GitHub's header is out of view. Take new screenshots from public repositories only.

There is no screenshot of the Linear button yet. It needs a public repository whose pull request titles carry Linear keys.

## Privacy practices tab

**Single purpose**

Declutters GitHub pull request lists so the pull requests that need a person stand out, with a link from each pull request to its Linear issue.

**Permission justification: storage**

Saves the user's settings: which pull requests to hide, a title pattern, the Linear workspace and the Linear team keys.

**Permission justification: host permission (content script on https://github.com/*)**

Reads pull request list rows and pull request page headers on github.com to hide noise pull requests and to add links to Linear issues. It is declared for all github.com pages because GitHub moves between pages without reloading, so a script limited to pull request URLs would not be there when the user navigates to one. On other pages it reads nothing.

**Remote code**

No, I am not using remote code. All code ships in the package. The extension makes no network requests.

**Data usage**

The extension collects nothing. None of the data types in the form apply: no personally identifiable information, health, financial, authentication, personal communications, location, web history, user activity or website content is collected or transmitted. The content script reads pull request rows inside the page to decide what to hide, and that information never leaves the browser.

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
2. Open https://github.com/dependabot/dependabot-core/pulls
3. Pull requests opened by bots and draft pull requests are hidden. A bar above the list says how many, for example "PR Focus: 6 PRs hidden (3 bot, 3 draft)".
4. Click "Show them" in that bar. The hidden pull requests appear dimmed. "Hide them" hides them again.
5. Settings are in the toolbar popup. The Linear button needs a Linear workspace name in the settings and a pull request whose title names a Linear issue, for example ENG-123.
The extension has no account, makes no network requests and uses no remote code.
```

## Before submitting

- Register the developer account and verify the contact email.
- Decide the release version. `manifest.json` and `package.json` are at 0.2.0.
- Optional: a Linear button screenshot from a public repository, and the promo tiles.
