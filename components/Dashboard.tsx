
import React, { useEffect, useState } from 'react';
import { School, Users, Upload, Layout, FileBarChart, ArrowRightLeft, MessageSquareWarning, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface DashboardProps {
  userName: string;
  onNavigate: (tab: any) => void;
  onImportClick: () => void;
}

const QuickAccessCard = ({ icon, title, count, onClick, colorClass = "bg-white" }: { icon: React.ReactNode, title: string, count?: number, onClick: () => void, colorClass?: string }) => (
  <button 
    onClick={onClick}
    className={`${colorClass} p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 group relative`}
  >
    {count !== undefined && (
        <span className="absolute top-4 left-4 bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded-full">
            {count}
        </span>
    )}
    <div className="p-3 rounded-full bg-gray-50 group-hover:bg-primary-50 text-primary-600 transition-colors">
      {icon}
    </div>
    <span className="font-semibold text-gray-700 group-hover:text-primary-700">{title}</span>
  </button>
);

export default function Dashboard({ userName, onNavigate, onImportClick }: DashboardProps) {
  const [stats, setStats] = useState({
    schools: 0,
    teachers: 0,
    evaluations: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
        try {
            const { count: schoolsCount, error: err1 } = await supabase.from('schools').select('*', { count: 'exact', head: true });
            if (err1 && err1.code !== '42P01') console.error('Error fetching schools:', err1.message);

            const { count: teachersCount, error: err2 } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
            if (err2 && err2.code !== '42P01') console.error('Error fetching teachers:', err2.message);

            const { count: evalsCount, error: err3 } = await supabase.from('evaluations').select('*', { count: 'exact', head: true });
            if (err3 && err3.code !== '42P01') console.error('Error fetching evaluations:', err3.message);

            setStats({
                schools: schoolsCount || 0,
                teachers: teachersCount || 0,
                evaluations: evalsCount || 0
            });
        } catch (error: any) {
            console.error('Error fetching dashboard stats:', error.message || error);
        } finally {
            setLoading(false);
        }
    };
    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-l from-primary-600 to-primary-800 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">مرحباً، {userName}</h1>
        <p className="text-primary-100 opacity-90">لوحة تحكم مدير المدرسة - نظرة عامة على الأداء والمهام</p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">الوصول السريع</h2>
        {loading ? (
            <div className="flex justify-center p-12">
                 <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
        ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickAccessCard 
                icon={<School size={32} />} 
                title="المدارس" 
                count={stats.schools}
                onClick={() => onNavigate('schools')} 
            />
            <QuickAccessCard 
                icon={<Users size={32} />} 
                title="المعلمين" 
                count={stats.teachers}
                onClick={() => onNavigate('teachers')} 
            />
            <QuickAccessCard 
                icon={<Upload size={32} />} 
                title="استيراد المعلمين" 
                onClick={onImportClick} 
            />
            <QuickAccessCard 
                icon={<CreditCard size={32} />} 
                title="اشتراكاتي" 
                onClick={() => {}} 
            />
            <QuickAccessCard 
                icon={<FileBarChart size={32} />} 
                title="التحليلات والإحصائيات" 
                count={stats.evaluations > 0 ? stats.evaluations : undefined}
                onClick={() => onNavigate('analytics')} 
            />
            <QuickAccessCard 
                icon={<ArrowRightLeft size={32} />} 
                title="طلبات النقل" 
                onClick={() => {}} 
            />
            <QuickAccessCard 
                icon={<MessageSquareWarning size={32} />} 
                title="اعتراضات المعلمين" 
                onClick={() => {}} 
            />
            </div>
        )}
      </div>
    </div>
  );
}
