'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Cpu, Mail, Lock, Zap, Info, Terminal, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e?: React.FormEvent, customEmail?: string, customPassword?: string) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);

    const loginEmail = customEmail || email;
    const loginPassword = customPassword || password;

    if (!loginEmail || !loginPassword) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('http://localhost:3000/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error?.message || 'Login failed');
      }

      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      if (data.organizations && data.organizations.length > 0) {
        localStorage.setItem('activeOrgId', data.organizations[0].id);
      }

      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAutofill = () => {
    setEmail('admin@scheduler.io');
    setPassword('admin');
    setError('');
  };

  const handleQuickLogin = () => {
    handleLogin(undefined, 'admin@scheduler.io', 'admin');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#0A0A0F] p-4 font-sans text-slate-100 overflow-hidden">
      {/* Decorative Glow Blobs */}
      <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-[#F59E0B]/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="w-full max-w-md rounded-2xl border border-white/[0.04] bg-[#12121A]/90 p-8 shadow-2xl backdrop-blur-xl relative z-10 space-y-6">
        
        {/* Header/Brand Logo */}
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-[#F59E0B] to-amber-500 flex items-center justify-center shadow-lg shadow-[#F59E0B]/20 mb-4 animate-pulse">
            <Cpu className="h-6 w-6 text-black" />
          </div>
          <h2 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-slate-400">
            Job Scheduler
          </h2>
          <p className="mt-2 text-xs font-mono text-slate-500 uppercase tracking-widest">
            Distributed Job Cluster Manager
          </p>
        </div>

        {/* Quick Admin Access Card */}
        <div className="rounded-xl border border-amber-500/[0.08] bg-amber-500/[0.02] p-4 space-y-3 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[#F59E0B]/[0.01] rounded-full blur-lg pointer-events-none"></div>
          <div className="flex items-center gap-2 text-xs font-semibold text-[#F59E0B]">
            <Zap className="h-3.5 w-3.5 animate-bounce" />
            <span className="font-mono uppercase tracking-wider">Quick Demo Credentials</span>
          </div>
          
          <div className="rounded bg-black/40 border border-white/[0.02] p-2.5 font-mono text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Email:</span>
              <span className="text-slate-200">admin@scheduler.io</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Password:</span>
              <span className="text-slate-200">admin</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleAutofill}
              className="rounded bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.04] py-1.5 text-center text-xs font-semibold text-slate-300 transition active:scale-[0.98]"
            >
              Autofill Form
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleQuickLogin}
              className="rounded bg-gradient-to-r from-[#F59E0B] to-amber-500 hover:brightness-110 py-1.5 text-center text-xs font-semibold text-black transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              ⚡ Quick Login
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-3.5 text-xs text-red-400 flex items-start gap-2 animate-shake">
            <Info className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={(e) => handleLogin(e)} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">Email Address</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition duration-200"
                placeholder="email@example.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 font-mono">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-white/[0.06] bg-[#0A0A0F] py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-600 outline-none focus:border-[#F59E0B] focus:ring-1 focus:ring-[#F59E0B] transition duration-200"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-500/10 hover:brightness-110 active:scale-[0.98] transition duration-200 disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? 'Validating cluster identity...' : 'Sign In to Cluster'}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-white/[0.04]">
          Deploying a new node?{' '}
          <Link href="/signup" className="font-semibold text-blue-400 hover:text-blue-300 transition">
            Register here
          </Link>
        </div>
      </div>
    </div>
  );
}
