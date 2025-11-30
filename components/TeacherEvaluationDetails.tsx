
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ArrowRight, UploadCloud, AlertCircle, FileText, CheckCircle2, Loader2, Link as LinkIcon, Lock, User, School, BookOpen, BadgeCheck, Printer, Calendar, List, Trash2 } from 'lucide-react';
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
  
  // Evidence State (Global)
  const [globalEvidence, setGlobalEvidence] = useState<any[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Teacher Specific Info
  const [teacherInfo, setTeacherInfo] = useState<{
      name: string;
      specialty: string;
      schoolName: string;
      category: string;
      nationalId: string;
      ministryId: string;
      educationOffice: string;
      academicYear: string;
      managerName: string;
      evaluatorName: string;
  } | null>(null);

  // Objection State
  const [objectionText, setObjectionText] = useState('');
  const [isSubmittingObjection, setIsSubmittingObjection] = useState(false);

  // Evidence Form State
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
                .select('*, schools(name, ministry_id, education_office, academic_year, manager_name, evaluator_name)')
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
                educationOffice: teacherData.schools?.education_office || '',
                academicYear: teacherData.schools?.academic_year || '',
                managerName: teacherData.schools?.manager_name || '',
                evaluatorName: teacherData.schools?.evaluator_name || ''
            });

            // Fetch Indicators for evidence dropdown
            const category = teacherData.category as TeacherCategory;
            const { data: indData } = await supabase
                .from('evaluation_indicators')
                .select('*')
                .order('sort_order');
            
            // Filter indicators
            const filteredIndicators = (indData || []).filter((ind: any) => {
                if (!ind.applicable_categories || ind.applicable_categories.length === 0) return true;
                return category && ind.applicable_categories.includes(category);
            });
            setIndicators(filteredIndicators);

            // Fetch Evaluation History
            const { data: historyData, error: historyError } = await supabase
                .from('evaluations')
                .select('id, period_name, eval_date, total_score, status, created_at')
                .eq('teacher_id', teacherId)
                .order('created_at', { ascending: false });

            if (historyError) throw historyError;
            setHistoryList(historyData || []);

            // Fetch Global Evidence (Initially)
            fetchEvidence();

        } catch (error) {
            console.error('Error fetching initial data:', error);
        } finally {
            setHistoryLoading(false);
        }
    };

    fetchInitialData();
  }, [teacherId]);

  const fetchEvidence = async () => {
      setEvidenceLoading(true);
      try {
          const { data, error } = await supabase
              .from('teacher_evidence')
              .select('*')
              .eq('teacher_id', teacherId)
              .order('created_at', { ascending: false });
          
          if(error) throw error;
          setGlobalEvidence(data || []);
      } catch (error) {
          console.error("Error fetching evidence:", error);
      } finally {
          setEvidenceLoading(false);
      }
  };

  // 2. Fetch Specific Evaluation Details (When an item is selected)
  const fetchEvaluationDetails = async (evalId: string) => {
    setLoading(true);
    try {
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
                evaluatorName: '',
                managerName: '',
                objectionText: evalData.objection_text,
                objectionStatus: evalData.objection_status,
                teacherEvidenceLinks: [] // We use global evidence now
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
      setActiveTab('details'); // Reset to details tab
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
          const payload = {
              teacher_id: teacherId,
              indicator_id: selectedIndicatorId,
              url: newEvidenceLink,
              description: newEvidenceDesc
          };

          const { error } = await supabase.from('teacher_evidence').insert([payload]);

          if (error) throw error;

          await fetchEvidence(); // Refresh list
          
          setNewEvidenceLink('');
          setNewEvidenceDesc('');
          setSelectedIndicatorId('');
          alert('تم إضافة الشاهد بنجاح.');
      } catch (error) {
          const msg = getErrorMessage(error);
          alert('حدث خطأ: ' + msg);
      } finally {
          setIsSubmittingEvidence(false);
      }
  };

  const handleDeleteEvidence = async (id: string) => {
      if (!window.confirm('هل أنت متأكد من حذف هذا الشاهد؟')) return;
      
      try {
          const { error } = await supabase
              .from('teacher_evidence')
              .delete()
              .eq('id', id);

          if (error) throw error;

          setGlobalEvidence(prev => prev.filter(e => e.id !== id));
      } catch (error: any) {
          const msg = getErrorMessage(error);
          alert('فشل الحذف: ' + msg);
      }
  };

  const calculateTotal = (): number => {
    if (!scores) return 0;
    // Explicitly cast to prevent type errors when Object.values returns unknown[]
    const values = Object.values(scores) as EvaluationScore[];
    return values.reduce((acc: number, curr: EvaluationScore) => acc + (Number(curr.score) || 0), 0);
  };

  const getMasteryLevel = (totalScore: number) => {
    if (totalScore >= 90) return "مثالي";
    if (totalScore >= 80) return "تخطى التوقعات";
    if (totalScore >= 70) return "وافق التوقعات";
    if (totalScore >= 50) return "بحاجة إلى تطوير";
    return "غير مرضي";
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200">مكتمل</span>;
          case 'draft': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200">جاري التقييم (مسودة)</span>;
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
        educationOffice={teacherInfo.educationOffice}
        academicYear={teacherInfo.academicYear}
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

        {/* Evidence Access Button (Standalone) */}
        {viewMode === 'list' && (
            <div className="flex justify-end">
                <button 
                    onClick={() => { setViewMode('details'); setActiveTab('evidence'); }}
                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 border border-blue-200"
                >
                    <UploadCloud size={18} /> بنك شواهدي
                </button>
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
                    {evaluation?.status === EvaluationStatus.COMPLETED && activeTab !== 'evidence' && (
                        <button 
                            onClick={() => setViewMode('print')}
                            className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 flex items-center gap-2 text-sm"
                        >
                            <Printer size={16} /> طباعة التقييم
                        </button>
                    )}
                </div>

                {loading && activeTab === 'details' ? (
                    <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
                ) : (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        
                        {/* Only show Score Header if in Details or Objection */}
                        {activeTab !== 'evidence' && (
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
                                        <p className="text-xs mt-2 opacity-80">{evaluation?.status === EvaluationStatus.COMPLETED ? 'تم الاعتماد' : 'جاري التقييم (غير معتمد)'}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {/* Tabs */}
                        <div className="flex border-b border-gray-200 bg-gray-50">
                            {selectedEvalId && (
                                <button 
                                    onClick={() => setActiveTab('details')}
                                    className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'details' ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <FileText size={16} /> تفاصيل التقييم
                                </button>
                            )}
                            <button 
                                onClick={() => setActiveTab('evidence')}
                                className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'evidence' ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <UploadCloud size={16} /> بنك الشواهد
                            </button>
                            {selectedEvalId && (
                                <button 
                                    onClick={() => setActiveTab('objection')}
                                    className={`flex-1 py-3 text-sm font-bold flex justify-center items-center gap-2 border-b-2 transition-colors ${activeTab === 'objection' ? 'border-red-500 text-red-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                >
                                    <AlertCircle size={16} /> الاعتراضات
                                </button>
                            )}
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            
                            {/* 1. Details */}
                            {activeTab === 'details' && selectedEvalId && (
                                <div className="space-y-6">
                                    {indicators.map((ind, idx) => {
                                        const scoreData = scores[ind.id] || { score: 0, level: 0, notes: '', improvement: '', strengths: '' };
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
                                                        <p className="text-gray-700 bg-gray-50 p-2 rounded whitespace-pre-line leading-relaxed">
                                                            {scoreData.strengths || scoreData.notes || 'لا يوجد'}
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-500 text-xs block mb-1">فرص التحسين:</span>
                                                        <p className="text-gray-700 bg-gray-50 p-2 rounded whitespace-pre-line leading-relaxed">
                                                            {scoreData.improvement || 'لا يوجد'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {/* 2. Evidence (Independent) */}
                            {activeTab === 'evidence' && (
                                <div className="space-y-8">
                                    <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg text-sm text-blue-800 mb-6">
                                        <strong>ملاحظة:</strong> الشواهد التي ترفعها هنا يتم حفظها في "بنك شواهدك" وتظهر للمقيم في جميع التقييمات. لا حاجة لإعادة رفع نفس الشاهد لكل فترة تقييم.
                                    </div>

                                    {/* Add Evidence Form */}
                                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                                        <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                                            <UploadCloud size={18} className="text-primary-600"/> إرفاق شاهد جديد
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="md:col-span-2">
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
                                                <label className="block text-sm font-medium text-gray-700 mb-1">وصف الشاهد</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full border rounded-lg p-2.5 text-sm"
                                                    placeholder="مثال: شهادة حضور دورة"
                                                    value={newEvidenceDesc}
                                                    onChange={(e) => setNewEvidenceDesc(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">الرابط</label>
                                                <input 
                                                    type="url" 
                                                    className="w-full border rounded-lg p-2.5 text-sm"
                                                    placeholder="https://..."
                                                    value={newEvidenceLink}
                                                    onChange={(e) => setNewEvidenceLink(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleAddEvidence}
                                            disabled={isSubmittingEvidence}
                                            className="mt-4 w-full bg-primary-600 text-white py-2 rounded-lg hover:bg-primary-700 font-bold text-sm flex justify-center items-center gap-2 disabled:opacity-70"
                                        >
                                            {isSubmittingEvidence && <Loader2 className="animate-spin" size={16} />}
                                            حفظ الشاهد
                                        </button>
                                    </div>

                                    {/* List */}
                                    <div>
                                        <h4 className="font-bold text-gray-700 mb-4">قائمة شواهدي المرفقة</h4>
                                        {evidenceLoading ? (
                                            <div className="text-center py-4"><Loader2 className="animate-spin mx-auto text-gray-400"/></div>
                                        ) : globalEvidence.length === 0 ? (
                                            <div className="text-gray-500 text-sm italic bg-gray-50 p-4 rounded text-center">لا توجد شواهد مرفقة حالياً</div>
                                        ) : (
                                            <div className="space-y-3">
                                                {globalEvidence.map((link, i) => {
                                                    const indName = indicators.find(ind => ind.id === link.indicator_id)?.text || 'مؤشر غير معروف';
                                                    return (
                                                        <div key={link.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50 group hover:border-blue-200 transition-colors">
                                                            <div>
                                                                <p className="font-bold text-sm text-gray-800">{link.description}</p>
                                                                <p className="text-xs text-gray-500 mt-1">خاص بـ: {indName}</p>
                                                                <p className="text-[10px] text-gray-400 mt-1">{new Date(link.created_at).toLocaleDateString('ar-SA')}</p>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1 bg-white border px-3 py-1.5 rounded">
                                                                    <LinkIcon size={14} /> فتح
                                                                </a>
                                                                <button 
                                                                    onClick={() => handleDeleteEvidence(link.id)}
                                                                    className="text-red-500 hover:bg-red-100 p-2 rounded transition-colors"
                                                                    title="حذف الشاهد"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* 3. Objection */}
                            {activeTab === 'objection' && selectedEvalId && (
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
