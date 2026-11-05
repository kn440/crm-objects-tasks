import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Новое имя ключа в Supabase — publishable, старое — anon. Подходит любое.
const anonKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY) as
  | string
  | undefined;

export const supabaseConfigured = Boolean(url && anonKey);

// Во фронтенде только публичный ключ (publishable / anon).
// Права проверяет база по RLS, поэтому этот ключ сам по себе ничего не открывает.
export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing-key');
