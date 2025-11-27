
import React from 'react';
import { UserRole } from '../types';
import { Shield, School, GraduationCap, ClipboardCheck, ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (role: UserRole) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const roles = [
    {
      id: UserRole.ADMIN,
      title: 'مدير النظام',
      description: 'إدارة النظام بالكامل، المستخدمين، والصلاحيات.',
      icon: <Shield size={32} className="text-purple-600" />,
      colorClass: 'hover:border-purple-500 hover:bg-purple-50'
    },
    {
      id: UserRole.PRINCIPAL,
      title: 'مدير المدرسة',
      description: 'إدارة المعلمين، متابعة التقييمات، والتقارير المدرسية.',
      icon: <School size={32} className="text-primary-600" />,
      colorClass: 'hover:border-primary-500 hover:bg-primary-50'
    },
    {
      id: UserRole.TEACHER,
      title: 'المعلم',
      description: 'الاطلاع على التقييمات، المؤشرات، وملف الأداء.',
      icon: <GraduationCap size={32} className="text-blue-600" />,
      colorClass: 'hover:border-blue-500 hover:bg-blue-50'
    },
    {
      id: UserRole.EVALUATOR,
      title: 'المقيم',
      description: 'إجراء التقييمات للمعلمين ومراجعة الشواهد.',
      icon: <ClipboardCheck size={32} className="text-orange-600" />,
      colorClass: 'hover:border-orange-500 hover:bg-orange-50'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-600 text-white shadow-lg mb-4">
            <span className="text-4xl font-bold">ت</span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900">نظام تقييم المدارس</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            منصة موحدة لإدارة الأداء المدرسي، تقييم المعلمين، ومتابعة مؤشرات التميز التعليمي بكفاءة وشفافية.
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="p-8 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-xl font-bold text-gray-800 text-center">اختر نوع الحساب لتسجيل الدخول</h2>
          </div>
          
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {roles.map((role) => (
              <button
                key={role.id}
                onClick={() => onLogin(role.id)}
                className={`group relative flex items-start gap-4 p-6 rounded-xl border-2 border-gray-100 transition-all duration-200 text-right ${role.colorClass}`}
              >
                <div className="p-3 bg-white rounded-lg shadow-sm border border-gray-100 group-hover:scale-110 transition-transform">
                  {role.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-1 group-hover:text-gray-800">
                    {role.title}
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {role.description}
                  </p>
                </div>
                <div className="absolute left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-4 group-hover:translate-x-0">
                  <ArrowRight className="text-gray-400" />
                </div>
              </button>
            ))}
          </div>

          <div className="p-6 bg-gray-50 text-center text-sm text-gray-500 border-t border-gray-100">
            نسخة تجريبية 1.0.0 &copy; 2024 جميع الحقوق محفوظة
          </div>
        </div>
      </div>
    </div>
  );
}
