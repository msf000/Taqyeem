
import React, { useState, useEffect, useRef } from 'react';
import { Database, Copy, AlertTriangle, Check, Layers, Users, CreditCard, Shield, Plus, Trash2, RefreshCw, Search, Loader2, Calendar, DollarSign, X, Edit2, Download, UploadCloud, FileJson, Lock } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserRole, SystemUser, Subscription, School } from '../types';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'database'>('users');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data State
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  // User Forms State
  const [newUser, setNewUser] = useState<Partial<SystemUser>>({ role: UserRole.TEACHER });
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Subscription Forms State
  const [isAddingSub, setIsAddingSub] = useState(false);
  const [editingSubId, setEditingSubId] = useState<string | null>(null);
  const [newSub, setNewSub] = useState<{
      school_id: string;
      plan_name: string;
      start_date: string;
      end_date: string;
      price: number;
  }>({
      school_id: '',
      plan_name: 'Basic',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
      price: 0
  });

  // Helper for error messages
  const getErrorMessage = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error?.message) return error.message;
    if (error?.error_description) return error.error_description;
    if (error?.details) return error.details;
    try {
        return JSON.stringify(error);
    } catch {
        return 'خطأ غير معروف';
    }
  };

  // SQL Script - Updated to use ARRAY for roles to allow single record with multiple roles
  const fullSchemaScript = `
-- ==========================================
-- 1. تحديث هيكلية تعدد الصلاحيات (سجل واحد، أدوار متعددة)
-- ==========================================

-- إضافة عمود المصفوفة للأدوار في جدول المعلمين إذا لم يكن موجوداً
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';

-- نقل البيانات القديمة (role وحيد) إلى المصفوفة الجديدة
UPDATE teachers 
SET roles = array_append(roles, role) 
WHERE role IS NOT NULL AND (roles IS NULL OR roles = '{}' OR NOT (roles @> ARRAY[role]));

-- إعادة قيد التفرد: رقم الهوية يجب أن يكون فريداً لكل مدرسة (سجل واحد فقط لكل معلم في المدرسة)
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_national_id_key;
DROP INDEX IF EXISTS idx_teachers_national_id_school_id_role; 
DROP INDEX IF EXISTS idx_teachers_national_id_school_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_national_id_school_id 
ON teachers (national_id, school_id);

-- للمستخدمين (المدراء): إبقاء الوضع كما هو (بريد فريد للمدرسة)
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_school_id 
ON app_users (email, school_id);

-- ==========================================
-- 2. تخصيص الأحداث لكل مدرسة
-- ==========================================

-- إضافة عمود المدرسة لجدول الأحداث
ALTER TABLE school_events ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- ==========================================
-- 3. إصلاح مشاكل الحذف (Constraints Fixes)
-- ==========================================

-- إصلاح علاقة التقييمات بالمعلمين (حذف التقييم عند حذف المعلم)
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_teacher_id_fkey;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_teacher_id_fkey 
    FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE;

-- إصلاح علاقة التقييمات بالمدرسة
ALTER TABLE evaluations DROP CONSTRAINT IF EXISTS evaluations_school_id_fkey;
ALTER TABLE evaluations ADD CONSTRAINT evaluations_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

-- إصلاح علاقة المعلمين بالمدرسة
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_school_id_fkey;
ALTER TABLE teachers ADD CONSTRAINT teachers_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

-- إصلاح علاقة المستخدمين بالمدرسة
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_school_id_fkey;
ALTER TABLE app_users ADD CONSTRAINT app_users_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE SET NULL;

-- إصلاح علاقة الاشتراكات بالمدرسة
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_school_id_fkey;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_school_id_fkey 
    FOREIGN KEY (school_id) REFERENCES schools(id) ON DELETE CASCADE;

-- ==========================================
-- 4. التأكد من هيكلية الجداول
-- ==========================================

create table if not exists schools (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  stage text,
  type text,
  ministry_id text,
  manager_name text,
  evaluator_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists teachers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  national_id text, 
  specialty text,
  category text, 
  role text default 'المعلم',
  roles text[] default '{}', -- New Array Column
  mobile text,
  password text,
  school_id uuid references schools(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists app_users (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  full_name text not null,
  password text,
  role text not null,
  school_id uuid references schools(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists subscriptions (
  id uuid default gen_random_uuid() primary key,
  school_id uuid references schools(id) on delete cascade,
  plan_name text default 'Basic',
  start_date date,
  end_date date,
  status text default 'active',
  price numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists evaluation_indicators (
  id uuid default gen_random_uuid() primary key,
  text text not null,
  weight numeric default 0,
  description text,
  sort_order integer default 0,
  rubric jsonb default '{}'::jsonb,
  applicable_categories text[],
  category_weights jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists evaluation_criteria (
  id uuid default gen_random_uuid() primary key,
  indicator_id uuid references evaluation_indicators(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists verification_indicators (
  id uuid default gen_random_uuid() primary key,
  indicator_id uuid references evaluation_indicators(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists evaluations (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references teachers(id) on delete cascade,
  school_id uuid references schools(id) on delete set null,
  period_name text,
  eval_date date,
  scores jsonb default '{}'::jsonb,
  total_score numeric default 0,
  general_notes text,
  status text default 'draft',
  objection_text text,
  objection_status text default 'none',
  teacher_evidence_links jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- جدول الشواهد المستقل (بنك الشواهد)
create table if not exists teacher_evidence (
  id uuid default gen_random_uuid() primary key,
  teacher_id uuid references teachers(id) on delete cascade,
  indicator_id uuid references evaluation_indicators(id) on delete cascade,
  url text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists specialties (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists school_events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text default 'evaluation', 
  start_date date not null,
  end_date date not null,
  status text default 'upcoming',
  description text,
  school_id uuid references schools(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- اضافة الاعمدة الناقصة ان وجدت
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS school_id uuid references schools(id) on delete set null;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS objection_text text;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS objection_status text default 'none';
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS teacher_evidence_links jsonb default '[]'::jsonb;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password text;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS role text default 'المعلم';
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS roles text[] default '{}';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS password text;

-- ==========================================
-- 5. تحديث سياسات الأمان (RLS)
-- ==========================================

-- Schools
alter table schools enable row level security;
drop policy if exists "Public Access" on schools;
create policy "Public Access" on schools for all using (true);

-- App Users
alter table app_users enable row level security;
drop policy if exists "Public Access" on app_users;
create policy "Public Access" on app_users for all using (true);

-- Subscriptions
alter table subscriptions enable row level security;
drop policy if exists "Public Access" on subscriptions;
create policy "Public Access" on subscriptions for all using (true);

-- Specialties
alter table specialties enable row level security;
drop policy if exists "Public Access" on specialties;
create policy "Public Access" on specialties for all using (true);

-- School Events
alter table school_events enable row level security;
drop policy if exists "Public Access" on school_events;
create policy "Public Access" on school_events for all using (true);

-- Evaluations
alter table evaluations enable row level security;
drop policy if exists "Public Access" on evaluations;
create policy "Public Access" on evaluations for all using (true);

-- Teacher Evidence
alter table teacher_evidence enable row level security;
drop policy if exists "Public Access" on teacher_evidence;
create policy "Public Access" on teacher_evidence for all using (true);

NOTIFY pgrst, 'reload schema';
`;

  useEffect(() => {
    fetchSchools(); // Always fetch schools as they are needed for dropdowns in both tabs
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'subscriptions') fetchSubscriptions();
  }, [activeTab]);

  const fetchSchools = async () => {
      const { data } = await supabase.from('schools').select('id, name');
      const mappedSchools: School[] = (data || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          stage: '',
          type: '',
          ministryId: '',
          managerName: '',
          evaluatorName: ''
      }));
      setSchools(mappedSchools);
  };

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('app_users').select('*, schools(name)');
      if (error && error.code !== '42P01') throw error;
      setSystemUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscriptions = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from('subscriptions').select('*, schools(name)');
      if (error && error.code !== '42P01') throw error;
      
      const formatted: Subscription[] = (data || []).map((sub: any) => ({
          ...sub,
          school_name: sub.schools?.name
      }));
      setSubscriptions(formatted);
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Backup & Restore Handlers ---
  const handleExportBackup = async () => {
      setIsBackingUp(true);
      try {
          const tables = [
              'schools',
              'specialties',
              'evaluation_indicators',
              'evaluation_criteria',
              'verification_indicators',
              'school_events',
              'teachers',
              'app_users',
              'evaluations',
              'teacher_evidence', // Include new table
              'subscriptions'
          ];
          
          const backupData: any = {
              timestamp: new Date().toISOString(),
              version: '1.0',
              data: {}
          };

          for (const table of tables) {
              const { data, error } = await supabase.from(table).select('*');
              if (error) {
                  // Ignore missing tables, log warning
                  console.warn(`Could not backup table ${table}:`, error.message);
                  continue;
              }
              backupData.data[table] = data || [];
          }

          // Trigger Download
          const jsonString = JSON.stringify(backupData, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          
          const link = document.createElement('a');
          link.href = url;
          link.download = `nizam_taqyeem_backup_${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          alert('تم تصدير النسخة الاحتياطية بنجاح.');
      } catch (error) {
          console.error(error);
          alert('حدث خطأ أثناء النسخ الاحتياطي: ' + getErrorMessage(error));
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!window.confirm('تنبيه: استعادة البيانات ستقوم بتحديث البيانات الموجودة أو إضافة بيانات جديدة. هل أنت متأكد من المتابعة؟')) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }

      setIsRestoring(true);
      const reader = new FileReader();
      
      reader.onload = async (event) => {
          try {
              const jsonContent = event.target?.result as string;
              const backup = JSON.parse(jsonContent);

              if (!backup.data || typeof backup.data !== 'object') {
                  throw new Error('ملف النسخ الاحتياطي غير صالح');
              }

              // Order is crucial for Foreign Keys
              // Parents first, then children
              const tablesOrder = [
                  'schools',
                  'specialties',
                  'evaluation_indicators', // Parents of criteria
                  'evaluation_criteria',
                  'verification_indicators',
                  'school_events',
                  'teachers', // Depends on schools
                  'app_users', // Depends on schools
                  'evaluations', // Depends on teachers & schools
                  'teacher_evidence', // Depends on teachers & indicators
                  'subscriptions' // Depends on schools
              ];

              for (const table of tablesOrder) {
                  const rows = backup.data[table];
                  if (rows && Array.isArray(rows) && rows.length > 0) {
                      const { error } = await supabase.from(table).upsert(rows);
                      if (error) {
                          console.error(`Error restoring ${table}:`, error);
                          throw new Error(`فشل استعادة جدول ${table}: ${error.message}`);
                      }
                  }
              }

              alert('تم استعادة البيانات بنجاح!');
              // Refresh current view
              fetchSchools();
              if (activeTab === 'users') fetchUsers();
              if (activeTab === 'subscriptions') fetchSubscriptions();

          } catch (error) {
              console.error(error);
              alert('فشل استعادة البيانات: ' + getErrorMessage(error));
          } finally {
              setIsRestoring(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };

      reader.readAsText(file);
  };

  // --- User Handlers ---
  const handleEditUser = (user: SystemUser) => {
      setNewUser({
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          password: user.password,
          school_id: user.school_id
      });
      setEditingUserId(user.id);
      setIsAddingUser(true);
  };

  const handleSaveUser = async () => {
    if (!newUser.email || !newUser.full_name) return alert('الرجاء تعبئة البيانات الأساسية');
    
    // Validate school selection for roles that require it
    if ((newUser.role === UserRole.PRINCIPAL || newUser.role === UserRole.TEACHER || newUser.role === UserRole.EVALUATOR) && !newUser.school_id) {
        return alert('يجب تحديد المدرسة لهذه الصلاحية');
    }

    try {
        if (editingUserId) {
            // Update
            const { error } = await supabase.from('app_users').update(newUser).eq('id', editingUserId);
            if (error) throw error;
        } else {
            // Insert
            const { error } = await supabase.from('app_users').insert([newUser]);
            if (error) throw error;
        }
        
        await fetchUsers();
        setIsAddingUser(false);
        setEditingUserId(null);
        setNewUser({ role: UserRole.TEACHER });
    } catch (error: any) {
        if (error?.code === '23505') {
            alert('هذا المستخدم مسجل بالفعل. لا يمكن تكرار البريد الإلكتروني في نفس المدرسة.');
        } else {
            alert('حدث خطأ: ' + getErrorMessage(error));
        }
    }
  };

  const handleDeleteUser = async (id: string): Promise<boolean> => {
    if(!window.confirm('هل أنت متأكد تماماً من حذف هذا المستخدم؟ لا يمكن التراجع عن هذا الإجراء.')) return false;
    
    try {
        const { error } = await supabase.from('app_users').delete().eq('id', id);
        
        if(error) {
            throw error;
        }
        
        setSystemUsers(prev => prev.filter(u => u.id !== id));
        alert('تم حذف المستخدم بنجاح.');
        return true;
        
    } catch (error: any) {
        console.error(error);
        alert('فشل عملية الحذف: ' + getErrorMessage(error));
        return false;
    }
  };

  // --- Subscription Handlers ---
  const handleEditSubscription = (sub: Subscription) => {
    setNewSub({
        school_id: sub.school_id,
        plan_name: sub.plan_name,
        start_date: sub.start_date,
        end_date: sub.end_date,
        price: sub.price
    });
    setEditingSubId(sub.id);
    setIsAddingSub(true);
  };

  const handleSaveSubscription = async () => {
      if (!newSub.school_id) return alert('يرجى اختيار المدرسة');
      
      try {
          const payload = {
            school_id: newSub.school_id,
            plan_name: newSub.plan_name,
            start_date: newSub.start_date,
            end_date: newSub.end_date,
            price: newSub.price,
            status: 'active'
          };

          if (editingSubId) {
             const { error } = await supabase.from('subscriptions').update(payload).eq('id', editingSubId);
             if (error) throw error;
          } else {
             const { error } = await supabase.from('subscriptions').insert([payload]);
             if (error) throw error;
          }
          
          await fetchSubscriptions();
          setIsAddingSub(false);
          setEditingSubId(null);
          setNewSub({
            school_id: '',
            plan_name: 'Basic',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
            price: 0
          });
      } catch (error: any) {
          alert('حدث خطأ: ' + getErrorMessage(error));
      }
  };

  const handleDeleteSubscription = async (id: string): Promise<boolean> => {
      if(!window.confirm('هل أنت متأكد من إلغاء وحذف هذا الاشتراك؟')) return false;
      try {
          const { error } = await supabase.from('subscriptions').delete().eq('id', id);
          if(error) throw error;
          
          setSubscriptions(prev => prev.filter(s => s.id !== id));
          alert('تم حذف الاشتراك بنجاح.');
          return true;
      } catch(error) {
          console.error(error);
          alert('فشل عملية الحذف: ' + getErrorMessage(error));
          return false;
      }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullSchemaScript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           <Layers className="text-primary-600" />
           إعدادات النظام
        </h2>

        {/* Tabs */}
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button 
                onClick={() => setActiveTab('users')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Users size={16} /> المستخدمين والصلاحيات
            </button>
            <button 
                onClick={() => setActiveTab('subscriptions')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'subscriptions' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <CreditCard size={16} /> الاشتراكات
            </button>
            <button 
                onClick={() => setActiveTab('database')}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'database' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
            >
                <Database size={16} /> قاعدة البيانات
            </button>
        </div>

        {/* --- USERS TAB --- */}
        {activeTab === 'users' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-700">قائمة مستخدمي النظام</h3>
                    <button 
                        onClick={() => {
                            setEditingUserId(null);
                            setNewUser({ role: UserRole.TEACHER });
                            setIsAddingUser(!isAddingUser);
                        }} 
                        className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-primary-700"
                    >
                        {isAddingUser ? <X size={16} /> : <Plus size={16} />}
                        {isAddingUser ? 'إلغاء' : 'إضافة مستخدم'}
                    </button>
                </div>

                {isAddingUser && (
                    <div className="bg-white p-6 rounded-xl border border-primary-100 shadow-sm animate-fade-in">
                        <h4 className="font-bold mb-4 text-sm text-primary-800">
                            {editingUserId ? 'تعديل بيانات المستخدم' : 'بيانات المستخدم الجديد'}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">الاسم الكامل</label>
                                <input 
                                    type="text" className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 outline-none"
                                    value={newUser.full_name || ''} onChange={e => setNewUser({...newUser, full_name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">البريد الإلكتروني</label>
                                <input 
                                    type="email" className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 outline-none"
                                    value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">كلمة المرور (الرقم السري)</label>
                                <input 
                                    type="text" className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 outline-none"
                                    placeholder="اتركه فارغاً للإبقاء على القديمة"
                                    value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">الصلاحية</label>
                                <select 
                                    className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 outline-none bg-white"
                                    value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}
                                >
                                    {Object.values(UserRole).map(role => (
                                        <option key={role} value={role}>{role}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-500 mb-1">المدرسة</label>
                                <select 
                                    className={`w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-200 outline-none bg-white ${
                                        (newUser.role !== UserRole.ADMIN && !newUser.school_id) ? 'border-red-300 ring-2 ring-red-100' : ''
                                    }`}
                                    value={newUser.school_id || ''} onChange={e => setNewUser({...newUser, school_id: e.target.value})}
                                    disabled={newUser.role === UserRole.ADMIN}
                                >
                                    <option value="">{newUser.role === UserRole.ADMIN ? 'غير مطلوب للمدير' : 'اختر المدرسة (مطلوب)'}</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
                            <div className="w-full sm:w-auto">
                                {editingUserId && (
                                    <button 
                                        onClick={async () => {
                                            const success = await handleDeleteUser(editingUserId);
                                            if(success) {
                                                setIsAddingUser(false);
                                                setEditingUserId(null);
                                                setNewUser({ role: UserRole.TEACHER });
                                            }
                                        }}
                                        className="w-full sm:w-auto text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 text-sm flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={16} /> حذف
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto justify-end">
                                <button onClick={() => setIsAddingUser(false)} className="text-gray-500 text-sm px-4 py-2 hover:bg-gray-50 rounded-lg">إلغاء</button>
                                <button onClick={handleSaveUser} className="bg-primary-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-primary-700 shadow-sm">
                                    {editingUserId ? 'تحديث البيانات' : 'حفظ المستخدم'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {isLoading ? (
                         <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
                    ) : systemUsers.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">
                             <Shield size={48} className="mx-auto text-gray-300 mb-3" />
                             <p>لا يوجد مستخدمين مسجلين.</p>
                        </div>
                    ) : (
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="px-6 py-3">الاسم</th>
                                    <th className="px-6 py-3">البريد الإلكتروني</th>
                                    <th className="px-6 py-3">الرقم السري</th>
                                    <th className="px-6 py-3">الدور</th>
                                    <th className="px-6 py-3">المدرسة</th>
                                    <th className="px-6 py-3">تاريخ الإضافة</th>
                                    <th className="px-6 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {systemUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-800">{user.full_name}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm">{user.email}</td>
                                        <td className="px-6 py-4 text-gray-500 text-sm font-mono">{user.password || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs border ${
                                                user.role === UserRole.ADMIN ? 'bg-purple-50 text-purple-700 border-purple-100' : 
                                                user.role === UserRole.PRINCIPAL ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}>
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{(user as any).schools?.name || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-400">{new Date(user.created_at || '').toLocaleDateString('ar-SA')}</td>
                                        <td className="px-6 py-4 text-left flex gap-1 justify-end">
                                            <button onClick={() => handleEditUser(user)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        )}

        {/* --- SUBSCRIPTIONS TAB --- */}
        {activeTab === 'subscriptions' && (
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* ... stats ... */}
                </div>

                {/* Subscriptions List */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-lg text-gray-700">إدارة الاشتراكات</h3>
                        <button 
                            onClick={() => {
                                setEditingSubId(null);
                                setIsAddingSub(!isAddingSub);
                            }}
                            className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-primary-700 shadow-sm"
                        >
                             {isAddingSub ? <X size={16} /> : <Plus size={16} />}
                             {isAddingSub ? 'إلغاء' : 'اشتراك جديد'}
                        </button>
                    </div>

                    {isAddingSub && (
                        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm animate-fade-in ring-1 ring-blue-50">
                            {/* ... form ... */}
                            <h4 className="font-bold mb-4 text-sm text-blue-800 flex items-center gap-2">
                                <CreditCard size={16} /> {editingSubId ? 'تعديل الاشتراك' : 'إضافة اشتراك جديد'}
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">المدرسة</label>
                                    <select 
                                        className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                                        value={newSub.school_id} onChange={e => setNewSub({...newSub, school_id: e.target.value})}
                                    >
                                        <option value="">اختر المدرسة</option>
                                        {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                {/* ... other fields ... */}
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">نوع الباقة</label>
                                    <select 
                                        className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none bg-white"
                                        value={newSub.plan_name} onChange={e => setNewSub({...newSub, plan_name: e.target.value})}
                                    >
                                        <option value="Basic">الأساسية (Basic)</option>
                                        <option value="Premium">المتقدمة (Premium)</option>
                                        <option value="Enterprise">المؤسسات (Enterprise)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">السعر (ريال)</label>
                                    <input 
                                        type="number" className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                                        value={newSub.price} onChange={e => setNewSub({...newSub, price: parseFloat(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">تاريخ البدء</label>
                                    <input 
                                        type="date" className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                                        value={newSub.start_date} onChange={e => setNewSub({...newSub, start_date: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">تاريخ الانتهاء</label>
                                    <input 
                                        type="date" className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 outline-none"
                                        value={newSub.end_date} onChange={e => setNewSub({...newSub, end_date: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 border-t pt-4 border-gray-100">
                                <div className="w-full sm:w-auto">
                                    {editingSubId && (
                                        <button 
                                            onClick={async () => {
                                                const success = await handleDeleteSubscription(editingSubId);
                                                if (success) {
                                                    setIsAddingSub(false);
                                                    setEditingSubId(null);
                                                    setNewSub({
                                                        school_id: '',
                                                        plan_name: 'Basic',
                                                        start_date: new Date().toISOString().split('T')[0],
                                                        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                                                        price: 0
                                                    });
                                                }
                                            }}
                                            className="w-full sm:w-auto text-red-600 bg-red-50 px-4 py-2 rounded-lg hover:bg-red-100 text-sm flex items-center justify-center gap-2"
                                        >
                                            <Trash2 size={16} /> حذف الاشتراك
                                        </button>
                                    )}
                                </div>
                                <div className="flex gap-2 w-full sm:w-auto justify-end">
                                    <button onClick={() => setIsAddingSub(false)} className="text-gray-500 text-sm px-4 py-2 hover:bg-gray-50 rounded-lg">إلغاء</button>
                                    <button onClick={handleSaveSubscription} className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm">
                                        {editingSubId ? 'تحديث الاشتراك' : 'تفعيل الاشتراك'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <span className="text-xs text-gray-500 font-medium">قائمة الاشتراكات الحالية</span>
                            <button onClick={fetchSubscriptions} className="text-primary-600 text-xs flex items-center gap-1 hover:underline">
                                <RefreshCw size={12} /> تحديث
                            </button>
                        </div>
                        {isLoading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-primary-600" /></div>
                        ) : subscriptions.length === 0 ? (
                            <div className="p-12 text-center text-gray-500">
                                <CreditCard size={48} className="mx-auto text-gray-300 mb-3" />
                                <p>لا توجد اشتراكات مسجلة حالياً.</p>
                            </div>
                        ) : (
                            <table className="w-full text-right">
                                <thead className="bg-gray-50 text-gray-600 text-sm">
                                    <tr>
                                        <th className="px-6 py-3">المدرسة</th>
                                        <th className="px-6 py-3">الخطة</th>
                                        <th className="px-6 py-3">الفترة</th>
                                        <th className="px-6 py-3">السعر</th>
                                        <th className="px-6 py-3">الحالة</th>
                                        <th className="px-6 py-3"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {subscriptions.map(sub => (
                                        <tr key={sub.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-800">{sub.school_name || 'غير محدد'}</td>
                                            <td className="px-6 py-4">
                                                <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs border border-blue-100 font-medium">{sub.plan_name}</span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-500">
                                                <div className="flex items-center gap-1 text-xs">
                                                    <Calendar size={12}/>
                                                    <span>{sub.start_date}</span>
                                                    <span className="mx-1">→</span>
                                                    <span>{sub.end_date}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-gray-700 text-sm">{sub.price} ريال</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${sub.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {sub.status === 'active' ? 'نشط' : 'منتهي'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-left flex gap-1 justify-end">
                                                <button onClick={() => handleEditSubscription(sub)} className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="تعديل">
                                                    <Edit2 size={16} />
                                                </button>
                                                <button onClick={() => handleDeleteSubscription(sub.id)} className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="إلغاء الاشتراك">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        )}

        {/* --- DATABASE TAB --- */}
        {activeTab === 'database' && (
            <div className="space-y-6">
                {/* ... Backup UI ... */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 bg-blue-50 rounded-lg text-blue-600">
                            <FileJson size={24} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-800 mb-1">النسخ الاحتياطي واستعادة البيانات</h2>
                            <p className="text-gray-500 text-sm">يمكنك تصدير قاعدة البيانات كملف JSON وحفظه في جهازك، أو استعادة البيانات من ملف سابق.</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Backup Card */}
                        <div className="border border-gray-200 rounded-xl p-5 hover:border-blue-200 transition-colors bg-gray-50">
                             <div className="flex items-center gap-2 mb-3 font-bold text-gray-700">
                                 <Download size={20} className="text-blue-600" />
                                 تصدير نسخة احتياطية
                             </div>
                             <p className="text-xs text-gray-500 mb-4 h-10">
                                 سيتم تحميل ملف JSON يحتوي على جميع بيانات الجداول (المدارس، المعلمين، التقييمات...).
                             </p>
                             <button 
                                onClick={handleExportBackup}
                                disabled={isBackingUp}
                                className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 font-bold text-sm flex justify-center items-center gap-2 transition-all"
                             >
                                 {isBackingUp ? <Loader2 className="animate-spin" size={16}/> : <Download size={16} />}
                                 {isBackingUp ? 'جاري التصدير...' : 'تحميل النسخة (JSON)'}
                             </button>
                        </div>

                         {/* Restore Card */}
                        <div className="border border-gray-200 rounded-xl p-5 hover:border-green-200 transition-colors bg-gray-50">
                             <div className="flex items-center gap-2 mb-3 font-bold text-gray-700">
                                 <UploadCloud size={20} className="text-green-600" />
                                 استعادة البيانات
                             </div>
                             <p className="text-xs text-gray-500 mb-4 h-10">
                                 قم برفع ملف JSON لاستعادة البيانات. 
                                 <span className="text-red-500 font-bold block mt-1">تنبيه: هذا الإجراء قد يضيف بيانات جديدة أو يحدث الموجودة.</span>
                             </p>
                             <input 
                                type="file" 
                                accept=".json" 
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleImportBackup}
                             />
                             <button 
                                onClick={() => !isRestoring && fileInputRef.current?.click()}
                                disabled={isRestoring}
                                className="w-full bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-green-50 hover:text-green-700 hover:border-green-200 font-bold text-sm flex justify-center items-center gap-2 transition-all"
                             >
                                 {isRestoring ? <Loader2 className="animate-spin" size={16}/> : <UploadCloud size={16} />}
                                 {isRestoring ? 'جاري الاستعادة...' : 'رفع ملف النسخة'}
                             </button>
                        </div>
                    </div>
                </div>

                {/* Schema Script Section */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                            <Database size={24} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-gray-800 mb-2">تأسيس قاعدة البيانات وإصلاح القيود</h2>
                            <p className="text-gray-500 mb-4 text-sm leading-relaxed">
                                يحتوي السكربت أدناه على إصلاح <strong>تفرد البيانات (البريد والهوية)</strong> للسماح بنفس المستخدم في مدارس متعددة بصلاحيات مختلفة.
                            </p>
                            
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2 text-sm">
                                    <AlertTriangle size={16} /> تحديث هام لتعدد الصلاحيات
                                </h4>
                                <p className="text-xs text-blue-800">
                                    لتفعيل ميزة "سجل واحد بصلاحيات متعددة" و "الأحداث المستقلة لكل مدرسة"، يرجى نسخ الكود أدناه وتشغيله في Supabase SQL Editor.
                                </p>
                            </div>

                            <div className="relative group">
                                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-left text-xs overflow-x-auto font-mono h-96 custom-scrollbar" dir="ltr">
                                    {fullSchemaScript}
                                </pre>
                                <button 
                                onClick={copyToClipboard}
                                className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded transition-all flex items-center gap-2 text-xs backdrop-blur-sm"
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'تم النسخ' : 'نسخ الكود'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
