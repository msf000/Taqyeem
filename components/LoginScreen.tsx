
import React, { useState } from 'react';
import { UserRole, User } from '../types';
import { Shield, School, GraduationCap, ClipboardCheck, ArrowRight, Mail, Loader2, UserPlus, User as UserIcon, Building, Globe, Lock, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import RegisterScreen from './RegisterScreen';

interface LoginScreenProps {
  onLogin: (userOrRole: UserRole | User) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [loginType, setLoginType] = useState<'admin' | 'teacher'>('admin'); // 'admin' (Email) or 'teacher' (National ID)
  
  // Admin/Principal Login State
  const [email, setEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  
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

          // Check Password
          if (user.password && user.password !== adminPassword) {
              throw new Error('كلمة المرور غير صحيحة');
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
              // Use assigned role or default to Teacher
              const assignedRole = (t.role as UserRole) || UserRole.TEACHER;
              
              const userData: User = {
                  id: t.id,
                  name: t.name,
                  role: assignedRole,
                  nationalId: t.national_id, // Important for profile switching
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
      const assignedRole = (account.role as UserRole) || UserRole.TEACHER;
      const userData: User = {
          id: account.id,
          name: account.name,
          role: assignedRole,
          nationalId: account.national_id, // Important
          schoolId: account.school_id,
          schoolName: account.schools?.name
      };
      onLogin(userData);
  };

  if (isRegistering) {
      return <RegisterScreen onLogin={onLogin} onBack={() => setIsRegistering(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary-50 to-secondary-100 flex flex-col items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary-200/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-blue-200/40 rounded-full blur-3xl"></div>
      </div>

      {/* School Selection Modal for Teachers */}
      {showSchoolSelect && (
          <div className="fixed inset-0 bg-secondary-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
              <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-secondary-200">
                  <div className="p-8 bg-gradient-to-r from-primary-600 to-primary-700 text-white text-center">
                      <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-4">
                        <GraduationCap size={32}/>
                      </div>
                      <h3 className="text-2xl font-bold mb-1">اختيار المدرسة</h3>
                      <p className="text-primary-100 text-sm">وجدنا حسابك مسجلاً في أكثر من مدرسة</p>
                  </div>
                  <div className="p-6 space-y-3">
                      <p className="text-secondary-600 text-sm mb-3 font-bold">يرجى اختيار المدرسة التي تود الدخول إليها:</p>
                      {foundTeacherAccounts.map((acc: any) => (
                          <button 
                              key={acc.id}
                              onClick={() => selectTeacherAccount(acc)}
                              className="w-full flex items-center gap-4 p-4 rounded-xl border border-secondary-200 hover:border-primary-500 hover:bg-primary-50 hover:shadow-md transition-all text-right group"
                          >
                              <div className="bg-white p-3 rounded-full border border-secondary-100 group-hover:border-primary-200 shadow-sm">
                                  <Building size={20} className="text-secondary-500 group-hover:text-primary-600"/>
                              </div>
                              <div>
                                  <div className="flex items-center gap-2">
                                      <h4 className="font-bold text-secondary-800 group-hover:text-primary-900 text-base">{acc.schools?.name || 'مدرسة غير معروفة'}</h4>
                                      {acc.role && acc.role !== UserRole.TEACHER && (
                                          <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold">{acc.role}</span>
                                      )}
                                  </div>
                                  <span className="text-xs text-secondary-500 group-hover:text-primary-700">التخصص: {acc.specialty}</span>
                              </div>
                              <ArrowRight size={18} className="mr-auto text-secondary-300 group-hover:text-primary-500"/>
                          </button>
                      ))}
                  </div>
                  <div className="p-4 bg-secondary-50 text-center border-t border-secondary-100">
                      <button onClick={() => setShowSchoolSelect(false)} className="text-secondary-500 hover:text-secondary-800 text-sm font-medium">إلغاء</button>
                  </div>
              </div>
          </div>
      )}

      <div className="max-w-md w-full space-y-8 z-10 relative">
        <div className="text-center space-y-6">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-3xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-2xl mb-2 rotate-3 hover:rotate-0 transition-transform duration-500">
            <span className="text-5xl font-extrabold tracking-tighter">أ</span>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-secondary-900 tracking-tight">نظام الأداء الوظيفي للمدارس</h1>
            <h2 className="text-4xl font-black text-primary-600 mt-1">"أدائي"</h2>
            <p className="text-lg text-secondary-500 mt-2 font-medium">
                منصة موحدة لإدارة الأداء المدرسي بكفاءة
            </p>
          </div>
        </div>

        <div className="bg-white rounded-3xl shadow-card border border-white/50 overflow-hidden backdrop-blur-xl">
          {/* Tabs Header */}
          <div className="flex border-b border-secondary-100 p-2 gap-2 bg-secondary-50/50">
              <button 
                  onClick={() => { setLoginType('admin'); setErrorMsg(''); }}
                  className={`flex-1 py-3 rounded-xl text-center font-bold text-sm transition-all flex items-center justify-center gap-2 ${loginType === 'admin' ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5' : 'text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100/50'}`}
              >
                  <Shield size={18} /> الإدارة والمشرفين
              </button>
              <button 
                  onClick={() => { setLoginType('teacher'); setErrorMsg(''); }}
                  className={`flex-1 py-3 rounded-xl text-center font-bold text-sm transition-all flex items-center justify-center gap-2 ${loginType === 'teacher' ? 'bg-white text-primary-700 shadow-sm ring-1 ring-black/5' : 'text-secondary-500 hover:text-secondary-700 hover:bg-secondary-100/50'}`}
              >
                  <GraduationCap size={18} /> دخول المعلمين
              </button>
          </div>

          <div className="p-8 flex flex-col justify-center animate-fade-in">
              {loginType === 'admin' ? (
                  <>
                    <h3 className="text-xl font-bold text-secondary-800 mb-6 flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-lg text-primary-600"><Mail size={22} /></div>
                        تسجيل دخول الإدارة
                    </h3>
                    <form onSubmit={handleEmailLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-secondary-700">البريد الإلكتروني</label>
                            <input 
                                type="email" 
                                required
                                className="w-full border border-secondary-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-secondary-50/30 text-secondary-900 placeholder:text-secondary-400"
                                placeholder="example@school.edu.sa"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-secondary-700">كلمة المرور</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border border-secondary-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-secondary-50/30 text-secondary-900 placeholder:text-secondary-400"
                                placeholder="********"
                                value={adminPassword}
                                onChange={(e) => setAdminPassword(e.target.value)}
                            />
                        </div>
                        
                        {errorMsg && <div className="text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle size={18}/> {errorMsg}</div>}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 hover:shadow-xl hover:-translate-y-0.5 flex justify-center items-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'تسجيل الدخول'}
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-secondary-100 text-center">
                        <button 
                            onClick={() => setIsRegistering(true)}
                            className="w-full mb-3 border border-secondary-200 text-secondary-700 bg-white py-3.5 rounded-xl font-bold hover:bg-secondary-50 hover:border-secondary-300 transition-all flex justify-center items-center gap-2"
                        >
                            <UserPlus size={18} /> تسجيل مدرسة جديدة
                        </button>
                    </div>
                  </>
              ) : (
                  <>
                    <h3 className="text-xl font-bold text-secondary-800 mb-6 flex items-center gap-3">
                        <div className="p-2 bg-primary-50 rounded-lg text-primary-600"><UserIcon size={22} /></div>
                        بوابة المعلمين
                    </h3>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 text-sm text-blue-800 flex gap-3">
                        <Info size={20} className="shrink-0 text-blue-600 mt-0.5" />
                        <div>
                            <strong>تعليمات الدخول:</strong> اسم المستخدم هو رقم الهوية الوطنية، وكلمة المرور الافتراضية هي آخر 4 أرقام من الهوية.
                        </div>
                    </div>
                    <form onSubmit={handleTeacherLogin} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-secondary-700">رقم الهوية الوطنية</label>
                            <input 
                                type="text" 
                                required
                                className="w-full border border-secondary-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-secondary-50/30 text-secondary-900 placeholder:text-secondary-400 font-mono text-left" 
                                dir="ltr"
                                placeholder="10xxxxxxxx"
                                value={nationalId}
                                onChange={(e) => setNationalId(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-sm font-bold text-secondary-700">كلمة المرور</label>
                            <input 
                                type="password" 
                                required
                                className="w-full border border-secondary-200 p-3.5 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all bg-secondary-50/30 text-secondary-900 placeholder:text-secondary-400 font-mono text-left"
                                dir="ltr"
                                placeholder="********"
                                value={teacherPassword}
                                onChange={(e) => setTeacherPassword(e.target.value)}
                            />
                        </div>
                        
                        {errorMsg && <div className="text-red-600 text-sm bg-red-50 p-4 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle size={18}/> {errorMsg}</div>}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-primary-600 text-white py-4 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-lg shadow-primary-200 hover:shadow-xl hover:-translate-y-0.5 flex justify-center items-center gap-2 disabled:opacity-70 disabled:hover:translate-y-0"
                        >
                            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'دخول المعلم'}
                        </button>
                    </form>
                  </>
              )}
          </div>
        </div>
        <div className="text-center text-xs text-secondary-400 font-medium">الإصدار 2.1.0 - جميع الحقوق محفوظة</div>
      </div>
    </div>
  );
}

// Helper icon for Info
function Info({ size, className }: { size?: number, className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
    )
}
