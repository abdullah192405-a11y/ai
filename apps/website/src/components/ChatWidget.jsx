import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, Sparkles, X, Minus, Bot, ThumbsUp, ThumbsDown, Volume2 } from 'lucide-react'

/* ─── Scenario-aware responses ─── */
const scenarioResponses = {
    ecommerce: [
        'مرحباً! 👋 أهلاً بك في متجرنا. كيف أساعدك اليوم؟ يمكنك سؤالي عن المنتجات، التوصيل، أو سياسة الاستبدال.',
        'نوفر شحن مجاني لجميع الطلبات فوق ٢٠٠ ريال! التوصيل خلال ٢-٣ أيام عمل لمناطق الرياض وجدة، و٣-٥ أيام للمناطق الأخرى. يمكنك تتبع طلبك من خلال رابط التتبع المرسل على بريدك.',
        'يمكنك الاستبدال أو الاسترجاع خلال ١٤ يوم من تاريخ الاستلام بشرط أن يكون المنتج بحالته الأصلية. فقط تواصل معنا وسنرسل لك بوليصة الشحن مجاناً 📦',
        'حالياً لدينا عرض خاص: خصم ٣٠٪ على جميع الإلكترونيات بمناسبة نهاية الموسم! استخدم كود SALE30 عند الدفع. العرض ساري حتى نهاية الشهر ⚡',
        'المنتج متوفر بعدة ألوان: أسود، أبيض، وأزرق. المقاسات المتاحة S, M, L, XL. أنصحك بمراجعة جدول المقاسات في صفحة المنتج للحصول على المقاس المثالي.',
        'نقبل الدفع بالفيزا، ماستركارد، مدى، Apple Pay، وأيضاً الدفع عند الاستلام. جميع المعاملات مشفرة وآمنة 🔒',
    ],
    saas: [
        'مرحباً! 👋 كيف أقدر أساعدك مع منصتنا؟ يمكنني مساعدتك في الإعداد، استكشاف المميزات، أو حل أي مشكلة تواجهك.',
        'لربط API الخاصة بنا، تحتاج أولاً إنشاء مفتاح من لوحة التحكم → إعدادات → مفاتيح API. ثم أضف المفتاح في header الطلب كـ `Authorization: Bearer YOUR_KEY`. التوثيق الكامل على docs.platform.com 📚',
        'الباقة الاحترافية تتضمن: ١٠ مشاريع، ١٠٠ ألف طلب API شهرياً، تحليلات متقدمة، دعم أولوية ٢٤/٧، وتكاملات مع Slack و Zapier. يمكنك الترقية من الإعدادات في أي وقت!',
        'لتفعيل المصادقة الثنائية (2FA): اذهب إلى الإعدادات → الأمان → فعّل 2FA. ندعم Google Authenticator و SMS. ننصح بتفعيلها بشدة لحماية حسابك 🔐',
        'يمكنك تصدير البيانات بصيغة CSV أو JSON من قسم التقارير. اختر الفترة الزمنية المطلوبة واضغط "تصدير". الملفات الكبيرة تُرسل على بريدك الإلكتروني خلال دقائق.',
        'حالة النظام الآن: جميع الخدمات تعمل بشكل طبيعي ✅ آخر صيانة كانت قبل ٣ أيام. يمكنك متابعة حالة النظام على status.platform.com',
    ],
    restaurant: [
        'أهلاً وسهلاً! 🍽️ مرحباً بك في مطعمنا. كيف أساعدك؟ يمكنك الاطلاع على القائمة، الحجز، أو الاستفسار عن المكونات.',
        'ساعات العمل: السبت - الخميس من ١٢ ظهراً حتى ١٢ منتصف الليل. الجمعة من ١ ظهراً حتى ١ صباحاً. نستقبل الحجوزات عبر الموقع أو الاتصال المباشر 📞',
        'قائمة الطعام تشمل: المقبلات (حمص، فتوش، متبل)، الأطباق الرئيسية (مشاوي مشكلة، كبسة لحم، سمك مشوي)، والحلويات (كنافة، أم علي). جميع أطباقنا طازجة ومحضرة يومياً! 🥘',
        'نعم! لدينا خيارات للنباتيين تشمل: سلطة الكينوا، برغر نباتي، باستا الخضار، وبيتزا مارغريتا. كما يمكننا تعديل معظم الأطباق لتناسب الحساسية الغذائية — فقط أخبر النادل.',
        'التوصيل متوفر عبر تطبيقات هنقرستيشن وطلبات. الحد الأدنى للطلب ٥٠ ريال والتوصيل مجاني فوق ١٠٠ ريال. متوسط وقت التوصيل ٣٠-٤٥ دقيقة 🚗',
        'يمكنك حجز طاولة لـ ١-٢٠ شخص. للحجوزات الكبيرة (فوق ٨ أشخاص) ننصح بالحجز قبل يوم على الأقل. لدينا أيضاً صالة خاصة للمناسبات تتسع لـ ٣٠ شخص 🎉',
    ],
    education: [
        'مرحباً! 📚 أهلاً بك في منصتنا التعليمية. كيف أساعدك اليوم؟ يمكنك السؤال عن الدورات، التسجيل، أو الشهادات.',
        'لدينا أكثر من ٢٠٠ دورة تدريبية في مجالات البرمجة، التصميم، التسويق، والإدارة. الدورات مقدمة من خبراء معتمدين وتشمل فيديوهات، تمارين تطبيقية، واختبارات.',
        'الشهادة تُمنح بعد إكمال ٨٠٪ على الأقل من محتوى الدورة واجتياز الاختبار النهائي بدرجة ٦٠٪ أو أعلى. الشهادات معتمدة ويمكنك مشاركتها على LinkedIn مباشرة 🎓',
        'نعم! نقدم خصم ٥٠٪ للطلاب بإظهار البطاقة الجامعية. كما نوفر خطط مؤسسية للشركات (١٠+ موظفين) بأسعار مخصصة وتقارير تقدم مفصلة.',
        'يمكنك التعلم بالسرعة التي تناسبك — لا يوجد موعد نهائي! الدورات متاحة ٢٤/٧ على الكمبيوتر والجوال. كما يمكنك تحميل الفيديوهات للمشاهدة بدون إنترنت 📱',
        'المدربون يجيبون على الأسئلة خلال ٢٤ ساعة في منتدى الدورة. كما لدينا مجتمع نشط على Discord للمناقشات والمساعدة بين الطلاب! 💬',
    ],
    general: [
        'مرحباً! WBA هي منصة مساعد ذكي تُضاف لموقعك في دقائق. نستخدم أحدث تقنيات الذكاء الاصطناعي لفهم محتوى موقعك والرد على أسئلة زوارك تلقائياً.',
        'يمكنك البدء بالتسجيل المجاني، ثم إضافة رابط موقعك وسنقوم بفهرسة المحتوى تلقائياً. بعد ذلك تحصل على كود تضمين بسطر واحد تضيفه لموقعك!',
        'نقدم ٤ باقات: المجانية (١٠٠٠ استعلام/شهر)، المبتدئ ($٢٩/شهر)، الاحترافي ($٧٩/شهر)، والمؤسسات (سعر مخصص). يمكنك الترقية في أي وقت.',
        'نعم بالطبع! يمكنك تخصيص الألوان، الشعار، اسم البوت، رسالة الترحيب، الأسئلة المقترحة، وحتى نموذج الذكاء الاصطناعي المستخدم.',
        'ندعم عدة نماذج ذكاء اصطناعي مثل GPT-4o, Claude 3.5, و Gemini Pro. يمكنك اختيار النموذج الأنسب لاحتياجاتك من لوحة التحكم.',
        'نوفر تحليلات متقدمة تشمل: عدد المحادثات، معدل الرضا، أسرع الأسئلة، أوقات الذروة، واستهلاك التوكنات.',
    ],
}

export default function ChatWidget({
    color = '#006c35',
    theme = 'light',
    botName = 'المساعد الذكي',
    botSubtitle = 'مدعوم من WBA',
    welcomeMessage = 'مرحباً! 👋 كيف أساعدك؟',
    placeholder = 'اسأل أي سؤال...',
    suggestions = [],
    showBranding = true,
    onClose,
    radius = 16,
    scenario = 'general',
    onStats,
    avatarStyle = 'sparkle',
}) {
    const responses = scenarioResponses[scenario] || scenarioResponses.general
    const [messages, setMessages] = useState([
        { id: 1, role: 'bot', text: welcomeMessage, time: formatTime(), feedback: null },
    ])
    const [input, setInput] = useState('')
    const [typing, setTyping] = useState(false)
    const [responseIdx, setResponseIdx] = useState(0)
    const [stats, setStats] = useState({ messages: 0, responseTime: 0, satisfaction: 0 })
    const messagesEnd = useRef(null)
    const messagesContainer = useRef(null)

    function formatTime() {
        const d = new Date()
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    }

    useEffect(() => {
        if (messagesContainer.current) {
            messagesContainer.current.scrollTop = messagesContainer.current.scrollHeight
        }
    }, [messages, typing])

    // report stats upward
    useEffect(() => {
        onStats?.(stats)
    }, [stats])

    const sendMessage = useCallback((text) => {
        if (!text.trim() || typing) return
        const userMsg = { id: Date.now(), role: 'user', text, time: formatTime(), feedback: null }
        setMessages(prev => [...prev, userMsg])
        setInput('')
        setTyping(true)

        const delay = 800 + Math.random() * 1200
        setTimeout(() => {
            setTyping(false)
            const botText = responses[responseIdx % responses.length]
            setResponseIdx(prev => prev + 1)
            const newStats = {
                messages: stats.messages + 1,
                responseTime: Math.round(delay),
                satisfaction: Math.round(85 + Math.random() * 14),
            }
            setStats(newStats)
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'bot',
                text: botText,
                time: formatTime(),
                feedback: null,
            }])
        }, delay)
    }, [typing, responseIdx, stats, responses])

    const handleKey = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            sendMessage(input)
        }
    }

    const setFeedback = (msgId, type) => {
        setMessages(prev => prev.map(m => m.id === msgId ? { ...m, feedback: type } : m))
    }

    const isDark = theme === 'dark'

    const avatarIcon = avatarStyle === 'bot' ? <Bot size={14} />
        : avatarStyle === 'circle' ? <span style={{ fontSize: 10 }}>●</span>
            : <Sparkles size={14} />

    return (
        <div className="chat-widget" style={{
            background: isDark ? 'var(--bg-2)' : '#fff',
            borderRadius: `${radius}px`,
        }}>
            {/* Header */}
            <div className="chat-header" style={{
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                borderRadius: `${radius}px ${radius}px 0 0`,
            }}>
                <div className="chat-header-bg" style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }} />
                <div className="chat-header-info">
                    <div className="chat-header-avatar" style={{ background: `rgba(255,255,255,0.2)` }}>
                        {avatarIcon}
                    </div>
                    <div className="chat-header-text">
                        <h4>{botName}</h4>
                        <span>{botSubtitle}</span>
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button onClick={onClose || undefined} title="تصغير"><Minus size={16} /></button>
                    <button onClick={onClose || undefined} title="إغلاق"><X size={16} /></button>
                </div>
            </div>

            {/* Messages */}
            <div ref={messagesContainer} className="chat-messages" style={{ background: isDark ? 'var(--bg-1)' : '#fafafa' }}>
                {messages.map(msg => (
                    <div key={msg.id} className={`chat-msg ${msg.role === 'user' ? 'user' : ''}`}>
                        <div
                            className="chat-msg-avatar"
                            style={{
                                background: msg.role === 'user' ? (isDark ? 'var(--bg-4)' : '#ddd') : color,
                                color: '#fff',
                            }}
                        >
                            {msg.role === 'user' ? '👤' : avatarIcon}
                        </div>
                        <div style={{ maxWidth: '82%' }}>
                            <div
                                className="chat-msg-bubble"
                                style={{
                                    background: msg.role === 'user'
                                        ? color
                                        : isDark ? 'var(--bg-3)' : '#f0f0f0',
                                    color: msg.role === 'user'
                                        ? '#fff'
                                        : isDark ? 'var(--text-1)' : '#333',
                                    borderRadius: `${radius}px`,
                                }}
                            >
                                {msg.text}
                            </div>
                            <div className="chat-msg-meta">
                                <span className="chat-msg-time">{msg.time}</span>
                                {msg.role === 'bot' && msg.id !== 1 && (
                                    <div className="chat-msg-feedback">
                                        <button
                                            onClick={() => setFeedback(msg.id, 'up')}
                                            className={msg.feedback === 'up' ? 'active' : ''}
                                            style={{ color: msg.feedback === 'up' ? '#006c35' : undefined }}
                                        >
                                            <ThumbsUp size={11} />
                                        </button>
                                        <button
                                            onClick={() => setFeedback(msg.id, 'down')}
                                            className={msg.feedback === 'down' ? 'active' : ''}
                                            style={{ color: msg.feedback === 'down' ? '#f87171' : undefined }}
                                        >
                                            <ThumbsDown size={11} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}

                {typing && (
                    <div className="chat-msg">
                        <div className="chat-msg-avatar" style={{ background: color, color: '#fff' }}>
                            {avatarIcon}
                        </div>
                        <div className="chat-msg-bubble chat-typing-bubble" style={{
                            background: isDark ? 'var(--bg-3)' : '#f0f0f0',
                            borderRadius: `${radius}px`,
                        }}>
                            <div className="typing-dots">
                                <span /><span /><span />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEnd} />
            </div>

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div
                    className="chat-suggestions"
                    style={{
                        background: isDark ? 'var(--bg-1)' : '#fafafa',
                        visibility: messages.length <= 1 ? 'visible' : 'hidden',
                        height: messages.length <= 1 ? undefined : 0,
                        padding: messages.length <= 1 ? undefined : 0,
                        overflow: 'hidden',
                    }}
                >
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            className="chat-suggestion-chip"
                            onClick={() => sendMessage(s)}
                            style={{
                                borderColor: `${color}30`,
                                color: isDark ? 'var(--text-2)' : '#555',
                                background: isDark ? 'var(--bg-3)' : '#f5f5f5',
                            }}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            {/* Input bar */}
            <div
                className="chat-input-bar"
                style={{
                    background: isDark ? 'var(--bg-2)' : '#fff',
                    borderColor: isDark ? 'var(--border-1)' : '#eee',
                }}
            >
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={placeholder}
                    disabled={typing}
                    style={{
                        background: isDark ? 'var(--bg-3)' : '#f5f5f5',
                        borderColor: isDark ? 'var(--border-2)' : '#e5e5e5',
                        color: isDark ? 'var(--text-1)' : '#333',
                        opacity: typing ? 0.6 : 1,
                    }}
                />
                <button
                    className="chat-send-btn"
                    onClick={() => sendMessage(input)}
                    disabled={typing || !input.trim()}
                    style={{
                        background: color,
                        opacity: typing || !input.trim() ? 0.5 : 1,
                    }}
                >
                    <Send size={16} />
                </button>
            </div>

            {/* Branding */}
            {showBranding && (
                <div className="chat-footer" style={{
                    background: isDark ? 'var(--bg-2)' : '#fafafa',
                    borderColor: isDark ? 'var(--border-1)' : '#eee',
                    borderRadius: `0 0 ${radius}px ${radius}px`,
                }}>
                    مدعوم من <strong>WBA</strong>
                </div>
            )}
        </div>
    )
}
