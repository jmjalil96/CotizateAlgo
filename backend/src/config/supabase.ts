import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { loggerService } from '../services/logger.service';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Environment validation with console (to avoid circular dependencies)
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  loggerService.error(
    'FATAL: Missing required Supabase environment variables',
    {
      missing: {
        supabaseUrl: !supabaseUrl,
        supabaseAnonKey: !supabaseAnonKey,
        supabaseServiceKey: !supabaseServiceKey,
      },
    }
  );
  process.exit(1);
}

// Basic environment check for development
if (process.env.NODE_ENV !== 'production') {
  loggerService.info('Supabase environment validation passed');
}

// Client for user operations (auth, user-scoped queries)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for server-side operations (bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
