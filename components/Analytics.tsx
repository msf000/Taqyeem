import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../supabaseClient';
import { Loader2 } from 'lucide-react';

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState<{name: string, value: number}[]>([]);
  const [scoreData, setScoreData] = useState<{name: string, score: number}[]>([]);
  const [summary, setSummary] = useState({
      total: 0,
      evaluated: 0,
      pending: 0,
      average: 0
  });

  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch Teachers (Total)
            const { count: totalTeachers } = await supabase.from('teachers').select('*', { count: 'exact', head: true });
            
            // 2. Fetch Evaluations (Evaluated)
            const { data: evaluations } = await supabase.from('evaluations').select('total_score, scores');

            const evaluatedCount = evaluations?.length || 0;
            const pendingCount = (totalTeachers || 0) - evaluatedCount;

            // 3. Process Status Distribution
            const levels = { 'متميز': 0, 'متقدم': 0, 'متمكن': 0, 'مبتدئ': 0, 'غير مجتاز': 0 };
            let totalScoreSum = 0;

            evaluations?.forEach((ev: any) => {
                const score = ev.total_score || 0;
                totalScoreSum += score;

                if (score >= 90) levels['متميز']++;
                else if (score >= 80) levels['متقدم']++;
                else if (score >= 70) levels['متمكن']++;
                else if (score >= 50) levels['مبتدئ']++;
                else levels['غير مجتاز']++;
            });

            const processedStatusData = Object.entries(levels)
                .filter(([_, value]) => value > 0)
                .map(([name, value]) => ({ name, value }));

            // 4. Process Indicator Averages
            // Note: This requires client-side processing of the 'scores' JSONB column if not using advanced SQL views.
            // Simplified: We assume 'scores' is a map of indicatorId -> { score: number }
            // For a production app with simplified SQL, we might need a separate table for scores to aggregate easily.
            // Here we do it in JS for MVP.
            
            const indicatorSums: Record<string, { sum: number, count: number }> = {};
            // Need to fetch indicator names to map IDs
            const { data: indicators } = await supabase.from('evaluation_indicators').select('id, text');
            const indicatorMap = new Map(indicators?.map((i: any) => [i.id, i.text]));

            evaluations?.forEach((ev: any) => {
                const scoresMap = ev.scores;
                if (scoresMap) {
                    Object.values(scoresMap).forEach((s: any) => {
                        if (!indicatorSums[s.indicatorId]) {
                            indicatorSums[s.indicatorId] = { sum: 0, count: 0 };
                        }
                        indicatorSums[s.indicatorId].sum += (s.score || 0);
                        indicatorSums[s.indicatorId].count += 1;
                    });
                }
            });

            const processedScoreData = Object.entries(indicatorSums).map(([id, data]) => ({
                name: (indicatorMap.get(id) as string) || 'مؤشر',
                score: parseFloat((data.sum / data.count).toFixed(1))
            })).slice(0, 7); // Show top 7 for UI fit

            setStatusData(processedStatusData);
            setScoreData(processedScoreData);
            setSummary({
                total: totalTeachers || 0,
                evaluated: evaluatedCount,
                pending: pendingCount,
                average: evaluatedCount > 0 ? parseFloat((totalScoreSum / evaluatedCount).toFixed(1)) : 0
            });

        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, []);

  if (loading) {
      return (
          <div className="flex justify-center items-center h-96">
               <Loader2 className="animate-spin text-primary-600" size={40} />
          </div>
      );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">التحليلات والإحصائيات</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Average Scores Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="font-bold text-lg mb-6 text-gray-700">متوسط الأداء حسب المؤشر (للمقيمين)</h3>
           <div className="h-72">
             {scoreData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <BarChart data={scoreData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={true} />
                    <XAxis type="number" domain={[0, 10]} />
                    <YAxis dataKey="name" type="category" width={150} tick={{fontSize: 10}} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#22c55e" radius={[0, 4, 4, 0]} name="متوسط الدرجة" />
                </BarChart>
                </ResponsiveContainer>
             ) : (
                 <div className="h-full flex items-center justify-center text-gray-400">لا توجد بيانات كافية</div>
             )}
           </div>
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
           <h3 className="font-bold text-lg mb-6 text-gray-700">توزيع مستويات المعلمين</h3>
           <div className="h-72">
             {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    >
                    {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
                </ResponsiveContainer>
             ) : (
                <div className="h-full flex items-center justify-center text-gray-400">لا توجد بيانات كافية</div>
             )}
           </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">إجمالي المعلمين</span>
            <div className="text-3xl font-bold text-gray-800 mt-1">{summary.total}</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">تم تقييمهم</span>
            <div className="text-3xl font-bold text-green-600 mt-1">{summary.evaluated}</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">بانتظار التقييم</span>
            <div className="text-3xl font-bold text-yellow-500 mt-1">{summary.pending}</div>
         </div>
         <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
            <span className="text-gray-500 text-sm">متوسط المدرسة</span>
            <div className="text-3xl font-bold text-blue-600 mt-1">{summary.average}%</div>
         </div>
      </div>
    </div>
  );
}