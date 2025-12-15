
import React, { useEffect, useState } from 'react';
import { School, Users, Upload, FileBarChart, ArrowRightLeft, MessageSquareWarning, CreditCard, Loader2, ShieldCheck, UserCheck, BookOpen, Star, AlertCircle, Calendar, Settings, UserCircle, Eye, ChevronLeft, CheckCircle2, RefreshCw, XCircle, Clock, Timer, Award, PlayCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserRole, SchoolEvent, EvaluationData } from '../types';

interface DashboardProps {
  userId?: string;
  userName: string;
  userRole: UserRole;
  schoolId?: string;
  nationalId?: string; // Added prop
  onNavigate: (tab: any) => void;
  onImportClick: () => void;
  onEvaluate?: (teacherId: string, evaluationId?: string) => void; // Updated signature
}

const QuickAccessCard = ({ icon, title, count, onClick, colorClass = "bg-white", description, gradient }: { icon: React.ReactNode, title: string, count?: number, onClick: () => void, colorClass?: string, description?: string, gradient?: string }) => (
  <button 
    onClick={onClick}
    className={`${colorClass} ${gradient ? gradient : 'bg-white'} p-5 md:p-6 rounded-2xl shadow-card border border-secondary-100 hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 flex flex-col items-start justify-between gap-4 group relative min-h-[160px] h-auto md:h-52 w-full text-right overflow-hidden touch-manipulation`}
  >
    {/* Background Pattern for decoration */}
    <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-x-10 -translate-y-10"></div>
    <div className="absolute bottom-0 right-0 w-24 h-24 bg-black/5 rounded-full blur-2xl translate-x-8 translate-y-8"></div>

    <div className="flex justify-between w-full items-start z-10">
        <div className={`p-3 md:p-4 rounded-xl transition-colors shadow-sm ${gradient ? 'bg-white/20 text-white backdrop-blur-sm' : 'bg-primary-50 text-primary-600'}`}>
            {icon}
        </div>
        {count !== undefined && (
            <span className={`text-2xl font-bold ${gradient ? 'text-white' : 'text-secondary-800'}`}>
                {count}
            </span>
        )}
    </div>
    
    <div className="z-10 w-full">
        <h3 className={`font-bold text-base md:text-lg mb-1 ${gradient ? 'text-white' : 'text-secondary-900'}`}>{title}</h3>
        {description && <p className={`text-xs md:text-sm ${gradient ? 'text-white/80' : 'text-secondary-500'}`}>{description}</p>}
        
        <div className={`mt-3 md:mt-4 flex items-center gap-1 text-xs md:text-sm font-medium ${gradient ? 'text-white/90' : 'text-primary-600'} opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity transform md:translate-y-2 group-hover:translate-y-0`}>
            <span>الذهاب</span> <ChevronLeft size={14} />
        </div>
    </div>
  </button>
);

export default function Dashboard({ userId, userName, userRole, schoolId, nationalId, onNavigate, onImportClick, onEvaluate }: DashboardProps) {
  const [stats, setStats] = useState({
    schools: 0,
    teachers: 0,
    evaluations: 0,
    completedEvals: 0,
    users: 0,
    subscriptions: 0,
    objections: 0
  });
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [pendingTeachers, setPendingTeachers] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<SchoolEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Teacher Specific State
  const [teacherProfile, setTeacherProfile] = useState<{
      specialty: string;
      schoolName: string;
  } | null>(null);
  const [latestEval, setLatestEval] = useState<any | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
        if (userRole === UserRole.TEACHER && userId) {
            // Fetch Teacher Details for dashboard
            const { data: teacherData, error } = await supabase
                .from('teachers')
                .select('specialty, schools(name)')
                .eq('id', userId)
                .single();
            
            if (error) throw error;

            if (teacherData) {
                const schoolsData: any = teacherData.schools;
                const schoolName = Array.isArray(schoolsData) 
                    ? schoolsData[0]?.name 
                    : schoolsData?.name;

                setTeacherProfile({
                    specialty: teacherData.specialty || 'غير محدد',
                    schoolName: schoolName || 'غير محدد'
                });
            }

            // Fetch Latest Evaluation
            const { data: evalData } = await supabase
                .from('evaluations')
                .select('*')
                .eq('teacher_id', userId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            
            if (evalData) setLatestEval(evalData);

        } else {
            // Normal Admin/Principal/Evaluator Stats
            
            // Schools count (Global for Admin)
            let schoolsCount = 0;
            if (userRole === UserRole.ADMIN) {
                const { count } = await supabase.from('schools').select('*', { count: 'exact', head: true });
                schoolsCount = count || 0;
            }

            // Determine Target School ID
            let targetSchoolId = schoolId;
            if (userRole === UserRole.PRINCIPAL) {
                if (!targetSchoolId && nationalId) {
                    // Try to resolve school ID via nationalId
                    const { data: schoolData } = await supabase.from('schools').select('id').eq('manager_national_id', nationalId).single();
                    if (schoolData) {
                        targetSchoolId = schoolData.id;
                    }
                }
            }

            // Teachers count
            let teachersQuery = supabase.from('teachers').select('*', { count: 'exact', head: true });
            if (userRole === UserRole.PRINCIPAL || userRole === UserRole.EVALUATOR) {
                if (targetSchoolId) {
                    teachersQuery = teachersQuery.eq('school_id', targetSchoolId);
                } else {
                    // Force 0 if no school identified
                    teachersQuery = teachersQuery.eq('id', '00000000-0000-0000-0000-000000000000');
                }
            }
            const { count: teachersCount } = await teachersQuery;

            // Evaluations count
            let evalsCount = 0;
            let completedCount = 0;
            let objectionsCount = 0;

            if (userRole === UserRole.PRINCIPAL || userRole === UserRole.EVALUATOR) {
                if (targetSchoolId) {
                    // Logic for Principal & Evaluator
                    const { data: schoolTeachers } = await supabase.from('teachers').select('id, name, specialty').eq('school_id', targetSchoolId);
                    const teacherIds = schoolTeachers?.map(t => t.id) || [];
                    
                    if (teacherIds.length > 0) {
                        const { count: ec } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('teacher_id', teacherIds);
                        const { data: evalsData, count: cc } = await supabase.from('evaluations').select('teacher_id, id, status', { count: 'exact' }).in('teacher_id', teacherIds);
                        // Count Pending Objections
                        const { count: oc } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('teacher_id', teacherIds).eq('objection_status', 'pending');
                        
                        evalsCount = ec || 0;
                        completedCount = evalsData?.filter(e => e.status === 'completed').length || 0;
                        objectionsCount = oc || 0;

                        // Fetch Recent Activity
                        const { data: recent } = await supabase
                            .from('evaluations')
                            .select('id, teacher_id, total_score, created_at, status, teachers(name)')
                            .in('teacher_id', teacherIds)
                            .order('created_at', { ascending: false })
                            .limit(3);
                        setRecentActivity(recent || []);

                        // Fetch Pending Teachers List Logic (With Draft Detection)
                        const completedTeacherIds = new Set(evalsData?.filter(e => e.status === 'completed').map(e => e.teacher_id));
                        const draftMap = new Map(evalsData?.filter(e => e.status === 'draft').map(e => [e.teacher_id, e.id]));

                        const pendingList = schoolTeachers
                            ?.filter(t => !completedTeacherIds.has(t.id))
                            .map(t => ({
                                ...t,
                                draftId: draftMap.get(t.id) || null
                            }))
                            .slice(0, 5) || [];
                            
                        setPendingTeachers(pendingList);

                        // Fetch Active Event
                        const { data: eventData } = await supabase
                            .from('school_events')
                            .select('*')
                            .eq('school_id', targetSchoolId)
                            .eq('status', 'active')
                            .gte('end_date', new Date().toISOString())
                            .order('end_date', { ascending: true })
                            .limit(1)
                            .single();
                        
                        if (eventData) setActiveEvent(eventData);

                    } else {
                        setRecentActivity([]);
                        setPendingTeachers([]);
                    }
                }
            } else if (userRole === UserRole.ADMIN) {
                const { count: ec } = await supabase.from('evaluations').select('*', { count: 'exact', head: true });
                const { count: cc } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('status', 'completed');
                const { count: oc } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).eq('objection_status', 'pending');
                evalsCount = ec || 0;
                completedCount = cc || 0;
                objectionsCount = oc || 0;
            }

            // New stats for Admin
            let usersCount = 0;
            let subsCount = 0;
            if (userRole === UserRole.ADMIN) {
                const { count: uc } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
                const { count: sc } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active');
                usersCount = uc || 0;
                subsCount = sc || 0;
            }

            setStats({
                schools: schoolsCount,
                teachers: teachersCount || 0,
                evaluations: evalsCount || 0,
                completedEvals: completedCount || 0,
                users: usersCount,
                subscriptions: subsCount,
                objections: objectionsCount || 0
            });
        }
    } catch (error: any) {
        console.error('Error fetching dashboard stats:', error.message || error);
        setError('تعذر تحميل البيانات. يرجى التحقق من الاتصال.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [userRole, schoolId, userId, nationalId]); 

  const getRoleBadge = () => {
      switch(userRole) {
          case UserRole.ADMIN: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">مدير النظام</span>;
          case UserRole.PRINCIPAL: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">مدير المدرسة</span>;
          case UserRole.EVALUATOR: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">المقيم</span>;
          case UserRole.TEACHER: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">المعلم</span>;
          default: return null;
      }
  };

  const getDaysRemaining = (endDate: string) => {
      const end = new Date(endDate);
      const now = new Date();
      const diffTime = Math.abs(end.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      return diffDays;
  };

  const renderContent = () => {
      if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                 <Loader2 className="animate-spin text-primary-600 mb-4" size={40} />
                 <p className="text-secondary-500 font-medium">جاري تحميل البيانات...</p>
            </div>
        );
      }

      if (error) {
          return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[300px] text-center">
                <XCircle className="text-red-500 mb-4" size={40} />
                <p className="text-secondary-700 font-bold mb-2">{error}</p>
                <button onClick={fetchStats} className="flex items-center gap-2 text-primary-600 hover:text-primary-800 bg-primary-50 px-4 py-2 rounded-lg transition-colors">
                    <RefreshCw size={16} /> إعادة المحاولة
                </button>
            </div>
          );
      }

      switch (userRole) {
          case UserRole.ADMIN:
              return (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <QuickAccessCard 
                            icon={<School size={28} />} 
                            title="إدارة المدارس" 
                            count={stats.schools}
                            description="إضافة وتعديل بيانات المدارس"
                            onClick={() => onNavigate('schools')} 
                        />
                        <QuickAccessCard 
                            icon={<Users size={28} />} 
                            title="إدارة المستخدمين" 
                            count={stats.users} 
                            description="إدارة الحسابات والصلاحيات"
                            onClick={() => onNavigate('settings')} 
                        />
                        <QuickAccessCard 
                            icon={<CreditCard size={28} />} 
                            title="الاشتراكات النشطة"
                            count={stats.subscriptions} 
                            description="متابعة وتجديد الباقات"
                            gradient="bg-gradient-to-br from-blue-600 to-blue-800"
                            onClick={() => onNavigate('settings')} 
                        />
                        <QuickAccessCard 
                            icon={<FileBarChart size={28} />} 
                            title="التقارير الشاملة" 
                            description="إحصائيات مستوى الوزارة"
                            gradient="bg-gradient-to-br from-purple-600 to-purple-800"
                            onClick={() => onNavigate('analytics')} 
                        />
                    </div>
                </div>
              );

          case UserRole.PRINCIPAL:
          case UserRole.EVALUATOR:
              return (
                <div className="space-y-8 animate-fade-in">
                    {/* Active Event Banner */}
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {activeEvent ? (
                            <div className="lg:col-span-4 bg-gradient-to-r from-emerald-600 to-emerald-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl"></div>
                                
                                <div className="flex items-center gap-4 z-10">
                                    <div className="p-3 bg-white/20 backdrop-blur-md rounded-xl">
                                        <Calendar size={32} className="text-white"/>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-xl mb-1">{activeEvent.name}</h3>
                                        <p className="text-emerald-100 text-sm flex items-center gap-2">
                                            <Timer size={14}/> ينتهي في: {new Date(activeEvent.end_date).toLocaleDateString('ar-SA')}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 z-10 w-full md:w-auto bg-white/10 p-3 rounded-xl border border-white/10">
                                    <div className="text-center px-4 border-l border-white/20">
                                        <span className="block text-2xl font-bold">{getDaysRemaining(activeEvent.end_date)}</span>
                                        <span className="text-xs text-emerald-100">يوم متبقي</span>
                                    </div>
                                    <button 
                                        onClick={() => onNavigate('events')}
                                        className="bg-white text-emerald-800 px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-colors"
                                    >
                                        تفاصيل الفترة
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="lg:col-span-4 bg-white p-6 rounded-2xl border border-dashed border-gray-300 flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3 text-gray-500">
                                    <Clock size={24} />
                                    <div>
                                        <h3 className="font-bold text-gray-700">لا توجد فترة تقييم نشطة</h3>
                                        <p className="text-sm">لا يوجد حالياً فترات تقييم فعالة في النظام.</p>
                                    </div>
                                </div>
                                {userRole === UserRole.PRINCIPAL && (
                                    <button onClick={() => onNavigate('events')} className="text-primary-600 font-bold text-sm hover:underline">إدارة الأحداث</button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <QuickAccessCard 
                            icon={<Users size={28} />} 
                            title="قائمة المعلمين" 
                            count={stats.teachers}
                            description={userRole === UserRole.PRINCIPAL ? "إدارة ومتابعة معلمي المدرسة" : "عرض قائمة المعلمين"}
                            onClick={() => onNavigate('teachers')} 
                        />
                        <QuickAccessCard 
                            icon={<Star size={28} />} 
                            title="التقييمات المنجزة" 
                            count={stats.completedEvals}
                            description="التقييمات التي تم اعتمادها"
                            onClick={() => onNavigate(userRole === UserRole.PRINCIPAL ? 'analytics' : 'teachers')} 
                        />
                        {userRole === UserRole.PRINCIPAL && (
                            <QuickAccessCard 
                                icon={<Upload size={28} />} 
                                title="استيراد البيانات" 
                                description="رفع بيانات المعلمين (Excel)"
                                onClick={onImportClick} 
                            />
                        )}
                        {userRole === UserRole.EVALUATOR && (
                            <QuickAccessCard 
                                icon={<BookOpen size={28} />} 
                                title="دليل المؤشرات" 
                                description="استعراض معايير التقييم"
                                onClick={() => onNavigate('indicators')} 
                            />
                        )}
                         <QuickAccessCard 
                            icon={<MessageSquareWarning size={28} />} 
                            title="الاعتراضات" 
                            count={stats.objections}
                            description="مراجعة تظلمات المعلمين"
                            onClick={() => onNavigate('objections')} 
                            gradient={stats.objections > 0 ? "bg-gradient-to-br from-red-500 to-red-700" : undefined}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Pending Evaluations List */}
                        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-secondary-100 shadow-card">
                            <h3 className="font-bold text-lg md:text-xl text-secondary-800 mb-6 flex items-center justify-between">
                                <span className="flex items-center gap-2"><Clock size={20} className="text-orange-500"/> بانتظار التقييم</span>
                                {pendingTeachers.length > 0 && <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">{pendingTeachers.length} معلم</span>}
                            </h3>
                            
                            {pendingTeachers.length > 0 ? (
                                <div className="space-y-3">
                                    {pendingTeachers.map((teacher, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white text-gray-500 flex items-center justify-center font-bold border border-gray-200">
                                                    {teacher.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800">{teacher.name}</p>
                                                    <p className="text-xs text-gray-500">{teacher.specialty}</p>
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => onEvaluate && onEvaluate(teacher.id, teacher.draftId)}
                                                className={`${teacher.draftId ? 'bg-primary-600 hover:bg-primary-700' : 'bg-secondary-800 hover:bg-secondary-900'} text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm flex items-center gap-2`}
                                            >
                                                {teacher.draftId ? (
                                                    <>
                                                        <PlayCircle size={14} />
                                                        استكمال
                                                    </>
                                                ) : (
                                                    'تقييم'
                                                )}
                                            </button>
                                        </div>
                                    ))}
                                    <button onClick={() => onNavigate('teachers')} className="w-full text-center text-sm text-primary-600 hover:text-primary-800 font-bold mt-2 pt-2 border-t border-gray-100">عرض الجميع</button>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <CheckCircle2 size={48} className="mx-auto mb-2 text-green-200"/>
                                    <p>رائع! تم تقييم جميع المعلمين.</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Activity Section */}
                        <div className="bg-white p-6 rounded-2xl border border-secondary-100 shadow-card">
                            <h3 className="font-bold text-lg text-secondary-800 mb-4 flex items-center gap-2">
                                <Calendar size={18} className="text-blue-500"/>
                                آخر العمليات
                            </h3>
                            {recentActivity.length > 0 ? (
                                <div className="space-y-4">
                                    {recentActivity.map((act) => (
                                        <div key={act.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                            <div className="mt-1">
                                                {act.status === 'completed' 
                                                    ? <CheckCircle2 size={16} className="text-green-500"/>
                                                    : <Loader2 size={16} className="text-yellow-500"/>
                                                }
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-800">
                                                    {(act.teachers as any)?.name || 'معلم غير معروف'}
                                                </p>
                                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                                    <span>{act.total_score}%</span>
                                                    <span>•</span>
                                                    <span>{new Date(act.created_at).toLocaleDateString('ar-SA')}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <button onClick={() => onNavigate('teachers')} className="text-xs text-primary-600 hover:text-primary-800 block text-center w-full mt-2 font-medium">
                                        عرض السجل الكامل
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    <p>لا توجد نشاطات حديثة</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
              );

          case UserRole.TEACHER:
              return (
                <div className="space-y-8 animate-fade-in">
                    <div className="bg-white p-6 md:p-10 rounded-3xl border border-secondary-100 text-center shadow-card max-w-3xl mx-auto relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary-400 to-primary-600"></div>
                        <div className="w-20 h-20 md:w-28 md:h-28 bg-secondary-50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-secondary-400 border-4 border-white shadow-lg">
                             <UserCheck size={40} className="md:w-14 md:h-14" />
                        </div>
                        <h3 className="text-2xl md:text-3xl font-bold text-secondary-800 mb-2">أهلاً بك، {userName}</h3>
                        <div className="flex flex-col sm:flex-row justify-center gap-2 md:gap-3 mb-8 md:mb-10">
                            <span className="bg-blue-50 text-blue-700 px-4 py-1.5 rounded-full text-xs md:text-sm font-medium border border-blue-100">
                                {teacherProfile?.specialty || 'جاري التحميل...'}
                            </span>
                            <span className="bg-secondary-50 text-secondary-600 px-4 py-1.5 rounded-full text-xs md:text-sm font-medium border border-secondary-200">
                                {teacherProfile?.schoolName || 'جاري التحميل...'}
                            </span>
                        </div>
                        
                        {/* Latest Evaluation Status Card */}
                        {latestEval && (
                            <div className="mb-8 mx-auto max-w-xl">
                                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden text-right">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-lg flex items-center gap-2">
                                            <Award className="text-yellow-400"/> حالة الأداء الحالي
                                        </h4>
                                        <span className={`text-xs px-2 py-1 rounded font-bold ${latestEval.status === 'completed' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}`}>
                                            {latestEval.status === 'completed' ? 'معتمد' : 'مسودة'}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-6">
                                        <div className="w-20 h-20 rounded-full border-4 border-white/20 flex items-center justify-center text-2xl font-bold bg-white/10 backdrop-blur-md">
                                            {latestEval.total_score}%
                                        </div>
                                        <div>
                                            <p className="text-gray-300 text-sm mb-1">{latestEval.period_name}</p>
                                            {latestEval.objection_status && latestEval.objection_status !== 'none' && (
                                                <div className="flex items-center gap-2 mt-2 text-xs bg-red-500/20 px-2 py-1 rounded text-red-200 w-fit">
                                                    <MessageSquareWarning size={12}/>
                                                    حالة الاعتراض: {latestEval.objection_status === 'pending' ? 'قيد المراجعة' : (latestEval.objection_status === 'accepted' ? 'مقبول' : 'مرفوض')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 text-right">
                            <div 
                                onClick={() => onNavigate('teacher_evaluation')}
                                className="border border-secondary-200 p-5 md:p-6 rounded-2xl hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-md transition-all cursor-pointer group bg-secondary-50/30 active:scale-[0.98] touch-manipulation"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:text-primary-600 transition-colors">
                                        <FileBarChart size={24} />
                                    </div>
                                    <span className="text-[10px] md:text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-medium">اضغط للعرض</span>
                                </div>
                                <h4 className="font-bold text-base md:text-lg text-secondary-800 group-hover:text-primary-800 mb-1">بطاقة الأداء الوظيفي</h4>
                                <p className="text-xs md:text-sm text-secondary-500 leading-relaxed">عرض التقييم، إرفاق الشواهد، وتقديم الاعتراضات</p>
                            </div>
                            
                            <div 
                                onClick={() => onNavigate('teacher_profile')}
                                className="border border-secondary-200 p-5 md:p-6 rounded-2xl hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-md transition-all cursor-pointer group bg-secondary-50/30 active:scale-[0.98] touch-manipulation"
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:text-blue-600 transition-colors">
                                        <UserCircle size={24} />
                                    </div>
                                    <span className="text-[10px] md:text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded font-medium">تعديل</span>
                                </div>
                                <h4 className="font-bold text-base md:text-lg text-secondary-800 group-hover:text-blue-800 mb-1">الملف الشخصي</h4>
                                <p className="text-xs md:text-sm text-secondary-500 leading-relaxed">تحديث البيانات الشخصية وكلمة المرور</p>
                            </div>
                        </div>
                    </div>
                </div>
              );

          default:
              return <div>User role not recognized</div>;
      }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-secondary-900 via-secondary-800 to-secondary-900 rounded-3xl p-6 md:p-10 text-white shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-3xl md:text-4xl font-bold shadow-inner border border-white/10">
                        {userName.charAt(0)}
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-4xl font-bold mb-2 md:mb-3 tracking-tight">مرحباً، {userName}</h1>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3 text-secondary-300">
                            {getRoleBadge()}
                            <span className="text-xs md:text-sm border-r border-white/20 pr-3 mr-1 md:mr-3 font-medium">
                                {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                        </div>
                    </div>
                </div>
                
                <button 
                    onClick={fetchStats} 
                    className="p-3 bg-white/10 hover:bg-white/20 rounded-xl backdrop-blur-md transition-colors border border-white/10 group"
                    title="تحديث البيانات"
                >
                    <RefreshCw size={20} className="group-hover:rotate-180 transition-transform duration-500"/>
                </button>
            </div>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute -left-10 -top-10 h-48 w-48 md:h-64 md:w-64 bg-primary-500/20 rounded-full blur-[60px] md:blur-[80px]"></div>
        <div className="absolute right-0 bottom-0 h-64 w-64 md:h-96 md:w-96 bg-blue-500/10 rounded-full blur-[80px] md:blur-[100px] transform translate-x-20 translate-y-20"></div>
        <div className="absolute top-0 right-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5"></div>
      </div>

      <div className="px-1 md:px-2">
        <h2 className="text-xl md:text-2xl font-bold text-secondary-800 mb-6 md:mb-8 flex items-center gap-3">
            <div className="p-2 bg-primary-100 text-primary-700 rounded-lg">
                {userRole === UserRole.TEACHER ? <UserCheck size={20} className="md:w-6 md:h-6"/> : <ArrowRightLeft size={20} className="md:w-6 md:h-6"/>}
            </div>
            {userRole === UserRole.TEACHER ? 'خدماتي' : 'لوحة التحكم والوصول السريع'}
        </h2>
        {renderContent()}
      </div>
    </div>
  );
}
