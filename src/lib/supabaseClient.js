import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://stjbtxrrdofuxhigxfcy.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0amJ0eHJyZG9mdXhoaWd4ZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MTgwNzUsImV4cCI6MjA3NzM5NDA3NX0.vhz6v2pRepUH7g-ucSJKtWonmAeWYqwhrTxG_ypVElo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'GameControl-v2.0' },
  },
});
