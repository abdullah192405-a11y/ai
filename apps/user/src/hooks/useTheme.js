import { useCallback, useSyncExternalStore } from 'react';
import { getStoredTheme, setStoredTheme, THEMES } from '../lib/theme';

function subscribe(onStoreChange) {
  window.addEventListener('wba-theme-updated', onStoreChange);
  return () => window.removeEventListener('wba-theme-updated', onStoreChange);
}

function getSnapshot() {
  return getStoredTheme();
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => THEMES.light);

  const setTheme = useCallback((next) => {
    setStoredTheme(next);
    window.dispatchEvent(new Event('wba-theme-updated'));
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === THEMES.light ? THEMES.dark : THEMES.light);
  }, [setTheme, theme]);

  return { theme, setTheme, toggleTheme, isLight: theme === THEMES.light };
}
