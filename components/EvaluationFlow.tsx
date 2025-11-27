import React, { useState, useEffect } from 'react';
import { ChevronLeft, Save, Printer, ArrowRight, CheckCircle2, UploadCloud, Star, Loader2 } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore } from '../types';
import PrintView from './PrintView';
import { supabase } from '../supabaseClient';

const INDICATORS: EvaluationIndicator[] = [
  {
    id: '1',
    text: 'أداء الواجبات الوظيفية',
    weight: 10,
    description: 'يطبق الأنظمة وقواعد السلوك الوظيفية وأخلاقيات بيئة التعلم...',
    evaluationCriteria: [
        'يطبق الأنظمة وقواعد السلوك الوظيفية وأخلاقيات بيئة التعلم.',
        'يعزز الانتماء والولاء الوطني والقيم الوطنية.',
        'يحافظ على خصوصية المعلومات المهنية، وحماية البيانات والمعلومات التي تتعلق بالعمل أو الأنشطة المهنية من الوصول غير المصرح به.',
        'الامتثال للقوانين واللوائح وسياسات وإجراءات العمل التي تتوافق مع القوانين واللوائح المحلية والدولية.'
    ],
    verificationIndicators: [
        'سجل الدوام الرسمي',
        'خطة توزيع المقرر',
        'سجل المناوبة والإشراف',
        'سجل الانتظار',
        'ملاحظة الأداء',
        'الزيارات الصفية'
    ],
    rubric: {}
  },
  {
    id: '2',
    text: 'التفاعل مع المجتمع المهني',
    weight: 10,
    description: 'المشاركة الفعّالة في مجتمعات وشبكات التعليم...',
    evaluationCriteria: [
        'التعلم المستمر من خلال التطوير المهني، وورش العمل، والدورات والمؤتمرات.',
        'التعاون والتواصل لبناء شبكات مهنية، تبادل الأفكار، ومواجهة التحديات التعليمية.',
        'الإسهام في التطوير عبر الأبحاث، تطوير المناهج، ودعم السياسات التعليمية.',
        'الإرشاد والتوجيه بدعم المعلمين الجدد ومشاركة الخبرات.',
        'التفكير الذاتي لتحسين الممارسات وبناء بيئة تعليمية تعزز التعلم المستمر والتطوير.'
    ],
    verificationIndicators: [
        'سجل مجتمعات التعلم',
        'سجل تبادل الزيارات',
        'تقرير درس تطبيقي',
        'شهادات حضور الدورات',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '3',
    text: 'التفاعل مع أولياء الأمور',
    weight: 10,
    description: 'المساهمة في دعم وتحقيق بيئة تعليمية فعالة لتحسين التحصيل الدراسي للطلبة...',
    evaluationCriteria: [
        'تفعيل قنوات اتصال فعالة مع أولياء الأمور لمناقشة تقدم الطلبة والتحديات التي تواجههم.',
        'تشجيع أولياء الأمور على المشاركة في العملية التعليمية، مثل المساعدة في الواجبات المنزلية وتوفير بيئة داعمة.',
        'التواصل المستمر مع أولياء الأمور باستخدام أساليب إيجابية لمناقشة التقدم العلمي والاجتماعي للمتعلمين وخطط التطوير المستقبلية للطلبة وإيجاد حلول مشتركة.',
        'الاستجابة والاستماع الى مخاوف أولياء الأمور والعمل بشكل تعاوني لمعالجتها.'
    ],
    verificationIndicators: [
        'صور من الجمعية العمومية لأولياء الأمور',
        'تقرير اجتماع ولي الامر مع المعلم',
        'الخطة الأسبوعية',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '4',
    text: 'التنويع في استراتيجيات التدريس',
    weight: 10,
    description: 'قدرة المعلم على استخدام أساليب وطرائق تدريس مناسبة لتعزيز عملية التعلم.',
    evaluationCriteria: [
        'استخدام استراتيجيات تدريس مناسبة للموقف التعليمي.',
        'استخدام استراتيجيات تدريس مناسبة لحاجات وميول المتعلمين.',
        'استخدام استراتيجيات تعمل على تنمية القدرة على التفكير والابداع.',
        'استخدام استراتيجيات تنمي مهارات الحوار والمناقشة.'
    ],
    verificationIndicators: [
        'تقرير تطبيق استراتيجية',
        'ملف انجاز المعلم',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '5',
    text: 'تحسين نتائج المتعلمين',
    weight: 10,
    description: 'عملية تحسين التحصيل الدراسي تهدف إلى معالجة نقاط الضعف وتطوير نقاط القوة...',
    evaluationCriteria: [
        'تحديد أهداف ومعايير واضحة: ليعرف المتعلمون ما يتوقع منهم تحقيقه.',
        'تقديم إفادة سريعة ومحددة: فور ملاحظة الأداء، مع التركيز على الإيجابيات وتقديم اقتراحات بناءة للتحسين.',
        'تكييف الإفادة وفق للاحتياجات الفردية: لضمان التفاعل الفعال وتشجيع المتعلمين على طرح الأسئلة وتطبيق الاقتراحات.',
        'تعزيز الثقة وتشجيع التطور: من خلال تقديم ملاحظات تشجيعية وفرص لتحسين الأداء.',
        'استخدام التكنولوجيا: لتقديم الإفادة بطرق مبتكرة مثل البريد الإلكتروني ومنصات التعلم.'
    ],
    verificationIndicators: [
        'نتائج الاختبار القبلي والبعدي',
        'كشف متابعة الطلاب',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '6',
    text: 'إعداد وتنفيذ خطة التعلم',
    weight: 10,
    description: 'تمكن المعلم من إعداد خطة منظمة تساعد على تحديد الأهداف التعليمية وتنفيذها بوضوح...',
    evaluationCriteria: [
        'اعداد خطة التعلم وفق السياسات المنظمة لذلك، وبما يتواءم مع تشخيص واقع المتعلمين.',
        'تحقيق الأهداف التعليمية وعناصر المواد المسندة إليه.',
        'التخطيط للأنشطة الصفية والأنشطة غير الصفية من قبل المعلم الخبير (إن وجد).',
        'مشاركة المعلم الممارس والمعلم المتقدم في الإعداد والتنفيذ للأنشطة الصفية والأنشطة غير الصفية.',
        'تفهم الخصائص النفسية للمرحلة العمرية التي يقوم بتدريسها.'
    ],
    verificationIndicators: [
        'خطة توزيع المنهج',
        'نموذج اعداد الدروس',
        'نماذج من الواجبات والاختبارات',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '7',
    text: 'توظيف تقنيات ووسائل التعلم المناسبة',
    weight: 10,
    description: 'قدرة المعلم على استخدام الوسائل التعليمية والأدوات المتنوعة المناسبة للموقف التعليمي...',
    evaluationCriteria: [
        'تنويع تقنيات ووسائل التعلم المناسبة بغرض تحقيق الأهداف التعليمية بفاعلية.',
        'مراعاة الفروق الفردية بين المتعلمين لتيسير نقل الخبرات التعليمية بسهولة ووضوح.',
        'استخدام التقنيات والوسائل التعليمية المناسبة لحاجات وانماط المتعلمين.',
        'اكساب الطلاب المعرفة وتنمية قدراتهم على التأمل والملاحظة والتفكير العلمي للوصول إلى حل المشكلات.'
    ],
    verificationIndicators: [
        'صور من الوسائل التعليمية المستخدمة',
        'تقرير عن برنامج تقني',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '8',
    text: 'تهيئة بيئة تعليمية',
    weight: 5,
    description: 'قدرة المعلم على ممارسة عمليات توفر للمتعلمين فرصًا متكافئة...',
    evaluationCriteria: [
        'توفير بيئة تعليمية آمنة تشجع على التعلم وتدعم النمو الشخصي والأكاديمي.',
        'توفير بيئة تعليمية تحقق الأمان النفسي وتتسم بالاحترام المتبادل.',
        'توفير بيئة تعليمية تمكن المتعلمين من التعبير عن أنفسهم ومشاركة أفكارهم مع أقرانهم.',
        'إثارة دافعية المتعلمين من خلال التنويع في أساليب التعلم.'
    ],
    verificationIndicators: [
        'تقرير تصنيف الطلاب وفق أنماط التعلم',
        'نماذج من التحفيز المعنوي والمادي',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '9',
    text: 'الإدارة الصفية',
    weight: 5,
    description: 'الإجراءات اللازمة لتحقيق بيئة صفية آمنة وجاذبة وملائمة لعمليتي التعلم والتعليم...',
    evaluationCriteria: [
        'مراعاة الفروق الفردية بين المتعلمين.',
        'توجيه المتعلمين لتطبيق القوانين والتعليمات الصفية.',
        'تعزيز الانضباط عند المتعلمين وتنظيم عملية التفاعل والتواصل بينهم.',
        'تنظيم الطلاب بما يناسب الموقف المدرسي.'
    ],
    verificationIndicators: [
        'كشف المتابعة',
        'تطبيق إدارة الصف',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '10',
    text: 'تحليل نتائج المتعلمين وتشخيص مستوياتهم',
    weight: 10,
    description: 'تحليل البيانات لتطوير التعلم وتقييم أداء المتعلمين بوضوح...',
    evaluationCriteria: [
        'تنويع مصادر التقييم: لضمان شمولية النتائج وتقليل التحيز.',
        'تطوير أهداف تعليمية: قصيرة وطويلة المدى تراعي الفروق الفردية وبيئة التعلم.',
        'تفسير البيانات: لاتخاذ قرارات مستنيرة بشأن فعالية التدريس والمناهج.',
        'قياس التطبيق العملي للمعرفة: عبر مواقف ومشاريع حقيقية.',
        'تحليل الأداء العام: لتحديد نقاط القوة والضعف، مع إشراك المتعلمين في فهم نتائجهم وتقديم ملاحظات تدعم التطور المستمر.'
    ],
    verificationIndicators: [
        'تقرير تحليل نتائج الطلاب',
        'سجل معالجة الفاقد التعليمي',
        'ملاحظة الأداء'
    ],
    rubric: {}
  },
  {
    id: '11',
    text: 'تنوع أساليب التقويم',
    weight: 10,
    description: 'استخدام مجموعة متنوعة من الطرق لتقييم التقدم والإنجازات الأكاديمية...',
    evaluationCriteria: [
        'معرفة وفهم أساليب وأدوات التقويم المتنوعة.',
        'معرفة وفهم خصائص نمو المتعلمين وأساليب تعلمهم.',
        'استخدام مصادر متنوعة للتقييم مثل الملاحظة الصفية، الاستبانات، التقارير الذاتية، تحليل نتائج المتعلمين.',
        'توظيف أساليب تقويم متنوعة على أن يكون من ضمنها الاختبارات (شفهية، تحريرية) والمهمات الأدائية التي تتناسب مع طبيعة الأهداف ومخرجات التعلم.',
        'مراعاة الفروق الفردية بين المتعلمين أثناء التقويم وتقديم التغذية الراجعة لرفع مستوى التحصيل الدراسي.',
        'الاستفادة من نتائج تنوع أساليب وأدوات التقويم بتوظيفها في تحسين مستوى الأداء بصفة مستمرة.',
        'استخدام التقويم القبلي (التشخيصي) للوقوف على مدى استعداد المتعلمين وتشخيص امتلاكهم لمهارات وخبرات أساسية سابقة.',
        'تطبيق التقويم التكويني والختامي لمعرفة مدى تحقق أهداف العملية التعليمية وقياس تقدم التعلم.'
    ],
    verificationIndicators: [
        'نماذج من الاختبارات',
        'نماذج من ملفات انجاز الطلاب',
        'نماذج من المهام الادائية ومشاريع الطلاب',
        'ملاحظة الأداء'
    ],
    rubric: {}
  }
];

interface EvaluationFlowProps {
  teacherId: string;
  onBack: () => void;
}

export default function EvaluationFlow({ teacherId, onBack }: EvaluationFlowProps) {
  const [step, setStep] = useState<'period' | 'scoring' | 'summary' | 'print'>('period');
  const [currentIndicatorIndex, setCurrentIndicatorIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  
  // Data State
  const [period, setPeriod] = useState({ name: '', date: new Date().toISOString().split('T')[0] });
  const [scores, setScores] = useState<Record<string, EvaluationScore>>({});
  const [generalNotes, setGeneralNotes] = useState('');

  // Fetch Data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('evaluations')
          .select('*')
          .eq('teacher_id', teacherId)
          .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
             console.error('Error fetching data:', error);
        }

        if (data) {
          setPeriod({ name: data.period_name || '', date: data.eval_date || new Date().toISOString().split('T')[0] });
          setScores(data.scores || {});
          setGeneralNotes(data.general_notes || '');
          if (Object.keys(data.scores || {}).length > 0) {
             setStep('scoring');
          }
        }
      } catch (error) {
        console.error('Connection error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [teacherId]);

  // Auto-Save to Supabase with Debounce
  useEffect(() => {
    if (isLoading) return; // Don't save while initial load

    const saveData = async () => {
      setSaveStatus('saving');
      try {
        const payload = {
            teacher_id: teacherId,
            period_name: period.name,
            eval_date: period.date,
            scores: scores,
            general_notes: generalNotes,
            status: 'draft' // Or calculate based on completion
        };

        const { error } = await supabase
            .from('evaluations')
            .upsert(payload, { onConflict: 'teacher_id' }); // Upsert based on unique teacher_id

        if (error) throw error;
        setSaveStatus('saved');
      } catch (error) {
        console.error('Error saving:', error);
        setSaveStatus('error');
      }
    };

    const timeoutId = setTimeout(() => {
        if (period.name) { // Only save if at least period is started
             saveData();
        }
    }, 1500); // Save after 1.5 seconds of inactivity

    return () => clearTimeout(timeoutId);
  }, [period, scores, generalNotes, teacherId, isLoading]);


  // Helpers
  const currentIndicator = INDICATORS[currentIndicatorIndex];
  const currentScore = scores[currentIndicator.id] || { 
    indicatorId: currentIndicator.id, 
    level: 0,
    score: 0, 
    subScores: new Array(currentIndicator.evaluationCriteria.length).fill(undefined),
    evidence: '', 
    notes: '', 
    improvement: '', 
    isComplete: false 
  };

  const getRubricScore = (score: number, max: number) => {
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

  const getAutoImprovementNote = (score: number, max: number) => {
      if (score === 0) return "";
      const percentage = (score / max) * 100;
      
      if (percentage >= 90) return "الاستمرار في نشر ثقافة التميز والابتكار في هذا المجال.";
      if (percentage >= 80) return "توثيق المبادرات ونشرها بشكل أوسع لتصبح نماذج مرجعية.";
      if (percentage >= 70) return "العمل على ابتكار مبادرات نوعية تتجاوز التطبيق الأساسي.";
      if (percentage >= 50) return "التركيز على الالتزام بتطبيق المعايير الأساسية بشكل منتظم.";
      return "يحتاج إلى خطة علاجية عاجلة لفهم وتطبيق أساسيات المعيار.";
  };

  const updateSubScore = (index: number, valueStr: string) => {
    const val = parseFloat(valueStr);
    const maxVal = currentIndicator.weight;

    if (!isNaN(val) && (val < 0 || val > maxVal)) return;

    const newSubScores = [...(currentScore.subScores || new Array(currentIndicator.evaluationCriteria.length).fill(undefined))];
    newSubScores[index] = isNaN(val) ? undefined : val;

    const definedScores = newSubScores.filter(s => s !== undefined) as number[];
    const avgScore = definedScores.length > 0 
        ? definedScores.reduce((a, b) => a + b, 0) / definedScores.length 
        : 0;
    
    const rubricLevel = getRubricScore(avgScore, currentIndicator.weight);

    const newScore = {
       ...currentScore,
       subScores: newSubScores,
       score: avgScore, 
       level: rubricLevel,
       isComplete: newSubScores.every(s => s !== undefined),
       improvement: getAutoImprovementNote(avgScore, currentIndicator.weight)
    };
    
    setScores({
      ...scores,
      [currentIndicator.id]: newScore
    });
  };

  const updateField = (field: keyof EvaluationScore, value: any) => {
    setScores({
      ...scores,
      [currentIndicator.id]: {
        ...currentScore,
        [field]: value
      }
    });
  };

  const calculateTotal = () => {
    return Object.values(scores).reduce((acc, curr) => acc + curr.score, 0);
  };

  if (isLoading) {
      return (
          <div className="flex flex-col items-center justify-center h-96">
              <Loader2 className="animate-spin text-primary-600 mb-4" size={40} />
              <p className="text-gray-500">جاري تحميل البيانات...</p>
          </div>
      );
  }

  // Render logic
  if (step === 'print') {
     return <PrintView 
        teacherName="محمد عبدالله الشمري" // Mock
        periodDate={period.date}
        totalScore={calculateTotal()}
        scores={scores}
        indicators={INDICATORS}
        onBack={() => setStep('summary')}
     />
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Info */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex justify-between items-start">
        <div>
           <div className="flex items-center gap-2 mb-2">
             <button onClick={onBack} className="text-gray-400 hover:text-gray-700"><ArrowRight size={20} /></button>
             <h2 className="text-xl font-bold text-gray-800">تقييم المعلم: محمد عبدالله الشمري</h2>
           </div>
           <div className="flex gap-4 text-sm text-gray-500 mr-7">
              <span>التخصص: لغة عربية</span>
              <span>المدرسة: مدرسة الرياض النموذجية</span>
           </div>
        </div>
        <div className="flex flex-col items-end">
            <span className="text-sm text-gray-500 mb-1">حالة التقييم</span>
            <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-medium">جاري التقييم</span>
            <div className="flex items-center gap-1 mt-2 text-xs">
                 {saveStatus === 'saving' && <span className="text-gray-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> جاري الحفظ...</span>}
                 {saveStatus === 'saved' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={10} /> تم الحفظ</span>}
                 {saveStatus === 'error' && <span className="text-red-500">فشل الحفظ</span>}
            </div>
        </div>
      </div>

      {/* Step 1: Period Definition */}
      {step === 'period' && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
           <h3 className="text-lg font-bold mb-6 border-b pb-4">أولاً: تحديد فترة التقييم</h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                 <label className="block text-sm font-medium mb-2">اسم فترة التقييم</label>
                 <select 
                    className="w-full border p-2.5 rounded-lg"
                    value={period.name}
                    onChange={(e) => setPeriod({...period, name: e.target.value})}
                 >
                    <option value="">اختر الفترة</option>
                    <option value="الربع الأول">الربع الأول</option>
                    <option value="الربع الثاني">الربع الثاني</option>
                    <option value="نهاية العام">نهاية العام</option>
                 </select>
              </div>
              <div>
                 <label className="block text-sm font-medium mb-2">تاريخ التقييم</label>
                 <input 
                    type="date" 
                    className="w-full border p-2.5 rounded-lg"
                    value={period.date}
                    onChange={(e) => setPeriod({...period, date: e.target.value})}
                 />
              </div>
           </div>
           <div className="flex justify-end">
              <button 
                disabled={!period.name || !period.date}
                onClick={() => setStep('scoring')}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                بدء التقييم <ChevronLeft size={18} />
              </button>
           </div>
        </div>
      )}

      {/* Step 2: Scoring */}
      {step === 'scoring' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
            {/* Sidebar Indicators List */}
            <div className="lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
                <div className="p-4 bg-gray-50 font-bold border-b text-gray-700 flex justify-between items-center">
                  <span>مؤشرات التقييم</span>
                  <span className="text-xs bg-gray-200 px-2 py-1 rounded-full">{Math.round((Object.keys(scores).length / INDICATORS.length) * 100)}%</span>
                </div>
                <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
                    {INDICATORS.map((ind, idx) => (
                        <button 
                            key={ind.id}
                            onClick={() => setCurrentIndicatorIndex(idx)}
                            className={`w-full text-right p-4 text-sm flex items-center justify-between transition-colors ${
                                idx === currentIndicatorIndex 
                                ? 'bg-primary-50 text-primary-700 font-medium border-r-4 border-primary-500' 
                                : 'hover:bg-gray-50 text-gray-600'
                            }`}
                        >
                            <span className="truncate ml-2">{ind.id}- {ind.text}</span>
                            {scores[ind.id]?.isComplete ? (
                              <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                            ) : (
                              <span className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"></span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Scoring Area */}
            <div className="lg:col-span-9 space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Top Bar with Score Summary */}
                  <div className="bg-gray-50 p-6 border-b border-gray-200 flex justify-between items-start">
                      <div className="flex gap-4">
                         <div className="bg-blue-100 text-blue-800 p-4 rounded-lg text-center min-w-[120px]">
                            <div className="text-sm font-medium mb-1">سلم التقدير</div>
                            <div className="text-2xl font-bold font-mono" dir="ltr">
                                {currentIndicator.weight} / {currentScore.score > 0 ? currentScore.score.toFixed(1) : '--'}
                            </div>
                            <div className="text-xs text-blue-600 mt-1">متوسط المؤشر: {currentScore.score > 0 ? currentScore.score.toFixed(1) : '--'}%</div>
                         </div>
                      </div>
                      <div className="text-left">
                         <h3 className="text-xl font-bold text-gray-800 mb-1">{currentIndicator.text}</h3>
                         <div className="text-sm text-gray-500">الوزن: {currentIndicator.weight}%</div>
                      </div>
                  </div>

                  {/* Main Table */}
                  <div className="overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                         <thead className="bg-white text-primary-600 text-sm border-b">
                            <tr>
                               <th className="px-6 py-4 font-bold text-right w-[33%]">مؤشر التقييم</th>
                               <th className="px-6 py-4 font-bold text-center w-[10%]">الحد الأقصى</th>
                               <th className="px-6 py-4 font-bold text-center w-[10%]">الدرجة</th>
                               <th className="px-6 py-4 font-bold text-center w-[12%]">الحالة</th>
                               <th className="px-6 py-4 font-bold text-right w-[20%]">مؤشرات التحقق</th>
                               <th className="px-6 py-4 font-bold text-center w-[15%]">الشواهد</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-gray-100">
                            {currentIndicator.evaluationCriteria.map((criteriaText, idx) => {
                                const subScore = currentScore.subScores?.[idx];
                                const isCompleted = subScore !== undefined;
                                
                                return (
                                    <tr key={idx} className="hover:bg-gray-50">
                                        {/* Per Row Columns */}
                                        <td className="px-6 py-4 text-right text-gray-700 font-medium leading-relaxed align-middle">
                                            {criteriaText}
                                        </td>
                                        <td className="px-4 py-4 text-center text-gray-500 font-medium align-middle">
                                            {currentIndicator.weight}
                                        </td>
                                        <td className="px-4 py-4 text-center align-middle">
                                            <input 
                                                type="number"
                                                min="0"
                                                max={currentIndicator.weight}
                                                step="0.5"
                                                className="w-16 h-10 border border-gray-300 rounded-lg text-center font-bold text-gray-700 focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none"
                                                value={subScore !== undefined ? subScore : ''}
                                                onChange={(e) => updateSubScore(idx, e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center align-middle">
                                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${isCompleted ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                               {isCompleted ? 'مكتمل' : 'غير مكتمل'} 
                                            </span>
                                        </td>

                                        {/* RowSpanned Columns for Verification & Evidence (Last in DOM = Left in RTL) */}
                                        {idx === 0 && (
                                            <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-6 py-4 align-top border-r border-gray-100">
                                                <ul className="space-y-3">
                                                   {currentIndicator.verificationIndicators.map((v, vIdx) => (
                                                      <li key={vIdx} className="flex items-start gap-2 text-sm text-gray-600">
                                                         <div className="w-1.5 h-1.5 bg-gray-400 rounded-full mt-1.5 flex-shrink-0"></div>
                                                         {v}
                                                      </li>
                                                   ))}
                                                </ul>
                                            </td>
                                        )}
                                        {idx === 0 && (
                                            <td rowSpan={currentIndicator.evaluationCriteria.length} className="px-6 py-4 align-top border-r border-gray-100 bg-gray-50/30">
                                                <div className="space-y-3 min-h-[150px] flex flex-col items-center justify-center">
                                                    {/* Evidence Simulation */}
                                                    <div className="text-center text-gray-400 text-xs mb-2">لا توجد شواهد</div>
                                                    <button className="text-primary-600 text-xs flex items-center gap-1 hover:underline bg-white border border-primary-100 px-3 py-1.5 rounded-full shadow-sm">
                                                        <UploadCloud size={14} /> إضافة
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                );
                            })}
                         </tbody>
                      </table>
                  </div>

                  {/* Automated Results & Notes */}
                  <div className="bg-gray-50 p-6 border-t border-gray-200">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                           <div>
                              <label className="block text-xs font-bold text-gray-500 mb-2">درجة السلم للمؤشر (آلي)</label>
                              <div className="w-full border rounded-lg p-3 bg-white text-gray-800 font-bold flex items-center justify-between shadow-sm">
                                 <span className="text-lg">
                                    {currentScore.level > 0 ? `${currentScore.level} من 5` : '---'}
                                 </span>
                                 <span className="text-sm text-gray-500 font-normal">
                                    ({getMasteryLevel(currentScore.score, currentIndicator.weight)})
                                 </span>
                              </div>
                          </div>
                          <div>
                              <label className="block text-xs font-bold text-gray-500 mb-2">فرص التحسين (آلي)</label>
                              <div className="w-full border rounded-lg p-3 bg-white text-sm text-gray-600 min-h-[46px] shadow-sm flex items-center">
                                 {currentScore.improvement || '---'}
                              </div>
                          </div>
                      </div>
                      
                      <div>
                          <label className="block text-xs font-bold text-gray-500 mb-2 flex items-center gap-1 cursor-pointer w-fit" onClick={() => {}}>
                             <input type="checkbox" className="ml-2 accent-primary-600" checked={!!currentScore.notes} readOnly /> 
                             أضف ملاحظات على المؤشر (اختياري)
                          </label>
                          <textarea 
                              rows={2} 
                              className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary-500 outline-none bg-white shadow-sm transition-all"
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
                          className="px-6 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg disabled:opacity-50 transition-colors font-medium"
                      >
                          السابق
                      </button>
                      
                      {currentIndicatorIndex < INDICATORS.length - 1 ? (
                           <button 
                              onClick={() => setCurrentIndicatorIndex(currentIndicatorIndex + 1)}
                              className="flex items-center gap-2 bg-primary-600 text-white px-8 py-2 rounded-lg hover:bg-primary-700 shadow-md hover:shadow-lg transition-all font-medium"
                           >
                              حفظ والانتقال للتالي <ChevronLeft size={18} />
                          </button>
                      ) : (
                           <button 
                              onClick={() => setStep('summary')}
                              className="flex items-center gap-2 bg-green-600 text-white px-8 py-2 rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg transition-all font-medium"
                           >
                              حفظ واكتمال التقييم <Save size={18} />
                          </button>
                      )}
                  </div>
              </div>
            </div>
        </div>
      )}

      {/* Step 3: Summary */}
      {step === 'summary' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 animate-fade-in">
             <div className="text-center mb-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                    <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">ملخص التقييم</h2>
                <p className="text-gray-500">تم رصد جميع الدرجات بنجاح</p>
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
                <button onClick={() => setStep('scoring')} className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">مراجعة الدرجات</button>
                <button onClick={() => setStep('print')} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 flex items-center gap-2"><Printer size={18} /> طباعة التقييم</button>
                <button onClick={onBack} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">اعتماد وإرسال</button>
             </div>
          </div>
      )}
    </div>
  );
}