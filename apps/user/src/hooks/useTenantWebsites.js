import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

export function useTenantWebsites(user) {
  const [websites, setWebsites] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    return api
      .getWebsites()
      .then(setWebsites)
      .catch(() => setWebsites([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [user?.websiteId, refresh]);

  const active =
    websites.find((w) => w.id === user?.websiteId) || websites[0] || null;

  return {
    websites,
    active,
    loading,
    refresh,
    hasMultiple: websites.length > 1,
  };
}
