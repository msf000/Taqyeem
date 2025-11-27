
import React, { useState } from 'react';
import { LayoutDashboard, School, Users, BarChart3, Settings, Import, FileText, AlertCircle, LogOut, Truck } from 'lucide-react';
import { UserRole, User } from './types';
import Dashboard from './components/Dashboard';
import SchoolManagement from './components/SchoolManagement';
import TeacherManagement from './components/TeacherManagement';
import Analytics from './components/Analytics';
import EvaluationFlow from './components/EvaluationFlow';
import LoginScreen from './components/LoginScreen';

enum Tab {
  DASHBOARD = 'dashboard',
  SCHOOLS = 'schools',
  TEACHERS = 'teachers',
  ANALYTICS = 'analytics'
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  const [currentView, setCurrentView] = useState<string>('main'); // 'main', 'import_results', 'evaluate', 'print'
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);

  const handleLogin = (role: UserRole) => {
    // Simulate user data based on role
    let userData: User = {
      id: '1',
      name: 'مستخدم',
      role: role
    };

    switch (role) {
      case UserRole.ADMIN:
        userData.name = 'مدير النظام';
        break;
      case UserRole.PRINCIPAL:
        userData.name = 'أحمد العتيبي';
        break;
      case UserRole.TEACHER:
        userData.name = 'سعيد الشهراني';
        break;
      case UserRole.EVALUATOR:
        userData.name = 'خالد المشرف';
        break;
    }

    setCurrentUser(userData);
    setActiveTab(Tab.DASHBOARD);
    setCurrentView('main');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTeacherId(null);
    setActiveTab(Tab.DASHBOARD);
  };

  const navigateToEvaluate = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setCurrentView('evaluate');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
    setSelectedTeacherId(null);
  };

  const renderContent = () => {
    if (currentView === 'evaluate' && selectedTeacherId) {
      return <EvaluationFlow teacherId={selectedTeacherId} onBack={handleBackToMain} />;
    }

    switch (activeTab) {
      case Tab.DASHBOARD:
        return <Dashboard 
          userName={currentUser?.name || ''} 
          onNavigate={(tab) => setActiveTab(tab)} 
          onImportClick={() => { setActiveTab(Tab.TEACHERS); }}
        />;
      case Tab.SCHOOLS:
        return <SchoolManagement />;
      case Tab.TEACHERS:
        return <TeacherManagement onEvaluate={navigateToEvaluate} />;
      case Tab.ANALYTICS:
        return <Analytics />;
      default:
        return <Dashboard userName={currentUser?.name || ''} onNavigate={(tab) => setActiveTab(tab)} onImportClick={() => {}} />;
    }
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-right font-sans" dir="rtl">
      {/* Top Header / Navigation */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab(Tab.DASHBOARD)}>
                <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">
                  ت
                </div>
                <span className="text-xl font-bold text-gray-800">نظام تقييم</span>
              </div>
              
              <nav className="hidden md:flex space-x-reverse space-x-4">
                <NavButton 
                  active={activeTab === Tab.DASHBOARD} 
                  onClick={() => setActiveTab(Tab.DASHBOARD)} 
                  icon={<LayoutDashboard size={18} />} 
                  label="لوحة التحكم" 
                />
                <NavButton 
                  active={activeTab === Tab.SCHOOLS} 
                  onClick={() => setActiveTab(Tab.SCHOOLS)} 
                  icon={<School size={18} />} 
                  label="إدارة المدارس" 
                />
                <NavButton 
                  active={activeTab === Tab.TEACHERS} 
                  onClick={() => setActiveTab(Tab.TEACHERS)} 
                  icon={<Users size={18} />} 
                  label="إدارة المعلمين" 
                />
                <NavButton 
                  active={activeTab === Tab.ANALYTICS} 
                  onClick={() => setActiveTab(Tab.ANALYTICS)} 
                  icon={<BarChart3 size={18} />} 
                  label="التحليلات" 
                />
              </nav>
            </div>

            <div className="flex items-center gap-4">
               <div className="flex flex-col items-end mr-2">
                  <div className="text-sm font-bold text-gray-900">{currentUser.name}</div>
                  <div className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{currentUser.role}</div>
               </div>
               <div className="h-9 w-9 rounded-full bg-primary-100 border border-primary-200 flex items-center justify-center text-primary-700 font-bold">
                  {currentUser.name[0]}
               </div>
               <div className="h-6 w-px bg-gray-200 mx-2"></div>
               <button 
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50" 
                title="تسجيل الخروج"
               >
                 <LogOut size={20} />
               </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderContent()}
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
        active 
          ? 'bg-primary-50 text-primary-700' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
