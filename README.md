<p align="center">
  <img src="iconbridgelogo.png" width="80" height="80" alt="IconBridge Logo" />
</p>

<h1 align="center">IconBridge</h1>

<p align="center">
  Figma plugin — Browse, replace, and sync icons between Figma and iconfont.cn
</p>

---

## Features

- **Browse & Search** — Browse your iconfont.cn project icons directly in Figma, with instant search by font class
- **Drag to Canvas** — Drag icons from the panel onto your Figma canvas as 48×48 SVG frames
- **Insert to Canvas** — Select an icon and click "放入 Figma" to place it at viewport center
- **Replace Icons** — Replace iconfont icons with updated designs from Figma, preserving font class and unicode
- **Upload Icons** — Upload new icons from Figma to your iconfont project (batch supported); the font class you enter is kept as the icon name instead of being auto-named `iconN`
- **Mono / Color Mode** — Toggle between 去色 (single `fill="currentColor"`) and 原色 (keep original fills, incl. opacity) when replacing or uploading, with live preview; your choice is remembered
- **Right-click Decolorize** — Right-click any icon in the library to convert an existing colored icon to mono in place
- **Pending Review Icons** — Icons still under review (审核中) show at the top of the library with a badge; the list auto-refreshes after upload
- **Light / Dark Theme** — Switch the plugin UI between light and dark
- **Bilingual UI** — 中文 / English, switchable in settings

## Install

### From Figma Community (pending review)

Search **IconBridge** in Figma Plugins.

### Local Install

```bash
git clone https://github.com/JonyLab/iconBridge.git
```

1. Open Figma Desktop
2. Go to **Plugins → Development → Import plugin from manifest...**
3. Select `manifest.json` from the cloned directory

## Setup

The plugin requires two things to connect to iconfont.cn. For a step-by-step guide in Chinese, see [docs/setup-guide.md](docs/setup-guide.md).

### 1. iconfont Cookie

1. Open [iconfont.cn](https://www.iconfont.cn) and log in
2. Open DevTools (F12) → Network tab
3. Copy the `Cookie` header from any request
4. Paste it into the plugin settings (gear icon)

### 2. CORS Proxy

The plugin needs a CORS proxy to access iconfont.cn from within Figma's iframe sandbox. Two options:

**Option A: Cloudflare Worker (Recommended)**

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Workers & Pages → Create → Create Worker
3. Pick the "Hello World" template, deploy
4. Edit code → paste the contents of `worker.js` → deploy
5. Copy the Worker URL (e.g. `https://xxx.workers.dev`) into plugin settings

> Free tier: 100,000 requests/day — more than enough for a design team.

**Option B: Local Proxy (development)**

```bash
node proxy.js
```

Runs on `http://localhost:17788`. Leave the proxy URL empty in plugin settings to use this automatically.

## Privacy

Your iconfont Cookie is stored locally in Figma's `clientStorage` and only sent to your own proxy server. No data passes through any third-party service.

## Tech Stack

- Vanilla HTML/CSS/JS (no build step)
- Figma Plugin API
- Cloudflare Workers (optional CORS proxy)

## License

MIT
