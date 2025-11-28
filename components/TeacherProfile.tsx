
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, Save, Loader2, ArrowRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Teacher } from '../types';

interface TeacherProfileProps {
  teacherId: string;
  onBack: () => void;
}

export default function TeacherProfile({ teacherId, onBack }: TeacherProfileProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacher, setTeacher] = useState<Teacher | null>(null);
  
  // Form State
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('teachers').select('*').eq('id', teacherId).single();
        if (error) throw error;
        
        if (data) {
             setTeacher({
                 id: data.id,
                 name: data.name,
                 nationalId: data.national_id,
                 specialty: data.specialty,
                 category: data.category,
                 schoolId: data.school_id,
                 mobile: data.mobile,
                 status: 'not_evaluated' as any // Dummy status for type compatibility
             });
             setMobile(data.mobile || '');
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [teacherId]);

  const handleSave = async () => {
      if (password && password !== confirmPassword) {
          alert('كلمة المرور غير متطابقة');
          return;
      }

      setSaving(true);
      try {
          const updates: any = { mobile: mobile };
          if (password) {
              updates.password = password;
          }

          const { error } = await supabase
              .from('teachers')
              .update(updates)
              .eq('id', teacherId);

          if (error) throw error;
          
          alert('تم حفظ البيانات بنجاح');
          setPassword('');
          setConfirmPassword('');
      } catch (error: any) {
          console.error(error);
          if (error.message?.includes('column') && error.message?.includes('password')) {
              alert('فشل حفظ كلمة المرور: قاعدة البيانات تحتاج إلى تحديث لإضافة عمود كلمة المرور. يرجى التواصل مع مسؤول النظام.');
          } else {
              alert('حدث خطأ أثناء الحفظ');
          }
      } finally {
          setSaving(false);
      }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
         <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 bg-white rounded-lg border hover:bg-gray-50 text-gray-600">
                <ArrowRight size={20} />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">الملف الشخصي</h2>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-4 mb-8 border-b border-gray-100 pb-6">
                <div className="w-20 h-20 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-3xl font-bold">
                    {teacher?.name.charAt(0)}
                </div>
                <div>
                    <h3 className="text-xl font-bold text-gray-900">{teacher?.name}</h3>
                    <p className="text-gray-500">{teacher?.category} - {teacher?.specialty}</p>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية</label>
                        <div className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-500 cursor-not-allowed flex items-center gap-2">
                             <User size={16} /> {teacher?.nationalId}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
                        <div className="relative">
                            <Phone size={16} className="absolute top-3 right-3 text-gray-400" />
                            <input 
                                type="tel" 
                                className="w-full border rounded-lg p-2.5 pr-10 focus:ring-2 focus:ring-primary-500"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                    <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Lock size={18} /> تغيير كلمة المرور
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">اترك الحقول فارغة إذا كنت لا تريد تغيير كلمة المرور.</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
                            <input 
                                type="password" 
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                                placeholder="********"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
                            <input 
                                type="password" 
                                className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                                placeholder="********"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="pt-6 flex justify-end">
                    <button 
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-primary-600 text-white px-8 py-2.5 rounded-lg hover:bg-primary-700 font-bold flex items-center gap-2 disabled:opacity-70"
                    >
                        {saving && <Loader2 className="animate-spin" size={18} />}
                        حفظ التعديلات
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}
