
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, Save, Printer, ArrowRight, CheckCircle2, Loader2, AlertCircle, Calendar, ExternalLink, FileText, CheckSquare, TrendingUp, ThumbsUp, XCircle, LayoutList, MessageSquare, ChevronDown, ChevronUp, Target } from 'lucide-react';
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
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Expanded Rows for Details (Accordion)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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
  const toggleRow = (id: string) => {
      setExpandedRows(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
      });
  };

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

  const handleScoreChange = (indicator: EvaluationIndicator, valueStr: string) => {
    let value = parseFloat(valueStr);
    if (isNaN(value)) value = 0;
    if (value < 0) value = 0;
    if (value > indicator.weight) value = indicator.weight;

    // Determine level roughly for UI feedback (1-5)
    const ratio = value / indicator.weight;
    let level = 0;
    if (value > 0) {
        if (ratio >= 0.9) level = 5;
        else if (ratio >= 0.8) level = 4;
        else if (ratio >= 0.7) level = 3;
        else if (ratio >= 0.5) level = 2;
        else level = 1;
    }

    // Auto Text Generation
    let autoImprovement = scores[indicator.id]?.improvement || '';
    let autoStrengths = scores[indicator.id]?.strengths || '';
    
    if (value > 0) {
        const indicatorName = indicator.text;
        switch (level) {
            case 5:
                if (!autoStrengths) autoStrengths = `أداء متميز في "${indicatorName}"، تطبيق احترافي للمعايير.`;
                break;
            case 1:
            case 2:
                if (!autoImprovement) autoImprovement = `يحتاج إلى دعم وتوجيه في "${indicatorName}" والتركيز على الأساسيات.`;
                break;
        }
    }

    setScores(prev => ({
        ...prev,
        [indicator.id]: {
            evidence: '',
            notes: '',
            ...prev[indicator.id],
            indicatorId: indicator.id,
            score: value,
            level: level,
            isComplete: value > 0,
            strengths: autoStrengths,
            improvement: autoImprovement
        }
    }));
  };

  const updateField = (indicatorId: string, field: keyof EvaluationScore, value: any) => {
    setScores(prev => {
      const current = prev[indicatorId] || { 
        indicatorId, 
        score: 0, 
        level: 0, 
        evidence: '', 
        notes: '', 
        improvement: '',
        isComplete: false
      };
      
      return {
        ...prev,
        [indicatorId]: {
          ...current,
          [field]: value
        }
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

  // Scroll to Indicator
  const scrollToIndicator = (id: string) => {
      const element = document.getElementById(`row-${id}`);
      if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight it briefly
          element.classList.add('bg-yellow-50');
          setTimeout(() => element.classList.remove('bg-yellow-50'), 2000);
      }
  };

  const completedCount = (Object.values(scores) as EvaluationScore[]).filter(s => s.score > 0).length;
  const progressPercent = indicators.length > 0 ? (completedCount / indicators.length) * 100 : 0;

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
            
            {/* 1. Progress Bar & Completion Indicator */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-gray-700">مؤشر اكتمال التقييم</span>
                    <span className="text-sm text-primary-600 font-bold">{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div 
                        className="bg-green-500 h-3 rounded-full transition-all duration-500 ease-out" 
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
            </div>

            {/* 2. Quick Navigation Dropdown */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                <Target className="text-primary-600" size={24} />
                <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-500 mb-1">الانتقال السريع للمعيار:</label>
                    <select 
                        className="w-full border p-2 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 outline-none"
                        onChange={(e) => scrollToIndicator(e.target.value)}
                        value=""
                    >
                        <option value="" disabled>-- اختر المؤشر من القائمة --</option>
                        {indicators.map((ind, idx) => (
                            <option key={ind.id} value={ind.id}>
                                {idx + 1}. {ind.text} ({scores[ind.id]?.score > 0 ? 'مكتمل' : 'غير مكتمل'})
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* 3. The Main Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse">
                        <thead className="bg-gray-100 text-gray-700 text-sm font-bold border-b border-gray-200">
                            <tr>
                                {/* Specific Columns Requested */}
                                <th className="px-4 py-4 w-[30%] border-l border-gray-200">مؤشر التقييم</th>
                                <th className="px-2 py-4 w-[8%] text-center border-l border-gray-200">الحد الأقصى</th>
                                <th className="px-2 py-4 w-[10%] text-center border-l border-gray-200">الدرجة</th>
                                <th className="px-2 py-4 w-[12%] text-center border-l border-gray-200">الحالة</th>
                                <th className="px-4 py-4 w-[20%] border-l border-gray-200">مؤشر التحقق</th>
                                <th className="px-4 py-4 w-[15%] text-center">الشواهد</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {indicators.map((ind) => {
                                const scoreData = scores[ind.id] || { score: 0, level: 0, notes: '', improvement: '', strengths: '' };
                                const evidenceList = teacherEvidenceLinks.filter(e => e.indicatorId === ind.id);
                                const isExpanded = expandedRows.has(ind.id);

                                return (
                                    <React.Fragment key={ind.id}>
                                        <tr id={`row-${ind.id}`} className={`hover:bg-gray-50 transition-colors ${isExpanded ? 'bg-blue-50/20' : ''}`}>
                                            {/* Column 1: Indicator Name + Expand Button */}
                                            <td className="px-4 py-4 align-top border-l border-gray-100">
                                                <div className="font-bold text-gray-800 mb-2 text-base">{ind.text}</div>
                                                
                                                {/* Detailed Criteria List */}
                                                {ind.evaluationCriteria && ind.evaluationCriteria.length > 0 && (
                                                    <div className="mb-3">
                                                        <span className="text-[10px] text-gray-400 font-bold block mb-1">المعايير التفصيلية:</span>
                                                        <ul className="list-disc list-inside text-xs text-gray-500 space-y-1">
                                                            {ind.evaluationCriteria.map((crit, idx) => (
                                                                <li key={idx} className="leading-relaxed">{crit}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}

                                                <button 
                                                    onClick={() => toggleRow(ind.id)}
                                                    className="text-primary-600 text-xs font-bold hover:underline flex items-center gap-1"
                                                >
                                                    {isExpanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
                                                    {isExpanded ? 'إخفاء التفاصيل' : 'تفاصيل التقدير والملاحظات'}
                                                </button>
                                            </td>

                                            {/* Column 2: Max Score */}
                                            <td className="px-2 py-4 text-center align-top font-bold text-gray-500 border-l border-gray-100 text-lg pt-5">
                                                {ind.weight}
                                            </td>

                                            {/* Column 3: Score Input */}
                                            <td className="px-2 py-4 text-center align-top border-l border-gray-100 pt-3">
                                                <input 
                                                    type="number" min="0" max={ind.weight} step="0.5"
                                                    className={`w-16 h-12 text-center border-2 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none font-bold text-xl transition-all ${
                                                        scoreData.score > 0 ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-300'
                                                    }`}
                                                    value={scoreData.score || ''}
                                                    onChange={(e) => handleScoreChange(ind, e.target.value)}
                                                    placeholder="-"
                                                />
                                            </td>

                                            {/* Column 4: Status */}
                                            <td className="px-2 py-4 text-center align-top border-l border-gray-100 pt-5">
                                                {scoreData.score > 0 ? (
                                                    <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-full text-xs font-bold border border-green-200 shadow-sm">
                                                        <CheckCircle2 size={14}/> مكتمل
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 bg-red-50 text-red-500 px-3 py-1.5 rounded-full text-xs font-bold border border-red-100 shadow-sm">
                                                        <XCircle size={14}/> غير مكتمل
                                                    </span>
                                                )}
                                            </td>

                                            {/* Column 5: Verification Indicators */}
                                            <td className="px-4 py-4 align-top text-gray-600 border-l border-gray-100">
                                                <ul className="list-disc list-inside space-y-1 text-xs marker:text-gray-300">
                                                    {ind.verificationIndicators.length > 0 
                                                        ? ind.verificationIndicators.map((v, i) => <li key={i}>{v}</li>)
                                                        : <li className="list-none text-gray-400">--</li>
                                                    }
                                                </ul>
                                            </td>

                                            {/* Column 6: Evidence */}
                                            <td className="px-4 py-4 text-center align-top">
                                                <div className="flex flex-col gap-2">
                                                    {evidenceList.length > 0 ? evidenceList.map((ev, i) => (
                                                        <a key={i} href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-white border border-blue-200 text-blue-600 px-2 py-1.5 rounded hover:bg-blue-50 truncate flex items-center justify-center gap-1 shadow-sm">
                                                            <ExternalLink size={12}/> شاهد {i+1}
                                                        </a>
                                                    )) : <span className="text-xs text-gray-400 italic">لا توجد شواهد</span>}
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Expanded Details Row (Accordion) */}
                                        {isExpanded && (
                                            <tr className="bg-gray-50 border-b border-gray-200 animate-fade-in shadow-inner">
                                                <td colSpan={6} className="p-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
                                                        {/* Rubric Average Display */}
                                                        <div className="absolute top-0 left-0 bg-white border border-gray-200 px-3 py-1 rounded-lg shadow-sm text-xs font-bold text-gray-600">
                                                            سلم التقدير (متوسط المؤشر): <span className="text-primary-600 text-sm">{scoreData.level} / 5</span>
                                                        </div>

                                                        {/* Strengths */}
                                                        <div>
                                                            <label className="block text-xs font-bold text-green-700 mb-2 flex items-center gap-2">
                                                                <ThumbsUp size={14}/> نقاط القوة (تلقائي/يدوي)
                                                            </label>
                                                            <textarea 
                                                                className="w-full border border-green-200 p-3 rounded-lg text-sm h-20 focus:ring-2 focus:ring-green-500 outline-none bg-white shadow-sm resize-none"
                                                                value={scoreData.strengths || ''}
                                                                onChange={(e) => updateField(ind.id, 'strengths', e.target.value)}
                                                                placeholder="اكتب نقاط القوة هنا..."
                                                            />
                                                        </div>

                                                        {/* Improvements */}
                                                        <div>
                                                            <label className="block text-xs font-bold text-yellow-700 mb-2 flex items-center gap-2">
                                                                <TrendingUp size={14}/> فرص التحسين (الخطة العلاجية)
                                                            </label>
                                                            <textarea 
                                                                className="w-full border border-yellow-200 p-3 rounded-lg text-sm h-20 focus:ring-2 focus:ring-yellow-500 outline-none bg-white shadow-sm resize-none"
                                                                value={scoreData.improvement || ''}
                                                                onChange={(e) => updateField(ind.id, 'improvement', e.target.value)}
                                                                placeholder="اكتب فرص التحسين هنا..."
                                                            />
                                                        </div>
                                                        
                                                        {/* General Notes */}
                                                        <div className="md:col-span-2">
                                                            <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center gap-1"><MessageSquare size={12}/> ملاحظات عامة للمقيم</label>
                                                            <input 
                                                                type="text" 
                                                                className="w-full border p-2 rounded-lg text-sm focus:ring-1 focus:ring-primary-500 outline-none bg-white"
                                                                value={scoreData.notes || ''}
                                                                onChange={(e) => updateField(ind.id, 'notes', e.target.value)}
                                                                placeholder="ملاحظات إضافية..."
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t border-gray-200">
                <button 
                    onClick={() => setStep('summary')}
                    className="flex items-center gap-2 bg-primary-600 text-white px-8 py-3 rounded-xl hover:bg-primary-700 shadow-lg font-bold transition-all"
                >
                    اعتماد التقييم وعرض الملخص <Save size={18} />
                </button>
            </div>
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
