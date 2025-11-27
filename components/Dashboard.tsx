import React from 'react';
import { School, Users, Upload, Layout, FileBarChart, ArrowRightLeft, MessageSquareWarning, CreditCard } from 'lucide-react';

interface DashboardProps {
  userName: string;
  onNavigate: (tab: any) => void;
  onImportClick: () => void;
}

const QuickAccessCard = ({ icon, title, onClick, colorClass = "bg-white" }: { icon: React.ReactNode, title: string, onClick: () => void, colorClass?: string }) => (
  <button 
    onClick={onClick}
    className={`${colorClass} p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all flex flex-col items-center justify-center gap-4 group`}
  >
    <div className="p-3 rounded-full bg-gray-50 group-hover:bg-primary-50 text-primary-600 transition-colors">
      {icon}
    </div>
    <span className="font-semibold text-gray-700 group-hover:text-primary-700">{title}</span>
  </button>
);

export default function Dashboard({ userName, onNavigate, onImportClick }: DashboardProps) {
  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-l from-primary-600 to-primary-800 rounded-2xl p-8 text-white shadow-lg">
        <h1 className="text-3xl font-bold mb-2">مرحباً، {userName}</h1>
        <p className="text-primary-100 opacity-90">لوحة تحكم مدير المدرسة - نظرة عامة على الأداء والمهام</p>
      </div>

      <div>
        <h2 className="text-xl font-bold text-gray-800 mb-4">الوصول السريع</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <QuickAccessCard 
            icon={<School size={32} />} 
            title="المدارس" 
            onClick={() => onNavigate('schools')} 
          />
          <QuickAccessCard 
            icon={<Users size={32} />} 
            title="المعلمين" 
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
      </div>
    </div>
  );
}