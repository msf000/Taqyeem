
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Save, Printer, ArrowRight, CheckCircle2, UploadCloud, Star, Loader2, AlertCircle, Calendar } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore, TeacherCategory, SchoolEvent } from '../types';
import PrintView from './PrintView';
import { supabase } from '../supabaseClient';

interface EvaluationFlowProps {
  teacherId: string;
  evaluationId?: string; // Optional: If provided, edits specific evaluation. If not, creates new or finds active.
  onBack: () => void;
}

export default function EvaluationFlow({ teacherId, evaluationId, onBack }: EvaluationFlowProps) {
  const [step, setStep] = useState<'period' | 'scoring' | 'summary' | 'print'>('period');
  const [currentIndicatorIndex, setCurrentIndicatorIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Data State
  const [currentEvalId, setCurrentEvalId] = useState<string | null>(evaluationId || null);
  // Date is kept internally for DB but not shown/edited by user
  const [period, setPeriod] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const [scores, setScores] = useState<Record<string, EvaluationScore>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  
  // Dynamic Events List
  const [availableEvents, setAvailableEvents] = useState<SchoolEvent[]>([]);

  // Teacher & School Full Details for Printing
  const [teacherDetails, setTeacherDetails] = useState<{
      name: string;
      nationalId: string;
      specialty: string;
      category: string;
      schoolId: string | null;
      schoolName: string;
      ministryId: string;
  }>({
      name: '', nationalId: '', specialty: '', category: '', schoolId: null, schoolName: '', ministryId: ''
  });

  const [indicators, setIndicators] = useState<EvaluationIndicator[]>([]);

  // Robust Helper for error messages
  const getErrorMessage = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    
    // Check specific properties first (Supabase/Postgres errors) - Ensure they are strings
    if (error?.message && typeof error.message === 'string') return error.message;
    if (error?.error_description && typeof error.error_description === 'string') return error.error_description;
    if (error?.details && typeof error.details === 'string') return error.details;
    if (error?.hint && typeof error.hint === 'string') return error.hint;
    
    // Standard JS Error
    if (error instanceof Error) return error.message;
    
    // String error
    if (typeof error === 'string') return error;
    
    // Try to stringify if object
    try {
        const str = JSON.stringify(error);
        if (str === '{}' || str === '[]') return 'خطأ غير محدد في النظام';
        return str;
    } catch {
        return 'خطأ غير معروف (تعذر عرض التفاصيل)';
    }
  };

  // Fetch Data from Supabase
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Teacher Info AND Linked School Info
        const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('*, schools(name, ministry_id)') // Fetch school details via relation
            .eq('id', teacherId)
            .single();
        
        if (teacherError) throw teacherError;
        
        if (teacherData) {
            setTeacherDetails({
                name: teacherData.name,
                nationalId: teacherData.national_id,
                specialty: teacherData.specialty,
                category: teacherData.category,
                schoolId: teacherData.school_id || null, // Ensure null if undefined
                schoolName: teacherData.schools?.name || '',
                ministryId: teacherData.schools?.ministry_id || ''
            });
        }

        const teacherCategory: TeacherCategory = teacherData?.category as TeacherCategory;

        // 2. Fetch Indicators Structure
        const { data: indData, error: indError } = await supabase
          .from('evaluation_indicators')
          .select(`
            *,
            evaluation_criteria (text),
            verification_indicators (text)
          `)
          .order('sort_order', { ascending: true });

        if (indError) throw indError;

        // Map and Filter Indicators based on Category
        const mappedIndicators: EvaluationIndicator[] = (indData || [])
            .map((ind: any) => {
                const categoryWeights = ind.category_weights || {};
                const specificWeight = categoryWeights[teacherCategory];
                const finalWeight = specificWeight !== undefined ? specificWeight : ind.weight;

                return {
                    id: ind.id,
                    text: ind.text,
                    weight: finalWeight,
                    description: ind.description,
                    evaluationCriteria: ind.evaluation_criteria?.map((c: any) => c.text) || [],
                    verificationIndicators: ind.verification_indicators?.map((v: any) => v.text) || [],
                    rubric: ind.rubric || {},
                    applicableCategories: ind.applicable_categories || [],
                    categoryWeights: categoryWeights
                };
            })
            .filter((ind: EvaluationIndicator) => {
                if (!ind.applicableCategories || ind.applicableCategories.length === 0) return true;
                return teacherCategory && ind.applicableCategories.includes(teacherCategory);
            });

        setIndicators(mappedIndicators);

        // 3. Fetch Active Evaluation Events (Try catch to handle missing table gracefully)
        try {
            const { data: eventsData, error: evError } = await supabase
            .from('school_events')
            .select('*')
            .eq('type', 'evaluation')
            .in('status', ['active', 'upcoming'])
            .order('start_date', { ascending: true });
            
            if (!evError && eventsData) {
                setAvailableEvents(eventsData);
            }
        } catch (e) {
            // Ignore if table doesn't exist, we fallback to default list
            console.log('Events table might not exist yet or empty');
        }

        // 4. Fetch Evaluation Data
        let evalQuery = supabase.from('evaluations').select('*');
        
        if (currentEvalId) {
            // If explicit ID provided (Editing)
            evalQuery = evalQuery.eq('id', currentEvalId);
        } else {
            // Default logic: Find most recent draft or completed for this teacher
            evalQuery = evalQuery.eq('teacher_id', teacherId).order('created_at', { ascending: false }).limit(1);
        }

        const { data: evalData } = await evalQuery.single();

        if (evalData) {
          setCurrentEvalId(evalData.id); // Ensure we lock onto this ID
          setPeriod({ name: evalData.period_name || '', date: evalData.eval_date || new Date().toISOString().split('T')[0] });
          setScores(evalData.scores || {});
          setGeneralNotes(evalData.general_notes || '');
          if (Object.keys(evalData.scores || {}).length > 0) {
             setStep('scoring');
          }
        }
      } catch (error: any) {
        // If no rows found (PGRST116), it's fine, we start fresh.
        if (error.code !== 'PGRST116') {
            console.error('Error fetching data:', error);
            setErrorMsg(getErrorMessage(error));
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [teacherId, evaluationId]);

  // Centralized Save Function - Returns Success Boolean
  const saveToDb = useCallback(async (isManual = false): Promise<boolean> => {
      // Don't save if basic data isn't ready
      if (!teacherId || !period.name) {
          if (isManual) alert("يرجى تحديد فترة التقييم قبل الحفظ");
          return false;
      }

      setSaveStatus('saving');
      try {
        const payload: any = {
            teacher_id: teacherId,
            school_id: teacherDetails.schoolId || null, 
            period_name: period.name,
            eval_date: period.date, // We save the internal date
            scores: scores,
            general_notes: generalNotes,
            total_score: calculateTotal(),
            status: Object.keys(scores).length === indicators.length && indicators.length > 0 ? 'completed' : 'draft'
        };

        // If we have an ID, update. Else insert.
        // IMPORTANT: We only select 'id' to avoid "Schema Cache" errors if the table has other columns (like teacher_evidence_links) 
        // that are not in the local type definition or cache but exist in DB, or vice versa.
        let query;
        if (currentEvalId) {
             query = supabase.from('evaluations').update(payload).eq('id', currentEvalId).select('id');
        } else {
             query = supabase.from('evaluations').insert([payload]).select('id');
        }

        const { data, error } = await query;

        if (error) throw error;
        
        if (data && data[0]) {
            setCurrentEvalId(data[0].id); // Capture new ID if we just inserted
        }
        setSaveStatus('saved');
        return true;
      } catch (error: any) {
        console.error('Error saving:', error);
        setSaveStatus('error');
        
        const msg = getErrorMessage(error);
        if (isManual) {
            // Check specifically for missing column error
            if (msg.includes('column') && msg.includes('does not exist')) {
                 alert('فشل الحفظ: قاعدة البيانات تحتاج إلى تحديث.\nيرجى الذهاب إلى الإعدادات > قاعدة البيانات، ونسخ كود التحديث وتشغيله في Supabase.');
            } else {
                 alert('فشل الحفظ: ' + msg);
            }
        }
        return false;
      }
  }, [period, scores, generalNotes, teacherId, currentEvalId, indicators, teacherDetails.schoolId]);

  // Auto-Save Effect
  useEffect(() => {
    if (isLoading || indicators.length === 0) return; 

    const timeoutId = setTimeout(() => {
        if (period.name) saveToDb(false);
    }, 1500); 

    return () => clearTimeout(timeoutId);
  }, [saveToDb, isLoading, indicators.length]);

  const handleStartEvaluation = async () => {
      if (!period.name) {
          alert('يرجى اختيار الفترة');
          return;
      }
      // Force initial save to create the record ID
      const success = await saveToDb(true);
      if (success) {
          setStep('scoring');
      }
  };

  const handleFinish = async () => {
      const success = await saveToDb(true);
      if (success) {
          onBack();
      }
  };

  // Helpers
  const currentIndicator = indicators[currentIndicatorIndex];
  
  const currentScore: EvaluationScore = (currentIndicator && scores[currentIndicator.id]) || { 
    indicatorId: currentIndicator?.id || '', 
    level: 0,
    score: 0, 
    evidence: '', 
    notes: '', 
    improvement: '', 
    isComplete: false 
  };

  const getRubricLevel = (score: number, max: number) => {
    if (score === 0) return 0;
    const percentage = (score / max) * 100;
    if (percentage >= 90) return 5;
    if (percentage >= 80) return 4;
    if (percentage >= 70) return 3;
    if (percentage >= 50) return 2;
    return 1;
  };

  const getMasteryLevel = (score: number, max: number) => {
    if (score === 0) return "--";
    const percentage = (score / max) * 100;
    if (percentage >= 90) return "متميز";
    if (percentage >= 80) return "متقدم";
    if (percentage >= 70) return "متمكن";
    if (percentage >= 50) return "مبتدئ";
    return "غير مجتاز";
  };

  const updateScore = (valueStr: string) => {
    if (!currentIndicator) return;
    let val = parseFloat(valueStr);
    const maxVal = currentIndicator.weight;

    if (isNaN(val)) val = 0;
    if (val < 0) val = 0;
    if (val > maxVal) val = maxVal;

    const rubricLevel = getRubricLevel(val, maxVal);

    // Auto improvement text logic
    let autoImprovement = "الاستمرار في تحسين الأداء.";
    const percentage = (val / maxVal) * 100;
    if (percentage >= 90) autoImprovement = "توثيق المبادرات ونشرها كنموذج يحتذى به.";
    else if (percentage >= 80) autoImprovement = "العمل على ابتكار مبادرات نوعية تتجاوز التطبيق الأساسي.";
    else if (percentage >= 70) autoImprovement = "التركيز على الالتزام بتطبيق المعايير الأساسية بشكل منتظم.";
    else if (percentage >= 50) autoImprovement = "يحتاج إلى خطة علاجية عاجلة لفهم وتطبيق أساسيات المعيار.";
    else autoImprovement = "أداء غير مرضي يتطلب تدخلاً فورياً.";

    const newScore = {
       ...currentScore,
       score: val, 
       level: rubricLevel,
       isComplete: val > 0, // Considered complete if score entered
       improvement: autoImprovement
    };
    
    setScores({
      ...scores,
      [currentIndicator.id]: newScore
    });
  };

  const updateField = (field: keyof EvaluationScore, value: any) => {
    if (!currentIndicator) return;
    setScores({
      ...scores,
      [currentIndicator.id]: {
        ...currentScore,
        [field]: value
      }
    });
  };

  const calculateTotal = (): number => {
    return (Object.values(scores) as EvaluationScore[]).reduce((acc: number, curr: EvaluationScore) => acc + (curr.score || 0), 0);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>;
  if (errorMsg) return <div className="text-red-500 text-center p-12">{errorMsg}</div>;
  if (!currentIndicator) return <div className="p-12 text-center">لا توجد مؤشرات لهذه الفئة من المعلمين</div>;

  if (step === 'print') {
     return <PrintView 
        teacherName={teacherDetails.name}
        teacherNationalId={teacherDetails.nationalId}
        teacherSpecialty={teacherDetails.specialty}
        teacherCategory={teacherDetails.category}
        schoolName={teacherDetails.schoolName}
        ministryId={teacherDetails.ministryId}
        periodDate={period.date}
        totalScore={calculateTotal()}
        scores={scores}
        indicators={indicators}
        onBack={() => setStep('summary')}
     />
  }

  // --- RENDER SCORING TABLE ---
  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-start">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <button onClick={onBack} className="text-gray-400 hover:text-gray-700"><ArrowRight size={20} /></button>
             <h2 className="text-xl font-bold text-gray-800">تقييم المعلم: {teacherDetails.name}</h2>
           </div>
           <div className="flex gap-4 text-sm text-gray-500 mr-7">
              {period.name && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">الفترة: {period.name}</span>}
              <span>المدرسة: {teacherDetails.schoolName || 'غير محدد'}</span>
           </div>
        </div>
        <div className="flex flex-col items-end">
            <span className="text-sm text-gray-500 mb-1">حالة التقييم</span>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">
                {Object.keys(scores).length === indicators.length ? 'مكتمل' : 'جاري التقييم'}
            </span>
            <div className="flex items-center gap-1 mt-2 text-xs">
                 {saveStatus === 'saving' && <span className="text-gray-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> جاري الحفظ...</span>}
                 {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> تم الحفظ</span>}
                 {saveStatus === 'error' && <span className="text-red-500 flex items-center gap-1"><AlertCircle size={10} /> خطأ في الحفظ</span>}
            </div>
        </div>
      </div>

      {step === 'period' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
           <h3 className="text-lg font-bold mb-6 border-b pb-4 flex items-center gap-2">
             <Calendar className="text-primary-600" /> أولاً: تحديد فترة التقييم
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                 <label className="block text-sm font-medium mb-2">اسم فترة التقييم</label>
                 <select 
                    className="w-full border p-2.5 rounded-lg bg-white"
                    value={period.name}
                    onChange={(e) => {
                        const newName = e.target.value;
                        // Auto-set internal date based on selected event if possible, or keep current
                        // We rely on "Today" for the eval_date unless we want to backdate to event start
                        setPeriod({...period, name: newName });
                    }}
                 >
                    <option value="">اختر الفترة</option>
                    {availableEvents.length > 0 ? (
                        availableEvents.map(evt => (
                            <option key={evt.id} value={evt.name}>
                                {evt.name} ({new Date(evt.start_date).toLocaleDateString('ar-SA')})
                            </option>
                        ))
                    ) : (
                        <>
                            <option value="الربع الأول">الربع الأول</option>
                            <option value="الربع الثاني">الربع الثاني</option>
                            <option value="الربع الثالث">الربع الثالث</option>
                            <option value="نهاية العام">نهاية العام</option>
                        </>
                    )}
                 </select>
                 {availableEvents.length === 0 && (
                     <p className="text-xs text-gray-400 mt-2">
                        ملاحظة: لا توجد أحداث تقييم نشطة معرفة في النظام. تظهر القائمة الافتراضية.
                     </p>
                 )}
              </div>
           </div>
           <div className="flex justify-end">
              <button 
                disabled={!period.name}
                onClick={handleStartEvaluation}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {currentEvalId ? 'متابعة التقييم' : 'بدء التقييم'} <ChevronLeft size={18} />
              </button>
           </div>
        </div>
      )}

      {step === 'scoring' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Sidebar List */}
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                <div className="p-4 bg-gray-50 font-bold border-b text-gray-700 flex justify-between items-center">
                  <span>مؤشرات التقييم</span>
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{Math.round((Object.keys(scores).length / indicators.length) * 100)}%</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
                    {indicators.map((ind, idx) => (
                        <button 
                            key={ind.id}
                            onClick={() => setCurrentIndicatorIndex(idx)}
                            className={`w-full text-right p-4 text-sm flex items-center justify-between transition-colors ${
                                idx === currentIndicatorIndex 
                                ? 'bg-primary-50 text-primary-700 font-medium border-r-4 border-primary-500' 
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                        >
                            <span className="truncate ml-2">{idx + 1}- {ind.text}</span>
                            {scores[ind.id]?.isComplete ? <CheckCircle2 size={16} className="text-green-500" /> : <span className="w-4 h-4 rounded-full border border-gray-300"></span>}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scoring Area */}
            <div className="lg:col-span-9 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 p-6 border-b border-gray-200">
                     <h3 className="text-xl font-bold text-gray-800 mb-2">{currentIndicator.text}</h3>
                     <p className="text-sm text-gray-500">{currentIndicator.description}</p>
                     <div className="mt-2 text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded inline-block">
                        الوزن النسبي المطبق: <strong>{currentIndicator.weight}</strong> درجة
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                         <thead className="bg-white text-primary-600 text-sm border-b">
                            <tr>
                               <th className="px-6 py-4 font-bold text-right w-[40%]">مؤشر التقييم (المعايير)</th>
                               <th className="px-4 py-4 font-bold text-center w-[10%]">الحد الأقصى</th>
                               <th className="px-4 py-4 font-bold text-center w-[10%]">الدرجة</th>
                               <th className="px-4 py-4 font-bold text-center w-[10%]">الحالة</th>
                               <th className="px-6 py-4 font-bold text-right w-[15%]">مؤشرات التحقق</th>
                               <th className="px-6 py-4 font-bold text-center w-[15%]">الشواهد</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {/* Rows based on Criteria, but Score cols are RowSpanned */}
                            {currentIndicator.evaluationCriteria.length === 0 ? (
                                <tr><td colSpan={6} className="p-4 text-center">لا توجد معايير</td></tr>
                            ) : (
                                currentIndicator.evaluationCriteria.map((criteriaText, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm text-gray-700 leading-relaxed border-r border-gray-100">
                                            • {criteriaText}
                                        </td>

                                        {/* RowSpanned Columns (Only render for first row) */}
                                        {idx === 0 && (
                                            <>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 text-center text-gray-500 font-bold border-l border-r border-gray-100 align-top bg-gray-50/50">
                                                    {currentIndicator.weight}
                                                </td>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 text-center border-r border-gray-100 align-top bg-white">
                                                    <input 
                                                        type="number"
                                                        min="0"
                                                        max={currentIndicator.weight}
                                                        step="0.5"
                                                        className="w-20 h-12 border-2 border-primary-100 rounded-lg text-center font-bold text-xl text-primary-700 focus:border-primary-500 focus:ring-4 focus:ring-primary-100 outline-none transition-all"
                                                        value={currentScore.score || ''}
                                                        onChange={(e) => updateScore(e.target.value)}
                                                        placeholder="0"
                                                    />
                                                </td>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 text-center border-r border-gray-100 align-top bg-gray-50/50">
                                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${currentScore.isComplete ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                        {currentScore.isComplete ? 'مكتمل' : 'غير مكتمل'} 
                                                    </span>
                                                </td>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-6 py-4 text-sm text-gray-600 align-top border-r border-gray-100 bg-white">
                                                    <ul className="space-y-2 list-disc list-inside text-xs">
                                                        {currentIndicator.verificationIndicators.map((v, i) => (
                                                            <li key={i}>{v}</li>
                                                        ))}
                                                    </ul>
                                                </td>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 align-top text-center bg-gray-50/50">
                                                    <button className="text-primary-600 text-xs flex flex-col items-center gap-2 hover:underline bg-white border border-primary-200 px-3 py-2 rounded-lg shadow-sm w-full transition-all hover:bg-primary-50">
                                                        <UploadCloud size={20} /> 
                                                        <span>إضافة شواهد</span>
                                                    </button>
                                                    <div className="mt-2 text-xs text-gray-400">لا يوجد ملفات</div>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                         </tbody>
                      </table>
                  </div>

                  {/* Rubric & Improvement */}
                  <div className="bg-gray-50 p-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                           <div>
                              <label className="block text-xs font-bold text-gray-500 mb-2">مستوى الإتقان (آلي)</label>
                              <div className={`w-full border rounded-lg p-4 bg-white shadow-sm transition-all ${currentScore.level >= 4 ? 'border-green-200 bg-green-50' : ''}`}>
                                 <div className="flex justify-between items-center mb-2">
                                     <span className="font-bold text-lg text-gray-800">
                                        {currentScore.level > 0 ? `المستوى ${currentScore.level}` : '---'}
                                     </span>
                                     <span className={`text-sm px-2 py-1 rounded-md font-medium ${currentScore.level >= 4 ? 'bg-green-200 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                                        {getMasteryLevel(currentScore.score, currentIndicator.weight)}
                                     </span>
                                 </div>
                                 <p className="text-sm text-gray-600 italic leading-relaxed">
                                     {/* Access Rubric JSON safely */}
                                     {(currentIndicator.rubric as any)?.[currentScore.level]?.description || 'أدخل الدرجة لعرض الوصف'}
                                 </p>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-2">فرص التحسين (آلي)</label>
                              <div className="w-full border rounded-lg p-4 bg-white text-sm text-gray-700 min-h-[100px] shadow-sm flex items-start">
                                 {currentScore.improvement || '---'}
                              </div>
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-2">
                             ملاحظات إضافية على المؤشر (اختياري)
                          </label>
                          <textarea 
                              rows={2} 
                              className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm"
                              placeholder="أضف ملاحظاتك هنا..."
                              value={currentScore.notes}
                              onChange={(e) => updateField('notes', e.target.value)}
                          />
                      </div>
                  </div>

                  {/* Navigation */}
                  <div className="p-6 bg-white border-t border-gray-200 flex justify-between items-center">
                      <button 
                          onClick={() => setCurrentIndicatorIndex(Math.max(0, currentIndicatorIndex - 1))}
                          disabled={currentIndicatorIndex === 0}
                          className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50"
                      >
                          السابق
                      </button>
                      
                      {currentIndicatorIndex < indicators.length - 1 ? (
                           <button 
                              onClick={() => setCurrentIndicatorIndex(currentIndicatorIndex + 1)}
                              className="flex items-center gap-2 bg-primary-600 text-white px-8 py-2 rounded-lg hover:bg-primary-700 shadow-sm"
                           >
                              التالي <ChevronLeft size={18} />
                          </button>
                      ) : (
                           <button 
                              onClick={() => setStep('summary')}
                              className="flex items-center gap-2 bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 shadow-sm"
                           >
                              إنهاء التقييم <Save size={18} />
                          </button>
                      )}
                  </div>
              </div>
            </div>
        </div>
      )}

      {step === 'summary' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
             <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">ملخص التقييم</h2>
                <p className="text-gray-500">تم رصد الدرجات بنجاح</p>
             </div>

             <div className="bg-gray-50 p-6 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-right">
                    <div className="text-sm text-gray-500 mb-1">النتيجة النهائية</div>
                    <div className="text-4xl font-bold text-primary-700">{calculateTotal().toFixed(1)}%</div>
                </div>
                <div className="text-center md:text-right">
                    <div className="text-sm text-gray-500 mb-1">التقدير العام</div>
                    <div className="text-2xl font-bold text-gray-800">{getMasteryLevel(calculateTotal(), 100)}</div>
                </div>
                <div className="w-full md:w-auto flex-1">
                    <label className="block text-sm font-medium mb-2">ملاحظات عامة</label>
                    <textarea 
                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-primary-500 outline-none"
                        rows={3}
                        value={generalNotes}
                        onChange={(e) => setGeneralNotes(e.target.value)}
                    ></textarea>
                </div>
             </div>

             <div className="flex justify-center gap-4">
                <button onClick={() => setStep('scoring')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">مراجعة</button>
                <button onClick={() => setStep('print')} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2"><Printer size={18} /> طباعة</button>
                <button onClick={handleFinish} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">حفظ وخروج</button>
             </div>
          </div>
      )}
    </div>
  );
}
