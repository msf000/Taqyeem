
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Save, Printer, ArrowRight, CheckCircle2, Loader2, AlertCircle, Calendar, ExternalLink, FileText, CheckSquare, TrendingUp, ThumbsUp, XCircle, LayoutList, MessageSquare, ChevronDown, ChevronUp, Target, Star, ArrowLeft, Maximize2, Award } from 'lucide-react';
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
  const [activeIndicatorIndex, setActiveIndicatorIndex] = useState<number | null>(null); // New state for Card View
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
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

  // --- Helpers ---
  const getErrorMessage = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    try {
        const str = JSON.stringify(error);
        if (str === '{}' || str === '[]') return 'خطأ غير محدد في النظام';
        return str;
    } catch {
        return 'خطأ غير معروف';
    }
  };

  // Helper to get Mastery Level for a specific indicator score
  const getIndicatorMasteryLevel = (score: number, weight: number) => {
      if (weight === 0) return { label: '-', color: 'bg-gray-100 text-gray-500' };
      const ratio = score / weight;
      if (ratio >= 0.9) return { label: 'متميز (5)', color: 'bg-green-100 text-green-700 border-green-200' };
      if (ratio >= 0.8) return { label: 'متقدم (4)', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      if (ratio >= 0.7) return { label: 'متمكن (3)', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      if (ratio >= 0.5) return { label: 'مبتدئ (2)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      return { label: 'غير مجتاز (1)', color: 'bg-red-100 text-red-700 border-red-200' };
  };

  // --- Fetch Data ---
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

        // Fetch Events
        try {
            const { data: eventsData } = await supabase
            .from('school_events')
            .select('*')
            .eq('type', 'evaluation')
            .in('status', ['active', 'upcoming'])
            .order('status', { ascending: true });
            
            if (eventsData) {
                setAvailableEvents(eventsData);
                if (!currentEvalId && !evaluationId && eventsData.length > 0) {
                    setPeriod(prev => ({ ...prev, name: eventsData[0].name }));
                }
            }
        } catch (e) { console.log('Events error', e); }

        // Fetch Evidence
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
        } catch (e) { console.log("Evidence error", e); }

        // Fetch Existing Evaluation
        if (currentEvalId || evaluationId) {
            const qId = currentEvalId || evaluationId;
            const { data: evalData } = await supabase.from('evaluations').select('*').eq('id', qId).single();

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
        if (error.code !== 'PGRST116') setErrorMsg(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  }, [teacherId, evaluationId]);

  // --- Save Logic ---
  const saveToDb = useCallback(async (isManual = false): Promise<boolean> => {
      if (!teacherId || !period.name) {
          if (isManual) alert("يرجى تحديد فترة التقييم");
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
        
        if (data && data[0]) setCurrentEvalId(data[0].id);
        setSaveStatus('saved');
        return true;
      } catch (error: any) {
        setSaveStatus('error');
        if (isManual) alert('فشل الحفظ: ' + getErrorMessage(error));
        return false;
      }
  }, [period, scores, generalNotes, teacherId, currentEvalId, indicators, teacherDetails.schoolId]);

  // Autosave
  useEffect(() => {
    if (isLoading || indicators.length === 0 || step !== 'scoring') return; 
    const timeoutId = setTimeout(() => { if (period.name) saveToDb(false); }, 1500); 
    return () => clearTimeout(timeoutId);
  }, [scores, generalNotes]);

  // --- Handlers ---
  const handleStartEvaluation = async () => {
      if (!period.name) return alert('يرجى اختيار الفترة');
      const success = await saveToDb(true);
      if (success) setStep('scoring');
  };

  const handleFinish = async () => {
      const success = await saveToDb(true);
      if (success) {
          onBack();
      }
  };

  const handleSubCriteriaChange = (indicator: EvaluationIndicator, criteriaIdx: number, value: number) => {
      // 1. Update subScores
      const currentScoreData = scores[indicator.id] || { 
          indicatorId: indicator.id, 
          score: 0, level: 0, 
          subScores: {}, 
          notes: '', improvement: '', strengths: '', evidence: '', isComplete: false 
      };
      
      const newSubScores = { ...(currentScoreData.subScores || {}), [criteriaIdx]: value };
      
      // 2. Calculate new main score
      const subScoreValues = Object.values(newSubScores);
      const sumSubScores = subScoreValues.reduce((a, b) => a + b, 0);
      
      let newMainScore = 0;
      let newLevel = 0;

      if (indicator.evaluationCriteria.length > 0) {
          const maxPossiblePoints = indicator.evaluationCriteria.length * 5;
          const percentage = sumSubScores / maxPossiblePoints;
          newMainScore = percentage * indicator.weight;
          const avg = sumSubScores / indicator.evaluationCriteria.length;
          newLevel = Math.round(avg);
      } else {
          newMainScore = value; 
      }

      // 3. Smart Text Generation Logic (Auto-fill)
      const strengthPoints: string[] = [];
      const improvementPoints: string[] = [];

      indicator.evaluationCriteria.forEach((criteriaText, idx) => {
          const s = newSubScores[idx];
          if (s === 5 || s === 4) {
              strengthPoints.push(criteriaText);
          } else if (s <= 2 && s > 0) {
              improvementPoints.push(criteriaText);
          }
      });

      let autoStrengths = '';
      if (strengthPoints.length > 0) {
          autoStrengths = "يتميز المعلم في: " + strengthPoints.join('، ') + ".";
      } else if (newLevel === 5) {
          autoStrengths = "أداء متميز وتطبيق احترافي لجميع المعايير.";
      }

      let autoImprovement = '';
      if (improvementPoints.length > 0) {
          autoImprovement = "يوصى بالعمل على تحسين: " + improvementPoints.join('، ') + ".";
      } else if (newLevel <= 2 && newLevel > 0) {
          autoImprovement = "يحتاج إلى خطة علاجية لرفع مستوى الأداء في هذا المؤشر.";
      }

      setScores(prev => ({
          ...prev,
          [indicator.id]: {
              ...currentScoreData,
              subScores: newSubScores,
              score: parseFloat(newMainScore.toFixed(2)),
              level: newLevel,
              isComplete: subScoreValues.length === indicator.evaluationCriteria.length,
              strengths: autoStrengths,   // Auto update
              improvement: autoImprovement // Auto update
          }
      }));
  };

  const updateField = (indicatorId: string, field: keyof EvaluationScore, value: any) => {
    setScores(prev => {
      const current: EvaluationScore = prev[indicatorId] || {
        indicatorId,
        level: 0,
        score: 0,
        evidence: '',
        notes: '',
        improvement: '',
        strengths: '',
        isComplete: false,
        subScores: {}
      };
      return {
        ...prev,
        [indicatorId]: { ...current, [field]: value }
      };
    });
  };

  const calculateTotal = (): number => {
    return (Object.values(scores) as EvaluationScore[]).reduce((acc, curr) => acc + (curr.score || 0), 0);
  };

  const getMasteryLevel = (score: number, max: number) => {
    if (score === 0) return "--";
    const percentage = (score / max) * 100;
    if (percentage >= 90) return "مثالي (5)";
    if (percentage >= 80) return "تخطى التوقعات (4)";
    if (percentage >= 70) return "وافق التوقعات (3)";
    if (percentage >= 50) return "بحاجة إلى تطوير (2)";
    return "غير مرضي (1)";
  };

  const completedCount = (Object.values(scores) as EvaluationScore[]).filter(s => s.score > 0).length;
  const progressPercent = indicators.length > 0 ? (completedCount / indicators.length) * 100 : 0;

  // --- RENDER HELPERS ---
  const activeInd = activeIndicatorIndex !== null ? indicators[activeIndicatorIndex] : null;

  const navigateIndicator = (direction: 'next' | 'prev') => {
      if (activeIndicatorIndex === null) return;
      if (direction === 'next') {
          if (activeIndicatorIndex < indicators.length - 1) setActiveIndicatorIndex(activeIndicatorIndex + 1);
          else setActiveIndicatorIndex(null); 
      } else {
          if (activeIndicatorIndex > 0) setActiveIndicatorIndex(activeIndicatorIndex - 1);
          else setActiveIndicatorIndex(null);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>;
  if (step === 'print') return <PrintView teacherName={teacherDetails.name} teacherNationalId={teacherDetails.nationalId} teacherSpecialty={teacherDetails.specialty} teacherCategory={teacherDetails.category} schoolName={teacherDetails.schoolName} ministryId={teacherDetails.ministryId} periodDate={period.date} totalScore={calculateTotal()} scores={scores} indicators={indicators} onBack={() => setStep('summary')} />;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <button onClick={onBack} className="text-gray-400 hover:text-gray-700"><ArrowRight size={20} /></button>
             <h2 className="text-xl font-bold text-gray-800">تقييم المعلم: {teacherDetails.name}</h2>
           </div>
           <div className="flex gap-4 text-sm text-gray-500 mr-7">
              {period.name && <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded">الفترة: {period.name}</span>}
              <span>المدرسة: {teacherDetails.schoolName}</span>
           </div>
        </div>
        <div className="flex flex-col items-end">
            <span className="text-sm text-gray-500 mb-1">النتيجة الحالية</span>
            <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-primary-600">{calculateTotal().toFixed(1)}</span>
                <span className="text-sm bg-gray-100 px-2 py-1 rounded">{getMasteryLevel(calculateTotal(), 100)}</span>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs">
                 {saveStatus === 'saving' && <span className="text-gray-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> جاري الحفظ...</span>}
                 {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> تم الحفظ</span>}
            </div>
        </div>
      </div>

      {step === 'period' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in max-w-2xl mx-auto mt-12">
           <h3 className="text-lg font-bold mb-6 border-b pb-4 flex items-center gap-2">
             <Calendar className="text-primary-600" /> اختيار فترة التقييم
           </h3>
           <div className="mb-8">
              <label className="block text-sm font-medium mb-2">الفترة</label>
              <select className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-primary-500" value={period.name} onChange={(e) => setPeriod({...period, name: e.target.value})}>
                <option value="">اختر الفترة</option>
                {availableEvents.length > 0 ? availableEvents.map(evt => <option key={evt.id} value={evt.name}>{evt.name}</option>) : <option value="عام">تقييم عام</option>}
              </select>
           </div>
           <div className="flex justify-end">
              <button disabled={!period.name} onClick={handleStartEvaluation} className="bg-primary-600 text-white px-8 py-3 rounded-xl hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2 font-bold transition-all">
                {currentEvalId ? 'متابعة التقييم' : 'بدء التقييم'} <ChevronLeft size={18} />
              </button>
           </div>
        </div>
      )}

      {step === 'scoring' && (
        <div className="space-y-6 animate-fade-in">
            {/* If in List View (No indicator selected) */}
            {activeIndicatorIndex === null ? (
                <>
                    {/* Progress */}
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-bold text-gray-700">نسبة الإنجاز</span>
                            <span className="text-sm text-primary-600 font-bold">{Math.round(progressPercent)}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                            <div className="bg-green-500 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                    </div>

                    {/* Indicator Cards List */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {indicators.map((ind, idx) => {
                            const scoreData = scores[ind.id] || { score: 0 };
                            const isDone = scoreData.score > 0;
                            const mastery = getIndicatorMasteryLevel(scoreData.score, ind.weight);
                            return (
                                <div 
                                    key={ind.id} 
                                    onClick={() => setActiveIndicatorIndex(idx)}
                                    className={`bg-white p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md relative overflow-hidden group ${isDone ? 'border-green-100' : 'border-gray-100 hover:border-primary-200'}`}
                                >
                                    {isDone && <div className="absolute top-0 left-0 bg-green-500 text-white text-[10px] px-2 py-1 rounded-br-lg">مكتمل</div>}
                                    
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center font-bold text-gray-500 border group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors">
                                            {idx + 1}
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium">الوزن: {ind.weight}</span>
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 h-12">{ind.text}</h3>
                                    
                                    <div className="flex justify-between items-end mt-4">
                                        <div className="text-sm flex flex-col items-start gap-1">
                                            <span className="text-gray-500">الدرجة: <span className={`font-bold ${isDone ? 'text-green-600' : 'text-gray-400'}`}>{scoreData.score.toFixed(1)}</span></span>
                                            {isDone && <span className={`text-[10px] px-1.5 py-0.5 rounded ${mastery.color}`}>{mastery.label}</span>}
                                        </div>
                                        <button className="text-primary-600 text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                                            تقييم <ChevronLeft size={16}/>
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="flex justify-end pt-6">
                        <button 
                            onClick={() => setStep('summary')}
                            className="bg-gray-800 text-white px-8 py-3 rounded-xl hover:bg-gray-900 shadow-lg font-bold flex items-center gap-2"
                        >
                            عرض الملخص النهائي <CheckSquare size={18} />
                        </button>
                    </div>
                </>
            ) : (
                // --- SPECIAL CARD VIEW FOR SINGLE INDICATOR ---
                activeInd && (
                    <div className="animate-fade-in">
                        {/* Nav Header */}
                        <div className="flex items-center justify-between mb-6">
                            <button onClick={() => setActiveIndicatorIndex(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 bg-white px-4 py-2 rounded-lg border shadow-sm">
                                <ArrowRight size={18} /> القائمة الرئيسية
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => navigateIndicator('prev')} disabled={activeIndicatorIndex === 0} className="p-2 bg-white border rounded-lg hover:bg-gray-50 disabled:opacity-50"><ArrowRight size={20}/></button>
                                <span className="bg-primary-600 text-white px-4 py-2 rounded-lg font-bold">{activeIndicatorIndex + 1} / {indicators.length}</span>
                                <button onClick={() => navigateIndicator('next')} className="p-2 bg-white border rounded-lg hover:bg-gray-50"><ChevronLeft size={20}/></button>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
                            {/* Left Side: Verification & Info */}
                            <div className="w-full md:w-1/3 bg-gray-50 p-6 border-l border-gray-200 flex flex-col">
                                <h3 className="font-bold text-gray-800 text-xl mb-4 leading-relaxed">{activeInd.text}</h3>
                                <div className="text-sm text-gray-500 mb-6 bg-white p-3 rounded-lg border border-gray-200">
                                    {activeInd.description || 'لا يوجد وصف إضافي'}
                                </div>

                                <div className="space-y-6 flex-1">
                                    <div>
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><Target size={16}/> مؤشرات التحقق</h4>
                                        <ul className="space-y-2">
                                            {activeInd.verificationIndicators.length > 0 ? activeInd.verificationIndicators.map((v, i) => (
                                                <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                                                    <CheckCircle2 size={14} className="text-green-500 mt-0.5 shrink-0"/>
                                                    <span>{v}</span>
                                                </li>
                                            )) : <li className="text-xs text-gray-400">لا توجد مؤشرات محددة</li>}
                                        </ul>
                                    </div>

                                    <div>
                                        <h4 className="font-bold text-gray-700 mb-2 flex items-center gap-2"><ExternalLink size={16}/> الشواهد المرفقة</h4>
                                        <div className="flex flex-col gap-2">
                                            {teacherEvidenceLinks.filter(e => e.indicatorId === activeInd.id).map((ev, i) => (
                                                <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-blue-200 text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 flex items-center gap-2">
                                                    <FileText size={14}/> {ev.description || `شاهد ${i+1}`}
                                                </a>
                                            ))}
                                            {teacherEvidenceLinks.filter(e => e.indicatorId === activeInd.id).length === 0 && (
                                                <p className="text-xs text-gray-400 italic">لا توجد شواهد مرفقة من المعلم</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <div className="text-center">
                                        <span className="text-sm text-gray-500 block mb-1">الدرجة المستحقة</span>
                                        <div className="flex flex-col items-center gap-2">
                                            <span className="text-4xl font-bold text-primary-600">
                                                {(scores[activeInd.id]?.score || 0).toFixed(1)} <span className="text-base text-gray-400 font-normal">/ {activeInd.weight}</span>
                                            </span>
                                            {/* Mastery Level Badge */}
                                            {(() => {
                                                const score = scores[activeInd.id]?.score || 0;
                                                const mastery = getIndicatorMasteryLevel(score, activeInd.weight);
                                                return (
                                                    <span className={`px-3 py-1 rounded-full text-sm font-bold border ${mastery.color}`}>
                                                        {mastery.label}
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Detailed Scoring */}
                            <div className="w-full md:w-2/3 p-8 flex flex-col">
                                <h4 className="font-bold text-gray-800 mb-6 flex items-center gap-2 pb-2 border-b">
                                    <LayoutList size={20} className="text-primary-600"/> تقييم المعايير التفصيلية
                                </h4>

                                {/* Sub Criteria List */}
                                <div className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar">
                                    {activeInd.evaluationCriteria.length > 0 ? activeInd.evaluationCriteria.map((criterion, idx) => {
                                        const currentSubScore = scores[activeInd.id]?.subScores?.[idx] || 0;
                                        return (
                                            <div key={idx} className="bg-white p-4 rounded-xl border border-gray-100 hover:border-primary-100 transition-all shadow-sm">
                                                <p className="text-sm text-gray-800 font-medium mb-3">{idx + 1}. {criterion}</p>
                                                
                                                {/* Rating Scale 1-5 */}
                                                <div className="flex flex-row-reverse justify-end gap-2">
                                                    {[5, 4, 3, 2, 1].map((rating) => (
                                                        <button
                                                            key={rating}
                                                            onClick={() => handleSubCriteriaChange(activeInd, idx, rating)}
                                                            className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm transition-all border ${
                                                                currentSubScore === rating 
                                                                ? 'bg-primary-600 text-white border-primary-600 scale-110 shadow-md' 
                                                                : 'bg-white text-gray-400 border-gray-200 hover:border-primary-300'
                                                            }`}
                                                        >
                                                            {rating}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )
                                    }) : (
                                        <div className="text-center p-8 bg-gray-50 rounded-xl border border-dashed border-gray-300">
                                            <p className="text-gray-500 mb-4">لا توجد معايير تفصيلية لهذا المؤشر. يرجى إدخال الدرجة الكلية مباشرة.</p>
                                            <input 
                                                type="number" max={activeInd.weight} min={0}
                                                className="w-24 text-center border-2 border-primary-200 rounded-lg p-2 text-xl font-bold focus:ring-2 focus:ring-primary-500 outline-none"
                                                value={scores[activeInd.id]?.score || ''}
                                                onChange={(e) => handleSubCriteriaChange(activeInd, 0, parseFloat(e.target.value))} // Special case fallback
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Notes Section with Auto-Generation Info */}
                                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-100">
                                    <div>
                                        <label className="block text-xs font-bold text-green-700 mb-2 flex items-center justify-between">
                                            <span>نقاط القوة (توليد تلقائي من المعايير 5-4)</span>
                                            <Award size={14} className="text-green-600"/>
                                        </label>
                                        <textarea 
                                            className="w-full border border-green-100 bg-green-50/30 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-green-500 outline-none resize-none"
                                            placeholder="سيتم كتابة نقاط القوة هنا تلقائياً بناءً على اختيار الدرجات العالية..."
                                            value={scores[activeInd.id]?.strengths || ''}
                                            onChange={(e) => updateField(activeInd.id, 'strengths', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-yellow-700 mb-2 flex items-center justify-between">
                                            <span>فرص التحسين (توليد تلقائي من المعايير 1-2)</span>
                                            <TrendingUp size={14} className="text-yellow-600"/>
                                        </label>
                                        <textarea 
                                            className="w-full border border-yellow-100 bg-yellow-50/30 rounded-lg p-3 text-sm h-24 focus:ring-2 focus:ring-yellow-500 outline-none resize-none"
                                            placeholder="سيتم كتابة فرص التحسين هنا تلقائياً بناءً على اختيار الدرجات المنخفضة..."
                                            value={scores[activeInd.id]?.improvement || ''}
                                            onChange={(e) => updateField(activeInd.id, 'improvement', e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="mt-6 flex justify-end">
                                    <button 
                                        onClick={() => navigateIndicator('next')}
                                        className="bg-gray-800 text-white px-8 py-3 rounded-xl hover:bg-gray-900 shadow-lg font-bold flex items-center gap-2"
                                    >
                                        {activeIndicatorIndex < indicators.length - 1 ? 'حفظ والانتقال للتالي' : 'حفظ وإنهاء التقييم'} <ChevronLeft size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
      )}

      {step === 'summary' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in max-w-3xl mx-auto mt-8">
             <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">ملخص التقييم النهائي</h2>
                <p className="text-gray-500">تم رصد الدرجات بنجاح</p>
             </div>

             <div className="bg-gray-50 p-6 rounded-xl mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-right">
                    <div className="text-sm text-gray-500 mb-1">النتيجة النهائية</div>
                    <div className="text-4xl font-bold text-primary-700">{calculateTotal().toFixed(1)}%</div>
                </div>
                <div className="text-center md:text-right">
                    <div className="text-sm text-gray-500 mb-1">التقدير اللفظي</div>
                    <div className="text-2xl font-bold text-gray-800">{getMasteryLevel(calculateTotal(), 100)}</div>
                </div>
             </div>

             <div className="flex justify-center gap-4">
                <button onClick={() => setStep('scoring')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">عودة للتعديل</button>
                <button onClick={() => setStep('print')} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2"><Printer size={18} /> طباعة التقرير</button>
                <button onClick={handleFinish} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-bold">حفظ وإغلاق</button>
             </div>
          </div>
      )}
    </div>
  );
}
