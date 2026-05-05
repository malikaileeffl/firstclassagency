# First Class Agency — Agent Portal

A private, soft-locked agent portal for First Class Agency. Pure HTML/CSS/JS, no build step.

## File map

```
/
├── index.html              Password gate (the entry point)
├── agent/
│   ├── dashboard.html      KPIs, pinned training, latest announcement
│   ├── training.html       Course library
│   ├── documents.html      Forms, carrier paperwork, compliance docs
│   └── announcements.html  News feed + calendar
├── assets/
│   ├── css/styles.css
│   ├── js/main.js          Header, scroll reveals, magnetic CTAs
│   ├── js/agent-auth.js    Client-side gate
│   └── img/
│       ├── favicon.svg
│       └── logo.png
└── README.md
```

## How the gate works

When someone visits the site, they hit the password gate at `index.html`. Correct password → unlocked for the browser session → straight into `agent/dashboard.html`. Sign out clears the session and sends them back to the gate.

**This is a soft lock, not real auth.** Anyone who opens browser dev tools and reads the source can find the password and bypass the gate. Don't put truly sensitive content (signed contracts, agent SSNs, comp ledgers) behind it. For real auth later, host on Netlify with their built-in password protection or behind Cloudflare Access — both are free for small teams.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo.
2. Settings → Pages → Source: **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Site goes live at `https://<your-username>.github.io/<repo-name>/` within a minute.

For a custom domain later, drop a `CNAME` file at the project root containing the bare domain and configure DNS per GitHub's instructions.

## Things you'll want to change

### Agent password

Open `assets/js/agent-auth.js` and change:

```js
const AGENT_PASSWORD = 'firstclass2026';
```

Pick something memorable but not trivially guessable. Share with agents over a channel that isn't this website.

### Logo

The header uses `assets/img/logo.png`. To swap, replace that file. To use SVG instead, drop `logo.svg` into the same folder and update the `src` in every page header (search `logo.png` across files).

### Contact email

The "forgot the password?" line on the gate links to `hello@firstclassagency.com`. Search-and-replace with your real address.

### Content

All copy is hard-coded in the HTML — no CMS. Edit `agent/training.html` to change course cards, `agent/documents.html` for the file list, `agent/announcements.html` for the news feed and calendar entries. The dashboard pulls a few things from those pages by hand — keep it in sync.

## Local preview

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Brand

- Accent: `#0078ab`
- Dark: `#1e1e1e`
- White: `#ffffff`
- Type: Inter (UI/body) + JetBrains Mono (eyebrows, labels)

Color tokens live at the top of `assets/css/styles.css` under `:root`.
