
import React, { useState, useEffect } from 'react';
import { MessageSquareWarning, CheckCircle, XCircle, Loader2, Calendar, User, Search, FileText } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserRole } from '../types';

interface ObjectionsManagementProps {
  schoolId?: string;
  userRole?: UserRole;
  nationalId?: string;
}

interface ObjectionItem {
    id: string; // evaluation id
    teacher_id: string;
    teacher_name: string;
    teacher_national_id: string;
    period_name: string;
    eval_date: string;
    total_score: number;
    objection_text: string;
    objection_status: 'pending' | 'accepted' | 'rejected' | 'none';
}

export default function ObjectionsManagement({ schoolId, userRole, nationalId }: ObjectionsManagementProps) {
  const [objections, setObjections] = useState<ObjectionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'history'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  // Effective School ID State
  const [effectiveSchoolId, setEffectiveSchoolId] = useState<string | undefined>(schoolId);

  // 1. Resolve Effective School ID for Principals
  useEffect(() => {
      const resolveSchool = async () => {
          // If we already have a direct schoolId from login, use it
          if (schoolId) {
              setEffectiveSchoolId(schoolId);
              return;
          }

          // If Principal and no schoolId, try resolving via National ID
          if (userRole === UserRole.PRINCIPAL && nationalId) {
              try {
                  const { data } = await supabase
                      .from('schools')
                      .select('id')
                      .eq('manager_national_id', nationalId)
                      .single();
                  
                  if (data) {
                      setEffectiveSchoolId(data.id);
                  }
              } catch (e) {
                  console.error("Error resolving school for objections:", e);
              }
          }
      };
      resolveSchool();
  }, [schoolId, nationalId, userRole]);

  const fetchObjections = async () => {
      setIsLoading(true);
      try {
          // Get IDs of teachers in this school
          let teacherIds: string[] = [];
          if (effectiveSchoolId) {
              const { data: teachers } = await supabase.from('teachers').select('id').eq('school_id', effectiveSchoolId);
              teacherIds = teachers?.map(t => t.id) || [];
          } else if (userRole === UserRole.ADMIN) {
              // Admin fetches all, no filter needed yet, but we'll fetch teachers to map names
          }

          let query = supabase
              .from('evaluations')
              .select('*, teachers(name, national_id)')
              .neq('objection_status', 'none') // Only where objection exists
              .order('created_at', { ascending: false });

          // Filter for Principal: only show objections from their school's teachers
          if (userRole === UserRole.PRINCIPAL) {
              if (effectiveSchoolId && teacherIds.length > 0) {
                  query = query.in('teacher_id', teacherIds);
              } else {
                  // School has no teachers or school not found
                  setObjections([]);
                  setIsLoading(false);
                  return;
              }
          }

          const { data, error } = await query;

          if (error) throw error;

          const formattedData: ObjectionItem[] = data.map((item: any) => ({
              id: item.id,
              teacher_id: item.teacher_id,
              teacher_name: item.teachers?.name || 'غير معروف',
              teacher_national_id: item.teachers?.national_id || '',
              period_name: item.period_name,
              eval_date: item.eval_date,
              total_score: item.total_score,
              objection_text: item.objection_text,
              objection_status: item.objection_status
          }));

          setObjections(formattedData);

      } catch (error) {
          console.error("Error fetching objections:", error);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchObjections();
  }, [effectiveSchoolId, userRole]);

  const handleAction = async (id: string, action: 'accepted' | 'rejected') => {
      if (!confirm(action === 'accepted' ? 'هل أنت متأكد من قبول الاعتراض؟' : 'هل أنت متأكد من رفض الاعتراض؟')) return;

      setProcessingId(id);
      try {
          const { error } = await supabase
              .from('evaluations')
              .update({ objection_status: action })
              .eq('id', id);

          if (error) throw error;

          // Update local state
          setObjections(prev => prev.map(obj => 
              obj.id === id ? { ...obj, objection_status: action } : obj
          ));
          
          alert(action === 'accepted' ? 'تم قبول الاعتراض.' : 'تم رفض الاعتراض.');

      } catch (error) {
          console.error(error);
          alert('حدث خطأ أثناء المعالجة');
      } finally {
          setProcessingId(null);
      }
  };

  const filteredObjections = objections.filter(obj => {
      if (filterStatus === 'pending') return obj.objection_status === 'pending';
      return obj.objection_status !== 'pending' && obj.objection_status !== 'none';
  });

  return (
      <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <MessageSquareWarning className="text-red-600" /> إدارة الاعتراضات
              </h2>
              <div className="flex bg-gray-100 rounded-lg p-1">
                  <button 
                      onClick={() => setFilterStatus('pending')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filterStatus === 'pending' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                  >
                      الطلبات المعلقة ({objections.filter(o => o.objection_status === 'pending').length})
                  </button>
                  <button 
                      onClick={() => setFilterStatus('history')}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${filterStatus === 'history' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                  >
                      الأرشيف ({objections.filter(o => o.objection_status !== 'pending' && o.objection_status !== 'none').length})
                  </button>
              </div>
          </div>

          {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
          ) : filteredObjections.length === 0 ? (
              <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                  <MessageSquareWarning size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>لا توجد اعتراضات {filterStatus === 'pending' ? 'معلقة حالياً' : 'في الأرشيف'}.</p>
                  <button onClick={fetchObjections} className="text-primary-600 text-sm mt-4 hover:underline">تحديث القائمة</button>
              </div>
          ) : (
              <div className="grid gap-4">
                  {filteredObjections.map((obj) => (
                      <div key={obj.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4 border-b border-gray-100 pb-4">
                              <div>
                                  <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                      <User size={18} className="text-gray-400"/> {obj.teacher_name}
                                  </h3>
                                  <p className="text-sm text-gray-500 font-mono mt-1">الهوية: {obj.teacher_national_id}</p>
                              </div>
                              <div className="text-left flex flex-col items-end">
                                  <span className="bg-blue-50 text-blue-800 text-xs px-2 py-1 rounded mb-1 border border-blue-100">{obj.period_name}</span>
                                  <div className="flex items-center gap-2 text-sm text-gray-600">
                                      <Calendar size={14}/> {new Date(obj.eval_date).toLocaleDateString('ar-SA')}
                                  </div>
                                  <div className="font-bold text-primary-700 mt-1">الدرجة: {obj.total_score}%</div>
                              </div>
                          </div>

                          <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-gray-800 text-sm mb-4">
                              <h4 className="font-bold text-red-800 mb-2 flex items-center gap-2"><FileText size={16}/> نص الاعتراض:</h4>
                              <p className="leading-relaxed whitespace-pre-line">{obj.objection_text}</p>
                          </div>

                          {obj.objection_status === 'pending' ? (
                              <div className="flex justify-end gap-3 pt-2">
                                  <button 
                                      onClick={() => handleAction(obj.id, 'rejected')}
                                      disabled={processingId === obj.id}
                                      className="px-4 py-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors"
                                  >
                                      <XCircle size={16} /> رفض الاعتراض
                                  </button>
                                  <button 
                                      onClick={() => handleAction(obj.id, 'accepted')}
                                      disabled={processingId === obj.id}
                                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-sm"
                                  >
                                      {processingId === obj.id ? <Loader2 className="animate-spin" size={16}/> : <CheckCircle size={16} />}
                                      قبول الاعتراض
                                  </button>
                              </div>
                          ) : (
                              <div className="flex justify-end pt-2">
                                  {obj.objection_status === 'accepted' && (
                                      <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-green-200">
                                          <CheckCircle size={16}/> تم قبول الاعتراض
                                      </span>
                                  )}
                                  {obj.objection_status === 'rejected' && (
                                      <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 border border-red-200">
                                          <XCircle size={16}/> تم رفض الاعتراض
                                      </span>
                                  )}
                              </div>
                          )}
                      </div>
                  ))}
              </div>
          )}
      </div>
  );
}
