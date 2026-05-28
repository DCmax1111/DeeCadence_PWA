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
      </Head>
      <Header user={user} setTheme={setTheme} theme={theme} />
      <main className="container">
        <h1 className="page-title">Ledger</h1>
        <Ledger user={user} />
      </main>
    </>
  );
}
