
import React, { useState, useEffect, useRef } from 'react';
import { Database, Copy, AlertTriangle, Check, Layers, Users, CreditCard, Shield, Plus, Trash2, RefreshCw, Search, Loader2, Calendar, DollarSign, X, Edit2, Download, UploadCloud, FileJson, Lock, AlertOctagon, MoreHorizontal } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserRole, SystemUser, Subscription, School } from '../types';

export default function SystemSettings() {
  const [activeTab, setActiveTab] = useState<'users' | 'subscriptions' | 'database'>('users');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Backup & Restore State
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResetting, setIsResetting] = useState(false); // State for Factory Reset
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data State
  const [systemUsers, setSystemUsers] = useState<SystemUser[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  // User Modal State
  const [newUser, setNewUser] = useState<Partial<SystemUser>>({ role: UserRole.TEACHER });
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  // Subscription Modal State
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
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
  const fullSchemaScriptActual = `
-- ==========================================
-- 1. تحديث هيكلية قاعدة البيانات
-- ==========================================

-- Add necessary columns if they don't exist
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS roles text[] DEFAULT '{}';
ALTER TABLE schools ADD COLUMN IF NOT EXISTS manager_national_id text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS education_office text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS academic_year text;
ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS status text DEFAULT 'draft';

-- Migrate legacy role to roles array
UPDATE teachers 
SET roles = array_append(roles, role) 
WHERE role IS NOT NULL AND (roles IS NULL OR roles = '{}' OR NOT (roles @> ARRAY[role]));

-- Fix Constraints and Indexes
ALTER TABLE teachers DROP CONSTRAINT IF EXISTS teachers_national_id_key;
DROP INDEX IF EXISTS idx_teachers_national_id_school_id_role; 
DROP INDEX IF EXISTS idx_teachers_national_id_school_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_national_id_school_id 
ON teachers (national_id, school_id);

ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_app_users_email_school_id 
ON app_users (email, school_id);

ALTER TABLE school_events ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES schools(id) ON DELETE CASCADE;

-- Create Feedback Bank Table
create table if not exists feedback_bank (
  id uuid default gen_random_uuid() primary key,
  category text, 
  phrase_text text not null,
  tags text[], 
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE feedback_bank DROP CONSTRAINT IF EXISTS feedback_bank_category_check;
ALTER TABLE feedback_bank ADD CONSTRAINT feedback_bank_category_check CHECK (category IN ('strength', 'improvement', 'action', 'aspiration'));
`;

  useEffect(() => {
    fetchSchools(); 
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

  // --- Handlers ---
  const handleExportBackup = async () => {
      setIsBackingUp(true);
      try {
          const tables = ['schools', 'specialties', 'evaluation_indicators', 'evaluation_criteria', 'verification_indicators', 'school_events', 'teachers', 'app_users', 'evaluations', 'teacher_evidence', 'subscriptions', 'feedback_bank'];
          const backupData: any = { timestamp: new Date().toISOString(), version: '1.0', data: {} };
          for (const table of tables) {
              const { data } = await supabase.from(table).select('*');
              backupData.data[table] = data || [];
          }
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
          alert('حدث خطأ أثناء النسخ الاحتياطي: ' + getErrorMessage(error));
      } finally {
          setIsBackingUp(false);
      }
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!window.confirm('تنبيه: استعادة البيانات ستقوم بتحديث البيانات الموجودة. هل أنت متأكد؟')) {
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
      }
      setIsRestoring(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
          try {
              const jsonContent = event.target?.result as string;
              const backup = JSON.parse(jsonContent);
              if (!backup.data) throw new Error('ملف غير صالح');
              const tablesOrder = ['schools', 'specialties', 'evaluation_indicators', 'evaluation_criteria', 'verification_indicators', 'school_events', 'teachers', 'app_users', 'evaluations', 'teacher_evidence', 'subscriptions', 'feedback_bank'];
              for (const table of tablesOrder) {
                  const rows = backup.data[table];
                  if (rows && rows.length > 0) await supabase.from(table).upsert(rows);
              }
              alert('تم استعادة البيانات بنجاح!');
              fetchSchools(); if (activeTab === 'users') fetchUsers(); if (activeTab === 'subscriptions') fetchSubscriptions();
          } catch (error) {
              alert('فشل استعادة البيانات: ' + getErrorMessage(error));
          } finally {
              setIsRestoring(false);
              if (fileInputRef.current) fileInputRef.current.value = '';
          }
      };
      reader.readAsText(file);
  };

  const handleFactoryReset = async () => {
      if (prompt('للتأكيد، اكتب "حذف الكل":') !== 'حذف الكل') return;
      setIsResetting(true);
      try {
          const dummyUUID = '00000000-0000-0000-0000-000000000000';
          await supabase.from('teacher_evidence').delete().neq('id', dummyUUID);
          await supabase.from('evaluations').delete().neq('id', dummyUUID);
          await supabase.from('school_events').delete().neq('id', dummyUUID);
          await supabase.from('subscriptions').delete().neq('id', dummyUUID);
          await supabase.from('app_users').delete().neq('id', dummyUUID);
          await supabase.from('teachers').delete().neq('id', dummyUUID);
          await supabase.from('schools').delete().neq('id', dummyUUID);
          alert('تم تصفية النظام بنجاح.');
          window.location.reload();
      } catch (error) {
          alert('خطأ: ' + getErrorMessage(error));
      } finally {
          setIsResetting(false);
      }
  };

  const handleOpenAddUser = () => {
      setEditingUserId(null);
      setNewUser({ role: UserRole.TEACHER });
      setIsUserModalOpen(true);
  };

  const handleEditUser = (user: SystemUser) => {
      setNewUser({ email: user.email, full_name: user.full_name, role: user.role, password: user.password, school_id: user.school_id });
      setEditingUserId(user.id);
      setIsUserModalOpen(true);
  };

  const handleSaveUser = async () => {
    if (!newUser.email || !newUser.full_name) return alert('البيانات ناقصة');
    try {
        if (editingUserId) await supabase.from('app_users').update(newUser).eq('id', editingUserId);
        else await supabase.from('app_users').insert([newUser]);
        await fetchUsers();
        setIsUserModalOpen(false);
        setEditingUserId(null);
        setNewUser({ role: UserRole.TEACHER });
    } catch (error) { alert('خطأ: ' + getErrorMessage(error)); }
  };

  const handleDeleteUser = async (id: string) => {
    if(!confirm('حذف المستخدم؟')) return;
    await supabase.from('app_users').delete().eq('id', id);
    setSystemUsers(prev => prev.filter(u => u.id !== id));
  };

  const handleOpenAddSub = () => {
      setEditingSubId(null);
      setIsSubModalOpen(true);
  };

  const handleEditSubscription = (sub: Subscription) => {
    setNewSub({ school_id: sub.school_id, plan_name: sub.plan_name, start_date: sub.start_date, end_date: sub.end_date, price: sub.price });
    setEditingSubId(sub.id);
    setIsSubModalOpen(true);
  };

  const handleSaveSubscription = async () => {
      if (!newSub.school_id) return alert('اختر المدرسة');
      try {
          const payload = { ...newSub, status: 'active' };
          if (editingSubId) await supabase.from('subscriptions').update(payload).eq('id', editingSubId);
          else await supabase.from('subscriptions').insert([payload]);
          await fetchSubscriptions();
          setIsSubModalOpen(false);
          setEditingSubId(null);
      } catch (error) { alert('خطأ: ' + getErrorMessage(error)); }
  };

  const handleDeleteSubscription = async (id: string) => {
      if(!confirm('حذف الاشتراك؟')) return;
      await supabase.from('subscriptions').delete().eq('id', id);
      setSubscriptions(prev => prev.filter(s => s.id !== id));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullSchemaScriptActual);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-20">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
           <Layers className="text-primary-600" />
           إعدادات النظام
        </h2>

        {/* Tabs */}
        <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 p-1">
            <button onClick={() => setActiveTab('users')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'users' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Users size={16} /> المستخدمين
            </button>
            <button onClick={() => setActiveTab('subscriptions')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'subscriptions' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <CreditCard size={16} /> الاشتراكات
            </button>
            <button onClick={() => setActiveTab('database')} className={`flex-1 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === 'database' ? 'bg-primary-50 text-primary-700 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
                <Database size={16} /> قاعدة البيانات
            </button>
        </div>

        {/* --- USERS TAB --- */}
        {activeTab === 'users' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-700">المستخدمين</h3>
                    <button onClick={handleOpenAddUser} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-primary-700 font-bold shadow-sm">
                        <Plus size={16} /> مستخدم جديد
                    </button>
                </div>

                <div className="bg-gray-50 md:bg-white rounded-xl md:shadow-sm md:border border-gray-200 overflow-hidden">
                    {isLoading ? (
                         <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-600" /></div>
                    ) : systemUsers.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">لا يوجد بيانات.</div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50 text-gray-600 text-sm">
                                        <tr>
                                            <th className="px-6 py-3">الاسم</th>
                                            <th className="px-6 py-3">البريد</th>
                                            <th className="px-6 py-3">الدور</th>
                                            <th className="px-6 py-3">المدرسة</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {systemUsers.map(user => (
                                            <tr key={user.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium">{user.full_name}</td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
                                                <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-700">{user.role}</span></td>
                                                <td className="px-6 py-4 text-sm text-gray-500">{(user as any).schools?.name || '-'}</td>
                                                <td className="px-6 py-4 flex gap-2 justify-end">
                                                    <button onClick={() => handleEditUser(user)} className="text-blue-600 hover:bg-blue-50 p-2 rounded"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteUser(user.id)} className="text-red-600 hover:bg-red-50 p-2 rounded"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Mobile Card View */}
                            <div className="md:hidden flex flex-col gap-3">
                                {systemUsers.map(user => (
                                    <div key={user.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h4 className="font-bold text-gray-900">{user.full_name}</h4>
                                                <p className="text-xs text-gray-500">{user.email}</p>
                                            </div>
                                            <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs font-bold">{user.role}</span>
                                        </div>
                                        <div className="text-xs text-gray-500 mb-3 flex items-center gap-1">
                                            <Shield size={12}/> المدرسة: {(user as any).schools?.name || '-'}
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-gray-50">
                                            <button onClick={() => handleEditUser(user)} className="flex-1 bg-gray-50 text-gray-700 py-2 rounded text-xs font-bold flex justify-center gap-1"><Edit2 size={14}/> تعديل</button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="flex-1 bg-red-50 text-red-700 py-2 rounded text-xs font-bold flex justify-center gap-1"><Trash2 size={14}/> حذف</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* --- SUBSCRIPTIONS TAB --- */}
        {activeTab === 'subscriptions' && (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-700">الاشتراكات</h3>
                    <button onClick={handleOpenAddSub} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-primary-700 font-bold shadow-sm">
                         <Plus size={16} /> اشتراك جديد
                    </button>
                </div>

                <div className="bg-gray-50 md:bg-white rounded-xl md:shadow-sm md:border border-gray-200 overflow-hidden">
                    {isLoading ? (
                        <div className="p-8 flex justify-center"><Loader2 className="animate-spin" /></div>
                    ) : subscriptions.length === 0 ? (
                        <div className="p-12 text-center text-gray-500">لا توجد بيانات.</div>
                    ) : (
                        <>
                            {/* Desktop Table */}
                            <div className="hidden md:block">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-50 text-gray-600 text-sm">
                                        <tr>
                                            <th className="px-6 py-3">المدرسة</th>
                                            <th className="px-6 py-3">الخطة</th>
                                            <th className="px-6 py-3">النهاية</th>
                                            <th className="px-6 py-3">السعر</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {subscriptions.map(sub => (
                                            <tr key={sub.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium">{sub.school_name || 'غير محدد'}</td>
                                                <td className="px-6 py-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-bold">{sub.plan_name}</span></td>
                                                <td className="px-6 py-4 text-sm font-mono">{sub.end_date}</td>
                                                <td className="px-6 py-4 font-bold">{sub.price} ريال</td>
                                                <td className="px-6 py-4 flex gap-2 justify-end">
                                                    <button onClick={() => handleEditSubscription(sub)} className="text-gray-400 hover:text-blue-600 p-2"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteSubscription(sub.id)} className="text-gray-400 hover:text-red-600 p-2"><Trash2 size={16}/></button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Card View */}
                            <div className="md:hidden flex flex-col gap-3">
                                {subscriptions.map(sub => (
                                    <div key={sub.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                            <h4 className="font-bold text-gray-900">{sub.school_name}</h4>
                                            <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">{sub.plan_name}</span>
                                        </div>
                                        <div className="flex justify-between items-center mb-3 text-xs text-gray-500">
                                            <span>ينتهي: {sub.end_date}</span>
                                            <span className="font-bold text-gray-800">{sub.price} ريال</span>
                                        </div>
                                        <div className="flex gap-2 pt-2 border-t border-gray-50">
                                            <button onClick={() => handleEditSubscription(sub)} className="flex-1 bg-gray-50 text-gray-700 py-2 rounded text-xs font-bold flex justify-center gap-1"><Edit2 size={14}/> تعديل</button>
                                            <button onClick={() => handleDeleteSubscription(sub.id)} className="flex-1 bg-red-50 text-red-700 py-2 rounded text-xs font-bold flex justify-center gap-1"><Trash2 size={14}/> حذف</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        )}

        {/* --- DATABASE TAB --- */}
        {activeTab === 'database' && (
            <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">النسخ الاحتياطي</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleExportBackup} disabled={isBackingUp} className="bg-blue-50 text-blue-700 p-4 rounded-lg flex items-center justify-center gap-2 hover:bg-blue-100 font-bold">
                            {isBackingUp ? <Loader2 className="animate-spin" size={20}/> : <Download size={20} />} تصدير (Backup)
                        </button>
                        <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring} className="bg-green-50 text-green-700 p-4 rounded-lg flex items-center justify-center gap-2 hover:bg-green-100 font-bold">
                            {isRestoring ? <Loader2 className="animate-spin" size={20}/> : <UploadCloud size={20} />} استيراد (Restore)
                        </button>
                        <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportBackup} accept=".json" />
                    </div>
                </div>

                <div className="bg-red-50 p-6 rounded-xl border border-red-200">
                    <h2 className="text-xl font-bold text-red-800 mb-2">تصفية النظام</h2>
                    <p className="text-red-600 text-sm mb-4">حذف جميع البيانات نهائياً.</p>
                    <button onClick={handleFactoryReset} disabled={isResetting} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-red-700 disabled:opacity-50">
                        {isResetting ? <Loader2 className="animate-spin" size={18}/> : <Trash2 size={18} />} حذف الكل
                    </button>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-bold text-gray-800">تحديث هيكلية قاعدة البيانات</h2>
                        <button onClick={copyToClipboard} className="text-blue-600 text-sm hover:underline">{copied ? 'تم النسخ' : 'نسخ الكود'}</button>
                    </div>
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-auto h-64 font-mono" dir="ltr">{fullSchemaScriptActual}</pre>
                </div>
            </div>
        )}

        {/* User Modal */}
        {isUserModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b">
                        <h3 className="text-xl font-bold text-gray-800">{editingUserId ? 'تعديل مستخدم' : 'مستخدم جديد'}</h3>
                        <button onClick={() => setIsUserModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                            <input type="text" className="w-full border p-2 rounded-lg" placeholder="الاسم" value={newUser.full_name || ''} onChange={e => setNewUser({...newUser, full_name: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                            <input type="email" className="w-full border p-2 rounded-lg" placeholder="example@domain.com" value={newUser.email || ''} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                            <input type="text" className="w-full border p-2 rounded-lg" placeholder="********" value={newUser.password || ''} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">الصلاحية</label>
                                <select className="w-full border p-2 rounded-lg bg-white" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})}>
                                    {Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">المدرسة</label>
                                <select className="w-full border p-2 rounded-lg bg-white" value={newUser.school_id || ''} onChange={e => setNewUser({...newUser, school_id: e.target.value})}>
                                    <option value="">(اختياري للمدير)</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                    <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                        <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                        <button onClick={handleSaveUser} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 font-bold">حفظ</button>
                    </div>
                </div>
            </div>
        )}

        {/* Subscription Modal */}
        {isSubModalOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in max-h-[90vh] overflow-y-auto">
                    <div className="flex justify-between items-center p-6 border-b">
                        <h3 className="text-xl font-bold text-gray-800">{editingSubId ? 'تعديل اشتراك' : 'اشتراك جديد'}</h3>
                        <button onClick={() => setIsSubModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">المدرسة</label>
                            <select className="w-full border p-2 rounded-lg bg-white" value={newSub.school_id} onChange={e => setNewSub({...newSub, school_id: e.target.value})}>
                                <option value="">اختر المدرسة</option>
                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">خطة الاشتراك</label>
                                <select className="w-full border p-2 rounded-lg bg-white" value={newSub.plan_name} onChange={e => setNewSub({...newSub, plan_name: e.target.value})}>
                                    <option value="Basic">Basic</option>
                                    <option value="Premium">Premium</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">السعر (ريال)</label>
                                <input type="number" className="w-full border p-2 rounded-lg" placeholder="0" value={newSub.price} onChange={e => setNewSub({...newSub, price: parseFloat(e.target.value)})} />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ الانتهاء</label>
                            <input type="date" className="w-full border p-2 rounded-lg" value={newSub.end_date} onChange={e => setNewSub({...newSub, end_date: e.target.value})} />
                        </div>
                    </div>
                    <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                        <button onClick={() => setIsSubModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                        <button onClick={handleSaveSubscription} className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 font-bold">حفظ</button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
