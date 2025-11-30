
import React, { useState } from 'react';
import { UserRole, User, TeacherCategory } from '../types';
import { School, User as UserIcon, Mail, Lock, Building2, ArrowRight, Loader2, CheckCircle, CreditCard } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface RegisterScreenProps {
  onLogin: (user: User) => void;
  onBack: () => void;
}

export default function RegisterScreen({ onLogin, onBack }: RegisterScreenProps) {
  const [step, setStep] = useState(1); // 1: School Info, 2: Manager Info
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    // School Data
    schoolName: '',
    ministryId: '',
    stage: 'الابتدائية',
    schoolType: 'بنين',
    // Manager Data
    fullName: '',
    nationalId: '', // Added National ID
    email: '',
    password: '', 
    confirmPassword: ''
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    if (formData.password !== formData.confirmPassword) {
        setErrorMsg('كلمة المرور غير متطابقة');
        setIsLoading(false);
        return;
    }

    try {
        // 1. Check if email or national ID already exists
        const { data: existingEmail } = await supabase.from('app_users').select('id').eq('email', formData.email).maybeSingle();
        if (existingEmail) throw new Error('البريد الإلكتروني مستخدم بالفعل');

        const { data: existingId } = await supabase.from('teachers').select('id').eq('national_id', formData.nationalId).maybeSingle();
        if (existingId) throw new Error('رقم الهوية الوطنية مسجل بالفعل');

        // 2. Create School
        const { data: schoolData, error: schoolError } = await supabase
            .from('schools')
            .insert([{
                name: formData.schoolName,
                ministry_id: formData.ministryId,
                stage: formData.stage,
                type: formData.schoolType,
                manager_name: formData.fullName,
                manager_national_id: formData.nationalId // Save manager ID in school record too
            }])
            .select()
            .single();

        if (schoolError) throw schoolError;

        // 3. Create Manager as a TEACHER (to be evaluatable and unified)
        const { error: teacherError } = await supabase
            .from('teachers')
            .insert([{
                name: formData.fullName,
                national_id: formData.nationalId,
                school_id: schoolData.id,
                role: UserRole.PRINCIPAL,
                roles: [UserRole.PRINCIPAL], // Grant Principal Role
                category: TeacherCategory.MANAGER, // Set category as Manager
                specialty: 'إدارة مدرسية',
                password: formData.password,
                mobile: '' 
            }]);

        if (teacherError) throw teacherError;

        // 4. Create Manager in App Users (For Email Login & Consistency)
        const { data: userData, error: userError } = await supabase
            .from('app_users')
            .insert([{
                full_name: formData.fullName,
                email: formData.email,
                role: UserRole.PRINCIPAL,
                school_id: schoolData.id,
                password: formData.password
            }])
            .select()
            .single();

        if (userError) throw userError;

        // 5. Create Free Trial Subscription
        await supabase.from('subscriptions').insert([{
            school_id: schoolData.id,
            plan_name: 'Basic',
            start_date: new Date().toISOString(),
            end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(), // 1 Month trial
            status: 'active',
            price: 0
        }]);

        // 6. Login User
        const userObj: User = {
            id: userData.id,
            name: userData.full_name,
            role: UserRole.PRINCIPAL,
            email: userData.email,
            nationalId: formData.nationalId,
            schoolId: schoolData.id,
            schoolName: schoolData.name
        };

        onLogin(userObj);

    } catch (error: any) {
        console.error(error);
        setErrorMsg(error.message || 'حدث خطأ أثناء التسجيل');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 animate-fade-in" dir="rtl">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="p-6 bg-primary-600 text-white flex justify-between items-center">
             <div>
                <h2 className="text-2xl font-bold">تسجيل مدرسة جديدة</h2>
                <p className="text-primary-100 text-sm mt-1">أنشئ حساباً لمدير المدرسة وابدأ في إدارة التقييمات</p>
             </div>
             <div className="bg-white/20 p-3 rounded-xl">
                <School size={32} />
             </div>
          </div>

          <form onSubmit={handleRegister} className="p-8">
             {/* Progress Steps */}
             <div className="flex items-center mb-8">
                 <div className={`flex items-center gap-2 ${step === 1 ? 'text-primary-600 font-bold' : 'text-green-600 font-bold'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 1 ? 'border-primary-600 bg-primary-50' : 'border-green-600 bg-green-600 text-white'}`}>
                         {step > 1 ? <CheckCircle size={16}/> : '1'}
                     </div>
                     <span>بيانات المدرسة</span>
                 </div>
                 <div className="flex-1 h-1 bg-gray-100 mx-4 relative">
                     <div className={`absolute top-0 right-0 h-full bg-green-500 transition-all duration-500 ${step === 2 ? 'w-full' : 'w-0'}`}></div>
                 </div>
                 <div className={`flex items-center gap-2 ${step === 2 ? 'text-primary-600 font-bold' : 'text-gray-400'}`}>
                     <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === 2 ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}>
                         2
                     </div>
                     <span>بيانات المدير</span>
                 </div>
             </div>

             {errorMsg && (
                 <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-lg text-sm flex items-center gap-2">
                     <span className="font-bold">خطأ:</span> {errorMsg}
                 </div>
             )}

             {/* Step 1: School Info */}
             {step === 1 && (
                 <div className="space-y-4 animate-fade-in">
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">اسم المدرسة</label>
                         <div className="relative">
                             <Building2 className="absolute top-3 right-3 text-gray-400" size={18} />
                             <input 
                                 type="text" required
                                 className="w-full pr-10 pl-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                 placeholder="مثال: مدرسة الرياض النموذجية"
                                 value={formData.schoolName}
                                 onChange={e => setFormData({...formData, schoolName: e.target.value})}
                             />
                         </div>
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الوزاري</label>
                         <input 
                             type="text" required
                             className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                             placeholder="مثال: 123456"
                             value={formData.ministryId}
                             onChange={e => setFormData({...formData, ministryId: e.target.value})}
                         />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">المرحلة</label>
                             <select 
                                 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                                 value={formData.stage}
                                 onChange={e => setFormData({...formData, stage: e.target.value})}
                             >
                                 <option value="الابتدائية">الابتدائية</option>
                                 <option value="المتوسطة">المتوسطة</option>
                                 <option value="الثانوية">الثانوية</option>
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">النوع</label>
                             <select 
                                 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                                 value={formData.schoolType}
                                 onChange={e => setFormData({...formData, schoolType: e.target.value})}
                             >
                                 <option value="بنين">بنين</option>
                                 <option value="بنات">بنات</option>
                             </select>
                         </div>
                     </div>
                     <div className="pt-4 flex justify-between">
                         <button type="button" onClick={onBack} className="text-gray-500 hover:text-gray-700 px-4 py-2">عودة</button>
                         <button 
                             type="button" 
                             onClick={() => {
                                 if(formData.schoolName && formData.ministryId) setStep(2);
                                 else alert('يرجى تعبئة جميع الحقول');
                             }}
                             className="bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 flex items-center gap-2"
                         >
                             التالي <ArrowRight size={16}/>
                         </button>
                     </div>
                 </div>
             )}

             {/* Step 2: Manager Info */}
             {step === 2 && (
                 <div className="space-y-4 animate-fade-in">
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">اسم المدير (الاسم الكامل)</label>
                         <div className="relative">
                             <UserIcon className="absolute top-3 right-3 text-gray-400" size={18} />
                             <input 
                                 type="text" required
                                 className="w-full pr-10 pl-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                 value={formData.fullName}
                                 onChange={e => setFormData({...formData, fullName: e.target.value})}
                             />
                         </div>
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية الوطنية (للدخول كمعلم/مدير)</label>
                         <div className="relative">
                             <CreditCard className="absolute top-3 right-3 text-gray-400" size={18} />
                             <input 
                                 type="text" required
                                 className="w-full pr-10 pl-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono text-left"
                                 dir="ltr"
                                 placeholder="10xxxxxxxx"
                                 value={formData.nationalId}
                                 onChange={e => setFormData({...formData, nationalId: e.target.value})}
                             />
                         </div>
                     </div>
                     <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني (للدخول كإدارة)</label>
                         <div className="relative">
                             <Mail className="absolute top-3 right-3 text-gray-400" size={18} />
                             <input 
                                 type="email" required
                                 className="w-full pr-10 pl-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                 placeholder="manager@example.com"
                                 value={formData.email}
                                 onChange={e => setFormData({...formData, email: e.target.value})}
                             />
                         </div>
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                             <div className="relative">
                                 <Lock className="absolute top-3 right-3 text-gray-400" size={18} />
                                 <input 
                                     type="password" required
                                     className="w-full pr-10 pl-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                     value={formData.password}
                                     onChange={e => setFormData({...formData, password: e.target.value})}
                                 />
                             </div>
                         </div>
                         <div>
                             <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
                             <input 
                                 type="password" required
                                 className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                 value={formData.confirmPassword}
                                 onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                             />
                         </div>
                     </div>

                     <div className="bg-blue-50 p-4 rounded-lg text-sm text-blue-800 mt-4">
                         <p className="font-bold mb-1">معلومة:</p>
                         سيتم إنشاء حساب مدير النظام (بصلاحية المعلم والمدير) وربطه بالمدرسة تلقائياً. يمكنك استخدام رقم الهوية أو البريد للدخول.
                     </div>

                     <div className="pt-4 flex justify-between">
                         <button type="button" onClick={() => setStep(1)} className="text-gray-500 hover:text-gray-700 px-4 py-2">السابق</button>
                         <button 
                             type="submit" 
                             disabled={isLoading}
                             className="bg-primary-600 text-white px-8 py-2.5 rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-70"
                         >
                             {isLoading && <Loader2 className="animate-spin" size={18}/>}
                             إتمام التسجيل
                         </button>
                     </div>
                 </div>
             )}

          </form>
        </div>
      </div>
    </div>
  );
}
