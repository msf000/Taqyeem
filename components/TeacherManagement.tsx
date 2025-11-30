
import React, { useState, useEffect, useRef } from 'react';
import { Upload, MoreHorizontal, Search, FileText, CheckCircle, XCircle, Loader2, Filter, X, Plus, Trash2, Download, User, ArrowRight, Edit2, Info, History, Shield, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Teacher, TeacherCategory, EvaluationStatus, ImportResult, School, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import readXlsxFile from 'read-excel-file';
import writeXlsxFile from 'write-excel-file';

interface TeacherManagementProps {
  onEvaluate: (teacherId: string) => void;
  userRole?: UserRole;
  schoolId?: string;
  userName?: string;
  onViewHistory?: (teacherId: string) => void;
}

export default function TeacherManagement({ onEvaluate, userRole, schoolId, userName, onViewHistory }: TeacherManagementProps) {
  const [subTab, setSubTab] = useState<'list' | 'add' | 'import' | 'specialties'>('list');
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [schools, setSchools] = useState<School[]>([]); 
  const [specialtiesList, setSpecialtiesList] = useState<{id: string, name: string}[]>([]);
  const [newSpecialty, setNewSpecialty] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // UI States for Edit/View
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewTeacher, setViewTeacher] = useState<Teacher | null>(null);
  
  // Menu State
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Filtering & Sorting State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSchoolId, setFilterSchoolId] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });

  // Add Teacher Form State
  const [newTeacher, setNewTeacher] = useState<Partial<Teacher>>({ category: TeacherCategory.TEACHER, roles: [UserRole.TEACHER] });
  const [selectedRoles, setSelectedRoles] = useState<UserRole[]>([UserRole.TEACHER]);
  const [isSaving, setIsSaving] = useState(false);

  // Import Logic State
  const [importStep, setImportStep] = useState<'upload' | 'results'>('upload');
  const [isImporting, setIsImporting] = useState(false); // New loading state for import
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importTargetSchoolId, setImportTargetSchoolId] = useState<string>('');

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (openMenuId && !(event.target as Element).closest('.action-menu-container')) {
            setOpenMenuId(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  // Improved Helper for error messages
  const getErrorMessage = (error: any): string => {
    if (!error) return 'حدث خطأ غير معروف';
    if (error?.message && typeof error.message === 'string') return error.message;
    if (error?.error_description && typeof error.error_description === 'string') return error.error_description;
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    try {
        const str = JSON.stringify(error);
        if (str === '{}' || str === '[]') return 'خطأ غير محدد في النظام';
        return str;
    } catch {
        return 'خطأ غير معروف (تعذر عرض التفاصيل)';
    }
  };

  // Fetch Data
  const fetchData = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
        // 1. Fetch Schools
        let schoolsQuery = supabase.from('schools').select('*').order('name');
        
        // Priority: ManagerName > SchoolID
        if (userRole === UserRole.PRINCIPAL && userName) {
             // Multi-school support: Fetch all schools managed by this user
             schoolsQuery = schoolsQuery.eq('manager_name', userName);
        } else if ((userRole === UserRole.PRINCIPAL || userRole === UserRole.EVALUATOR) && schoolId) {
             // Fallback or specific restriction
             schoolsQuery = schoolsQuery.eq('id', schoolId);
        }

        const { data: schoolsData, error: schoolsError } = await schoolsQuery;
        if (schoolsError) throw schoolsError;

        const mappedSchools: School[] = (schoolsData || []).map((s: any) => ({
             id: s.id,
             name: s.name,
             stage: s.stage,
             type: s.type,
             ministryId: s.ministry_id,
             managerName: s.manager_name,
             evaluatorName: s.evaluator_name
        }));
        setSchools(mappedSchools);
        
        // Auto-select school for import if Principal/Evaluator has only one
        if ((userRole === UserRole.PRINCIPAL || userRole === UserRole.EVALUATOR) && mappedSchools.length === 1) {
            setImportTargetSchoolId(mappedSchools[0].id);
        }

        // 2. Fetch Teachers
        let teachersQuery = supabase.from('teachers').select('*').order('created_at', { ascending: false });
        
        if (userRole === UserRole.PRINCIPAL) {
            const mySchoolIds = mappedSchools.map(s => s.id);
            if (mySchoolIds.length > 0) {
                // Fetch teachers from ALL managed schools
                teachersQuery = teachersQuery.in('school_id', mySchoolIds);
            } else {
                 // No schools found for this principal, show nothing
                 teachersQuery = teachersQuery.eq('id', '00000000-0000-0000-0000-000000000000');
            }
        } else if (userRole === UserRole.EVALUATOR && schoolId) {
            // STRICT FILTER FOR EVALUATOR: Only teachers in their assigned school
            teachersQuery = teachersQuery.eq('school_id', schoolId);
        }

        const { data: teachersData, error: teachersError } = await teachersQuery;
        if (teachersError) throw teachersError;

        const { data: evalsData } = await supabase.from('evaluations').select('teacher_id, status').order('created_at', { ascending: false });
        const { data: specData } = await supabase.from('specialties').select('*').order('name');
        setSpecialtiesList(specData || []);

        const mappedTeachers: Teacher[] = (teachersData || []).map((t: any) => {
            // Find LATEST evaluation
            const evalRecord = evalsData?.find((e: any) => e.teacher_id === t.id);
            let status = EvaluationStatus.NOT_EVALUATED;
            if (evalRecord) {
                status = evalRecord.status === 'completed' ? EvaluationStatus.COMPLETED : EvaluationStatus.DRAFT;
            }

            // Normalize roles
            let roles: UserRole[] = [];
            if (t.roles && Array.isArray(t.roles) && t.roles.length > 0) {
                roles = t.roles;
            } else if (t.role) {
                roles = [t.role as UserRole];
            } else {
                roles = [UserRole.TEACHER];
            }

            return {
                id: t.id,
                name: t.name,
                nationalId: t.national_id,
                specialty: t.specialty,
                category: t.category as TeacherCategory,
                role: roles[0],
                roles: roles,
                mobile: t.mobile,
                schoolId: t.school_id,
                status: status
            };
        });

        setTeachers(mappedTeachers);

    } catch (error: any) {
        const msg = getErrorMessage(error);
        console.error('Error fetching data:', error);
        setErrorMessage(msg);
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [userRole, schoolId, userName]);

  const handleEditTeacher = (teacher: Teacher) => {
      setNewTeacher({
          name: teacher.name,
          nationalId: teacher.nationalId,
          specialty: teacher.specialty,
          category: teacher.category,
          role: teacher.role,
          mobile: teacher.mobile,
          schoolId: teacher.schoolId
      });
      setSelectedRoles(teacher.roles || [UserRole.TEACHER]);
      setEditingId(teacher.id);
      setOpenMenuId(null);
      setSubTab('add');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleRoleToggle = (role: UserRole) => {
      setSelectedRoles(prev => {
          if (prev.includes(role)) {
              return prev.filter(r => r !== role);
          } else {
              return [...prev, role];
          }
      });
  };

  const handleDeleteTeacher = async (id: string): Promise<boolean> => {
      if (!window.confirm("هل أنت متأكد من حذف هذا المعلم؟ سيتم حذف جميع تقييماته المرتبطة ولن يمكن التراجع عن هذا الإجراء.")) return false;

      setIsLoading(true);
      try {
          // 1. Manually delete evaluations first to prevent FK constraint errors
          const { error: evalError } = await supabase.from('evaluations').delete().eq('teacher_id', id);
          if (evalError) {
              console.warn('Warning deleting evaluations:', evalError);
          }

          // 2. Delete the teacher
          const { error } = await supabase.from('teachers').delete().eq('id', id);
          if (error) throw error;
          
          setTeachers(teachers.filter(t => t.id !== id));
          if (viewTeacher?.id === id) setViewTeacher(null);
          setOpenMenuId(null);
          
          alert('تم حذف المعلم وجميع تقييماته بنجاح.');
          return true;
          
      } catch (error) {
          console.error(error);
          let msg = getErrorMessage(error);
          
          if (msg.includes('foreign key constraint')) {
              msg = `لا يمكن حذف المعلم لوجود سجلات مرتبطة به (تقييمات). \n\nيرجى الذهاب إلى الإعدادات > قاعدة البيانات، وتشغيل كود "إصلاح القيود" لحل هذه المشكلة بشكل نهائي.`;
          }
          
          alert('حدث خطأ أثناء الحذف:\n' + msg);
          return false;
      } finally {
          setIsLoading(false);
      }
  };

  const handleSaveTeacher = async () => {
      if (!newTeacher.name || !newTeacher.nationalId) {
          alert("يرجى تعبئة الحقول الأساسية");
          return;
      }

      if (selectedRoles.length === 0) {
          alert("يجب اختيار صلاحية واحدة على الأقل");
          return;
      }

      let targetSchoolId = newTeacher.schoolId;
      // Auto-select if only one school
      if (!targetSchoolId && schools.length === 1) {
          targetSchoolId = schools[0].id;
      }

      if (!targetSchoolId) {
          alert("يرجى اختيار المدرسة");
          return;
      }

      setIsSaving(true);
      try {
          const payload = {
              name: newTeacher.name,
              national_id: newTeacher.nationalId,
              specialty: newTeacher.specialty,
              category: newTeacher.category,
              role: selectedRoles[0], // Primary role for legacy support
              roles: selectedRoles,   // Array for multiple support
              mobile: newTeacher.mobile,
              school_id: targetSchoolId
          };
          
          if (editingId) {
              const { error } = await supabase.from('teachers').update(payload).eq('id', editingId);
              if (error) throw error;
          } else {
              const { error } = await supabase.from('teachers').insert([payload]);
              if (error) throw error;
          }

          await fetchData();
          setSubTab('list');
          setNewTeacher({ category: TeacherCategory.TEACHER });
          setSelectedRoles([UserRole.TEACHER]);
          setEditingId(null);
      } catch (error: any) {
          console.error("Error saving teacher:", error);
          const msg = getErrorMessage(error);
          
          if (error?.code === 'PGRST204') {
              alert("حدث خطأ في قاعدة البيانات (PGRST204): العمود 'roles' غير موجود.\n\nيرجى الذهاب إلى صفحة 'الإعدادات' > 'قاعدة البيانات' وتشغيل كود التحديث لإضافة هذا العمود.");
          } else if (error?.code === '23505') {
              alert("رقم الهوية مسجل مسبقاً في هذه المدرسة.");
          } else {
              alert(`حدث خطأ أثناء الحفظ: ${msg}`);
          }
      } finally {
          setIsSaving(false);
      }
  };

  const handleCancelEdit = () => {
      setSubTab('list');
      setNewTeacher({ category: TeacherCategory.TEACHER });
      setSelectedRoles([UserRole.TEACHER]);
      setEditingId(null);
  };

  const handleAddSpecialty = async () => {
      if(!newSpecialty.trim()) return;
      try {
          const { data, error } = await supabase.from('specialties').insert([{ name: newSpecialty.trim() }]).select().single();
          if(error) throw error;
          setSpecialtiesList([...specialtiesList, data]);
          setNewSpecialty('');
      } catch(err) {
          alert('خطأ: ' + getErrorMessage(err));
      }
  };

  const handleDeleteSpecialty = async (id: string) => {
      if(!confirm('هل أنت متأكد من حذف التخصص؟')) return;
      try {
          const { error } = await supabase.from('specialties').delete().eq('id', id);
          if(error) throw error;
          setSpecialtiesList(specialtiesList.filter(s => s.id !== id));
      } catch(err) {
          console.error(err);
          alert('خطأ في الحذف: ' + getErrorMessage(err));
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!importTargetSchoolId) {
        alert("يرجى اختيار المدرسة أولاً");
        e.target.value = ''; 
        return;
    }

    const file = e.target.files?.[0];
    if (!file) return;
    
    // Start Loading
    setIsImporting(true);
    setImportResults([]);
    const results: ImportResult[] = [];

    try {
        const rows = await readXlsxFile(file);
        
        if (rows.length < 2) { 
            alert("الملف فارغ أو لا يحتوي على بيانات"); 
            setImportStep('upload'); 
            return; 
        }
        
        // Headers are in rows[0]
        const headers = rows[0].map(h => String(h).trim());
        const nameIdx = headers.findIndex(h => h.includes('اسم') || h.includes('Name'));
        const idIdx = headers.findIndex(h => h.includes('هوية') || h.includes('National'));
        const specIdx = headers.findIndex(h => h.includes('تخصص') || h.includes('Specialty'));
        const mobIdx = headers.findIndex(h => h.includes('جوال') || h.includes('Mobile'));

        if (nameIdx === -1 || idIdx === -1) { 
            alert("لم يتم التعرف على الأعمدة. الرجاء استخدام القالب المعتمد."); 
            setImportStep('upload'); 
            return; 
        }

        // Move to results view, but show loading indicator
        setImportStep('results');

        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            // Handle potentially empty rows
            if (!row || row.length === 0) continue;

            const name = row[nameIdx] ? String(row[nameIdx]).trim() : '';
            const nationalId = row[idIdx] ? String(row[idIdx]).trim() : '';
            const specialty = specIdx > -1 && row[specIdx] ? String(row[specIdx]).trim() : '';
            const mobile = mobIdx > -1 && row[mobIdx] ? String(row[mobIdx]).trim() : '';

            if (!name || !nationalId) { 
                results.push({ row: i + 1, nationalId, name, specialty, mobile, addedBy: '-', status: 'failed', message: 'بيانات ناقصة (الاسم أو الهوية)' }); 
                continue; 
            }
            
            try {
                 const { error } = await supabase.from('teachers').insert([{ 
                     name: name, 
                     national_id: nationalId, 
                     specialty: specialty, 
                     mobile: mobile, 
                     category: TeacherCategory.TEACHER, 
                     role: UserRole.TEACHER,
                     roles: [UserRole.TEACHER], // Default import role
                     school_id: importTargetSchoolId 
                 }]);
                 
                 if (error) throw error;
                 results.push({ row: i + 1, nationalId, name, specialty, mobile, addedBy: 'System', status: 'success' });
            } catch (err: any) {
                let msg = 'خطأ في الحفظ';
                if (err.code === '23505') msg = 'رقم الهوية مكرر في هذه المدرسة';
                else msg = getErrorMessage(err);
                results.push({ row: i + 1, nationalId, name, specialty, mobile, addedBy: '-', status: 'failed', message: msg });
            }
        }
        setImportResults(results);
        fetchData(); 

    } catch (error) {
        console.error("Excel Read Error:", error);
        alert("حدث خطأ أثناء قراءة ملف Excel. يرجى التأكد من صلاحية الملف.");
        setImportStep('upload');
    } finally {
        e.target.value = '';
        setIsImporting(false); // Stop loading
    }
  };

  const handleDownloadTemplate = async () => {
    const data = [
      [
        { value: 'الاسم الكامل', fontWeight: 'bold' },
        { value: 'رقم الهوية', fontWeight: 'bold' },
        { value: 'التخصص', fontWeight: 'bold' },
        { value: 'رقم الجوال', fontWeight: 'bold' }
      ],
      [
        { value: 'مثال: محمد علي', type: String },
        { value: '10xxxxxxxxx', type: String },
        { value: 'رياضيات', type: String },
        { value: '05xxxxxxxx', type: String }
      ]
    ];

    try {
        await writeXlsxFile(data, {
            fileName: 'teachers_template.xlsx'
        });
    } catch (error) {
        console.error("Template generation error:", error);
        alert("حدث خطأ أثناء إنشاء القالب.");
    }
  };

  // Filter Logic
  const uniqueSpecialties = Array.from(new Set(teachers.map(t => t.specialty).filter(Boolean)));
  const filteredTeachers = teachers.filter(teacher => {
    const matchesSearch = searchTerm === '' || teacher.name.includes(searchTerm) || teacher.nationalId.includes(searchTerm);
    const matchesSchool = filterSchoolId === '' || teacher.schoolId === filterSchoolId;
    const matchesSpecialty = filterSpecialty === '' || teacher.specialty === filterSpecialty;
    const matchesStatus = filterStatus === '' || teacher.status === filterStatus;
    return matchesSearch && matchesSchool && matchesSpecialty && matchesStatus;
  });

  // Sorting Logic
  const sortedTeachers = [...filteredTeachers].sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch(sortConfig.key) {
          case 'name':
              aValue = a.name; bValue = b.name;
              break;
          case 'nationalId':
              aValue = a.nationalId; bValue = b.nationalId;
              break;
          case 'specialty':
              aValue = a.specialty; bValue = b.specialty;
              break;
          case 'category':
              aValue = a.category; bValue = b.category;
              break;
          case 'school':
              aValue = schools.find(s=>s.id===a.schoolId)?.name || ''; 
              bValue = schools.find(s=>s.id===b.schoolId)?.name || '';
              break;
          default:
              return 0;
      }

      if (sortConfig.direction === 'asc') {
          return String(aValue).localeCompare(String(bValue), 'ar');
      } else {
          return String(bValue).localeCompare(String(aValue), 'ar');
      }
  });

  const handleSort = (key: string) => {
      setSortConfig(current => ({
          key,
          direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
      }));
  };

  const clearFilters = () => {
      setSearchTerm('');
      setFilterSchoolId('');
      setFilterSpecialty('');
      setFilterStatus('');
  };

  const hasActiveFilters = searchTerm || filterSchoolId || filterSpecialty || filterStatus;

  const renderSortIcon = (key: string) => {
      if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400 opacity-50" />;
      return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-primary-600"/> : <ArrowDown size={14} className="text-primary-600"/>;
  };

  const SortableHeader = ({ label, sortKey }: { label: string, sortKey: string }) => (
      <th 
        className="px-6 py-4 cursor-pointer hover:bg-gray-100 transition-colors select-none group"
        onClick={() => handleSort(sortKey)}
      >
          <div className="flex items-center gap-2">
              {label}
              {renderSortIcon(sortKey)}
          </div>
      </th>
  );

  return (
    <div className="space-y-6">
      <div className="flex border-b border-gray-200 gap-6">
        <button onClick={() => { setSubTab('list'); setEditingId(null); }} className={`pb-3 font-medium transition-colors ${subTab === 'list' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>المعلمين</button>
        
        {/* Hide admin actions from Evaluator */}
        {userRole !== UserRole.EVALUATOR && (
            <>
                <button onClick={() => { setSubTab('add'); setEditingId(null); setNewTeacher({ category: TeacherCategory.TEACHER }); setSelectedRoles([UserRole.TEACHER]); }} className={`pb-3 font-medium transition-colors ${subTab === 'add' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>
                    {editingId ? 'تعديل بيانات المعلم' : 'إضافة معلم'}
                </button>
                <button onClick={() => setSubTab('import')} className={`pb-3 font-medium transition-colors ${subTab === 'import' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>استيراد المعلمين</button>
                <button onClick={() => setSubTab('specialties')} className={`pb-3 font-medium transition-colors ${subTab === 'specialties' ? 'border-b-2 border-primary-600 text-primary-700' : 'text-gray-500'}`}>إدارة التخصصات</button>
            </>
        )}
      </div>

      {subTab === 'list' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden relative">
            {/* ... View Modal ... */}
            {viewTeacher && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl animate-fade-in">
                        <div className="flex justify-between items-center p-6 border-b">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <User className="text-primary-600" /> 
                                {viewTeacher.name}
                            </h3>
                            <button onClick={() => setViewTeacher(null)} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                        </div>
                        <div className="p-6 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 block mb-1">رقم الهوية</label>
                                    <p className="font-mono font-medium">{viewTeacher.nationalId}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 block mb-1">الفئة الوظيفية</label>
                                    <p className="font-medium text-primary-700">{viewTeacher.category}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 block mb-1">التخصص</label>
                                    <p className="font-medium">{viewTeacher.specialty}</p>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 block mb-1">الصلاحيات</label>
                                    <div className="flex flex-wrap gap-1">
                                        {viewTeacher.roles && viewTeacher.roles.length > 0 ? (
                                            viewTeacher.roles.map((r, i) => (
                                                <span key={i} className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-xs font-bold">{r}</span>
                                            ))
                                        ) : (
                                            <span className="font-medium">{viewTeacher.role || UserRole.TEACHER}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <label className="text-xs text-gray-500 block mb-1">رقم الجوال</label>
                                    <p className="font-medium" dir="ltr">{viewTeacher.mobile || '-'}</p>
                                </div>
                            </div>
                            <div className="border-t pt-4">
                                <label className="text-xs text-gray-500 block mb-2">المدرسة التابع لها</label>
                                <div className="flex items-center gap-2 font-medium">
                                    <CheckCircle size={16} className="text-green-500"/>
                                    {schools.find(s => s.id === viewTeacher.schoolId)?.name || 'غير محدد'}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={() => setViewTeacher(null)} className="px-6 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Banner */}
            {errorMessage && (
                <div className="bg-red-50 text-red-700 p-4 border-b border-red-100 flex items-center gap-2">
                    <XCircle size={20} />
                    <span>{errorMessage}</span>
                    <button onClick={fetchData} className="mr-auto underline text-sm">إعادة المحاولة</button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                <div className="flex flex-1 flex-col md:flex-row gap-3 w-full">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute right-3 top-2.5 text-gray-400" size={18} />
                        <input 
                            type="text" 
                            placeholder="بحث بالاسم أو رقم الهوية..." 
                            className="w-full pr-10 pl-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-primary-500 text-sm" 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
                        {/* Show school filter even for Principals if they manage multiple schools */}
                        {schools.length > 1 && (
                            <select 
                                className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[140px]"
                                value={filterSchoolId} onChange={(e) => setFilterSchoolId(e.target.value)}
                            >
                                <option value="">كل المدارس</option>
                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        )}
                        <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[130px]" value={filterSpecialty} onChange={(e) => setFilterSpecialty(e.target.value)}>
                            <option value="">كل التخصصات</option>
                            {uniqueSpecialties.map(spec => <option key={spec} value={spec}>{spec}</option>)}
                        </select>
                        <select className="px-3 py-2 rounded-lg border border-gray-300 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-500 min-w-[130px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                            <option value="">حالة التقييم</option>
                            <option value={EvaluationStatus.NOT_EVALUATED}>لم يتم التقييم</option>
                            <option value={EvaluationStatus.DRAFT}>مسودة (جاري)</option>
                            <option value={EvaluationStatus.COMPLETED}>مكتمل</option>
                        </select>
                        {hasActiveFilters && (
                            <button onClick={clearFilters} className="px-3 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-sm flex items-center gap-1 transition-colors whitespace-nowrap"><X size={16} /> مسح</button>
                        )}
                    </div>
                </div>
                <div><button onClick={fetchData} className="text-gray-500 hover:text-gray-700 text-sm px-3 py-2">تحديث</button></div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto min-h-[400px]">
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-600" size={30} /></div>
                ) : (
                <table className="w-full text-right">
                    <thead className="bg-gray-50 text-gray-600 text-sm font-semibold">
                        <tr>
                            <SortableHeader label="الاسم الكامل" sortKey="name" />
                            <SortableHeader label="رقم الهوية" sortKey="nationalId" />
                            <SortableHeader label="فئة المعلم" sortKey="category" />
                            <th className="px-6 py-4">الصلاحيات</th>
                            <SortableHeader label="التخصص" sortKey="specialty" />
                            <SortableHeader label="المدرسة" sortKey="school" />
                            <th className="px-6 py-4 text-center">الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sortedTeachers.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="text-center py-8 text-gray-500 flex flex-col items-center justify-center gap-2">
                                    <Search size={32} className="text-gray-300" />
                                    <p>لا توجد نتائج مطابقة.</p>
                                </td>
                            </tr>
                        ) : (
                            sortedTeachers.map(teacher => {
                                const schoolName = schools.find(s => s.id === teacher.schoolId)?.name || '-';
                                return (
                                    <tr key={teacher.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-gray-900">{teacher.name}</td>
                                        <td className="px-6 py-4 text-gray-600 font-mono text-sm">{teacher.nationalId}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs border border-blue-100">{teacher.category}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                {teacher.roles && teacher.roles.length > 0 ? (
                                                    teacher.roles.map((r, idx) => (
                                                        <span key={idx} className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md text-[10px] border border-purple-100 font-bold whitespace-nowrap">{r}</span>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-400 text-xs">معلم</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">{teacher.specialty}</td>
                                        <td className="px-6 py-4 text-sm text-gray-500">{schoolName}</td>
                                        <td className="px-6 py-4 flex justify-center items-center gap-2">
                                            {onViewHistory ? (
                                                <button 
                                                    onClick={() => onViewHistory(teacher.id)}
                                                    className="bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-200 px-3 py-1.5 rounded text-xs font-bold transition-colors flex items-center gap-1"
                                                >
                                                    <History size={14}/> سجل التقييمات
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => onEvaluate(teacher.id)}
                                                    className="text-white bg-primary-600 hover:bg-primary-700 px-3 py-1.5 rounded text-xs font-medium transition-colors"
                                                >
                                                    تقييم
                                                </button>
                                            )}
                                            
                                            <div className="relative action-menu-container">
                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setOpenMenuId(openMenuId === teacher.id ? null : teacher.id);
                                                    }}
                                                    className={`p-1 rounded-md transition-colors ${openMenuId === teacher.id ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-600'}`}
                                                >
                                                    <MoreHorizontal size={20} />
                                                </button>
                                                {openMenuId === teacher.id && (
                                                    <div className="absolute left-0 top-full mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-100 z-50 overflow-hidden animate-fade-in">
                                                        <button 
                                                            onClick={() => { setViewTeacher(teacher); setOpenMenuId(null); }} 
                                                            className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                        >
                                                            عرض التفاصيل
                                                        </button>
                                                        
                                                        {/* Restrict Edit/Delete for Evaluator */}
                                                        {userRole !== UserRole.EVALUATOR && (
                                                            <>
                                                                <button 
                                                                    onClick={() => { handleEditTeacher(teacher); setOpenMenuId(null); }} 
                                                                    className="block w-full text-right px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                                                >
                                                                    تحرير البيانات
                                                                </button>
                                                                <button 
                                                                    onClick={() => { handleDeleteTeacher(teacher.id); setOpenMenuId(null); }} 
                                                                    className="block w-full text-right px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                                                                >
                                                                    حذف
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
                )}
            </div>
            {/* ... pagination/footer ... */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
                <span>عرض {filteredTeachers.length} من أصل {teachers.length} معلم</span>
            </div>
        </div>
      )}

      {/* Add Teacher Tab */}
      {subTab === 'add' && (
         <div className="max-w-2xl mx-auto bg-white p-8 rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                {editingId ? <Edit2 size={24} className="text-primary-600"/> : <Plus size={24} className="text-primary-600"/>}
                {editingId ? 'تعديل بيانات المعلم' : 'إضافة معلم جديد'}
            </h3>
             <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-6 flex gap-3 text-sm text-blue-800">
                <Info className="shrink-0 text-blue-600" size={20} />
                <p>سيتم استخدام <strong>رقم الهوية الوطنية</strong> كاسم مستخدم لدخول المعلم للنظام. يمكن إسناد أكثر من صلاحية لنفس المعلم (مثلاً معلم ومقيم في آن واحد).</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Only show School selection if Admin OR Principal manages multiple schools */}
                 {(userRole === UserRole.ADMIN || (userRole === UserRole.PRINCIPAL && schools.length > 1)) && (
                     <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">المدرسة <span className="text-red-500">*</span></label>
                        <select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 bg-white" value={newTeacher.schoolId || ''} onChange={(e) => setNewTeacher({...newTeacher, schoolId: e.target.value})}>
                            <option value="">اختر المدرسة</option>
                            {schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
                        </select>
                     </div>
                 )}
                 {(schools.length === 1 && !newTeacher.schoolId) && (
                     <div className="md:col-span-2 bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-center gap-2">
                        <CheckCircle className="text-blue-600" size={20}/>
                        <span className="text-sm text-blue-800 font-medium">سيتم إضافة المعلم إلى: {schools[0].name}</span>
                     </div>
                 )}
                 {schools.length === 0 && (
                     <div className="md:col-span-2 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2"><XCircle className="text-red-600" size={20}/><span className="text-sm text-red-800 font-medium">عفواً، لا توجد مدارس مسجلة.</span></div>
                 )}
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل <span className="text-red-500">*</span></label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={newTeacher.name || ''} onChange={(e) => setNewTeacher({...newTeacher, name: e.target.value})} /></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">رقم الهوية الوطنية <span className="text-red-500">*</span></label><input type="text" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 font-mono text-left" dir="ltr" placeholder="10xxxxxxxx" value={newTeacher.nationalId || ''} onChange={(e) => setNewTeacher({...newTeacher, nationalId: e.target.value})} /></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">فئة المعلم</label><select className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={newTeacher.category} onChange={(e) => setNewTeacher({...newTeacher, category: e.target.value as TeacherCategory})}>{Object.values(TeacherCategory).map(cat => <option key={cat} value={cat}>{cat}</option>)}</select></div>
                 
                 {/* Role Selection (Multi-select) */}
                 <div className="md:col-span-2 bg-purple-50 p-4 rounded-xl border border-purple-100">
                     <label className="block text-sm font-bold text-purple-800 mb-2 flex items-center gap-2">
                         <Shield size={16}/> صلاحيات النظام (System Roles)
                     </label>
                     <p className="text-xs text-gray-500 mb-3">اختر الصلاحيات التي يمتلكها هذا الموظف في النظام (يمكن اختيار أكثر من واحدة).</p>
                     
                     <div className="flex flex-wrap gap-3">
                         {[UserRole.TEACHER, UserRole.EVALUATOR, UserRole.PRINCIPAL].map(role => (
                             <label key={role} className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-all ${selectedRoles.includes(role) ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-700 border-gray-300 hover:border-purple-300'}`}>
                                 <input 
                                     type="checkbox" 
                                     className="hidden"
                                     checked={selectedRoles.includes(role)}
                                     onChange={() => handleRoleToggle(role)}
                                 />
                                 {selectedRoles.includes(role) ? <CheckCircle size={16} className="text-white"/> : <span className="w-4 h-4 rounded-full border border-gray-300 bg-gray-50"></span>}
                                 <span className="text-sm font-medium">{role}</span>
                             </label>
                         ))}
                     </div>
                 </div>

                 <div><label className="block text-sm font-medium text-gray-700 mb-1">التخصص</label><input type="text" list="specialties-options" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500" value={newTeacher.specialty || ''} onChange={(e) => setNewTeacher({...newTeacher, specialty: e.target.value})} placeholder="اكتب أو اختر" /><datalist id="specialties-options">{specialtiesList.map(s => <option key={s.id} value={s.name} />)}</datalist></div>
                 <div><label className="block text-sm font-medium text-gray-700 mb-1">الجوال</label><input type="tel" className="w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-primary-500 text-left" dir="ltr" value={newTeacher.mobile || ''} onChange={(e) => setNewTeacher({...newTeacher, mobile: e.target.value})} /></div>
            </div>
            
            {/* Footer Buttons including Delete */}
            <div className="mt-8 flex flex-col-reverse sm:flex-row justify-between gap-3 pt-4 border-t border-gray-100">
                <div className="w-full sm:w-auto">
                    {editingId && (
                        <button 
                            onClick={async () => {
                                const success = await handleDeleteTeacher(editingId);
                                if (success) {
                                    setSubTab('list');
                                    setEditingId(null);
                                    setNewTeacher({ category: TeacherCategory.TEACHER });
                                    setSelectedRoles([UserRole.TEACHER]);
                                }
                            }} 
                            className="w-full sm:w-auto px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center gap-2 transition-colors"
                        >
                            <Trash2 size={18} /> حذف المعلم
                        </button>
                    )}
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto justify-end">
                    <button onClick={handleCancelEdit} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50">إلغاء</button>
                    <button onClick={handleSaveTeacher} disabled={isSaving} className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2">{isSaving && <Loader2 className="animate-spin" size={16} />}{editingId ? 'حفظ التعديلات' : 'حفظ المعلم'}</button>
                </div>
            </div>
         </div>
      )}

      {/* Import Tab */}
      {subTab === 'import' && importStep === 'upload' && (
          <div className="max-w-3xl mx-auto">
             <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><FileText size={18} /> تعليمات الاستيراد</h4>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                    <li>قم بتحميل قالب Excel المعتمد.</li>
                    <li>تأكد من صحة أرقام الهوية الوطنية.</li>
                    <li>يجب رفع الملف بصيغة <strong>Excel (.xlsx)</strong>.</li>
                </ul>
                <button onClick={handleDownloadTemplate} className="mt-3 text-sm font-bold text-blue-700 hover:underline flex items-center gap-1"><Download size={14}/> تحميل قالب Excel</button>
             </div>
             
             {/* School Selection for Import */}
             <div className="mb-6">
                 <label className="block text-sm font-medium text-gray-700 mb-2">اختر المدرسة المراد الاستيراد إليها <span className="text-red-500">*</span></label>
                 <select 
                    className="w-full border rounded-lg p-3 focus:ring-2 focus:ring-primary-500 bg-white"
                    value={importTargetSchoolId}
                    onChange={(e) => setImportTargetSchoolId(e.target.value)}
                 >
                    <option value="">-- اختر المدرسة --</option>
                    {schools.map(school => (
                        <option key={school.id} value={school.id}>{school.name}</option>
                    ))}
                 </select>
             </div>

             <div className={`bg-white p-12 rounded-xl shadow-sm border text-center border-dashed border-2 transition-colors ${!importTargetSchoolId ? 'border-gray-200 opacity-50 cursor-not-allowed' : 'border-gray-300 hover:border-primary-500'}`}>
                {isImporting ? (
                    <div className="flex flex-col items-center justify-center py-4">
                        <Loader2 size={48} className="animate-spin text-primary-600 mb-4" />
                        <h3 className="text-lg font-bold text-gray-800">جاري معالجة البيانات...</h3>
                        <p className="text-sm text-gray-500 mt-2">يرجى الانتظار، قد يستغرق هذا بضع لحظات.</p>
                    </div>
                ) : (
                    <>
                        <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                        <h3 className="text-lg font-medium text-gray-900">سحب وإفلات ملف Excel هنا</h3>
                        <p className="text-sm text-gray-500 mt-2">أو اضغط لاختيار الملف من جهازك</p>
                        
                        <input 
                            type="file" 
                            id="file-upload" 
                            className="hidden" 
                            accept=".xlsx, .xls" 
                            onChange={handleFileUpload} 
                            disabled={!importTargetSchoolId}
                        />
                        <label 
                            htmlFor="file-upload" 
                            className={`mt-4 px-6 py-2.5 rounded-lg inline-block font-medium ${!importTargetSchoolId ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700 cursor-pointer'}`}
                        >
                            {importTargetSchoolId ? 'اختر ملف Excel' : 'يرجى اختيار المدرسة أولاً'}
                        </label>
                    </>
                )}
             </div>
          </div>
      )}
      
      {subTab === 'import' && importStep === 'results' && (
           <div className="space-y-6">
              <div className="flex justify-end"><button onClick={() => setImportStep('upload')} className="text-primary-600 hover:underline text-sm font-bold">استيراد ملف آخر</button></div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-200 font-bold text-gray-700">النتائج التفصيلية</div>
                <div className="max-h-96 overflow-y-auto">
                    <table className="w-full text-right">
                        <thead className="bg-gray-50 text-gray-600 text-sm sticky top-0"><tr><th className="px-6 py-3">رقم الصف</th><th className="px-6 py-3">الهوية</th><th className="px-6 py-3">الاسم</th><th className="px-6 py-3">الحالة</th></tr></thead>
                        <tbody className="divide-y divide-gray-100">{importResults.map((result, idx) => (<tr key={idx} className={result.status === 'failed' ? 'bg-red-50' : ''}><td className="px-6 py-3">{result.row}</td><td className="px-6 py-3 font-mono">{result.nationalId}</td><td className="px-6 py-3">{result.name}</td><td className="px-6 py-3">{result.status === 'success' ? <span className="flex items-center gap-1 text-green-600 font-medium text-xs"><CheckCircle size={14} /> ناجح</span> : <span className="text-red-500 text-xs">{result.message}</span>}</td></tr>))}</tbody>
                    </table>
                </div>
             </div>
           </div>
      )}

      {subTab === 'specialties' && (
          <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-bold text-gray-700">قائمة التخصصات المعتمدة</h3>
                  <div className="flex gap-2">
                      <input type="text" className="border rounded-lg px-3 py-2 text-sm w-64 focus:ring-2 focus:ring-primary-500 outline-none" placeholder="أدخل اسم التخصص الجديد..." value={newSpecialty} onChange={(e) => setNewSpecialty(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddSpecialty()} />
                      <button onClick={handleAddSpecialty} className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 flex items-center gap-2"><Plus size={18} /> إضافة</button>
                  </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {specialtiesList.map(spec => (
                      <div key={spec.id} className="group flex justify-between items-center bg-gray-50 border border-gray-200 px-3 py-2 rounded-lg hover:bg-white hover:shadow-sm transition-all">
                          <span className="text-sm text-gray-700">{spec.name}</span>
                          <button onClick={() => handleDeleteSpecialty(spec.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 size={14} /></button>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
}
