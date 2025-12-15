
import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ArrowRight, CheckCircle2, Loader2, Calendar, ExternalLink, CheckSquare, TrendingUp, ThumbsUp, LayoutList, MessageSquare, ChevronDown, ChevronUp, Target, ArrowLeft, Award, Sparkles, Eye, Wand2, Printer, FileText, Lock, RotateCcw } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore, TeacherCategory, SchoolEvent, EvaluationStatus, UserRole } from '../types';
import PrintView from './PrintView';
import { supabase } from '../supabaseClient';
import { GoogleGenAI } from "@google/genai";

interface EvaluationFlowProps {
  teacherId: string;
  evaluationId?: string;
  onBack: () => void;
  userRole?: UserRole;
}

export default function EvaluationFlow({ teacherId, evaluationId, onBack, userRole }: EvaluationFlowProps) {
  const [step, setStep] = useState<'period' | 'scoring' | 'summary' | 'print'>('period');
  const [activeIndicatorIndex, setActiveIndicatorIndex] = useState<number | null>(null); // New state for Card View
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Read Only State
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Mobile View States
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  // AI Generation State
  const [generatingField, setGeneratingField] = useState<string | null>(null);

  // Data State
  const [currentEvalId, setCurrentEvalId] = useState<string | null>(evaluationId || null);
  const [period, setPeriod] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const [scores, setScores] = useState<Record<string, EvaluationScore>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  
  const [teacherEvidenceLinks, setTeacherEvidenceLinks] = useState<{ id: string, indicatorId: string, url: string, description: string }[]>([]);
  const [availableEvents, setAvailableEvents] = useState<SchoolEvent[]>([]);

  // Feedback Bank Cache (Hybrid: DB + Local Fallback)
  const [feedbackBank, setFeedbackBank] = useState<any[]>([]);

  const [teacherDetails, setTeacherDetails] = useState<{
      name: string;
      nationalId: string;
      specialty: string;
      category: string;
      schoolId: string | null;
      schoolName: string;
      ministryId: string;
      educationOffice: string;
      academicYear: string;
  }>({
      name: '', nationalId: '', specialty: '', category: '', schoolId: null, schoolName: '', ministryId: '', educationOffice: '', academicYear: ''
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
      
      // New Classification Scale
      if (ratio >= 0.9) return { label: 'مثالي (5)', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      if (ratio >= 0.8) return { label: 'تخطى التوقعات (4)', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      if (ratio >= 0.6) return { label: 'وافق التوقعات (3)', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      if (ratio >= 0.4) return { label: 'بحاجة إلى تطوير (2)', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      return { label: 'غير مرضي (1)', color: 'bg-red-100 text-red-800 border-red-200' };
  };

  // --- Fetch Data ---
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      try {
        // Fetch Teacher Data
        const { data: teacherData, error: teacherError } = await supabase
            .from('teachers')
            .select('*, schools(name, ministry_id, education_office, academic_year)')
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
                ministryId: teacherData.schools?.ministry_id || '',
                educationOffice: teacherData.schools?.education_office || '',
                academicYear: teacherData.schools?.academic_year || ''
            });
        }

        const teacherCategory: TeacherCategory = teacherData?.category as TeacherCategory;

        // Fetch Indicators
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

        // Fetch Feedback Bank (Try to load from DB)
        try {
            const { data: bankData } = await supabase.from('feedback_bank').select('*');
            if (bankData && bankData.length > 0) {
                setFeedbackBank(bankData);
            }
        } catch(e) { console.log('Feedback bank fetch failed, using local fallback'); }

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
              
              // Set Read Only if Completed
              if (evalData.status === 'completed') {
                  setIsReadOnly(true);
                  setStep('scoring'); // Default to scoring view for review
              } else {
                  // Only move to scoring automatically if we have data
                  if (Object.keys(evalData.scores || {}).length > 0) {
                     setStep('scoring');
                  }
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

  // --- AI Text Generation ---
  const generateAIContent = async (indId: string | 'general', field: 'strengths' | 'improvement' | 'notes' | 'general_notes', currentText: string) => {
      if (isReadOnly) return;
      const fieldKey = `${indId}-${field}`;
      setGeneratingField(fieldKey);

      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          let prompt = "";

          if (indId === 'general') {
              // General Notes Generation
              if (currentText && currentText.trim().length > 5) {
                  prompt = `أنت خبير تربوي ومقيم معتمد. قم بإعادة صياغة الملاحظات العامة التالية لتكون أكثر مهنية، شمولية، وبناءة، وتلخص أداء المعلم بشكل احترافي.
                  
                  النص الأصلي: "${currentText}"
                  
                  المطلوب: نص معاد صياغته بأسلوب تربوي رصين (فقرة واحدة أو نقاط).`;
              } else {
                  // Generate Summary based on scores
                  const totalScore = calculateTotal();
                  const mastery = getIndicatorMasteryLevel(totalScore, 100).label;
                  prompt = `أنت خبير تربوي. اكتب ملخصاً عاماً لتقييم أداء معلم حصل على مجموع درجات ${totalScore.toFixed(1)}% بتقدير (${mastery}).
                  
                  المطلوب: ملخص تنفيذي مهني (3-4 أسطر) يبرز المستوى العام ويشجع على التطوير المستمر.`;
              }
          } else {
              // Specific Indicator Generation
              const activeInd = indicators.find(i => i.id === indId);
              if (!activeInd) return;
              
              const level = scores[indId]?.level || 0;
              const typeLabel = field === 'strengths' ? 'نقاط القوة' : (field === 'improvement' ? 'فرص التحسين' : 'ملاحظات إضافية');

              if (currentText && currentText.trim().length > 5) {
                  prompt = `أنت خبير تربوي ومقيم معتمد. قم بإعادة صياغة ${typeLabel} التالية لتكون أكثر مهنية، تربوية، وبناءة.
                  
                  المؤشر: ${activeInd.text}
                  النص الأصلي: "${currentText}"
                  
                  المطلوب: نص معاد صياغته بنقاط واضحة ومختصرة باللغة العربية الفصحى. بدون مقدمات مثل "إليك النص المعاد صياغته". فقط النص.`;
              } else {
                  prompt = `أنت خبير تربوي ومقيم معتمد. اكتب ${typeLabel} مهنية ومختصرة لمعلم تم تقييمه في المؤشر التالي.
                  
                  المؤشر: ${activeInd.text}
                  وصف المؤشر: ${activeInd.description}
                  مستوى أداء المعلم المرصود: ${level} من 5.
                  
                  ${level >= 4 ? 'تنبيه: الأداء عالي جداً، ركز على التميز والنمذجة.' : ''}
                  ${level <= 2 ? 'تنبيه: الأداء منخفض، ركز على الدعم والتوجيه والإجراءات التصحيحية.' : ''}
                  
                  المطلوب: 2-3 نقاط واضحة ومباشرة (bullet points) باللغة العربية الفصحى.`;
              }
          }

          const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
          });

          const generatedText = response.text?.trim();
          if (generatedText) {
              if (indId === 'general') {
                  setGeneralNotes(generatedText);
              } else {
                  updateField(indId, field as any, generatedText);
              }
          }

      } catch (error) {
          console.error("AI Generation Error:", error);
          alert("حدث خطأ أثناء توليد النص. يرجى المحاولة مرة أخرى.");
      } finally {
          setGeneratingField(null);
      }
  };

  // --- Save Logic ---
  const saveToDb = useCallback(async (isManual = false, targetStatus?: EvaluationStatus): Promise<boolean> => {
      if (isReadOnly) return false;
      if (!teacherId || !period.name) {
          if (isManual) alert("يرجى تحديد فترة التقييم");
          return false;
      }

      setSaveStatus('saving');
      try {
        // Map EvaluationStatus (Arabic Enum) to DB Status (English String)
        let dbStatus = 'draft';
        if (targetStatus === EvaluationStatus.COMPLETED) {
            dbStatus = 'completed';
        }
        
        // Safety: If calculating completion, ensure strict validation
        if (dbStatus === 'completed') {
             if (Object.keys(scores).length < indicators.length) {
                 if(isManual) alert("تنبيه: لم يتم تقييم جميع المؤشرات بعد.");
                 // We still allow saving as completed if user forces it, or revert to draft
             }
        }

        const payload: any = {
            teacher_id: teacherId,
            school_id: teacherDetails.schoolId || null, 
            period_name: period.name,
            eval_date: period.date,
            scores: scores,
            general_notes: generalNotes,
            total_score: calculateTotal(),
            status: dbStatus,
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
  }, [period, scores, generalNotes, teacherId, currentEvalId, indicators, teacherDetails.schoolId, isReadOnly]);

  // Autosave - Always saves as 'draft' to prevent accidental completion
  useEffect(() => {
    if (isLoading || isReadOnly || indicators.length === 0 || step !== 'scoring') return; 
    const timeoutId = setTimeout(() => { 
        if (period.name) saveToDb(false, EvaluationStatus.DRAFT); 
    }, 1500); 
    return () => clearTimeout(timeoutId);
  }, [scores, generalNotes, isReadOnly]);

  // --- Smart Generator Helpers ---
  const getFeedbackForIndicator = (indicatorText: string, category: string) => {
      // 1. Try strict match in DB bank tags
      if (feedbackBank.length > 0) {
          // Normalize text for matching
          const normInd = indicatorText.trim();
          
          // Find entries where any tag is present in the indicator text
          const matches = feedbackBank.filter(f => {
              if (f.category !== category) return false;
              if (!f.tags || f.tags.length === 0) return false;
              // Check if any tag is included in the indicator text
              return f.tags.some((tag: string) => normInd.includes(tag));
          });

          if (matches.length > 0) {
              // Return the best match (or random from matches)
              const match = matches[Math.floor(Math.random() * matches.length)];
              return match.phrase_text;
          }
      }

      // 2. Fallback Templates if no specific match found
      if (category === 'strength') return "نموذج يُحتذى به في هذا المجال ويظهر تمكناً عالياً.";
      if (category === 'improvement') return "يحتاج إلى تطوير مهاراته في هذا الجانب لتناسب الموقف التعليمي.";
      if (category === 'action') return "الاطلاع على الأدلة الإجرائية وتطبيق الممارسات الصحيحة.";
      if (category === 'aspiration') return "نقل الخبرة للزملاء والمشاركة في المبادرات التطويرية."; // Default aspiration

      return "";
  };

  const handleSubCriteriaChange = (indicator: EvaluationIndicator, criteriaIdx: number, value: number) => {
      if (isReadOnly) return;
      // 1. Update subScores
      const currentScoreData = scores[indicator.id] || { 
          indicatorId: indicator.id, 
          score: 0, level: 0, 
          subScores: {}, 
          notes: '', improvement: '', strengths: '', evidence: '', isComplete: false 
      };
      
      const newSubScores = { ...(currentScoreData.subScores || {}), [criteriaIdx]: value };
      
      // 2. Calculate new main score
      const subScoreValues = Object.values(newSubScores) as number[];
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

      // 3. Smart Text Generation Logic (DB-Driven & Pedagogically Enhanced)
      let autoStrengths = '';
      let autoImprovement = '';

      // High Performance (Level 4-5)
      // Logic: Strengths = "Role Model...", Improvement = "Future Aspirations"
      if (newLevel >= 4) {
          const strengthPhrase = getFeedbackForIndicator(indicator.text, 'strength');
          const aspirationPhrase = getFeedbackForIndicator(indicator.text, 'aspiration');
          
          autoStrengths = `• ${strengthPhrase}`;
          // Instead of empty improvement, suggest Aspirations
          autoImprovement = `🌟 تطلعات مستقبلية (إثراء):\n• ${aspirationPhrase}`;
      } 
      
      // Low Performance (Level 1-2)
      // Logic: Improvement = "Diagnostic + Action", Strengths = "Potential/Target Goals"
      else if (newLevel <= 2 && newLevel > 0) {
          const improvementPhrase = getFeedbackForIndicator(indicator.text, 'improvement');
          const actionPhrase = getFeedbackForIndicator(indicator.text, 'action');
          // Reuse strength phrase but frame it as a goal
          const strengthGoalPhrase = getFeedbackForIndicator(indicator.text, 'strength').replace('نموذج يُحتذى به', 'نسعى للوصول إلى نموذج');
          
          autoImprovement = `🔍 فرص التحسين (التشخيص):\n• ${improvementPhrase}\n\n🛠️ خطة الدعم والتوجيه (الإجراءات):\n1. ${actionPhrase}`;
          // Instead of empty strengths, suggest Future Goals
          autoStrengths = `💡 نقاط قوة مستهدفة (تطلعات):\n• ${strengthGoalPhrase}`;
      }
      
      // Average Performance (Level 3)
      // Standard behavior
      else if (newLevel === 3) {
           autoStrengths = "أداء جيد يتوافق مع التوقعات الأساسية، مع وجود فرص للتحسين.";
           autoImprovement = "تعزيز الممارسات الحالية للوصول إلى مستوى الإتقان.";
      }

      setScores(prev => ({
          ...prev,
          [indicator.id]: {
              ...currentScoreData,
              subScores: newSubScores,
              score: parseFloat(newMainScore.toFixed(2)),
              level: newLevel,
              isComplete: subScoreValues.length === indicator.evaluationCriteria.length,
              strengths: autoStrengths,   // Updated logic
              improvement: autoImprovement // Updated logic
          }
      }));
  };

  const updateField = (indicatorId: string, field: keyof EvaluationScore, value: any) => {
    if (isReadOnly) return;
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

  const handleStartEvaluation = async () => {
      if (!period.name) return alert('يرجى اختيار الفترة');

      // Check if a draft already exists for this teacher/period before creating a new one
      if (!currentEvalId) {
          try {
              const { data: existingDraft } = await supabase
                  .from('evaluations')
                  .select('id, scores, general_notes')
                  .eq('teacher_id', teacherId)
                  .eq('period_name', period.name)
                  .single();
              
              if (existingDraft) {
                  // Resume existing
                  setCurrentEvalId(existingDraft.id);
                  setScores(existingDraft.scores || {});
                  setGeneralNotes(existingDraft.general_notes || '');
                  setStep('scoring');
                  return;
              }
          } catch (e) {
              // Ignore error (PGRST116 for no rows found)
          }
      }

      // Explicitly set as Draft on start
      const success = await saveToDb(true, EvaluationStatus.DRAFT);
      if (success) setStep('scoring');
  };

  const handleFinish = async () => {
      if (isReadOnly) return;
      // Validate completeness
      if (Object.keys(scores).length < indicators.length) {
          if (!confirm('لم يتم تقييم جميع المؤشرات بعد. هل أنت متأكد من اعتماد التقييم؟')) return;
      } else {
          if (!confirm('سيتم اعتماد التقييم نهائياً ولا يمكن تعديله لاحقاً. هل أنت متأكد؟')) return;
      }

      // Explicitly set as Completed
      const success = await saveToDb(true, EvaluationStatus.COMPLETED);
      if (success) {
          onBack();
      }
  };

  const handleRevertToDraft = async () => {
      if (!currentEvalId) return;
      if (!window.confirm('هل أنت متأكد من إعادة فتح التقييم للتعديل؟ سيتم تحويل الحالة إلى "مسودة" لتتمكن من تغيير الدرجات.')) return;

      setIsLoading(true);
      try {
          const { error } = await supabase.from('evaluations').update({ status: 'draft' }).eq('id', currentEvalId);
          if (error) throw error;
          
          setIsReadOnly(false);
          setStep('scoring'); // Go to scoring to edit
          alert('تم إعادة فتح التقييم بنجاح.');
      } catch (error: any) {
          console.error('Error reverting:', error);
          alert('فشل إعادة فتح التقييم: ' + error.message);
      } finally {
          setIsLoading(false);
      }
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
      setIsDetailsExpanded(false); // Reset expansion on navigation
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>;
  if (step === 'print') return <PrintView teacherName={teacherDetails.name} teacherNationalId={teacherDetails.nationalId} teacherSpecialty={teacherDetails.specialty} teacherCategory={teacherDetails.category} schoolName={teacherDetails.schoolName} ministryId={teacherDetails.ministryId} educationOffice={teacherDetails.educationOffice} academicYear={teacherDetails.academicYear} periodDate={period.date} totalScore={calculateTotal()} scores={scores} indicators={indicators} onBack={() => setStep('summary')} />;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-20">
      {/* Read Only Banner */}
      {isReadOnly && (
          <div className="bg-yellow-50 border-b border-yellow-200 p-3 text-center text-yellow-800 text-sm font-bold flex justify-center items-center gap-2 sticky top-0 z-50">
              <Lock size={16} />
              هذا التقييم مكتمل ولا يمكن تعديله (وضع القراءة فقط)
          </div>
      )}

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
        <div className="flex flex-col items-end w-full md:w-auto">
            <span className="text-sm text-gray-500 mb-1">النتيجة الحالية</span>
            <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-primary-600">{calculateTotal().toFixed(1)}</span>
                <span className="text-sm bg-gray-100 px-2 py-1 rounded">{getIndicatorMasteryLevel(calculateTotal(), 100).label}</span>
            </div>
            {!isReadOnly && (
                <div className="flex items-center gap-1 mt-2 text-xs">
                    {saveStatus === 'saving' && <span className="text-gray-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> جاري الحفظ (مسودة)...</span>}
                    {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> تم الحفظ</span>}
                </div>
            )}
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
                {currentEvalId ? 'متابعة التقييم (مسودة)' : 'بدء تقييم جديد'} <ChevronLeft size={18} />
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
                                            {isReadOnly ? 'عرض' : 'تقييم'} <ChevronLeft size={16}/>
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
                            {/* Left Side: Verification & Info (Collapsible on Mobile) */}
                            <div className="w-full md:w-1/3 bg-gray-50 border-l border-gray-200 flex flex-col">
                                {/* Mobile Header for Collapsing */}
                                <div 
                                    className="md:hidden p-4 flex justify-between items-center cursor-pointer bg-gray-100 border-b border-gray-200"
                                    onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
                                >
                                    <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                        <Eye size={16}/> تفاصيل المؤشر والشواهد
                                    </h3>
                                    {isDetailsExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                </div>

                                <div className={`p-6 transition-all duration-300 ${isDetailsExpanded ? 'block' : 'hidden md:flex md:flex-col md:h-full'}`}>
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
                            </div>

                            {/* Right Side: Detailed Scoring */}
                            <div className="w-full md:w-2/3 p-4 md:p-8 flex flex-col">
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
                                                <div className="flex flex-row-reverse justify-end gap-2 md:gap-2">
                                                    {[5, 4, 3, 2, 1].map((rating) => (
                                                        <button
                                                            key={rating}
                                                            onClick={() => handleSubCriteriaChange(activeInd, idx, rating)}
                                                            disabled={isReadOnly}
                                                            className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all ${
                                                                currentSubScore === rating
                                                                ? (rating >= 4 ? 'bg-green-600 text-white scale-110 shadow-md' : rating === 3 ? 'bg-blue-600 text-white scale-110 shadow-md' : 'bg-red-500 text-white scale-110 shadow-md')
                                                                : (isReadOnly ? 'bg-gray-100 text-gray-300' : 'bg-gray-50 text-gray-400 hover:bg-gray-200')
                                                            }`}
                                                        >
                                                            {rating}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }) : <p className="text-gray-500 italic">لا توجد معايير تفصيلية.</p>}
                                </div>

                                {/* Text Inputs for Indicator */}
                                <div className="mt-8 border-t pt-6 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Strengths */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                    <ThumbsUp size={16} className="text-blue-600"/> نقاط القوة
                                                </label>
                                                {!isReadOnly && (
                                                    <button 
                                                        onClick={() => generateAIContent(activeInd.id, 'strengths', scores[activeInd.id]?.strengths || '')}
                                                        disabled={generatingField === `${activeInd.id}-strengths`}
                                                        className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-100 transition-colors"
                                                    >
                                                        {generatingField === `${activeInd.id}-strengths` ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                                                        صياغة بالذكاء الاصطناعي
                                                    </button>
                                                )}
                                            </div>
                                            <textarea 
                                                rows={4}
                                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors disabled:bg-gray-100"
                                                placeholder="أبرز نقاط القوة لدى المعلم..."
                                                value={scores[activeInd.id]?.strengths || ''}
                                                onChange={(e) => updateField(activeInd.id, 'strengths', e.target.value)}
                                                disabled={isReadOnly}
                                            />
                                        </div>

                                        {/* Improvements */}
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                                    <TrendingUp size={16} className="text-orange-600"/> فرص التحسين
                                                </label>
                                                {!isReadOnly && (
                                                    <button 
                                                        onClick={() => generateAIContent(activeInd.id, 'improvement', scores[activeInd.id]?.improvement || '')}
                                                        disabled={generatingField === `${activeInd.id}-improvement`}
                                                        className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-100 transition-colors"
                                                    >
                                                        {generatingField === `${activeInd.id}-improvement` ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                                                        صياغة بالذكاء الاصطناعي
                                                    </button>
                                                )}
                                            </div>
                                            <textarea 
                                                rows={4}
                                                className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors disabled:bg-gray-100"
                                                placeholder="المجالات التي تحتاج إلى تطوير..."
                                                value={scores[activeInd.id]?.improvement || ''}
                                                onChange={(e) => updateField(activeInd.id, 'improvement', e.target.value)}
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Optional Notes */}
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                            <MessageSquare size={16} className="text-gray-400"/> ملاحظات إضافية (اختياري)
                                        </label>
                                        <textarea 
                                            rows={2}
                                            className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-gray-50 focus:bg-white transition-colors disabled:bg-gray-100"
                                            placeholder="أي ملاحظات أخرى..."
                                            value={scores[activeInd.id]?.notes || ''}
                                            onChange={(e) => updateField(activeInd.id, 'notes', e.target.value)}
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            )}
        </div>
      )}

      {step === 'summary' && (
          <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 animate-fade-in max-w-4xl mx-auto">
              <div className="text-center mb-10">
                  <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-green-50">
                      <Award size={40} />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-800 mb-2">ملخص التقييم النهائي</h2>
                  <p className="text-gray-500">مراجعة النتائج والتوصيات قبل الاعتماد النهائي</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                      <h4 className="text-gray-500 text-sm font-bold mb-2">النتيجة النهائية</h4>
                      <div className="flex items-baseline gap-2">
                          <span className="text-5xl font-black text-gray-900">{calculateTotal().toFixed(1)}</span>
                          <span className="text-gray-400 font-medium">/ 100</span>
                      </div>
                      <div className={`mt-4 inline-block px-4 py-1.5 rounded-full text-sm font-bold ${getIndicatorMasteryLevel(calculateTotal(), 100).color}`}>
                          التقدير: {getIndicatorMasteryLevel(calculateTotal(), 100).label}
                      </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 flex flex-col">
                      <div className="flex justify-between items-center mb-4">
                          <h4 className="text-gray-800 font-bold flex items-center gap-2">
                              <FileText size={18} className="text-primary-600"/> الملاحظات العامة
                          </h4>
                          {!isReadOnly && (
                              <button 
                                  onClick={() => generateAIContent('general', 'general_notes', generalNotes)}
                                  disabled={generatingField === 'general-general_notes'}
                                  className="text-xs bg-white border border-purple-200 text-purple-700 px-3 py-1.5 rounded-full flex items-center gap-1 hover:bg-purple-50 transition-colors shadow-sm"
                              >
                                  {generatingField === 'general-general_notes' ? <Loader2 size={12} className="animate-spin"/> : <Wand2 size={12}/>}
                                  صياغة ذكية
                              </button>
                          )}
                      </div>
                      <textarea 
                          rows={4}
                          className="w-full border rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none resize-none bg-white flex-1 disabled:bg-gray-100"
                          placeholder="اكتب توجيهات عامة للمعلم..."
                          value={generalNotes}
                          onChange={(e) => setGeneralNotes(e.target.value)}
                          disabled={isReadOnly}
                      />
                  </div>
              </div>

              <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 pt-6 border-t border-gray-100">
                  <button onClick={() => setStep('scoring')} className="text-gray-500 hover:text-gray-800 font-medium px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                      مراجعة المعايير
                  </button>
                  <div className="flex gap-3 w-full md:w-auto">
                      {isReadOnly && (userRole === UserRole.PRINCIPAL || userRole === UserRole.ADMIN) && (
                          <button 
                              onClick={handleRevertToDraft}
                              className="flex-1 md:flex-none bg-orange-50 border border-orange-200 text-orange-700 px-6 py-3 rounded-xl font-bold hover:bg-orange-100 transition-all flex items-center justify-center gap-2 shadow-sm"
                          >
                              <RotateCcw size={18}/> إعادة فتح للتعديل
                          </button>
                      )}
                      <button 
                          onClick={() => setStep('print')}
                          className="flex-1 md:flex-none bg-white border border-gray-300 text-gray-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all flex items-center justify-center gap-2 shadow-sm"
                      >
                          <Printer size={18}/> معاينة الطباعة
                      </button>
                      {!isReadOnly && (
                          <button 
                              onClick={handleFinish}
                              className="flex-1 md:flex-none bg-gray-900 text-white px-8 py-3 rounded-xl font-bold hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                          >
                              <CheckCircle2 size={20}/> اعتماد التقييم
                          </button>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
}
