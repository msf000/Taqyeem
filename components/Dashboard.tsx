
import React, { useEffect, useState } from 'react';
import { School, Users, Upload, FileBarChart, ArrowRightLeft, MessageSquareWarning, CreditCard, Loader2, ShieldCheck, UserCheck, BookOpen, Star, AlertCircle, Calendar, Settings, UserCircle, Eye } from 'lucide-react';
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

const QuickAccessCard = ({ icon, title, count, onClick, colorClass = "bg-white", description }: { icon: React.ReactNode, title: string, count?: number, onClick: () => void, colorClass?: string, description?: string }) => (
  <button 
    onClick={onClick}
    className={`${colorClass} p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 group relative h-48 w-full text-center`}
  >
    {count !== undefined && (
        <span className={`absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full ${colorClass === 'bg-white' ? 'bg-primary-100 text-primary-800' : 'bg-white/20 text-white'}`}>
            {count}
        </span>
    )}
    <div className={`p-4 rounded-full transition-colors ${colorClass === 'bg-white' ? 'bg-gray-50 group-hover:bg-primary-50 text-primary-600' : 'bg-white/20 text-white'}`}>
      {icon}
    </div>
    <div>
        <h3 className={`font-bold text-lg group-hover:opacity-90 ${colorClass === 'bg-white' ? 'text-gray-800' : 'text-white'}`}>{title}</h3>
        {description && <p className={`text-xs mt-2 ${colorClass === 'bg-white' ? 'text-gray-500' : 'text-blue-100'}`}>{description}</p>}
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
          case UserRole.ADMIN: return <span className="bg-purple-600 text-white text-sm px-3 py-1 rounded-full font-medium shadow-sm">مدير النظام</span>;
          case UserRole.PRINCIPAL: return <span className="bg-primary-600 text-white text-sm px-3 py-1 rounded-full font-medium shadow-sm">مدير المدرسة</span>;
          case UserRole.EVALUATOR: return <span className="bg-orange-500 text-white text-sm px-3 py-1 rounded-full font-medium shadow-sm">المقيم</span>;
          case UserRole.TEACHER: return <span className="bg-blue-500 text-white text-sm px-3 py-1 rounded-full font-medium shadow-sm">المعلم</span>;
          default: return null;
      }
  };

  const renderContent = () => {
      if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 min-h-[300px]">
                 <Loader2 className="animate-spin text-primary-600 mb-4" size={40} />
                 <p className="text-gray-500">جاري تحميل البيانات...</p>
            </div>
        );
      }

      switch (userRole) {
          case UserRole.ADMIN:
              return (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <QuickAccessCard 
                            icon={<School size={32} />} 
                            title="إدارة المدارس" 
                            count={stats.schools}
                            description="إضافة وتعديل بيانات المدارس"
                            onClick={() => onNavigate('schools')} 
                        />
                        <QuickAccessCard 
                            icon={<Users size={32} />} 
                            title="إدارة المستخدمين" 
                            count={stats.users} 
                            description="إدارة الحسابات والصلاحيات"
                            onClick={() => onNavigate('settings')} 
                        />
                        <QuickAccessCard 
                            icon={<CreditCard size={32} />} 
                            title="الاشتراكات النشطة"
                            count={stats.subscriptions} 
                            description="متابعة وتجديد الباقات"
                            colorClass="bg-blue-600 text-white"
                            onClick={() => onNavigate('settings')} 
                        />
                        <QuickAccessCard 
                            icon={<FileBarChart size={32} />} 
                            title="التقارير الشاملة" 
                            description="إحصائيات مستوى الوزارة"
                            colorClass="bg-purple-700 text-white"
                            onClick={() => onNavigate('analytics')} 
                        />
                    </div>
                </div>
              );

          case UserRole.PRINCIPAL:
              return (
                <div className="space-y-8 animate-fade-in">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <QuickAccessCard 
                            icon={<Users size={32} />} 
                            title="قائمة المعلمين" 
                            count={stats.teachers}
                            description="إدارة ومتابعة معلمي المدرسة"
                            onClick={() => onNavigate('teachers')} 
                        />
                        <QuickAccessCard 
                            icon={<Star size={32} />} 
                            title="التقييمات المنجزة" 
                            count={stats.completedEvals}
                            description="عرض نتائج الأداء الوظيفي"
                            onClick={() => onNavigate('analytics')} 
                        />
                        <QuickAccessCard 
                            icon={<Upload size={32} />} 
                            title="استيراد البيانات" 
                            description="رفع بيانات المعلمين (Excel)"
                            onClick={onImportClick} 
                        />
                         <QuickAccessCard 
                            icon={<MessageSquareWarning size={32} />} 
                            title="الاعتراضات" 
                            count={stats.objections}
                            description="مراجعة تظلمات المعلمين"
                            onClick={() => onNavigate('objections')} 
                            colorClass={stats.objections > 0 ? "bg-red-50 border-red-200" : "bg-white"}
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-800 mb-4">حالة التقييم في المدرسة</h3>
                            <div className="flex items-center gap-4">
                                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                    <div 
                                        className="bg-green-500 h-full transition-all duration-1000" 
                                        style={{ width: `${stats.teachers > 0 ? (stats.completedEvals / stats.teachers) * 100 : 0}%` }}
                                    ></div>
                                </div>
                                <span className="font-bold text-gray-700">
                                    {stats.teachers > 0 ? Math.round((stats.completedEvals / stats.teachers) * 100) : 0}%
                                </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">
                                تم تقييم {stats.completedEvals} من أصل {stats.teachers} معلم
                            </p>
                        </div>
                    </div>
                </div>
              );

          case UserRole.EVALUATOR:
              return (
                <div className="space-y-8 animate-fade-in">
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <QuickAccessCard 
                            icon={<UserCheck size={32} />} 
                            title="المعلمين المسندين" 
                            count={stats.teachers}
                            description="المعلمين المطلوب تقييمهم"
                            onClick={() => onNavigate('teachers')}
                            colorClass="bg-orange-600 text-white"
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
                    <div className="bg-white p-8 rounded-xl border border-gray-200 text-center shadow-sm max-w-3xl mx-auto">
                        <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 border-4 border-white shadow-lg">
                             <UserCheck size={48} />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">أهلاً بك، {userName}</h3>
                        <div className="flex justify-center gap-2 mb-8">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                                {teacherProfile?.specialty || 'جاري التحميل...'}
                            </span>
                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm">
                                {teacherProfile?.schoolName || 'جاري التحميل...'}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                            <div 
                                onClick={() => onNavigate('teacher_evaluation')}
                                className="border border-gray-200 p-5 rounded-xl hover:border-primary-300 hover:bg-primary-50 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <FileBarChart className="text-gray-400 group-hover:text-primary-600" />
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">اضغط للعرض</span>
                                </div>
                                <h4 className="font-bold text-gray-800 group-hover:text-primary-800">بطاقة الأداء الوظيفي</h4>
                                <p className="text-sm text-gray-500 mt-1">عرض التقييم، إرفاق الشواهد، وتقديم الاعتراضات</p>
                            </div>
                            
                            <div 
                                onClick={() => onNavigate('teacher_profile')}
                                className="border border-gray-200 p-5 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all cursor-pointer group"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <UserCircle className="text-gray-400 group-hover:text-blue-600" />
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">تعديل</span>
                                </div>
                                <h4 className="font-bold text-gray-800 group-hover:text-blue-800">الملف الشخصي</h4>
                                <p className="text-sm text-gray-500 mt-1">تحديث البيانات الشخصية وكلمة المرور</p>
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
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl font-bold shadow-inner">
                    {userName.charAt(0)}
                </div>
                <div>
                    <h1 className="text-3xl font-bold mb-2">مرحباً، {userName}</h1>
                    <div className="flex items-center gap-2 text-gray-300">
                        {getRoleBadge()}
                        <span className="text-sm border-r border-gray-600 pr-2 mr-2">
                            {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </div>
        </div>
        
        {/* Decorative Background Elements */}
        <div className="absolute left-0 top-0 h-full w-1/3 bg-white/5 skew-x-12 transform -translate-x-20"></div>
        <div className="absolute right-0 bottom-0 h-64 w-64 bg-primary-500/10 rounded-full blur-3xl transform translate-x-10 translate-y-10"></div>
      </div>

      <div className="px-1">
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            {userRole === UserRole.TEACHER ? <UserCheck className="text-primary-600"/> : <ArrowRightLeft className="text-primary-600"/>}
            {userRole === UserRole.TEACHER ? 'خدماتي' : 'لوحة التحكم والوصول السريع'}
        </h2>
        {renderContent()}
      </div>
    </div>
  );
}
