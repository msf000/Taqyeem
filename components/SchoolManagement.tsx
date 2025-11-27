import React, { useState, useEffect } from 'react';
import { Plus, School as SchoolIcon, Edit2, Trash2, Eye, Settings, Loader2 } from 'lucide-react';
import { School } from '../types';
import { supabase } from '../supabaseClient';

export default function SchoolManagement() {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form State
  const [newSchool, setNewSchool] = useState<Partial<School>>({});

  // Fetch Schools
  const fetchSchools = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Map DB snake_case to CamelCase types
      const mappedSchools: School[] = (data || []).map(item => ({
        id: item.id,
        name: item.name,
        stage: item.stage,
        type: item.type,
        ministryId: item.ministry_id,
        managerName: item.manager_name,
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
  }, []);

  const handleAddSchool = async () => {
    if (!newSchool.name || !newSchool.ministryId) return;

    setIsSaving(true);
    try {
      const payload = {
        name: newSchool.name,
        stage: newSchool.stage,
        type: newSchool.type,
        ministry_id: newSchool.ministryId,
        manager_name: newSchool.managerName,
        evaluator_name: newSchool.evaluatorName
      };

      const { error } = await supabase.from('schools').insert([payload]);
      
      if (error) throw error;

      await fetchSchools(); // Refresh list
      setIsAdding(false);
      setNewSchool({});
    } catch (error) {
      console.error('Error adding school:', error);
      alert('حدث خطأ أثناء حفظ المدرسة');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSchool = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المدرسة؟')) return;

    try {
      const { error } = await supabase.from('schools').delete().eq('id', id);
      if (error) throw error;
      setSchools(schools.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting school:', error);
      alert('لا يمكن حذف المدرسة، قد تكون مرتبطة بمعلمين');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <SchoolIcon className="text-primary-600" />
          إدارة المدارس
        </h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"
        >
          <Plus size={18} />
          إضافة مدرسة جديدة
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
          <h3 className="font-bold text-lg mb-4">بيانات المدرسة الجديدة</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="text" 
              placeholder="اسم المدرسة" 
              className="border p-2 rounded-lg"
              value={newSchool.name || ''}
              onChange={e => setNewSchool({...newSchool, name: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="الرقم الوزاري" 
              className="border p-2 rounded-lg"
              value={newSchool.ministryId || ''}
              onChange={e => setNewSchool({...newSchool, ministryId: e.target.value})}
            />
            <select 
              className="border p-2 rounded-lg"
              value={newSchool.stage || ''}
              onChange={e => setNewSchool({...newSchool, stage: e.target.value})}
            >
              <option value="">المرحلة التعليمية</option>
              <option value="الابتدائية">الابتدائية</option>
              <option value="المتوسطة">المتوسطة</option>
              <option value="الثانوية">الثانوية</option>
            </select>
            <select 
              className="border p-2 rounded-lg"
              value={newSchool.type || ''}
              onChange={e => setNewSchool({...newSchool, type: e.target.value})}
            >
              <option value="">النوع</option>
              <option value="بنين">بنين</option>
              <option value="بنات">بنات</option>
            </select>
            <input 
              type="text" 
              placeholder="اسم مدير المدرسة" 
              className="border p-2 rounded-lg"
              value={newSchool.managerName || ''}
              onChange={e => setNewSchool({...newSchool, managerName: e.target.value})}
            />
            <input 
              type="text" 
              placeholder="اسم مقيم الأداء" 
              className="border p-2 rounded-lg"
              value={newSchool.evaluatorName || ''}
              onChange={e => setNewSchool({...newSchool, evaluatorName: e.target.value})}
            />
          </div>
          <div className="mt-4 flex gap-2 justify-end">
             <button 
              onClick={() => setIsAdding(false)} 
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              إلغاء
            </button>
            <button 
              onClick={handleAddSchool}
              disabled={isSaving}
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : null}
              حفظ المدرسة
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          <h3 className="font-bold text-gray-700 text-lg">مدارسي ({schools.length})</h3>
          {schools.length === 0 && <p className="text-gray-500">لا توجد مدارس مضافة.</p>}
          {schools.map(school => (
            <div key={school.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h4 className="text-xl font-bold text-gray-900">{school.name}</h4>
                  <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">{school.stage}</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">{school.ministryId}</span>
                </div>
                <div className="flex gap-6 text-sm text-gray-500">
                  <span>المدير: {school.managerName}</span>
                  <span>المقيم: {school.evaluatorName}</span>
                  <span>النوع: {school.type}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                <div className="flex bg-gray-50 rounded-lg p-1">
                  <button className="p-2 hover:bg-white hover:shadow rounded-md text-gray-600" title="عرض"><Eye size={18} /></button>
                  <button className="p-2 hover:bg-white hover:shadow rounded-md text-gray-600" title="تحرير"><Edit2 size={18} /></button>
                  <button className="p-2 hover:bg-white hover:shadow rounded-md text-gray-600" title="إعدادات"><Settings size={18} /></button>
                  <button onClick={() => handleDeleteSchool(school.id)} className="p-2 hover:bg-white hover:shadow rounded-md text-red-600" title="حذف"><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}