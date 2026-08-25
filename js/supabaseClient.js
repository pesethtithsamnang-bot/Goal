// Central Supabase client. Change these two values if you ever move projects.
const SUPABASE_URL = 'https://xliuuthzdnxyxguggmec.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhsaXV1dGh6ZG54eXhndWdnbWVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc2MTQxNjYsImV4cCI6MjEwMzE5MDE2Nn0.7uELBFKKN2o3Ho3JarDnyDeRVg6HJBmheEReSmtFxTI';

export const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
