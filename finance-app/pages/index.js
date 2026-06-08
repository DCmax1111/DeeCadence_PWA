import Head from 'next/head';
import { useEffect, useState } from 'react';
import Header from '../components/Header';
import Ledger from '../components/Ledger';
import { supabase } from '../lib/supabaseClient';

export default function Home({ theme, setTheme }) {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
    });
    // initial
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      setUser(data?.session?.user ?? null);
    };
    init();
    return () => listener?.subscription?.unsubscribe();
  }, []);

  return (
    <>
      <Head>
        <title>DeeCash — Ledger</title>
        <meta name="description" content="Finance bookkeeping app" />
        <meta property="og:title" content="DeeCash — Ledger" />
        <meta property="og:description" content="Track every transaction, keep your books aligned, and stay ahead of cashflow with a modern finance workspace." />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="DeeCash — Ledger" />
        <meta name="twitter:description" content="Track every transaction, keep your books aligned, and stay ahead of cashflow with a modern finance workspace." />
      </Head>
      <Header user={user} setTheme={setTheme} theme={theme} />
      <main className="container">
        <div className="page-card">
          <div className="page-hero">
            <div>
              <h1 className="page-title">Ledger</h1>
              <p className="page-copy">
                Track every transaction, keep your books aligned, and stay ahead of cashflow with a modern finance workspace.
              </p>
            </div>
          </div>
          <Ledger user={user} />
        </div>
      </main>
    </>
  );
}
