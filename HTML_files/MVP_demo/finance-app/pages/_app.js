import '../styles/globals.css';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

function MyApp({ Component, pageProps }) {
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored) setTheme(stored);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');

    function applyTheme(value) {
      root.classList.remove('theme-dark', 'theme-light');
      if (value === 'dark') root.classList.add('theme-dark');
      else if (value === 'light') root.classList.add('theme-light');
      else if (mq.matches) root.classList.add('theme-dark');
      else root.classList.add('theme-light');
    }

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const handleChange = () => applyTheme('system');
      mq.addEventListener('change', handleChange);
      return () => mq.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return (
    <div className="app-root">
      <Component {...pageProps} theme={theme} setTheme={setTheme} />
    </div>
  );
}

export default MyApp;
