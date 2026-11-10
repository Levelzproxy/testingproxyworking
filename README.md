# WebUnblocker - Static Web Proxy & Browser

A fully client-side static web proxy and browser emulator designed to be deployed instantly on **GitHub Pages**, **Vercel**, **Netlify**, or any static hosting provider.

Inspired by modern client-side unblockers and browser emulators, WebUnblocker enables users to browse websites securely through public CORS proxies and sandboxed iframes without needing a complex Node.js or Go server backend.

---

## 🌟 Key Features

1. **100% Static Architecture**: Zero server-side runtime required. Deployable on any static hosting service (GitHub Pages, Vercel, Netlify, Cloudflare Pages).
2. **Multiple Proxy Engines**: Switch between AllOrigins, CodeTabs, ThingProxy, Direct Fetch, and Iframe Sandbox.
3. **Custom CORS Proxy Support**: Configure your own custom CORS proxy endpoint in the settings modal.
4. **Interactive Browser Toolbar**: Fully functional Back, Forward, Reload, Home navigation controls and URL bar with autocomplete/search integration (DuckDuckGo search fallback).
5. **Asset & Link Rewriting**: Automatically parses and resolves relative links and media resources to maintain browsing flow.
6. **Responsive Dark UI**: Sleek, modern Tailwind CSS interface optimized for desktop and mobile devices.

---

## 🚀 Quick Deployment to GitHub Pages

1. Create a new repository on GitHub (e.g., `webunblocker`).
2. Upload the contents of this folder (`index.html`, `app.js`, `README.md`) to your repository.
3. Go to your repository **Settings** -> **Pages**.
4. Under **Build and deployment**, select **Source** as `Deploy from a branch` and choose `main` / `root`.
5. Save and visit your published GitHub Pages URL!

---

## 🛠️ Local Development

To run locally, simply open `index.html` in your browser or spin up a local static server:

```bash
npx http-server web-proxy-static -p 8080
```
