import { useState, useEffect, useRef, useMemo } from 'react'
import {
    BookOpen, Globe, RefreshCw, CheckCircle2, Database, ExternalLink, FileUp, Trash2, Eye, EyeOff, X,
    CircleHelp, ChevronDown, ChevronUp, StopCircle, Search, Layers, List, Grid, Check,
    Sparkles, Copy, FileText, ShieldAlert, SlidersHorizontal, ArrowUpDown
} from 'lucide-react'
import { api } from '../api'
import PlanLimitBanner from '../components/PlanLimitBanner'
import { useTenantWebsites } from '../hooks/useTenantWebsites'
import { crawlUrlFromWebsite } from '../lib/websiteOwnership'
import {
    CRAWL_DEPTH_OPTIONS,
    detectSiteType,
    getSupabaseHelpText,
    formatSupabaseStats,
    buildCrawlSummaryMessage,
    isSuccessMessage,
} from '../lib/knowledgeHelpers'

export default function KnowledgeBase({ user, setupMode = false }) {
    const { active: website } = useTenantWebsites(user)
    
    // Core Data
    const [pages, setPages] = useState([])
    const [count, setCount] = useState(0)
    const [baseUrl, setBaseUrl] = useState('')
    const [loading, setLoading] = useState(true)
    const [crawling, setCrawling] = useState(false)
    const [savingInfo, setSavingInfo] = useState(false)
    const [message, setMessage] = useState('')
    const [siteKnowledge, setSiteKnowledge] = useState('')
    const [supabaseUrl, setSupabaseUrl] = useState('')
    const [supabaseAnonKey, setSupabaseAnonKey] = useState('')
    const [supabaseConfigured, setSupabaseConfigured] = useState(false)
    const [supabaseStats, setSupabaseStats] = useState(null)
    const [supabaseSchema, setSupabaseSchema] = useState(null)
    const [lastCrawled, setLastCrawled] = useState(null)
    const [crawlLogs, setCrawlLogs] = useState([])
    const [canceling, setCanceling] = useState(false)
    const [crawlDepth, setCrawlDepth] = useState('deep')
    const [documents, setDocuments] = useState([])
    const [uploading, setUploading] = useState(false)
    const [uploadTitle, setUploadTitle] = useState('')
    const [extractView, setExtractView] = useState(null)
    const [loadingExtractId, setLoadingExtractId] = useState(null)
    const [usage, setUsage] = useState(null)
    
    // UI & Navigation States
    const [activeTab, setActiveTab] = useState('pages') // 'pages' | 'documents' | 'simulator' | 'settings'
    const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table' | 'chunks'
    const [searchQuery, setSearchQuery] = useState('')
    const [visibilityFilter, setVisibilityFilter] = useState('all') // 'all' | 'included' | 'excluded'
    const [sourceFilter, setSourceFilter] = useState('all') // 'all' | 'crawl' | 'db'
    const [sortBy, setSortBy] = useState('path') // 'path' | 'title' | 'chunks' | 'size'
    const [selectedPageIds, setSelectedPageIds] = useState([])
    const [inspectingPage, setInspectingPage] = useState(null)
    const [inspectTab, setInspectTab] = useState('chunks') // 'chunks' | 'content' | 'headings'
    const [copiedText, setCopiedText] = useState(false)

    // RAG Simulator States
    const [simQuery, setSimQuery] = useState('')
    const [simLoading, setSimLoading] = useState(false)
    const [simResult, setSimResult] = useState(null)
    const [simError, setSimError] = useState('')

    // Collapsible & Refs
    const [uploadHelpOpen, setUploadHelpOpen] = useState(false)
    const fileInputRef = useRef(null)
    const crawlLogEndRef = useRef(null)
    const pollTokenRef = useRef(0)

    const { isCarSite, isEducationSite } = detectSiteType(baseUrl, supabaseSchema)
    const supabaseHelpText = getSupabaseHelpText({ isCarSite, isEducationSite })

    const load = () => {
        setLoading(true)
        Promise.all([
            api.getKnowledgePages(),
            api.getConfig(),
            api.getSupabaseStatus().catch(() => null),
            api.getKnowledgeDocuments().catch(() => ({ documents: [] })),
            api.getUsage().catch(() => null),
        ])
            .then(([data, cfg, sb, docsRes, usageData]) => {
                setPages(data.pages || [])
                setCount(data.count || 0)
                setDocuments(docsRes.documents || [])
                setUsage(usageData)
                setBaseUrl(crawlUrlFromWebsite(website, data.knowledgeBaseUrl || cfg.knowledgeBaseUrl || ''))
                setSiteKnowledge(cfg.siteKnowledge || '')
                setSupabaseUrl(cfg.supabaseUrl || '')
                setSupabaseAnonKey(cfg.supabaseAnonKey || '')
                setSupabaseConfigured(Boolean(data.supabaseConfigured || (cfg.supabaseUrl && cfg.supabaseAnonKey)))
                setSupabaseStats(sb?.configured ? sb : null)
                setSupabaseSchema(sb?.schema || null)
                const latest = (data.pages || [])
                    .map((p) => p.crawled_at)
                    .filter(Boolean)
                    .sort()
                    .pop()
                setLastCrawled(latest || null)
            })
            .catch((err) => setMessage(err.message))
            .finally(() => setLoading(false))
    }

    useEffect(() => {
        setExtractView(null)
        setInspectingPage(null)
        setSimResult(null)
        setSelectedPageIds([])
        setMessage('')
        load()
    }, [user?.websiteId])

    // Resume a background crawl that is still running
    useEffect(() => {
        pollTokenRef.current += 1
        setCrawling(false)
        setCanceling(false)
        setCrawlLogs([])
        let active = true
        api.getCrawlStatus()
            .then((data) => {
                if (active && data?.job?.status === 'running') {
                    runPolling()
                }
            })
            .catch(() => {})
        return () => {
            active = false
            pollTokenRef.current += 1
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.websiteId])

    useEffect(() => {
        crawlLogEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [crawlLogs])

    // Toggle AI Visibility for a Single Page
    const togglePageVisibility = async (pageId, currentExcluded) => {
        const nextExcluded = !currentExcluded
        // Optimistic UI update
        setPages((prev) =>
            prev.map((p) => (p.id === pageId ? { ...p, excluded_from_ai: nextExcluded } : p))
        )
        if (inspectingPage?.id === pageId) {
            setInspectingPage((prev) => ({ ...prev, excluded_from_ai: nextExcluded }))
        }
        try {
            await api.setPageAiVisibility(pageId, nextExcluded)
            setMessage(nextExcluded ? 'تم استبعاد الصفحة من معرفة الذكاء' : 'تم تضمين الصفحة في معرفة الذكاء بنجاح')
        } catch (err) {
            // Rollback on error
            setPages((prev) =>
                prev.map((p) => (p.id === pageId ? { ...p, excluded_from_ai: currentExcluded } : p))
            )
            setMessage(`فشل تعديل حالة الصفحة: ${err.message}`)
        }
    }

    // Toggle AI Visibility for a Single Document
    const toggleDocumentVisibility = async (docId, currentExcluded) => {
        const nextExcluded = !currentExcluded
        setDocuments((prev) =>
            prev.map((d) => (d.id === docId ? { ...d, excluded_from_ai: nextExcluded } : d))
        )
        try {
            await api.setDocumentAiVisibility(docId, nextExcluded)
            setMessage(nextExcluded ? 'تم استبعاد المستند من معرفة الذكاء' : 'تم تضمين المستند في معرفة الذكاء بنجاح')
        } catch (err) {
            setDocuments((prev) =>
                prev.map((d) => (d.id === docId ? { ...d, excluded_from_ai: currentExcluded } : d))
            )
            setMessage(`فشل تعديل حالة المستند: ${err.message}`)
        }
    }

    // Batch AI Visibility Toggle for Selected Pages
    const setBatchVisibility = async (nextExcluded) => {
        if (!selectedPageIds.length) return
        const ids = [...selectedPageIds]
        // Optimistic update
        setPages((prev) =>
            prev.map((p) => (ids.includes(p.id) ? { ...p, excluded_from_ai: nextExcluded } : p))
        )
        try {
            await api.setBatchPagesAiVisibility(ids, nextExcluded)
            setMessage(
                nextExcluded
                    ? `تم استبعاد ${ids.length} صفحة من معرفة الذكاء الاصطناعي`
                    : `تم تضمين ${ids.length} صفحة في معرفة الذكاء الاصطناعي`
            )
            setSelectedPageIds([])
        } catch (err) {
            setMessage(`فشل الإجراء الجماعي: ${err.message}`)
            load()
        }
    }

    // Inspect full page details & RAG chunks
    const handleInspectPage = async (page) => {
        setInspectingPage(page)
        setInspectTab('chunks')
        try {
            const data = await api.getPageDetails(page.id)
            if (data?.page) {
                setInspectingPage(data.page)
            }
        } catch (err) {
            console.error('Failed to fetch page details:', err)
        }
    }

    // Run Live RAG Simulator Query
    const handleRunRagSimulation = async (e) => {
        e?.preventDefault?.()
        if (!simQuery.trim()) return
        setSimLoading(true)
        setSimError('')
        setSimResult(null)
        try {
            const data = await api.testRagQuery(simQuery.trim())
            setSimResult(data)
        } catch (err) {
            setSimError(err.message || 'فشل تشغيل محاكاة RAG')
        } finally {
            setSimLoading(false)
        }
    }

    const toggleDocumentExtract = async (id) => {
        if (extractView?.document?.id === id) {
            setExtractView(null)
            return
        }
        setLoadingExtractId(id)
        try {
            const data = await api.getDocumentExtract(id)
            setExtractView(data)
        } catch (err) {
            setMessage(err.message)
        } finally {
            setLoadingExtractId(null)
        }
    }

    const handleUploadDocument = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setUploading(true)
        setMessage('')
        try {
            const res = await api.uploadKnowledgeDocument(file, uploadTitle || file.name)
            setMessage(res.message || 'تم رفع المستند واستخراج المعرفة بنجاح')
            setUploadTitle('')
            if (res.extracted?.chunks?.length) {
                setExtractView(res.extracted)
            } else if (res.documentId) {
                await toggleDocumentExtract(res.documentId)
            }
            load()
        } catch (err) {
            setMessage(err.message)
        } finally {
            setUploading(false)
        }
    }

    const deleteDocument = async (id) => {
        if (!window.confirm('حذف هذا المستند وفهرسته من قاعدة المعرفة؟')) return
        try {
            await api.deleteKnowledgeDocument(id)
            setMessage('تم حذف المستند')
            if (extractView?.document?.id === id) setExtractView(null)
            load()
        } catch (err) {
            setMessage(err.message)
        }
    }

    const saveSiteKnowledge = async () => {
        setSavingInfo(true)
        try {
            const cfg = await api.getConfig()
            await api.saveConfig({
                ...cfg,
                siteKnowledge,
                supabaseUrl: supabaseUrl.trim(),
                supabaseAnonKey: supabaseAnonKey.trim(),
            })
            const sb = await api.getSupabaseStatus().catch(() => null)
            setSupabaseStats(sb?.configured ? sb : null)
            setSupabaseSchema(sb?.schema || null)
            setSupabaseConfigured(Boolean(supabaseUrl.trim() && supabaseAnonKey.trim()))
            setMessage('تم حفظ معلومات الموقع وإعدادات Supabase')
        } catch (err) {
            setMessage(err.message)
        } finally {
            setSavingInfo(false)
        }
    }

    const runPolling = async () => {
        const token = ++pollTokenRef.current
        setCrawling(true)
        let since = 0
        let first = true
        try {
            while (pollTokenRef.current === token) {
                let job
                try {
                    ({ job } = await api.getCrawlStatus(since))
                } catch (err) {
                    setMessage(err.message)
                    break
                }
                if (pollTokenRef.current !== token) return
                if (!job) break
                if (job.logs?.length) {
                    setCrawlLogs((prev) => (first ? job.logs : [...prev, ...job.logs]))
                    since = job.logSeq ?? since
                    first = false
                } else if (first) {
                    setCrawlLogs([])
                    first = false
                }
                if (job.status !== 'running') {
                    setCanceling(false)
                    if (job.status === 'canceled') {
                        setMessage('تم إلغاء الزحف')
                    } else if (job.status === 'failed') {
                        setMessage(job.error || 'فشل الزحف')
                    } else {
                        setMessage(buildCrawlSummaryMessage(job.summary || {}, baseUrl))
                    }
                    load()
                    break
                }
                await new Promise((r) => setTimeout(r, 1500))
            }
        } finally {
            if (pollTokenRef.current === token) setCrawling(false)
        }
    }

    const crawl = async () => {
        const trimmed = crawlUrlFromWebsite(website, baseUrl)
        if (!trimmed) {
            setMessage('أضف موقعاً من تبويب المواقع أولاً')
            return
        }
        setCrawlLogs([])
        setMessage('')
        setCanceling(false)
        try {
            const cfg = await api.getConfig()
            if (trimmed !== cfg.knowledgeBaseUrl) {
                await api.saveConfig({ ...cfg, knowledgeBaseUrl: trimmed })
            }
            const { alreadyRunning } = await api.startCrawl(trimmed, { depth: crawlDepth })
            if (alreadyRunning) {
                setMessage('يوجد زحف قيد التنفيذ لهذا الموقع — يتم عرض التقدم الحالي')
            }
            runPolling()
        } catch (err) {
            setMessage(err.message)
            setCrawling(false)
        }
    }

    const stopCrawl = async () => {
        setCanceling(true)
        try {
            await api.cancelCrawl()
            setMessage('جاري إلغاء الزحف…')
        } catch (err) {
            setMessage(err.message)
            setCanceling(false)
        }
    }

    // Filter & Sort Logic for Indexed Pages
    const filteredPages = useMemo(() => {
        return pages.filter((p) => {
            // Search Query Filter
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim()
                const matchPath = (p.path || '').toLowerCase().includes(q)
                const matchTitle = (p.title || '').toLowerCase().includes(q)
                const matchContent = (p.content_preview || p.content || '').toLowerCase().includes(q)
                if (!matchPath && !matchTitle && !matchContent) return false
            }
            // Visibility Filter
            if (visibilityFilter === 'included' && p.excluded_from_ai) return false
            if (visibilityFilter === 'excluded' && !p.excluded_from_ai) return false
            // Source Filter
            const isDb = String(p.path || '').startsWith('/db/')
            if (sourceFilter === 'db' && !isDb) return false
            if (sourceFilter === 'crawl' && isDb) return false
            return true
        }).sort((a, b) => {
            if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '', 'ar')
            if (sortBy === 'chunks') return (b.rag_chunk_count || 0) - (a.rag_chunk_count || 0)
            if (sortBy === 'size') return (b.content_length || 0) - (a.content_length || 0)
            return (a.path || '').localeCompare(b.path || '')
        })
    }, [pages, searchQuery, visibilityFilter, sourceFilter, sortBy])

    // Stats calculations
    const totalPagesCount = pages.length
    const visiblePagesCount = pages.filter((p) => !p.excluded_from_ai).length
    const excludedPagesCount = totalPagesCount - visiblePagesCount
    const totalDocsCount = documents.length
    const visibleDocsCount = documents.filter((d) => !d.excluded_from_ai).length
    const totalRagChunks = pages.reduce((n, p) => n + (p.rag_chunk_count || 1), 0) +
        documents.reduce((n, d) => n + (Number(d.chunk_count) || 0), 0)

    const docChunksCount = documents.reduce((n, d) => n + (Number(d.chunk_count) || 0), 0)
    const atDocLimit =
        usage?.limits?.documentsPerWebsite != null &&
        usage.used.documentsOnWebsite >= usage.limits.documentsPerWebsite

    const success = isSuccessMessage(message)
    const crawlTarget = crawlUrlFromWebsite(website, baseUrl)

    // Selection helpers
    const toggleSelectPage = (id) => {
        setSelectedPageIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const selectAllFiltered = () => {
        setSelectedPageIds(filteredPages.map((p) => p.id))
    }

    const clearSelection = () => {
        setSelectedPageIds([])
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text)
        setCopiedText(true)
        setTimeout(() => setCopiedText(false), 2000)
    }

    return (
        <>
            {!setupMode && (
                <div className="topbar">
                    <div className="topbar-left">
                        <h1>علّم المساعد (قاعدة المعرفة)</h1>
                        <p>تحكم كامل فيما يقرأه ويسترجعه المساعد الذكي من موقعك ومستنداتك</p>
                    </div>
                    <div className="topbar-right">
                        <button className="btn btn-secondary" onClick={load} disabled={loading || crawling}>
                            <RefreshCw size={14} className={loading ? 'spin' : ''} /> تحديث
                        </button>
                        <button className="btn btn-primary" onClick={crawl} disabled={crawling || !crawlTarget}>
                            <Globe size={14} /> {crawling ? 'جاري الزحف...' : 'زحف الموقع الآن'}
                        </button>
                    </div>
                </div>
            )}

            {/* Notification message */}
            {message && (
                <div
                    style={{
                        marginBottom: 16,
                        padding: '12px 16px',
                        borderRadius: 10,
                        fontSize: 13.5,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        background: success ? 'var(--green-muted)' : 'rgba(248,113,113,0.1)',
                        color: success ? 'var(--green)' : '#f87171',
                        border: `1px solid ${success ? 'var(--green)' : 'rgba(248,113,113,0.3)'}`,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {success ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
                        <span>{message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setMessage('')}
                        style={{ color: 'inherit', opacity: 0.7, cursor: 'pointer' }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Crawl Progress & Logs (When Active) */}
            {(crawling || crawlLogs.length > 0) && (
                <div
                    className="card anim-in"
                    style={{
                        marginBottom: 20,
                        border: '1px solid var(--accent)',
                        background: 'var(--bg-2)',
                    }}
                >
                    <div
                        style={{
                            padding: '12px 16px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            borderBottom: '1px solid var(--border-1)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            background: 'var(--bg-3)',
                        }}
                    >
                        <Globe size={14} className={crawling ? 'spin' : ''} />
                        سجل الزحف والتغذية المعرفية
                        {crawling && (
                            <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                                — يعمل في الخلفية على الخادم
                            </span>
                        )}
                        {crawling && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={stopCrawl}
                                disabled={canceling}
                                style={{ marginInlineStart: 'auto', color: '#f87171' }}
                            >
                                <StopCircle size={13} />
                                {canceling ? 'جاري الإيقاف…' : 'إيقاف الزحف'}
                            </button>
                        )}
                    </div>
                    <div
                        style={{
                            maxHeight: 180,
                            overflowY: 'auto',
                            padding: '10px 14px',
                            fontFamily: 'var(--mono)',
                            fontSize: 12,
                            lineHeight: 1.7,
                            direction: 'ltr',
                            textAlign: 'left',
                            background: 'var(--bg-0)',
                        }}
                    >
                        {crawlLogs.length === 0 && crawling && (
                            <div style={{ color: 'var(--text-3)' }}>بدء الاتصال وفهرسة الروابط…</div>
                        )}
                        {crawlLogs.map((log, i) => (
                            <div
                                key={`${log.ts}-${i}`}
                                style={{
                                    color:
                                        log.phase === 'done'
                                            ? 'var(--green)'
                                            : log.phase === 'fetch' && log.meta?.ok === false
                                            ? '#f87171'
                                            : 'var(--text-2)',
                                }}
                            >
                                <span style={{ color: 'var(--text-4)', marginInlineEnd: 8 }}>
                                    {log.ts ? new Date(log.ts).toLocaleTimeString('ar-SA') : ''}
                                </span>
                                {log.text}
                            </div>
                        ))}
                        <div ref={crawlLogEndRef} />
                    </div>
                </div>
            )}

            {/* Knowledge Health & RAG Stats Grid */}
            <div className="kb-stats-grid">
                <div
                    className={`kb-stat-card ${activeTab === 'pages' && visibilityFilter === 'all' ? 'is-active' : ''}`}
                    onClick={() => {
                        setActiveTab('pages')
                        setVisibilityFilter('all')
                    }}
                >
                    <div className="kb-stat-icon accent">
                        <BookOpen size={20} />
                    </div>
                    <div className="kb-stat-info">
                        <div className="kb-stat-val">{totalPagesCount.toLocaleString('ar-SA')}</div>
                        <div className="kb-stat-lbl">إجمالي الصفحات المفهرسة</div>
                    </div>
                </div>

                <div
                    className={`kb-stat-card ${activeTab === 'pages' && visibilityFilter === 'included' ? 'is-active' : ''}`}
                    onClick={() => {
                        setActiveTab('pages')
                        setVisibilityFilter('included')
                    }}
                >
                    <div className="kb-stat-icon green">
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="kb-stat-info">
                        <div className="kb-stat-val">{visiblePagesCount.toLocaleString('ar-SA')}</div>
                        <div className="kb-stat-lbl">نشط في الذكاء الاصطناعي (RAG)</div>
                    </div>
                </div>

                <div
                    className={`kb-stat-card ${activeTab === 'pages' && visibilityFilter === 'excluded' ? 'is-active' : ''}`}
                    onClick={() => {
                        setActiveTab('pages')
                        setVisibilityFilter('excluded')
                    }}
                >
                    <div className="kb-stat-icon amber">
                        <EyeOff size={20} />
                    </div>
                    <div className="kb-stat-info">
                        <div className="kb-stat-val">{excludedPagesCount.toLocaleString('ar-SA')}</div>
                        <div className="kb-stat-lbl">مستثنى ومخفي عن الذكاء</div>
                    </div>
                </div>

                <div
                    className={`kb-stat-card ${activeTab === 'documents' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('documents')}
                >
                    <div className="kb-stat-icon blue">
                        <FileUp size={20} />
                    </div>
                    <div className="kb-stat-info">
                        <div className="kb-stat-val">{totalDocsCount.toLocaleString('ar-SA')}</div>
                        <div className="kb-stat-lbl">مستندات ومصادر مرفوعة ({docChunksCount} مقطع)</div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="kb-tabs-nav">
                <button
                    type="button"
                    className={`kb-tab-btn ${activeTab === 'pages' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('pages')}
                >
                    <Globe size={15} />
                    صفحات الموقع والروابط
                    <span className="kb-tab-badge">{filteredPages.length}</span>
                </button>

                <button
                    type="button"
                    className={`kb-tab-btn ${activeTab === 'documents' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('documents')}
                >
                    <FileText size={15} />
                    المستندات والمصادر المرفوعة
                    <span className="kb-tab-badge">{documents.length}</span>
                </button>

                <button
                    type="button"
                    className={`kb-tab-btn ${activeTab === 'simulator' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('simulator')}
                >
                    <Sparkles size={15} />
                    مختبر استرجاع الذكاء (RAG Simulator)
                </button>

                <button
                    type="button"
                    className={`kb-tab-btn ${activeTab === 'settings' ? 'is-active' : ''}`}
                    onClick={() => setActiveTab('settings')}
                >
                    <Database size={15} />
                    إعدادات المعرفة و Supabase
                </button>
            </div>

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* TAB 1: INDEXED PAGES & URLS */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'pages' && (
                <div className="anim-in">
                    {/* Control Toolbar */}
                    <div className="kb-toolbar">
                        <div className="kb-search-box">
                            <Search size={15} className="kb-search-icon" />
                            <input
                                type="text"
                                className="kb-search-input"
                                placeholder="بحث في المسارات، العناوين، أو النصوص..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    style={{
                                        position: 'absolute',
                                        left: 10,
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        color: 'var(--text-3)',
                                    }}
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        {/* Filter Pills */}
                        <div className="kb-filter-pills">
                            <button
                                type="button"
                                className={`kb-filter-pill ${visibilityFilter === 'all' ? 'is-active' : ''}`}
                                onClick={() => setVisibilityFilter('all')}
                            >
                                الكل ({totalPagesCount})
                            </button>
                            <button
                                type="button"
                                className={`kb-filter-pill ${visibilityFilter === 'included' ? 'is-active' : ''}`}
                                onClick={() => setVisibilityFilter('included')}
                            >
                                <Check size={13} /> نشط في الذكاء ({visiblePagesCount})
                            </button>
                            <button
                                type="button"
                                className={`kb-filter-pill ${visibilityFilter === 'excluded' ? 'is-active' : ''}`}
                                onClick={() => setVisibilityFilter('excluded')}
                            >
                                <EyeOff size={13} /> مستثنى ({excludedPagesCount})
                            </button>

                            {/* Source Filter */}
                            <button
                                type="button"
                                className={`kb-filter-pill ${sourceFilter === 'crawl' ? 'is-active' : ''}`}
                                onClick={() => setSourceFilter((prev) => (prev === 'crawl' ? 'all' : 'crawl'))}
                            >
                                زحف المتجر
                            </button>
                            {supabaseConfigured && (
                                <button
                                    type="button"
                                    className={`kb-filter-pill ${sourceFilter === 'db' ? 'is-active' : ''}`}
                                    onClick={() => setSourceFilter((prev) => (prev === 'db' ? 'all' : 'db'))}
                                >
                                    Supabase
                                </button>
                            )}
                        </div>

                        {/* Sort & View Mode Switcher */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginInlineStart: 'auto' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <ArrowUpDown size={14} style={{ color: 'var(--text-3)' }} />
                                <select
                                    className="input"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{
                                        padding: '5px 10px',
                                        fontSize: 12,
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid var(--border-1)',
                                        background: 'var(--bg-2)',
                                        color: 'var(--text-1)',
                                    }}
                                >
                                    <option value="path">ترتيب: المسار</option>
                                    <option value="title">ترتيب: العنوان</option>
                                    <option value="chunks">ترتيب: الأكثر مقاطع RAG</option>
                                    <option value="size">ترتيب: الحجم (الأطول)</option>
                                </select>
                            </div>

                            <div className="kb-view-modes">
                                <button
                                    type="button"
                                    className={`kb-view-btn ${viewMode === 'cards' ? 'is-active' : ''}`}
                                    onClick={() => setViewMode('cards')}
                                    title="عرض البطاقات التفاعلية"
                                >
                                    <Grid size={15} />
                                </button>
                                <button
                                    type="button"
                                    className={`kb-view-btn ${viewMode === 'table' ? 'is-active' : ''}`}
                                    onClick={() => setViewMode('table')}
                                    title="عرض الجدول المطور"
                                >
                                    <List size={15} />
                                </button>
                                <button
                                    type="button"
                                    className={`kb-view-btn ${viewMode === 'chunks' ? 'is-active' : ''}`}
                                    onClick={() => setViewMode('chunks')}
                                    title="عرض مستكشف مقاطع RAG"
                                >
                                    <Layers size={15} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bulk Actions Floating Bar */}
                    {selectedPageIds.length > 0 && (
                        <div className="kb-bulk-bar">
                            <div className="kb-bulk-info">
                                <CheckCircle2 size={16} style={{ color: 'var(--accent)' }} />
                                <span>تم تحديد {selectedPageIds.length.toLocaleString('ar-SA')} صفحة</span>
                            </div>
                            <div className="kb-bulk-actions">
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setBatchVisibility(false)}
                                >
                                    <Check size={14} /> تضمين المحدد في الذكاء
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    style={{ color: '#f87171' }}
                                    onClick={() => setBatchVisibility(true)}
                                >
                                    <EyeOff size={14} /> استبعاد المحدد من الذكاء
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={selectAllFiltered}
                                >
                                    تحديد كل النتائج ({filteredPages.length})
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={clearSelection}
                                >
                                    إلغاء التحديد
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Content Views */}
                    {loading ? (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                                <RefreshCw size={24} className="spin" style={{ margin: '0 auto 12px' }} />
                                <div>جاري تحميل صفحات وقاعدة المعرفة...</div>
                            </div>
                        </div>
                    ) : filteredPages.length === 0 ? (
                        <div className="card">
                            <div className="card-body" style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>
                                <BookOpen size={32} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: 'var(--text-1)' }}>
                                    {pages.length === 0 ? 'لا توجد صفحات مفهرسة بعد' : 'لا توجد نتائج مطابقة لخيارات البحث أو الفلترة'}
                                </div>
                                <p style={{ fontSize: 12.5, maxWidth: 440, margin: '0 auto 16px' }}>
                                    {pages.length === 0
                                        ? 'قم بزحف موقعك لقراءة المنتجات والمقالات والأسعار، أو ارفع ملف PDF في تبويب المستندات.'
                                        : 'جرّب تعديل كلمات البحث أو تصفير الفلاتر لرؤية بقية الصفحات.'}
                                </p>
                                {pages.length === 0 && crawlTarget && (
                                    <button className="btn btn-primary btn-sm" onClick={crawl} disabled={crawling}>
                                        <Globe size={14} /> زحف الموقع الآن
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : viewMode === 'cards' ? (
                        /* ─── CARDS VIEW ─── */
                        <div className="kb-card-grid">
                            {filteredPages.map((p) => {
                                const isSelected = selectedPageIds.includes(p.id)
                                const isDb = String(p.path || '').startsWith('/db/')
                                return (
                                    <div
                                        key={p.id}
                                        className={`kb-page-card ${p.excluded_from_ai ? 'is-excluded' : ''} ${isSelected ? 'is-selected' : ''}`}
                                    >
                                        <div className="kb-page-card-top">
                                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleSelectPage(p.id)}
                                                    style={{ marginTop: 3, cursor: 'pointer' }}
                                                />
                                                <div style={{ minWidth: 0, flex: 1 }}>
                                                    <div className="kb-page-title" title={p.title || p.path}>
                                                        {p.title || p.path}
                                                    </div>
                                                    <div className="kb-page-path" title={p.path}>
                                                        {p.path}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 1-Click AI Visibility Toggle */}
                                            <button
                                                type="button"
                                                className={`ai-toggle-btn ${p.excluded_from_ai ? 'is-excluded' : 'is-active'}`}
                                                onClick={() => togglePageVisibility(p.id, p.excluded_from_ai)}
                                                title={p.excluded_from_ai ? 'الضغط للتضمين في الذكاء الاصطناعي' : 'الضغط للاستبعاد من الذكاء الاصطناعي'}
                                            >
                                                {p.excluded_from_ai ? (
                                                    <>
                                                        <EyeOff size={13} />
                                                        <span>مستثنى من الذكاء</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Check size={13} />
                                                        <span>نشط في الذكاء</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Snippet Preview */}
                                        <div className="kb-page-snippet">
                                            {p.content_preview ? (
                                                p.content_preview.replace(/\s+/g, ' ').trim()
                                            ) : (
                                                <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>لا يوجد محتوى نصي مستخرج</span>
                                            )}
                                        </div>

                                        {/* Meta Row */}
                                        <div className="kb-page-meta-row">
                                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                                <span className="kb-meta-badge">
                                                    {isDb ? 'Supabase' : 'زحف ويب'}
                                                </span>
                                                <span className="kb-meta-badge purple">
                                                    <Layers size={11} />
                                                    {p.rag_chunk_count || 1} مقطع RAG
                                                </span>
                                                <span className="kb-meta-badge">
                                                    {Number(p.content_length || 0).toLocaleString('ar-SA')} حرف
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="kb-page-actions">
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => handleInspectPage(p)}
                                            >
                                                <Eye size={12} /> معاينة وتفاصيل RAG
                                            </button>

                                            {p.url && (
                                                <a
                                                    href={p.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn btn-ghost btn-xs"
                                                >
                                                    <ExternalLink size={12} /> فتح الرابط
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : viewMode === 'table' ? (
                        /* ─── MODERN TABLE VIEW ─── */
                        <div className="card">
                            <div className="tbl-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th style={{ width: 36 }}>
                                                <input
                                                    type="checkbox"
                                                    checked={
                                                        filteredPages.length > 0 &&
                                                        filteredPages.every((p) => selectedPageIds.includes(p.id))
                                                    }
                                                    onChange={(e) => {
                                                        if (e.target.checked) selectAllFiltered()
                                                        else clearSelection()
                                                    }}
                                                />
                                            </th>
                                            <th>المسار والعنوان</th>
                                            <th>معاينة المحتوى</th>
                                            <th>حالة الذكاء (RAG)</th>
                                            <th>المصدر والمقاطع</th>
                                            <th>الحجم</th>
                                            <th style={{ textAlign: 'end' }}>إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredPages.map((p) => {
                                            const isSelected = selectedPageIds.includes(p.id)
                                            const isDb = String(p.path || '').startsWith('/db/')
                                            return (
                                                <tr
                                                    key={p.id}
                                                    style={{
                                                        background: p.excluded_from_ai ? 'rgba(248,113,113,0.02)' : undefined,
                                                        opacity: p.excluded_from_ai ? 0.8 : 1,
                                                    }}
                                                >
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={() => toggleSelectPage(p.id)}
                                                        />
                                                    </td>
                                                    <td style={{ maxWidth: 220 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13, wordBreak: 'break-word' }}>
                                                            {p.title || 'بدون عنوان'}
                                                        </div>
                                                        <code style={{ fontSize: 11, direction: 'ltr', color: 'var(--text-3)' }}>
                                                            {p.path}
                                                        </code>
                                                    </td>
                                                    <td style={{ maxWidth: 280, fontSize: 12, color: 'var(--text-2)' }}>
                                                        <div
                                                            style={{
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                display: '-webkit-box',
                                                                WebkitLineClamp: 2,
                                                                WebkitBoxOrient: 'vertical',
                                                                lineHeight: 1.5,
                                                            }}
                                                            title={p.content_preview}
                                                        >
                                                            {p.content_preview || '—'}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button
                                                            type="button"
                                                            className={`ai-toggle-btn ${p.excluded_from_ai ? 'is-excluded' : 'is-active'}`}
                                                            onClick={() => togglePageVisibility(p.id, p.excluded_from_ai)}
                                                            title={p.excluded_from_ai ? 'الضغط للتضمين' : 'الضغط للاستبعاد'}
                                                        >
                                                            {p.excluded_from_ai ? (
                                                                <>
                                                                    <EyeOff size={12} />
                                                                    <span>مستثنى</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Check size={12} />
                                                                    <span>نشط ✓</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </td>
                                                    <td style={{ fontSize: 12 }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                            <span className="kb-meta-badge">{isDb ? 'Supabase' : 'زحف'}</span>
                                                            <span className="kb-meta-badge purple">{p.rag_chunk_count || 1} مقطع</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                                        {Number(p.content_length || 0).toLocaleString('ar-SA')}
                                                    </td>
                                                    <td style={{ textAlign: 'end' }}>
                                                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                            <button
                                                                type="button"
                                                                className="btn btn-ghost btn-xs"
                                                                onClick={() => handleInspectPage(p)}
                                                                title="معاينة وتفاصيل RAG"
                                                            >
                                                                <Eye size={12} />
                                                            </button>
                                                            {p.url && (
                                                                <a
                                                                    href={p.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn btn-ghost btn-xs"
                                                                    title="فتح في تبويب جديد"
                                                                >
                                                                    <ExternalLink size={12} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        /* ─── CHUNK INSPECTOR VIEW ─── */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {filteredPages.map((p) => (
                                <div key={p.id} className="kb-chunk-box">
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.title || p.path}</div>
                                            <code style={{ fontSize: 11.5, direction: 'ltr', background: 'var(--bg-3)', padding: '2px 6px', borderRadius: 4 }}>
                                                {p.path}
                                            </code>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span className="kb-meta-badge purple">
                                                <Layers size={11} /> {p.rag_chunk_count || 1} مقطع RAG
                                            </span>
                                            <button
                                                type="button"
                                                className={`ai-toggle-btn ${p.excluded_from_ai ? 'is-excluded' : 'is-active'}`}
                                                onClick={() => togglePageVisibility(p.id, p.excluded_from_ai)}
                                            >
                                                {p.excluded_from_ai ? <><EyeOff size={12} /> مستثنى</> : <><Check size={12} /> نشط في الذكاء</>}
                                            </button>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs"
                                                onClick={() => handleInspectPage(p)}
                                            >
                                                <Eye size={12} /> فحص كامل
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12.5, color: 'var(--text-3)', marginTop: 8 }}>
                                        المحتوى الأساسي: {p.content_preview ? p.content_preview.slice(0, 180) + '…' : '—'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* TAB 2: UPLOADED DOCUMENTS & PDFS */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'documents' && (
                <div className="anim-in">
                    <div className="card" style={{ marginBottom: 20 }}>
                        <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <h3 style={{ margin: 0 }}>
                                <FileUp size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                                مصادر مرفوعة — ملفات PDF ومستندات
                            </h3>
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs"
                                onClick={() => setUploadHelpOpen((o) => !o)}
                                title="كيف تعمل المستندات المرفوعة؟"
                            >
                                <CircleHelp size={15} />
                                {uploadHelpOpen ? 'إخفاء الشرح' : 'كيف تعمل؟'}
                            </button>
                        </div>
                        <div className="card-body">
                            <PlanLimitBanner usage={usage} kind="documents" />

                            {uploadHelpOpen && (
                                <div
                                    style={{
                                        marginBottom: 16,
                                        padding: '14px 16px',
                                        borderRadius: 10,
                                        background: 'var(--bg-3)',
                                        border: '1px solid var(--border-1)',
                                        fontSize: 12.5,
                                        lineHeight: 1.75,
                                    }}
                                >
                                    <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 13 }}>
                                        فائدة المستندات المرفوعة للذكاء الاصطناعي:
                                    </div>
                                    <p style={{ margin: 0, color: 'var(--text-2)' }}>
                                        تتيح لك إضافة معرفة داخلية غير منشورة على موقعك (دليل خدمات، أسعار، سياسات، FAQ).
                                        يقوم النظام بقراءة الملف وتحليله عبر الذكاء الاصطناعي وتفكيكه إلى مقاطع معرفية منظمة (Summary & Sections)،
                                        ويستعين بها المساعد عند سؤال الزائر دون الحاجة لوجود رابط URL عام.
                                    </p>
                                </div>
                            )}

                            {/* Upload Bar */}
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
                                <input
                                    className="input"
                                    value={uploadTitle}
                                    onChange={(e) => setUploadTitle(e.target.value)}
                                    placeholder="عنوان المستند — مثال: دليل الخدمات والأسعار 2026"
                                    style={{ flex: 1, minWidth: 220, maxWidth: 380 }}
                                />
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.txt,.md,.markdown,application/pdf,text/plain,text/markdown"
                                    style={{ display: 'none' }}
                                    onChange={handleUploadDocument}
                                />
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    disabled={uploading || atDocLimit}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <FileUp size={14} className={uploading ? 'spin' : ''} />
                                    {uploading ? 'جاري الاستخراج بالذكاء…' : 'رفع واستخراج المعرفة'}
                                </button>
                            </div>

                            {uploading && (
                                <div
                                    style={{
                                        padding: '12px 14px',
                                        borderRadius: 8,
                                        background: 'var(--accent-muted)',
                                        color: 'var(--accent)',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        marginBottom: 16,
                                    }}
                                >
                                    جاري استخراج النص وتحليله بالذكاء الاصطناعي وتجهيز مقاطع RAG… يرجى الانتظار.
                                </div>
                            )}

                            {/* Documents Table */}
                            {documents.length > 0 ? (
                                <div className="tbl-wrap">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>المستند</th>
                                                <th>النوع</th>
                                                <th>الحالة</th>
                                                <th>الظهور للذكاء (RAG)</th>
                                                <th>المقاطع المستخرجة</th>
                                                <th>تاريخ الرفع</th>
                                                <th style={{ textAlign: 'end' }}>إجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {documents.map((d) => {
                                                const extractOpen = extractView?.document?.id === d.id
                                                return (
                                                    <tr key={d.id}>
                                                        <td style={{ fontWeight: 700 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                <FileText size={16} style={{ color: 'var(--accent)' }} />
                                                                <span>{d.title}</span>
                                                            </div>
                                                        </td>
                                                        <td style={{ fontSize: 12, textTransform: 'uppercase' }}>
                                                            {d.source_type || 'pdf'}
                                                        </td>
                                                        <td>
                                                            <span
                                                                style={{
                                                                    fontSize: 12,
                                                                    fontWeight: 600,
                                                                    color:
                                                                        d.status === 'indexed'
                                                                            ? 'var(--green)'
                                                                            : d.status === 'failed'
                                                                            ? '#f87171'
                                                                            : 'var(--text-3)',
                                                                }}
                                                            >
                                                                {d.status === 'indexed'
                                                                    ? 'جاهز للبوت ✓'
                                                                    : d.status === 'processing'
                                                                    ? 'جاري المعالجة…'
                                                                    : d.status === 'failed'
                                                                    ? 'فشل'
                                                                    : d.status}
                                                            </span>
                                                        </td>
                                                        <td>
                                                            <button
                                                                type="button"
                                                                className={`ai-toggle-btn ${d.excluded_from_ai ? 'is-excluded' : 'is-active'}`}
                                                                onClick={() => toggleDocumentVisibility(d.id, d.excluded_from_ai)}
                                                                title={d.excluded_from_ai ? 'الضغط للتضمين في الذكاء' : 'الضغط للاستبعاد'}
                                                            >
                                                                {d.excluded_from_ai ? (
                                                                    <>
                                                                        <EyeOff size={12} />
                                                                        <span>مستثنى</span>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Check size={12} />
                                                                        <span>نشط ✓</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                        </td>
                                                        <td style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                                                            <span className="kb-meta-badge purple">{d.chunk_count || 0} مقطع</span>
                                                        </td>
                                                        <td style={{ fontSize: 12, color: 'var(--text-3)' }}>
                                                            {d.created_at ? new Date(d.created_at).toLocaleDateString('ar-SA') : '—'}
                                                        </td>
                                                        <td style={{ textAlign: 'end' }}>
                                                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                                                {d.status === 'indexed' && (
                                                                    <button
                                                                        type="button"
                                                                        className="btn btn-ghost btn-xs"
                                                                        onClick={() => toggleDocumentExtract(d.id)}
                                                                        disabled={loadingExtractId === d.id}
                                                                        title={extractOpen ? 'إخفاء المقاطع المستخرجة' : 'عرض المقاطع المستخرجة'}
                                                                    >
                                                                        <Eye size={12} />
                                                                        {extractOpen ? 'إخفاء' : 'عرض'}
                                                                    </button>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-ghost btn-xs"
                                                                    style={{ color: '#f87171' }}
                                                                    onClick={() => deleteDocument(d.id)}
                                                                    title="حذف المستند"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)', fontSize: 13 }}>
                                    لا توجد مستندات بعد. ارفع أول ملف PDF لتبدأ بتغذية المساعد بالمعلومات الحصرية.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Extracted Document Knowledge Viewer */}
                    {extractView?.chunks?.length > 0 && (
                        <div className="card anim-in" style={{ marginBottom: 20 }}>
                            <div className="card-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Sparkles size={16} style={{ color: 'var(--accent)' }} />
                                    المعرفة المستخرجة للبوت — {extractView.document?.title || 'المستند'}
                                </h3>
                                <button type="button" className="btn btn-ghost btn-xs" onClick={() => setExtractView(null)}>
                                    <X size={14} /> إغلاق
                                </button>
                            </div>
                            <div className="card-body">
                                <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 14 }}>
                                    هذه المقاطع يتم استرجاعها وتمريرها للمساعد الذكي تلقائياً عند أسئلة الزوار المرتبطة بهذا الموضوع.
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {extractView.chunks.map((chunk) => (
                                        <div
                                            key={chunk.id || `${chunk.kind}-${chunk.sort_order}`}
                                            style={{
                                                border: '1px solid var(--border-1)',
                                                borderRadius: 8,
                                                background: 'var(--bg-3)',
                                                padding: 14,
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span className={`kb-meta-badge ${chunk.kind === 'summary' ? 'purple' : ''}`}>
                                                        {chunk.kind === 'summary' ? 'ملخص شامل' : 'قسم تفصيلي'}
                                                    </span>
                                                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{chunk.title}</span>
                                                </div>
                                                <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                                                    {Number(chunk.content_length || 0).toLocaleString('ar-SA')} حرف
                                                </span>
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: 13,
                                                    lineHeight: 1.7,
                                                    color: 'var(--text-1)',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-word',
                                                }}
                                            >
                                                {chunk.content}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* TAB 3: RAG TEST SIMULATOR */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'simulator' && (
                <div className="anim-in">
                    <div className="kb-sim-panel">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Sparkles size={18} style={{ color: 'var(--accent)' }} />
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>مختبر استرجاع الذكاء (RAG Simulator)</h3>
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
                            اكتب أي سؤال متوقع من زوارك لاختبار ما سيسترجعه البوت من صفحاتك ومستنداتك، والتأكد من استبعاد الصفحات المخفية.
                        </p>

                        <form onSubmit={handleRunRagSimulation} className="kb-sim-input-row">
                            <input
                                type="text"
                                className="kb-sim-input"
                                placeholder="مثال: كم سعر الاشتراك؟ هل يوجد توصيل للرياض؟ ما هي شروط الاسترجاع؟"
                                value={simQuery}
                                onChange={(e) => setSimQuery(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="btn btn-primary"
                                disabled={simLoading || !simQuery.trim()}
                            >
                                <Search size={14} className={simLoading ? 'spin' : ''} />
                                {simLoading ? 'جاري الاسترجاع…' : 'اختبار الاسترجاع'}
                            </button>
                        </form>

                        {/* Error Message */}
                        {simError && (
                            <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: '#f87171', fontSize: 13 }}>
                                {simError}
                            </div>
                        )}

                        {/* Results */}
                        {simResult && (
                            <div className="kb-sim-results anim-in">
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-1)', paddingBottom: 10 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                                        نتائج استرجاع الـ RAG ({simResult.totalMatches} تطابق)
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--green)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <CheckCircle2 size={13} />
                                        الصفحات والمستندات المخفية تم استبعادها تلقائياً
                                    </div>
                                </div>

                                {/* Matched Pages */}
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)' }}>
                                        🌐 الصفحات المطابقة المسترجعة ({simResult.pagesMatched?.length || 0}):
                                    </div>
                                    {simResult.pagesMatched?.length === 0 ? (
                                        <div style={{ fontSize: 12.5, color: 'var(--text-3)', fontStyle: 'italic', padding: 8 }}>
                                            لم يتم العثور على صفحات ويب مطابقة لهذا السؤال.
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {simResult.pagesMatched.map((p, idx) => (
                                                <div key={idx} className="kb-sim-hit">
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>{p.title || p.path}</div>
                                                        <span className="kb-meta-badge purple">تطابق score: {p.score}</span>
                                                    </div>
                                                    <code style={{ fontSize: 11.5, direction: 'ltr', color: 'var(--text-3)', display: 'block', marginBottom: 8 }}>
                                                        {p.path}
                                                    </code>
                                                    {p.chunks?.length > 0 && (
                                                        <div style={{ fontSize: 12.5, color: 'var(--text-2)', background: 'var(--bg-2)', padding: '8px 10px', borderRadius: 6, lineHeight: 1.6 }}>
                                                            {p.chunks[0].text?.slice(0, 250)}…
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Matched Documents */}
                                {simResult.documentChunksMatched?.length > 0 && (
                                    <div style={{ marginTop: 12 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--text-2)' }}>
                                            📄 مقاطع المستندات المطابقة ({simResult.documentChunksMatched.length}):
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {simResult.documentChunksMatched.map((c, idx) => (
                                                <div key={idx} className="kb-sim-hit">
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                                        <div style={{ fontWeight: 700, fontSize: 13 }}>
                                                            {c.documentTitle} · {c.title}
                                                        </div>
                                                        <span className="kb-meta-badge purple">score: {c.score}</span>
                                                    </div>
                                                    <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.6 }}>
                                                        {c.preview}…
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* LLM Prompt Context Preview */}
                                <div style={{ marginTop: 14 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
                                            🧠 السياق الفعلي المحقون في المساعد (Prompt Context):
                                        </div>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => copyToClipboard(simResult.promptPreview)}
                                        >
                                            <Copy size={12} /> {copiedText ? 'تم النسخ' : 'نسخ السياق'}
                                        </button>
                                    </div>
                                    <div className="kb-prompt-box">
                                        {simResult.promptPreview}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* TAB 4: SETTINGS & SUPABASE */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {activeTab === 'settings' && (
                <div className="anim-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {/* Crawl Settings Card */}
                    <div className="card">
                        <div className="card-head">
                            <h3 style={{ margin: 0 }}>
                                <Globe size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                                إعدادات زحف الموقع
                            </h3>
                        </div>
                        <div className="card-body">
                            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>
                                عمق الزحف الافتراضي
                            </div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                                {CRAWL_DEPTH_OPTIONS.map((opt) => {
                                    const active = crawlDepth === opt.id
                                    return (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            className={active ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
                                            onClick={() => setCrawlDepth(opt.id)}
                                            disabled={crawling}
                                            style={{ flexDirection: 'column', alignItems: 'flex-start', height: 'auto', padding: '8px 14px' }}
                                        >
                                            <span style={{ fontWeight: 700 }}>{opt.label}</span>
                                            <span style={{ fontSize: 10, fontWeight: 400, opacity: active ? 0.9 : 0.65, marginTop: 2 }}>
                                                {opt.hint}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                            <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0, lineHeight: 1.6 }}>
                                الرابط المستهدف للزحف:{' '}
                                <code style={{ direction: 'ltr', background: 'var(--bg-3)', padding: '2px 8px', borderRadius: 4 }}>
                                    {crawlTarget || 'لم يُحدد موقع بعد'}
                                </code>
                            </p>
                        </div>
                    </div>

                    {/* Site Knowledge (SPA/React descriptions) */}
                    <div className="card">
                        <div className="card-head">
                            <h3 style={{ margin: 0 }}>
                                <FileText size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                                معلومات الموقع اليدوية (مهم لتطبيقات SPA / React)
                            </h3>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>
                                يمكنك كتابة وصف مختصر لنشاطك التجاري والمسارات الأساسية هنا ليستخدمها المساعد مباشرة.
                            </p>
                            <textarea
                                className="input"
                                rows={8}
                                value={siteKnowledge}
                                onChange={(e) => setSiteKnowledge(e.target.value)}
                                placeholder={
                                    isCarSite
                                        ? `مثال:\nاسم الموقع: ماكس موتورز\n\nالصفحات:\n- / — الرئيسية\n- /cars — السيارات\n- /banks — البنوك`
                                        : `مثال:\nاسم الموقع ووصفه.\n\nالصفحات (مسارات هذا الموقع):\n- / — الرئيسية\n- /services — الخدمات\n- /contact — اتصل بنا`
                                }
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                style={{ marginTop: 12 }}
                                onClick={saveSiteKnowledge}
                                disabled={savingInfo}
                            >
                                {savingInfo ? 'جاري الحفظ...' : 'حفظ معلومات الموقع'}
                            </button>
                        </div>
                    </div>

                    {/* Supabase Connection Settings */}
                    <div className="card">
                        <div className="card-head">
                            <h3 style={{ margin: 0 }}>
                                <Database size={15} style={{ verticalAlign: -2, marginInlineEnd: 6 }} />
                                قاعدة بيانات Supabase (اختياري)
                            </h3>
                        </div>
                        <div className="card-body">
                            <p style={{ fontSize: 12.5, color: 'var(--text-3)', marginBottom: 12, lineHeight: 1.6 }}>
                                <strong>ليس مطلوباً للمتاجر العادية.</strong> يُستخدم فقط إذا كان موقعك يعتمد على جداول مخصصة في Supabase.
                                {' '}{supabaseHelpText}
                            </p>
                            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Supabase URL</label>
                            <input
                                className="input"
                                value={supabaseUrl}
                                onChange={(e) => setSupabaseUrl(e.target.value)}
                                placeholder="https://xxxx.supabase.co"
                                style={{ direction: 'ltr', textAlign: 'left', marginBottom: 12 }}
                            />
                            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 6 }}>Supabase Anon Key</label>
                            <input
                                className="input"
                                type="password"
                                value={supabaseAnonKey}
                                onChange={(e) => setSupabaseAnonKey(e.target.value)}
                                placeholder="eyJhbGci..."
                                style={{ direction: 'ltr', textAlign: 'left' }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                style={{ marginTop: 12 }}
                                onClick={saveSiteKnowledge}
                                disabled={savingInfo}
                            >
                                {savingInfo ? 'جاري الحفظ...' : 'حفظ إعدادات Supabase'}
                            </button>

                            {supabaseConfigured && supabaseStats && (
                                <div style={{ marginTop: 14, fontSize: 12.5, color: 'var(--green)' }}>
                                    <CheckCircle2 size={13} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />
                                    {formatSupabaseStats(supabaseStats)}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═════════════════════════════════════════════════════════════════ */}
            {/* PAGE DETAILS & RAG CHUNKS INSPECTOR MODAL */}
            {/* ═════════════════════════════════════════════════════════════════ */}
            {inspectingPage && (
                <div className="kb-modal-backdrop" onClick={() => setInspectingPage(null)}>
                    <div className="kb-modal anim-in" onClick={(e) => e.stopPropagation()}>
                        <div className="kb-modal-head">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                <BookOpen size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: 800, fontSize: 14.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {inspectingPage.title || inspectingPage.path}
                                    </div>
                                    <code style={{ fontSize: 11.5, direction: 'ltr', color: 'var(--text-3)' }}>
                                        {inspectingPage.path}
                                    </code>
                                </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <button
                                    type="button"
                                    className={`ai-toggle-btn ${inspectingPage.excluded_from_ai ? 'is-excluded' : 'is-active'}`}
                                    onClick={() => togglePageVisibility(inspectingPage.id, inspectingPage.excluded_from_ai)}
                                >
                                    {inspectingPage.excluded_from_ai ? (
                                        <><EyeOff size={12} /> مستثنى من الذكاء</>
                                    ) : (
                                        <><Check size={12} /> نشط في الذكاء ✓</>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs"
                                    onClick={() => setInspectingPage(null)}
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Sub-tabs */}
                        <div style={{ display: 'flex', gap: 4, padding: '8px 20px', borderBottom: '1px solid var(--border-1)', background: 'var(--bg-3)' }}>
                            <button
                                type="button"
                                className={`kb-filter-pill ${inspectTab === 'chunks' ? 'is-active' : ''}`}
                                onClick={() => setInspectTab('chunks')}
                            >
                                <Layers size={13} />
                                مقاطع RAG ({Array.isArray(inspectingPage.rag_chunks) ? inspectingPage.rag_chunks.length : 1})
                            </button>
                            <button
                                type="button"
                                className={`kb-filter-pill ${inspectTab === 'content' ? 'is-active' : ''}`}
                                onClick={() => setInspectTab('content')}
                            >
                                <FileText size={13} />
                                النص المستخرج الكامل ({Number(inspectingPage.content_length || inspectingPage.content?.length || 0).toLocaleString('ar-SA')} حرف)
                            </button>
                            {inspectingPage.headings?.length > 0 && (
                                <button
                                    type="button"
                                    className={`kb-filter-pill ${inspectTab === 'headings' ? 'is-active' : ''}`}
                                    onClick={() => setInspectTab('headings')}
                                >
                                    العناوين والوسوم ({inspectingPage.headings.length})
                                </button>
                            )}
                        </div>

                        <div className="kb-modal-body">
                            {inspectTab === 'chunks' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {Array.isArray(inspectingPage.rag_chunks) && inspectingPage.rag_chunks.length > 0 ? (
                                        inspectingPage.rag_chunks.map((chunk, idx) => (
                                            <div key={idx} className="kb-chunk-card">
                                                <div className="kb-chunk-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span className="kb-chunk-badge">{chunk.kind || 'section'}</span>
                                                        <span style={{ fontWeight: 700, fontSize: 13 }}>{chunk.title || inspectingPage.title}</span>
                                                    </div>
                                                    <span style={{ fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--text-3)' }}>
                                                        {(chunk.text || '').length} حرف
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                                                    {chunk.text}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="kb-chunk-card">
                                            <div className="kb-chunk-header">
                                                <span className="kb-chunk-badge">page</span>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{inspectingPage.title}</span>
                                            </div>
                                            <div style={{ fontSize: 12.5, lineHeight: 1.65, color: 'var(--text-1)', whiteSpace: 'pre-wrap' }}>
                                                {inspectingPage.content || inspectingPage.content_preview}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {inspectTab === 'content' && (
                                <div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => copyToClipboard(inspectingPage.content || '')}
                                        >
                                            <Copy size={12} /> {copiedText ? 'تم النسخ' : 'نسخ النص'}
                                        </button>
                                    </div>
                                    <div
                                        style={{
                                            fontFamily: 'var(--font)',
                                            fontSize: 13,
                                            lineHeight: 1.75,
                                            background: 'var(--bg-3)',
                                            padding: 14,
                                            borderRadius: 8,
                                            whiteSpace: 'pre-wrap',
                                            wordBreak: 'break-word',
                                        }}
                                    >
                                        {inspectingPage.content || inspectingPage.content_preview || 'لا يوجد محتوى نصي.'}
                                    </div>
                                </div>
                            )}

                            {inspectTab === 'headings' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {(inspectingPage.headings || []).map((h, i) => (
                                        <div
                                            key={i}
                                            style={{
                                                padding: '8px 12px',
                                                borderRadius: 6,
                                                background: 'var(--bg-3)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                fontSize: 12.5,
                                            }}
                                        >
                                            <span style={{ fontWeight: 600 }}>{h.text}</span>
                                            {h.selector && (
                                                <code style={{ fontSize: 11, direction: 'ltr', color: 'var(--text-3)' }}>
                                                    {h.selector}
                                                </code>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
