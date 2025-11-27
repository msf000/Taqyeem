import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const SCORE_DATA = [
  { name: 'التخطيط', score: 85 },
  { name: 'إدارة الصف', score: 78 },
  { name: 'الاستراتيجيات', score: 92 },
  { name: 'التقويم', score: 65 },
  { name: 'التطوير', score: 88 },
];

const STATUS_DATA = [
  { name: 'متميز', value: 12 },
  { name: 'متقدم', value: 25 },
  { name: 'متمكن', value: 18 },
  { name: 'مبتدئ', value: 5 },
];

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

export default function Analytics() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">التحليلات والإحصائيات</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Average Scores Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="font-bold text-lg mb-6 text-gray-700">متوسط الأداء حسب المعيار</h3>
           <div className="h-72">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={SCORE_DATA} layout="vertical" margin={{ left: 20 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                 <XAxis type="number" domain={[0, 100]} />
                 <YAxis dataKey="name" type="category" width={100} />
                 <Tooltip />
                 <Bar dataKey="score" fill="#22c55e" radius={[0, 4, 4, 0]} name="متوسط الدرجة" />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="font-bold text-lg mb-6 text-gray-700">توزيع مستويات المعلمين</h3>
           <div className="h-72">
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie
                   data={STATUS_DATA}
                   cx="50%"
                   cy="50%"
                   labelLine={false}
                   label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                   outerRadius={80}
                   fill="#8884d8"
                   dataKey="value"
                 >
                   {STATUS_DATA.map((entry, index) => (
                     <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                   ))}
                 </Pie>
                 <Tooltip />
                 <Legend verticalAlign="bottom" height={36}/>
               </PieChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">إجمالي المعلمين</span>
            <div className="text-3xl font-bold text-gray-800 mt-1">60</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">تم تقييمهم</span>
            <div className="text-3xl font-bold text-green-600 mt-1">45</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">بانتظار التقييم</span>
            <div className="text-3xl font-bold text-yellow-500 mt-1">15</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">متوسط المدرسة</span>
            <div className="text-3xl font-bold text-blue-600 mt-1">82%</div>
         </div>
      </div>
    </div>
  );
}