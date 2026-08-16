import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import { PLATFORM_STORAGE_KEY, isSetupComplete } from '../lib/setupSteps';
import { isWebsiteOwned } from '../lib/websiteOwnership';

export function useSetupProgress(user) {
  const [progress, setProgress] = useState({
    loading: true,
    hasDomain: false,
    hasVerifiedDomain: false,
    hasKnowledge: false,
    hasApiKey: false,
    hasPlatform: false,
    hasWidgetEnabled: false,
    complete: false,
    websiteCount: 0,
    documentCount: 0,
    pageCount: 0,
    activeWebsite: null,
    activeKey: null,
    selectedPlatform: null,
  });

  const refresh = useCallback(async () => {
    setProgress((prev) => ({ ...prev, loading: true }));
    try {
      const [websites, keys, knowledge, overview] = await Promise.all([
        api.getWebsites().catch(() => []),
        api.getKeys().catch(() => []),
        api.getKnowledgePages().catch(() => ({ pages: [], count: 0 })),
        api.getOverview().catch(() => null),
      ]);

      const docsRes = await api.getKnowledgeDocuments().catch(() => ({ documents: [] }));
      const activeWebsite = websites.find((w) => w.id === user?.websiteId) || websites[0] || null;
      const activeKeys = keys.filter((k) => !k.revoked);
      const siteKey = activeKeys.find((k) => k.website_id === activeWebsite?.id) || activeKeys[0] || null;
      const pageCount = knowledge.count || knowledge.pages?.length || 0;
      const documentCount = docsRes.documents?.length || 0;
      const selectedPlatform = localStorage.getItem(PLATFORM_STORAGE_KEY);

      const hasDomain = websites.length > 0;
      const next = {
        loading: false,
        hasDomain,
        hasVerifiedDomain: hasDomain && isWebsiteOwned(activeWebsite),
        hasKnowledge: pageCount > 0 || documentCount > 0,
        hasApiKey: Boolean(siteKey),
        hasPlatform: Boolean(selectedPlatform),
        hasWidgetEnabled: Boolean(activeWebsite?.widgetEnabled),
        websiteCount: websites.length,
        documentCount,
        pageCount,
        activeWebsite,
        activeKey: siteKey,
        selectedPlatform,
        complete: false,
      };
      next.complete = isSetupComplete(next);
      setProgress(next);
      return next;
    } catch {
      setProgress((prev) => ({ ...prev, loading: false }));
      return null;
    }
  }, [user?.websiteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ...progress, refresh, overviewReady: !progress.loading };
}
