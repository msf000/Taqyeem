import React from 'react';
import { ArrowRight, Printer } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore } from '../types';

interface PrintViewProps {
  teacherName: string;
  periodDate: string;
  totalScore: number;
  scores: Record<string, EvaluationScore>;
  indicators: EvaluationIndicator[];
  onBack: () => void;
}

export default function PrintView({ teacherName, periodDate, totalScore, scores, indicators, onBack }: PrintViewProps) {
  
  const handlePrint = () => {
    window.print();
  };

  const getMasteryLevel = (totalScore: number) => {
    if (totalScore >= 90) return "متميز";
    if (totalScore >= 80) return "متقدم";
    if (totalScore >= 70) return "متمكن";
    if (totalScore >= 50) return "مبتدئ";
    return "غير مجتاز";
  };

  return (
    <div className="bg-gray-100 min-h-screen p-8">
      {/* Toolbar - Hidden in Print */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center no-print">
         <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <ArrowRight size={20} /> عودة
         </button>
         <button onClick={handlePrint} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700">
            <Printer size={18} /> طباعة
         </button>
      </div>

      {/* A4 Paper Effect */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-lg p-[15mm] min-h-[297mm] text-black print:shadow-none print:w-full print:max-w-none print:p-0 font-serif">
        
        {/* Header */}
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
           <div className="text-center">
              <h1 className="text-xl font-bold mb-1">المملكة العربية السعودية</h1>
              <h2 className="text-lg mb-1">وزارة التعليم</h2>
              <h3 className="text-base">استمارة تقييم أداء المعلم</h3>
           </div>
           <div className="text-left text-sm space-y-1">
              <p>التاريخ: {periodDate}</p>
              <p>المدرسة: مدرسة الرياض النموذجية</p>
              <p>الرمز الوزاري: 123456</p>
           </div>
        </div>

        {/* Teacher Info */}
        <div className="mb-6 border border-black p-4 bg-gray-50 print:bg-transparent">
           <h3 className="font-bold border-b border-gray-400 mb-2 pb-1">معلومات المعلم</h3>
           <div className="grid grid-cols-2 gap-4 text-sm">
              <p><span className="font-semibold">الاسم:</span> {teacherName}</p>
              <p><span className="font-semibold">التخصص:</span> لغة عربية</p>
              <p><span className="font-semibold">المسمى الوظيفي:</span> معلم</p>
              <p><span className="font-semibold">الرقم الوظيفي:</span> 102938</p>
           </div>
        </div>

        {/* Summary Table */}
        <div className="mb-8 break-inside-avoid">
           <h3 className="font-bold mb-2">ملخص فئات التقييم</h3>
           <table className="w-full border-collapse border border-black text-sm text-center">
              <thead>
                 <tr className="bg-gray-100 print:bg-gray-200">
                    <th className="border border-black p-2 w-[40%]">مؤشرات التقييم</th>
                    <th className="border border-black p-2">الوزن النسبي %</th>
                    <th className="border border-black p-2">الدرجة المكتسبة</th>
                    <th className="border border-black p-2">سلم التقدير (1-5)</th>
                 </tr>
              </thead>
              <tbody>
                 {indicators.map(ind => {
                    const data = scores[ind.id] || { score: 0, level: 0 };
                    return (
                        <tr key={ind.id}>
                            <td className="border border-black p-2 text-right">{ind.text}</td>
                            <td className="border border-black p-2">{ind.weight}%</td>
                            <td className="border border-black p-2">{data.score.toFixed(1)}</td>
                            <td className="border border-black p-2 font-bold">{data.level || '-'}</td>
                        </tr>
                    )
                 })}
                 <tr className="font-bold bg-gray-50 print:bg-gray-100">
                    <td className="border border-black p-2 text-right">الإجمالي</td>
                    <td className="border border-black p-2">100%</td>
                    <td className="border border-black p-2">{totalScore.toFixed(1)}%</td>
                    <td className="border border-black p-2">{getMasteryLevel(totalScore)}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        {/* Detailed Indicators */}
        <div className="space-y-4">
           <h3 className="font-bold mb-2 border-b border-black pb-1">تفاصيل الأداء والملاحظات</h3>
           {indicators.map(ind => (
              <div key={ind.id} className="border border-black p-3 mb-3 break-inside-avoid">
                 <div className="flex justify-between font-bold border-b border-gray-300 pb-2 mb-2 bg-gray-50 print:bg-gray-100 p-1">
                    <span>{ind.id}. {ind.text}</span>
                    <div className="flex gap-4">
                       <span className="text-sm font-normal">المستوى: {scores[ind.id]?.level || 0}</span>
                       <span>الدرجة: {scores[ind.id]?.score.toFixed(1) || 0} / {ind.weight}</span>
                    </div>
                 </div>
                 
                 <div className="grid grid-cols-1 gap-2 text-sm">
                    {/* Rubric Description used */}
                    <div className="mb-2">
                       <span className="font-semibold text-gray-700">درجة السلم للمؤشر:</span>
                       <p className="mr-2 text-gray-600 italic">
                          {ind.rubric[scores[ind.id]?.level]?.description || 'لم يتم التقييم'}
                       </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                           <span className="font-semibold block mb-1 underline">ملاحظات المقيم / الشواهد:</span>
                           <p className="min-h-[20px] text-justify">{scores[ind.id]?.notes || scores[ind.id]?.evidence || 'لا توجد ملاحظات'}</p>
                        </div>
                        <div>
                           <span className="font-semibold block mb-1 underline">فرص التحسين:</span>
                           <p className="min-h-[20px] text-justify">{scores[ind.id]?.improvement || 'لا توجد فرص تحسين مسجلة'}</p>
                        </div>
                    </div>
                 </div>
              </div>
           ))}
        </div>

        {/* Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-20 break-inside-avoid pt-8 border-t-2 border-black">
           <div className="text-center">
              <p className="font-bold mb-8 text-lg">المقيم</p>
              <p className="mb-3 text-right pr-10">الاسم: ....................................</p>
              <p className="mb-3 text-right pr-10">التاريخ: .... / .... / ........</p>
              <p className="text-right pr-10">التوقيع: ....................................</p>
           </div>
           <div className="text-center">
              <p className="font-bold mb-8 text-lg">اعتماد مدير المدرسة</p>
              <p className="mb-3 text-right pr-10">الاسم: ....................................</p>
              <p className="mb-3 text-right pr-10">التاريخ: .... / .... / ........</p>
              <p className="text-right pr-10">التوقيع: ....................................</p>
           </div>
        </div>

      </div>
    </div>
  );
}