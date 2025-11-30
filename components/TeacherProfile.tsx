
import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Lock, Save, Loader2, ArrowRight, Building, Calendar } from 'lucide-react';
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
  const [schoolDetails, setSchoolDetails] = useState<{
      educationOffice?: string;
      academicYear?: string;
      ministryId?: string;
  }>({});
  
  // Form State
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState(''); 
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        // Fetch teacher with school details including new fields
        const { data, error } = await supabase
            .from('teachers')
            .select('*, schools(name, education_office, academic_year, ministry_id)')
            .eq('id', teacherId)
            .single();

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
             
             // Extract school details
             if (data.schools) {
                 setSchoolDetails({
                     educationOffice: data.schools.education_office,
                     academicYear: data.schools.academic_year,
                     ministryId: data.schools.ministry_id
                 });
             }

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
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
         <div className="flex items-center gap-3 mb-6">
            <button onClick={onBack} className="p-2 bg-white rounded-lg border hover:bg-gray-50 text-gray-600">
                <ArrowRight size={20} />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">الملف الشخصي</h2>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-col md:flex-row items-center gap-6 mb-8 border-b border-gray-100 pb-6">
                <div className="w-24 h-24 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-4xl font-bold shadow-inner">
                    {teacher?.name.charAt(0)}
                </div>
                <div className="text-center md:text-right flex-1">
                    <h3 className="text-2xl font-bold text-gray-900">{teacher?.name}</h3>
                    <p className="text-gray-500 font-medium mt-1">{teacher?.category} - {teacher?.specialty}</p>
                    
                    <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-4 text-sm text-gray-500">
                        {schoolDetails.educationOffice && (
                            <span className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border">
                                <Building size={14}/> {schoolDetails.educationOffice}
                            </span>
                        )}
                        {schoolDetails.academicYear && (
                            <span className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border">
                                <Calendar size={14}/> {schoolDetails.academicYear}
                            </span>
                        )}
                        {schoolDetails.ministryId && (
                            <span className="flex items-center gap-1 bg-gray-50 px-3 py-1 rounded-full border font-mono">
                                #{schoolDetails.ministryId}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية (اسم المستخدم)</label>
                        <div className="w-full bg-gray-50 border rounded-lg p-2.5 text-gray-500 cursor-not-allowed flex items-center gap-2 font-mono">
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
                    <p className="text-xs text-gray-500 mb-4 bg-yellow-50 p-3 rounded text-yellow-800 border border-yellow-100">
                        ملاحظة: اترك الحقول التالية فارغة إذا كنت لا ترغب في تغيير كلمة المرور الحالية.
                    </p>
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
                        className="bg-primary-600 text-white px-8 py-2.5 rounded-lg hover:bg-primary-700 font-bold flex items-center gap-2 disabled:opacity-70 shadow-sm"
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
