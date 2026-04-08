import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://lnzvzrefuemczjlflxnw.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxuenZ6cmVmdWVtY3pqbGZseG53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODkzNjAsImV4cCI6MjA5MTI2NTM2MH0._t_jqdedgtmyonwNz_66PzwYacpj81_zpiMgUKsE2ng'
)
