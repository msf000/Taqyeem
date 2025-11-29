
import React, { useState, useEffect } from 'react';
import { LayoutDashboard, School, Users, BarChart3, Settings, Import, FileText, AlertCircle, LogOut, Truck, AlignLeft, Calendar, MessageSquareWarning } from 'lucide-react';
import { UserRole, User } from './types';
import Dashboard from './components/Dashboard';
import SchoolManagement from './components/SchoolManagement';
import TeacherManagement from './components/TeacherManagement';
import Analytics from './components/Analytics';
import EvaluationFlow from './components/EvaluationFlow';
import IndicatorsManagement from './components/IndicatorsManagement';
import LoginScreen from './components/LoginScreen';
import SystemSettings from './components/SystemSettings';
import TeacherEvaluationDetails from './components/TeacherEvaluationDetails';
import TeacherProfile from './components/TeacherProfile';
import EventsManagement from './components/EventsManagement';
import TeacherEvaluationHistory from './components/TeacherEvaluationHistory';
import ObjectionsManagement from './components/ObjectionsManagement';

enum Tab {
  DASHBOARD = 'dashboard',
  SCHOOLS = 'schools',
  TEACHERS = 'teachers',
  ANALYTICS = 'analytics',
  INDICATORS = 'indicators',
  SETTINGS = 'settings',
  EVENTS = 'events',
  OBJECTIONS = 'objections', // Added
  // Teacher Specific Tabs
  TEACHER_EVALUATION = 'teacher_evaluation',
  TEACHER_PROFILE = 'teacher_profile'
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  
  // View State (Handling "Sub-routes" within the main structure)
  const [currentView, setCurrentView] = useState<string>('main'); // 'main', 'history', 'evaluate'
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | undefined>(undefined);

  // Restore session on load
  useEffect(() => {
      const savedUser = localStorage.getItem('nizam_user');
      if (savedUser) {
          try {
              setCurrentUser(JSON.parse(savedUser));
          } catch (e) {
              localStorage.removeItem('nizam_user');
          }
      }
  }, []);

  const handleLogin = (userOrRole: UserRole | User) => {
    let userData: User;

    // Case 1: Real User Login (Object)
    if (typeof userOrRole === 'object') {
        userData = userOrRole;
    } else {
        // Case 2: Demo Role Login (String)
        const role = userOrRole;
        userData = {
            id: '1',
            name: 'مستخدم تجريبي',
            role: role
        };

        switch (role) {
            case UserRole.ADMIN:
                userData.name = 'عبدالله المدير';
                break;
            case UserRole.PRINCIPAL:
                userData.name = 'أحمد العتيبي'; 
                userData.schoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
                userData.schoolName = 'مدرسة التجربة';
                break;
            case UserRole.TEACHER:
                userData.name = 'سعيد الشهراني';
                break;
            case UserRole.EVALUATOR:
                userData.name = 'خالد المشرف';
                break;
        }
    }

    setCurrentUser(userData);
    localStorage.setItem('nizam_user', JSON.stringify(userData)); // Save Session
    setActiveTab(Tab.DASHBOARD);
    setCurrentView('main');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTeacherId(null);
    setSelectedEvaluationId(undefined);
    setActiveTab(Tab.DASHBOARD);
    localStorage.removeItem('nizam_user'); // Clear Session
  };

  // Navigates to the History List for a teacher
  const navigateToHistory = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setCurrentView('history');
  };

  // Navigates to the actual Evaluation Form (New or Edit)
  const navigateToEvaluate = (teacherId: string, evaluationId?: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedEvaluationId(evaluationId); // Undefined means NEW
    setCurrentView('evaluate');
  };

  const handleBackToMain = () => {
    setCurrentView('main');
    setSelectedTeacherId(null);
    setSelectedEvaluationId(undefined);
  };
  
  const handleBackToHistory = () => {
      if (selectedTeacherId) {
          setCurrentView('history');
          setSelectedEvaluationId(undefined);
      } else {
          handleBackToMain();
      }
  };

  const renderContent = () => {
    // 1. Specific View Logic (Overrides Tab)
    if (selectedTeacherId) {
        if (currentView === 'history') {
            return (
                <TeacherEvaluationHistory 
                    teacherId={selectedTeacherId}
                    onEvaluate={(evalId) => navigateToEvaluate(selectedTeacherId, evalId)}
                    onBack={handleBackToMain}
                />
            );
        }
        if (currentView === 'evaluate') {
            return (
                <EvaluationFlow 
                    teacherId={selectedTeacherId} 
                    evaluationId={selectedEvaluationId}
                    onBack={handleBackToHistory} 
                />
            );
        }
    }

    // 2. Main Tab Logic
    switch (activeTab) {
      case Tab.DASHBOARD:
        return <Dashboard 
          userId={currentUser?.id}
          userName={currentUser?.name || ''} 
          userRole={currentUser?.role || UserRole.TEACHER}
          schoolId={currentUser?.schoolId}
          onNavigate={(tab) => setActiveTab(tab)} 
          onImportClick={() => { setActiveTab(Tab.TEACHERS); }}
        />;
      case Tab.SCHOOLS:
        return <SchoolManagement 
            userRole={currentUser?.role}
            schoolId={currentUser?.schoolId}
            userName={currentUser?.name}
        />;
      case Tab.TEACHERS:
        return <TeacherManagement 
            onEvaluate={(id) => navigateToEvaluate(id)} // Direct Evaluate (Legacy support)
            onViewHistory={navigateToHistory} // New History Flow
            userRole={currentUser?.role}
            schoolId={currentUser?.schoolId}
            userName={currentUser?.name}
        />;
      case Tab.ANALYTICS:
        return <Analytics userRole={currentUser?.role} schoolId={currentUser?.schoolId} />;
      case Tab.INDICATORS:
        return <IndicatorsManagement />;
      case Tab.SETTINGS:
        return <SystemSettings />;
      case Tab.EVENTS:
        return <EventsManagement />;
      case Tab.OBJECTIONS:
        return <ObjectionsManagement schoolId={currentUser?.schoolId} userRole={currentUser?.role} />;
      // Teacher Specific Views
      case Tab.TEACHER_EVALUATION:
         // Use currentUser.id assuming it matches teacher.id for this flow (or map it)
         return <TeacherEvaluationDetails teacherId={currentUser?.id || ''} onBack={() => setActiveTab(Tab.DASHBOARD)} />;
      case Tab.TEACHER_PROFILE:
         return <TeacherProfile teacherId={currentUser?.id || ''} onBack={() => setActiveTab(Tab.DASHBOARD)} />;
      default:
        return <Dashboard 
            userId={currentUser?.id}
            userName={currentUser?.name || ''} 
            userRole={currentUser?.role || UserRole.TEACHER} 
            schoolId={currentUser?.schoolId}
            onNavigate={(tab) => setActiveTab(tab)} 
            onImportClick={() => {}} 
        />;
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
                <div className="w-9 h-9 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold shadow-md">ت</div>
                <span className="font-bold text-xl text-gray-800 tracking-tight">نظام تقييم المدارس</span>
              </div>
              
              {/* Navigation Links based on Role */}
              <nav className="hidden md:flex gap-6 mr-8">
                <button 
                  onClick={() => { setActiveTab(Tab.DASHBOARD); setCurrentView('main'); }}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.DASHBOARD ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                >
                  <LayoutDashboard size={18} /> الرئيسة
                </button>
                
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                    <button 
                    onClick={() => { setActiveTab(Tab.SCHOOLS); setCurrentView('main'); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.SCHOOLS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                    <School size={18} /> المدارس
                    </button>
                )}

                {(currentUser.role !== UserRole.TEACHER) && (
                    <button 
                    onClick={() => { setActiveTab(Tab.TEACHERS); setCurrentView('main'); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.TEACHERS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                    <Users size={18} /> المعلمين
                    </button>
                )}
                
                {/* Events for Admin and Principal */}
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                   <button 
                   onClick={() => { setActiveTab(Tab.EVENTS); setCurrentView('main'); }}
                   className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.EVENTS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                   >
                   <Calendar size={18} /> الأحداث
                   </button>
                )}

                {/* Objections for Principal (and Admin) */}
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                   <button 
                   onClick={() => { setActiveTab(Tab.OBJECTIONS); setCurrentView('main'); }}
                   className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.OBJECTIONS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                   >
                   <MessageSquareWarning size={18} /> الاعتراضات
                   </button>
                )}
                
                {/* Admin Only: Indicators & Settings */}
                {currentUser.role === UserRole.ADMIN && (
                  <>
                    <button 
                    onClick={() => { setActiveTab(Tab.INDICATORS); setCurrentView('main'); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.INDICATORS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                    <AlignLeft size={18} /> المؤشرات
                    </button>

                    <button 
                    onClick={() => { setActiveTab(Tab.SETTINGS); setCurrentView('main'); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.SETTINGS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                    <Settings size={18} /> الإعدادات
                    </button>
                  </>
                )}

                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                    <button 
                    onClick={() => { setActiveTab(Tab.ANALYTICS); setCurrentView('main'); }}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors ${activeTab === Tab.ANALYTICS ? 'text-primary-600 bg-primary-50 px-3 py-1.5 rounded-lg' : 'text-gray-500 hover:text-gray-900'}`}
                    >
                    <BarChart3 size={18} /> التحليلات
                    </button>
                )}
              </nav>
            </div>

            <div className="flex items-center gap-4">
               <div className="text-left hidden sm:block">
                  <div className="text-sm font-bold text-gray-900">{currentUser.name}</div>
                  <div className="flex items-center gap-1 justify-end text-xs text-gray-500">
                      {currentUser.role}
                      {currentUser.schoolName && <span className="bg-gray-100 px-1 rounded text-[10px]">{currentUser.schoolName}</span>}
                  </div>
               </div>
               <button 
                 onClick={handleLogout}
                 className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-all"
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
