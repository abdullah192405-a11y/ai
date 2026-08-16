const STORAGE_KEY = 'wba-user-theme';

export const THEMES = {
  dark: 'dark',
  light: 'light',
};

export function getStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === THEMES.dark ? THEMES.dark : THEMES.light;
  } catch {
    return THEMES.light;
  }
}

export function applyTheme(theme) {
  const resolved = theme === THEMES.light ? THEMES.light : THEMES.dark;
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

export function setStoredTheme(theme) {
  const resolved = applyTheme(theme);
  try {
    localStorage.setItem(STORAGE_KEY, resolved);
  } catch {
    /* ignore quota / private mode */
  }
  return resolved;
}
