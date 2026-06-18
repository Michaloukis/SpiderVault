'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from './supabase';
import { NativeBiometric } from '@capgo/capacitor-native-biometric';

interface VaultContextType {
  user: any;
  encryptionKey: string | null;
  setEncryptionKey: (key: string | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  biometricSupported: boolean;
  isBiometricEnrolled: boolean;
  enrollBiometrics: (masterKey: string) => Promise<boolean>;
  unenrollBiometrics: () => Promise<void>;
  authenticateWithBiometrics: () => Promise<boolean>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [encryptionKey, setEncryptionKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setEncryptionKey(null);
      }
    });

    checkBiometricAvailability();

    return () => subscription.unsubscribe();
  }, []);

  const checkBiometricAvailability = async () => {
    try {
      // Capgo syntax check for hardware presence
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable) {
        setBiometricSupported(true);
        const enrolled = localStorage.getItem('vault_biometrics_enrolled') === 'true';
        setIsBiometricEnrolled(enrolled);
      }
    } catch (err) {
      console.warn('Biometrics hardware check failed or unsupported:', err);
    }
  };

  const enrollBiometrics = async (masterKey: string): Promise<boolean> => {
    try {
      // Trigger a quick test authentication step before confirming setup
      const auth = await NativeBiometric.verifyIdentity({
        reason: 'Confirm identity to authorize biometric vault entry shortcut.',
        title: 'Enroll Biometrics',
        subtitle: 'Spider-Vault Secure Access Key',
        description: 'Scan biometric signature.',
      });

      // Capgo returns an empty promise resolution or checks validation on success
      localStorage.setItem('vault_biometrics_enrolled', 'true');
      localStorage.setItem('vault_secured_hardware_token', btoa(masterKey)); 
      
      setIsBiometricEnrolled(true);
      return true;
    } catch (err) {
      console.error('Biometric enrollment verification dropped:', err);
      return false;
    }
  };

  const unenrollBiometrics = async () => {
    localStorage.removeItem('vault_biometrics_enrolled');
    localStorage.removeItem('vault_secured_hardware_token');
    setIsBiometricEnrolled(false);
  };

  const authenticateWithBiometrics = async (): Promise<boolean> => {
    try {
      // Capgo syntax to prompt native operational window
      await NativeBiometric.verifyIdentity({
        reason: 'Scan fingerprint or face identity to map decrypted credentials.',
        title: 'Biometric Unlock Pass',
        subtitle: 'Decrypt Vault Layer',
        description: 'Verify identity to continue.',
      });

      const storedToken = localStorage.getItem('vault_secured_hardware_token');
      if (storedToken) {
        const recoveredKey = atob(storedToken);
        setEncryptionKey(recoveredKey);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Biometric validation rejected:', err);
      return false;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setEncryptionKey(null);
  };

  return (
    <VaultContext.Provider value={{
      user,
      encryptionKey,
      setEncryptionKey,
      loading,
      signOut,
      biometricSupported,
      isBiometricEnrolled,
      enrollBiometrics,
      unenrollBiometrics,
      authenticateWithBiometrics
    }}>
      {children}
    </VaultContext.Provider>
  );
}

export function useVault() {
  const context = useContext(VaultContext);
  if (context === undefined) {
    throw new Error('useVault must be used within a VaultProvider');
  }
  return context;
}