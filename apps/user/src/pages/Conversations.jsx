import { useState, useEffect } from 'react';
import { MessageSquare, Search, Loader2, Globe, User, Bot, Clock, Hash, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import NoWebsitePrompt from '../components/NoWebsitePrompt';

function formatWhen(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleString('ar-SA', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatTime(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export default function Conversations({ user }) {
  const [items, setItems] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (!user?.websiteId) {
      setListLoading(false);
      return;
    }
    setListLoading(true);
    setSelected(null);
    setMessages([]);
    setItems([]);
    setSearch('');
    setError('');
    api
      .getConversations()
      .then((rows) => {
        setItems(rows);
        setSelected(rows[0] || null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setListLoading(false));
  }, [user?.websiteId]);

  useEffect(() => {
    if (!selected?.id) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    api
      .getConversationMessages(selected.id)
      .then((data) => setMessages(data.messages || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingMessages(false));
  }, [selected?.id]);

  if (!user?.websiteId) {
    return (
      <>
        <div className="topbar">
          <div className="topbar-left">
            <h1>المحادثات</h1>
            <p>محادثات زوار موقعك مع المساعد الذكي</p>
          </div>
        </div>
        <NoWebsitePrompt />
      </>
    );
  }

  const filtered = items.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.preview || '').toLowerCase().includes(q) ||
      (c.page_url || '').toLowerCase().includes(q) ||
      (c.visitor_id || '').toLowerCase().includes(q)
    );
  });

  const turnCount = selected?.message_count || Math.ceil((messages.length || 0) / 2);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <h1>المحادثات</h1>
          <p>
            {listLoading
              ? 'جاري تحميل الجلسات…'
              : `${items.length.toLocaleString('ar-SA')} جلسة — محادثات زوار موقعك`}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <Search
            size={15}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-4)',
            }}
          />
          <input
            className="input"
            placeholder="بحث في المحادثات..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingRight: 36 }}
            disabled={listLoading}
          />
        </div>
      </div>

      {error && !listLoading && items.length === 0 ? (
        <div className="card">
          <div className="card-body" style={{ color: '#f87171' }}>{error}</div>
        </div>
      ) : !listLoading && filtered.length === 0 ? (
        <div className="card anim-in">
          <div className="card-body" style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)' }}>
            <MessageSquare size={40} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
            <p>لا توجد محادثات بعد</p>
            <p style={{ fontSize: 12.5, marginTop: 8 }}>
              بعد تضمين الويدجت في موقعك ستظهر الجلسات هنا
            </p>
            <Link to="/install" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
              ثبّت على الموقع
            </Link>
          </div>
        </div>
      ) : (
        <div className="conversations-pane anim-in">
          <div className="card conversations-sessions">
            <div className="card-head">
              <h3>الجلسات {listLoading ? '' : `(${filtered.length})`}</h3>
            </div>
            <div className="card-body conversations-sessions-body">
              {listLoading ? (
                <div className="conversations-loading">
                  <Loader2 size={24} className="spin" style={{ margin: '0 auto 8px' }} />
                  جاري تحميل الجلسات…
                </div>
              ) : (
                <div className="conversations-list">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelected(c)}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'right',
                        padding: '14px 16px',
                        border: 'none',
                        borderBottom: '1px solid var(--border-1)',
                        background: selected?.id === c.id ? 'var(--accent-muted)' : 'transparent',
                        cursor: 'pointer',
                        color: 'inherit',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, lineHeight: 1.4 }}>
                        {c.preview || 'بدون رسائل'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-4)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span>{formatWhen(c.last_active_at)}</span>
                        <span>•</span>
                        <span>{c.message_count || 0} سؤال</span>
                        {(c.total_messages || 0) > 0 && (
                          <>
                            <span>•</span>
                            <span>{c.total_messages} رسالة</span>
                          </>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card conversations-detail">
            <div className="card-head conversations-detail-head">
              <div>
                <h3>المحادثة الكاملة</h3>
                {selected && !listLoading && (
                  <p className="conversations-detail-subtitle">
                    {selected.preview || 'جلسة بدون معاينة'}
                  </p>
                )}
              </div>
              {selected && !listLoading && (
                <span className="badge badge-purple">
                  {turnCount.toLocaleString('ar-SA')} سؤال · {(messages.length || selected.total_messages || 0).toLocaleString('ar-SA')} رسالة
                </span>
              )}
            </div>
            <div className="card-body conversations-detail-body">
              {listLoading ? (
                <div className="conversations-loading">
                  <Loader2 size={24} className="spin" />
                </div>
              ) : selected ? (
                <>
                  <div className="conversations-meta">
                    <div className="conversations-meta-item">
                      <Clock size={14} className="conversations-meta-icon" />
                      <div>
                        <span className="conversations-meta-label">آخر نشاط</span>
                        <strong>{formatWhen(selected.last_active_at)}</strong>
                      </div>
                    </div>
                    <div className="conversations-meta-item">
                      <MessageSquare size={14} className="conversations-meta-icon" />
                      <div>
                        <span className="conversations-meta-label">عدد الأسئلة</span>
                        <strong>{turnCount.toLocaleString('ar-SA')}</strong>
                      </div>
                    </div>
                    <div className="conversations-meta-item">
                      <Hash size={14} className="conversations-meta-icon" />
                      <div>
                        <span className="conversations-meta-label">بدأت</span>
                        <strong>{formatWhen(selected.started_at)}</strong>
                      </div>
                    </div>
                  </div>

                  {selected.page_url && (
                    <div className="conversations-page-url">
                      <div className="conversations-page-url-label">
                        <Globe size={13} /> الصفحة التي بدأ منها الزائر
                      </div>
                      <a
                        href={selected.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="conversations-page-url-link"
                      >
                        <span>{selected.page_url}</span>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  )}

                  <div className="conversations-thread-wrap">
                    <div className="conversations-thread-head">
                      <span>سجل المحادثة</span>
                      {!loadingMessages && messages.length > 0 && (
                        <span className="conversations-thread-count">
                          {messages.length.toLocaleString('ar-SA')} رسالة
                        </span>
                      )}
                    </div>

                    {loadingMessages ? (
                      <div className="conversations-loading conversations-loading--compact">
                        <Loader2 size={22} className="spin" style={{ margin: '0 auto 8px' }} />
                        جاري تحميل المحادثة…
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="conversations-empty-thread">
                        <MessageSquare size={32} style={{ opacity: 0.35, marginBottom: 10 }} />
                        <p>لا توجد رسائل محفوظة في هذه الجلسة</p>
                      </div>
                    ) : (
                      <div className="conversations-thread">
                        {messages.map((m) => {
                          const isUser = m.role === 'user';
                          return (
                            <div
                              key={m.id}
                              className={`chat-row ${isUser ? 'chat-row--user' : 'chat-row--bot'}`}
                            >
                              <div className={`chat-avatar ${isUser ? 'chat-avatar--user' : 'chat-avatar--bot'}`}>
                                {isUser ? <User size={14} /> : <Bot size={14} />}
                              </div>
                              <div className="chat-bubble-wrap">
                                <div className="chat-bubble-meta">
                                  <span className={`chat-sender ${isUser ? 'chat-sender--user' : 'chat-sender--bot'}`}>
                                    {isUser ? 'الزائر' : 'المساعد الذكي'}
                                  </span>
                                  {m.created_at && (
                                    <span className="chat-time">{formatTime(m.created_at)}</span>
                                  )}
                                </div>
                                <div className={`chat-bubble ${isUser ? 'chat-bubble--user' : 'chat-bubble--bot'}`}>
                                  {m.content}
                                </div>
                                {!isUser && m.model_used && m.model_used !== 'error' && (
                                  <div className="chat-model-meta">
                                    {m.model_used}
                                    {m.latency_ms ? ` · ${Math.round(m.latency_ms / 1000)} ث` : ''}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="conversations-empty-select">
                  <MessageSquare size={36} style={{ opacity: 0.35, marginBottom: 12 }} />
                  <p style={{ fontWeight: 600, marginBottom: 4 }}>اختر جلسة من القائمة</p>
                  <p style={{ fontSize: 12.5, color: 'var(--text-3)' }}>
                    اضغط على أي جلسة على اليمين لعرض المحادثة كاملة هنا
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
