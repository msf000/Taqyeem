
import React, { useState, useEffect } from 'react';
import { Database, Copy, AlertTriangle, Check, Layers, Users, CreditCard, Shield, Plus, Trash2, RefreshCw, Search, Loader2, Calendar, DollarSign, X, Edit2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserRole, SystemUser, Subscription, School } from '../types';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'database'>('users');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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

  // SQL Script
  const fullSchemaScript = `
-- ==========================================
-- 1. أوامر التحديث (Migrations) - ابدأ بهذا القسم
-- ==========================================
-- لإصلاح الأعمدة الناقصة في الجداول الموجودة سابقاً
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS school_id uuid references schools(id) on delete set null;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS objection_text text;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS objection_status text default 'none';
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS teacher_evidence_links jsonb default '[]'::jsonb;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS password text; -- كلمة مرور المعلم

-- ==========================================
-- 2. إنشاء الجداول الأساسية (إذا لم تكن موجودة)
-- ==========================================

-- جدول المدارس
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

-- جدول المعلمين
create table if not exists teachers (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  national_id text unique,
  specialty text,
  category text, 
  mobile text,
  password text,
  school_id uuid references schools(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- جدول مستخدمي النظام (للصلاحيات)
create table if not exists app_users (
  id uuid default gen_random_uuid() primary key,
  email text unique not null,
  full_name text not null,
  role text not null,
  school_id uuid references schools(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- جدول الاشتراكات
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

-- جدول مؤشرات التقييم
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

-- جدول المعايير الفرعية للمؤشر
create table if not exists evaluation_criteria (
  id uuid default gen_random_uuid() primary key,
  indicator_id uuid references evaluation_indicators(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- جدول شواهد التحقق
create table if not exists verification_indicators (
  id uuid default gen_random_uuid() primary key,
  indicator_id uuid references evaluation_indicators(id) on delete cascade,
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- جدول التقييمات
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

-- جدول التخصصات
create table if not exists specialties (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- جدول الأحداث والفترات الزمنية
create table if not exists school_events (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text default 'evaluation', 
  start_date date not null,
  end_date date not null,
  status text default 'upcoming',
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ==========================================
-- 3. تفعيل سياسات الأمان (RLS)
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
`;

  useEffect(() => {
    fetchSchools(); // Always fetch schools as they are needed for dropdowns in both tabs
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'subscriptions') fetchSubscriptions();
  }, [activeTab]);

  const fetchSchools = async () => {
      const { data } = await supabase.from('schools').select('id, name');
      setSchools(data || []);
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

  // --- User Handlers ---
  const handleEditUser = (user: SystemUser) => {
      setNewUser({
          email: user.email,
          full_name: user.full_name,
          role: user.role,
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
        alert('حدث خطأ: ' + getErrorMessage(error));
    }
  };

  const handleDeleteUser = async (id: string) => {
    if(!window.confirm('هل أنت متأكد من حذف المستخدم؟')) return;
    try {
        const { error } = await supabase.from('app_users').delete().eq('id', id);
        if(error) throw error;
        setSystemUsers(prev => prev.filter(u => u.id !== id));
    } catch (error) {
        console.error(error);
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

  const handleDeleteSubscription = async (id: string) => {
      if(!window.confirm('هل أنت متأكد من إلغاء الاشتراك؟')) return;
      try {
          const { error } = await supabase.from('subscriptions').delete().eq('id', id);
          if(error) throw error;
          setSubscriptions(prev => prev.filter(s => s.id !== id));
      } catch(error) {
          console.error(error);
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
                        <div className="mt-4 flex justify-end gap-2 border-t pt-4 border-gray-100">
                            <button onClick={() => setIsAddingUser(false)} className="text-gray-500 text-sm px-4 py-2 hover:bg-gray-50 rounded-lg">إلغاء</button>
                            <button onClick={handleSaveUser} className="bg-primary-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-primary-700 shadow-sm">
                                {editingUserId ? 'تحديث البيانات' : 'حفظ المستخدم'}
                            </button>
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

        {/* ... (Subscriptions and Database tabs unchanged in logic but included in full file) ... */}
        {activeTab === 'subscriptions' && (
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">الاشتراكات النشطة</p>
                            <h3 className="text-3xl font-bold text-green-600 mt-1">{subscriptions.filter(s => s.status === 'active').length}</h3>
                        </div>
                        <div className="bg-green-50 p-3 rounded-full text-green-600"><CreditCard size={24} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">إجمالي الإيرادات</p>
                            <h3 className="text-3xl font-bold text-gray-800 mt-1">
                                {subscriptions.reduce((acc, curr) => acc + (curr.price || 0), 0).toLocaleString()} <span className="text-sm text-gray-400 font-normal">ريال</span>
                            </h3>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-full text-blue-600"><DollarSign size={24} /></div>
                    </div>
                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-gray-500 text-sm">المدارس المسجلة</p>
                            <h3 className="text-3xl font-bold text-gray-700 mt-1">{schools.length}</h3>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-full text-gray-600"><Layers size={24} /></div>
                    </div>
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
                            <div className="flex justify-end gap-2 border-t pt-4 border-gray-100">
                                <button onClick={() => setIsAddingSub(false)} className="text-gray-500 text-sm px-4 py-2 hover:bg-gray-50 rounded-lg">إلغاء</button>
                                <button onClick={handleSaveSubscription} className="bg-blue-600 text-white text-sm px-6 py-2 rounded-lg hover:bg-blue-700 shadow-sm">
                                    {editingSubId ? 'تحديث الاشتراك' : 'تفعيل الاشتراك'}
                                </button>
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
                                                    <span className="mx-1">-></span>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div className="flex items-start gap-4">
                <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
                    <Database size={24} />
                </div>
                <div className="flex-1">
                    <h2 className="text-xl font-bold text-gray-800 mb-2">تأسيس قاعدة البيانات (Schema)</h2>
                    <p className="text-gray-500 mb-4 text-sm leading-relaxed">
                        يحتوي السكربت أدناه على جميع الجداول اللازمة لتشغيل النظام بما في ذلك 
                        <strong> المستخدمين</strong>، <strong>الاشتراكات</strong>، و <strong>الأحداث</strong>.
                    </p>
                    
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <h4 className="font-bold text-blue-800 flex items-center gap-2 mb-2 text-sm">
                            <AlertTriangle size={16} /> تنبيه هام
                        </h4>
                        <p className="text-xs text-blue-800">
                            قم بنسخ هذا الكود وتشغيله في محرر SQL في Supabase لضمان عمل جميع خصائص إدارة المستخدمين والاشتراكات بشكل صحيح.
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
        )}
    </div>
  );
}
