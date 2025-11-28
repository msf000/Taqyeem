
import React, { useState } from 'react';
import { UserRole, User } from '../types';
import { Shield, School, GraduationCap, ClipboardCheck, ArrowRight, Mail, Loader2, UserPlus, User as UserIcon, Building, Globe } from 'lucide-react';
import { supabase } from '../supabaseClient';
import RegisterScreen from './RegisterScreen';

interface LoginScreenProps {
  onLogin: (userOrRole: UserRole | User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loginType, setLoginType] = useState<'admin' | 'teacher'>('admin'); // 'admin' (Email) or 'teacher' (National ID)
  
  // Admin/Principal Login State
  const [email, setEmail] = useState('');
  
  // Teacher Login State
  const [nationalId, setNationalId] = useState('');
  const [teacherPassword, setTeacherPassword] = useState(''); // Last 4 digits or custom
  
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Multi-School Selection State
  const [showSchoolSelect, setShowSchoolSelect] = useState(false);
  const [foundTeacherAccounts, setFoundTeacherAccounts] = useState<any[]>([]);

  const handleEmailLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setErrorMsg('');

      try {
          // Check app_users table
          const { data: user, error } = await supabase
              .from('app_users')
              .select('*, schools(name)')
              .eq('email', email)
              .single();

          if (error || !user) {
              throw new Error('البريد الإلكتروني غير مسجل في النظام');
          }

          const userData: User = {
              id: user.id,
              name: user.full_name,
              role: user.role as UserRole,
              email: user.email,
              schoolId: user.school_id,
              schoolName: user.schools?.name
          };

          onLogin(userData);

      } catch (error: any) {
          console.error(error);
          const msg = error.message || error.error_description || 'فشل تسجيل الدخول';
          setErrorMsg(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } finally {
          setIsLoading(false);
      }
  };

  const handleTeacherLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsLoading(true);
      setErrorMsg('');
      setFoundTeacherAccounts([]);

      try {
          if (!nationalId) throw new Error('يرجى إدخال رقم الهوية');

          // 1. Fetch Teacher Records
          const { data: teachers, error } = await supabase
              .from('teachers')
              .select('*, schools(name, id)')
              .eq('national_id', nationalId);

          if (error) throw error;

          if (!teachers || teachers.length === 0) {
              throw new Error('رقم الهوية غير مسجل في النظام. يرجى مراجعة مدير المدرسة.');
          }

          // 2. Validate Password against ANY found record
          let validAccount = null;
          
          const isPasswordValid = teachers.some(t => {
              if (t.password) {
                  return t.password === teacherPassword;
              } else {
                  return teacherPassword === nationalId.slice(-4);
              }
          });

          if (!isPasswordValid) {
              throw new Error('كلمة المرور غير صحيحة');
          }

          // 3. Handle Login
          if (teachers.length === 1) {
              // Only one school found, login directly
              const t = teachers[0];
              const userData: User = {
                  id: t.id,
                  name: t.name,
                  role: UserRole.TEACHER,
                  schoolId: t.school_id,
                  schoolName: t.schools?.name
              };
              onLogin(userData);
          } else {
              // Multiple schools found, show selection
              setFoundTeacherAccounts(teachers);
              setShowSchoolSelect(true);
          }

      } catch (error: any) {
          console.error(error);
          setErrorMsg(error.message || 'فشل تسجيل الدخول');
      } finally {
          setIsLoading(false);
      }
  };

  const selectTeacherAccount = (account: any) => {
      const userData: User = {
          id: account.id,
          name: account.name,
          role: UserRole.TEACHER,
          schoolId: account.school_id,
          schoolName: account.schools?.name
      };
      onLogin(userData);
  };

  if (isRegistering) {
      return <RegisterScreen onLogin={onLogin} onBack={() => setIsRegistering(false)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
      
      {/* School Selection Modal for Teachers */}
      {showSchoolSelect && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                  <div className="p-6 bg-primary-600 text-white text-center">
                      <GraduationCap size={48} className="mx-auto mb-2 opacity-90"/>
                      <h3 className="text-xl font-bold">اختيار المدرسة</h3>
                      <p className="text-primary-100 text-sm">وجدنا حسابك مسجلاً في أكثر من مدرسة</p>
                  </div>
                  <div className="p-6 space-y-3">
                      <p className="text-gray-600 text-sm mb-2 font-bold">يرجى اختيار المدرسة التي تود الدخول إليها:</p>
                      {foundTeacherAccounts.map((acc: any) => (
                          <button 
                              key={acc.id}
                              onClick={() => selectTeacherAccount(acc)}
                              className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-all text-right group"
                          >
                              <div className="bg-white p-2 rounded-full border border-gray-100 group-hover:border-primary-200">
                                  <Building size={20} className="text-gray-500 group-hover:text-primary-600"/>
                              </div>
                              <div>
                                  <h4 className="font-bold text-gray-800 group-hover:text-primary-800">{acc.schools?.name || 'مدرسة غير معروفة'}</h4>
                                  <span className="text-xs text-gray-500 group-hover:text-primary-600">التخصص: {acc.specialty}</span>
                              </div>
                              <ArrowRight size={16} className="mr-auto text-gray-300 group-hover:text-primary-500"/>
                          </button>
                      ))}
                  </div>
                  <div className="p-4 bg-gray-50 text-center border-t border-gray-100">
                      <button onClick={() => setShowSchoolSelect(false)} className="text-gray-500 hover:text-gray-700 text-sm">إلغاء</button>
                  </div>
              </div>
          </div>
      )}

      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-600 text-white shadow-lg mb-4">
            <span className="text-4xl font-bold">ت</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">نظام تقييم المدارس</h1>
          <p className="text-lg text-gray-600">
            منصة موحدة لإدارة الأداء المدرسي
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Tabs Header */}
          <div className="flex border-b border-gray-100">
              <button 
                  onClick={() => { setLoginType('admin'); setErrorMsg(''); }}
                  className={`flex-1 py-4 text-center font-bold text-sm transition-colors flex items-center justify-center gap-2 ${loginType === 'admin' ? 'bg-white text-primary-600 border-b-2 border-primary-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                  <Shield size={18} /> الإدارة والمشرفين
              </button>
              <button 
                  onClick={() => { setLoginType('teacher'); setErrorMsg(''); }}
                  className={`flex-1 py-4 text-center font-bold text-sm transition-colors flex items-center justify-center gap-2 ${loginType === 'teacher' ? 'bg-white text-primary-600 border-b-2 border-primary-600' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
              >
                  <GraduationCap size={18} /> دخول المعلمين
              </button>
          </div>

          <div className="p-8 flex flex-col justify-center animate-fade-in">
              {loginType === 'admin' ? (
                  <>
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <Mail size={20} className="text-primary-600" />
                        تسجيل دخول الإدارة
                    </h3>
                    <form onSubmit={handleEmailLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                            <input 
                                type="email" 
                                required
                                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                                placeholder="example@school.edu.sa"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        
                        {errorMsg && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{errorMsg}</div>}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'تسجيل الدخول'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                        <button 
                            onClick={() => setIsRegistering(true)}
                            className="w-full mb-3 border border-primary-200 text-primary-700 bg-primary-50 py-3 rounded-lg font-bold hover:bg-primary-100 transition-colors flex justify-center items-center gap-2"
                        >
                            <UserPlus size={18} /> تسجيل مدرسة جديدة
                        </button>
                    </div>
                  </>
              ) : (
                  <>
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                        <UserIcon size={20} className="text-primary-600" />
                        بوابة المعلمين
                    </h3>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-4 text-xs text-blue-800">
                        <strong>تعليمات الدخول:</strong> اسم المستخدم هو رقم الهوية الوطنية، وكلمة المرور الافتراضية هي آخر 4 أرقام من الهوية.
                    </div>
                    <form onSubmit={handleTeacherLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية الوطنية</label>
                            <input 
                                type="text" 
                                required
                                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono text-left" // Left align for numbers
                                dir="ltr"
                                placeholder="10xxxxxxxx"
                                value={nationalId}
                                onChange={(e) => setNationalId(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono text-left"
                                dir="ltr"
                                placeholder="********"
                                value={teacherPassword}
                                onChange={(e) => setTeacherPassword(e.target.value)}
                            />
                        </div>
                        
                        {errorMsg && <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100">{errorMsg}</div>}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-primary-600 text-white py-3 rounded-lg font-bold hover:bg-primary-700 transition-colors flex justify-center items-center gap-2 disabled:opacity-70"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'دخول المعلم'}
                        </button>
                    </form>
                  </>
              )}
          </div>
        </div>
        <div className="text-center text-xs text-gray-400">الإصدار 2.1.0 - جميع الحقوق محفوظة</div>
      </div>
    </div>
  );
}