'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

// Define what kind of information our global state will hold
interface VaultContextType {
  user: User | null;
  encryptionKey: CryptoKey | null;
  setEncryptionKey: (key: CryptoKey | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Check if a user session is already active in the browser when opening the page
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // 2. Listen continuously for login or logout changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        setEncryptionKey(null); // Instantly purge Key B if the user logs out
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setEncryptionKey(null); // Clear Key B on manual sign out
  };

  return (
    <VaultContext.Provider value={{ user, encryptionKey, setEncryptionKey, loading, signOut }}>
      {children}
    </VaultContext.Provider>
  );
}

// Custom shortcut hook so our future components can quickly grab data out of this cloud state
export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}