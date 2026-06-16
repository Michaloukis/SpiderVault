'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';
import { NativeBiometric, AccessControl } from '@capgo/capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';

// Define what kind of information our global state will hold
interface VaultContextType {
  user: User | null;
  encryptionKey: CryptoKey | null;
  setEncryptionKey: (key: CryptoKey | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  biometricSupported: boolean;
  isBiometricEnrolled: boolean;
  biometryType: string;
  enrollBiometrics: (password: string, email: string) => Promise<void>;
  unenrollBiometrics: () => Promise<void>;
  checkBiometricEnrollment: () => Promise<void>;
  getStoredCredentials: () => Promise<{ email: string, password: string } | null>;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [encryptionKey, setEncryptionKey] = useState<CryptoKey | null>(null);
  const [loading, setLoading] = useState(true);

  const [biometricSupported, setBiometricSupported] = useState(false);
  const [isBiometricEnrolled, setIsBiometricEnrolled] = useState(false);
  const [biometryType, setBiometryType] = useState('');

  useEffect(() => {
    const init = async () => {
      // 1. Check if a user session is already active in the browser when opening the page
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      // Check biometric support
      if (Capacitor.isNativePlatform()) {
        try {
          const result = await NativeBiometric.isAvailable();
          setBiometricSupported(result.isAvailable);
          if (result.biometryType !== undefined) {
            const types = ['NONE', 'TOUCH ID', 'FACE ID', 'FINGERPRINT', 'IRIS', 'MULTIPLE'];
            setBiometryType(types[result.biometryType] || 'BIOMETRICS');
          }
          await checkBiometricEnrollment();
        } catch (e) {
          console.error("Biometric check failed", e);
        }
      }

      setLoading(false);
    };

    init();

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

  const checkBiometricEnrollment = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      // We check if we have credentials for our specific 'server' identifier
      const credentials = await NativeBiometric.getCredentials({
        server: "spidervault.app"
      });
      setIsBiometricEnrolled(!!credentials.username);
    } catch (e) {
      setIsBiometricEnrolled(false);
    }
  };

  const enrollBiometrics = async (password: string, email: string) => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeBiometric.setCredentials({
        username: email,
        password: password,
        server: "spidervault.app",
        accessControl: AccessControl.BIOMETRY_ANY
      });
      setIsBiometricEnrolled(true);
    } catch (e) {
      console.error("Failed to enroll biometrics", e);
      throw e;
    }
  };

  const unenrollBiometrics = async () => {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await NativeBiometric.deleteCredentials({
        server: "spidervault.app"
      });
      setIsBiometricEnrolled(false);
    } catch (e) {
      console.error("Failed to unenroll biometrics", e);
    }
  };

  const getStoredCredentials = async () => {
    if (!Capacitor.isNativePlatform()) return null;
    try {
      const credentials = await NativeBiometric.getSecureCredentials({
        server: "spidervault.app",
        reason: "Access your SpiderVault",
        title: "Biometric Login"
      });
      return { email: credentials.username, password: credentials.password };
    } catch (e) {
      console.error("Biometric retrieval failed", e);
      return null;
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setEncryptionKey(null); // Clear Key B on manual sign out
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
      biometryType,
      enrollBiometrics,
      unenrollBiometrics,
      checkBiometricEnrollment,
      getStoredCredentials
    }}>
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