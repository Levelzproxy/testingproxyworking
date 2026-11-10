/**
 * WebUnblocker - Static Web Proxy & Browser Emulator
 * Architecture: Client-Side CORS Proxies, Iframe Sandboxing, HTML rewriting & URL resolver
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
    const dismissError = document.getElementById('dismiss-error');
    const engineSelect = document.getElementById('engine-select');
    
    const backBtn = document.getElementById('back-btn');
    const forwardBtn = document.getElementById('forward-btn');
    const reloadBtn = document.getElementById('reload-btn');
    const homeBtn = document.getElementById('home-btn');
    const newTabBtn = document.getElementById('new-tab-btn');
    const quickLinks = document.querySelectorAll('.quick-link');

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettings = document.getElementById('close-settings');
    const saveSettings = document.getElementById('save-settings');
    const customProxyInput = document.getElementById('custom-proxy-input');

    let historyStack = [];
    let historyIndex = -1;
    let currentUrl = '';

    // Load settings from localStorage
    if (localStorage.getItem('webunblocker_proxy')) {
        customProxyInput.value = localStorage.getItem('webunblocker_proxy');
    }

    settingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    saveSettings.addEventListener('click', () => {
        localStorage.setItem('webunblocker_proxy', customProxyInput.value.trim());
        settingsModal.classList.add('hidden');
    });

    dismissError.addEventListener('click', () => errorBanner.classList.add('hidden'));

    // Quick links handler
    quickLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetUrl = link.getAttribute('data-url');
            urlInput.value = targetUrl;
            navigateTo(targetUrl);
        });
    });

    // Form submit handler
    urlForm.addEventListener('submit', (e) => {
        e.preventDefault();
        let rawUrl = urlInput.value.trim();
        if (!rawUrl) return;

        // Check if it's a search query or URL
        if (!rawUrl.includes('.') || rawUrl.includes(' ') || rawUrl.startsWith('search?')) {
            rawUrl = `https://duckduckgo.com/?q=${encodeURIComponent(rawUrl)}`;
        } else {
            if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
                rawUrl = 'https://' + rawUrl;
            }
        }
        urlInput.value = rawUrl;
        navigateTo(rawUrl);
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
            loadHistoryItem(false);
        }
    });

    forwardBtn.addEventListener('click', () => {
        if (historyIndex < historyStack.length - 1) {
            historyIndex++;
            loadHistoryItem(false);
        }
    });

    newTabBtn.addEventListener('click', () => {
        if (currentUrl) {
            window.open(currentUrl, '_blank');
        }
    });

    function navigateTo(targetUrl, isReload = false) {
        currentUrl = targetUrl;
        urlInput.value = targetUrl;
        
        // Update history if not a reload
        if (!isReload) {
            // Trim forward history if we were back in stack
            historyStack = historyStack.slice(0, historyIndex + 1);
            historyStack.push(targetUrl);
            historyIndex = historyStack.length - 1;
        }
        updateNavButtons();

        // Switch views
        homepageView.classList.add('hidden');
        viewportContainer.classList.remove('hidden');
        errorBanner.classList.add('hidden');
        loadingOverlay.classList.remove('opacity-0', 'pointer-events-none');
        loadingText.textContent = `Fetching via ${engineSelect.value} proxy...`;

        const engine = engineSelect.value;
        loadViaEngine(targetUrl, engine);
    }

    function loadHistoryItem(isReload) {
        const targetUrl = historyStack[historyIndex];
        navigateTo(targetUrl, true);
    }

    function updateNavButtons() {
        backBtn.disabled = historyIndex <= 0;
        forwardBtn.disabled = historyIndex >= historyStack.length - 1;
    }

    async function loadViaEngine(targetUrl, engine) {
        const customProxy = localStorage.getItem('webunblocker_proxy');
        
        try {
            if (engine === 'iframe') {
                // Direct iframe loading (works for sites with no CSP/X-Frame-Options)
                browserFrame.src = targetUrl;
                setTimeout(() => loadingOverlay.classList.add('opacity-0', 'pointer-events-none'), 1000);
                return;
            }

            let proxyUrl = '';
            if (customProxy) {
                proxyUrl = customProxy + encodeURIComponent(targetUrl);
            } else if (engine === 'allorigins') {
                proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
            } else if (engine === 'codetabs') {
                proxyUrl = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`;
            } else if (engine === 'thingproxy') {
                proxyUrl = `https://thingproxy.freeboard.io/fetch/${targetUrl}`;
            } else if (engine === 'rawfetch') {
                proxyUrl = targetUrl; // Direct fetch
            }

            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            let htmlContent = await response.text();

            // Rewrite relative links and assets to route through proxy
            htmlContent = rewriteHtmlContent(htmlContent, targetUrl);

            // Inject into iframe via srcdoc
            browserFrame.srcdoc = htmlContent;
            
            setTimeout(() => {
                loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
            }, 600);

        } catch (err) {
            console.warn('Proxy fetch error, falling back to direct iframe embed:', err);
            loadingOverlay.classList.add('opacity-0', 'pointer-events-none');
            
            // Fallback to direct iframe
            browserFrame.src = targetUrl;
            
            errorBanner.classList.remove('hidden');
            errorMessage.textContent = `CORS/Network restriction prevented full proxy rewrite (${err.message}). Attempting direct sandbox embed...`;
        }
    }

    function rewriteHtmlContent(html, baseUrl) {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const baseObj = new URL(baseUrl);

            // Rewrite <a> tags
            doc.querySelectorAll('a').forEach(a => {
                const href = a.getAttribute('href');
                if (href && !href.startsWith('javascript:') && !href.startsWith('#')) {
                    try {
                        const absoluteUrl = new URL(href, baseUrl).href;
                        a.setAttribute('href', '#');
                        a.setAttribute('data-proxy-url', absoluteUrl);
                        a.onclick = (e) => {
                            e.preventDefault();
                            urlInput.value = absoluteUrl;
                            navigateTo(absoluteUrl);
                        };
                    } catch (e) {}
                }
            });

            // Rewrite images, scripts, stylesheets
            ['img', 'script', 'link', 'iframe', 'source'].forEach(tag => {
                doc.querySelectorAll(tag).forEach(el => {
                    const attr = tag === 'link' ? 'href' : 'src';
                    const val = el.getAttribute(attr);
                    if (val && !val.startsWith('data:') && !val.startsWith('blob:')) {
                        try {
                            const absoluteUrl = new URL(val, baseUrl).href;
                            el.setAttribute(attr, absoluteUrl);
                        } catch (e) {}
                    }
                });
            });

            return doc.documentElement.outerHTML;
        } catch (e) {
            console.error('HTML rewriting failed:', e);
            return html;
        }
    }
});
