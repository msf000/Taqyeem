
import React, { useState, useEffect } from 'react';
import { ArrowRight, Plus, FileText, Calendar, ChevronLeft, Loader2, User, Printer, Eye, Trash2, PlayCircle, RotateCcw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { EvaluationStatus, EvaluationIndicator, TeacherCategory } from '../types';
import PrintView from './PrintView';

interface TeacherEvaluationHistoryProps {
  teacherId: string;
  onEvaluate: (evaluationId?: string) => void; // If ID is passed, edit existing. If not, create new.
  onBack: () => void;
}

interface EvalSummary {
    id: string;
    period_name: string;
    eval_date: string;
    total_score: number;
    status: string;
    created_at: string;
}

export default function TeacherEvaluationHistory({ teacherId, onEvaluate, onBack }: TeacherEvaluationHistoryProps) {
  const [history, setHistory] = useState<EvalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [teacherName, setTeacherName] = useState('');
  
  // Printing State
  const [printingEvalId, setPrintingEvalId] = useState<string | null>(null);
  const [printData, setPrintData] = useState<any>(null);
  const [loadingPrint, setLoadingPrint] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Teacher Name
      const { data: teacher } = await supabase.from('teachers').select('name').eq('id', teacherId).single();
      if (teacher) setTeacherName(teacher.name);

      // Fetch Evaluations
      const { data: evals, error } = await supabase
          .from('evaluations')
          .select('id, period_name, eval_date, total_score, status, created_at')
          .eq('teacher_id', teacherId)
          .order('eval_date', { ascending: false });

      if (error) throw error;
      setHistory(evals || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [teacherId]);

  const handleDelete = async (evalId: string) => {
      if (!window.confirm('هل أنت متأكد من حذف هذا التقييم؟ لا يمكن التراجع عن هذا الإجراء.')) return;

      try {
          const { error } = await supabase.from('evaluations').delete().eq('id', evalId);
          if (error) throw error;
          
          // Remove from local state
          setHistory(prev => prev.filter(e => e.id !== evalId));
          alert('تم حذف التقييم بنجاح.');
      } catch (error: any) {
          console.error("Delete error:", error);
          alert('فشل الحذف: ' + error.message);
      }
  };

  const handleRevert = async (evalId: string) => {
      if (!window.confirm('هل أنت متأكد من إعادة فتح التقييم للتعديل؟ سيتحول إلى "مسودة" ويمكنك تعديل الدرجات مجدداً.')) return;
      
      try {
          const { error } = await supabase.from('evaluations').update({ status: 'draft' }).eq('id', evalId);
          if (error) throw error;
          
          // Update local state
          setHistory(prev => prev.map(e => e.id === evalId ? { ...e, status: 'draft' } : e));
          alert('تم إعادة فتح التقييم بنجاح. يمكنك الآن استكمال التعديل.');
      } catch(e: any) {
          console.error("Revert error:", e);
          alert('فشل الإجراء: ' + e.message);
      }
  };

  const handlePrint = async (evalId: string) => {
      setPrintingEvalId(evalId);
      setLoadingPrint(true);
      try {
          // 1. Fetch Teacher Info & School
          const { data: teacherData, error: tError } = await supabase
              .from('teachers')
              .select('*, schools(name, ministry_id, education_office, academic_year, manager_name, evaluator_name)')
              .eq('id', teacherId)
              .single();
          if(tError) throw tError;

          // 2. Fetch Evaluation Data
          const { data: evalData, error: eError } = await supabase
              .from('evaluations')
              .select('*')
              .eq('id', evalId)
              .single();
          if(eError) throw eError;

          // 3. Fetch Indicators
          const category = teacherData.category as TeacherCategory;
          const { data: indData, error: iError } = await supabase
            .from('evaluation_indicators')
            .select('*, evaluation_criteria(text), verification_indicators(text)')
            .order('sort_order');
          if(iError) throw iError;

          const mappedIndicators = (indData || [])
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

          setPrintData({
              teacherName: teacherData.name,
              teacherNationalId: teacherData.national_id,
              teacherSpecialty: teacherData.specialty,
              teacherCategory: teacherData.category,
              schoolName: teacherData.schools?.name || '',
              ministryId: teacherData.schools?.ministry_id || '',
              educationOffice: teacherData.schools?.education_office || '',
              academicYear: teacherData.schools?.academic_year || '',
              managerName: teacherData.schools?.manager_name || '',
              evaluatorName: teacherData.schools?.evaluator_name || '',
              periodDate: evalData.eval_date || evalData.created_at,
              totalScore: evalData.total_score || 0,
              scores: evalData.scores || {},
              indicators: mappedIndicators
          });

      } catch (error) {
          console.error('Print Error:', error);
          alert('حدث خطأ أثناء تحميل بيانات الطباعة');
          setPrintingEvalId(null);
      } finally {
          setLoadingPrint(false);
      }
  };

  const getStatusBadge = (status: string) => {
      switch(status) {
          case 'completed': return <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold border border-green-200 block w-fit">مكتمل</span>;
          case 'draft': return <span className="bg-yellow-100 text-yellow-700 px-2 py-1 rounded text-xs font-bold border border-yellow-200 block w-fit">مسودة (جاري)</span>;
          case 'archived': return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold block w-fit">مؤرشف</span>;
          default: return <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-bold block w-fit">{status}</span>;
      }
  };

  if (printData) {
      return (
          <PrintView 
            {...printData}
            onBack={() => { setPrintData(null); setPrintingEvalId(null); }}
          />
      );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
                <button onClick={onBack} className="p-2 bg-white rounded-lg border hover:bg-gray-50 text-gray-600">
                    <ArrowRight size={20} />
                </button>
                <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800">سجل التقييمات</h2>
                    <p className="text-gray-500 text-xs md:text-sm flex items-center gap-1">
                        <User size={14} /> المعلم: {teacherName}
                    </p>
                </div>
            </div>
            
            <button 
                onClick={() => onEvaluate()} // Call without ID to create new
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2 shadow-sm text-sm font-bold"
            >
                <Plus size={18} /> تقييم جديد
            </button>
        </div>

        <div className="bg-gray-50 md:bg-white rounded-xl md:shadow-sm md:border border-gray-200 overflow-hidden">
            {loading ? (
                <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-600" size={32} /></div>
            ) : history.length === 0 ? (
                <div className="p-16 text-center text-gray-500">
                    <FileText size={48} className="mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-bold mb-2">لا توجد تقييمات سابقة</h3>
                    <p className="mb-6">لم يتم تقييم هذا المعلم بعد. ابدأ بإضافة تقييم جديد.</p>
                    <button 
                        onClick={() => onEvaluate()}
                        className="bg-primary-50 text-primary-600 px-6 py-2 rounded-lg hover:bg-primary-100 font-bold"
                    >
                        بدء التقييم الأول
                    </button>
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block">
                        <table className="w-full text-right">
                            <thead className="bg-gray-50 text-gray-600 text-sm">
                                <tr>
                                    <th className="px-6 py-4">الفترة</th>
                                    <th className="px-6 py-4">تاريخ التقييم</th>
                                    <th className="px-6 py-4">الدرجة</th>
                                    <th className="px-6 py-4">الحالة</th>
                                    <th className="px-6 py-4">تاريخ الإنشاء</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {history.map((evalItem) => (
                                    <tr key={evalItem.id} className="hover:bg-gray-50 group">
                                        <td className="px-6 py-4 font-bold text-gray-800">{evalItem.period_name || 'بدون اسم'}</td>
                                        <td className="px-6 py-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-gray-400"/>
                                                {evalItem.eval_date}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-primary-700">{evalItem.total_score}%</td>
                                        <td className="px-6 py-4">
                                            {getStatusBadge(evalItem.status)}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-gray-400">
                                            {new Date(evalItem.created_at).toLocaleDateString('ar-SA')}
                                        </td>
                                        <td className="px-6 py-4 text-left flex items-center justify-end gap-2">
                                            {evalItem.status === 'completed' && (
                                                <>
                                                    <button 
                                                        onClick={() => handleRevert(evalItem.id)}
                                                        className="text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
                                                        title="إعادة فتح (تعديل)"
                                                    >
                                                        <RotateCcw size={16} />
                                                    </button>
                                                    <button 
                                                        onClick={() => handlePrint(evalItem.id)}
                                                        className="text-gray-500 hover:text-gray-900 bg-gray-50 hover:bg-gray-200 px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-1"
                                                        disabled={loadingPrint && printingEvalId === evalItem.id}
                                                    >
                                                        {loadingPrint && printingEvalId === evalItem.id ? <Loader2 size={16} className="animate-spin"/> : <Printer size={16} />}
                                                        طباعة
                                                    </button>
                                                </>
                                            )}
                                            
                                            {evalItem.status === 'draft' ? (
                                                <button 
                                                    onClick={() => onEvaluate(evalItem.id)}
                                                    className="bg-primary-600 text-white hover:bg-primary-700 px-4 py-1.5 rounded-lg text-sm font-bold transition-colors flex items-center gap-1 shadow-sm"
                                                >
                                                    <PlayCircle size={16} /> استكمال
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => onEvaluate(evalItem.id)}
                                                    className="text-primary-600 hover:bg-primary-50 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                                >
                                                    <Eye size={16} /> عرض
                                                </button>
                                            )}
                                            
                                            <button 
                                                onClick={() => handleDelete(evalItem.id)}
                                                className="text-red-500 hover:bg-red-50 hover:text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
                                                title="حذف التقييم"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card List */}
                    <div className="md:hidden flex flex-col gap-3">
                        {history.map((evalItem) => (
                            <div key={evalItem.id} className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm relative">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <span className="text-xs text-gray-500 mb-1 block">الفترة</span>
                                        <h4 className="font-bold text-gray-900 text-lg">{evalItem.period_name || 'بدون اسم'}</h4>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-xl font-bold text-primary-600">{evalItem.total_score}%</span>
                                        {getStatusBadge(evalItem.status)}
                                    </div>
                                </div>
                                
                                <div className="flex items-center gap-2 text-xs text-gray-500 mb-4 bg-gray-50 p-2 rounded-lg">
                                    <Calendar size={14}/>
                                    تاريخ التقييم: {evalItem.eval_date}
                                </div>

                                <div className="flex gap-2 pt-2 border-t border-gray-100">
                                    <button 
                                        onClick={() => onEvaluate(evalItem.id)}
                                        className={`flex-1 py-2 rounded-lg text-sm font-bold flex justify-center items-center gap-2 ${
                                            evalItem.status === 'draft' 
                                            ? 'bg-primary-600 text-white shadow-sm'
                                            : 'bg-primary-50 text-primary-700'
                                        }`}
                                    >
                                        {evalItem.status === 'draft' ? <><PlayCircle size={16}/> استكمال</> : <><Eye size={16}/> التفاصيل</>}
                                    </button>
                                    
                                    {evalItem.status === 'completed' && (
                                        <>
                                            <button 
                                                onClick={() => handleRevert(evalItem.id)}
                                                className="p-2 bg-orange-50 text-orange-600 rounded-lg border border-orange-100"
                                                title="إعادة فتح"
                                            >
                                                <RotateCcw size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handlePrint(evalItem.id)}
                                                className="p-2 bg-gray-100 text-gray-600 rounded-lg"
                                                disabled={loadingPrint && printingEvalId === evalItem.id}
                                            >
                                                {loadingPrint && printingEvalId === evalItem.id ? <Loader2 size={18} className="animate-spin"/> : <Printer size={18} />}
                                            </button>
                                        </>
                                    )}
                                    
                                    <button 
                                        onClick={() => handleDelete(evalItem.id)}
                                        className="p-2 bg-red-50 text-red-600 rounded-lg"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    </div>
  );
}
