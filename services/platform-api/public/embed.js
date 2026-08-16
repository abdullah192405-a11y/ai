/* ════════════════════════════════════════════════════════════
   WBA widget loader (embed.js)
   ------------------------------------------------------------
   Drop a single tag on any site:

     <script src="https://YOUR_HOST/embed.js" data-key="pk_live_..." async></script>

   This loader fetches the live, admin-controlled configuration for
   the given API key, then injects the real widget bundle with the
   matching data-* attributes. Because config is fetched on every
   page load, changes saved in the dashboard appear without editing
   the embed tag.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  if (window.__wbaLoaderStarted) return;
  window.__wbaLoaderStarted = true;

  var self =
    document.currentScript ||
    (function () {
      var s = document.querySelectorAll('script[data-key]');
      return s[s.length - 1];
    })();
  if (!self) return;

  var key = self.getAttribute('data-key') || '';
  if (!key) {
    console.error('[WBA] embed.js: missing data-key attribute');
    return;
  }

  // Resolve the server origin + API base (base must include /v1).
  var origin;
  try {
    origin = new URL(self.src, window.location.href).origin;
  } catch (e) {
    origin = window.location.origin;
  }
  var apiBase = self.getAttribute('data-api-url') || origin + '/v1';
  apiBase = apiBase.replace(/\/$/, '');
  var bundleUrl = origin + '/widget.iife.js';

  // For React/Vite SPAs: attach live page text + captured API catalog to each chat request.
  function initCatalogStore() {
    if (window.__wbaCatalog) return window.__wbaCatalog;
    window.__wbaCatalog = { topics: [], courses: [], challenges: [], content: [], subjects: [], items: [] };
    return window.__wbaCatalog;
  }

  function shouldCaptureUrl(url) {
    return /supabase\.co|rest\/v1|\/api\/|graphql|course|challenge|content|catalog|material|topic|subject|grade/i.test(
      String(url || '')
    );
  }

  function pushRecord(raw, bucket) {
    if (!raw || typeof raw !== 'object') return;
    var title = raw.title || raw.name || raw.label || raw.courseName || raw.challengeName;
    if (!title) return;
    var store = initCatalogStore();
    var target = store[bucket] || store.items;
    target.push(raw);
    if (target.length > 300) target.splice(0, target.length - 300);
  }

  function walkPayload(node, url) {
    if (node == null) return;
    var u = String(url || '').toLowerCase();
    var bucket = 'items';
    if (u.indexOf('topic') !== -1) bucket = 'topics';
    else if (u.indexOf('subject') !== -1) bucket = 'subjects';
    else if (u.indexOf('challenge') !== -1) bucket = 'challenges';
    else if (u.indexOf('course') !== -1) bucket = 'courses';

    if (Array.isArray(node)) {
      for (var i = 0; i < node.length; i++) {
        pushRecord(node[i], bucket);
        walkPayload(node[i], url);
      }
      return;
    }
    if (typeof node !== 'object') return;
    pushRecord(node, bucket);
    var keys = ['topics', 'subjects', 'grades', 'organizations', 'courses', 'challenges', 'content', 'items', 'data', 'results'];
    for (var k = 0; k < keys.length; k++) {
      if (node[keys[k]]) walkPayload(node[keys[k]], url);
    }
  }

  function ingestJsonPayload(data, url) {
    if (!data) return;
    walkPayload(data, url);
  }

  function captureResponse(url, responseText) {
    if (!shouldCaptureUrl(url) || !responseText) return;
    try {
      ingestJsonPayload(JSON.parse(responseText), url);
    } catch (e) {
      /* ignore */
    }
  }

  function collectNavLinks() {
    var links = [];
    var seen = new Set();
    var selectors = ['nav a[href]', 'header a[href]', 'footer a[href]', 'main a[href]', 'a[href]'];
    var nodes = [];
    for (var s = 0; s < selectors.length; s++) {
      var found = document.querySelectorAll(selectors[s]);
      for (var i = 0; i < found.length; i++) nodes.push(found[i]);
    }
    for (var j = 0; j < nodes.length; j++) {
      var a = nodes[j];
      try {
        var u = new URL(a.getAttribute('href'), window.location.href);
        if (u.origin !== window.location.origin) continue;
        var path = u.pathname + u.search;
        if (!path || path === '#' || seen.has(path)) continue;
        seen.add(path);
        var text = String(a.innerText || a.textContent || '')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 100) text = text.slice(0, 100);
        links.push({ path: path, title: text || path });
      } catch (e) {
        /* skip */
      }
    }
    return links.slice(0, 80);
  }

  function collectPageContext() {
    var root = document.querySelector('main') || document.getElementById('root') || document.body;
    var descEl = document.querySelector('meta[name="description"]');
    return {
      path: window.location.pathname + window.location.search,
      title: document.title || '',
      description: descEl ? descEl.getAttribute('content') || '' : '',
      visible_text: root
        ? String(root.innerText || root.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4000)
        : '',
      links: collectNavLinks(),
      catalog: initCatalogStore(),
    };
  }

  function patchFetchForPageContext() {
    if (window.__wbaFetchPatched) return;
    window.__wbaFetchPatched = true;
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var url = typeof input === 'string' ? input : input && input.url;
      var promise = nativeFetch(input, init);

      if (url && shouldCaptureUrl(url)) {
        promise
          .then(function (res) {
            try {
              var clone = res.clone();
              var ct = (clone.headers && clone.headers.get('content-type')) || '';
              if (ct.indexOf('json') !== -1) {
                clone.text().then(function (text) {
                  captureResponse(url, text);
                }).catch(function () {});
              }
            } catch (e) {
              /* ignore */
            }
            return res;
          })
          .catch(function () {});
      }

      if (url && url.indexOf('/assistant/query') !== -1 && init && init.body) {
        try {
          var body = JSON.parse(init.body);
          body.page_context = collectPageContext();
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        } catch (e) {
          /* ignore */
        }
      }
      return promise;
    };
  }

  patchFetchForPageContext();

  // Supabase client may use XMLHttpRequest in some setups.
  if (!window.__wbaXhrPatched) {
    window.__wbaXhrPatched = true;
    var NativeXHR = window.XMLHttpRequest;
    function PatchedXHR() {
      var xhr = new NativeXHR();
      var _url = '';
      var _open = xhr.open;
      xhr.open = function (method, url) {
        _url = url;
        return _open.apply(xhr, arguments);
      };
      xhr.addEventListener('load', function () {
        if (shouldCaptureUrl(_url)) captureResponse(_url, xhr.responseText);
      });
      return xhr;
    }
    PatchedXHR.prototype = NativeXHR.prototype;
    window.XMLHttpRequest = PatchedXHR;
  }

  function inject(config) {
    config = config || {};
    var s = document.createElement('script');
    s.src = bundleUrl;
    s.async = true;

    function set(attr, val) {
      if (val !== undefined && val !== null) s.setAttribute(attr, String(val));
    }

    set('data-key', key);
    set('data-api-url', apiBase);
    set('data-color', config.color);
    set('data-theme', config.theme);
    set('data-position', config.position);
    set('data-radius', config.radius);
    set('data-font-family', config.fontFamily);
    set('data-font-size', config.baseFontSize);
    set('data-bot-name', config.botName);
    set('data-bot-subtitle', config.botSubtitle);
    set('data-welcome', config.welcomeMessage);
    set('data-placeholder', config.placeholder);
    if (Array.isArray(config.suggestedQuestions)) {
      set('data-suggestions', config.suggestedQuestions.join(','));
    }
    if (config.showBranding === false) set('data-branding', 'false');
    if (config.autoOpen === true) set('data-auto-open', 'true');
    set('data-auto-open-delay', config.autoOpenDelay);
    if (config.soundEnabled === false) set('data-sound', 'false');

    (document.body || document.documentElement).appendChild(s);
  }

  fetch(apiBase + '/widget/config', { headers: { 'X-API-Key': key } })
    .then(function (r) {
      if (!r.ok) throw new Error('config ' + r.status);
      return r.json();
    })
    .then(inject)
    .catch(function (err) {
      // Fall back to the bundle's built-in defaults so the widget still loads.
      console.warn('[WBA] could not load remote config, using defaults:', err.message);
      inject({});
    });
})();
