'use client';

import { useState } from 'react';
import { deriveKeys } from '../utils/crypto';
import { supabase } from '../utils/supabase';
import { useVault } from '../utils/VaultContext';
import Dashboard from '../components/Dashboard';

export default function Home() {
  const {
    user,
    encryptionKey,
    setEncryptionKey,
    loading: contextLoading,
    isBiometricEnrolled,
    biometricSupported,
    getStoredCredentials,
    enrollBiometrics,
    biometryType
  } = useVault();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showBiometricEnroll, setShowBiometricEnroll] = useState(false);
  const [tempCredentials, setTempCredentials] = useState<{e: string, p: string} | null>(null);

  const handleLoginLogic = async (emailInput: string, passwordInput: string) => {
    const { authHash, encryptionKey: generatedKeyB } = await deriveKeys(passwordInput, emailInput);

    const { error } = await supabase.auth.signInWithPassword({
      email: emailInput.toLowerCase(),
      password: authHash,
    });

    if (error) throw error;

    setEncryptionKey(generatedKeyB);

    // If biometric is supported but not enrolled, ask user
    if (biometricSupported && !isBiometricEnrolled) {
      setTempCredentials({ e: emailInput, p: passwordInput });
      setShowBiometricEnroll(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { authHash } = await deriveKeys(password, email);
        const { error } = await supabase.auth.signUp({
          email: email.toLowerCase(),
          password: authHash,
        });

        if (error) throw error;
        setMessage({ type: 'success', text: 'Account created! You can now toggle to log in.' });
      } else {
        await handleLoginLogic(email, password);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const creds = await getStoredCredentials();
      if (creds) {
        await handleLoginLogic(creds.email, creds.password);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: 'Biometric authentication failed.' });
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollConfirm = async () => {
    if (tempCredentials) {
      try {
        await enrollBiometrics(tempCredentials.p, tempCredentials.e);
        setShowBiometricEnroll(false);
        setTempCredentials(null);
      } catch (e) {
        console.error(e);
      }
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
  if (user && encryptionKey && !showBiometricEnroll) {
    return <Dashboard />;
  }

  if (showBiometricEnroll) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[#800c14] via-[#4a0409] to-[#0c0d14] text-slate-100 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-black/30 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-red-950 mx-auto mb-6 text-2xl shadow-xl">
            🧬
          </div>
          <h2 className="text-xl font-black uppercase tracking-widest mb-2">Enable Biometrics?</h2>
          <p className="text-[10px] text-red-200/60 font-black uppercase tracking-widest mb-8 leading-relaxed">
            SECURE YOUR PERIMETER WITH {biometryType || 'BIOMETRIC'} ACCESS
          </p>
          <div className="space-y-3">
            <button
              onClick={handleEnrollConfirm}
              className="w-full py-3 bg-white text-red-950 text-xs font-black uppercase tracking-widest rounded-xl transition-all hover:bg-neutral-200"
            >
              YES, AUTHORIZE {biometryType || 'BIOMETRICS'}
            </button>
          </div>
        </div>
      </main>
    );
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

          {!isSignUp && isBiometricEnrolled && (
            <button
              type="button"
              onClick={handleBiometricLogin}
              disabled={loading}
              className="w-full mt-3 py-3 bg-black/40 hover:bg-black/60 text-white text-xs font-black uppercase tracking-widest rounded-xl border border-white/10 shadow-xl transition-all transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <span className="text-lg">🧬</span>
              USE {biometryType || 'BIOMETRICS'}
            </button>
          )}
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