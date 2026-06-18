'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { Clipboard } from '@capacitor/clipboard';
import { useVault } from '../utils/VaultContext';
import { encryptData, decryptData } from '../utils/crypto';
import { supabase } from '../utils/supabase';

interface CustomCategory {
  name: string;
  type: string; // 'Passwords' | 'Credit Cards' | 'IDs & Passports' | 'Default'
}

interface VaultItem {
  id: string;
  title: string;
  category: string;
  encrypted_data: string;
  decryptedText?: string; 
  isRevealed?: boolean;
}

export default function Dashboard() {
  const {
    user,
    encryptionKey,
    signOut,
    isBiometricEnrolled,
    unenrollBiometrics,
    biometricSupported
  } = useVault();
  
  // State for managing items
  const [items, setItems] = useState<VaultItem[]>([]);
  const [title, setTitle] = useState('');
  
  // Passwords Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [website, setWebsite] = useState('');
  
  // Credit Cards Form States
  const [cardName, setCardName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardDetails, setCardDetails] = useState(''); 
  
  // Passports & IDs Form States
  const [idName, setIdName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [idIssuingCountry, setIdIssuingCountry] = useState('');
  const [idDob, setIdDob] = useState('');
  const [idIssueDate, setIdIssueDate] = useState('');
  const [idExpiry, setIdExpiry] = useState('');
  
  const [secretText, setSecretText] = useState(''); 
  
  // Category management state
  const [activeCategory, setActiveCategory] = useState('Passwords');
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryType, setNewCategoryType] = useState('Default');
  
  const [loading, setLoading] = useState(false);

  // Secure Clipboard Ref to track clear timeouts across multiple copy events
  const clipboardTimerRef = useRef<NodeJS.Timeout | null>(null);

  const defaultCategories = ['Passwords', 'Credit Cards', 'IDs & Passports'];

  const getActiveLayoutType = () => {
    if (defaultCategories.includes(activeCategory)) {
      return activeCategory;
    }
    const customMatch = customCategories.find(c => c.name === activeCategory);
    return customMatch ? customMatch.type : 'Default';
  };

  const activeLayoutType = getActiveLayoutType();

  // Secure Clipboard Action
  const handleSecureCopy = async (textToCopy: string) => {
    try {
      await Clipboard.write({ string: textToCopy });
      console.log("Copied securely! Wiping from system clipboard in 30 seconds...");

      if (clipboardTimerRef.current) {
        clearTimeout(clipboardTimerRef.current);
      }

      clipboardTimerRef.current = setTimeout(async () => {
        const currentContent = await Clipboard.read();
        if (currentContent.value === textToCopy) {
          await Clipboard.write({ string: "" });
          console.log("System clipboard cleared for security.");
        }
      }, 30000); // 30 seconds expiration frame

    } catch (err) {
      console.error("Secure copy process faulted:", err);
    }
  };

  useEffect(() => {
    setTitle('');
    setUsername('');
    setPassword('');
    setWebsite('');
    setCardName('');
    setCardNumber('');
    setCardDetails('');
    setIdName('');
    setIdNumber('');
    setIdIssuingCountry('');
    setIdDob('');
    setIdIssueDate('');
    setIdExpiry('');
    setSecretText('');
  }, [activeCategory]);

  useEffect(() => {
    if (user) {
      fetchVaultItems();
    }
  }, [user]);

  // Clean clipboard threads if the workspace unmounts
  useEffect(() => {
    return () => {
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
    };
  }, []);

  const fetchVaultItems = async () => {
    const { data, error } = await supabase
      .from('vault_items')
      .select('*')
      .eq('user_id', user?.id);

    if (error) {
      console.error('Error fetching vault data:', error.message);
    } else if (data) {
      setItems(data.map((item: any) => ({ 
        ...item, 
        id: item.id || item.item_id || Math.random().toString(),
        isRevealed: false 
      })));
      
      const uniqueMap = new Map<string, string>();
      data.forEach((item: any) => {
        const catName = item.category || item.item_type;
        if (catName && !defaultCategories.includes(catName)) {
          const forms = ['Passwords', 'Credit Cards', 'IDs & Passports'];
          const matchedType = forms.includes(item.item_type) ? item.item_type : 'Default';
          uniqueMap.set(catName, matchedType);
        }
      });

      const loadedCustoms = Array.from(uniqueMap.entries()).map(([name, type]) => ({
        name,
        type
      }));
      
      setCustomCategories(loadedCustoms);
    }
  };

  const handleSaveItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!encryptionKey || !title) return;
    setLoading(true);

    try {
      // Feature 4: Create a structured object payload instead of a flat string text block
      let payloadObject: Record<string, string> = {};

      if (activeLayoutType === 'Passwords') {
        payloadObject = {
          "Username / Identity": username,
          "Key Phrase / Password": password,
          "Target Address / URL": website
        };
      } else if (activeLayoutType === 'Credit Cards') {
        payloadObject = {
          "Holder Signature": cardName,
          "Account Number": cardNumber,
          "Verification & Expiry": cardDetails
        };
      } else if (activeLayoutType === 'IDs & Passports') {
        payloadObject = {
          "Legal Full Identity": idName,
          "Document Index (Number)": idNumber,
          "Issuer Code (Country)": idIssuingCountry,
          "Origin Date (DOB)": idDob,
          "Issue Frame": idIssueDate,
          "Expiry Frame": idExpiry
        };
      } else {
        // Fallback for generic text fields
        payloadObject = { "Raw Notes": secretText };
      }

      // Serialize the object structure into a single JSON string before encrypting
      const payloadString = JSON.stringify(payloadObject);
      const cipherText = await encryptData(payloadString, encryptionKey);

      const { error } = await supabase.from('vault_items').insert({
        user_id: user?.id,
        title: title,
        category: activeCategory,
        item_type: activeLayoutType, 
        encrypted_data: cipherText,
      });

      if (error) throw error;

      setTitle('');
      setUsername('');
      setPassword('');
      setWebsite('');
      setCardName('');
      setCardNumber('');
      setCardDetails('');
      setIdName('');
      setIdNumber('');
      setIdIssuingCountry('');
      setIdDob('');
      setIdIssueDate('');
      setIdExpiry('');
      setSecretText('');
      
      setTimeout(() => {
        fetchVaultItems();
      }, 400);

    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReveal = async (item: VaultItem) => {
    if (!encryptionKey) return;

    if (item.isRevealed) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isRevealed: false } : i));
      return;
    }

    try {
      const plainText = await decryptData(item.encrypted_data, encryptionKey);
      setItems(prev => prev.map(i => 
        i.id === item.id ? { ...i, decryptedText: plainText, isRevealed: true } : i
      ));
    } catch (err) {
      console.error('Decryption failed:', err);
    }
  };

  const handleCreateCategory = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    const existingNames = [...defaultCategories, ...customCategories.map(c => c.name)];
    
    if (cleanName && !existingNames.includes(cleanName)) {
      setCustomCategories([...customCategories, { name: cleanName, type: newCategoryType }]);
      setActiveCategory(cleanName);
      setNewCategoryName('');
      setNewCategoryType('Default');
    }
  };

  const filteredItems = items.filter(item => item.category === activeCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#800c14] via-[#4a0409] to-[#0c0d14] text-slate-100 flex flex-col md:flex-row selection:bg-white selection:text-red-950 font-sans">
      
      {/* Sidebar Panel */}
      <aside className="w-full md:w-64 bg-black/40 backdrop-blur-md p-6 border-b md:border-b-0 md:border-r border-white/10 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-red-950 shadow-lg shadow-black/40 font-bold text-lg">
              🕷️
            </div>
            <h2 className="text-xl uppercase font-black tracking-widest text-white">
              SPIDER-VAULT
            </h2>
          </div>
          
          <nav className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest font-extrabold text-red-300/60 mb-2 px-2">Network Terminals</p>
            {defaultCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  activeCategory === cat 
                    ? 'bg-white text-red-950 font-black shadow-xl shadow-red-950/40' 
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}

            {customCategories.map(cat => (
              <button
                key={cat.name}
                onClick={() => setActiveCategory(cat.name)}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                  activeCategory === cat.name 
                    ? 'bg-white text-red-950 font-black shadow-xl shadow-red-950/40' 
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                📁 {cat.name}
              </button>
            ))}
          </nav>

          <form onSubmit={handleCreateCategory} className="mt-8 pt-6 border-t border-white/10 space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-extrabold text-red-300/60 px-2">Weave New Node</p>
            <input
              type="text"
              required
              placeholder="FOLDER IDENTITY..."
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded bg-black/40 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-white uppercase tracking-wider font-semibold transition-all"
            />
            <div className="flex gap-2">
              <select
                value={newCategoryType}
                onChange={(e) => setNewCategoryType(e.target.value)}
                className="w-full px-2 py-2 text-xs rounded bg-black/40 border border-white/10 text-slate-300 focus:outline-none focus:border-white cursor-pointer font-bold tracking-wide transition-all"
              >
                <option value="Default" className="bg-[#1c0406] text-slate-300">PLAIN TEXT FALLBACK</option>
                <option value="Passwords" className="bg-[#1c0406] text-slate-300">PASSWORD TEMPLATE</option>
                <option value="Credit Cards" className="bg-[#1c0406] text-slate-300">CREDIT CARD TEMPLATE</option>
                <option value="IDs & Passports" className="bg-[#1c0406] text-slate-300">ID / PASSPORT TEMPLATE</option>
              </select>
              <button type="submit" className="px-3 bg-white/10 hover:bg-white hover:text-red-950 rounded text-sm font-black transition-all border border-white/10">+</button>
            </div>
          </form>
        </div>

        <div className="mt-8 pt-4 border-t border-white/10 text-center space-y-2">
          {biometricSupported && isBiometricEnrolled && (
            <button
              onClick={unenrollBiometrics}
              className="w-full py-2 bg-black/20 hover:bg-black/40 text-red-300/40 hover:text-red-300 text-[9px] font-bold uppercase tracking-widest border border-white/5 rounded-lg transition-all"
            >
              Disable Biometrics
            </button>
          )}
          <p className="text-[10px] text-red-300/50 truncate mb-1 font-mono tracking-wider">{user?.email}</p>
          <button onClick={signOut} className="w-full py-2 bg-black/30 hover:bg-red-600/30 text-red-200/60 hover:text-white border border-white/5 hover:border-red-500/30 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all">
            Secure Lockout
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="flex-1 p-8 lg:p-12 max-w-5xl mx-auto w-full">
        <header className="mb-8">
          <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tighter text-white drop-shadow-md">
            {activeCategory}
          </h1>
          <p className="text-xs uppercase tracking-widest text-red-300/70 font-bold mt-1.5">
            Zero-knowledge network cell mapping.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          
          {/* Dynamic Smart Form Component */}
          <section className="bg-black/30 backdrop-blur-md border border-white/10 rounded-xl p-6 lg:col-span-1 shadow-2xl shadow-black/30">
            <h3 className="text-xs font-black uppercase tracking-widest text-red-300 mb-4">Encrypt Node Data</h3>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Item Label / Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. WORK LOGINS, MAIN CARD"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                />
              </div>

              {activeLayoutType === 'Passwords' && (
                <>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Username / Identity</label>
                    <input
                      type="text"
                      required
                      placeholder="identity@domain.com"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Key Phrase / Password</label>
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Target Address / URL</label>
                    <input
                      type="text"
                      placeholder="https://terminal-link.com"
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                </>
              )}

              {activeLayoutType === 'Credit Cards' && (
                <>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Holder Signature</label>
                    <input
                      type="text"
                      required
                      placeholder="HOLDER NAME"
                      value={cardName}
                      onChange={(e) => setCardName(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Account Number</label>
                    <input
                      type="text"
                      required
                      placeholder="0000 0000 0000 0000"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Verification & Expiry</label>
                    <input
                      type="text"
                      required
                      placeholder="MM/YY - CVC"
                      value={cardDetails}
                      onChange={(e) => setCardDetails(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                </>
              )}

              {activeLayoutType === 'IDs & Passports' && (
                <>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Legal Full Identity</label>
                    <input
                      type="text"
                      required
                      placeholder="LEGAL NAME"
                      value={idName}
                      onChange={(e) => setIdName(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Document Index</label>
                      <input
                        type="text"
                        required
                        placeholder="NUMBER"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Issuer Code</label>
                      <input
                        type="text"
                        required
                        placeholder="COUNTRY"
                        value={idIssuingCountry}
                        onChange={(e) => setIdIssuingCountry(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Origin Date (DOB)</label>
                    <input
                      type="text"
                      placeholder="MM/DD/YYYY"
                      value={idDob}
                      onChange={(e) => setIdDob(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Issue Frame</label>
                      <input
                        type="text"
                        placeholder="MM/DD/YYYY"
                        value={idIssueDate}
                        onChange={(e) => setIdIssueDate(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Expiry Frame</label>
                      <input
                        type="text"
                        placeholder="MM/DD/YYYY"
                        value={idExpiry}
                        onChange={(e) => setIdExpiry(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-semibold tracking-wide transition-all placeholder-slate-600"
                      />
                    </div>
                  </div>
                </>
              )}

              {activeLayoutType === 'Default' && (
                <div>
                  <label className="block text-[10px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">Raw Cipher Notes</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Enter unique text strings..."
                    value={secretText}
                    onChange={(e) => setSecretText(e.target.value)}
                    className="w-full px-3 py-2 rounded bg-black/50 border border-white/10 text-white focus:outline-none focus:border-white text-xs font-mono transition-all placeholder-slate-600"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-white hover:bg-neutral-200 text-red-950 text-xs font-black uppercase tracking-wider rounded shadow-xl transition-all disabled:opacity-50"
              >
                {loading ? 'WEAVING SIGNAL...' : `COMMIT TO ${activeCategory}`}
              </button>
            </form>
          </section>

          {/* List Display Feed */}
          <section className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-red-300/80 mb-4">Secured Relays ({filteredItems.length})</h3>
            
            {filteredItems.length === 0 ? (
              <div className="text-center py-12 bg-black/20 border border-dashed border-white/10 rounded-xl text-slate-400 text-xs uppercase tracking-wider font-bold">
                No active signals compiled in "{activeCategory}" yet.
              </div>
            ) : (
              filteredItems.map(item => {
                // Feature 4: Structural parsing verification checker
                let parsedFields: Record<string, string> | null = null;
                if (item.isRevealed && item.decryptedText) {
                  try {
                    parsedFields = JSON.parse(item.decryptedText);
                  } catch (e) {
                    // Fallback configuration if it's old legacy data stored as raw text strings
                    parsedFields = { "Data Entry": item.decryptedText };
                  }
                }

                return (
                  <div key={item.id} className="bg-black/30 backdrop-blur-md border border-white/10 p-5 rounded-xl shadow-xl flex flex-col gap-4 transition-all hover:border-white/20">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-white tracking-wide uppercase text-sm">{item.title}</h4>
                        <p className="text-[10px] text-red-300/50 uppercase tracking-widest font-mono mt-0.5">{item.category} Module</p>
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => handleToggleReveal(item)}
                          className={`px-4 py-2 rounded text-xs font-black uppercase tracking-wider transition-all duration-200 border ${
                            item.isRevealed
                              ? 'bg-white/10 border-white/10 hover:bg-white/20 text-white'
                              : 'bg-white border-white hover:bg-neutral-200 text-red-950 shadow-lg shadow-black/30'
                          }`}
                        >
                          {item.isRevealed ? 'MUTE' : 'DECRYPT'}
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Structural Grid Display rendering */}
                    <div className="font-mono text-xs bg-black/50 p-4 rounded border border-white/5 space-y-3 text-slate-300 shadow-inner">
                      {!item.isRevealed ? (
                        <span className="text-slate-500 truncate block tracking-widest opacity-60 break-all">{item.encrypted_data}</span>
                      ) : (
                        parsedFields && Object.entries(parsedFields).map(([label, value]) => (
                          <div key={label} className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2 last:border-b-0 last:pb-0 gap-2">
                            <div>
                              <span className="text-[10px] block uppercase font-bold text-slate-500 tracking-wider">{label}</span>
                              <span className="text-cyan-400 font-bold tracking-wide break-all">{value}</span>
                            </div>
                            {value && (
                              <button
                                onClick={() => handleSecureCopy(value)}
                                className="self-end sm:self-center px-2 py-1 bg-cyan-500/10 hover:bg-cyan-500/30 border border-cyan-500/20 text-cyan-400 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                              >
                                📋 COPY FIELD
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </section>

        </div>
      </main>
    </div>
  );
}