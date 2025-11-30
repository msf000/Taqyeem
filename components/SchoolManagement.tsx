
import React, { useState, useEffect } from 'react';
import { Plus, School as SchoolIcon, Edit2, Trash2, Eye, Settings, Loader2, X, CheckSquare, Building, User } from 'lucide-react';
import { School, UserRole } from '../types';
import { supabase } from '../supabaseClient';

interface SchoolManagementProps {
  userRole?: UserRole;
  schoolId?: string;
  userName?: string;
}

export default function SchoolManagement({ userRole, schoolId, userName }: SchoolManagementProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewSchool, setViewSchool] = useState<School | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<School>>({});

  // Helper for error messages
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

  // Fetch Schools
  const fetchSchools = async () => {
    setIsLoading(true);
    try {
      let query = supabase.from('schools').select('*').order('created_at', { ascending: false });

      // Filter for Principal
      if (userRole === UserRole.PRINCIPAL && userName) {
          // Fetch ALL schools managed by this user (by name), ignoring the single session schoolId
          // This allows multi-school management
          query = query.eq('manager_name', userName);
      } else if (userRole === UserRole.PRINCIPAL && schoolId) {
          // Fallback if name is missing
          query = query.eq('id', schoolId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map DB snake_case to CamelCase types
      const mappedSchools: School[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        stage: item.stage,
        type: item.type,
        ministryId: item.ministry_id,
        managerName: item.manager_name,
        managerNationalId: item.manager_national_id, // Map new field
        evaluatorName: item.evaluator_name
      }));

      setSchools(mappedSchools);
    } catch (error) {
      console.error('Error fetching schools:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchools();
  }, [userRole, schoolId, userName]);

  const handleOpenAdd = () => {
      // If Principal, auto-set manager name
      setFormData(userRole === UserRole.PRINCIPAL ? { managerName: userName } : {});
      setEditingId(null);
      setIsFormOpen(true);
  };

  const handleEditSchool = (school: School) => {
      setFormData({
          name: school.name,
          ministryId: school.ministryId,
          stage: school.stage,
          type: school.type,
          managerName: school.managerName,
          managerNationalId: school.managerNationalId,
          evaluatorName: school.evaluatorName
      });
      setEditingId(school.id);
      setIsFormOpen(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSaveSchool = async () => {
    if (!formData.name || !formData.ministryId) {
        alert("يرجى إدخال اسم المدرسة والرقم الوزاري");
        return;
    }

    setIsSaving(true);
    try {
      // Enforce manager name for principals to ensure they own the record
      const manager = (userRole === UserRole.PRINCIPAL && userName) ? userName : formData.managerName;

      const payload = {
        name: formData.name,
        stage: formData.stage,
        type: formData.type,
        ministry_id: formData.ministryId,
        manager_name: manager,
        manager_national_id: formData.managerNationalId, // Save new field
        evaluator_name: formData.evaluatorName
      };

      if (editingId) {
          // Update
          const { error } = await supabase.from('schools').update(payload).eq('id', editingId);
          if (error) throw error;
      } else {
          // Insert
          const { error } = await supabase.from('schools').insert([payload]);
          if (error) throw error;
      }

      await fetchSchools(); // Refresh list
      setIsFormOpen(false);
      setFormData({});
      setEditingId(null);
  } catch (error: any) {
      console.error('Error saving school:', error);
      alert('حدث خطأ أثناء حفظ المدرسة: ' + getErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchool = async (id: string): Promise<boolean> => {
    if (!window.confirm('هل أنت متأكد تماماً من حذف هذه المدرسة؟ سيؤدي هذا الإجراء إلى حذف جميع البيانات المرتبطة بها (معلمين، تقييمات، اشتراكات).')) return false;

    try {
      // Attempt delete first
      const { error } = await supabase.from('schools').delete().eq('id', id);
      
      if (error) {
          // Check for foreign key constraint error (Postgres code 23503)
          if (error.code === '23503') {
              if (window.confirm('لا يمكن حذف المدرسة لأنها مرتبطة بسجلات أخرى (معلمين، مستخدمين، تقييمات). هل ترغب في فك ارتباط هذه السجلات وحذف المدرسة؟')) {
                   // Clean up logic manually just in case DB cascade is not set up
                   
                   // 1. Unlink Teachers (Set school_id to null)
                   await supabase.from('teachers').update({ school_id: null }).eq('school_id', id);
                   
                   // 2. Unlink Users (Set school_id to null)
                   await supabase.from('app_users').update({ school_id: null }).eq('school_id', id);
                   
                   // 3. Unlink Evaluations (Set school_id to null)
                   await supabase.from('evaluations').update({ school_id: null }).eq('school_id', id);

                   // 4. Delete Subscriptions (Cascade usually works, but safe to delete)
                   await supabase.from('subscriptions').delete().eq('school_id', id);

                   // 5. Retry Delete School
                   const { error: retryError } = await supabase.from('schools').delete().eq('id', id);
                   if (retryError) throw retryError;
                   
                   setSchools(schools.filter(s => s.id !== id));
                   alert('تم حذف المدرسة وفك ارتباط السجلات التابعة لها بنجاح.');
                   return true;
              } else {
                  return false; // User cancelled clean up
              }
          }
          throw error; // Other error
      }
      
      // Success on first try
      setSchools(schools.filter(s => s.id !== id));
      alert('تم حذف المدرسة بنجاح.');
      return true;
    } catch (error: any) {
      console.error('Error deleting school:', error);
      alert('حدث خطأ أثناء الحذف: ' + getErrorMessage(error));
      return false;
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <SchoolIcon className="text-primary-600" />
          {userRole === UserRole.PRINCIPAL ? 'إدارة مدارسي' : 'إدارة المدارس'}
        </h2>
        
        {/* Show Add button for Admin AND Principal */}
        {!isFormOpen && (
            <button 
            onClick={handleOpenAdd}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-sm transition-all"
            >
            <Plus size={18} />
            {userRole === UserRole.PRINCIPAL ? 'إضافة مدرسة جديدة' : 'إضافة مدرسة'}
            </button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isFormOpen && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in ring-1 ring-primary-100">
          <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
              <h3 className="font-bold text-lg text-primary-800">
                  {editingId ? 'تعديل بيانات المدرسة' : 'بيانات المدرسة الجديدة'}
              </h3>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X size={20}/>
              </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المدرسة <span className="text-red-500">*</span></label>
                <input 
                type="text" 
                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="مثال: مدرسة الرياض النموذجية"
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الرقم الوزاري <span className="text-red-500">*</span></label>
                <input 
                type="text" 
                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.ministryId || ''}
                onChange={e => setFormData({...formData, ministryId: e.target.value})}
                />
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">المرحلة التعليمية</label>
                <select 
                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                value={formData.stage || ''}
                onChange={e => setFormData({...formData, stage: e.target.value})}
                >
                <option value="">اختر المرحلة</option>
                <option value="الابتدائية">الابتدائية</option>
                <option value="المتوسطة">المتوسطة</option>
                <option value="الثانوية">الثانوية</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المدرسة</label>
                <select 
                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none bg-white"
                value={formData.type || ''}
                onChange={e => setFormData({...formData, type: e.target.value})}
                >
                <option value="">اختر النوع</option>
                <option value="بنين">بنين</option>
                <option value="بنات">بنات</option>
                </select>
            </div>
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم مدير المدرسة</label>
                <input 
                type="text" 
                className={`w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none ${userRole === UserRole.PRINCIPAL ? 'bg-gray-50 text-gray-500' : ''}`}
                value={formData.managerName || ''}
                onChange={e => setFormData({...formData, managerName: e.target.value})}
                disabled={userRole === UserRole.PRINCIPAL} // Lock for principals
                />
            </div>
            
            {/* Show Manager ID field only if NOT Principal (Admin only) */}
            {userRole !== UserRole.PRINCIPAL && (
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">رقم هوية المدير</label>
                <input 
                type="text" 
                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-mono"
                placeholder="10xxxxxxxx"
                value={formData.managerNationalId || ''}
                onChange={e => setFormData({...formData, managerNationalId: e.target.value})}
                />
            </div>
            )}

            <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم مقيم الأداء</label>
                <input 
                type="text" 
                className="w-full border p-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none"
                value={formData.evaluatorName || ''}
                onChange={e => setFormData({...formData, evaluatorName: e.target.value})}
                />
            </div>
          </div>
          
          {/* Footer Buttons including Delete */}
          <div className="mt-6 flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-4 border-t border-gray-100">
             <div className="w-full sm:w-auto">
                {editingId && (
                    <button 
                        onClick={async () => {
                            const success = await handleDeleteSchool(editingId);
                            if (success) {
                                setIsFormOpen(false);
                                setEditingId(null);
                                setFormData({});
                            }
                        }}
                        className="w-full sm:w-auto px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Trash2 size={18} /> حذف المدرسة
                    </button>
                )}
             </div>
             
             <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button 
                  onClick={() => setIsFormOpen(false)} 
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  إلغاء
                </button>
                <button 
                  onClick={handleSaveSchool}
                  disabled={isSaving}
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 shadow-sm transition-colors"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={18} /> : (editingId ? <CheckSquare size={18}/> : <Plus size={18} />)}
                  {editingId ? 'حفظ التعديلات' : 'إضافة المدرسة'}
                </button>
             </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewSchool && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in">
                  <div className="flex justify-between items-center p-6 border-b">
                      <h3 className="text-xl font-bold flex items-center gap-2">
                          <SchoolIcon className="text-primary-600" /> 
                          {viewSchool.name}
                      </h3>
                      <button onClick={() => setViewSchool(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                          <div>
                              <label className="text-xs text-gray-500">الرقم الوزاري</label>
                              <p className="font-medium">{viewSchool.ministryId}</p>
                          </div>
                          <div>
                              <label className="text-xs text-gray-500">المرحلة</label>
                              <p className="font-medium">{viewSchool.stage}</p>
                          </div>
                          <div>
                              <label className="text-xs text-gray-500">النوع</label>
                              <p className="font-medium">{viewSchool.type}</p>
                          </div>
                          <div>
                              <label className="text-xs text-gray-500">المدير</label>
                              <p className="font-medium">{viewSchool.managerName || '-'}</p>
                          </div>
                          {userRole !== UserRole.PRINCIPAL && (
                              <div>
                                  <label className="text-xs text-gray-500">هوية المدير</label>
                                  <p className="font-medium font-mono">{viewSchool.managerNationalId || '-'}</p>
                              </div>
                          )}
                          <div className="col-span-2">
                              <label className="text-xs text-gray-500">المقيم المعتمد</label>
                              <p className="font-medium bg-gray-50 p-2 rounded">{viewSchool.evaluatorName || '-'}</p>
                          </div>
                      </div>
                  </div>
                  <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end">
                      <button onClick={() => setViewSchool(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">إغلاق</button>
                  </div>
              </div>
          </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <div className="flex justify-between items-center">
             <h3 className="font-bold text-gray-700 text-lg">
                {userRole === UserRole.PRINCIPAL ? `المدارس التابعة لي (${schools.length})` : `المدارس المسجلة (${schools.length})`}
             </h3>
          </div>
          
          {schools.length === 0 && (
            <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                <SchoolIcon size={48} className="mx-auto mb-4 text-gray-300" />
                <p>لا توجد مدارس متاحة.</p>
                <button onClick={handleOpenAdd} className="mt-4 text-primary-600 hover:underline">أضف مدرستك الأولى</button>
            </div>
          )}

          {schools.map(school => (
            <div key={school.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-md transition-shadow">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-primary-50 p-2 rounded-lg">
                      <Building className="text-primary-600" size={20} />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900">{school.name}</h4>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{school.stage}</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{school.ministryId}</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm text-gray-500 mr-11">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> المدير: {school.managerName || 'غير محدد'}</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400"></span> المقيم: {school.evaluatorName || 'غير محدد'}</span>
                  <span>النوع: {school.type}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex bg-gray-50 rounded-lg p-1 border border-gray-100">
                  <button 
                    onClick={() => setViewSchool(school)}
                    className="p-2 hover:bg-white hover:text-blue-600 hover:shadow rounded-md text-gray-500 transition-all" 
                    title="عرض التفاصيل"
                  >
                      <Eye size={18} />
                  </button>
                  <button 
                    onClick={() => handleEditSchool(school)}
                    className="p-2 hover:bg-white hover:text-green-600 hover:shadow rounded-md text-gray-500 transition-all" 
                    title="تعديل"
                  >
                      <Edit2 size={18} />
                  </button>
                  
                  {/* Allow Deletion for Principal if they added it */}
                  <div className="w-px bg-gray-200 mx-1"></div>
                  <button 
                    onClick={() => handleDeleteSchool(school.id)} 
                    className="p-2 hover:bg-white hover:text-red-600 hover:shadow rounded-md text-gray-500 transition-all" 
                    title="حذف"
                  >
                      <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
