
import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, School, Users, BarChart3, Settings, Import, FileText, AlertCircle, LogOut, Truck, AlignLeft, Calendar, MessageSquareWarning, ChevronDown, Check, Building2, RefreshCw, ShieldCheck, GraduationCap, UserCheck, Home, Download, WifiOff } from 'lucide-react';
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
  
  // State Initialization with LocalStorage Persistence
  const [activeTab, setActiveTab] = useState<Tab>(() => (localStorage.getItem('nizam_activeTab') as Tab) || Tab.DASHBOARD);
  const [currentView, setCurrentView] = useState<string>(() => localStorage.getItem('nizam_currentView') || 'main');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(() => localStorage.getItem('nizam_selectedTeacherId') || null);
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | undefined>(() => localStorage.getItem('nizam_selectedEvaluationId') || undefined);

  // Multi-School & User Menu State
  const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // PWA State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
      const savedUser = localStorage.getItem('nizam_user');
      if (savedUser) {
          try {
              setCurrentUser(JSON.parse(savedUser));
          } catch (e) {
              localStorage.removeItem('nizam_user');
          }
      }

      // PWA Install Event Listener
      const handleBeforeInstallPrompt = (e: any) => {
        e.preventDefault();
        setDeferredPrompt(e);
      };
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Offline Status Listeners
      const handleOnline = () => setIsOffline(false);
      const handleOffline = () => setIsOffline(true);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the install prompt');
          setDeferredPrompt(null);
        }
      });
    }
  };

  // Persist Navigation State
  useEffect(() => {
      if (currentUser) {
          localStorage.setItem('nizam_activeTab', activeTab);
      }
  }, [activeTab, currentUser]);

  useEffect(() => {
      if (currentUser) {
          localStorage.setItem('nizam_currentView', currentView);
      }
  }, [currentView, currentUser]);

  useEffect(() => {
      if (currentUser) {
          if (selectedTeacherId) localStorage.setItem('nizam_selectedTeacherId', selectedTeacherId);
          else localStorage.removeItem('nizam_selectedTeacherId');
      }
  }, [selectedTeacherId, currentUser]);

  useEffect(() => {
      if (currentUser) {
          if (selectedEvaluationId) localStorage.setItem('nizam_selectedEvaluationId', selectedEvaluationId);
          else localStorage.removeItem('nizam_selectedEvaluationId');
      }
  }, [selectedEvaluationId, currentUser]);


  // Fetch ALL schools and roles for the current user (National ID OR Email)
  useEffect(() => {
    const fetchUserProfiles = async () => {
      setAvailableProfiles([]);
      try {
          // 1. Check National ID (Teachers Table)
          if (currentUser?.nationalId) {
            const { data: profiles } = await supabase
              .from('teachers')
              .select('id, school_id, role, roles, name, schools(name)')
              .eq('national_id', currentUser.nationalId);
            
            if (profiles && profiles.length > 0) {
               // Logic: Flatten the roles array. If roles is null/empty, fallback to 'role'
               const flattenedProfiles: any[] = [];
               
               profiles.forEach((p: any) => {
                   let rolesToProcess: UserRole[] = [];
                   if (p.roles && Array.isArray(p.roles) && p.roles.length > 0) {
                       rolesToProcess = p.roles;
                   } else if (p.role) {
                       rolesToProcess = [p.role as UserRole];
                   } else {
                       rolesToProcess = [UserRole.TEACHER];
                   }

                   rolesToProcess.forEach(role => {
                       flattenedProfiles.push({
                           userId: p.id,
                           schoolId: p.school_id,
                           schoolName: p.schools?.name || 'مدرسة غير محددة',
                           role: role,
                           name: p.name,
                           nationalId: currentUser.nationalId,
                           type: 'teacher'
                       });
                   });
               });

               setAvailableProfiles(prev => [...prev, ...flattenedProfiles]);
            }
          }

          // 2. Check Email (App Users Table)
          if (currentUser?.email) {
             const { data: profiles } = await supabase
              .from('app_users')
              .select('id, school_id, role, full_name, email, schools(name)')
              .eq('email', currentUser.email);
             
             if (profiles && profiles.length > 0) {
                 const profilesList = profiles.map((p: any) => ({
                     userId: p.id,
                     schoolId: p.school_id,
                     schoolName: p.schools?.name || 'مدرسة غير محددة',
                     role: p.role,
                     name: p.full_name,
                     email: p.email,
                     type: 'admin'
                 }));
                 // Avoid duplicates if user is somehow in both logic (rare)
                 setAvailableProfiles(prev => {
                     // Check existing based on ID AND Role to avoid duplicates
                     const existingKeys = new Set(prev.map(item => `${item.userId}-${item.role}`));
                     const newItems = profilesList.filter(item => !existingKeys.has(`${item.userId}-${item.role}`));
                     return [...prev, ...newItems];
                 });
             }
          }

      } catch (e) {
          console.error("Error checking profiles", e);
      }
    };

    if (currentUser) {
        fetchUserProfiles();
    }
  }, [currentUser?.nationalId, currentUser?.email]);

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
          id: targetProfile.userId,
          schoolId: targetProfile.schoolId,
          schoolName: targetProfile.schoolName,
          role: targetProfile.role,
          name: targetProfile.name,
          email: targetProfile.email || currentUser.email,
          nationalId: targetProfile.nationalId || currentUser.nationalId
      };

      setCurrentUser(newUserState);
      localStorage.setItem('nizam_user', JSON.stringify(newUserState));
      
      // Reset navigation state on profile switch to avoid confusion
      localStorage.removeItem('nizam_activeTab');
      localStorage.removeItem('nizam_currentView');
      localStorage.removeItem('nizam_selectedTeacherId');
      localStorage.removeItem('nizam_selectedEvaluationId');

      setShowUserMenu(false);
      setActiveTab(Tab.DASHBOARD);
      setCurrentView('main');
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
        // NOTE: Demo data is actually handled in LoginScreen.tsx, this is just a fallback for direct calls
        switch (role) {
            case UserRole.ADMIN: userData.name = 'عبدالله المدير'; break;
            case UserRole.PRINCIPAL: userData.name = 'أحمد العتيبي'; userData.schoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; userData.schoolName = 'مدرسة التجربة'; break;
            case UserRole.TEACHER: userData.name = 'سعيد الشهراني'; break;
            case UserRole.EVALUATOR: userData.name = 'خالد المشرف'; userData.schoolId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; break;
        }
    }
    setCurrentUser(userData);
    localStorage.setItem('nizam_user', JSON.stringify(userData));
    // Reset Navigation on new login
    setActiveTab(Tab.DASHBOARD);
    setCurrentView('main');
    setSelectedTeacherId(null);
    setSelectedEvaluationId(undefined);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setSelectedTeacherId(null);
    setSelectedEvaluationId(undefined);
    setActiveTab(Tab.DASHBOARD);
    localStorage.removeItem('nizam_user');
    
    // Clear navigation persistence
    localStorage.removeItem('nizam_activeTab');
    localStorage.removeItem('nizam_currentView');
    localStorage.removeItem('nizam_selectedTeacherId');
    localStorage.removeItem('nizam_selectedEvaluationId');
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
                    userRole={currentUser?.role} // Pass Role for Permissions
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
          nationalId={currentUser?.nationalId} // Added nationalId
          onNavigate={(tab) => setActiveTab(tab)} 
          onImportClick={() => { setActiveTab(Tab.TEACHERS); }}
          onEvaluate={(teacherId, evaluationId) => navigateToEvaluate(teacherId, evaluationId)} // Updated to pass evalId
        />;
      case Tab.SCHOOLS:
        return <SchoolManagement 
            userRole={currentUser?.role}
            schoolId={currentUser?.schoolId}
            userName={currentUser?.name}
            nationalId={currentUser?.nationalId} // Pass nationalId to allow robust principal filtering
        />;
      case Tab.TEACHERS:
        return <TeacherManagement 
            onEvaluate={(id, evalId) => navigateToEvaluate(id, evalId)} 
            onViewHistory={navigateToHistory}
            userRole={currentUser?.role}
            schoolId={currentUser?.schoolId}
            userName={currentUser?.name}
            nationalId={currentUser?.nationalId} // ADDED nationalId
        />;
      case Tab.ANALYTICS:
        return <Analytics 
            userRole={currentUser?.role} 
            schoolId={currentUser?.schoolId} 
            nationalId={currentUser?.nationalId} // ADDED nationalId for Analytics robustness
        />;
      case Tab.INDICATORS:
        return <IndicatorsManagement userRole={currentUser?.role} />; // Pass Role
      case Tab.SETTINGS:
        return <SystemSettings />;
      case Tab.EVENTS:
        return <EventsManagement 
            schoolId={currentUser?.schoolId} 
            userRole={currentUser?.role}
            nationalId={currentUser?.nationalId} // ADDED nationalId
        />;
      case Tab.OBJECTIONS:
        return <ObjectionsManagement 
            schoolId={currentUser?.schoolId} 
            userRole={currentUser?.role}
            nationalId={currentUser?.nationalId} // ADDED nationalId
            onViewEvaluation={(teacherId, evalId) => navigateToEvaluate(teacherId, evalId)} // Add navigation callback
        />;
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
            nationalId={currentUser?.nationalId}
            onNavigate={(tab) => setActiveTab(tab)} 
            onImportClick={() => {}} 
            onEvaluate={(teacherId, evaluationId) => navigateToEvaluate(teacherId, evaluationId)}
        />;
    }
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // Helper for Nav Item (Desktop)
  const NavItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: any, label: string }) => (
      <button 
        onClick={() => { setActiveTab(tab); setCurrentView('main'); setSelectedTeacherId(null); }}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 font-medium text-[15px] ${
            activeTab === tab 
            ? 'text-primary-700 bg-primary-50 shadow-sm border border-primary-100' 
            : 'text-secondary-600 hover:text-secondary-900 hover:bg-gray-100'
        }`}
      >
        <Icon size={20} strokeWidth={activeTab === tab ? 2.5 : 2} /> {label}
      </button>
  );

  // Helper for Mobile Bottom Nav Item with Haptic Feedback and Active State
  const MobileNavItem = ({ tab, icon: Icon, label }: { tab: Tab, icon: any, label: string }) => (
      <button 
        onClick={() => { 
            // Add vibration feedback if supported
            if (navigator.vibrate) navigator.vibrate(10);
            setActiveTab(tab); 
            setCurrentView('main'); 
            setSelectedTeacherId(null); 
        }}
        className={`relative flex flex-col items-center justify-center py-2 flex-1 transition-all active:scale-95 ${
            activeTab === tab ? 'text-primary-600' : 'text-gray-400 hover:text-gray-500'
        }`}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        <div className={`p-1.5 rounded-2xl transition-all duration-300 ${activeTab === tab ? 'bg-primary-50 translate-y-[-2px]' : ''}`}>
            <Icon size={24} strokeWidth={activeTab === tab ? 2.5 : 2} />
        </div>
        <span className={`text-[10px] font-bold mt-0.5 ${activeTab === tab ? 'text-primary-700' : 'text-gray-500'}`}>{label}</span>
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
      <header className="bg-white/95 backdrop-blur-md sticky top-0 z-50 border-b border-gray-200 no-print transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setActiveTab(Tab.DASHBOARD)}>
                <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-primary-200 group-hover:scale-105 transition-transform">أ</div>
                <div className="hidden sm:block">
                    <h1 className="font-bold text-lg text-secondary-900 tracking-tight leading-tight">نظام الأداء الوظيفي للمدارس <span className="text-primary-600">"أدائي"</span></h1>
                    <p className="text-[10px] text-secondary-500 font-medium">الإصدار المؤسسي 2.1</p>
                </div>
              </div>
              
              {/* Navigation Links - Desktop Only */}
              <nav className="hidden md:flex gap-1 mr-4 overflow-x-auto">
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
                
                {/* Allow ADMIN, PRINCIPAL, EVALUATOR to see Indicators */}
                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL || currentUser.role === UserRole.EVALUATOR) && (
                    <NavItem tab={Tab.INDICATORS} icon={AlignLeft} label="المؤشرات" />
                )}

                {currentUser.role === UserRole.ADMIN && (
                    <NavItem tab={Tab.SETTINGS} icon={Settings} label="الإعدادات" />
                )}

                {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL || currentUser.role === UserRole.EVALUATOR) && (
                    <NavItem tab={Tab.ANALYTICS} icon={BarChart3} label="التحليلات" />
                )}
              </nav>
            </div>

            <div className="relative" ref={userMenuRef}>
                <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
                >
                    <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg shadow-sm border-2 border-white">
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
                            <p className="text-xs text-secondary-500 mt-0.5 font-mono">{currentUser.email || currentUser.nationalId}</p>
                        </div>

                        {/* Install Button (PWA) */}
                        {deferredPrompt && (
                            <div className="p-3 bg-primary-50 border-b border-primary-100">
                                <button 
                                    onClick={handleInstallClick}
                                    className="w-full bg-primary-600 text-white rounded-xl py-2 text-sm font-bold shadow-sm hover:bg-primary-700 flex items-center justify-center gap-2"
                                >
                                    <Download size={16} /> تثبيت التطبيق
                                </button>
                            </div>
                        )}

                        {/* Profiles Switcher */}
                        {availableProfiles.length > 0 ? (
                            <div className="py-2 max-h-60 overflow-y-auto custom-scrollbar">
                                <div className="px-5 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                    الحسابات المتاحة (المدارس والصلاحيات)
                                </div>
                                {availableProfiles.map((profile) => {
                                    // Complex check because a user might have same ID but different role in this new system
                                    const isActive = currentUser.id === profile.userId && currentUser.role === profile.role;
                                    return (
                                        <button
                                            key={`${profile.userId}-${profile.role}`}
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

      {/* Offline Banner */}
      {isOffline && (
          <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-bold fixed bottom-16 md:bottom-0 left-0 right-0 z-[60] flex items-center justify-center gap-2 shadow-lg animate-fade-in">
              <WifiOff size={16} />
              أنت غير متصل بالإنترنت. يتم عرض البيانات المخزنة مؤقتاً.
          </div>
      )}

      {/* Main Content with Padding for Bottom Nav */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8 min-h-[calc(100vh-5rem)] pb-24 md:pb-8">
        {renderContent()}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-bottom shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="flex justify-around items-center px-2">
              <MobileNavItem tab={Tab.DASHBOARD} icon={Home} label="الرئيسة" />
              
              {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.PRINCIPAL) && (
                  <MobileNavItem tab={Tab.SCHOOLS} icon={School} label="المدارس" />
              )}

              {(currentUser.role !== UserRole.TEACHER) && (
                  <MobileNavItem tab={Tab.TEACHERS} icon={Users} label="المعلمين" />
              )}

              {currentUser.role === UserRole.TEACHER ? (
                  <MobileNavItem tab={Tab.TEACHER_EVALUATION} icon={FileText} label="تقييمي" />
              ) : currentUser.role === UserRole.EVALUATOR ? (
                  // Evaluator needs Indicators instead of Analytics as primary
                  <MobileNavItem tab={Tab.INDICATORS} icon={AlignLeft} label="المؤشرات" />
              ) : (
                  <MobileNavItem tab={Tab.ANALYTICS} icon={BarChart3} label="التقارير" />
              )}
              
              {/* Show different last item based on role */}
              {currentUser.role === UserRole.ADMIN ? (
                  <MobileNavItem tab={Tab.SETTINGS} icon={Settings} label="الإعدادات" />
              ) : currentUser.role === UserRole.PRINCIPAL ? (
                  <MobileNavItem tab={Tab.OBJECTIONS} icon={MessageSquareWarning} label="الاعتراضات" />
              ) : currentUser.role === UserRole.TEACHER ? (
                  <MobileNavItem tab={Tab.TEACHER_PROFILE} icon={UserCheck} label="ملفي" />
              ) : currentUser.role === UserRole.EVALUATOR ? (
                  // Show Analytics as the last item for Evaluator
                  <MobileNavItem tab={Tab.ANALYTICS} icon={BarChart3} label="التقارير" />
              ) : null}
          </div>
      </nav>
    </div>
  );
}
