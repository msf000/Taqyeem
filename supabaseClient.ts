import { createClient } from '@supabase/supabase-js';

// استبدل القيم التالية بالقيم الخاصة بمشروعك من إعدادات Supabase
const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || 'https://ptebacfihfivyqhrlwdt.supabase.co').trim();
const supabaseKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZWJhY2ZpaGZpdnlxaHJsd2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMDQyODgsImV4cCI6MjA3OTc4MDI4OH0.uWrA6RX2y4XMe8M_uOCYmebcdUlNFczvSwEYvzbxRAA').trim();

export const supabase = createClient(supabaseUrl, supabaseKey);