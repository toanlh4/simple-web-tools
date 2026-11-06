import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'simple-web-tools-theme';

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Storage may be unavailable; fall back to the OS preference.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

interface ThemeState {
  theme: Theme;
  toggleTheme: () => void;
}

const theme = initialTheme();
applyTheme(theme);

export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme,
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Persisting is a convenience only.
    }
    applyTheme(next);
    set({ theme: next });
  },
}));
