
import { createClient } from '@supabase/supabase-js';

/**
 * إعدادات الاتصال بقاعدة البيانات (Supabase)
 * -------------------------------------------
 * للربط مع مشروعك الخاص:
 * 1. أنشئ مشروعاً جديداً على https://supabase.com
 * 2. اذهب إلى Project Settings -> API
 * 3. انسخ Project URL وضعه بدلاً من الرابط أدناه.
 * 4. انسخ Project API Key (anon/public) وضعه بدلاً من المفتاح أدناه.
 */

// رابط المشروع (Project URL)
const supabaseUrl = (process.env.REACT_APP_SUPABASE_URL || 'https://ptebacfihfivyqhrlwdt.supabase.co').trim();

// مفتاح الاتصال (API Key - Anon/Public)
const supabaseKey = (process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0ZWJhY2ZpaGZpdnlxaHJsd2R0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyMDQyODgsImV4cCI6MjA3OTc4MDI4OH0.uWrA6RX2y4XMe8M_uOCYmebcdUlNFczvSwEYvzbxRAA').trim();

// إنشاء وتصدير عميل Supabase ليتم استخدامه في باقي صفحات التطبيق
export const supabase = createClient(supabaseUrl, supabaseKey);
