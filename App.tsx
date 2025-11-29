
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, School, Users, BarChart3, Settings, Import, FileText, AlertCircle, LogOut, Truck, AlignLeft, Calendar, MessageSquareWarning, ChevronDown, Check, Building2, RefreshCw, ShieldCheck, GraduationCap, UserCheck } from 'lucide-react';
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
import { supabase } from './supabaseClient';

enum Tab {
  DASHBOARD = 'dashboard',
  SCHOOLS = 'schools',
  TEACHERS = 'teachers',
  ANALYTICS = 'analytics',
  INDICATORS = 'indicators',
  SETTINGS = 'settings',
  EVENTS = 'events',
  OBJECTIONS = 'objections', 
  TEACHER_EVALUATION = 'teacher_evaluation',
  TEACHER_PROFILE = 'teacher_profile'
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>(Tab.DASHBOARD);
  
  const [currentView, setCurrentView] = useState<string>('main'); 
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | undefined>(undefined);

  // Multi-School & User Menu State
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

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

  // Fetch ALL schools and roles for the current user's national ID
  useEffect(() => {
    const fetchUserProfiles = async () => {
      if (currentUser?.nationalId) {
        try {
            // Find all profiles with same National ID in 'teachers' table
            const { data: profiles } = await supabase
              .from('teachers')
              .select('id, school_id, role, name, schools(name)')
              .eq('national_id', currentUser.nationalId);
            
            if (profiles && profiles.length > 0) {
               // Map to a cleaner format
               const profilesList = profiles.map((p: any) => ({
                 teacherId: p.id, // The ID in 'teachers' table specific to this school/role
                 schoolId: p.school_id,
                 schoolName: p.schools?.name || 'مدرسة غير محددة',
                 role: p.role || UserRole.TEACHER,
                 name: p.name
               }));
               setAvailableProfiles(profilesList);
            } else {
               setAvailableProfiles([]);
            }
        } catch (e) {
          console.error("Error checking profiles", e);
        }
      } else {
        setAvailableProfiles([]);
      }
    };

    fetchUserProfiles();
  }, [currentUser?.nationalId]); // Dependency on National ID

  // Click outside to close user menu
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSwitchProfile = (targetProfile: any) => {
      if (!currentUser) return;

      const newUserState: User = {
          ...currentUser,
          id: targetProfile.teacherId, // Switch the active teacher ID
          schoolId: targetProfile.schoolId,
          schoolName: targetProfile.schoolName,
          role: targetProfile.role, // Switch Role
          name: targetProfile.name
      };

      setCurrentUser(newUserState);
      localStorage.setItem('nizam_user', JSON.stringify(newUserState));
      setShowUserMenu(false);
      setActiveTab(Tab.DASHBOARD);
      setCurrentView('main');
      // Optional: Refresh to ensure clean slate for data fetching
      window.location.reload(); 
  };

  const handleLogin = (userOrRole: UserRole | User) => {
    let userData: User;
    if (typeof userOrRole === 'object') {
        userData = userOrRole;
    } else {
        const role = userOrRole;
        userData = {
            id: '1',
            name: 'مستخدم تجريبي',
            role: role
        };
        switch (role) {
            case UserRole.ADMIN: userData.name = 'عبدالله المدير'; break;
            case UserRole.PRINCIPAL: userData.name = 'أحمد العتيبي'; userData.schoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; userData.schoolName = 'مدرسة التجربة'; break;
            case UserRole.TEACHER: userData.name = 'سعيد الشهراني'; break;
            case UserRole.EVALUATOR: userData.name = 'خالد المشرف'; break;
        }
    }
    setCurrentUser(userData);
    localStorage.setItem('nizam_user', JSON.stringify(userData));
    setActiveTab(Tab.DASHBOARD);
    setCurrentView('main');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTeacherId(null);
    setSelectedEvaluationId(undefined);
    setActiveTab(Tab.DASHBOARD);
    localStorage.removeItem('nizam_user');
  };

  const navigateToHistory = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    setCurrentView('history');
  };

  const navigateToEvaluate = (teacherId: string, evaluationId?: string) => {
    setSelectedTeacherId(teacherId);
    setSelectedEvaluationId(evaluationId);
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
            onEvaluate={(id) => navigateToEvaluate(id)} 
            onViewHistory={navigateToHistory}
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
      case Tab.TEACHER_EVALUATION:
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

  // Helper for Nav Item
  const NavItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: any, label: string }) => (
      <button 
        onClick={() => { setActiveTab(tab); setCurrentView('main'); }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-[15px] ${
            activeTab === tab 
            ? 'text-primary-700 bg-primary-50 shadow-sm border border-primary-100' 
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-gray-100'
        }`}
      >
        <Icon size={20} strokeWidth={activeTab === tab ? 2.5 : 2} /> {label}
      </button>
  );

  const getRoleIcon = (role: string) => {
      switch(role) {
          case UserRole.PRINCIPAL: return <School size={16} className="text-blue-600"/>;
          case UserRole.EVALUATOR: return <UserCheck size={16} className="text-orange-600"/>;
          case UserRole.ADMIN: return <ShieldCheck size={16} className="text-purple-600"/>;
          default: return <GraduationCap size={16} className="text-gray-600"/>;
      }
  };

  return (
    <div className="min-h-screen bg-secondary-50 text-right font-sans" dir="rtl">
      {/* Top Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab(Tab.DASHBOARD)}>
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-200 group-hover:scale-105 transition-transform">أ</div>
                <div>
                    <h1 className="font-bold text-lg text-secondary-900 tracking-tight leading-tight">نظام الأداء الوظيفي للمدارس <span className="text-primary-600">"أدائي"</span></h1>
                    <p className="text-[10px] text-secondary-500 font-medium">الإصدار المؤسسي 2.1</p>
                </div>
              </div>
              
              {/* Navigation Links */}
              <nav className="hidden md:flex gap-2 mr-6">
                <NavItem tab={Tab.DASHBOARD} icon={LayoutDashboard} label="الرئيسة" />
                
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                    <NavItem tab={Tab.SCHOOLS} icon={School} label="المدارس" />
                )}

                {(currentUser.role !== UserRole.TEACHER) && (
                    <NavItem tab={Tab.TEACHERS} icon={Users} label="المعلمين" />
                )}
                
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                   <NavItem tab={Tab.EVENTS} icon={Calendar} label="الأحداث" />
                )}

                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                   <NavItem tab={Tab.OBJECTIONS} icon={MessageSquareWarning} label="الاعتراضات" />
                )}
                
                {currentUser.role === UserRole.ADMIN && (
                  <>
                    <NavItem tab={Tab.INDICATORS} icon={AlignLeft} label="المؤشرات" />
                    <NavItem tab={Tab.SETTINGS} icon={Settings} label="الإعدادات" />
                  </>
                )}

                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                    <NavItem tab={Tab.ANALYTICS} icon={BarChart3} label="التحليلات" />
                )}
              </nav>
            </div>

            <div className="relative" ref={userMenuRef}>
                <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
                >
                    <div className="w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg shadow-sm border-2 border-white">
                        {currentUser.name.charAt(0)}
                    </div>
                    <div className="hidden md:block text-right">
                        <div className="text-sm font-bold text-secondary-800">{currentUser.name}</div>
                        <div className="text-[10px] text-secondary-500 font-medium">{currentUser.role}</div>
                    </div>
                    <ChevronDown size={16} className="text-gray-400 mr-1" />
                </button>

                {showUserMenu && (
                    <div className="absolute top-full left-0 mt-3 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in origin-top-left">
                        {/* Header */}
                        <div className="px-5 py-4 bg-gray-50 border-b border-gray-100">
                            <p className="font-bold text-secondary-900">{currentUser.name}</p>
                            <p className="text-xs text-secondary-500 mt-0.5 font-mono">{currentUser.nationalId}</p>
                        </div>

                        {/* Profiles Switcher */}
                        {availableProfiles.length > 0 ? (
                            <div className="py-2 max-h-60 overflow-y-auto custom-scrollbar">
                                <div className="px-5 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    الحسابات المتاحة (المدارس والصلاحيات)
                                </div>
                                {availableProfiles.map((profile) => {
                                    const isActive = currentUser.id === profile.teacherId;
                                    return (
                                        <button
                                            key={profile.teacherId}
                                            onClick={() => handleSwitchProfile(profile)}
                                            className={`w-full text-right px-5 py-3 text-sm flex items-center justify-between group transition-colors ${isActive ? 'bg-primary-50 text-primary-900' : 'hover:bg-gray-50 text-gray-700'}`}
                                        >
                                            <div>
                                                <div className="font-bold flex items-center gap-2">
                                                    {getRoleIcon(profile.role)}
                                                    {profile.role}
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                    <Building2 size={12}/> {profile.schoolName}
                                                </div>
                                            </div>
                                            {isActive && <Check size={18} className="text-primary-600"/>}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            // Fallback for Admins without 'teachers' table link
                            <div className="p-4 text-center text-sm text-gray-500">
                                لا توجد حسابات أخرى مرتبطة.
                            </div>
                        )}

                        {/* Footer Actions */}
                        <div className="border-t border-gray-100 p-2 bg-gray-50/50">
                            <button 
                                onClick={handleLogout}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            >
                                <LogOut size={18} /> تسجيل الخروج
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 min-h-[calc(100vh-5rem)]">
        {renderContent()}
      </main>
    </div>
  );
}
