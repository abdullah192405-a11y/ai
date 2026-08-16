import { resolveFontOption, widgetTextScale } from '@wba/widget-config';

const ICONS = {
  close:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  sparkles:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>',
  minus:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  refresh:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
  thumbUp:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>',
  thumbDown:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"/><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"/></svg>',
  navigate:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
};

class WBAError extends Error {
  constructor(status, message, data) {
    super(message);
    this.name = 'WBAError';
    this.status = status;
    this.data = data;
  }
}

function trimText(value, max = 50) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function collectPageContext() {
  try {
    const root = document.querySelector('main') || document.getElementById('root') || document.body;
    const descEl = document.querySelector('meta[name="description"]');
    const links = [...document.querySelectorAll('a[href]')]
      .slice(0, 35)
      .map((a) => ({
        text: trimText(a.textContent),
        href: a.getAttribute('href'),
      }));

    return {
      path: window.location.pathname + window.location.search,
      title: trimText(document.title, 120),
      description: descEl ? descEl.getAttribute('content') || '' : '',
      visible_text: root
        ? String(root.innerText || root.textContent || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4000)
        : '',
      links,
      catalog: window.__wbaCatalog || undefined,
    };
  } catch {
    return { path: window.location.pathname, title: document.title || '' };
  }
}

function navigateTo(url) {
  if (!url) return;
  const target = String(url);
  if (/^https?:\/\//i.test(target)) {
    window.location.href = target;
    return;
  }
  const path = target.startsWith('/') ? target : `/${target}`;
  if (window.history?.pushState) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  } else {
    window.location.href = path;
  }
}

class WBAApi {
  constructor({ apiKey, apiBaseUrl }) {
    this.apiKey = apiKey;
    this.baseUrl = apiBaseUrl || 'https://api.wba.com/v1';
    this.sessionId = null;
    this.conversationHistory = [];
  }

  getSessionId() {
    if (!this.sessionId) {
      const stored = sessionStorage.getItem('wba_session_id');
      this.sessionId = stored || `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('wba_session_id', this.sessionId);
    }
    return this.sessionId;
  }

  async streamQuery(question, onToken, onDone, onError) {
    const body = {
      domain: window.location.hostname,
      page_url: window.location.href,
      question,
      session_id: this.getSessionId(),
      conversation_history: this.conversationHistory.slice(-10),
      page_context: collectPageContext(),
      stream: true,
    };

    try {
      const res = await fetch(`${this.baseUrl}/assistant/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new WBAError(res.status, err.message || 'خطأ في الخدمة', err);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder
          .decode(value, { stream: true })
          .split('\n')
          .filter((line) => line.startsWith('data: '));

        for (const line of lines) {
          const payload = line.slice(6);
          if (payload === '[DONE]') {
            this.conversationHistory.push(
              { role: 'user', content: question },
              { role: 'assistant', content: full }
            );
            onDone?.(full);
            return;
          }

          try {
            const data = JSON.parse(payload);
            if (data.token) {
              full += data.token;
              onToken?.(data.token, full);
            }
            if (data.actions?.length) {
              onToken?.(null, full, data.actions);
            }
          } catch {
            /* ignore malformed SSE chunks */
          }
        }
      }

      this.conversationHistory.push(
        { role: 'user', content: question },
        { role: 'assistant', content: full }
      );
      onDone?.(full);
    } catch (err) {
      onError?.(
        err instanceof WBAError ? err : new WBAError(0, 'تعذر الاتصال', { original: err.message })
      );
    }
  }

  async sendFeedback(rating) {
    try {
      await fetch(`${this.baseUrl}/assistant/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({
          rating,
          session_id: this.getSessionId(),
        }),
      });
    } catch {
      /* non-critical */
    }
  }

  reset() {
    this.conversationHistory = [];
    this.sessionId = null;
    sessionStorage.removeItem('wba_session_id');
  }
}

class SoundManager {
  constructor() {
    this.enabled = true;
    this._ctx = null;
  }

  _getContext() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._ctx;
  }

  playSend() {
    if (!this.enabled) return;
    try {
      const ctx = this._getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(660, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.05);
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      /* ignore */
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

const STYLES_BASE = `
:host{--wba-primary:#6366f1;--wba-primary-hover:#818cf8;--wba-primary-light:rgba(99,102,241,.1);--wba-primary-glow:rgba(99,102,241,.25);--wba-radius:16px;--wba-font:"IBM Plex Sans Arabic","Inter",-apple-system,BlinkMacSystemFont,sans-serif;--wba-text-scale:1;--wba-transition:.2s cubic-bezier(.4,0,.2,1);all:initial;font-family:var(--wba-font);font-size:14px;direction:rtl}
.wba-widget{position:fixed;z-index:2147483647;font-family:var(--wba-font);font-size:14px;line-height:1.5;direction:rtl;-webkit-font-smoothing:antialiased}
.wba-widget.bottom-right{bottom:20px;right:20px}.wba-widget.bottom-left{bottom:20px;left:20px}.wba-widget.top-right{top:20px;right:20px}.wba-widget.top-left{top:20px;left:20px}
.wba-widget *{box-sizing:border-box;margin:0;padding:0}
.wba-trigger{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;background:var(--wba-primary);color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 20px var(--wba-primary-glow),0 8px 32px #00000026;transition:all var(--wba-transition);position:relative;overflow:hidden}
.wba-trigger:hover{transform:scale(1.08)}.wba-trigger:active{transform:scale(.95)}.wba-trigger svg{width:26px;height:26px;transition:all .25s ease}
.wba-trigger.open svg.icon-chat{transform:scale(0) rotate(90deg);opacity:0;position:absolute}.wba-trigger svg.icon-close{transform:scale(0) rotate(-90deg);opacity:0;position:absolute}
.wba-trigger.open svg.icon-close{transform:scale(1) rotate(0);opacity:1}.wba-trigger:not(.open) svg.icon-chat{transform:scale(1) rotate(0);opacity:1;position:relative}
.wba-window{position:absolute;width:380px;height:560px;max-height:calc(100vh - 100px);border-radius:var(--wba-radius);overflow:hidden;display:flex;flex-direction:column;opacity:0;transform:scale(.85) translateY(20px);pointer-events:none;transition:all .3s cubic-bezier(.34,1.56,.64,1);box-shadow:0 20px 60px #00000040,0 0 0 1px #ffffff0d}
.wba-widget.bottom-right .wba-window,.wba-widget.bottom-left .wba-window{bottom:76px}.wba-widget.top-right .wba-window,.wba-widget.top-left .wba-window{top:76px}
.wba-widget.bottom-right .wba-window,.wba-widget.top-right .wba-window{right:0}.wba-widget.bottom-left .wba-window,.wba-widget.top-left .wba-window{left:0}
.wba-window.open{opacity:1;transform:scale(1) translateY(0);pointer-events:all}
.wba-window.theme-dark{background:#12131e;color:#e8eaf0}.wba-window.theme-dark .wba-messages{background:#12131e}.wba-window.theme-dark .wba-msg-bot .wba-bubble{background:#1e2035;color:#d8dae5}
.wba-window.theme-dark .wba-input-area{background:#12131e;border-top:1px solid #1e2035}.wba-window.theme-dark .wba-input{background:#1a1b2e;color:#e8eaf0;border:1px solid #282a45}
.wba-window.theme-dark .wba-footer{background:#0d0e18;color:#3a3e5e;border-top:1px solid #1a1c30}.wba-window.theme-dark .wba-suggested-btn{background:#6366f114;color:var(--wba-primary);border:1px solid rgba(99,102,241,.18)}
.wba-window.theme-light{background:#fff;color:#1a1a2e}.wba-window.theme-light .wba-messages{background:#f8f9fb}.wba-window.theme-light .wba-msg-bot .wba-bubble{background:#fff;color:#333;box-shadow:0 1px 4px #0000000f}
.wba-window.theme-light .wba-input-area{background:#fff;border-top:1px solid #eef0f5}.wba-window.theme-light .wba-input{background:#f0f2f7;color:#333;border:1px solid #e2e5ed}
.wba-window.theme-light .wba-footer{background:#f8f9fb;color:#b0b5c5;border-top:1px solid #eef0f5}.wba-window.theme-light .wba-suggested-btn{background:#f0f1fe;color:var(--wba-primary);border:1px solid #e0e1f8}
.wba-header{background:linear-gradient(135deg,var(--wba-primary),var(--wba-primary-hover));padding:18px 20px;color:#fff;display:flex;justify-content:space-between;align-items:center;flex-shrink:0;min-height:72px;max-height:72px}
.wba-header-info{display:flex;align-items:center;gap:12px;min-width:0;flex:1}
.wba-header-avatar{width:40px;height:40px;border-radius:50%;background:#ffffff2e;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wba-header-avatar svg{width:20px;height:20px}.wba-header-text h3{font-size:15px;font-weight:700;margin:0;line-height:1.3}.wba-header-text span{font-size:11.5px;opacity:.8;display:flex;align-items:center;gap:5px;line-height:1.3}
.wba-online-dot{width:6px;height:6px;border-radius:50%;background:#34d399}
.wba-header-actions{display:flex;gap:4px;flex-shrink:0}
.wba-header-btn{width:32px;height:32px;border:none;background:#ffffff1f;border-radius:8px;color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center}
.wba-header-btn svg{width:16px;height:16px}
.wba-messages{flex:1;overflow-y:auto;padding:18px 16px;display:flex;flex-direction:column;gap:14px}
.wba-msg{display:flex;gap:8px;align-items:flex-end;max-width:88%}
.wba-msg-bot{align-self:flex-start}.wba-msg-user{align-self:flex-end;flex-direction:row-reverse}
.wba-msg-avatar{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wba-msg-bot .wba-msg-avatar{background:var(--wba-primary);color:#fff}.wba-msg-bot .wba-msg-avatar svg{width:14px;height:14px}
.wba-bubble{padding:10px 15px;font-size:calc(13.5px * var(--wba-text-scale));line-height:1.5;max-width:100%;word-wrap:break-word}
.wba-msg-bot .wba-bubble{border-radius:calc(var(--wba-radius) * .65) calc(var(--wba-radius) * .65) calc(var(--wba-radius) * .65) 4px}
.wba-msg-user .wba-bubble{background:var(--wba-primary);color:#fff;border-radius:calc(var(--wba-radius) * .65) calc(var(--wba-radius) * .65) 4px calc(var(--wba-radius) * .65)}
.wba-msg-time{font-size:calc(10px * var(--wba-text-scale));opacity:.45;margin-top:4px;text-align:right}.wba-msg-user .wba-msg-time{text-align:left}
.wba-suggested{display:flex;flex-wrap:wrap;gap:6px;padding:4px 0}
.wba-suggested-btn{padding:6px 13px;font-size:calc(12px * var(--wba-text-scale));font-weight:500;border-radius:calc(var(--wba-radius) * .5);cursor:pointer;font-family:var(--wba-font);border:none;white-space:nowrap;line-height:1.4}
.wba-typing{display:flex;align-items:center;gap:8px;padding:4px 0}
.wba-typing-dots{display:flex;gap:4px;padding:10px 14px;border-radius:calc(var(--wba-radius) * .5)}
.wba-window.theme-dark .wba-typing-dots{background:#1e2035}.wba-window.theme-light .wba-typing-dots{background:#fff;box-shadow:0 1px 4px #0000000f}
.wba-typing-dot{width:7px;height:7px;border-radius:50%;animation:wba-typing 1.4s infinite}
.wba-typing-dot:nth-child(2){animation-delay:.2s}.wba-typing-dot:nth-child(3){animation-delay:.4s}
@keyframes wba-typing{0%,60%,to{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}
.wba-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.wba-action-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;font-size:calc(11.5px * var(--wba-text-scale));font-weight:600;border-radius:8px;cursor:pointer;font-family:var(--wba-font);background:var(--wba-primary-light);color:var(--wba-primary);border:1px solid var(--wba-primary-glow);line-height:1.4}
.wba-action-btn:hover{background:var(--wba-primary);color:#fff}
.wba-action-btn svg{width:13px;height:13px}
.wba-input-area{padding:12px 14px;display:flex;align-items:center;gap:8px;flex-shrink:0;min-height:62px}
.wba-input{flex:1;padding:10px 14px;font-size:calc(13.5px * var(--wba-text-scale));font-family:var(--wba-font);border-radius:calc(var(--wba-radius) * .6);outline:none;direction:rtl;text-align:right;line-height:1.4}
.wba-send-btn{width:38px;height:38px;border-radius:50%;border:none;background:var(--wba-primary);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wba-send-btn:disabled{opacity:.4;cursor:not-allowed}.wba-send-btn svg{width:17px;height:17px;transform:scaleX(-1)}
.wba-footer{padding:7px 12px;text-align:center;font-size:calc(10.5px * var(--wba-text-scale));flex-shrink:0;line-height:1.4}
.wba-feedback{display:flex;align-items:center;gap:5px;margin-top:8px}
.wba-feedback-btn{width:26px;height:26px;border-radius:6px;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center}
.wba-window.theme-dark .wba-feedback-btn{background:#1e2035;color:#4a4e75}.wba-window.theme-light .wba-feedback-btn{background:#f0f2f7;color:#a0a5b8}
.wba-welcome{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:30px 24px;gap:16px}
.wba-welcome-icon{width:64px;height:64px;border-radius:50%;background:var(--wba-primary-light);display:flex;align-items:center;justify-content:center}
.wba-welcome-icon svg{width:28px;height:28px;color:var(--wba-primary)}.wba-welcome h4{font-size:calc(17px * var(--wba-text-scale));font-weight:700;line-height:1.4}.wba-welcome p{font-size:calc(13px * var(--wba-text-scale));opacity:.6;max-width:260px;line-height:1.5}
@media(max-width:480px){.wba-window{width:calc(100vw - 20px)!important;height:calc(100vh - 90px)!important;max-height:none!important}}
`;

function buildWidgetStyles(config) {
  const font = resolveFontOption(config.fontFamily);
  return `@import url("https://fonts.googleapis.com/css2?family=${font.google}&display=swap");\n${STYLES_BASE}`;
}

class WBAWidget {
  constructor(options = {}) {
    this.config = {
      apiKey: '',
      apiBaseUrl: 'https://api.wba.com/v1',
      color: '#6366f1',
      theme: 'dark',
      position: 'bottom-left',
      radius: 16,
      fontFamily: 'ibm-plex-arabic',
      baseFontSize: 14,
      botName: 'المساعد الذكي',
      botSubtitle: 'متصل الآن',
      welcomeMessage: 'مرحباً! 👋 أنا مساعدك الذكي. كيف أقدر أساعدك اليوم؟',
      placeholder: 'اسأل أي سؤال...',
      suggestedQuestions: ['كيف أبدأ؟', 'ما هي خطط الأسعار؟'],
      showBranding: true,
      autoOpen: false,
      autoOpenDelay: 5,
      soundEnabled: true,
      ...options,
    };

    this.isOpen = false;
    this.messages = [];
    this.isTyping = false;
    this.showSuggestions = true;
    this._streamingEl = null;

    this.api = new WBAApi(this.config);
    this.sound = new SoundManager();
    this.sound.setEnabled(this.config.soundEnabled);

    this._createWidget();
    this._bindEvents();
    this._addWelcomeMessage();

    if (this.config.autoOpen) {
      setTimeout(() => this.open(), this.config.autoOpenDelay * 1000);
    }
  }

  _createWidget() {
    this.host = document.createElement('div');
    this.host.id = 'wba-widget-host';
    this.shadow = this.host.attachShadow({ mode: 'open' });

    const font = resolveFontOption(this.config.fontFamily);
    const textScale = widgetTextScale(this.config.baseFontSize);

    const style = document.createElement('style');
    style.textContent =
      buildWidgetStyles(this.config) +
      `
      :host {
        --wba-primary: ${this.config.color};
        --wba-primary-hover: ${this._lightenColor(this.config.color, 20)};
        --wba-primary-light: ${this.config.color}18;
        --wba-primary-glow: ${this.config.color}40;
        --wba-radius: ${this.config.radius}px;
        --wba-font: ${font.stack};
        --wba-text-scale: ${textScale};
      }
    `;
    this.shadow.appendChild(style);

    this.container = document.createElement('div');
    this.container.className = `wba-widget ${this.config.position}`;
    this.container.setAttribute('dir', 'rtl');

    this.window = document.createElement('div');
    this.window.className = `wba-window theme-${this.config.theme}`;
    this.window.innerHTML = this._renderWindow();
    this.container.appendChild(this.window);

    this.trigger = document.createElement('button');
    this.trigger.className = 'wba-trigger';
    this.trigger.setAttribute('aria-label', 'فتح المحادثة');
    this.trigger.innerHTML = `
      <svg class="icon-chat" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    `;
    this.container.appendChild(this.trigger);

    this.shadow.appendChild(this.container);
    document.body.appendChild(this.host);

    this.messagesEl = this.shadow.querySelector('.wba-messages');
    this.inputEl = this.shadow.querySelector('.wba-input');
    this.sendBtn = this.shadow.querySelector('.wba-send-btn');
    this.suggestedEl = this.shadow.querySelector('.wba-suggested');
  }

  _renderWindow() {
    return `
      <div class="wba-header">
        <div class="wba-header-info">
          <div class="wba-header-avatar">${ICONS.sparkles}</div>
          <div class="wba-header-text">
            <h3>${this._escapeHtml(this.config.botName)}</h3>
            <span><span class="wba-online-dot"></span>${this._escapeHtml(this.config.botSubtitle)}</span>
          </div>
        </div>
        <div class="wba-header-actions">
          <button class="wba-header-btn wba-btn-refresh" aria-label="محادثة جديدة" title="محادثة جديدة">${ICONS.refresh}</button>
          <button class="wba-header-btn wba-btn-minimize" aria-label="تصغير" title="تصغير">${ICONS.minus}</button>
          <button class="wba-header-btn wba-btn-close" aria-label="إغلاق" title="إغلاق">${ICONS.close}</button>
        </div>
      </div>
      <div class="wba-messages" role="log" aria-live="polite"></div>
      <div class="wba-input-area">
        <input class="wba-input" type="text" placeholder="${this._escapeHtml(this.config.placeholder)}" autocomplete="off" dir="rtl" aria-label="اكتب رسالتك" />
        <button class="wba-send-btn" disabled aria-label="إرسال">${ICONS.send}</button>
      </div>
      ${
        this.config.showBranding
          ? '<div class="wba-footer">مدعوم من <a href="https://wba.com" target="_blank" rel="noopener">WBA</a></div>'
          : ''
      }
    `;
  }

  _bindEvents() {
    this.trigger.addEventListener('click', () => this.toggle());
    this.shadow.querySelector('.wba-btn-close')?.addEventListener('click', () => this.close());
    this.shadow.querySelector('.wba-btn-minimize')?.addEventListener('click', () => this.close());
    this.shadow.querySelector('.wba-btn-refresh')?.addEventListener('click', () => this.reset());

    this.inputEl.addEventListener('input', () => {
      this.sendBtn.disabled = !this.inputEl.value.trim();
    });
    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._handleSend();
      }
    });
    this.sendBtn.addEventListener('click', () => this._handleSend());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.close();
    });
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.window.classList.add('open');
    this.trigger.classList.add('open');
    this.trigger.setAttribute('aria-label', 'إغلاق المحادثة');
    setTimeout(() => this.inputEl?.focus(), 350);
  }

  close() {
    this.isOpen = false;
    this.window.classList.remove('open');
    this.trigger.classList.remove('open');
    this.trigger.setAttribute('aria-label', 'فتح المحادثة');
  }

  reset() {
    this.messages = [];
    this.api.reset();
    this.showSuggestions = true;
    this.messagesEl.innerHTML = '';
    this._addWelcomeMessage();
  }

  _addWelcomeMessage() {
    const welcome = document.createElement('div');
    welcome.className = 'wba-welcome';
    welcome.innerHTML = `
      <div class="wba-welcome-icon">${ICONS.sparkles}</div>
      <h4>${this._escapeHtml(this.config.botName)}</h4>
      <p>${this._escapeHtml(this.config.welcomeMessage)}</p>
    `;
    this.messagesEl.appendChild(welcome);

    if (this.config.suggestedQuestions?.length) {
      const suggested = document.createElement('div');
      suggested.className = 'wba-suggested';
      for (const q of this.config.suggestedQuestions) {
        const btn = document.createElement('button');
        btn.className = 'wba-suggested-btn';
        btn.type = 'button';
        btn.textContent = q;
        btn.addEventListener('click', () => {
          this.inputEl.value = q;
          this.sendBtn.disabled = false;
          this._handleSend();
        });
        suggested.appendChild(btn);
      }
      this.messagesEl.appendChild(suggested);
      this.suggestedEl = suggested;
    }
  }

  _handleSend() {
    const text = this.inputEl.value.trim();
    if (!text || this.isTyping) return;

    if (this.showSuggestions) {
      this.shadow.querySelector('.wba-welcome')?.remove();
      this.suggestedEl?.remove();
      this.showSuggestions = false;
    }

    this._addMessage('user', text);
    this.inputEl.value = '';
    this.sendBtn.disabled = true;
    this.sound.playSend();
    this._showTyping();

    this.api.streamQuery(
      text,
      (token, full, actions) => {
        if (token) {
          this._hideTyping();
          this._updateStreamingMessage(full);
        }
        if (actions?.length) {
          this._renderActions(actions);
        }
      },
      (full) => {
        this._hideTyping();
        this._finalizeStreamingMessage(full);
        this.isTyping = false;
        this.sendBtn.disabled = !this.inputEl.value.trim();
      },
      (err) => {
        this._hideTyping();
        this.isTyping = false;
        this._addMessage('bot', err.message || 'حدث خطأ. حاول مرة أخرى.');
        this.sendBtn.disabled = !this.inputEl.value.trim();
      }
    );

    this.isTyping = true;
  }

  _showTyping() {
    if (this.shadow.querySelector('.wba-typing')) return;
    const el = document.createElement('div');
    el.className = 'wba-typing wba-msg wba-msg-bot';
    el.innerHTML = `
      <div class="wba-msg-avatar">${ICONS.sparkles}</div>
      <div class="wba-typing-dots">
        <span class="wba-typing-dot"></span><span class="wba-typing-dot"></span><span class="wba-typing-dot"></span>
      </div>
    `;
    this.messagesEl.appendChild(el);
    this._scrollToBottom();
  }

  _hideTyping() {
    this.shadow.querySelector('.wba-typing')?.remove();
  }

  _addMessage(sender, text, { showFeedback = false } = {}) {
    const msg = document.createElement('div');
    msg.className = `wba-msg wba-msg-${sender}`;
    msg.innerHTML = `
      ${sender === 'bot' ? `<div class="wba-msg-avatar">${ICONS.sparkles}</div>` : ''}
      <div>
        <div class="wba-bubble">${this._formatMessage(text)}</div>
        <div class="wba-msg-time">${this._formatTime(new Date())}</div>
        ${
          showFeedback
            ? `<div class="wba-feedback">
                <button class="wba-feedback-btn" data-rating="up" aria-label="مفيد">${ICONS.thumbUp}</button>
                <button class="wba-feedback-btn" data-rating="down" aria-label="غير مفيد">${ICONS.thumbDown}</button>
              </div>`
            : ''
        }
      </div>
    `;

    if (showFeedback) {
      msg.querySelectorAll('.wba-feedback-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          msg.querySelectorAll('.wba-feedback-btn').forEach((b) => b.classList.remove('active'));
          btn.classList.add('active');
          this.api.sendFeedback(btn.dataset.rating);
        });
      });
    }

    this.messagesEl.appendChild(msg);
    this.messages.push({ sender, text, time: new Date() });
    this._scrollToBottom();
  }

  _updateStreamingMessage(text) {
    if (!this._streamingEl) {
      this._streamingEl = document.createElement('div');
      this._streamingEl.className = 'wba-msg wba-msg-bot';
      this._streamingEl.innerHTML = `
        <div class="wba-msg-avatar">${ICONS.sparkles}</div>
        <div><div class="wba-bubble wba-streaming-bubble"></div></div>
      `;
      this.messagesEl.appendChild(this._streamingEl);
    }
    const bubble = this._streamingEl.querySelector('.wba-streaming-bubble');
    if (bubble) bubble.innerHTML = this._formatMessage(text);
    this._scrollToBottom();
  }

  _finalizeStreamingMessage(text) {
    if (this._streamingEl) {
      const bubble = this._streamingEl.querySelector('.wba-streaming-bubble');
      if (bubble) {
        bubble.innerHTML = this._formatMessage(text);
        bubble.classList.remove('wba-streaming-bubble');
      }

      const body = this._streamingEl.querySelector('.wba-msg-bot > div:last-child') || this._streamingEl.querySelector('div:nth-child(2)');
      if (body) {
        const time = document.createElement('div');
        time.className = 'wba-msg-time';
        time.textContent = this._formatTime(new Date());
        body.appendChild(time);

        const feedback = document.createElement('div');
        feedback.className = 'wba-feedback';
        feedback.innerHTML = `
          <button class="wba-feedback-btn" data-rating="up" aria-label="مفيد">${ICONS.thumbUp}</button>
          <button class="wba-feedback-btn" data-rating="down" aria-label="غير مفيد">${ICONS.thumbDown}</button>
        `;
        feedback.querySelectorAll('.wba-feedback-btn').forEach((btn) => {
          btn.addEventListener('click', () => {
            feedback.querySelectorAll('.wba-feedback-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            this.api.sendFeedback(btn.dataset.rating);
          });
        });
        body.appendChild(feedback);
      }
      this._streamingEl = null;
    }

    this.messages.push({ sender: 'bot', text, time: new Date() });
    this._scrollToBottom();
  }

  _renderActions(actions) {
    const navigateActions = (actions || []).filter((a) => a?.type === 'navigate' && a.url);
    if (!navigateActions.length) return;

    const target =
      this._streamingEl?.querySelector('.wba-msg-bot > div:last-child') ||
      this._streamingEl?.querySelector('div:nth-child(2)') ||
      this.messagesEl.lastElementChild?.querySelector('div:last-child');

    if (!target) return;

    let container = target.querySelector('.wba-actions');
    if (!container) {
      container = document.createElement('div');
      container.className = 'wba-actions';
      target.appendChild(container);
    }
    container.innerHTML = '';

    for (const action of navigateActions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'wba-action-btn';
      btn.innerHTML = `${ICONS.navigate}<span>${this._escapeHtml(action.label || action.url)}</span>`;
      btn.addEventListener('click', () => navigateTo(action.url));
      container.appendChild(btn);
    }
    this._scrollToBottom();
  }

  _formatMessage(text) {
    let html = this._escapeHtml(text);
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      '<pre style="background:rgba(0,0,0,0.15);padding:8px 12px;border-radius:6px;font-size:12px;overflow-x:auto;direction:ltr;text-align:left;margin:6px 0;font-family:monospace"><code>$2</code></pre>'
    );
    html = html.replace(
      /`(.*?)`/g,
      '<code style="background:rgba(0,0,0,0.12);padding:2px 5px;border-radius:3px;font-size:12px;font-family:monospace;direction:ltr">$1</code>'
    );
    return html.replace(/\n/g, '<br>');
  }

  _formatTime(date) {
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  }

  _escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  _lightenColor(hex, amount) {
    try {
      const num = parseInt(hex.replace('#', ''), 16);
      const r = Math.min(255, (num >> 16) + amount);
      const g = Math.min(255, ((num >> 8) & 0xff) + amount);
      const b = Math.min(255, (num & 0xff) + amount);
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    } catch {
      return hex;
    }
  }

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    });
  }
}

function parseScriptConfig(script) {
  const config = {
    apiKey: script.getAttribute('data-key') || '',
    apiBaseUrl: script.getAttribute('data-api-url') || 'https://api.wba.com/v1',
    color: script.getAttribute('data-color') || undefined,
    theme: script.getAttribute('data-theme') || undefined,
    position: script.getAttribute('data-position') || undefined,
    radius: script.getAttribute('data-radius') ? parseInt(script.getAttribute('data-radius'), 10) : undefined,
    fontFamily: script.getAttribute('data-font-family') || undefined,
    baseFontSize: script.getAttribute('data-font-size')
      ? parseInt(script.getAttribute('data-font-size'), 10)
      : undefined,
    botName: script.getAttribute('data-bot-name') || undefined,
    botSubtitle: script.getAttribute('data-bot-subtitle') || undefined,
    welcomeMessage: script.getAttribute('data-welcome') || undefined,
    placeholder: script.getAttribute('data-placeholder') || undefined,
    showBranding: script.getAttribute('data-branding') !== 'false',
    autoOpen: script.getAttribute('data-auto-open') === 'true',
    autoOpenDelay: parseInt(script.getAttribute('data-auto-open-delay') || '5', 10),
    soundEnabled: script.getAttribute('data-sound') !== 'false',
  };

  const suggestions = script.getAttribute('data-suggestions');
  if (suggestions) {
    config.suggestedQuestions = suggestions.split(',').map((s) => s.trim()).filter(Boolean);
  }

  return config;
}

function autoInit() {
  const scripts = document.querySelectorAll('script[data-key]');
  const script = scripts[scripts.length - 1];
  if (!script?.getAttribute('data-key')) return;

  const init = () => {
    window.__wbaWidget = new WBAWidget(parseScriptConfig(script));
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

autoInit();

export default WBAWidget;
