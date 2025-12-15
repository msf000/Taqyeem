
import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, Loader2, List, CheckSquare, AlignLeft, Layers, Users, Scale, AlertTriangle, ArrowLeft, Info, BookOpen, Target, CheckCircle2, Star, ChevronLeft } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { EvaluationIndicator, TeacherCategory, UserRole } from '../types';

interface IndicatorsManagementProps {
    userRole?: UserRole;
}

export default function IndicatorsManagement({ userRole }: IndicatorsManagementProps) {
  const [indicators, setIndicators] = useState<EvaluationIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false); // Controls Modal visibility
  const [isSaving, setIsSaving] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<EvaluationIndicator | null>(null); // For View Mode

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

  const handleOpen = (ind: EvaluationIndicator) => {
    setSelectedIndicator(ind);
    
    // Only populate form data if we are going to edit (Admin)
    if (!isReadOnly) {
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
    }
    
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddNew = () => {
    if (isReadOnly) return;
    setSelectedIndicator(null);
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
      alert('حدث خطأ أثناء الحذف.');
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
            delete newWeights[category]; 
        } else {
            newCategories = [...prev.applicableCategories, category];
            newWeights[category] = prev.weight;
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
      const rubricJson: Record<number, any> = {};
      [1, 2, 3, 4, 5].forEach(level => {
          rubricJson[level] = { description: formData.rubric[level] || '', evidence: '' };
      });

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

      const payload = {
          text: formData.text,
          weight: formData.weight,
          description: formData.description,
          sort_order: formData.sort_order,
          rubric: rubricJson,
          applicable_categories: formData.applicableCategories, 
          category_weights: cleanWeights
      };

      let indicatorId = formData.id;

      if (indicatorId) {
          const { error } = await supabase.from('evaluation_indicators').update(payload).eq('id', indicatorId);
          if (error) throw error;
      } else {
          const { data, error } = await supabase.from('evaluation_indicators').insert([payload]).select().single();
          if (error) throw error;
          indicatorId = data.id;
      }

      if (!indicatorId) throw new Error("Failed to get ID");

      await supabase.from('evaluation_criteria').delete().eq('indicator_id', indicatorId);
      const criteriaList = formData.criteriaText.split('\n').filter(line => line.trim() !== '');
      if (criteriaList.length > 0) {
          await supabase.from('evaluation_criteria').insert(
              criteriaList.map(text => ({ indicator_id: indicatorId, text: text.trim() }))
          );
      }

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
      alert(`حدث خطأ أثناء الحفظ: ${error.message || 'خطأ غير معروف'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // --- RENDER MODAL CONTENT ---
  const renderModalContent = () => {
      // 1. READ ONLY VIEW (Reference Guide)
      if (isReadOnly && selectedIndicator) {
          return (
              <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
                  {/* Hero Section */}
                  <div className="bg-gradient-to-r from-primary-600 to-primary-800 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                      <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -translate-x-10 -translate-y-10"></div>
                      <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-4 opacity-90">
                              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold font-mono">مؤشر رقم {(selectedIndicator as any).sort_order}</span>
                              {selectedIndicator.applicableCategories?.length > 0 ? (
                                  <span className="flex items-center gap-1 text-xs"><Users size={14}/> مخصص لفئات محددة</span>
                              ) : (
                                  <span className="flex items-center gap-1 text-xs"><Users size={14}/> عام للجميع</span>
                              )}
                          </div>
                          <h2 className="text-2xl md:text-3xl font-bold leading-tight mb-4">{selectedIndicator.text}</h2>
                          {selectedIndicator.description && (
                              <p className="text-primary-100 text-sm md:text-base max-w-3xl leading-relaxed bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                                  {selectedIndicator.description}
                              </p>
                          )}
                          <div className="mt-6 flex items-center gap-6">
                              <div className="flex flex-col">
                                  <span className="text-xs opacity-70 mb-1">الوزن النسبي</span>
                                  <span className="text-2xl font-bold">{selectedIndicator.weight} <span className="text-sm font-normal opacity-70">درجة</span></span>
                              </div>
                              <div className="w-px h-10 bg-white/20"></div>
                              <div className="flex flex-col">
                                  <span className="text-xs opacity-70 mb-1">عدد المعايير</span>
                                  <span className="text-2xl font-bold">{selectedIndicator.evaluationCriteria.length}</span>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                      {/* Left Column: Criteria & Verification */}
                      <div className="lg:col-span-2 space-y-8">
                          {/* Criteria */}
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                                  <Target className="text-primary-600" size={22}/>
                                  المعايير التفصيلية
                              </h3>
                              {selectedIndicator.evaluationCriteria.length > 0 ? (
                                  <ul className="space-y-4">
                                      {selectedIndicator.evaluationCriteria.map((crit, idx) => (
                                          <li key={idx} className="flex gap-3 text-gray-700 bg-gray-50 p-3 rounded-xl hover:bg-primary-50 transition-colors">
                                              <span className="flex-shrink-0 w-6 h-6 bg-white rounded-full flex items-center justify-center text-primary-600 font-bold text-xs shadow-sm border border-gray-200 mt-0.5">{idx + 1}</span>
                                              <span className="text-sm leading-relaxed font-medium">{crit}</span>
                                          </li>
                                      ))}
                                  </ul>
                              ) : (
                                  <p className="text-gray-400 text-sm italic text-center py-4">لا توجد معايير تفصيلية مسجلة</p>
                              )}
                          </div>

                          {/* Verification Indicators */}
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                                  <CheckSquare className="text-blue-600" size={22}/>
                                  شواهد وأدوات التحقق
                              </h3>
                              {selectedIndicator.verificationIndicators.length > 0 ? (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {selectedIndicator.verificationIndicators.map((verif, idx) => (
                                          <div key={idx} className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl text-gray-600 text-sm bg-gray-50/50">
                                              <CheckCircle2 size={16} className="text-blue-500 shrink-0"/>
                                              <span>{verif}</span>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <p className="text-gray-400 text-sm italic text-center py-4">لا توجد شواهد محددة</p>
                              )}
                          </div>
                      </div>

                      {/* Right Column: Rubric & Categories */}
                      <div className="space-y-8">
                          {/* Rubric */}
                          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                              <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b border-gray-100 pb-3">
                                  <Scale className="text-purple-600" size={22}/>
                                  سلم التقدير اللفظي
                              </h3>
                              <div className="space-y-4 relative">
                                  <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-gray-100 rounded-full"></div>
                                  {[5, 4, 3, 2, 1].map((level) => (
                                      <div key={level} className="relative pl-8 group">
                                          <div className={`absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 z-10 bg-white
                                              ${level >= 4 ? 'border-green-500 text-green-600' : level === 3 ? 'border-blue-500 text-blue-600' : 'border-red-500 text-red-600'}
                                          `}>
                                              {level}
                                          </div>
                                          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 leading-relaxed border border-transparent group-hover:border-gray-200 group-hover:bg-white group-hover:shadow-sm transition-all">
                                              {selectedIndicator.rubric[level]?.description || <span className="text-gray-400 italic">لا يوجد وصف</span>}
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>

                          {/* Categories */}
                          {selectedIndicator.applicableCategories?.length > 0 && (
                              <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
                                  <h3 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                                      <Users size={16}/> الفئات المستهدفة
                                  </h3>
                                  <div className="flex flex-wrap gap-2">
                                      {selectedIndicator.applicableCategories.map((cat, i) => (
                                          <span key={i} className="bg-white text-blue-600 px-3 py-1 rounded-full text-xs font-bold border border-blue-100 shadow-sm">
                                              {cat}
                                          </span>
                                      ))}
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          );
      }

      // 2. ADMIN EDIT FORM
      return (
          <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
              {/* Basic Info */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-8">
                      <label className="block text-sm font-medium text-gray-700 mb-1">نص المؤشر</label>
                      <input 
                          type="text" 
                          className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                          value={formData.text}
                          onChange={e => setFormData({...formData, text: e.target.value})}
                      />
                  </div>
                  <div className="grid grid-cols-2 gap-4 md:col-span-4">
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">الوزن</label>
                          <input 
                              type="number" 
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                              value={formData.weight}
                              onChange={e => setFormData({...formData, weight: parseFloat(e.target.value)})}
                          />
                      </div>
                      <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">الترتيب</label>
                          <input 
                              type="number" 
                              className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500"
                              value={formData.sort_order}
                              onChange={e => setFormData({...formData, sort_order: parseInt(e.target.value)})}
                          />
                      </div>
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

              {/* Target Categories */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3">
                      <Users size={16} /> الفئات المستهدفة (اتركها فارغة للجميع)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-4">
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
                  {formData.applicableCategories.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-3 border-t border-blue-200 pt-3">
                          {formData.applicableCategories.map(cat => (
                              <div key={cat} className="bg-white p-2 rounded border border-blue-100">
                                  <label className="block text-[10px] text-gray-500 mb-1">وزن {cat}</label>
                                  <input 
                                      type="number"
                                      className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                                      value={formData.categoryWeights[cat] !== undefined ? formData.categoryWeights[cat] : formData.weight}
                                      onChange={(e) => handleCategoryWeightChange(cat, e.target.value)}
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
                          className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 text-sm"
                          value={formData.criteriaText}
                          onChange={e => setFormData({...formData, criteriaText: e.target.value})}
                          placeholder="اكتب كل معيار في سطر جديد"
                      />
                  </div>
                  <div>
                      <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2">
                          <CheckSquare size={16} /> شواهد التحقق
                      </label>
                      <textarea 
                          rows={6}
                          className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 text-sm"
                          value={formData.verificationText}
                          onChange={e => setFormData({...formData, verificationText: e.target.value})}
                          placeholder="اكتب كل شاهد في سطر جديد"
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

              {formData.id && (
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
      );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Top Header if Modal NOT Open */}
      {!isEditing && (
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <AlignLeft className="text-primary-600" />
              {isReadOnly ? 'دليل المؤشرات المرجعي' : 'إدارة المؤشرات'}
            </h2>
            {!isReadOnly && (
                <button 
                onClick={handleAddNew}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-sm text-sm font-bold"
                >
                <Plus size={18} />
                إضافة جديد
                </button>
            )}
          </div>
      )}

      {/* Main Content Area (List or Modal) */}
      {isEditing ? (
          <div className="fixed inset-0 bg-gray-100 z-[60] flex flex-col animate-fade-in">
              {/* Sticky Header */}
              <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10 flex justify-between items-center shadow-sm safe-top">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setIsEditing(false)} className="p-2 -mr-2 text-gray-500 hover:bg-gray-100 rounded-full">
                          <ArrowLeft size={24} />
                      </button>
                      <h3 className="font-bold text-lg text-gray-800 truncate max-w-[200px] md:max-w-md">
                          {isReadOnly ? 'تفاصيل المؤشر' : (formData.id ? 'تعديل المؤشر' : 'إضافة مؤشر')}
                      </h3>
                  </div>
                  {!isReadOnly && (
                      <button 
                          onClick={handleSave} 
                          disabled={isSaving}
                          className="bg-primary-600 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-sm disabled:opacity-50 flex items-center gap-2"
                      >
                          {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18}/>}
                          حفظ
                      </button>
                  )}
              </div>
              
              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 pb-24 custom-scrollbar">
                  {renderModalContent()}
              </div>
          </div>
      ) : (
          /* List View */
          isLoading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="animate-spin text-primary-600" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {indicators.length === 0 && <div className="col-span-full text-center p-12 text-gray-500 bg-white rounded-xl border border-dashed">لا توجد مؤشرات مسجلة حتى الآن</div>}
              
              {indicators.map((ind) => (
                <div 
                    key={ind.id} 
                    onClick={() => handleOpen(ind)}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between h-full"
                >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-primary-50 rounded-bl-full -mr-10 -mt-10 transition-colors group-hover:bg-primary-100"></div>
                    
                    <div>
                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <div className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center font-bold text-gray-500 shadow-sm group-hover:border-primary-200 group-hover:text-primary-600">
                                { (ind as any).sort_order }
                            </div>
                            <span className="bg-primary-50 text-primary-700 text-xs px-3 py-1 rounded-full font-bold border border-primary-100">
                                {ind.weight} درجة
                            </span>
                        </div>
                        
                        <h3 className="font-bold text-gray-800 text-lg mb-2 leading-snug group-hover:text-primary-800 transition-colors">{ind.text}</h3>
                        
                        {ind.description && (
                            <p className="text-gray-500 text-xs line-clamp-2 mb-4 leading-relaxed">
                                {ind.description}
                            </p>
                        )}
                    </div>

                    <div className="space-y-3 mt-auto">
                        <div className="flex flex-wrap gap-2">
                            {ind.applicableCategories && ind.applicableCategories.length > 0 ? (
                                ind.applicableCategories.slice(0, 2).map(cat => (
                                    <span key={cat} className="bg-blue-50 text-blue-700 text-[10px] px-2 py-0.5 rounded border border-blue-100">
                                    {cat}
                                    </span>
                                ))
                            ) : (
                                <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">عام للجميع</span>
                            )}
                            {ind.applicableCategories && ind.applicableCategories.length > 2 && (
                                <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded">+{ind.applicableCategories.length - 2}</span>
                            )}
                        </div>

                        <div className="flex items-center justify-between text-xs text-gray-400 border-t border-gray-50 pt-3">
                            <div className="flex gap-3">
                                <span className="flex items-center gap-1"><List size={14}/> {ind.evaluationCriteria.length} معايير</span>
                                <span className="flex items-center gap-1"><CheckSquare size={14}/> {ind.verificationIndicators.length} شواهد</span>
                            </div>
                            <span className="text-primary-600 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                التفاصيل <ChevronLeft size={14}/>
                            </span>
                        </div>
                    </div>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}
