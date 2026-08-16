import { useState, useEffect } from 'react'
import { Outlet, NavLink, Link } from 'react-router-dom'
import { Bot, MessageSquare, X, Sun, Moon, Minus } from 'lucide-react'
import ChatWidget from './ChatWidget'
import { urls } from '../lib/urls'

export default function Layout() {
    const [scrolled, setScrolled] = useState(false)
    const [chatOpen, setChatOpen] = useState(false)
    const [theme, setTheme] = useState(() => localStorage.getItem('wba-theme') || 'light')

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
        localStorage.setItem('wba-theme', theme)
    }, [theme])

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 20)
        window.addEventListener('scroll', onScroll)
        return () => window.removeEventListener('scroll', onScroll)
    }, [])

    const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

    return (
        <>
            {/* ─── Navbar ─── */}
            <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} id="main-navbar">
                <Link to="/" className="nav-brand">
                    <div className="nav-brand-icon">
                        <Bot size={22} />
                    </div>
                    <h1>WBA</h1>
                </Link>

                <div className="nav-links">
                    <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>الرئيسية</NavLink>
                    <NavLink to="/features" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>المميزات</NavLink>
                    <NavLink to="/pricing" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>الأسعار</NavLink>
                    <NavLink to="/demo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>تجربة مباشرة</NavLink>
                </div>

                <div className="nav-actions">
                    <button
                        className="theme-toggle"
                        onClick={toggleTheme}
                        aria-label={theme === 'dark' ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
                        title={theme === 'dark' ? 'الوضع الفاتح' : 'الوضع الداكن'}
                    >
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <a href={urls.login} className="btn btn-ghost">تسجيل الدخول</a>
                    <Link to="/signup" className="btn btn-primary">ابدأ مجاناً</Link>
                </div>
            </nav>

            {/* ─── Page Content ─── */}
            <Outlet />

            {/* ─── Footer ─── */}
            <footer className="footer" id="site-footer">
                <div className="container">
                    <div className="footer-grid">
                        <div className="footer-brand">
                            <Link to="/" className="nav-brand">
                                <div className="nav-brand-icon">
                                    <Bot size={20} />
                                </div>
                                <h1 style={{ fontSize: 18 }}>WBA</h1>
                            </Link>
                            <p>منصة مساعد المواقع الذكي. أضف بوت محادثة ذكي مدعوم بالذكاء الاصطناعي لموقعك في دقائق وارفع تجربة عملائك.</p>
                        </div>
                        <div className="footer-col">
                            <h4>المنتج</h4>
                            <Link to="/features">المميزات</Link>
                            <Link to="/pricing">الأسعار</Link>
                            <Link to="/demo">تجربة مباشرة</Link>
                            <a href="#">التوثيق</a>
                        </div>
                        <div className="footer-col">
                            <h4>الشركة</h4>
                            <a href="#">عن المنصة</a>
                            <a href="#">المدوّنة</a>
                            <a href="#">الوظائف</a>
                            <a href="#">تواصل معنا</a>
                        </div>
                        <div className="footer-col">
                            <h4>الدعم</h4>
                            <a href="#">مركز المساعدة</a>
                            <a href="#">حالة النظام</a>
                            <a href="#">سياسة الخصوصية</a>
                            <a href="#">الشروط والأحكام</a>
                        </div>
                    </div>
                    <div className="footer-bottom">
                        <p>© ٢٠٢٦ WBA — جميع الحقوق محفوظة</p>
                        <div style={{ display: 'flex', gap: 16 }}>
                            <a href="#" style={{ color: 'var(--text-4)', fontSize: 13 }}>Twitter</a>
                            <a href="#" style={{ color: 'var(--text-4)', fontSize: 13 }}>GitHub</a>
                            <a href="#" style={{ color: 'var(--text-4)', fontSize: 13 }}>Discord</a>
                        </div>
                    </div>
                </div>
            </footer>

            {/* ─── Floating Chat Widget (Preview) ─── */}
            {chatOpen && (
                <div className="floating-chat-overlay" id="floating-chat">
                    <ChatWidget
                        color="#006c35"
                        theme={theme}
                        botName="مساعد WBA"
                        botSubtitle="متصل الآن"
                        welcomeMessage="مرحباً! 👋 أنا مساعد WBA الذكي. كيف أقدر أساعدك اليوم؟"
                        placeholder="اسأل أي سؤال..."
                        suggestions={['ما هي المميزات؟', 'كم الأسعار؟', 'كيف أبدأ؟']}
                        onClose={() => setChatOpen(false)}
                    />
                </div>
            )}
            <button
                className="floating-widget-btn"
                id="floating-widget-toggle"
                onClick={() => setChatOpen(!chatOpen)}
                aria-label="فتح المحادثة"
            >
                {chatOpen ? <X size={22} /> : <MessageSquare size={22} />}
            </button>
        </>
    )
}
