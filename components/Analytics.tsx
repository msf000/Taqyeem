
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../supabaseClient';
import { Loader2, Filter, Calendar, School as SchoolIcon, Users, CheckCircle2, Clock, BarChart2, PieChart as PieChartIcon, RefreshCw, XCircle } from 'lucide-react';
import { UserRole, School } from '../types';

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

interface AnalyticsProps {
  userRole?: UserRole;
  schoolId?: string;
  nationalId?: string;
}

export default function Analytics({ userRole, schoolId, nationalId }: AnalyticsProps) {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusData, setStatusData] = useState<{name: string, value: number}[]>([]);
  const [scoreData, setScoreData] = useState<{name: string, score: number}[]>([]);
  const [summary, setSummary] = useState({
      total: 0,
      evaluated: 0,
      pending: 0,
      average: 0
  });

  // Filtering State
  const [periods, setPeriods] = useState<string[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  
  // School Filtering (Admin Only)
  const [schoolsList, setSchoolsList] = useState<School[]>([]);
  const [filterSchoolId, setFilterSchoolId] = useState<string>('');

  // 1. Fetch Filters (Schools & Periods)
  useEffect(() => {
      const fetchFilters = async () => {
          try {
              // A. Fetch Schools List (Only for Admin)
              if (userRole === UserRole.ADMIN) {
                  const { data: schoolsData } = await supabase.from('schools').select('id, name').order('name');
                  const mappedSchools: any[] = schoolsData?.map(s => ({ id: s.id, name: s.name })) || [];
                  setSchoolsList(mappedSchools);
              }

              // B. Fetch Available Periods
              const { data: periodsData } = await supabase.from('evaluations').select('period_name');
              
              if (periodsData) {
                  const uniquePeriods = Array.from(new Set(periodsData.map((item: any) => item.period_name).filter(Boolean))) as string[];
                  setPeriods(uniquePeriods);
              }
          } catch (error) {
              console.error('Error fetching filters:', error);
          }
      };

      fetchFilters();
  }, [userRole]); 

  // 2. Fetch Analytics Data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
        // Step 0: Determine target school ID robustly
        let targetSchoolId = filterSchoolId; // Default for Admin

        if (userRole === UserRole.PRINCIPAL) {
            targetSchoolId = schoolId || '';
            
            // Fallback: If schoolId is missing but nationalId exists, fetch school
            if (!targetSchoolId && nationalId) {
                const { data: schoolData } = await supabase
                    .from('schools')
                    .select('id')
                    .eq('manager_national_id', nationalId)
                    .single();
                
                if (schoolData) {
                    targetSchoolId = schoolData.id;
                }
            }
        } else if (userRole === UserRole.EVALUATOR) {
            targetSchoolId = schoolId || '';
        }

        // If Principal still has no school ID, we can't show specific data
        if (userRole === UserRole.PRINCIPAL && !targetSchoolId) {
             // Treat as empty state
             setSummary({ total: 0, evaluated: 0, pending: 0, average: 0 });
             setStatusData([]);
             setScoreData([]);
             setLoading(false);
             return;
        }

        // Step 1: Get Target Teachers (Denominator) & IDs for filtering
        let teacherIds: string[] | null = null;
        let totalTeachersCount = 0;

        let teacherQuery = supabase.from('teachers').select('id', { count: 'exact' });
        
        if (targetSchoolId) {
            teacherQuery = teacherQuery.eq('school_id', targetSchoolId);
        }

        const { data: teachersData, count: tCount, error: tError } = await teacherQuery;
        if (tError) throw tError;

        totalTeachersCount = tCount || 0;
        
        // If a specific school is targeted, use these IDs to filter evaluations
        if (targetSchoolId) {
            teacherIds = teachersData?.map((t: any) => t.id) || [];
        }
        
        // Step 2: Fetch Evaluations (Numerator & Data)
        let evalsQuery = supabase
            .from('evaluations')
            .select('teacher_id, total_score, scores, period_name, status');
        
        // Filter by Teacher IDs (Relation)
        if (teacherIds !== null) {
            if (teacherIds.length > 0) {
                evalsQuery = evalsQuery.in('teacher_id', teacherIds);
            } else {
                // School has no teachers, so force empty result
                evalsQuery = evalsQuery.eq('teacher_id', '00000000-0000-0000-0000-000000000000'); 
            }
        }

        if (selectedPeriod) {
            evalsQuery = evalsQuery.eq('period_name', selectedPeriod);
        }

        const { data: evaluations, error: evalsError } = await evalsQuery;
        if (evalsError) throw evalsError;

        // Step 3: Calculation Logic
        const completedEvaluations = evaluations?.filter((e: any) => e.status === 'completed') || [];
        const uniqueEvaluatedTeachers = new Set(completedEvaluations.map((e: any) => e.teacher_id)).size;
        
        const evaluatedCount = uniqueEvaluatedTeachers;
        const pendingCount = Math.max(0, totalTeachersCount - evaluatedCount);

        // Step 4: Process Status Distribution (Pie Chart)
        const levels = { 'متميز (90+)': 0, 'متقدم (80-89)': 0, 'متمكن (70-79)': 0, 'مبتدئ (50-69)': 0, 'غير مجتاز': 0 };
        let totalScoreSum = 0;
        let validScoreCount = 0;

        completedEvaluations.forEach((ev: any) => {
            const score = ev.total_score || 0;
            totalScoreSum += score;
            validScoreCount++;
            
            if (score >= 90) levels['متميز (90+)']++;
            else if (score >= 80) levels['متقدم (80-89)']++;
            else if (score >= 70) levels['متمكن (70-79)']++;
            else if (score >= 50) levels['مبتدئ (50-69)']++;
            else levels['غير مجتاز']++;
        });

        const processedStatusData = Object.entries(levels)
            .filter(([_, value]) => value > 0)
            .map(([name, value]) => ({ name, value }));

        // Step 5: Process Indicator Averages (Bar Chart)
        const indicatorSums: Record<string, { sum: number, count: number }> = {};
        
        // Only fetch indicator names if we have evaluations to process
        if (completedEvaluations.length > 0) {
            const { data: indicators } = await supabase.from('evaluation_indicators').select('id, text');
            const indicatorMap = new Map(indicators?.map((i: any) => [i.id, i.text]));

            completedEvaluations.forEach((ev: any) => {
                const scoresMap = ev.scores;
                if (scoresMap) {
                    Object.values(scoresMap).forEach((s: any) => {
                        if (s && s.indicatorId && s.score > 0) {
                            if (!indicatorSums[s.indicatorId]) {
                                indicatorSums[s.indicatorId] = { sum: 0, count: 0 };
                            }
                            indicatorSums[s.indicatorId].sum += (s.score || 0);
                            indicatorSums[s.indicatorId].count += 1;
                        }
                    });
                }
            });

            const processedScoreData = Object.entries(indicatorSums).map(([id, data]) => ({
                name: (indicatorMap.get(id) as string)?.substring(0, 30) + '...' || 'مؤشر',
                full_name: (indicatorMap.get(id) as string) || 'مؤشر',
                score: parseFloat((data.sum / data.count).toFixed(1))
            }))
            .sort((a, b) => b.score - a.score) // Sort by highest score
            .slice(0, 8); // Top 8

            setScoreData(processedScoreData);
        } else {
            setScoreData([]);
        }

        // F. Set State
        setStatusData(processedStatusData);
        
        setSummary({
            total: totalTeachersCount,
            evaluated: evaluatedCount,
            pending: pendingCount,
            average: validScoreCount > 0 ? parseFloat((totalScoreSum / validScoreCount).toFixed(1)) : 0
        });

    } catch (error: any) {
        console.error('Error fetching analytics:', error);
        setErrorMsg('تعذر تحميل بيانات التحليل. يرجى التحقق من الاتصال.');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedPeriod, filterSchoolId, userRole, schoolId, nationalId]);

  if (loading) {
      return (
          <div className="flex flex-col justify-center items-center h-96 bg-white rounded-xl shadow-sm border border-gray-200">
               <Loader2 className="animate-spin text-primary-600 mb-4" size={48} />
               <p className="text-gray-500 font-medium">جاري معالجة البيانات...</p>
          </div>
      );
  }

  if (errorMsg) {
      return (
        <div className="flex flex-col items-center justify-center h-96 bg-white rounded-xl shadow-sm border border-gray-200 text-center p-6">
            <XCircle className="text-red-500 mb-4" size={48} />
            <p className="text-gray-700 font-bold mb-2 text-lg">{errorMsg}</p>
            <button onClick={fetchData} className="flex items-center gap-2 text-primary-600 hover:text-primary-800 bg-primary-50 px-6 py-2 rounded-lg transition-colors font-bold mt-4">
                <RefreshCw size={18} /> إعادة المحاولة
            </button>
        </div>
      );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Filters Header */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                <BarChart2 className="text-primary-600"/> التحليلات
            </h2>
            <p className="text-sm text-gray-500 mt-1">
                {userRole === UserRole.PRINCIPAL 
                    ? 'لوحة متابعة الأداء لمعلمي مدرستك' 
                    : 'لوحة القياس الشاملة'}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              {/* School Filter (Admin Only) */}
              {(userRole === UserRole.ADMIN) && (
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 lg:flex-none">
                      <SchoolIcon size={16} className="text-gray-400 shrink-0" />
                      <select 
                          className="bg-transparent text-gray-700 text-sm focus:outline-none w-full cursor-pointer min-w-[150px]"
                          value={filterSchoolId}
                          onChange={(e) => setFilterSchoolId(e.target.value)}
                      >
                          <option value="">جميع المدارس</option>
                          {schoolsList.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                      </select>
                  </div>
              )}

              {/* Period Filter */}
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 flex-1 lg:flex-none">
                  <Filter size={16} className="text-gray-400 shrink-0" />
                  <select 
                      className="bg-transparent text-gray-700 text-sm focus:outline-none w-full cursor-pointer min-w-[150px]"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                      <option value="">جميع الفترات</option>
                      {periods.map(p => (
                          <option key={p} value={p}>{p}</option>
                      ))}
                  </select>
              </div>
              
              <button 
                onClick={fetchData} 
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                title="تحديث البيانات"
              >
                  <RefreshCw size={18} />
              </button>
          </div>
      </div>
      
      {/* KPI Cards - Grid 2x2 on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-blue-100 transition-colors"></div>
                <Users className="text-blue-500 mb-2 z-10" size={24}/>
                <div className="text-2xl md:text-3xl font-bold text-gray-800 z-10">{summary.total}</div>
                <span className="text-gray-500 text-xs md:text-sm z-10 font-medium">إجمالي المعلمين</span>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-green-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-green-100 transition-colors"></div>
                <CheckCircle2 className="text-green-500 mb-2 z-10" size={24}/>
                <div className="text-2xl md:text-3xl font-bold text-green-600 z-10">{summary.evaluated}</div>
                <span className="text-gray-500 text-xs md:text-sm z-10 font-medium">تم التقييم (مكتمل)</span>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-yellow-100 transition-colors"></div>
                <Clock className="text-yellow-500 mb-2 z-10" size={24}/>
                <div className="text-2xl md:text-3xl font-bold text-yellow-500 z-10">{summary.pending}</div>
                <span className="text-gray-500 text-xs md:text-sm z-10 font-medium">بانتظار التقييم</span>
            </div>

            <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-12 h-12 bg-purple-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-purple-100 transition-colors"></div>
                <BarChart2 className="text-purple-500 mb-2 z-10" size={24}/>
                <div className="text-2xl md:text-3xl font-bold text-purple-600 z-10">{summary.average}%</div>
                <span className="text-gray-500 text-xs md:text-sm z-10 font-medium">المتوسط العام للأداء</span>
            </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
            {/* Average Scores Chart */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 h-[400px] flex flex-col">
                <h3 className="font-bold text-lg text-gray-700 mb-4 border-b pb-2">متوسط الأداء حسب المؤشر (أعلى 8)</h3>
                <div className="flex-1 min-h-0 w-full">
                    {scoreData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={scoreData} layout="vertical" margin={{ left: 0, right: 10, bottom: 20, top: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                            <XAxis type="number" domain={[0, 'auto']} hide />
                            <YAxis 
                                dataKey="name" 
                                type="category" 
                                width={120} 
                                tick={{fontSize: 11, fill: '#4b5563', fontWeight: 500}} 
                                interval={0} 
                            />
                            <Tooltip 
                                cursor={{fill: '#f9fafb'}}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }}
                                formatter={(value: any) => [`${value}`, 'المتوسط']}
                                labelStyle={{ fontWeight: 'bold', marginBottom: '5px' }}
                            />
                            <Bar 
                                dataKey="score" 
                                fill="#3b82f6" 
                                radius={[4, 0, 0, 4]} // RTL radius
                                barSize={20} 
                                name="متوسط الدرجة" 
                                label={{ position: 'left', fill: '#4b5563', fontSize: 11, fontWeight: 'bold' }} 
                            />
                        </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <BarChart2 size={40} className="mb-3 opacity-30"/>
                            <p className="text-sm font-medium">لا توجد بيانات كافية لعرض المؤشرات</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Status Distribution Pie Chart */}
            <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 h-[400px] flex flex-col">
                <h3 className="font-bold text-lg text-gray-700 mb-4 border-b pb-2">توزيع مستويات الأداء</h3>
                <div className="flex-1 min-h-0 w-full relative">
                    {statusData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)', fontSize: '12px' }} 
                                        formatter={(value: any) => [`${value} معلم`, 'العدد']}
                                    />
                                    <Legend 
                                        verticalAlign="bottom" 
                                        height={36} 
                                        iconType="circle" 
                                        wrapperStyle={{fontSize: '12px', paddingTop: '20px'}}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            {/* Center Text */}
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-12">
                                <span className="text-3xl font-bold text-gray-800">{summary.evaluated}</span>
                                <span className="text-xs text-gray-500">مقيم</span>
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                            <PieChartIcon size={40} className="mb-3 opacity-30" />
                            <p className="text-sm font-medium">لا توجد تقييمات مكتملة لعرض التوزيع</p>
                        </div>
                    )}
                </div>
            </div>
      </div>
    </div>
  );
}
