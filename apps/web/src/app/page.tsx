'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black text-slate-400 font-sans">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-500 mx-auto"></div>
        <p className="mt-4 text-sm font-semibold tracking-wider uppercase text-slate-500">Initializing Scheduler Control Panel...</p>
      </div>
    </div>
  );
}
