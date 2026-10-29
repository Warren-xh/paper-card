# Paper Cards 文献卡片

[中文](README.md) | **English**

A personal study site that runs on GitHub Pages: write **paper cards** for what you read, **practice logs** for coding and experiments, **course notes** for courses you watch, and connect them in **mind maps**. No server, no database, no cost. Enter your password on any device to write; the site updates about a minute after you save.

Current version: **v4.6** ([changelog](CHANGELOG.md)) · [MIT License](LICENSE). The interface is in Chinese by default; click **EN** in the top bar (or **设置 → 界面语言 → English**) to switch it to English.

> **Note**: `data/`, `papers/`, `code/`, `materials/` and `uploads/` at the root of this repository hold the author's own content. To run your own site, download the **release package** below — don't copy or fork the whole repository.

---

## Contents

- [What it does](#what-it-does)
- [Download](#download)
- [Deploy your own site (about 10 minutes, nothing to install)](#deploy-your-own-site-about-10-minutes-nothing-to-install)
- [First-time setup: token and password](#first-time-setup-token-and-password)
- [Prefer the command line? Deploy with git](#prefer-the-command-line-deploy-with-git)
- [Updating to a new version](#updating-to-a-new-version)
- [FAQ](#faq)
- [How the password works](#how-the-password-works)
- [Where your data lives](#where-your-data-lives)
- [Local development](#local-development)
- [License](#license)

---

## What it does

The **🏠 | Papers | Lab | Courses | Maps** switch in the top bar moves between the overview and four modes, each with its own colour. Every list can be **searched** and **sorted** (your sort choice is remembered).

**Today — overview** (🏠, or the site name at the top left)

- What is waiting today: the lesson to continue, practice in progress and open questions in every module.
- A **study calendar**: how many times you saved on the site each day over the last six months, like GitHub's contribution graph, with your current streak.
- Quick starts and recent changes.

**Terms — a term library** (**Terms** in the top bar)

- Select a word in any notes box and click **Term** next to bold and italic; add the Chinese and English names and an explanation, and it goes into the library.
- Marked words get a dotted underline; point at them (or tap on a phone) to see the names and explanation.
- The library page searches, sorts, edits and deletes terms, and lists the papers, logs and lessons each term appears in.
- While reading, the first mention of each library term is marked automatically.

**Outline mode for mind maps**: build a map like a list (Enter, Tab, Shift+Tab); pasting indented text creates branches.

**Reading settings** ("Aa" in the top bar; on phones, in Settings): light, dark and sepia themes; system font, LXGW WenKai, Noto Serif SC or Noto Sans SC; text size, page width and line spacing.

**Paper auto-fill**: enter a DOI or arXiv number under "Link" and click **Auto-fill** for the title, authors, year and venue; with only a title, search by title.

**Search everything**: press **Ctrl+K** (⌘K on a Mac) or the magnifier in the top bar to search papers, logs, courses, **every lesson's notes** and mind maps from one box; arrow keys to pick, Enter to open. With nothing typed it shows quick actions and recent changes.

**Papers — paper cards**

- One card per paper, written in four stages:
  1. **Before reading**: one line on why you're reading it.
  2. **While reading**: quick marks only — `?` unclear, `!` key point, `★` reusable, `×` questionable, `✎` note — with a page counter you step with ＋/−. Tick **Open** on anything still unclear.
  3. **First-pass answers**: answer the marks you ticked Open.
  4. **After reading, with the paper closed**: one-liner, problem, key idea, evidence, doubts / limits, why it matters to you.
- Upload the paper's PDF and download it from the card page; insert images, write formulas (`$…$`), use bold and italics.
- **Recall mode** blurs a card so you recall each part before revealing it.

**Lab — practice logs**

- Log coding, experiments and exercises: a goal at the start; quick timestamped entries while working (`▶` action, `✗` error, `✓` success, `?` question, `✎` note); then a conclusion, problems & fixes and key code.
- Upload code files or a whole folder, then view and download them on the page; `.env` files, keys, `node_modules` and similar are skipped automatically.
- Link logs to paper cards; the card page shows its related practice logs.

**Courses — course notes**

- A course holds its lessons and why you're taking it. Add all lessons at once (one per line) and reorder them any time.
- The course page lists “Lesson 1, Lesson 2, …”; open any lesson for:
  - **While watching**: one entry at a time, like a paper's marks — pick a symbol (didn't get it / key point / useful / note), add the video time (optional), write a few words and press Enter; on the lesson page, click a time and the video jumps there.
  - **Questions & answers**: entries ticked “Open” are listed here for their answers.
  - **Exercises**: homework for the lesson, exercises you found, and how you did them.
  - **Slides & materials**: upload slide PDFs, PPTs, handouts, images and more (or drag them in); open or download them from the lesson page, with images shown as thumbnails.
  - **Afterwards**: a one-line summary; anything that doesn't fit as entries (code, tables) goes in **Other notes**.
- The course page shows a progress bar and the lesson list — click a circle to mark a lesson watched; **Continue** jumps to the next unwatched lesson.

**Maps — mind maps**

- Branches can be text, a paper card, a practice log or a course; each kind looks different so they're easy to tell apart.
- **Browse mode**: drag to move, zoom, fold branches, click a paper, practice or course branch to open it; **Find in map** highlights matching branches and Enter jumps between them.
- **Edit mode**: add branches, pick colours, write notes, drag a branch onto another to move it; undo and keyboard shortcuts.

**Course videos**: when a lesson's video link is on **Bilibili or YouTube**, the lesson page plays it in place; click a time under “Notes while watching” and the video jumps there.

**PDF preview**: paper PDFs and PDF course materials can be previewed right on the page.

**Images**: click any image to view it large, with ← → to move between them. Every notes box in every module has an **Insert image** button; you can also **paste a screenshot with Ctrl+V** or drag an image in, including into one-line marks and log entries. Images are compressed in the browser and uploaded when you save.

**Also**: press **Ctrl+S** to save while editing; code blocks are coloured; long pages get a back-to-top button; one-line boxes such as reading marks and log entries grow with their text, so long entries stay fully visible; drafts are saved on your device; every save is a Git commit, so mistakes can be undone from the history; export everything as Markdown or JSON; light and dark themes; works on phones.

---

## Download

**[⬇ Download the latest release: paper-card.zip](https://github.com/Warren-xh/paper-card/releases/latest/download/paper-card.zip)**

All versions are on the [Releases page](https://github.com/Warren-xh/paper-card/releases) and in the [`backup/`](backup/) folder of this repository.

The package contains all the code and an **empty** set of data — nobody's cards and no password.

---

## Deploy your own site (about 10 minutes, nothing to install)

You need a GitHub account (sign up free at <https://github.com/signup>). Everything happens in the browser.

### Step 1: Download and unzip

Download the release package above and unzip it. You get a `paper-card` folder containing `index.html`, `css/`, `js/`, `data/` and so on.

### Step 2: Create a repository

1. Open <https://github.com/new>.
2. Enter a **Repository name**, e.g. `paper-card`. Your address will be `https://your-username.github.io/that-name/`.
3. Choose **Public** (on free accounts GitHub Pages only works for public repositories).
4. Leave the options below (README, .gitignore, license) **unticked**.
5. Click **Create repository**.

### Step 3: Upload the files

1. On the new repository's page, click the **uploading an existing file** link (in the “Quick setup” box).
2. Open the `paper-card` folder, **select everything inside it** (not the `paper-card` folder itself) and drag it onto the page.
   - On a Mac, files starting with `.` (such as `.nojekyll`) are hidden; press `⌘ + Shift + .` in Finder to show them. The site works without them too.
3. When the upload finishes, click **Commit changes** at the bottom.

Afterwards the repository's front page should show `index.html`, `css`, `js`, `data` directly — not a `paper-card` folder. If there is an extra folder level, delete the repository and start again, this time dragging the folder's **contents**.

### Step 4: Turn on GitHub Pages

1. In the repository, click **Settings** (gear icon) → **Pages** on the left.
2. Under **Source**, choose **Deploy from a branch**.
3. Under **Branch**, choose **main** and **/ (root)**, then click **Save**.
4. Wait 1–2 minutes and refresh; **Your site is live at …** appears at the top. That's your address.

### Step 5 (optional): Set the repository name

Open `data/site.json` in the repository, click the pencil icon, change `"repo"` to `your-username/repository-name`, and click **Commit changes**. On `github.io` the site detects the repository by itself, so this mostly matters for local previews — but it doesn't hurt.

### Step 6: Open your site and do the first-time setup

Open your address and follow the next section once. Then you can start writing.

---

## First-time setup: token and password

The site is static, so writing to your repository needs a GitHub token. You do this once.

1. Open your site. To follow along in English, click **EN** at the top first (on a phone: **设置**, then **English** under **界面语言**).
2. Click **Settings → Start setup** (or **Sign in** and follow the prompt).
3. Click **Open the GitHub token page**. GitHub's “New fine-grained personal access token” page opens with the name, description, expiry (one year) and permission already filled in. Sign in to GitHub if asked.
4. On that GitHub page, check:
   - **Resource owner**: your own account.
   - **Expiration**: up to one year (when it runs out, replace it under **Settings → Change password / replace token** on your site).
   - **Repository access**: choose **Only select repositories**, then pick **only** the repository you just created.
   - **Permissions → Repository permissions → Contents**: **Read and write** (Metadata switches to Read-only by itself; that's expected).
5. Scroll down, click **Generate token**, and confirm.
6. Copy the token (it starts with `github_pat_`). **It is shown only once**, so copy it before leaving the page.
7. Back on your site, paste it into **GitHub token**.
8. Choose a password (at least 8 characters, letters and numbers, not used anywhere else) and repeat it.
9. Click **Finish setup**. When you see “Setup done”, write your first card.

From now on, open your address on any device (phones included), click **Sign in** and enter your password. Tick **Remember me on this device for 30 days** to type it less often.

---

## Prefer the command line? Deploy with git

```bash
# Download and unzip the release package
curl -L -o paper-card.zip https://github.com/Warren-xh/paper-card/releases/latest/download/paper-card.zip
unzip paper-card.zip && cd paper-card

# Push it to the empty repository you created on GitHub
git init -b main
git add -A
git commit -m "Paper Cards v4.6"
git remote add origin https://github.com/your-username/repository-name.git
git push -u origin main
```

Then continue with “Step 4: Turn on GitHub Pages” and the first-time setup.

---

## Updating to a new version

Your content lives in `data/`, `papers/`, `code/`, `materials/` and `uploads/`. When updating, **replace only the code and leave those folders alone**:

1. Download and unzip the new release package.
2. Upload these to your repository, replacing the old ones: `index.html`, `css/`, `js/`, `scripts/`, `tests/`, `package.json`, `README.md`, `README.en.md`, `CHANGELOG.md`, `LICENSE`.
3. **Don't** upload the package's `data/` folder — it is empty and would overwrite your indexes.

With git: copy the files above into your repository folder, commit and push.

---

## FAQ

**My address shows 404.**
Pages needs 1–3 minutes after being turned on. Also check that Settings → Pages uses `main` and `/ (root)`, and that `index.html` sits directly on the repository's front page (no extra folder).

**Saving says “GitHub refused the request” or “Repository or file not found”.**
The token doesn't cover this repository, or Contents isn't Read and write. Create a new token as above and put it in under **Settings → Change password / replace token**.

**My token expired.**
Create a new one on GitHub, then on your site go to **Settings → Change password / replace token**, enter your current password and paste the new token.

**I forgot my password.**
It can't be recovered. Create a new token and run **Settings → First-time setup** again; your content is not affected.

**Can I use a private repository?**
On free accounts GitHub Pages only works for public repositories. A public repository means others can read your cards, uploaded PDFs and code — only the token is encrypted. Leave out anything you don't want public, and mind the copyright of paywalled PDFs.

**Something I just saved doesn't show on another device.**
The site takes about a minute to update; refresh a bit later.

**How do I switch the language?**
Click **EN** / **中** in the top bar, or choose under **Settings → Interface language** (on phones, use the Settings page). Only the interface is translated; what you write stays as it is. Markdown exports keep Chinese section headings.

**How do I back up?**
Every save is a Git commit, so GitHub keeps the full history. You can also download everything under **Settings → Backup** (Markdown or JSON).

---

## How the password works

- Your GitHub token is encrypted in the browser with your password (PBKDF2 with 600,000 iterations + AES-256-GCM); only the encrypted result is stored, as `data/vault.json`.
- The password itself is never sent or stored. On any device, entering it decrypts the token locally, and the browser commits your changes straight to your repository.
- The token covers only this one repository and can't touch the rest of your account. If it leaks, delete it on GitHub and set up again.
- By default an unlock lasts for the current tab and locks after 30 idle minutes; **Remember me for 30 days** keeps it for 30 days on that device.

---

## Where your data lives

| Path | Contents |
| --- | --- |
| `data/cards/<id>.json` | One card per paper |
| `data/index.json` | Card summaries for the home page and search |
| `data/logs/<id>.json`, `data/logs-index.json` | Practice logs and their summaries |
| `data/courses/<id>.json`, `data/courses-index.json` | Courses (with all lesson notes) and their summaries |
| `data/maps/<id>.json`, `data/maps-index.json` | Mind maps and their summaries |
| `data/site.json` | Site title, repository name and other settings |
| `data/vault.json` | The encrypted access token (created by the first-time setup) |
| `papers/` | Uploaded paper PDFs |
| `code/<log id>/` | Code uploaded to practice logs |
| `materials/<course id>/<lesson id>/` | Slides and materials uploaded to each lesson of a course |
| `data/terms.json` | The term library |
| `uploads/` | Inserted images |

## What's in this repository

| Path | What it is |
| --- | --- |
| `index.html`, `css/`, `js/` | The site itself (static, no build step, no dependencies) |
| `scripts/` | Local preview server, index rebuild script |
| `tests/` | Unit tests |
| `backup/` | Release packages of each version |
| `data/`, `papers/`, `code/`, `materials/`, `uploads/` | The author's own content (don't copy these when deploying) |

---

## Local development

Requires Node.js 18 or later; there are no dependencies.

```bash
npm test              # unit tests
npm run dev           # preview at http://127.0.0.1:4180
npm run mock          # preview with a simulated GitHub: http://127.0.0.1:4180/?mock
npm run reindex       # rebuild data/index.json after editing data/cards/ by hand
```

Mock mode lets you try everything — setup, publishing, uploads, maps — with any long string starting with `github_pat_` as the token. Changes live in memory only and vanish when the server stops; your real repository is never touched.

Main files:

| File | Purpose |
| --- | --- |
| `js/app.mjs` | Routing, paper-card pages, settings, first-time setup |
| `js/model.mjs` | Card data, review intervals, search, export |
| `js/lab.mjs`, `js/lab-views.mjs` | Practice logs |
| `js/course.mjs`, `js/course-views.mjs` | Course notes |
| `js/mindmap.mjs`, `js/map-views.mjs` | Mind-map data, automatic layout and pages |
| `js/overview.mjs`, `js/overview-views.mjs` | The Today overview and study calendar |
| `js/search.mjs`, `js/palette.mjs` | Search everything (Ctrl+K) |
| `js/paperinfo.mjs` | Paper auto-fill (Crossref, DataCite) |
| `js/ghlinks.mjs` | GitHub commits in practice logs |
| `js/reading.mjs` | Reading settings: theme, font, size, width |
| `js/terms.mjs`, `js/terms-views.mjs` | Term library: marking terms, pop-up explanations, the library page |
| `js/enhance.mjs` | Image viewer, code colours, Ctrl+S, back to top, PDF preview |
| `js/i18n.mjs` | Interface language (Chinese / English) |
| `js/github.mjs` | One commit per save through the Git Data API, retried on conflicts |
| `js/vault.mjs` | Token encryption |
| `js/markdown.mjs` | Safe Markdown rendering |
| `js/rich.mjs` | What-you-see-is-what-you-get edit boxes (bold, terms and images shown as they look) |

---

## License

The website code is released under the [MIT License](LICENSE), copyright © 2026 Warren-xh. You may use, copy, modify and distribute it, including commercially, as long as the copyright notice and license text stay with your copies. The software is provided “as is”, without warranty of any kind.

The MIT License covers the website code only. The author's personal content in `data/`, `papers/`, `code/`, `materials/` and `uploads/` of this repository is **not** covered; uploaded paper PDFs remain the property of their authors and publishers. Whatever you write on your own deployment belongs to you.
