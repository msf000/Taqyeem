
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, List, CheckSquare, AlignLeft, Layers, Users, Scale, AlertTriangle, ArrowLeft, Info, BookOpen } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { EvaluationIndicator, TeacherCategory, UserRole } from '../types';

interface IndicatorsManagementProps {
    userRole?: UserRole;
}

export default function IndicatorsManagement({ userRole }: IndicatorsManagementProps) {
  const [indicators, setIndicators] = useState<EvaluationIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Read-Only Check
  const isReadOnly = userRole !== UserRole.ADMIN;

  // Form State
  const [formData, setFormData] = useState<{
    id?: string;
    text: string;
    weight: number;
    description: string;
    sort_order: number;
    criteriaText: string; // Newline separated
    verificationText: string; // Newline separated
    rubric: Record<number, string>; // Level -> Description
    applicableCategories: TeacherCategory[];
    categoryWeights: Record<string, number>;
  }>({
    text: '',
    weight: 0,
    description: '',
    sort_order: 0,
    criteriaText: '',
    verificationText: '',
    rubric: { 1: '', 2: '', 3: '', 4: '', 5: '' },
    applicableCategories: [],
    categoryWeights: {}
  });

  const fetchIndicators = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('evaluation_indicators')
        .select(`
          *,
          evaluation_criteria (text),
          verification_indicators (text)
        `)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const mappedData: EvaluationIndicator[] = (data || []).map((ind: any) => ({
        id: ind.id,
        text: ind.text,
        weight: ind.weight,
        description: ind.description,
        sort_order: ind.sort_order, // Keep track of sort order
        evaluationCriteria: ind.evaluation_criteria?.map((c: any) => c.text) || [],
        verificationIndicators: ind.verification_indicators?.map((v: any) => v.text) || [],
        rubric: ind.rubric || {},
        applicableCategories: ind.applicable_categories || [], // Map from DB snake_case
        categoryWeights: ind.category_weights || {}
      }));

      setIndicators(mappedData);
    } catch (error) {
      console.error('Error fetching indicators:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIndicators();
  }, []);

  const handleEdit = (ind: EvaluationIndicator) => {
    // If read-only, we might want to just show details, but for now we reuse the form in "view" mode logic or disable inputs
    // Or simpler: Reuse the form but hide save buttons if read-only
    const rubricMap: Record<number, string> = {};
    [1, 2, 3, 4, 5].forEach(level => {
        rubricMap[level] = ind.rubric[level]?.description || '';
    });

    setFormData({
      id: ind.id,
      text: ind.text,
      weight: ind.weight,
      description: ind.description,
      sort_order: (ind as any).sort_order || 0,
      criteriaText: ind.evaluationCriteria.join('\n'),
      verificationText: ind.verificationIndicators.join('\n'),
      rubric: rubricMap,
      applicableCategories: ind.applicableCategories || [],
      categoryWeights: ind.categoryWeights || {}
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddNew = () => {
    if (isReadOnly) return;
    setFormData({
      text: '',
      weight: 10,
      description: '',
      sort_order: indicators.length + 1,
      criteriaText: '',
      verificationText: '',
      rubric: { 1: '', 2: '', 3: '', 4: '', 5: '' },
      applicableCategories: [],
      categoryWeights: {}
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    if (isReadOnly) return false;
    if (!window.confirm('هل أنت متأكد من حذف هذا المؤشر؟ سيتم حذف جميع المعايير المرتبطة بها.')) return false;

    try {
      const { error } = await supabase.from('evaluation_indicators').delete().eq('id', id);
      if (error) throw error;
      
      setIndicators(indicators.filter(i => i.id !== id));
      return true;
    } catch (error: any) {
      console.error('Error deleting:', error);
      const msg = error?.message || error?.error_description || (typeof error === 'string' ? error : JSON.stringify(error));
      alert('حدث خطأ أثناء الحذف: ' + msg);
      return false;
    }
  };

  const toggleCategory = (category: TeacherCategory) => {
    if (isReadOnly) return;
    setFormData(prev => {
        const exists = prev.applicableCategories.includes(category);
        let newCategories;
        let newWeights = { ...prev.categoryWeights };

        if (exists) {
            newCategories = prev.applicableCategories.filter(c => c !== category);
            delete newWeights[category]; // Remove weight config if category removed
        } else {
            newCategories = [...prev.applicableCategories, category];
            newWeights[category] = prev.weight; // Default to main weight
        }
        return { ...prev, applicableCategories: newCategories, categoryWeights: newWeights };
    });
  };

  const handleCategoryWeightChange = (category: string, value: string) => {
      if (isReadOnly) return;
      const val = parseFloat(value);
      setFormData(prev => ({
          ...prev,
          categoryWeights: {
              ...prev.categoryWeights,
              [category]: isNaN(val) ? 0 : val
          }
      }));
  };

  const handleSave = async () => {
    if (isReadOnly) return;
    if (!formData.text) return alert('يرجى إدخال نص المؤشر');
    
    setIsSaving(true);
    try {
      // 1. Construct Rubric JSON
      const rubricJson: Record<number, any> = {};
      [1, 2, 3, 4, 5].forEach(level => {
          rubricJson[level] = { description: formData.rubric[level] || '', evidence: '' };
      });

      // Prepare Category Weights
      const cleanWeights: Record<string, number> = {};
      if (formData.applicableCategories && formData.applicableCategories.length > 0) {
          formData.applicableCategories.forEach(cat => {
              if (formData.categoryWeights[cat] !== undefined) {
                  cleanWeights[cat] = Number(formData.categoryWeights[cat]);
              } else {
                  cleanWeights[cat] = Number(formData.weight);
              }
          });
      }

      // 2. Upsert Indicator
      const payload = {
          text: formData.text,
          weight: formData.weight,
          description: formData.description,
          sort_order: formData.sort_order,
          rubric: rubricJson,
          applicable_categories: formData.applicableCategories, // Send as array
          category_weights: cleanWeights // Send custom weights
      };

      let indicatorId = formData.id;

      if (indicatorId) {
          // Update
          const { error } = await supabase
              .from('evaluation_indicators')
              .update(payload)
              .eq('id', indicatorId);
          if (error) throw error;
      } else {
          // Insert
          const { data, error } = await supabase
              .from('evaluation_indicators')
              .insert([payload])
              .select()
              .single();
          if (error) throw error;
          indicatorId = data.id;
      }

      if (!indicatorId) throw new Error("Failed to get ID");

      // 3. Update Children (Strategy: Delete all -> Re-insert)
      // Criteria
      await supabase.from('evaluation_criteria').delete().eq('indicator_id', indicatorId);
      const criteriaList = formData.criteriaText.split('\n').filter(line => line.trim() !== '');
      if (criteriaList.length > 0) {
          await supabase.from('evaluation_criteria').insert(
              criteriaList.map(text => ({ indicator_id: indicatorId, text: text.trim() }))
          );
      }

      // Verification
      await supabase.from('verification_indicators').delete().eq('indicator_id', indicatorId);
      const verifList = formData.verificationText.split('\n').filter(line => line.trim() !== '');
      if (verifList.length > 0) {
          await supabase.from('verification_indicators').insert(
              verifList.map(text => ({ indicator_id: indicatorId, text: text.trim() }))
          );
      }

      await fetchIndicators();
      setIsEditing(false);

    } catch (error: any) {
      console.error('Error saving:', error);
      let msg = 'حدث خطأ غير معروف';
      if (error?.message) msg = error.message;
      else if (error?.error_description) msg = error.error_description;
      else if (typeof error === 'object') {
          try { msg = JSON.stringify(error); } catch(e) { msg = 'خطأ في كائن الخطأ'; }
      } else { msg = String(error); }

      alert(`حدث خطأ أثناء الحفظ:\n${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
      return (
          <div className="fixed inset-0 bg-gray-100 z-50 flex flex-col animate-fade-in">
              {/* Sticky Header */}
              <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 flex justify-between items-center shadow-sm">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditing(false)} className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-full">
                          <ArrowLeft size={20} />
                      </button>
                      <h3 className="font-bold text-lg text-gray-800 truncate max-w-[200px]">
                          {isReadOnly ? 'عرض تفاصيل المؤشر' : (formData.id ? 'تعديل المؤشر' : 'إضافة مؤشر')}
                      </h3>
                  </div>
                  {!isReadOnly && (
                      <button 
                          onClick={handleSave} 
                          disabled={isSaving}
                          className="bg-primary-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 flex items-center gap-1"
                      >
                          {isSaving ? <Loader2 className="animate-spin" size={16} /> : 'حفظ'}
                      </button>
                  )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 pb-24">
                  <div className="max-w-4xl mx-auto space-y-6">
                      {isReadOnly && (
                          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-center gap-3 border border-blue-200">
                              <Info size={20} className="shrink-0"/>
                              <p className="text-sm">أنت في وضع القراءة فقط. لا يمكنك تعديل المعايير.</p>
                          </div>
                      )}

                      {/* Basic Info */}
                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div className="md:col-span-8">
                              <label className="block text-sm font-medium text-gray-700 mb-1">نص المؤشر</label>
                              <input 
                                  type="text" 
                                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-600"
                                  value={formData.text}
                                  onChange={e => setFormData({...formData, text: e.target.value})}
                                  disabled={isReadOnly}
                              />
                          </div>
                          <div className="grid grid-cols-2 gap-4 md:col-span-4">
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">الوزن</label>
                                  <input 
                                      type="number" 
                                      className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-600"
                                      value={formData.weight}
                                      onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}
                                      disabled={isReadOnly}
                                  />
                              </div>
                              <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب</label>
                                  <input 
                                      type="number" 
                                      className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-600"
                                      value={formData.sort_order}
                                      onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})}
                                      disabled={isReadOnly}
                                  />
                              </div>
                          </div>
                          <div className="md:col-span-12">
                              <label className="block text-sm font-medium text-gray-700 mb-1">وصف المؤشر</label>
                              <textarea 
                                  rows={2}
                                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 disabled:bg-gray-50 disabled:text-gray-600"
                                  value={formData.description}
                                  onChange={e => setFormData({...formData, description: e.target.value})}
                                  disabled={isReadOnly}
                              />
                          </div>
                      </div>

                      {/* Target Categories */}
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                              <Users size={16} /> الفئات المستهدفة
                          </label>
                          <div className="flex flex-wrap gap-2 mb-4">
                              {Object.values(TeacherCategory).map(cat => {
                                  const isSelected = formData.applicableCategories.includes(cat);
                                  return (
                                    <button 
                                        key={cat}
                                        onClick={() => toggleCategory(cat)}
                                        disabled={isReadOnly}
                                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                            isSelected 
                                            ? 'bg-blue-600 text-white border-blue-600' 
                                            : 'bg-white text-gray-600 border-gray-300'
                                        } ${isReadOnly ? 'cursor-default' : 'cursor-pointer'}`}
                                    >
                                        {cat}
                                        {isSelected && <span className="mr-1">✓</span>}
                                    </button>
                                  );
                              })}
                          </div>
                          {formData.applicableCategories.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 mt-3 border-t border-blue-200 pt-3">
                                  {formData.applicableCategories.map(cat => (
                                      <div key={cat} className="bg-white p-2 rounded border border-blue-100">
                                          <label className="block text-[10px] text-gray-500 mb-1">وزن {cat}</label>
                                          <input 
                                              type="number"
                                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
                                              value={formData.categoryWeights[cat] !== undefined ? formData.categoryWeights[cat] : formData.weight}
                                              onChange={(e) => handleCategoryWeightChange(cat, e.target.value)}
                                              disabled={isReadOnly}
                                          />
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>

                      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                  <List size={16} /> المعايير التفصيلية
                              </label>
                              <textarea 
                                  rows={6}
                                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-50 disabled:text-gray-600"
                                  value={formData.criteriaText}
                                  onChange={e => setFormData({...formData, criteriaText: e.target.value})}
                                  placeholder={isReadOnly ? '' : "كل معيار في سطر جديد"}
                                  disabled={isReadOnly}
                              />
                          </div>
                          <div>
                              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                                  <CheckSquare size={16} /> شواهد التحقق
                              </label>
                              <textarea 
                                  rows={6}
                                  className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 text-sm disabled:bg-gray-50 disabled:text-gray-600"
                                  value={formData.verificationText}
                                  onChange={e => setFormData({...formData, verificationText: e.target.value})}
                                  placeholder={isReadOnly ? '' : "كل شاهد في سطر جديد"}
                                  disabled={isReadOnly}
                              />
                          </div>
                      </div>

                      {/* Rubric */}
                      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
                              <Layers size={16} /> سلم التقدير (Rubric)
                          </label>
                          <div className="space-y-3">
                              {[5, 4, 3, 2, 1].map(level => (
                                  <div key={level} className="flex gap-2">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-1
                                          ${level >= 4 ? 'bg-green-100 text-green-700' : level >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}
                                      `}>
                                          {level}
                                      </div>
                                      <textarea 
                                          rows={2}
                                          className="flex-1 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:text-gray-600"
                                          placeholder={`وصف المستوى ${level}`}
                                          value={formData.rubric[level]}
                                          onChange={e => setFormData({
                                              ...formData, 
                                              rubric: { ...formData.rubric, [level]: e.target.value } 
                                          })}
                                          disabled={isReadOnly}
                                      />
                                  </div>
                              ))}
                          </div>
                      </div>

                      {!isReadOnly && formData.id && (
                          <div className="pt-4">
                              <button 
                                  onClick={async () => {
                                      const success = await handleDelete(formData.id!);
                                      if (success) setIsEditing(false);
                                  }}
                                  className="w-full py-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center gap-2 text-sm font-bold"
                              >
                                  <Trash2 size={18} /> حذف المؤشر نهائياً
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <AlignLeft className="text-primary-600" />
          {isReadOnly ? 'دليل المؤشرات' : 'إدارة المؤشرات'}
        </h2>
        {!isReadOnly && (
            <button 
            onClick={handleAddNew}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-sm text-sm font-bold"
            >
            <Plus size={18} />
            إضافة
            </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {indicators.length === 0 && <div className="text-center p-8 text-gray-500">لا توجد مؤشرات مسجلة</div>}
          
          {indicators.map((ind) => (
            <div key={ind.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="flex justify-between items-start">
                    <div className="flex-1 pl-4">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-mono">#{ (ind as any).sort_order }</span>
                            <span className="bg-primary-50 text-primary-700 text-xs px-2 py-0.5 rounded font-bold">{ind.weight}</span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-base mb-2">{ind.text}</h3>
                        
                        {ind.applicableCategories && ind.applicableCategories.length > 0 ? (
                           <div className="flex flex-wrap gap-1 mb-2">
                                {ind.applicableCategories.map(cat => (
                                    <span key={cat} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded border border-blue-100">
                                       {cat}
                                    </span>
                                ))}
                           </div>
                        ) : (
                            <div className="mb-2 text-xs text-gray-400">عام (للجميع)</div>
                        )}

                        <div className="flex gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><List size={12}/> {ind.evaluationCriteria.length} معايير</span>
                            <span className="flex items-center gap-1"><CheckSquare size={12}/> {ind.verificationIndicators.length} شواهد</span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => handleEdit(ind)} 
                            className={`p-2 rounded-lg ${isReadOnly ? 'text-primary-600 bg-primary-50 hover:bg-primary-100' : 'text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50'}`}
                            title={isReadOnly ? "عرض التفاصيل" : "تعديل"}
                        >
                            {isReadOnly ? <BookOpen size={18} /> : <Edit2 size={18} />}
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
