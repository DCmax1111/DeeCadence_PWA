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
    if (theme === 'dark') root.classList.add('theme-dark');
    else root.classList.remove('theme-dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <div className={clsx('app-root', theme === 'dark' ? 'dark' : 'light')}>
      <Component {...pageProps} theme={theme} setTheme={setTheme} />
    </div>
  );
}

export default MyApp;
