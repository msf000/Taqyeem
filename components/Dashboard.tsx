
import React, { useEffect, useState } from 'react';
import { School, Users, Upload, FileBarChart, ArrowRightLeft, MessageSquareWarning, CreditCard, Loader2, ShieldCheck, UserCheck, BookOpen, Star, AlertCircle, Calendar, Settings, UserCircle, Eye, ChevronLeft, CheckCircle2 } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserRole } from '../types';

interface DashboardProps {
  userId?: string;
  userName: string;
  userRole: UserRole;
  schoolId?: string;
  onNavigate: (tab: any) => void;
  onImportClick: () => void;
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

export default function Dashboard({ userId, userName, userRole, schoolId, onNavigate, onImportClick }: DashboardProps) {
  const [stats, setStats] = useState({
    schools: 0,
    teachers: 0,
    evaluations: 0,
    completedEvals: 0,
    users: 0,
    subscriptions: 0,
    objections: 0
  });
  const [loading, setLoading] = useState(true);
  
  // Teacher Specific State
  const [teacherProfile, setTeacherProfile] = useState<{
      specialty: string;
      schoolName: string;
  } | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
        try {
            if (userRole === UserRole.TEACHER && userId) {
                // Fetch Teacher Details for dashboard
                const { data: teacherData } = await supabase
                    .from('teachers')
                    .select('specialty, schools(name)')
                    .eq('id', userId)
                    .single();
                
                if (teacherData) {
                    const schoolsData: any = teacherData.schools;
                    // Handle case where relation returns array or object
                    const schoolName = Array.isArray(schoolsData) 
                        ? schoolsData[0]?.name 
                        : schoolsData?.name;

                    setTeacherProfile({
                        specialty: teacherData.specialty || 'غير محدد',
                        schoolName: schoolName || 'غير محدد'
                    });
                }
            } else {
                // Normal Admin/Principal Stats
                
                // Schools count
                const { count: schoolsCount } = await supabase.from('schools').select('*', { count: 'exact', head: true });

                // Teachers count
                let teachersQuery = supabase.from('teachers').select('*', { count: 'exact', head: true });
                if (userRole === UserRole.PRINCIPAL && schoolId) {
                    teachersQuery = teachersQuery.eq('school_id', schoolId);
                }
                const { count: teachersCount } = await teachersQuery;

                // Evaluations count
                let evalsCount = 0;
                let completedCount = 0;
                let objectionsCount = 0;

                if (userRole === UserRole.PRINCIPAL && schoolId) {
                    // Logic for Principal
                    const { data: schoolTeachers } = await supabase.from('teachers').select('id').eq('school_id', schoolId);
                    const teacherIds = schoolTeachers?.map(t => t.id) || [];
                    
                    if (teacherIds.length > 0) {
                        const { count: ec } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('teacher_id', teacherIds);
                        const { count: cc } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('teacher_id', teacherIds).eq('status', 'completed');
                        // Count Pending Objections
                        const { count: oc } = await supabase.from('evaluations').select('*', { count: 'exact', head: true }).in('teacher_id', teacherIds).eq('objection_status', 'pending');
                        
                        evalsCount = ec || 0;
                        completedCount = cc || 0;
                        objectionsCount = oc || 0;
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
                const { count: usersCount } = await supabase.from('app_users').select('*', { count: 'exact', head: true });
                const { count: subsCount } = await supabase.from('subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active');

                setStats({
                    schools: schoolsCount || 0,
                    teachers: teachersCount || 0,
                    evaluations: evalsCount || 0,
                    completedEvals: completedCount || 0,
                    users: usersCount || 0,
                    subscriptions: subsCount || 0,
                    objections: objectionsCount || 0
                });
            }
        } catch (error: any) {
            console.error('Error fetching dashboard stats:', error.message || error);
        } finally {
            setLoading(false);
        }
    };
    fetchStats();
  }, [userRole, schoolId, userId]);

  const getRoleBadge = () => {
      switch(userRole) {
          case UserRole.ADMIN: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">مدير النظام</span>;
          case UserRole.PRINCIPAL: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">مدير المدرسة</span>;
          case UserRole.EVALUATOR: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">المقيم</span>;
          case UserRole.TEACHER: return <span className="bg-white/20 backdrop-blur-sm text-white text-xs md:text-sm px-2 md:px-3 py-1 rounded-full font-medium shadow-sm border border-white/10">المعلم</span>;
          default: return null;
      }
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
              return (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <QuickAccessCard 
                            icon={<Users size={28} />} 
                            title="قائمة المعلمين" 
                            count={stats.teachers}
                            description="إدارة ومتابعة معلمي المدرسة"
                            onClick={() => onNavigate('teachers')} 
                        />
                        <QuickAccessCard 
                            icon={<Star size={28} />} 
                            title="التقييمات المنجزة" 
                            count={stats.completedEvals}
                            description="عرض نتائج الأداء الوظيفي"
                            onClick={() => onNavigate('analytics')} 
                        />
                        <QuickAccessCard 
                            icon={<Upload size={28} />} 
                            title="استيراد البيانات" 
                            description="رفع بيانات المعلمين (Excel)"
                            onClick={onImportClick} 
                        />
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
                        <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-2xl border border-secondary-100 shadow-card">
                            <h3 className="font-bold text-lg md:text-xl text-secondary-800 mb-6">حالة التقييم في المدرسة</h3>
                            <div className="flex items-center gap-4 md:gap-6">
                                <div className="flex-1 bg-secondary-100 rounded-full h-4 md:h-5 overflow-hidden shadow-inner">
                                    <div 
                                        className="bg-gradient-to-r from-green-400 to-green-600 h-full transition-all duration-1000 rounded-full" 
                                        style={{ width: `${stats.teachers > 0 ? (stats.completedEvals / stats.teachers) * 100 : 0}%` }}
                                    ></div>
                                </div>
                                <span className="font-bold text-xl md:text-2xl text-secondary-700">
                                    {stats.teachers > 0 ? Math.round((stats.completedEvals / stats.teachers) * 100) : 0}%
                                </span>
                            </div>
                            <p className="text-sm text-secondary-500 mt-4 flex items-center gap-2">
                                <CheckCircle2 size={16} className="text-green-500"/>
                                تم تقييم <strong className="text-secondary-800">{stats.completedEvals}</strong> من أصل <strong className="text-secondary-800">{stats.teachers}</strong> معلم
                            </p>
                        </div>
                    </div>
                </div>
              );

          case UserRole.EVALUATOR:
              return (
                <div className="space-y-8 animate-fade-in">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                        <QuickAccessCard 
                            icon={<UserCheck size={32} />} 
                            title="المعلمين المسندين" 
                            count={stats.teachers}
                            description="المعلمين المطلوب تقييمهم"
                            onClick={() => onNavigate('teachers')}
                            gradient="bg-gradient-to-br from-orange-500 to-orange-700"
                        />
                        <QuickAccessCard 
                            icon={<Star size={32} />} 
                            title="تقييمات مكتملة" 
                            count={stats.completedEvals}
                            description="التقييمات التي تم اعتمادها"
                            onClick={() => onNavigate('teachers')} 
                        />
                         <QuickAccessCard 
                            icon={<BookOpen size={32} />} 
                            title="دليل المؤشرات" 
                            description="استعراض معايير التقييم"
                            onClick={() => {}} 
                        />
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
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 mb-2 md:mb-6">
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
