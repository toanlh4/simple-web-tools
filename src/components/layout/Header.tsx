import { ChevronRight, Moon, Sun, Wrench } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useThemeStore } from '../../store/useThemeStore';
import { tools } from '../../tools/registry';

export function Header() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const { pathname } = useLocation();
  const current = tools.find((t) => t.path === pathname);

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 dark:border-gray-800 dark:bg-gray-950">
      <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900 hover:text-blue-600 dark:text-gray-100 dark:hover:text-blue-400">
        <Wrench className="h-4 w-4 text-blue-600" />
        Simple Web Tools
      </Link>
      {current && (
        <>
          <ChevronRight className="h-4 w-4 text-gray-400" />
          <span className="truncate text-sm text-gray-700 dark:text-gray-300">{current.name}</span>
        </>
      )}
      <div className="ml-auto" />
      <button type="button" title={`Theme: ${theme}`} onClick={toggleTheme} className="toolbar-btn">
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>
    </header>
  );
}
