
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, List, CheckSquare, AlignLeft, Layers, Users, Scale, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { EvaluationIndicator, TeacherCategory } from '../types';

export default function IndicatorsManagement() {
  const [indicators, setIndicators] = useState<EvaluationIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
    // Flatten rubric descriptions for form
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
  };

  const handleAddNew = () => {
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
  };

  const handleDelete = async (id: string): Promise<boolean> => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المؤشر؟ سيتم حذف جميع المعايير المرتبطة به.')) return false;

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
    if (!formData.text) return alert('يرجى إدخال نص المؤشر');
    
    setIsSaving(true);
    try {
      // 1. Construct Rubric JSON
      const rubricJson: Record<number, any> = {};
      [1, 2, 3, 4, 5].forEach(level => {
          rubricJson[level] = { description: formData.rubric[level] || '', evidence: '' };
      });

      // Prepare Category Weights - ensure only valid numbers and selected categories
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
      
      // Determine error message safely
      if (error?.message) msg = error.message;
      else if (error?.error_description) msg = error.error_description;
      else if (typeof error === 'object') {
          try {
             msg = JSON.stringify(error);
          } catch(e) { msg = 'خطأ في كائن الخطأ'; }
      } else {
          msg = String(error);
      }

      // Provide helpful hint if likely DB schema issue
      if (msg.includes('column') || msg.includes('does not exist') || msg.includes('applicable_categories')) {
          alert('فشل الحفظ: يبدو أن قاعدة البيانات تحتاج إلى تحديث لدعم "الفئات المستهدفة".\n\nيرجى الذهاب إلى صفحة "الإعدادات" ونسخ كود التحديث.');
      } else {
          alert(`حدث خطأ أثناء الحفظ:\n${msg}`);
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isEditing) {
      return (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden animate-fade-in">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                  <h3 className="font-bold text-lg text-gray-800">
                      {formData.id ? 'تعديل المؤشر' : 'إضافة مؤشر جديد'}
                  </h3>
                  <button onClick={() => setIsEditing(false)} className="text-gray-500 hover:text-gray-700">
                      <X size={24} />
                  </button>
              </div>
              
              <div className="p-6 space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                      <div className="md:col-span-8">
                          <label className="block text-sm font-medium text-gray-700 mb-1">نص المؤشر</label>
                          <input 
                              type="text" 
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                              value={formData.text}
                              onChange={e => setFormData({...formData, text: e.target.value})}
                          />
                      </div>
                      <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">الوزن الافتراضي</label>
                          <input 
                              type="number" 
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                              value={formData.weight}
                              onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}
                          />
                      </div>
                       <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب</label>
                          <input 
                              type="number" 
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                              value={formData.sort_order}
                              onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})}
                          />
                      </div>
                      <div className="md:col-span-12">
                          <label className="block text-sm font-medium text-gray-700 mb-1">وصف المؤشر</label>
                          <textarea 
                              rows={2}
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                              value={formData.description}
                              onChange={e => setFormData({...formData, description: e.target.value})}
                          />
                      </div>
                  </div>

                  {/* Target Categories & Weights */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                          <Users size={16} /> الفئات المستهدفة
                      </label>
                      <p className="text-xs text-gray-500 mb-3">اختر الفئات التي ينطبق عليها هذا المؤشر. إذا لم يتم اختيار أي فئة، سيتم تطبيقه على الجميع.</p>
                      
                      <div className="flex flex-wrap gap-3 mb-4">
                          {Object.values(TeacherCategory).map(cat => {
                              const isSelected = formData.applicableCategories.includes(cat);
                              return (
                                <button 
                                    key={cat}
                                    onClick={() => toggleCategory(cat)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                                        isSelected 
                                        ? 'bg-blue-600 text-white border-blue-600' 
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                                    }`}
                                >
                                    {cat}
                                    {isSelected && <span className="mr-1">✓</span>}
                                </button>
                              );
                          })}
                      </div>

                      {/* Custom Weights Configuration */}
                      {formData.applicableCategories.length > 0 && (
                          <div className="mt-4 border-t border-blue-200 pt-4">
                              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                                  <Scale size={16} /> تخصيص الأوزان (اختياري)
                              </label>
                              <p className="text-xs text-gray-500 mb-3">يمكنك تحديد وزن مختلف للمؤشر بناءً على الفئة الوظيفية.</p>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {formData.applicableCategories.map(cat => (
                                      <div key={cat} className="bg-white p-2 rounded-lg border border-blue-100 shadow-sm">
                                          <label className="block text-xs font-medium text-gray-600 mb-1">{cat}</label>
                                          <input 
                                              type="number"
                                              className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500"
                                              value={formData.categoryWeights[cat] !== undefined ? formData.categoryWeights[cat] : formData.weight}
                                              onChange={(e) => handleCategoryWeightChange(cat, e.target.value)}
                                              placeholder={formData.weight.toString()}
                                          />
                                      </div>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Criteria */}
                      <div>
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                              <List size={16} /> المعايير التفصيلية
                          </label>
                          <p className="text-xs text-gray-500 mb-2">ضع كل معيار في سطر جديد</p>
                          <textarea 
                              rows={8}
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 font-sm"
                              value={formData.criteriaText}
                              onChange={e => setFormData({...formData, criteriaText: e.target.value})}
                              placeholder="مثال:&#10;ينوع في استراتيجيات التدريس&#10;يراعي الفروق الفردية"
                          />
                      </div>
                      
                      {/* Verification Indicators */}
                      <div>
                          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                              <CheckSquare size={16} /> شواهد التحقق
                          </label>
                          <p className="text-xs text-gray-500 mb-2">ضع كل شاهد في سطر جديد</p>
                          <textarea 
                              rows={8}
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 font-sm"
                              value={formData.verificationText}
                              onChange={e => setFormData({...formData, verificationText: e.target.value})}
                              placeholder="مثال:&#10;دفتر التحضير&#10;سجل الدرجات"
                          />
                      </div>
                  </div>

                  {/* Rubric */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-4">
                          <Layers size={16} /> سلم التقدير اللفظي (Rubric)
                      </label>
                      <div className="space-y-3">
                          {[5, 4, 3, 2, 1].map(level => (
                              <div key={level} className="flex items-center gap-4">
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                                      ${level >= 4 ? 'bg-green-100 text-green-700' : level >= 3 ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}
                                  `}>
                                      {level}
                                  </div>
                                  <input 
                                      type="text" 
                                      className="flex-1 border rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500"
                                      placeholder={`وصف المستوى ${level}`}
                                      value={formData.rubric[level]}
                                      onChange={e => setFormData({
                                          ...formData, 
                                          rubric: { ...formData.rubric, [level]: e.target.value } 
                                      })}
                                  />
                              </div>
                          ))}
                      </div>
                  </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-between items-center gap-3">
                  <div className="flex-1">
                      {formData.id && (
                          <button 
                              onClick={async () => {
                                  const success = await handleDelete(formData.id!);
                                  if (success) setIsEditing(false);
                              }}
                              className="px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-2 text-sm"
                          >
                              <Trash2 size={16} /> حذف المؤشر
                          </button>
                      )}
                  </div>
                  <div className="flex gap-2">
                      <button onClick={() => setIsEditing(false)} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-white">إلغاء</button>
                      <button 
                          onClick={handleSave} 
                          disabled={isSaving}
                          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2 disabled:opacity-50"
                      >
                          {isSaving && <Loader2 className="animate-spin" size={16} />}
                          حفظ التغييرات
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <AlignLeft className="text-primary-600" />
          إدارة مؤشرات الأداء
        </h2>
        <button 
          onClick={handleAddNew}
          className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          إضافة مؤشر جديد
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-primary-600" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {indicators.length === 0 && <div className="text-center p-8 text-gray-500">لا توجد مؤشرات مسجلة</div>}
          
          {indicators.map((ind) => (
            <div key={ind.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow group">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-mono">#{ (ind as any).sort_order }</span>
                            <h3 className="font-bold text-gray-800 text-lg">{ind.text}</h3>
                            <span className="bg-primary-50 text-primary-700 text-xs px-2 py-1 rounded-full font-bold">{ind.weight} درجة</span>
                        </div>
                        <p className="text-sm text-gray-500 mb-3">{ind.description}</p>
                        
                        {ind.applicableCategories && ind.applicableCategories.length > 0 ? (
                           <div className="flex flex-wrap gap-2 mb-3">
                                {ind.applicableCategories.map(cat => (
                                    <span key={cat} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded-full border border-blue-100 flex items-center gap-1">
                                       {cat}
                                       {ind.categoryWeights && ind.categoryWeights[cat] && ind.categoryWeights[cat] !== ind.weight && (
                                           <span className="bg-white px-1 rounded text-blue-800 font-bold">{ind.categoryWeights[cat]}</span>
                                       )}
                                    </span>
                                ))}
                           </div>
                        ) : (
                            <div className="mb-3 text-xs text-gray-400">ينطبق على الجميع</div>
                        )}

                        <div className="flex gap-4 text-xs text-gray-400">
                            <span className="flex items-center gap-1"><List size={12}/> {ind.evaluationCriteria.length} معايير</span>
                            <span className="flex items-center gap-1"><CheckSquare size={12}/> {ind.verificationIndicators.length} شواهد</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(ind)} className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                            <Edit2 size={18} />
                        </button>
                        <button onClick={() => handleDelete(ind.id)} className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
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