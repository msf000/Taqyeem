import React, { useState } from 'react';
import { Plus, Upload, MoreHorizontal, Search, FileText, CheckCircle, XCircle } from 'lucide-react';
import { Teacher, TeacherCategory, EvaluationStatus, ImportResult } from '../types';

interface TeacherManagementProps {
  onEvaluate: (teacherId: string) => void;
}

const MOCK_TEACHERS: Teacher[] = [
  {
    id: '1',
    name: 'محمد عبدالله الشمري',
    nationalId: '1023456789',
    specialty: 'لغة عربية',
    category: TeacherCategory.TEACHER,
    status: EvaluationStatus.DRAFT,
    mobile: '0501234567',
    schoolId: '1'
  },
  {
    id: '2',
    name: 'سعود فهد القحطاني',
    nationalId: '1098765432',
    specialty: 'رياضيات',
    category: TeacherCategory.TEACHER,
    status: EvaluationStatus.NOT_EVALUATED,
    mobile: '0559876543',
    schoolId: '1'
  },
   {
    id: '3',
    name: 'علي حسن العمري',
    nationalId: '1043216789',
    specialty: 'علوم',
    category: TeacherCategory.LAB,
    status: EvaluationStatus.COMPLETED,
    mobile: '0561239876',
    schoolId: '1'
  }
];

export default function TeacherManagement({ onEvaluate }: TeacherManagementProps) {
  const [subTab, setSubTab] = useState<'list' | 'add' | 'import' | 'specialties'>('list');
  const [teachers] = useState<Teacher[]>(MOCK_TEACHERS);
  const [importStep, setImportStep] = useState<'upload' | 'results'>('upload');
  const [importResults, setImportResults] = useState<ImportResult[]>([]);

  // Import Logic Simulation
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Simulate processing
    setTimeout(() => {
        const mockResults: ImportResult[] = [
            { row: 1, nationalId: '1011111111', name: 'خالد الزهراني', specialty: 'فيزياء', mobile: '0500000000', addedBy: 'Admin', status: 'success' },
            { row: 2, nationalId: '1022222222', name: 'فهد الدوسري', specialty: 'كيمياء', mobile: '0511111111', addedBy: 'Admin', status: 'success' },
            { row: 3, nationalId: 'invalid', name: 'خطأ في السجل', specialty: '-', mobile: '-', addedBy: 'Admin', status: 'failed', message: 'رقم الهوية غير صحيح' },
        ];
        setImportResults(mockResults);
        setImportStep('results');
    }, 1500);
  };

  const renderStatus = (status: EvaluationStatus) => {
    switch (status) {
        case EvaluationStatus.COMPLETED:
            return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-medium">مقيم</span>;
        case EvaluationStatus.DRAFT:
            return <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded-full font-medium">مسودة</span>;
        default:
            return <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full font-medium">لم يتم التقييم</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex border-b border-gray-200 gap-6">
        <button onClick={() => setSubTab('list')} className={`pb-3 font-medium transition-colors ${subTab === 'list' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>المعلمين</button>
        <button onClick={() => setSubTab('add')} className={`pb-3 font-medium transition-colors ${subTab === 'add' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>إضافة معلم</button>
        <button onClick={() => setSubTab('import')} className={`pb-3 font-medium transition-colors ${subTab === 'import' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>استيراد المعلمين</button>
        <button onClick={() => setSubTab('specialties')} className={`pb-3 font-medium transition-colors ${subTab === 'specialties' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>إدارة التخصصات</button>
      </div>

      {/* Content based on SubTab */}
      {subTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div className="relative w-64">
                    <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                    <input type="text" placeholder="بحث باسم المعلم أو الهوية" className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm" />
                </div>
                <div className="flex gap-2">
                    {/* Filters could go here */}
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm font-semibold">
                        <tr>
                            <th className="px-6 py-4">الاسم الكامل</th>
                            <th className="px-6 py-4">رقم الهوية</th>
                            <th className="px-6 py-4">التخصص</th>
                            <th className="px-6 py-4">الفئة</th>
                            <th className="px-6 py-4">الحالة</th>
                            <th className="px-6 py-4 text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {teachers.map(teacher => (
                            <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-gray-900">{teacher.name}</td>
                                <td className="px-6 py-4 text-gray-600 font-mono text-sm">{teacher.nationalId}</td>
                                <td className="px-6 py-4 text-gray-600">{teacher.specialty}</td>
                                <td className="px-6 py-4">
                                    <span className="bg-primary-50 text-primary-700 px-2 py-1 rounded text-xs">{teacher.category}</span>
                                </td>
                                <td className="px-6 py-4">
                                    {renderStatus(teacher.status)}
                                </td>
                                <td className="px-6 py-4 flex justify-center items-center gap-2">
                                    <button 
                                        onClick={() => onEvaluate(teacher.id)}
                                        className="text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                                    >
                                        تقييم المعلم
                                    </button>
                                    <div className="relative group">
                                        <button className="p-1 text-gray-400 hover:text-gray-600">
                                            <MoreHorizontal size={20} />
                                        </button>
                                        <div className="hidden group-hover:block absolute left-0 mt-1 w-32 bg-white rounded-md shadow-lg border border-gray-100 z-10">
                                            <button className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">عرض</button>
                                            <button className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">تحرير</button>
                                            <button className="block w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50">حذف</button>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {subTab === 'add' && (
         <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6">إضافة معلم جديد</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل</label>
                    <input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية الوطنية</label>
                    <input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">فئة المعلم</label>
                    <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500">
                        {Object.values(TeacherCategory).map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                        ))}
                    </select>
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">التخصص</label>
                    <input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" />
                 </div>
                 <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الجوال</label>
                    <input type="tel" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" />
                 </div>
            </div>
            <div className="mt-8 flex justify-end gap-3">
                <button onClick={() => setSubTab('list')} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">إلغاء</button>
                <button className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">حفظ المعلم</button>
            </div>
         </div>
      )}

      {subTab === 'import' && importStep === 'upload' && (
          <div className="max-w-3xl mx-auto">
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><FileText size={18} /> تعليمات الاستيراد</h4>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    <li>قم بتحميل قالب الاكسل المعتمد.</li>
                    <li>تأكد من صحة أرقام الهوية الوطنية.</li>
                    <li>اختر فئة المعلم الموحدة للملف أو اتركها للكشف التلقائي.</li>
                </ul>
                <button className="mt-3 text-sm font-bold text-blue-700 hover:underline">تحميل القالب</button>
             </div>

             <div className="bg-white p-12 rounded-xl shadow-sm border border-gray-200 text-center border-dashed border-2 border-gray-300 hover:border-primary-500 transition-colors">
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">سحب وافلات ملف الاكسل هنا</h3>
                <p className="text-gray-500 mt-2 mb-6">أو قم باستعراض الملفات من جهازك</p>
                <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden" 
                    accept=".xlsx,.csv"
                    onChange={handleFileUpload}
                />
                <label htmlFor="file-upload" className="cursor-pointer bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 inline-block">
                    اختر الملف
                </label>
             </div>
          </div>
      )}

      {subTab === 'import' && importStep === 'results' && (
          <div className="space-y-6">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                    <span className="text-gray-500 text-sm">اسم المدرسة</span>
                    <h4 className="font-bold text-lg">مدرسة الرياض النموذجية</h4>
                 </div>
                 <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <span className="text-green-700 text-sm">عمليات استيراد ناجحة</span>
                    <h4 className="font-bold text-2xl text-green-800">{importResults.filter(r => r.status === 'success').length}</h4>
                 </div>
                 <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                    <span className="text-red-700 text-sm">عمليات استيراد فاشلة</span>
                    <h4 className="font-bold text-2xl text-red-800">{importResults.filter(r => r.status === 'failed').length}</h4>
                 </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700">النتائج التفصيلية</div>
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm">
                        <tr>
                            <th className="px-6 py-3">رقم الصف</th>
                            <th className="px-6 py-3">الهوية</th>
                            <th className="px-6 py-3">الاسم</th>
                            <th className="px-6 py-3">التخصص</th>
                            <th className="px-6 py-3">الجوال</th>
                            <th className="px-6 py-3">المستخدم المسند</th>
                            <th className="px-6 py-3">الحالة</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {importResults.map((result, idx) => (
                             <tr key={idx} className={result.status === 'failed' ? 'bg-red-50' : ''}>
                                <td className="px-6 py-3">{result.row}</td>
                                <td className="px-6 py-3 font-mono">{result.nationalId}</td>
                                <td className="px-6 py-3">{result.name}</td>
                                <td className="px-6 py-3">{result.specialty}</td>
                                <td className="px-6 py-3">{result.mobile}</td>
                                <td className="px-6 py-3">{result.addedBy}</td>
                                <td className="px-6 py-3">
                                    {result.status === 'success' ? (
                                        <span className="flex items-center gap-1 text-green-600 text-sm font-medium"><CheckCircle size={14} /> ناجح</span>
                                    ) : (
                                        <div className="flex flex-col">
                                            <span className="flex items-center gap-1 text-red-600 text-sm font-medium"><XCircle size={14} /> فاشل</span>
                                            <span className="text-xs text-red-500">{result.message}</span>
                                        </div>
                                    )}
                                </td>
                             </tr>
                        ))}
                    </tbody>
                </table>
             </div>
             <div className="flex justify-end">
                <button onClick={() => { setImportStep('upload'); setImportResults([]); }} className="text-gray-600 hover:text-gray-900 font-medium">استيراد ملف آخر</button>
             </div>
          </div>
      )}
    </div>
  );
}