/**
 * Nebula Browser - Static Proxy & Browser Gateway
 * Architecture: Multi-tier fallback (CORS Proxies, Reader Emulation, Direct Sandbox)
 */

document.addEventListener('DOMContentLoaded', () => {
    const urlForm = document.getElementById('url-form');
    const urlInput = document.getElementById('url-input');
    const browserFrame = document.getElementById('browser-frame');
    const homepageView = document.getElementById('homepage-view');
    const viewportContainer = document.getElementById('viewport-container');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    const errorBanner = document.getElementById('error-banner');
    const errorMessage = document.getElementById('error-message');
    const errorOpenExternal = document.getElementById('error-open-external');
    const dismissError = document.getElementById('dismiss-error');
    const modeSelect = document.getElementById('mode-select');
    
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const homeBtn = document.getElementById('home-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const aboutBlankBtn = document.getElementById('about-blank-btn');
    const quickCards = document.querySelectorAll('.quick-card');

    let historyStack = [];
    let historyIndex = -1;
    let currentUrl = '';

    // Quick card clicks
    quickCards.forEach(card => {
        card.addEventListener('click', () => {
            const targetUrl = card.getAttribute('data-url');
            urlInput.value = targetUrl;
            navigateTo(targetUrl);
        });
    });

    // Form submission
    urlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let query = urlInput.value.trim();
        if (!query) return;

        let targetUrl = '';
        if (query.startsWith('http://') || query.startsWith('https://')) {
            targetUrl = query;
        } else if (query.includes('.') && !query.includes(' ') && !query.startsWith('search?')) {
            targetUrl = 'https://' + query;
        } else {
            targetUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        }

        urlInput.value = targetUrl;
        navigateTo(targetUrl);
    });

    homeBtn.addEventListener('click', () => {
        currentUrl = '';
        urlInput.value = '';
        viewportContainer.classList.add('hidden');
        homepageView.classList.remove('hidden');
        errorBanner.classList.add('hidden');
        updateNavButtons();
    });

    reloadBtn.addEventListener('click', () => {
        if (currentUrl) navigateTo(currentUrl, true);
    });

    backBtn.addEventListener('click', () => {
        if (historyIndex > 0) {
            historyIndex--;
            loadHistory(false);
        }
    });

    forwardBtn.addEventListener('click', () => {
        if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            loadHistory(false);
        }
    });

    dismissError.addEventListener('click', () => errorBanner.classList.add('hidden'));

    errorOpenExternal.addEventListener('click', () => {
        if (currentUrl) window.open(currentUrl, '_blank');
    });

    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => console.error(err));
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
        }
    });

    // Cloaked about:blank launcher
    aboutBlankBtn.addEventListener('click', () => {
        const win = window.open('about:blank', '_blank');
        if (!win) {
            alert('Popup blocked! Please allow popups for this site to use about:blank cloaking.');
            return;
        }
        const doc = win.document;
        doc.open();
        doc.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Classes</title>
                <link rel="icon" href="https://ssl.gstatic.com/classroom/ic_product_classroom_32.png">
                <style>
                    body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #0f172a; }
                    iframe { width: 100%; height: 100%; border: none; }
                </style>
            </head>
            <body>
                <iframe src="${window.location.href}"></iframe>
            </body>
            </html>
        `);
        doc.close();
    });

    function navigateTo(targetUrl, isReload = false) {
        currentUrl = targetUrl;
        urlInput.value = targetUrl;

        if (!isReload) {
            historyStack = historyStack.slice(0, historyIndex + 1);
            historyStack.push(targetUrl);
            historyIndex = historyStack.length - 1;
        }
        updateNavButtons();

        homepageView.classList.add('hidden');
        viewportContainer.classList.remove('hidden');
        errorBanner.classList.add('hidden');
        loadingOverlay.classList.remove('opacity-0', 'pointer-events-none');
        loadingText.textContent = `Connecting to gateway (${modeSelect.value})...`;

        loadContent(targetUrl, modeSelect.value);
    }

    function loadHistory(isReload) {
        const targetUrl = historyStack[historyIndex];
        navigateTo(targetUrl, true);
    }

    function updateNavButtons() {
        backBtn.disabled = historyIndex <= 0;
        forwardBtn.disabled = historyIndex >= historyStack.length - 1;
    }

    async function loadContent(targetUrl, mode) {
        try {
            if (mode === 'embed') {
                // Direct iframe embed
                browserFrame.src = targetUrl;
                setTimeout(() => {
                    loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
                }, 1200);

                // Detect if frame fails or blocks
                setTimeout(() => {
                    try {
                        const frameDoc = browserFrame.contentDocument || browserFrame.contentWindow.document;
                        if (!frameDoc || frameDoc.body.childElementCount === 0) {
                            throw new Error('Frame blocked by X-Frame-Options');
                        }
                    } catch (e) {
                        // Likely blocked by X-Frame-Options or CORS
                        errorBanner.classList.remove('hidden');
                        errorMessage.textContent = 'Website has anti-embedding security (X-Frame-Options). Click "Open New Tab" or switch mode to CORS Proxy.';
                    }
                }, 2500);
                return;
            }

            if (mode === 'cors') {
                // Fetch through public CORS proxies with fallback chain
                const corsProxies = [
                    `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`,
                    `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`,
                    `https://thingproxy.freeboard.io/fetch/${targetUrl}`
                ];

                let html = null;
                let success = false;

                for (const proxy of corsProxies) {
                    try {
                        const res = await fetch(proxy);
                        if (res.ok) {
                            html = await res.text();
                            success = true;
                            break;
                        }
                    } catch (e) {
                        continue;
                    }
                }

                if (!success || !html) {
                    throw new Error('All CORS proxies failed to fetch target URL');
                }

                // Rewrite HTML links and resources
                html = rewriteHtml(html, targetUrl);
                browserFrame.srcdoc = html;
                loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
                return;
            }

            if (mode === 'emulator') {
                // Smart reader / emulator mode for search & articles
                const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
                const res = await fetch(proxyUrl);
                if (!res.ok) throw new Error('Failed to load emulator stream');
                let html = await res.text();
                
                html = rewriteHtml(html, targetUrl);
                browserFrame.srcdoc = html;
                loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
                return;
            }

        } catch (err) {
            console.warn('Gateway load warning:', err);
            loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
            
            // Fallback to direct iframe
            browserFrame.src = targetUrl;
            errorBanner.classList.remove('hidden');
            errorMessage.textContent = `Gateway restriction: ${err.message}. Attempting direct sandbox load...`;
        }
    }

    function rewriteHtml(html, baseUrl) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Rewrite links
            doc.querySelectorAll('a').forEach(a => {
                const href = a.getAttribute('href');
                if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
                    try {
                        const abs = new URL(href, baseUrl).href;
                        a.setAttribute('href', '#');
                        a.onclick = (e) => {
                            e.preventDefault();
                            urlInput.value = abs;
                            navigateTo(abs);
                        };
                    } catch (e) {}
                }
            });

            // Rewrite media and scripts
            ['img', 'script', 'link', 'iframe', 'source'].forEach(tag => {
                doc.querySelectorAll(tag).forEach(el => {
                    const attr = tag === 'link' ? 'href' : 'src';
                    const val = el.getAttribute(attr);
                    if (val && !val.startsWith('data:') && !val.startsWith('blob:')) {
                        try {
                            const abs = new URL(val, baseUrl).href;
                            el.setAttribute(attr, abs);
                        } catch (e) {}
                    }
                });
            });

            return doc.documentElement.outerHTML;
        } catch (e) {
            return html;
        }
    }
});
