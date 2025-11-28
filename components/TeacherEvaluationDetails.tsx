
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ArrowRight, UploadCloud, AlertCircle, FileText, CheckCircle2, Loader2, Link as LinkIcon, Lock, User, School, BookOpen, BadgeCheck, Printer, Calendar, List } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore, TeacherCategory, EvaluationData, EvaluationStatus } from '../types';
import { supabase } from '../supabaseClient';
import PrintView from './PrintView';

interface TeacherEvaluationDetailsProps {
  teacherId: string;
  onBack: () => void;
}

export default function TeacherEvaluationDetails({ teacherId, onBack }: TeacherEvaluationDetailsProps) {
  // View State
  const [viewMode, setViewMode] = useState<'list' | 'details' | 'print'>('list');
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  
  // Data State
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'evidence' | 'objection'>('details');
  const [evaluation, setEvaluation] = useState<EvaluationData | null>(null);
  const [indicators, setIndicators] = useState<EvaluationIndicator[]>([]);
  const [scores, setScores] = useState<Record<string, EvaluationScore>>({});
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  
  // Teacher Specific Info
  const [teacherInfo, setTeacherInfo] = useState<{
      name: string;
      specialty: string;
      schoolName: string;
      category: string;
      nationalId: string;
      ministryId: string;
      managerName: string;
      evaluatorName: string;
  } | null>(null);

  // Objection State
  const [objectionText, setObjectionText] = useState('');
  const [isSubmittingObjection, setIsSubmittingObjection] = useState(false);

  // Evidence State
  const [newEvidenceLink, setNewEvidenceLink] = useState('');
  const [newEvidenceDesc, setNewEvidenceDesc] = useState('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState('');
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);

  // Helper for error messages
  const getErrorMessage = (error: any): string => {
    try {
        if (typeof error === 'string') return error;
        if (error instanceof Error) return error.message;
        if (error?.message) return error.message;
        return JSON.stringify(error);
    } catch {
        return 'خطأ غير معروف';
    }
  };

  // 1. Fetch Basic Teacher Info & History List
  useEffect(() => {
    const fetchInitialData = async () => {
        setHistoryLoading(true);
        try {
            // Fetch Teacher with School Details (Manager & Evaluator)
            const { data: teacherData, error: teacherError } = await supabase
                .from('teachers')
                .select('*, schools(name, ministry_id, manager_name, evaluator_name)')
                .eq('id', teacherId)
                .single();
            
            if (teacherError) throw teacherError;

            setTeacherInfo({
                name: teacherData.name,
                specialty: teacherData.specialty,
                schoolName: teacherData.schools?.name || 'غير محدد',
                category: teacherData.category,
                nationalId: teacherData.national_id,
                ministryId: teacherData.schools?.ministry_id || '',
                managerName: teacherData.schools?.manager_name || '',
                evaluatorName: teacherData.schools?.evaluator_name || ''
            });

            // Fetch Evaluation History
            const { data: historyData, error: historyError } = await supabase
                .from('evaluations')
                .select('id, period_name, eval_date, total_score, status, created_at')
                .eq('teacher_id', teacherId)
                .order('created_at', { ascending: false });

            if (historyError) throw historyError;
            setHistoryList(historyData || []);

        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    fetchInitialData();
  }, [teacherId]);

  // 2. Fetch Specific Evaluation Details (When an item is selected)
  const fetchEvaluationDetails = async (evalId: string) => {
    setLoading(true);
    try {
        const category = teacherInfo?.category as TeacherCategory;

        // Fetch Indicators (Filtered)
        const { data: indData } = await supabase
          .from('evaluation_indicators')
          .select('*, evaluation_criteria(text), verification_indicators(text)')
          .order('sort_order');
        
        const mappedIndicators: EvaluationIndicator[] = (indData || [])
            .map((ind: any) => ({
                ...ind,
                evaluationCriteria: ind.evaluation_criteria?.map((c: any) => c.text) || [],
                verificationIndicators: ind.verification_indicators?.map((v: any) => v.text) || [],
                categoryWeights: ind.category_weights || {},
                applicableCategories: ind.applicable_categories || [] 
            }))
            .filter((ind: EvaluationIndicator) => {
                if (!ind.applicableCategories || ind.applicableCategories.length === 0) return true;
                return category && ind.applicableCategories.includes(category);
            });
            
        setIndicators(mappedIndicators);

        // Fetch Evaluation Data
        const { data: evalData } = await supabase
            .from('evaluations')
            .select('*')
            .eq('id', evalId)
            .single();

        if (evalData) {
            let status = EvaluationStatus.NOT_EVALUATED;
            if (evalData.status === 'completed') status = EvaluationStatus.COMPLETED;
            else if (evalData.status === 'draft') status = EvaluationStatus.DRAFT;

            setEvaluation({
                id: evalData.id,
                teacherId: evalData.teacher_id,
                periodName: evalData.period_name,
                date: evalData.eval_date,
                scores: evalData.scores,
                status: status,
                generalNotes: evalData.general_notes,
                evaluatorName: '', // Assuming not stored directly for simplicity in this view
                managerName: '',
                objectionText: evalData.objection_text,
                objectionStatus: evalData.objection_status,
                teacherEvidenceLinks: evalData.teacher_evidence_links || []
            });
            setScores(evalData.scores || {});
            setObjectionText(evalData.objection_text || '');
        }

    } catch (error) {
        console.error('Error fetching details:', error);
    } finally {
        setLoading(false);
    }
  };

  const handleSelectEvaluation = (evalId: string) => {
      setSelectedEvalId(evalId);
      setViewMode('details');
      fetchEvaluationDetails(evalId);
  };

  const handleSubmitObjection = async () => {
      if (!objectionText.trim()) return alert('الرجاء كتابة نص الاعتراض');
      if (!window.confirm('هل أنت متأكد من تقديم الاعتراض؟')) return;

      setIsSubmittingObjection(true);
      try {
          const { error } = await supabase
              .from('evaluations')
              .update({ 
                  objection_text: objectionText,
                  objection_status: 'pending'
              })
              .eq('id', selectedEvalId); // Use specific ID

          if (error) throw error;
          
          if (evaluation) {
              setEvaluation({ ...evaluation, objectionText: objectionText, objectionStatus: 'pending' });
          }
          alert('تم تقديم الاعتراض بنجاح');
      } catch (error) {
           const msg = getErrorMessage(error);
           alert('حدث خطأ: ' + msg);
      } finally {
          setIsSubmittingObjection(false);
      }
  };

  const handleAddEvidence = async () => {
      if (!newEvidenceLink || !newEvidenceDesc || !selectedIndicatorId) {
          return alert('الرجاء تعبئة جميع الحقول (المؤشر، الرابط، الوصف)');
      }

      setIsSubmittingEvidence(true);
      try {
          const currentLinks = evaluation?.teacherEvidenceLinks || [];
          const newLink = { 
              indicatorId: selectedIndicatorId, 
              url: newEvidenceLink, 
              description: newEvidenceDesc 
          };
          const updatedLinks = [...currentLinks, newLink];

          const { error } = await supabase
              .from('evaluations')
              .update({ teacher_evidence_links: updatedLinks })
              .eq('id', selectedEvalId); // Use specific ID

          if (error) throw error;

          if (evaluation) {
              setEvaluation({ ...evaluation, teacherEvidenceLinks: updatedLinks });
          }
          
          setNewEvidenceLink('');
          setNewEvidenceDesc('');
          setSelectedIndicatorId('');
          alert('تم إضافة الشاهد بنجاح');
      } catch (error) {
          const msg = getErrorMessage(error);
          alert('حدث خطأ: ' + msg);
      } finally {
          setIsSubmittingEvidence(false);
      }
  };

  const calculateTotal = (): number => {
    if (!scores) return 0;
    return Object.values(scores).reduce((acc: number, curr: EvaluationScore) => acc + (curr.score || 0), 0);
  };

  const getMasteryLevel = (totalScore: number) => {
    if (totalScore >= 90) return "متميز";
    if (totalScore >= 80) return "متقدم";
    if (totalScore >= 70) return "متمكن";
    if (totalScore >= 50) return "مبتدئ";
    return "غير مجتاز";
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">مكتمل</span>;
          case 'draft': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold">مسودة</span>;
          default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold">{status}</span>;
      }
  };

  // --- PRINT VIEW ---
  if (viewMode === 'print' && evaluation && teacherInfo) {
      return <PrintView 
        teacherName={teacherInfo.name}
        teacherNationalId={teacherInfo.nationalId}
        teacherSpecialty={teacherInfo.specialty}
        teacherCategory={teacherInfo.category}
        schoolName={teacherInfo.schoolName}
        ministryId={teacherInfo.ministryId}
        managerName={teacherInfo.managerName}
        evaluatorName={teacherInfo.evaluatorName}
        periodDate={evaluation.date || new Date().toLocaleDateString('ar-SA')}
        totalScore={calculateTotal()}
        scores={scores}
        indicators={indicators}
        onBack={() => setViewMode('details')}
      />
  }

  // --- MAIN LAYOUT ---
  return (
    <div className="space-y-6 animate-fade-in">
        {/* Header - Always Visible */}
        <div className="flex items-center gap-3 mb-2">
            <button onClick={onBack} className="p-2 bg-white rounded-lg border hover:bg-gray-50 text-gray-600">
                <ArrowRight size={20} />
            </button>
            <h2 className="text-2xl font-bold text-gray-800">بطاقة الأداء الوظيفي</h2>
        </div>

        {/* Teacher Information Card */}
        {teacherInfo && (
            <div className="bg-white p-5 rounded-xl shadow-sm border border-blue-100 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center text-xl font-bold border-2 border-white shadow-sm">
                        {teacherInfo.name.charAt(0)}
                    </div>
                    <div>
                        <h3 className="font-bold text-gray-900 text-lg">أهلاً بك، {teacherInfo.name}</h3>
                        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-1">
                            <span className="flex items-center gap-1"><BookOpen size={14}/> {teacherInfo.specialty}</span>
                            <span className="flex items-center gap-1"><School size={14}/> {teacherInfo.schoolName}</span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-lg border border-gray-100">
                    <BadgeCheck className="text-primary-600" size={20} />
                    <div>
                        <p className="text-xs text-gray-500">الفئة الوظيفية</p>
                        <p className="font-bold text-gray-800 text-sm">{teacherInfo.category}</p>
                    </div>
                </div>
            </div>
        )}

        {/* --- LIST VIEW --- */}
        {viewMode === 'list' && (
            <div className="space-y-6">
                <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    <List size={20} className="text-primary-600"/> سجل التقييمات
                </h3>
                
                {historyLoading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
                ) : historyList.length === 0 ? (
                    <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                        <FileText size={48} className="mx-auto mb-4 text-gray-300" />
                        <p>لا توجد تقييمات مسجلة حتى الآن.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="px-6 py-4">الفترة</th>
                                    <th className="px-6 py-4">تاريخ التقييم</th>
                                    <th className="px-6 py-4">الدرجة</th>
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historyList.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 group">
                                        <td className="px-6 py-4 font-bold text-gray-800">{item.period_name || 'غير محدد'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400"/>
                                                {item.eval_date || new Date(item.created_at).toLocaleDateString('ar-SA')}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-primary-700">{item.total_score}%</td>
                                        <td className="px-6 py-4">{getStatusBadge(item.status)}</td>
                                        <td className="px-6 py-4 text-left">
                                            <button 
                                                onClick={() => handleSelectEvaluation(item.id)}
                                                className="bg-primary-50 text-primary-700 hover:bg-primary-100 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2 ml-auto"
                                            >
                                                عرض التفاصيل <ChevronLeft size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        )}

        {/* --- DETAILS VIEW --- */}
        {viewMode === 'details' && (
            <>
                <div className="flex justify-between items-center">
                    <button onClick={() => setViewMode('list')} className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm">
                        <ArrowRight size={16} /> العودة للسجل
                    </button>
                    {evaluation?.status === EvaluationStatus.COMPLETED && (
                        <button 
                            onClick={() => setViewMode('print')}
                            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 flex items-center gap-2 text-sm"
                        >
                            <Printer size={16} /> طباعة التقييم
                        </button>
                    )}
                </div>

                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        {/* Summary Header */}
                        <div className="p-6 bg-gradient-to-r from-primary-600 to-primary-700 text-white">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="opacity-90 text-sm mb-1">{evaluation?.periodName}</p>
                                    <h3 className="text-4xl font-bold">{calculateTotal().toFixed(1)}%</h3>
                                </div>
                                <div className="text-left">
                                    <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg text-lg font-bold">
                                        {getMasteryLevel(calculateTotal())}
                                    </div>
                                    <p className="text-xs mt-2 opacity-80">{evaluation?.status === EvaluationStatus.COMPLETED ? 'تم الاعتماد' : 'مسودة (غير معتمد)'}</p>
                                </div>
                            </div>
                        </div>
                        
                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 bg-gray-50">
                            <button 
                                onClick={() => setActiveTab('details')}
                                className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText size={16} /> تفاصيل التقييم
                            </button>
                            <button 
                                onClick={() => setActiveTab('evidence')}
                                className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'evidence' ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <UploadCloud size={16} /> الشواهد المرفقة
                            </button>
                            <button 
                                onClick={() => setActiveTab('objection')}
                                className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'objection' ? 'border-red-500 text-red-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <AlertCircle size={16} /> الاعتراضات
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            
                            {/* 1. Details */}
                            {activeTab === 'details' && (
                                <div className="space-y-6">
                                    {indicators.map((ind, idx) => {
                                        const scoreData = scores[ind.id] || { score: 0, level: 0, notes: '', improvement: '' };
                                        return (
                                            <div key={ind.id} className="border rounded-lg p-4 hover:border-primary-200 transition-colors">
                                                <div className="flex justify-between items-start mb-3 border-b border-gray-100 pb-2">
                                                    <h4 className="font-bold text-gray-800">{idx + 1}. {ind.text}</h4>
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${scoreData.score > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {scoreData.score.toFixed(1)} / {ind.weight}
                                                    </span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <span className="text-gray-500 text-xs block mb-1">نقاط القوة / الملاحظات:</span>
                                                        <p className="text-gray-700 bg-gray-50 p-2 rounded">{scoreData.notes || 'لا يوجد'}</p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 text-xs block mb-1">فرص التحسين:</span>
                                                        <p className="text-gray-700 bg-gray-50 p-2 rounded">{scoreData.improvement || 'لا يوجد'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* 2. Evidence */}
                            {activeTab === 'evidence' && (
                                <div className="space-y-8">
                                    <div>
                                        <h4 className="font-bold text-gray-700 mb-4">قائمة الشواهد المرفقة</h4>
                                        {(!evaluation?.teacherEvidenceLinks || evaluation.teacherEvidenceLinks.length === 0) ? (
                                            <div className="text-gray-500 text-sm italic bg-gray-50 p-4 rounded text-center">لا توجد شواهد مرفقة حالياً</div>
                                        ) : (
                                            <div className="space-y-3">
                                                {evaluation.teacherEvidenceLinks.map((link, i) => {
                                                    const indName = indicators.find(ind => ind.id === link.indicatorId)?.text || 'مؤشر غير معروف';
                                                    return (
                                                        <div key={i} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-800">{link.description}</p>
                                                                <p className="text-xs text-gray-500 mt-1">خاص بـ: {indName}</p>
                                                            </div>
                                                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                                                                <LinkIcon size={14} /> فتح الرابط
                                                            </a>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>

                                    {/* Add Evidence Form */}
                                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                                        <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                                            <UploadCloud size={18}/> إرفاق شاهد جديد
                                        </h4>
                                        <div className="space-y-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">المؤشر المرتبط</label>
                                                <select 
                                                    className="w-full border rounded-lg p-2.5 bg-white text-sm"
                                                    value={selectedIndicatorId}
                                                    onChange={(e) => setSelectedIndicatorId(e.target.value)}
                                                >
                                                    <option value="">-- اختر المؤشر --</option>
                                                    {indicators.map(ind => (
                                                        <option key={ind.id} value={ind.id}>{ind.text}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">وصف الشاهد (اسم الملف/المستند)</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full border rounded-lg p-2.5 text-sm"
                                                    placeholder="مثال: شهادة حضور دورة الذكاء الاصطناعي"
                                                    value={newEvidenceDesc}
                                                    onChange={(e) => setNewEvidenceDesc(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">رابط الشاهد (Drive, OneDrive, Dropbox)</label>
                                                <input 
                                                    type="url" 
                                                    className="w-full border rounded-lg p-2.5 text-sm"
                                                    placeholder="https://..."
                                                    value={newEvidenceLink}
                                                    onChange={(e) => setNewEvidenceLink(e.target.value)}
                                                />
                                                <p className="text-xs text-gray-500 mt-1">يرجى التأكد من أن الرابط متاح للمشاركة (Public or Shared with Organization).</p>
                                            </div>
                                            <button 
                                                onClick={handleAddEvidence}
                                                disabled={isSubmittingEvidence}
                                                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-70"
                                            >
                                                {isSubmittingEvidence && <Loader2 className="animate-spin" size={16} />}
                                                حفظ الشاهد
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 3. Objection */}
                            {activeTab === 'objection' && (
                                <div className="space-y-6">
                                    {evaluation?.status !== EvaluationStatus.COMPLETED && (
                                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex items-center gap-2 text-sm">
                                            <Lock size={16} />
                                            يمكنك تقديم اعتراض فقط بعد اعتماد التقييم النهائي من قبل مدير المدرسة.
                                        </div>
                                    )}
                                    
                                    <div className="bg-white border rounded-xl p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <h4 className="font-bold text-gray-800">حالة الاعتراض</h4>
                                            {evaluation?.objectionStatus === 'pending' && <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold">قيد المراجعة</span>}
                                            {evaluation?.objectionStatus === 'accepted' && <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold">تم القبول</span>}
                                            {evaluation?.objectionStatus === 'rejected' && <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-xs font-bold">مرفوض</span>}
                                            {(!evaluation?.objectionStatus || evaluation.objectionStatus === 'none') && <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">لا يوجد اعتراض</span>}
                                        </div>

                                        {evaluation?.objectionStatus && evaluation.objectionStatus !== 'none' ? (
                                            <div className="bg-gray-50 p-4 rounded-lg text-gray-700 border text-sm">
                                                <p className="font-bold mb-2">نص الاعتراض:</p>
                                                <p>{evaluation.objectionText}</p>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">نص الاعتراض / الملاحظات</label>
                                                <textarea 
                                                    rows={5}
                                                    className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 outline-none"
                                                    placeholder="اكتب أسباب الاعتراض هنا بالتفصيل..."
                                                    value={objectionText}
                                                    onChange={(e) => setObjectionText(e.target.value)}
                                                    disabled={evaluation?.status !== EvaluationStatus.COMPLETED}
                                                ></textarea>
                                                <button 
                                                    onClick={handleSubmitObjection}
                                                    disabled={evaluation?.status !== EvaluationStatus.COMPLETED || isSubmittingObjection || !objectionText.trim()}
                                                    className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 font-bold text-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {isSubmittingObjection && <Loader2 className="animate-spin" size={16} />}
                                                    رفع الاعتراض
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </>
        )}
    </div>
  );
}
