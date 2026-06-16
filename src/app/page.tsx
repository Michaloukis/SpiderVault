'use client';

import { useState } from 'react';
import { deriveKeys } from '../utils/crypto';
import { supabase } from '../utils/supabase';
import { useVault } from '../utils/VaultContext';
import Dashboard from '../components/Dashboard';

export default function Home() {
  const { user, encryptionKey, setEncryptionKey, loading: contextLoading } = useVault();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      const { authHash, encryptionKey: generatedKeyB } = await deriveKeys(password, email);
      
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password: authHash,
        });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Account created! You can now toggle to log in.' });
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase(),
          password: authHash,
        });

        if (error) throw error;
        setEncryptionKey(generatedKeyB);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  if (contextLoading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#800c14] via-[#4a0409] to-[#0c0d14] text-slate-100 flex items-center justify-center font-sans">
        <p className="text-white text-xs font-black uppercase tracking-widest animate-pulse">Checking security perimeter...</p>
      </main>
    );
  }

  // If authenticated, swap the view to our dashboard automatically
  if (user && encryptionKey) {
    return <Dashboard />;
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#800c14] via-[#4a0409] to-[#0c0d14] text-slate-100 flex flex-col items-center justify-center p-6 selection:bg-white selection:text-red-950 font-sans">
      
      {/* Dynamic Glassmorphism Card */}
      <div className="w-full max-w-md bg-black/30 backdrop-blur-md rounded-2xl shadow-2xl shadow-black/50 p-8 border border-white/10">
        
        {/* Header section matching the new theme logo structure */}
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-white text-center">
            SPIDER-VAULT
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-red-300/70 font-extrabold mt-1 text-center">
            Sensitive information mananger
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
              Identity Address (Email)
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all uppercase"
              placeholder="YOU@EXAMPLE.COM"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">
              Master Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all"
              placeholder="••••••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 bg-white hover:bg-neutral-200 text-red-950 text-xs font-black uppercase tracking-widest rounded-xl shadow-xl shadow-black/30 transition-all transform active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'PROCESSING MATH...' : isSignUp ? 'CREATE SECURE ACCOUNT' : 'ACCESS VAULT'}
          </button>
        </form>

        {message && (
          <div className={`mt-4 p-3 rounded-lg text-xs font-semibold tracking-wide uppercase border text-center ${
            message.type === 'success' 
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-400' 
              : 'bg-rose-950/50 border-rose-500/30 text-rose-400'
          }`}>
            {message.type === 'success' ? '✅ ' : '⚠️ '}
            {message.text}
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-white/10 text-center">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setMessage(null);
            }}
            className="text-[10px] uppercase tracking-widest font-extrabold text-red-300/70 hover:text-white transition-colors focus:outline-none"
          >
            {isSignUp ? 'Already have a vault? Access it here' : 'New to SpiderVault? Create an account'}
          </button>
        </div>
      </div>
    </main>
  );
}