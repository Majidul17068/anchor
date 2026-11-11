# Anchor Marketplace: how it works without a server

The marketplace is a public GitHub repository. Anchor reads one JSON file
from it over HTTPS and never talks to any other backend.

Default source: `https://raw.githubusercontent.com/Majidul17068/anchor-marketplace/main/index.json`
(override with the `marketIndexUrl` setting).

## Repository layout

```
anchor-marketplace/
├── index.json          the catalog Anchor downloads (see schema below)
├── skills/<slug>/      each published skill folder (SKILL.md + files)
├── bundles/<slug>.zip  optional zip of the folder, referenced by bundleUrl
└── .github/ISSUE_TEMPLATE/
    ├── submission.yml  "[skill] …" issues opened by Publish
    ├── request.yml     "[request] …" issues opened by Requests
    └── review.yml      "[review] …" issues opened by reviews
```

Maintainers fold accepted issues into `index.json` (by hand or with a small
GitHub Action). Install counts are the number of accepted installs reported
through issues or left at 0; ratings come from review issues.

## index.json schema

```json
{
  "version": 1,
  "repo": "Majidul17068/anchor-marketplace",
  "featured": ["majidul/pr-reviewer"],
  "listings": [
    {
      "id": "majidul/pr-reviewer",
      "name": "PR Reviewer",
      "tagline": "Structured pull-request reviews with risk notes",
      "description": "Reviews a diff for correctness, security and style, then writes a summary in the repo's tone.",
      "version": "1.2.0",
      "author": { "id": "majidulislam17068@gmail.com", "name": "Majidul Islam" },
      "categories": ["Coding", "DevOps"],
      "installs": 42,
      "rating": 4.6,
      "ratingCount": 9,
      "trained": true,
      "visibility": "public",
      "license": "MIT",
      "files": [{ "path": "SKILL.md", "content": "---\nname: pr-reviewer\n..." }],
      "bundleUrl": "https://raw.githubusercontent.com/Majidul17068/anchor-marketplace/main/bundles/pr-reviewer.zip",
      "examples": [],
      "changelog": [{ "version": "1.2.0", "at": "2026-11-01T00:00:00Z", "notes": "Risk notes" }],
      "publishedAt": "2026-10-01T00:00:00Z",
      "updatedAt": "2026-11-01T00:00:00Z"
    }
  ],
  "requests": [
    {
      "id": "req-17",
      "title": "Skill for Firestore rules audits",
      "description": "…",
      "requester": { "id": "someone@gmail.com", "name": "Someone" },
      "status": "open",
      "replies": [],
      "at": "2026-11-05T00:00:00Z",
      "url": "https://github.com/Majidul17068/anchor-marketplace/issues/17"
    }
  ],
  "reviews": {
    "majidul/pr-reviewer": [
      { "id": "r1", "listingId": "majidul/pr-reviewer", "author": { "id": "a@b.c", "name": "A" }, "rating": 5, "text": "Great", "at": "2026-11-02T00:00:00Z" }
    ]
  }
}
```

Either `files` (inline) or `bundleUrl` (zip) must be present on a listing.

## What each UI action does

| Action | Behaviour |
|---|---|
| Browse / search / featured | Reads `index.json` (cached 10 minutes, falls back to the last copy offline). |
| Add to my skills | Writes the files into `~/.gemini/config/skills/<slug>` as *Acquired*; the CLI discovers it immediately. |
| Check updates | Compares installed versions with the index. |
| Publish | Validates (description length, secret scan), writes `listing.json` + `<slug>.zip` under `~/.anchor/market/submissions/<slug>/`, opens a prefilled GitHub issue for you to attach them. Appears under *My listings* as unlisted until merged. |
| Review | Opens a prefilled review issue. |
| Request a skill | Opens a prefilled request issue; also kept locally under *My requests*. |
| Notifications | Derived locally: updates available, requests addressed to you. |

A future version can swap this for a real backend by implementing the same
`market` interface; the UI does not change.
