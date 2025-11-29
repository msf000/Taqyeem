
import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Edit2, Trash2, X, Loader2, CheckCircle2, Clock, AlertCircle, Database, School as SchoolIcon } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { SchoolEvent, UserRole, School } from '../types';

interface EventsManagementProps {
    userRole?: UserRole;
    schoolId?: string;
}

export default function EventsManagement({ userRole, schoolId }: EventsManagementProps) {
  const [events, setEvents] = useState<SchoolEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  
  // Admin school filter
  const [adminSchoolList, setAdminSchoolList] = useState<School[]>([]);
  const [selectedAdminSchoolId, setSelectedAdminSchoolId] = useState<string>('');

  const [formData, setFormData] = useState<Partial<SchoolEvent>>({
      name: '',
      type: 'evaluation',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
      status: 'upcoming',
      description: ''
  });

  const getErrorMessage = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error?.message) return error.message;
    if (error?.error_description) return error.error_description;
    try {
        return JSON.stringify(error);
    } catch {
        return 'خطأ غير معروف';
    }
  };

  const fetchAdminSchools = async () => {
      if (userRole !== UserRole.ADMIN) return;
      const { data } = await supabase.from('schools').select('*').order('name');
      setAdminSchoolList((data || []).map((s:any) => ({
          id: s.id, name: s.name, stage: '', type: '', ministryId: '', managerName: '', evaluatorName: ''
      })));
  };

  const fetchEvents = async () => {
      // Determine effective school ID
      let targetSchoolId = schoolId;
      if (userRole === UserRole.ADMIN) {
          targetSchoolId = selectedAdminSchoolId;
      }

      // If Admin hasn't selected a school, don't fetch or fetch all (optional logic)
      // Here we choose to show empty if no school selected for Admin to avoid clutter
      if (userRole === UserRole.ADMIN && !targetSchoolId) {
          setEvents([]);
          setIsLoading(false);
          return;
      }

      setIsLoading(true);
      setFetchError(null);
      try {
          let query = supabase.from('school_events').select('*').order('start_date', { ascending: false });
          
          if (targetSchoolId) {
              query = query.eq('school_id', targetSchoolId);
          } else {
              // Fallback for global events if needed, or prevent access
              // For now, if no school ID (e.g. system wide), maybe fetch nulls?
              // query = query.is('school_id', null);
          }

          const { data, error } = await query;
          if (error) throw error;
          setEvents(data || []);
      } catch (error: any) {
          let msg = getErrorMessage(error);
          console.error('Error fetching events:', msg);
          
          if (error?.code === '42P01' || msg.includes('Could not find the table') || msg.includes('relation "public.school_events" does not exist')) {
             msg = 'جدول الأحداث غير موجود في قاعدة البيانات.';
          } else if (msg.includes('column "school_id" does not exist')) {
             msg = 'الرجاء تحديث قاعدة البيانات لإضافة دعم تعدد المدارس للأحداث (انظر الإعدادات).';
          }
          
          setFetchError(msg);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
      fetchAdminSchools();
  }, [userRole]);

  useEffect(() => {
      fetchEvents();
  }, [schoolId, userRole, selectedAdminSchoolId]);

  const handleOpenModal = (event?: SchoolEvent) => {
      if (event) {
          setEditingId(event.id);
          setFormData({
              name: event.name,
              type: event.type,
              start_date: event.start_date,
              end_date: event.end_date,
              status: event.status,
              description: event.description
          });
      } else {
          setEditingId(null);
          setFormData({
            name: '',
            type: 'evaluation',
            start_date: new Date().toISOString().split('T')[0],
            end_date: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
            status: 'upcoming',
            description: ''
          });
      }
      setIsModalOpen(true);
  };

  const handleSave = async () => {
      let targetSchoolId = schoolId;
      if (userRole === UserRole.ADMIN) {
          targetSchoolId = selectedAdminSchoolId;
      }

      if (!targetSchoolId) {
          alert('يرجى تحديد المدرسة أولاً');
          return;
      }

      if (!formData.name || !formData.start_date || !formData.end_date) {
          alert('الرجاء تعبئة الحقول الأساسية (الاسم، تاريخ البداية والنهاية)');
          return;
      }
      
      if (new Date(formData.start_date) > new Date(formData.end_date)) {
          alert('تاريخ النهاية يجب أن يكون بعد تاريخ البداية');
          return;
      }

      setIsSaving(true);
      try {
          const payload = { ...formData, school_id: targetSchoolId };

          if (editingId) {
              const { error } = await supabase.from('school_events').update(payload).eq('id', editingId);
              if (error) throw error;
          } else {
              // 1. Create the event
              const { error } = await supabase.from('school_events').insert([payload]);
              if (error) throw error;

              // 2. Auto-create evaluations if type is 'evaluation'
              // IMPORTANT: Filter teachers by School ID
              if (formData.type === 'evaluation') {
                  const { data: teachers } = await supabase
                    .from('teachers')
                    .select('id, school_id')
                    .eq('school_id', targetSchoolId); // Filter by school

                  if (teachers && teachers.length > 0) {
                      const evaluationsPayload = teachers.map(t => ({
                          teacher_id: t.id,
                          school_id: t.school_id,
                          period_name: formData.name,
                          eval_date: formData.start_date, 
                          status: 'draft',
                          scores: {}, 
                          total_score: 0
                      }));
                      
                      const { error: batchError } = await supabase.from('evaluations').insert(evaluationsPayload);
                      if (batchError) {
                          console.warn('Auto-creation of evaluations had partial failure or constraint issue:', batchError);
                      } else {
                          alert(`تم إنشاء الحدث لمدرسة ${userRole === UserRole.ADMIN ? adminSchoolList.find(s=>s.id===targetSchoolId)?.name : ''}، وتم إضافة ${teachers.length} سجل تقييم (مسودة) للمعلمين تلقائياً.`);
                      }
                  } else {
                      alert('تم إنشاء الحدث، ولكن لا يوجد معلمين في هذه المدرسة لإنشاء سجلات تقييم لهم.');
                  }
              }
          }
          await fetchEvents();
          setIsModalOpen(false);
      } catch (error) {
          alert('حدث خطأ أثناء الحفظ: ' + getErrorMessage(error));
      } finally {
          setIsSaving(false);
      }
  };

  const handleDelete = async (id: string) => {
      if (!confirm('هل أنت متأكد من حذف هذا الحدث؟')) return;
      try {
          const { error } = await supabase.from('school_events').delete().eq('id', id);
          if (error) throw error;
          setEvents(events.filter(e => e.id !== id));
      } catch (error) {
          alert('حدث خطأ أثناء الحذف: ' + getErrorMessage(error));
      }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'active': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle2 size={12}/> نشط</span>;
          case 'upcoming': return <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><Clock size={12}/> قادم</span>;
          case 'closed': return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 w-fit"><X size={12}/> مغلق</span>;
          default: return null;
      }
  };

  const getEventTypeLabel = (type: string) => {
      const types: any = { 'evaluation': 'تقييم أداء', 'audit': 'تدقيق ومراجعة', 'objection': 'فترة اعتراضات', 'other': 'أخرى' };
      return types[type] || type;
  };

  return (
      <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Calendar className="text-primary-600" /> إدارة الأحداث والفترات
              </h2>
              
              <div className="flex gap-2 w-full md:w-auto">
                  {userRole === UserRole.ADMIN && (
                      <select 
                          className="bg-white border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 w-full md:w-64"
                          value={selectedAdminSchoolId}
                          onChange={(e) => setSelectedAdminSchoolId(e.target.value)}
                      >
                          <option value="">-- اختر المدرسة لإدارة أحداثها --</option>
                          {adminSchoolList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                  )}

                  <button 
                      onClick={() => handleOpenModal()}
                      disabled={userRole === UserRole.ADMIN && !selectedAdminSchoolId}
                      className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                      <Plus size={18} /> إضافة حدث جديد
                  </button>
              </div>
          </div>

          {fetchError && (
            <div className="bg-red-50 text-red-700 p-6 border border-red-200 rounded-xl flex flex-col md:flex-row items-center gap-4 shadow-sm">
                <div className="p-3 bg-red-100 rounded-full shrink-0">
                    <Database size={24} className="text-red-600" />
                </div>
                <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">تحديث قاعدة البيانات مطلوب</h3>
                    <p className="text-sm opacity-90 mb-2">{fetchError}</p>
                    <p className="text-xs">
                        يرجى الذهاب إلى <span className="font-bold mx-1">الإعدادات {'>'} قاعدة البيانات</span> ونسخ كود التحديث وتشغيله في Supabase SQL Editor.
                    </p>
                </div>
            </div>
          )}

          {isLoading ? (
              <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
          ) : !fetchError && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-gray-700">
                          {userRole === UserRole.ADMIN && selectedAdminSchoolId 
                            ? `أحداث مدرسة: ${adminSchoolList.find(s=>s.id===selectedAdminSchoolId)?.name}`
                            : 'قائمة الأحداث والفترات'}
                      </span>
                      {events.length > 0 && <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{events.length}</span>}
                  </div>
                  
                  {events.length === 0 ? (
                      <div className="text-center p-12 text-gray-500">
                          {userRole === UserRole.ADMIN && !selectedAdminSchoolId ? (
                              <div className="flex flex-col items-center gap-2">
                                  <SchoolIcon size={48} className="text-gray-300"/>
                                  <p>يرجى اختيار مدرسة من القائمة أعلاه لعرض أحداثها.</p>
                              </div>
                          ) : (
                              <p>لا توجد أحداث مسجلة لهذه المدرسة.</p>
                          )}
                      </div>
                  ) : (
                      <table className="w-full text-right">
                          <thead className="bg-gray-50 text-gray-600 text-sm">
                              <tr>
                                  <th className="px-6 py-3">اسم الحدث</th>
                                  <th className="px-6 py-3">النوع</th>
                                  <th className="px-6 py-3">تاريخ البداية</th>
                                  <th className="px-6 py-3">تاريخ النهاية</th>
                                  <th className="px-6 py-3">الحالة</th>
                                  <th className="px-6 py-3">الوصف</th>
                                  <th className="px-6 py-3"></th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {events.map(event => (
                                  <tr key={event.id} className="hover:bg-gray-50">
                                      <td className="px-6 py-4 font-bold text-gray-800">{event.name}</td>
                                      <td className="px-6 py-4 text-sm">{getEventTypeLabel(event.type)}</td>
                                      <td className="px-6 py-4 text-sm font-mono text-gray-600">{event.start_date}</td>
                                      <td className="px-6 py-4 text-sm font-mono text-gray-600">{event.end_date}</td>
                                      <td className="px-6 py-4">{getStatusBadge(event.status)}</td>
                                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">{event.description || '-'}</td>
                                      <td className="px-6 py-4 flex justify-end gap-2">
                                          <button onClick={() => handleOpenModal(event)} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-lg">
                                              <Edit2 size={16} />
                                          </button>
                                          <button onClick={() => handleDelete(event.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg">
                                              <Trash2 size={16} />
                                          </button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  )}
              </div>
          )}

          {isModalOpen && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in">
                      <div className="flex justify-between items-center p-6 border-b">
                          <h3 className="text-xl font-bold text-gray-800">{editingId ? 'تعديل الحدث' : 'حدث جديد'}</h3>
                          <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                      </div>
                      <div className="p-6 space-y-4">
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">اسم الحدث</label>
                              <input 
                                  type="text" 
                                  className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                  value={formData.name}
                                  onChange={e => setFormData({...formData, name: e.target.value})}
                                  placeholder="مثال: التقييم الفصلي الأول"
                              />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">نوع الحدث</label>
                                  <select 
                                      className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                      value={formData.type}
                                      onChange={e => setFormData({...formData, type: e.target.value as any})}
                                  >
                                      <option value="evaluation">تقييم أداء</option>
                                      <option value="audit">تدقيق ومراجعة</option>
                                      <option value="objection">فترة اعتراضات</option>
                                      <option value="other">أخرى</option>
                                  </select>
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                                  <select 
                                      className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                                      value={formData.status}
                                      onChange={e => setFormData({...formData, status: e.target.value as any})}
                                  >
                                      <option value="upcoming">قادم (Upcoming)</option>
                                      <option value="active">نشط (Active)</option>
                                      <option value="closed">مغلق (Closed)</option>
                                  </select>
                              </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ البداية</label>
                                  <input 
                                      type="date" 
                                      className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                      value={formData.start_date}
                                      onChange={e => setFormData({...formData, start_date: e.target.value})}
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ النهاية</label>
                                  <input 
                                      type="date" 
                                      className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                      value={formData.end_date}
                                      onChange={e => setFormData({...formData, end_date: e.target.value})}
                                  />
                              </div>
                          </div>
                          <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">وصف إضافي</label>
                              <textarea 
                                  rows={3}
                                  className="w-full border p-2 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                                  value={formData.description || ''}
                                  onChange={e => setFormData({...formData, description: e.target.value})}
                              />
                          </div>
                      </div>
                      <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
                          <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">إلغاء</button>
                          <button 
                              onClick={handleSave}
                              disabled={isSaving}
                              className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50"
                          >
                              {isSaving && <Loader2 className="animate-spin" size={16} />}
                              حفظ
                          </button>
                      </div>
                  </div>
              </div>
          )}
      </div>
  );
}
