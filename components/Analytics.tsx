
import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../supabaseClient';
import { Loader2, Filter, Calendar, School as SchoolIcon, Users, CheckCircle2, Clock, BarChart2, PieChart as PieChartIcon } from 'lucide-react';
import { UserRole, School } from '../types';

const COLORS = ['#22c55e', '#3b82f6', '#eab308', '#ef4444'];

interface AnalyticsProps {
  userRole?: UserRole;
  schoolId?: string;
}

export default function Analytics({ userRole, schoolId }: AnalyticsProps) {
  const [loading, setLoading] = useState(true);
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
              // Logic: Get periods from evaluations table
              // Optimization: We fetch distinct period names directly
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
  useEffect(() => {
    const fetchData = async () => {
        setLoading(true);
        try {
            // CRITICAL: Determine target school. 
            // If Principal, FORCE use of their schoolId regardless of UI state.
            const targetSchoolId = userRole === UserRole.PRINCIPAL ? schoolId : filterSchoolId;

            // Step 1: Get Target Teachers (Denominator) & IDs for filtering
            let teacherIds: string[] | null = null;
            let totalTeachersCount = 0;

            let teacherQuery = supabase.from('teachers').select('id', { count: 'exact' });
            
            if (targetSchoolId) {
                teacherQuery = teacherQuery.eq('school_id', targetSchoolId);
            }

            const { data: teachersData, count: tCount } = await teacherQuery;
            totalTeachersCount = tCount || 0;
            
            // If a specific school is targeted, we use these IDs to filter evaluations
            // This is safer than relying on 'school_id' column in evaluations table which might be empty for old records
            if (targetSchoolId) {
                teacherIds = teachersData?.map((t: any) => t.id) || [];
            }
            
            // Step 2: Fetch Evaluations (Numerator & Data)
            let evalsQuery = supabase
                .from('evaluations')
                .select('teacher_id, total_score, scores, period_name, school_id, status');
            
            // Filter by School (via Teacher IDs relation)
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

            const { data: evaluations } = await evalsQuery;

            // Step 3: Calculation Logic
            // Count UNIQUE teachers evaluated. 
            // STRICT RULE: Only count evaluations with status === 'completed' as "Evaluated".
            // Drafts are effectively "Pending".
            
            const completedEvaluations = evaluations?.filter((e: any) => e.status === 'completed') || [];
            const uniqueEvaluatedTeachers = new Set(completedEvaluations.map((e: any) => e.teacher_id)).size;
            
            const evaluatedCount = uniqueEvaluatedTeachers;
            
            // Pending = Total Pool - Evaluated (Completed)
            // Note: This inherently includes those with "Draft" status as Pending.
            const pendingCount = Math.max(0, totalTeachersCount - evaluatedCount);

            // Step 4: Process Status Distribution (Pie Chart)
            const levels = { 'متميز': 0, 'متقدم': 0, 'متمكن': 0, 'مبتدئ': 0, 'غير مجتاز': 0 };
            let totalScoreSum = 0;
            let validScoreCount = 0;

            // Only analyze scores from COMPLETED evaluations
            completedEvaluations.forEach((ev: any) => {
                const score = ev.total_score || 0;
                totalScoreSum += score;
                validScoreCount++;
                
                if (score >= 90) levels['متميز']++;
                else if (score >= 80) levels['متقدم']++;
                else if (score >= 70) levels['متمكن']++;
                else if (score >= 50) levels['مبتدئ']++;
                else levels['غير مجتاز']++;
            });

            const processedStatusData = Object.entries(levels)
                .filter(([_, value]) => value > 0)
                .map(([name, value]) => ({ name, value }));

            // Step 5: Process Indicator Averages (Bar Chart)
            const indicatorSums: Record<string, { sum: number, count: number }> = {};
            // Fetch indicator names
            const { data: indicators } = await supabase.from('evaluation_indicators').select('id, text');
            const indicatorMap = new Map(indicators?.map((i: any) => [i.id, i.text]));

            // Only analyze scores from COMPLETED evaluations
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
                name: (indicatorMap.get(id) as string) || 'مؤشر',
                score: parseFloat((data.sum / data.count).toFixed(1))
            })).slice(0, 8); // Limit to top 8

            // F. Set State
            setStatusData(processedStatusData);
            setScoreData(processedScoreData);
            setSummary({
                total: totalTeachersCount,
                evaluated: evaluatedCount,
                pending: pendingCount,
                average: validScoreCount > 0 ? parseFloat((totalScoreSum / validScoreCount).toFixed(1)) : 0
            });

        } catch (error) {
            console.error('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    fetchData();
  }, [selectedPeriod, filterSchoolId, userRole, schoolId]);

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
                          className="bg-transparent text-gray-700 text-sm focus:outline-none w-full cursor-pointer"
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
                      className="bg-transparent text-gray-700 text-sm focus:outline-none w-full cursor-pointer"
                      value={selectedPeriod}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                  >
                      <option value="">جميع الفترات</option>
                      {periods.map(p => (
                          <option key={p} value={p}>{p}</option>
                      ))}
                  </select>
              </div>
          </div>
      </div>
      
      {loading ? (
          <div className="flex flex-col justify-center items-center h-64 bg-white rounded-xl shadow-sm border border-gray-200">
               <Loader2 className="animate-spin text-primary-600 mb-2" size={32} />
               <p className="text-gray-400 text-xs">جاري التحليل...</p>
          </div>
      ) : (
        <>
            {/* KPI Cards - Grid 2x2 on mobile */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-blue-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-blue-100 transition-colors"></div>
                    <Users className="text-blue-500 mb-2 z-10" size={24}/>
                    <div className="text-2xl md:text-3xl font-bold text-gray-800 z-10">{summary.total}</div>
                    <span className="text-gray-500 text-xs md:text-sm z-10">المعلمين</span>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-green-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-green-100 transition-colors"></div>
                    <CheckCircle2 className="text-green-500 mb-2 z-10" size={24}/>
                    <div className="text-2xl md:text-3xl font-bold text-green-600 z-10">{summary.evaluated}</div>
                    <span className="text-gray-500 text-xs md:text-sm z-10">مكتمل</span>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-yellow-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-yellow-100 transition-colors"></div>
                    <Clock className="text-yellow-500 mb-2 z-10" size={24}/>
                    <div className="text-2xl md:text-3xl font-bold text-yellow-500 z-10">{summary.pending}</div>
                    <span className="text-gray-500 text-xs md:text-sm z-10">بانتظار التقييم</span>
                </div>

                <div className="bg-white p-4 md:p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-12 h-12 bg-purple-50 rounded-bl-full -mr-3 -mt-3 z-0 group-hover:bg-purple-100 transition-colors"></div>
                    <BarChart2 className="text-purple-500 mb-2 z-10" size={24}/>
                    <div className="text-2xl md:text-3xl font-bold text-purple-600 z-10">{summary.average}%</div>
                    <span className="text-gray-500 text-xs md:text-sm z-10">المتوسط العام</span>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                {/* Average Scores Chart */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 h-[350px] md:h-[400px] flex flex-col">
                    <h3 className="font-bold text-lg text-gray-700 mb-4">متوسط الأداء حسب المؤشر</h3>
                    <div className="flex-1 min-h-0">
                        {scoreData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={scoreData} layout="vertical" margin={{ left: 0, right: 30, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#f0f0f0" />
                                <XAxis type="number" domain={[0, 'auto']} hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fill: '#4b5563'}} interval={0} />
                                <Tooltip 
                                    cursor={{fill: '#f9fafb'}}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                                />
                                <Bar dataKey="score" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={16} name="متوسط الدرجة" label={{ position: 'right', fill: '#6b7280', fontSize: 10 }} />
                            </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                                <BarChart2 size={32} className="mb-2 opacity-50"/>
                                <p className="text-xs">لا توجد بيانات</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Status Distribution Pie Chart */}
                <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border border-gray-200 h-[350px] md:h-[400px] flex flex-col">
                    <h3 className="font-bold text-lg text-gray-700 mb-4">توزيع مستويات الأداء</h3>
                    <div className="flex-1 min-h-0">
                        {statusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                data={statusData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                labelLine={true}
                                labelStyle={{fontSize: '11px', fill: '#4b5563'}}
                                >
                                {statusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={2} />
                                ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{fontSize: '11px'}}/>
                            </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
                                <PieChartIcon size={32} className="mb-2 opacity-50" />
                                <p className="text-xs">لا توجد تقييمات مكتملة</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
      )}
    </div>
  );
}
