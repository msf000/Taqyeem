
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Save, Printer, ArrowRight, CheckCircle2, UploadCloud, Star, Loader2, AlertCircle, Calendar, Link as LinkIcon, ExternalLink, FileText, Square, CheckSquare, Lightbulb, TrendingUp, ThumbsUp } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore, TeacherCategory, SchoolEvent } from '../types';
import PrintView from './PrintView';
import { supabase } from '../supabaseClient';

interface EvaluationFlowProps {
  teacherId: string;
  evaluationId?: string;
  onBack: () => void;
}

export default function EvaluationFlow({ teacherId, evaluationId, onBack }: EvaluationFlowProps) {
  const [step, setStep] = useState<'period' | 'scoring' | 'summary' | 'print'>('period');
  const [currentIndicatorIndex, setCurrentIndicatorIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // UI States
  const [showNotes, setShowNotes] = useState(false);

  // Data State
  const [currentEvalId, setCurrentEvalId] = useState<string | null>(evaluationId || null);
  const [period, setPeriod] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const [scores, setScores] = useState<Record<string, EvaluationScore>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  
  const [teacherEvidenceLinks, setTeacherEvidenceLinks] = useState<{ id: string, indicatorId: string, url: string, description: string }[]>([]);
  const [availableEvents, setAvailableEvents] = useState<SchoolEvent[]>([]);

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

  const getErrorMessage = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    if (error?.code === '23505') return 'يوجد تقييم مسجل بالفعل لهذا المعلم في هذه الفترة.';
    try {
        const str = JSON.stringify(error);
        if (str === '{}' || str === '[]') return 'خطأ غير محدد في النظام';
        return str;
    } catch {
        return 'خطأ غير معروف (تعذر عرض التفاصيل)';
    }
  };

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('*, schools(name, ministry_id)')
            .eq('id', teacherId)
            .single();
        
        if (teacherError) throw teacherError;
        
        if (teacherData) {
            setTeacherDetails({
                name: teacherData.name,
                nationalId: teacherData.national_id,
                specialty: teacherData.specialty,
                category: teacherData.category,
                schoolId: teacherData.school_id || null,
                schoolName: teacherData.schools?.name || '',
                ministryId: teacherData.schools?.ministry_id || ''
            });
        }

        const teacherCategory: TeacherCategory = teacherData?.category as TeacherCategory;

        const { data: indData, error: indError } = await supabase
          .from('evaluation_indicators')
          .select(`
            *,
            evaluation_criteria (text),
            verification_indicators (text)
          `)
          .order('sort_order', { ascending: true });

        if (indError) throw indError;

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

        try {
            const { data: eventsData, error: evError } = await supabase
            .from('school_events')
            .select('*')
            .eq('type', 'evaluation')
            .in('status', ['active', 'upcoming'])
            .order('status', { ascending: true })
            .order('start_date', { ascending: true });
            
            if (!evError && eventsData) {
                setAvailableEvents(eventsData);
                if (!currentEvalId && !evaluationId) {
                    const activeEvent = eventsData.find((e: any) => e.status === 'active');
                    if (activeEvent) {
                        setPeriod(prev => ({ ...prev, name: activeEvent.name }));
                    } else if (eventsData.length > 0) {
                        setPeriod(prev => ({ ...prev, name: eventsData[0].name }));
                    }
                }
            }
        } catch (e) {
            console.log('Events table might not exist yet or empty');
        }

        try {
            const { data: evidenceData } = await supabase
                .from('teacher_evidence')
                .select('*')
                .eq('teacher_id', teacherId);
            
            if (evidenceData) {
                const mappedEvidence = evidenceData.map((e: any) => ({
                    id: e.id,
                    indicatorId: e.indicator_id,
                    url: e.url,
                    description: e.description
                }));
                setTeacherEvidenceLinks(mappedEvidence);
            }
        } catch (e) {
            console.log("Error fetching evidence", e);
        }

        let evalQuery = supabase.from('evaluations').select('*');
        
        if (currentEvalId) {
            evalQuery = evalQuery.eq('id', currentEvalId);
        } else {
            if (evaluationId) {
                 evalQuery = evalQuery.eq('id', evaluationId);
            }
        }

        if (currentEvalId || evaluationId) {
            const { data: evalData } = await evalQuery.single();

            if (evalData) {
              setCurrentEvalId(evalData.id);
              setPeriod({ name: evalData.period_name || '', date: evalData.eval_date || new Date().toISOString().split('T')[0] });
              setScores(evalData.scores || {});
              setGeneralNotes(evalData.general_notes || '');
              
              if (Object.keys(evalData.scores || {}).length > 0) {
                 setStep('scoring');
              }
            }
        }
      } catch (error: any) {
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

  const saveToDb = useCallback(async (isManual = false): Promise<boolean> => {
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
            eval_date: period.date,
            scores: scores,
            general_notes: generalNotes,
            total_score: calculateTotal(),
            status: Object.keys(scores).length === indicators.length && indicators.length > 0 ? 'completed' : 'draft',
        };

        let query;
        if (currentEvalId) {
             query = supabase.from('evaluations').update(payload).eq('id', currentEvalId).select('id');
        } else {
             query = supabase.from('evaluations').insert([payload]).select('id');
        }

        const { data, error } = await query;
        if (error) throw error;
        
        if (data && data[0]) {
            setCurrentEvalId(data[0].id);
        }
        setSaveStatus('saved');
        return true;
      } catch (error: any) {
        console.error('Error saving:', error);
        setSaveStatus('error');
        if (isManual) alert('فشل الحفظ: ' + getErrorMessage(error));
        return false;
      }
  }, [period, scores, generalNotes, teacherId, currentEvalId, indicators, teacherDetails.schoolId]);

  // Only autosave when in scoring step to avoid creating duplicate records during period selection
  useEffect(() => {
    if (isLoading || indicators.length === 0 || step !== 'scoring') return; 
    const timeoutId = setTimeout(() => {
        if (period.name) saveToDb(false);
    }, 1500); 
    return () => clearTimeout(timeoutId);
  }, [saveToDb, isLoading, indicators.length, step]);

  const handleStartEvaluation = async () => {
      if (!period.name) {
          alert('يرجى اختيار الفترة');
          return;
      }

      // Check if evaluation already exists to avoid unique constraint error
      if (!currentEvalId) {
          setIsLoading(true);
          try {
              const { data: existingEval, error } = await supabase
                  .from('evaluations')
                  .select('*')
                  .eq('teacher_id', teacherId)
                  .eq('period_name', period.name)
                  .maybeSingle();
              
              if (existingEval) {
                  // Load existing data
                  setCurrentEvalId(existingEval.id);
                  setScores(existingEval.scores || {});
                  setGeneralNotes(existingEval.general_notes || '');
                  setPeriod(prev => ({ ...prev, date: existingEval.eval_date }));
                  setStep('scoring'); // Just move to scoring, autosave will eventually sync if needed
                  setIsLoading(false);
                  return;
              }
          } catch (e) {
              console.error("Check existing error", e);
          } finally {
              setIsLoading(false);
          }
      }

      // If we are here, either it's a new record or we already have an ID.
      // Call saveToDb to create record if new.
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

  const currentIndicator = indicators[currentIndicatorIndex];
  
  const currentScore: EvaluationScore = (currentIndicator && scores[currentIndicator.id]) || { 
    indicatorId: currentIndicator?.id || '', 
    level: 0,
    score: 0, 
    evidence: '', 
    notes: '', 
    improvement: '', 
    strengths: '',
    isComplete: false 
  };

  useEffect(() => {
      if (currentIndicator) {
          const hasNotes = !!scores[currentIndicator.id]?.notes;
          setShowNotes(hasNotes);
      }
  }, [currentIndicatorIndex, step]);

  const getMasteryLevel = (score: number, max: number) => {
    if (score === 0) return "--";
    const percentage = (score / max) * 100;
    if (percentage >= 90) return "مثالي (5)";
    if (percentage >= 80) return "تخطى التوقعات (4)";
    if (percentage >= 70) return "وافق التوقعات (3)";
    if (percentage >= 50) return "بحاجة إلى تطوير (2)";
    return "غير مرضي (1)";
  };

  // --- Logic for 1-5 Scale Scoring ---
  const updateScoreByLevel = (level: number) => {
    if (!currentIndicator) return;
    
    // Formula: (Level / 5) * Weight
    const weight = currentIndicator.weight;
    const weightedScore = (level / 5) * weight;
    
    const indicatorName = currentIndicator.text;
    const criteria = currentIndicator.evaluationCriteria;

    // Auto-Generate Text based on Level
    let autoImprovement = "";
    let autoStrengths = "";

    if (level === 5) {
        autoStrengths = `أداء نموذجي في "${indicatorName}"، حيث تم تطبيق المعايير باحترافية عالية، خاصة في: ${criteria[0] || 'كافة الجوانب'}.`;
        autoImprovement = `يوصى بتوثيق هذه الممارسة المتميزة ونقل الخبرة للزملاء لتعميم الفائدة.`;
    } else if (level === 4) {
        autoStrengths = `أداء متميز وتخطى التوقعات في معظم معايير "${indicatorName}".`;
        autoImprovement = `للوصول للمثالية، يمكن التركيز على الابتكار في ${criteria[0] || 'التطبيق'} بشكل إبداعي أكثر.`;
    } else if (level === 3) {
        autoStrengths = `تم تحقيق متطلبات "${indicatorName}" الأساسية بشكل جيد.`;
        autoImprovement = `يمكن تحسين الأداء من خلال التركيز على جودة المخرجات في: ${criteria[1] || criteria[0] || 'التفاصيل الدقيقة'}.`;
    } else if (level === 2) {
        autoStrengths = `توجد محاولات لتطبيق "${indicatorName}" ولكنها تحتاج إلى توجيه.`;
        autoImprovement = `الأداء بحاجة إلى تطوير عاجل. يرجى مراجعة ${criteria[0] || 'الأساسيات'} والعمل مع المشرف لتجاوز التحديات.`;
    } else if (level === 1) {
        autoStrengths = `لم تظهر نقاط قوة واضحة في هذا المؤشر.`;
        autoImprovement = `الأداء غير مرضي. يتطلب بناء خطة علاجية فورية للتمكن من أساسيات ${indicatorName}.`;
    }

    const newScore: EvaluationScore = {
       ...currentScore,
       level: level,
       score: weightedScore,
       isComplete: true,
       improvement: currentScore.improvement || autoImprovement,
       strengths: currentScore.strengths || autoStrengths
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

  const getCurrentIndicatorEvidence = () => {
      if (!currentIndicator) return [];
      return teacherEvidenceLinks.filter(e => e.indicatorId === currentIndicator.id);
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
                        setPeriod({...period, name: newName });
                    }}
                 >
                    <option value="">اختر الفترة</option>
                    {availableEvents.length > 0 ? (
                        availableEvents.map(evt => (
                            <option key={evt.id} value={evt.name}>
                                {evt.name} ({evt.status === 'active' ? 'نشط الآن' : new Date(evt.start_date).toLocaleDateString('ar-SA')})
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
                  <div className="bg-gray-50 p-6 border-b border-gray-200 flex justify-between items-start">
                     <div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{currentIndicator.text}</h3>
                        <p className="text-sm text-gray-500">{currentIndicator.description}</p>
                     </div>
                     <div className="text-center bg-white p-3 rounded-lg border shadow-sm">
                        <span className="block text-xs text-gray-500 mb-1">الوزن النسبي</span>
                        <strong className="text-xl text-primary-700">{currentIndicator.weight}</strong>
                     </div>
                  </div>

                  <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                         <thead className="bg-white text-primary-600 text-sm border-b">
                            <tr>
                               <th className="px-6 py-4 font-bold text-right w-[40%]">مؤشر التقييم (المعايير)</th>
                               <th className="px-4 py-4 font-bold text-center w-[25%]">مستوى التقييم (1-5)</th>
                               <th className="px-4 py-4 font-bold text-center w-[15%]">الدرجة الموزونة</th>
                               <th className="px-6 py-4 font-bold text-center w-[20%]">الشواهد</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {currentIndicator.evaluationCriteria.length === 0 ? (
                                <tr><td colSpan={4} className="p-4 text-center">لا توجد معايير</td></tr>
                            ) : (
                                currentIndicator.evaluationCriteria.map((criteriaText, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        <td className="px-6 py-3 text-sm text-gray-700 leading-relaxed border-r border-gray-100">
                                            • {criteriaText}
                                        </td>
                                        {idx === 0 && (
                                            <>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 text-center border-r border-gray-100 align-top bg-white">
                                                    <div className="flex flex-row-reverse justify-center gap-1">
                                                        {[1, 2, 3, 4, 5].map((level) => (
                                                            <button
                                                                key={level}
                                                                onClick={() => updateScoreByLevel(level)}
                                                                className={`w-9 h-9 rounded-full font-bold text-sm transition-all shadow-sm border ${
                                                                    currentScore.level === level
                                                                    ? 'bg-primary-600 text-white border-primary-600 scale-110 ring-2 ring-primary-200'
                                                                    : 'bg-white text-gray-500 border-gray-200 hover:border-primary-300 hover:text-primary-600'
                                                                }`}
                                                                title={`مستوى ${level}`}
                                                            >
                                                                {level}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <div className="mt-2 text-xs text-gray-500 font-medium">
                                                        {currentScore.level > 0 ? getMasteryLevel(currentScore.score, currentIndicator.weight) : 'حدد المستوى'}
                                                    </div>
                                                </td>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 text-center align-middle border-r border-gray-100 bg-gray-50/50">
                                                    <div className="text-2xl font-bold text-gray-800">
                                                        {currentScore.score.toFixed(1)}
                                                    </div>
                                                    <span className="text-[10px] text-gray-400">من {currentIndicator.weight}</span>
                                                </td>
                                                <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-4 py-4 align-top text-center bg-gray-50/50">
                                                    {getCurrentIndicatorEvidence().length > 0 ? (
                                                        <div className="space-y-2">
                                                            <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-full mb-2 inline-block">
                                                                يوجد {getCurrentIndicatorEvidence().length} شاهد
                                                            </span>
                                                            {getCurrentIndicatorEvidence().map((ev, i) => (
                                                                <a 
                                                                    key={i} 
                                                                    href={ev.url} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="block w-full text-left text-xs bg-white border border-blue-200 p-2 rounded hover:bg-blue-50 text-blue-700 truncate transition-colors"
                                                                    title={ev.description}
                                                                >
                                                                    <div className="flex items-center gap-1 mb-1">
                                                                        <ExternalLink size={10} />
                                                                        <span className="font-bold">شاهد {i + 1}</span>
                                                                    </div>
                                                                    <span className="text-gray-500">{ev.description}</span>
                                                                </a>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-xs text-gray-400 py-4 flex flex-col items-center gap-1">
                                                            <FileText size={20} className="opacity-50"/>
                                                            <span>لا يوجد شواهد</span>
                                                        </div>
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                ))
                            )}
                         </tbody>
                      </table>
                  </div>

                  {/* Strengths & Improvement */}
                  <div className="bg-gray-50 p-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                           <div>
                              <label className="block text-xs font-bold text-green-700 mb-2 flex items-center gap-1"><ThumbsUp size={12}/> نقاط القوة (بناءً على الدرجة)</label>
                              <textarea
                                 className="w-full border border-green-200 rounded-lg p-3 bg-white text-sm text-gray-700 min-h-[100px] shadow-sm focus:ring-2 focus:ring-green-500 outline-none"
                                 value={currentScore.strengths || ''}
                                 onChange={(e) => updateField('strengths', e.target.value)}
                                 placeholder="حدد مستوى التقييم لإنشاء نقاط القوة تلقائياً..."
                              />
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-yellow-700 mb-2 flex items-center gap-1"><TrendingUp size={12}/> فرص التحسين (الخطة العلاجية)</label>
                              <textarea
                                 className="w-full border border-yellow-200 rounded-lg p-3 bg-white text-sm text-gray-700 min-h-[100px] shadow-sm focus:ring-2 focus:ring-yellow-500 outline-none"
                                 value={currentScore.improvement || ''}
                                 onChange={(e) => updateField('improvement', e.target.value)}
                                 placeholder="حدد مستوى التقييم لإنشاء فرص التحسين تلقائياً..."
                              />
                          </div>
                      </div>
                      
                      <div className="mt-6 border-t border-gray-200 pt-4">
                          <label className="flex items-center gap-3 cursor-pointer w-fit select-none">
                              <div 
                                  className={`w-6 h-6 rounded border flex items-center justify-center transition-colors ${showNotes ? 'bg-primary-600 border-primary-600 text-white' : 'bg-white border-gray-300'}`}
                                  onClick={() => setShowNotes(!showNotes)}
                              >
                                  {showNotes && <CheckCircle2 size={16} />}
                              </div>
                              <span className="text-sm font-bold text-gray-700" onClick={() => setShowNotes(!showNotes)}>إرفاق ملاحظات إضافية للمقيم (اختياري)</span>
                          </label>

                          {showNotes && (
                              <div className="animate-fade-in mt-4">
                                  <textarea 
                                      rows={2} 
                                      className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm"
                                      placeholder="أضف ملاحظاتك الإضافية هنا..."
                                      value={currentScore.notes}
                                      onChange={(e) => updateField('notes', e.target.value)}
                                  />
                              </div>
                          )}
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
                    <div className="text-sm text-gray-500 mb-1">النتيجة النهائية الموزونة</div>
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
