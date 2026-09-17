# Setup guide

## What the files are, and where each one goes

You have four files, and they do **not** all go to the same place.

| File | Where it goes | Why |
|---|---|---|
| `index.html` | GitHub repo | The quiz |
| `scores.html` | GitHub repo | The scoreboard, showing everyone |
| `config.js` | GitHub repo | The only file you edit. Both pages read it |
| `scoreboard-backend.gs` | **Google Apps Script — NOT GitHub** | The thing that stores the scores |

That last one is the bit that's easy to miss. `.gs` is Google Apps Script, not a
web file. If you upload it to GitHub it does nothing. It has to run on Google's
servers, because GitHub Pages can only serve static files — it has nowhere to
store anyone's answers.

So the flow is:

```
  visitor's browser                Google                    GitHub Pages
  ─────────────────                ──────                    ────────────
  opens quiz.yoursite.com  ──────────────────────────────▶   index.html
  answers a question       ──────▶  Apps Script
                                    writes a row
                                    in your Sheet
  opens /scores.html       ──────▶  Apps Script  ──────────▶  scores.html
                                    reads all rows                renders board
```

Do **Part A first**. You need the URL it gives you before Part B is useful.

---

## Part A — the scoreboard backend (Google, ~5 minutes)

1. Go to **https://sheets.new** — this creates a blank Google Sheet. You can
   name it anything, e.g. "Assessment scores".
2. In that sheet, click **Extensions → Apps Script**. A code editor opens in a
   new tab with a file called `Code.gs` containing a stub function.
3. **Delete everything** in that editor, then paste in the entire contents of
   `scoreboard-backend.gs`.
4. Click the **save icon** (or Ctrl/Cmd+S).
5. Click **Deploy → New deployment**. Click the gear icon next to "Select type"
   and choose **Web app**. Then set:
   - **Description:** anything, e.g. "v1"
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`

   ⚠️ **"Anyone"**, not "Anyone with a Google account". This is the single most
   common mistake. "Anyone with a Google account" will force your visitors to
   log in and the page will fail silently.
6. Click **Deploy**. Google will ask you to authorise:
   - Click **Authorize access**, pick your Google account.
   - You'll see "Google hasn't verified this app". Click **Advanced**, then
     **Go to (your project name) (unsafe)**. This warning is normal — it appears
     for any personal script. You are authorising your own code.
   - Click **Allow**.
7. Copy the **Web app URL**. It looks like:
   ```
   https://script.google.com/macros/s/AKfycbx...long.../exec
   ```
   It must end in `/exec`. Keep this — you need it in Part B.

**Check it works:** paste that URL into a browser tab. You should see
`{"ok":true,"scores":[]}`. If you see an error or a login page, redo step 5
with access set to "Anyone".

---

## Part B — put the site on GitHub Pages

1. On GitHub, click **New repository**. Name it anything, e.g. `maturity-quiz`.
   Set it to **Public** (GitHub Pages needs public unless you're on a paid plan).
   Don't add a README. Click **Create repository**.
2. Click **uploading an existing file**, then drag in these three:
   - `index.html`
   - `scores.html`
   - `config.js`

   Leave the folder structure flat — all three in the root, not in a subfolder.
3. Open `config.js` on GitHub and click the **pencil icon** to edit it. Paste
   your URL from step A7 between the quotes:
   ```js
   endpoint: "https://script.google.com/macros/s/AKfycbx.../exec",
   ```
   Click **Commit changes**.
4. Go to **Settings → Pages** (left sidebar).
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` and `/ (root)`
   - Click **Save**.
5. Wait 1–2 minutes, then open:
   ```
   https://YOUR-USERNAME.github.io/maturity-quiz/
   ```
   That's the quiz. `/scores.html` on the end is the scoreboard.

**Test it properly:** answer a couple of questions, then open the scores page
in a different browser (or a private window). You should see your name and
score there. If you only see it in the same browser, the endpoint isn't
connected — see Troubleshooting.

---

## Part C — point your subdomain at it

Say you want `quiz.yourdomain.com`.

1. **In GitHub:** Settings → Pages → **Custom domain**, type
   `quiz.yourdomain.com`, click **Save**. This adds a `CNAME` file to your repo —
   that's expected, leave it there.
2. **At your DNS provider** (Cloudflare, Namecheap, GoDaddy, wherever your
   domain is), add one record:

   | Field | Value |
   |---|---|
   | Type | `CNAME` |
   | Name / Host | `quiz` |
   | Value / Target | `YOUR-USERNAME.github.io` |
   | TTL | Automatic / default |

   Notes:
   - The target is your **username**, not the repo. No `https://`, no repo name,
     no trailing slash.
   - Use `CNAME`. The A-record method you may have read about is only for an
     apex domain like `yourdomain.com` — not needed for a subdomain.
   - **On Cloudflare:** set the proxy to **DNS only** (grey cloud) until HTTPS
     is working, then you can turn it back on if you want.
3. Wait for DNS to propagate — usually minutes, occasionally up to an hour.
   GitHub will show "DNS check successful" on the Pages settings screen.
4. Once that's green, tick **Enforce HTTPS**. If the checkbox is greyed out,
   GitHub is still issuing your certificate; check back in a bit.

You're done:
- Quiz: `https://quiz.yourdomain.com/`
- Scores: `https://quiz.yourdomain.com/scores.html`

---

## Part D — can I put the two pages on different subdomains?

**Yes, but I'd advise against it.** Two reasons:

1. **The "you" highlight stops working.** Browsers keep each site's storage
   separate per domain. The scores page knows which row is yours by reading
   what the quiz page saved locally. On a different domain it can't see that,
   so no row gets tagged "you".
2. **It only works at all if the endpoint is set.** With no endpoint, the pages
   fall back to browser storage, and across two domains they'd share nothing —
   the scores page would show an empty board forever.

The scores themselves would still be fine, because they travel through Apps
Script rather than between the two pages.

If you want it anyway:

- Put `index.html` + `config.js` on one repo, `scores.html` + `config.js` on
  the other. **Both need their own copy of `config.js` with the same endpoint.**
- In each `config.js`, use full URLs so the nav links work across domains:
  ```js
  quizUrl:   "https://quiz.yourdomain.com/",
  scoresUrl: "https://scores.yourdomain.com/"
  ```
- Rename `scores.html` to `index.html` on the second site so it serves at the
  root of that subdomain.

**Simplest setup, which I'd recommend:** one repo, one subdomain, two pages.
Everything works with no extra configuration.

---

## Troubleshooting

**Only my own score shows, nobody else's.**
The endpoint isn't reaching Google. Open your browser's developer console (F12)
on the scores page and look for a red error. Check: the URL in `config.js` ends
in `/exec`; the deployment's access is set to "Anyone"; and pasting the URL into
a browser tab returns `{"ok":true,...}`.

**The scores page says "Reconnecting…".**
Same cause as above — the page can't reach the endpoint.

**Nothing appears at my github.io URL.**
Pages takes a minute or two on first deploy. Check Settings → Pages shows a
green "Your site is live at…". Confirm `index.html` is in the repo root, not a
subfolder, and that the filename is exactly `index.html` in lower case.

**I edited the .gs file and nothing changed.**
Apps Script keeps serving the old version until you redeploy:
**Deploy → Manage deployments → pencil icon → Version: New version → Deploy.**

**Can I get the scores as a spreadsheet?**
They already are one. Open the Google Sheet from Part A — every response is a
row, including each individual question score. File → Download → CSV.

**Someone answered but their row never appeared.**
Rows are only written once a name has been entered. The quiz requires a name
before the questions unlock, so this normally can't happen — but a visitor who
opened the page and never typed a name won't appear.
