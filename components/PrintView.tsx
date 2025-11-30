
import React from 'react';
import { ArrowRight, Printer, School } from 'lucide-react';
import { EvaluationIndicator, EvaluationScore } from '../types';

interface PrintViewProps {
  teacherName: string;
  teacherNationalId: string;
  teacherSpecialty: string;
  teacherCategory: string;
  schoolName: string;
  ministryId: string;
  educationOffice?: string; // Added prop
  academicYear?: string; // Added prop
  managerName?: string;
  evaluatorName?: string;
  periodDate: string;
  totalScore: number;
  scores: Record<string, EvaluationScore>;
  indicators: EvaluationIndicator[];
  onBack: () => void;
}

export default function PrintView({ 
    teacherName, 
    teacherNationalId,
    teacherSpecialty,
    teacherCategory,
    schoolName,
    ministryId,
    educationOffice,
    academicYear,
    managerName,
    evaluatorName,
    periodDate, 
    totalScore, 
    scores, 
    indicators, 
    onBack 
}: PrintViewProps) {
  
  const handlePrint = () => {
    window.print();
  };

  const getMasteryLevel = (totalScore: number) => {
    if (totalScore >= 90) return "مثالي";
    if (totalScore >= 80) return "تخطى التوقعات";
    if (totalScore >= 70) return "وافق التوقعات";
    if (totalScore >= 50) return "بحاجة إلى تطوير";
    return "غير مرضي";
  };

  const getIndicatorMastery = (score: number, weight: number) => {
      if (weight === 0) return "-";
      const ratio = score / weight;
      if (ratio >= 0.9) return "مثالي";
      if (ratio >= 0.8) return "تخطى التوقعات";
      if (ratio >= 0.6) return "وافق التوقعات"; 
      if (ratio >= 0.4) return "بحاجة إلى تطوير";
      return "غير مرضي";
  };

  return (
    <div className="bg-gray-100 min-h-screen p-4 md:p-8 font-sans">
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm 15mm;
          }
          body {
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            box-shadow: none;
            margin: 0;
            padding: 0;
            width: 100%;
            max-width: none;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .break-before-page {
            page-break-before: always;
          }
        }
      `}</style>

      {/* Toolbar - Hidden in Print */}
      <div className="max-w-[210mm] mx-auto mb-6 flex justify-between items-center no-print">
         <button onClick={onBack} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 bg-white px-4 py-2 rounded-lg border shadow-sm transition-all">
            <ArrowRight size={20} /> عودة
         </button>
         <button onClick={handlePrint} className="bg-primary-600 text-white px-6 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 shadow-sm transition-all font-bold">
            <Printer size={20} /> طباعة النموذج
         </button>
      </div>

      {/* A4 Paper Effect */}
      <div className="print-container max-w-[210mm] mx-auto bg-white shadow-lg border border-gray-200 p-[10mm] md:p-[15mm] min-h-[297mm] text-black">
        
        {/* Header */}
        <div className="flex justify-between items-start border-b-2 border-black pb-6 mb-6">
           <div className="text-center w-1/3">
              <h1 className="text-lg font-bold mb-1">المملكة العربية السعودية</h1>
              <h2 className="text-base font-medium mb-1">وزارة التعليم</h2>
              <h3 className="text-sm">{educationOffice || 'إدارة التعليم'}</h3>
           </div>
           <div className="text-center w-1/3 pt-2">
              <div className="inline-block border-2 border-black px-6 py-2 rounded-lg">
                  <h2 className="text-xl font-black">بطاقة الأداء الوظيفي</h2>
              </div>
           </div>
           <div className="text-left w-1/3 text-sm space-y-1 pt-1 pl-2" dir="ltr">
              <p className="text-right"><span className="font-bold ml-1">التاريخ:</span> {periodDate}</p>
              <p className="text-right"><span className="font-bold ml-1">المدرسة:</span> {schoolName}</p>
              {academicYear && <p className="text-right"><span className="font-bold ml-1">العام الدراسي:</span> {academicYear}</p>}
              <p className="text-right"><span className="font-bold ml-1">الرقم الوزاري:</span> {ministryId}</p>
           </div>
        </div>

        {/* Teacher Info Table */}
        <div className="mb-8 border-2 border-black rounded-lg overflow-hidden">
           <table className="w-full text-sm">
              <tbody>
                 <tr className="border-b border-black">
                    <td className="bg-gray-100 p-2 font-bold border-l border-black w-[15%]">اسم المعلم</td>
                    <td className="p-2 border-l border-black w-[35%]">{teacherName}</td>
                    <td className="bg-gray-100 p-2 font-bold border-l border-black w-[15%]">رقم الهوية</td>
                    <td className="p-2 w-[35%] font-mono text-right">{teacherNationalId}</td>
                 </tr>
                 <tr>
                    <td className="bg-gray-100 p-2 font-bold border-l border-black">التخصص</td>
                    <td className="p-2 border-l border-black">{teacherSpecialty}</td>
                    <td className="bg-gray-100 p-2 font-bold border-l border-black">المسمى الوظيفي</td>
                    <td className="p-2">{teacherCategory}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        {/* Summary Table */}
        <div className="mb-8 break-inside-avoid">
           <h3 className="font-bold mb-3 text-lg border-r-4 border-black pr-2">ملخص النتائج</h3>
           <table className="w-full border-collapse border-2 border-black text-sm text-center">
              <thead>
                 <tr className="bg-gray-200">
                    <th className="border border-black p-2 w-[40%] text-right pr-4">مجال التقييم (المؤشر)</th>
                    <th className="border border-black p-2 w-[10%]">الوزن</th>
                    <th className="border border-black p-2 w-[15%]">المستوى (1-5)</th>
                    <th className="border border-black p-2 w-[15%]">الدرجة الموزونة</th>
                    <th className="border border-black p-2 w-[20%]">مستوى الإتقان</th>
                 </tr>
              </thead>
              <tbody>
                 {indicators.map(ind => {
                    const data = scores[ind.id] || { score: 0, level: 0 };
                    return (
                        <tr key={ind.id}>
                            <td className="border border-black p-2 text-right pr-4 font-medium">{ind.text}</td>
                            <td className="border border-black p-2 bg-gray-50">{ind.weight}</td>
                            <td className="border border-black p-2 font-bold">{data.level} / 5</td>
                            <td className="border border-black p-2 font-bold bg-gray-50">{data.score % 1 === 0 ? data.score : data.score.toFixed(1)}</td>
                            <td className="border border-black p-2 text-xs font-bold">
                                {data.score > 0 ? getIndicatorMastery(data.score, ind.weight) : '-'}
                            </td>
                        </tr>
                    )
                 })}
                 <tr className="font-black bg-gray-100 text-base border-t-2 border-black">
                    <td className="border border-black p-3 text-right pr-4" colSpan={3}>المجموع الكلي</td>
                    <td className="border border-black p-3 text-lg">
                        {totalScore.toFixed(1)} 
                        <span className="text-xs font-normal mr-2">({getMasteryLevel(totalScore)})</span>
                    </td>
                    <td className="border border-black p-3">{getMasteryLevel(totalScore)}</td>
                 </tr>
              </tbody>
           </table>
        </div>

        {/* Detailed Indicators with Strengths/Weaknesses - Starts on Page 2 */}
        <div className="space-y-6 break-before-page">
           <h3 className="font-bold mb-2 text-lg border-r-4 border-black pr-2 pt-4">تفاصيل الأداء (نقاط القوة والتحسين)</h3>
           {indicators.map((ind, idx) => (
              <div key={ind.id} className="border border-black rounded-lg break-inside-avoid overflow-hidden">
                 <div className="flex justify-between items-center bg-gray-100 p-2 border-b border-black">
                    <span className="font-bold text-sm">{idx + 1}. {ind.text}</span>
                    <div className="flex gap-4 text-xs font-bold">
                       <span className="bg-white border border-black px-2 py-1 rounded">المستوى: {scores[ind.id]?.level || 0}</span>
                       <span className="bg-white border border-black px-2 py-1 rounded">الدرجة الموزونة: {scores[ind.id]?.score?.toFixed(1) || 0}</span>
                    </div>
                 </div>
                 
                 <div className="p-3 text-sm grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Strengths Section */}
                    <div className="border-l-0 md:border-l border-black pl-0 md:pl-4">
                       <p className="font-bold text-xs mb-1 underline">نقاط القوة / تطلعات مستقبلية:</p>
                       <p className="text-gray-800 leading-relaxed min-h-[1.5em] text-justify whitespace-pre-line">
                          {scores[ind.id]?.strengths || '---'}
                       </p>
                    </div>

                    {/* Improvement Section */}
                    <div>
                       <p className="font-bold text-xs mb-1 underline">فرص التحسين (الخطة):</p>
                       <p className="text-gray-800 leading-relaxed min-h-[1.5em] text-justify whitespace-pre-line">
                          {scores[ind.id]?.improvement || '---'}
                       </p>
                    </div>
                 </div>
                 {/* Optional Notes */}
                 {scores[ind.id]?.notes && (
                     <div className="p-2 border-t border-gray-300 bg-gray-50 text-xs">
                         <span className="font-bold">ملاحظات إضافية:</span> {scores[ind.id]?.notes}
                     </div>
                 )}
              </div>
           ))}
        </div>

        {/* Signatures */}
        <div className="mt-12 pt-6 border-t-2 border-black break-inside-avoid">
           <div className="flex justify-between items-start px-8">
               <div className="text-center w-1/3">
                  <p className="font-bold mb-8 text-base">المقيم</p>
                  <p className="mb-2 text-sm font-bold">{evaluatorName || '................................'}</p>
               </div>
               
               <div className="text-center w-1/3">
                  <p className="font-bold mb-8 text-base">المعلم (للعلم)</p>
                  <p className="mb-2 text-sm font-bold">{teacherName}</p>
               </div>

               <div className="text-center w-1/3">
                  <p className="font-bold mb-8 text-base">مدير المدرسة</p>
                  <p className="mb-2 text-sm font-bold">{managerName || '................................'}</p>
               </div>
           </div>
        </div>

      </div>
    </div>
  );
}
