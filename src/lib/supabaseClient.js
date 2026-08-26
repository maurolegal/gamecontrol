import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://stjbtxrrdofuxhigxfcy.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0amJ0eHJyZG9mdXhoaWd4ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTgwNzUsImV4cCI6MjA3NzM5NDA3NX0.vhz6v2pRepUH7g-ucSJKtWonmAeWYqwhrTxG_ypVElo';

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn('⚠️ VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no definidas. Usando valores por defecto (solo desarrollo).');
}

// Singleton que sobrevive HMR — evita "LockAcquireTimeoutError" cuando
// Vite hot-reload crea una nueva instancia mientras la anterior aún
// mantiene el lock del Navigator LockManager para el auth token.
const GLOBAL_KEY = '__supabase_client_gamecontrol__';

async function authLock(name, _acquireTimeout, fn) {
  if (!globalThis.navigator?.locks?.request) {
    return fn();
  }

  return globalThis.navigator.locks.request(name, { mode: 'exclusive' }, fn);
}

function getSupabaseClient() {
  if (globalThis[GLOBAL_KEY]) {
    return globalThis[GLOBAL_KEY];
  }
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      lock: authLock,
    },
    global: {
      headers: { 'X-Client-Info': 'GameControl-v2.0' },
    },
  });
  globalThis[GLOBAL_KEY] = client;
  return client;
}

export const supabase = getSupabaseClient();
