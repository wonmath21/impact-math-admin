/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

// ╔══════════════════════════════════════════════════════════════════╗
// ║         임팩트수학학원 통합 관리 시스템 (v3.0 Final Stable)            ║
// ║  - 동시성 완벽 제어 (Atomic 다중 업데이트 및 점 표기법 적용)           ║
// ║  - 배열 -> 객체(Map) 자동 마이그레이션 및 정렬 보장 완료               ║
// ║  - Firebase Auth 연동 및 백업 데이터 구조 정규화 완료                  ║
// ╚══════════════════════════════════════════════════════════════════╝

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Users, BookOpen, Calendar, Plus, Trash2, Edit2, Check, X, AlertCircle, Sparkles, Copy, Loader2, FileText, Download, Settings, ArrowUp, ArrowDown, ArrowUpDown, RefreshCcw, LogOut, Lock, UserCog, ClipboardList, Eye, Upload } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, setDoc, getDoc, updateDoc, deleteField } from 'firebase/firestore';

// ================================================================
// SECTION 1 : Firebase 설정 + 공통 상수 + 유틸 함수
// ================================================================
let firebaseConfig;
const userActualConfig = {
  apiKey: "AIzaSyBe6DBEXLKAgYYFLLzYoU6qmrOOZifNcEA",
  authDomain: "weekly-test-a0afd.firebaseapp.com",
  projectId: "weekly-test-a0afd",
  storageBucket: "weekly-test-a0afd.firebasestorage.app",
  messagingSenderId: "88104324183",
  appId: "1:88104324183:web:03f2c6bfd53de3c73b2712"
};

if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
} else {
  firebaseConfig = userActualConfig;
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
// 🚨 DB 초기화 로직 변경: 오프라인 영속성 및 다중 탭 동기화 활성화
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});
const appId = typeof __app_id !== 'undefined' ? __app_id : 'impact-math-admin-app';

const DAYS = [
  { val: 1, label: '월' }, { val: 2, label: '화' }, { val: 3, label: '수' },
  { val: 4, label: '목' }, { val: 5, label: '금' }, { val: 6, label: '토' }, { val: 0, label: '일' }
];

const CLASS_COLORS = [
  { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  { bg: 'bg-violet-50', text: 'text-violet-800', border: 'border-violet-200' },
  { bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200' },
  { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
  { bg: 'bg-cyan-50', text: 'text-cyan-800', border: 'border-cyan-200' },
];

const DEFAULT_TEMPLATE = `안녕하세요. 임팩트수학학원 [학생이름]학생 담임입니다.\n\n주간 테스트 결과 및 성취도 안내드립니다.\n[테스트결과목록]\n과제물 성취도 : 평균 [과제성취도]%\n주간 진도 : [주간진도]\n\n비고 : [비고]`;
const DEFAULT_TEST_ITEM_TEMPLATE = `테스트 과정 : [단원명]\n테스트 결과 : [맞은개수]/[총문제수] [통과여부]\n반 평균 : [반평균]`;
const DEFAULT_NO_TEST_MSG = `이번 주 진행된 테스트가 없습니다.`;

// [공통 유틸리티] 객체-배열 변환 (정렬 보장형 단일 진실 공급원)
const toArray = (data) => {
  if (Array.isArray(data)) return data;
  return Object.values(data || {}).sort((a, b) => {
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });
};

const toMap = (arr) => Array.isArray(arr) 
  ? arr.reduce((acc, curr) => ({...acc, [curr.id]: curr}), {}) 
  : (arr || {});

const getThisWeekMonSat = () => {
  const now = new Date();
  const day = now.getDay();
  const diffToMon = now.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(now.setDate(diffToMon));
  const sat = new Date(mon);
  sat.setDate(mon.getDate() + 5);

  const format = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { start: format(mon), end: format(sat) };
};

const getLastWeekMonSat = () => {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysFromThisMon = (dayOfWeek + 6) % 7; 

  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - daysFromThisMon);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const lastSaturday = new Date(lastMonday);
  lastSaturday.setDate(lastMonday.getDate() + 5);

  const format = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  };
  return { start: format(lastMonday), end: format(lastSaturday) };
};

const weekDatesInit = getThisWeekMonSat();
const lastWeekDatesInit = getLastWeekMonSat();

const getDayName = (dateStr) => {
  if(!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  const dayIndex = new Date(y, m - 1, d).getDay();
  return DAYS.find(x => x.val === dayIndex)?.label || '';
};

const getTodayLocal = () => {
  const offset = new Date().getTimezoneOffset() * 60000;
  const dateOffset = new Date(Date.now() - offset);
  return dateOffset.toISOString().split("T")[0];
};

const formatShortDate = (dateStr) => {
  if(!dateStr) return '';
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}월 ${Number(d)}일 (${getDayName(dateStr)})`;
};

const getSchoolColor = (schoolName) => {
  if (!schoolName) return 'bg-gray-50 text-gray-700 border-gray-200';
  const colors = ['bg-pink-50 text-pink-700 border-pink-200', 'bg-indigo-50 text-indigo-700 border-indigo-200', 'bg-teal-50 text-teal-700 border-teal-200', 'bg-orange-50 text-orange-700 border-orange-200', 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'];
  let hash = 0;
  for (let i = 0; i < schoolName.length; i++) hash += schoolName.charCodeAt(i);
  return colors[hash % colors.length];
};

const AutoResizeTextarea = ({ value, onChange, placeholder, className, disabled }) => {
  const textareaRef = useRef(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);
  return (
    <textarea ref={textareaRef} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled} className={`resize-none overflow-hidden ${className}`} rows={1} />
  );
};

// ================================================================
// SECTION 2 : 로그인 화면 컴포넌트
// ================================================================
function LoginScreen({ onLogin, error }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-100 p-4 rounded-full"><BookOpen className="text-blue-600" size={32} /></div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-800 mb-8">임팩트 수학학원<br/><span className="text-blue-600">통합 관리 시스템</span></h1>
        
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1">아이디</label><input type="text" value={id} onChange={e=>setId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label><input type="password" value={pw} onChange={e=>setPw(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none" onKeyDown={(e) => e.key === 'Enter' && onLogin(id, pw)} /></div>
          <button onClick={() => onLogin(id, pw)} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-md mt-4">시스템 접속</button>
          {error && <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm font-bold rounded text-center">{error}</div>}
        </div>
        <div className="mt-8 bg-gray-50 p-4 rounded-lg border border-gray-200 text-xs text-gray-500">
          <p className="text-sm font-bold text-gray-700 mb-2">접속 안내</p>
          <ul className="text-xs text-gray-600 space-y-2">
            <li>• <strong className="text-blue-600">강사 계정은 관리자에게 아이디와 비밀번호를 부여받아야 접속할 수 있습니다.</strong></li>
            <li>• 관리자 및 행정팀은 지정된 전용 계정으로 로그인해 주십시오.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// ================================================================
// SECTION 3 : 최상위 App 컴포넌트 + Firebase Auth 로직
// ================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem('userRole') || null); 
  const [teacherId, setTeacherId] = useState(() => localStorage.getItem('teacherId') || null);
  const [loginError, setLoginError] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const email = currentUser.email || '';
        
        if (email === 'admin@impact.math') {
          setRole('admin'); localStorage.setItem('userRole', 'admin');
        } else if (email === 'office@impact.math') {
          setRole('office'); localStorage.setItem('userRole', 'office');
        } else {
          try {
            const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
              const rawInstructors = docSnap.data().instructors || {};
              const instArray = toArray(rawInstructors);
              const extractedId = email.split('@')[0]; 
              const matched = instArray.find(inst => inst.username === extractedId);
              
              if (matched) {
                setRole('teacher'); setTeacherId(matched.id);
                localStorage.setItem('userRole', 'teacher'); localStorage.setItem('teacherId', matched.id);
              } else {
                setLoginError('등록되지 않은 강사 계정입니다.');
                await signOut(auth);
                setRole(null);
              }
            }
          } catch(e) {
            setLoginError('강사 정보 연결 중 오류가 발생했습니다.');
          }
        }
      } else {
        setUser(null); setRole(null); setTeacherId(null);
        localStorage.removeItem('userRole'); localStorage.removeItem('teacherId');
      }
      setIsAuthChecking(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (id, pw) => {
    setLoginError('');
    try {
      const email = id.includes('@') ? id : `${id}@impact.math`;
      await signInWithEmailAndPassword(auth, email, pw);
    } catch(e) {
      if (e.code === 'auth/invalid-credential' || e.code === 'auth/user-not-found' || e.code === 'auth/wrong-password') {
        setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
      } else {
        setLoginError(`로그인 오류 (${e.code})`);
      }
    }
  };

  if (isAuthChecking) return <div className="min-h-screen flex items-center justify-center bg-gray-100"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;
  if (!role || !user) return <LoginScreen onLogin={handleLogin} error={loginError} />;
  
  return <MainApp role={role} user={user} setRole={setRole} teacherId={teacherId} />;
}

// ================================================================
// SECTION 4 : MainApp - 전체 State(상태) 선언부
// ================================================================
function MainApp({ role, user, setRole, teacherId }) {
  const isReadOnly = role === 'office';
  const [isLoaded, setIsLoaded] = useState(false);

  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem(`activeTab_${role}`);
    const validTabs = ['daily', 'tests', 'students', 'classes', 'report'];
    if (role === 'admin') validTabs.push('instructors');
    if (!isReadOnly) validTabs.push('settings');
    return (saved && validTabs.includes(saved)) ? saved : 'daily';
  });

  useEffect(() => {
    localStorage.setItem(`activeTab_${role}`, activeTab);
  }, [activeTab, role]);
  
  const loadData = (key, defaultData) => {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0) || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
      return defaultData;
    }
    return parsed;
  };

  const [instructors, setInstructors] = useState(() => loadData('instructors', []));
  const [classes, setClasses] = useState(() => loadData('classes', []));
  const [students, setStudents] = useState(() => loadData('students', []));
  const [records, setRecords] = useState(() => loadData('records', {}));
  const [testRecords, setTestRecords] = useState(() => loadData('testRecords', {}));
  const [individualTestRecords, setIndividualTestRecords] = useState(() => loadData('individualTestRecords', {}));

  const [reportRemarks, setReportRemarks] = useState({});
  const [excludeFromReport, setExcludeFromReport] = useState(() => loadData('excludeFromReport', {})); 
  const [classWeeklyProgress, setClassWeeklyProgress] = useState({});
  const [individualWeeklyProgress, setIndividualWeeklyProgress] = useState({});
  const [systemSettings, setSystemSettings] = useState(() => loadData('systemSettings', { title: '임팩트 수학학원', iconUrl: '' }));
  const [filterInstructor, setFilterInstructor] = useState('');

  const [offlineTemplate, setOfflineTemplate] = useState(DEFAULT_TEMPLATE);
  const [testItemTemplate, setTestItemTemplate] = useState(DEFAULT_TEST_ITEM_TEMPLATE);
  const [noTestMessage, setNoTestMessage] = useState(DEFAULT_NO_TEST_MSG);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [testClassId, setTestClassId] = useState('c1');
  const [testErrors, setTestErrors] = useState({}); 
  const [reportStartDate, setReportStartDate] = useState(lastWeekDatesInit.start);
  const [reportEndDate, setReportEndDate] = useState(lastWeekDatesInit.end);
  const [reportClassId, setReportClassId] = useState('c1');
  
  const [viewMode, setViewMode] = useState('daily');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  const [toast, setToast] = useState(null);
  const [classToDelete, setClassToDelete] = useState(null);
  const [classDeleteWarning, setClassDeleteWarning] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [testToDelete, setTestToDelete] = useState(null);

  const [selectedIndivStudent, setSelectedIndivStudent] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editStudentData, setEditStudentData] = useState({ name: '', school: '', classId: '' });

  const [copiedId, setCopiedId] = useState(null);

  const [customReports, setCustomReports] = useState({});
  const [editingReportId, setEditingReportId] = useState(null);
  const [editReportText, setEditReportText] = useState('');

  const syncQueueRef = useRef({});
  const syncTimerRef = useRef(null);
  const [syncState, setSyncState] = useState({ pending: 0, failed: 0 });

  const handleTabChange = (targetTabId) => {
    if (syncState.pending > 0) return showToast('데이터를 서버에 동기화 중입니다. 잠시 후 이동해주세요.', 'error');
    if (syncState.failed > 0) return showToast('동기화에 실패한 데이터가 있습니다. 네트워크를 확인하세요.', 'error');
    setActiveTab(targetTabId);
  };

  const queueUpdate = (path, value) => {
    syncQueueRef.current[path] = value;
    setSyncState(prev => ({ pending: Object.keys(syncQueueRef.current).length, failed: prev.failed }));
    
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    
    syncTimerRef.current = setTimeout(async () => {
      const payload = { ...syncQueueRef.current };
      if (Object.keys(payload).length === 0) return;
      
      syncQueueRef.current = {}; 
      
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
        await updateDoc(docRef, payload);
        setSyncState({ pending: 0, failed: 0 });
      } catch (error) {
        console.error("큐 동기화 실패:", error);
        syncQueueRef.current = { ...payload, ...syncQueueRef.current };
        setSyncState(prev => ({ pending: Object.keys(syncQueueRef.current).length, failed: prev.failed + 1 }));
      }
    }, 1500); 
  };

  const showToast = (message, type = 'success') => { 
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); 
  };

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // 대기열에 처리되지 않은 데이터가 1건이라도 있으면 경고창 트리거
      if (syncState.pending > 0) {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [syncState.pending]);

  // ================================================================
  // SECTION 5 : Firebase 동기화 로직 (마이그레이션 및 부분 업데이트)
  // ================================================================
  const initialDataSnapshot = useRef({});

  useEffect(() => {
    let isMounted = true;
    const fetchDb = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        
        if (docSnap.exists()) {
          const d = docSnap.data();
          initialDataSnapshot.current = JSON.parse(JSON.stringify(d));

          setInstructors(toArray(d.instructors));
          setClasses(toArray(d.classes));
          setStudents(toArray(d.students));

          if (!isReadOnly && (Array.isArray(d.instructors) || Array.isArray(d.classes) || Array.isArray(d.students))) {
             updateDoc(docRef, {
               instructors: toMap(d.instructors),
               classes: toMap(d.classes),
               students: toMap(d.students)
             }).catch(e => console.error("자동 변환 에러:", e));
          }

          if(d.records) setRecords(d.records);
          if(d.testRecords) setTestRecords(d.testRecords);
          if(d.individualTestRecords) setIndividualTestRecords(d.individualTestRecords);
          if(d.classWeeklyProgress) setClassWeeklyProgress(d.classWeeklyProgress);
          if(d.individualWeeklyProgress) setIndividualWeeklyProgress(d.individualWeeklyProgress);
          if(d.reportRemarks) setReportRemarks(d.reportRemarks);
          if(d.excludeFromReport) setExcludeFromReport(d.excludeFromReport);
          if(d.offlineTemplate) setOfflineTemplate(d.offlineTemplate);
          if(d.testItemTemplate) setTestItemTemplate(d.testItemTemplate);
          if(d.noTestMessage) setNoTestMessage(d.noTestMessage);
          if(d.systemSettings) setSystemSettings(d.systemSettings);
        }
      } catch (e) {
        console.error("DB Fetch Error:", e);
      } finally {
        if (isMounted) setIsLoaded(true); 
      }
    };
    fetchDb();
    return () => { isMounted = false; };
  }, [isReadOnly]); 

  // 통째 덮어쓰기 로직 (설정 등 동시성 이슈가 없는 항목 전용)
  const syncData = async (key, value) => {
    if (!isLoaded || isReadOnly) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
    try {
      await updateDoc(docRef, { [key]: value });
    } catch (error) {
      if (error.code === 'not-found') await setDoc(docRef, { [key]: value });
    }
  };

  // 부분 업데이트 로직 (다중 객체 원자적 업데이트 지원)
  const updatePartialData = async (updatesObj) => {
    if (isReadOnly || !isLoaded) return;
    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
    
    // UI 인디케이터 활성화
    setSyncState(prev => ({ ...prev, pending: prev.pending + 1 })); 
    try {
      await updateDoc(docRef, updatesObj);
      setSyncState(prev => ({ ...prev, pending: Math.max(0, prev.pending - 1) }));
    } catch (error) {
      console.error("부분 업데이트 실패:", error);
      showToast('⚠️ 서버 저장 실패! 네트워크를 확인하세요.', 'error');
      // 실패 상태로 전환하여 사용자에게 명확히 인지시킴
      setSyncState(prev => ({ pending: Math.max(0, prev.pending - 1), failed: prev.failed + 1 })); 
    }
  };

  // 오직 동시성 위험이 없는 설정 데이터만 syncData로 동기화합니다.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncData('excludeFromReport', excludeFromReport); }, [excludeFromReport]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncData('offlineTemplate', offlineTemplate); }, [offlineTemplate]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncData('testItemTemplate', testItemTemplate); }, [testItemTemplate]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncData('noTestMessage', noTestMessage); }, [noTestMessage]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { syncData('systemSettings', systemSettings); }, [systemSettings]);

  // ================================================================
  // SECTION 6 : 백업 / 복구 함수들
  // ================================================================
  const handleExportAllDataToJSON = () => {
    const allData = { 
      instructors: toMap(instructors), 
      classes: toMap(classes), 
      students: toMap(students), 
      records, 
      testRecords, 
      individualTestRecords, 
      classWeeklyProgress, 
      individualWeeklyProgress, 
      reportRemarks, 
      excludeFromReport, 
      offlineTemplate, 
      testItemTemplate, 
      noTestMessage, 
      systemSettings 
    };
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const offset = new Date().getTimezoneOffset() * 60000;
    const dateOffset = new Date(Date.now() - offset);
    const todayLocal = dateOffset.toISOString().split("T")[0];
    const timeLocal = dateOffset.toISOString().split("T")[1].replace(/:/g, '').substring(0, 6);
    
    link.download = `학원데이터_백업_${todayLocal}_${timeLocal}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('전체 데이터 백업 파일이 PC에 다운로드되었습니다.');
  };

  const handleImportFromJSON = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = JSON.parse(evt.target.result);

        if (!window.confirm(
          `📂 "${file.name}" 파일로 복구합니다.\n\n⚠️ 현재 서버의 모든 데이터가 이 파일로 덮어씌워집니다.\n정말 진행하시겠습니까?`
        )) return;

        if (data.instructors) setInstructors(toArray(data.instructors));
        if (data.classes) setClasses(toArray(data.classes));
        if (data.students) setStudents(toArray(data.students));
        
        if (data.records) setRecords(data.records);
        if (data.testRecords) setTestRecords(data.testRecords);
        if (data.individualTestRecords) setIndividualTestRecords(data.individualTestRecords);
        if (data.classWeeklyProgress) setClassWeeklyProgress(data.classWeeklyProgress);
        if (data.individualWeeklyProgress) setIndividualWeeklyProgress(data.individualWeeklyProgress);
        if (data.reportRemarks) setReportRemarks(data.reportRemarks);
        if (data.excludeFromReport) setExcludeFromReport(data.excludeFromReport);
        if (data.offlineTemplate) setOfflineTemplate(data.offlineTemplate);
        if (data.testItemTemplate) setTestItemTemplate(data.testItemTemplate);
        if (data.noTestMessage) setNoTestMessage(data.noTestMessage);
        if (data.systemSettings) setSystemSettings(data.systemSettings);

        const normalizedData = {
          ...data,
          instructors: toMap(data.instructors),
          classes: toMap(data.classes),
          students: toMap(data.students)
        };

        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
        await setDoc(docRef, normalizedData);
        initialDataSnapshot.current = JSON.parse(JSON.stringify(normalizedData));
        showToast('✅ 백업 데이터가 성공적으로 정규화 및 복구되었습니다!');
      } catch (err) {
        showToast('❌ JSON 파일 형식이 올바르지 않습니다.', 'error');
        console.error(err);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const [isDriveSyncing, setIsDriveSyncing] = useState(false);
  const handleBackupToGoogleDrive = async () => {
    setIsDriveSyncing(true);
    const allData = { 
      instructors: toMap(instructors), 
      classes: toMap(classes), 
      students: toMap(students), 
      records, 
      testRecords, 
      individualTestRecords, 
      classWeeklyProgress, 
      individualWeeklyProgress, 
      reportRemarks, 
      excludeFromReport, 
      offlineTemplate, 
      testItemTemplate, 
      noTestMessage, 
      systemSettings 
    };
    const googleScriptUrl = "https://script.google.com/macros/s/AKfycbyWkX3PJ-7IXIu7zAmd1TaUGqS32jHqhQfEqmrp3P8txkqUARXr6EDfsR0CL8-9S3c3/exec"; 

    try {
      const response = await fetch(googleScriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(allData)
      });
      const result = await response.json();
      if (result.status === "success") {
        showToast('구글 드라이브에 안전하게 백업되었습니다!');
      } else {
        showToast('드라이브 백업 중 오류가 발생했습니다.', 'error');
      }
    } catch (error) {
      showToast('네트워크 오류로 백업에 실패했습니다.', 'error');
      console.error(error);
    } finally {
      setIsDriveSyncing(false);
    }
  };
  
  useEffect(() => {
    document.title = systemSettings.title || '임팩트 수학학원';
    if (systemSettings.iconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = systemSettings.iconUrl;
    }
  }, [systemSettings]);

  // ================================================================
  // SECTION 7 : 강사 관리 함수들
  // ================================================================
  const visibleClasses = useMemo(() => 
    role === 'teacher' ? classes.filter(c => c.instructorId === teacherId) : classes, 
    [role, classes, teacherId]
  );
  const visibleStudents = useMemo(() => 
    role === 'teacher' ? students.filter(s => visibleClasses.some(c => c.id === s.classId)) : students, 
    [role, students, visibleClasses]
  );
  const [newInstName, setNewInstName] = useState('');
  const [newInstId, setNewInstId] = useState('');

  const [editingInstId, setEditingInstId] = useState(null);
  const [editInstData, setEditInstData] = useState({ name: '' });

  const startEditingInst = (inst) => {
    setEditingInstId(inst.id);
    setEditInstData({ name: inst.name });
  };

  const saveEditedInst = () => {
    if (!editInstData.name) return showToast('이름을 입력하세요.', 'error');
    const updatedInst = { ...instructors.find(i => i.id === editingInstId), ...editInstData };
    
    setInstructors(instructors.map(i => i.id === editingInstId ? updatedInst : i));
    updatePartialData({ [`instructors.${editingInstId}`]: updatedInst });

    setEditingInstId(null);
    showToast('강사 정보가 수정되었습니다.');
  };

  const handleAddInstructor = () => {
    if (!newInstName || !newInstId) return showToast('강사 정보를 모두 입력하세요.', 'error');
    const newId = 'inst_' + Date.now();
    const newInst = { id: newId, name: newInstName, username: newInstId };

    setInstructors([...instructors, newInst]);
    updatePartialData({ [`instructors.${newId}`]: newInst });

    setNewInstName(''); setNewInstId(''); 
    showToast('신규 강사가 생성되었습니다.');
  };

  const handleDeleteInstructor = (id) => {
    if (classes.some(c => c.instructorId === id)) {
      showToast('이 강사에게 배정된 반이 있습니다. 반을 먼저 변경/삭제하세요.', 'error');
      return;
    }
    if (window.confirm('정말 이 강사 계정을 삭제하시겠습니까?')) {
      setInstructors(instructors.filter(i => i.id !== id));
      updatePartialData({ [`instructors.${id}`]: deleteField() });
      showToast('강사 계정이 삭제되었습니다.', 'success');
    }
  };

  // ================================================================
  // SECTION 8 : 반(Class) 관리 함수들
  // ================================================================
  const [newClassName, setNewClassName] = useState('');
  const [newClassDays, setNewClassDays] = useState([]);
  const [newClassInstructor, setNewClassInstructor] = useState(''); 
  const [newClassType, setNewClassType] = useState('lecture'); 

  const handleAddClass = () => {
    if (isReadOnly) return;
    if (!newClassName.trim() || newClassDays.length === 0) return showToast('반 이름과 요일을 입력하세요.', 'error');
    const assignedInst = role === 'admin' ? newClassInstructor : teacherId;
    if (!assignedInst) return showToast('담당 강사를 지정해주세요.', 'error');

    const newId = Date.now().toString();
    const newClass = { id: newId, name: newClassName, days: newClassDays, instructorId: assignedInst, type: newClassType };

    setClasses([...classes, newClass]);
    updatePartialData({ [`classes.${newId}`]: newClass });

    setNewClassName(''); setNewClassDays([]); setNewClassType('lecture');
    showToast('신규 반이 생성되었습니다.');
  };

  const handleDeleteClass = (id) => {
    if (isReadOnly) return;
    if (students.some(s => s.classId === id)) { 
      setClassDeleteWarning(true); 
      return; 
    }
    setClassToDelete(id);
  };

  const confirmDeleteClass = () => {
    if (classToDelete && !isReadOnly) {
      setClasses(classes.filter(c => c.id !== classToDelete));
      updatePartialData({ [`classes.${classToDelete}`]: deleteField() });
      setClassToDelete(null);
      showToast('반이 정상적으로 삭제되었습니다.');
    }
  };

  const toggleDaySelection = (val) => {
    if (isReadOnly) return;
    setNewClassDays(prev => prev.includes(val) ? prev.filter(d => d !== val) : [...prev, val]);
  };

  const [editingClassId, setEditingClassId] = useState(null);
  const [editClassData, setEditClassData] = useState({ name: '', days: [], instructorId: '' });

  const startEditingClass = (cls) => {
    setEditingClassId(cls.id);
    setEditClassData({ name: cls.name, days: [...cls.days], instructorId: cls.instructorId });
  };

  const saveEditedClass = () => {
    if (!editClassData.name.trim() || editClassData.days.length === 0) return showToast('반 이름과 요일을 확인해주세요.', 'error');
    const updatedClass = { ...classes.find(c => c.id === editingClassId), ...editClassData };

    setClasses(classes.map(c => c.id === editingClassId ? updatedClass : c));
    updatePartialData({ [`classes.${editingClassId}`]: updatedClass });

    setEditingClassId(null);
    showToast('반 정보가 수정되었습니다.');
  };

  // ================================================================
  // SECTION 9 : 학생 관리 함수들
  // ================================================================
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');

  const handleAddStudent = () => {
    if (isReadOnly) return;
    if (!newStudentName.trim() || !newStudentClass) return showToast('정보를 모두 입력해주세요.', 'error');
    
    const newId = Date.now().toString();
    const newStudent = { id: newId, name: newStudentName, school: newStudentSchool, classId: newStudentClass };

    setStudents([...students, newStudent]);
    updatePartialData({ [`students.${newId}`]: newStudent });

    setNewStudentName(''); setNewStudentSchool('');
    showToast('학생이 등록되었습니다.');
  };

  const startEditingStudent = (student) => {
    setEditingStudentId(student.id);
    setEditStudentData({ name: student.name, school: student.school, classId: student.classId });
  };

  const saveEditedStudent = () => {
    const updatedStudent = { ...students.find(s => s.id === editingStudentId), ...editStudentData };
    
    setStudents(students.map(s => s.id === editingStudentId ? updatedStudent : s));
    updatePartialData({ [`students.${editingStudentId}`]: updatedStudent });

    setEditingStudentId(null);
    showToast('학생 정보가 수정되었습니다.');
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete && !isReadOnly) {
      setStudents(students.filter(s => s.id !== studentToDelete));
      updatePartialData({ [`students.${studentToDelete}`]: deleteField() });
      setStudentToDelete(null);
      showToast('학생이 삭제되었습니다.');
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const getSortedStudentsForManagement = () => {
    let filtered = [...visibleStudents];
    if ((role === 'admin' || role === 'office') && filterInstructor) {
      filtered = filtered.filter(s => {
        const cls = classes.find(c => c.id === s.classId);
        return cls && cls.instructorId === filterInstructor;
      });
    }
    return filtered.sort((a, b) => {
      let aVal = a[sortConfig.key]; let bVal = b[sortConfig.key];
      if (sortConfig.key === 'classId') {
        aVal = classes.find(c => c.id === a.classId)?.name || ''; bVal = classes.find(c => c.id === b.classId)?.name || '';
      }
      if (sortConfig.key === 'instructorId') {
        const aInst = classes.find(c => c.id === a.classId)?.instructorId || '';
        const bInst = classes.find(c => c.id === b.classId)?.instructorId || '';
        aVal = instructors.find(i => i.id === aInst)?.name || '';
        bVal = instructors.find(i => i.id === bInst)?.name || '';
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // ================================================================
  // SECTION 10 : 일일 출결 / 과제 함수들 
  // ================================================================
  const getWeekDays = (dateString) => {
    if (!dateString) return [];
    const [y, m, d] = dateString.split('-');
    const date = new Date(y, m - 1, d);
    const day = date.getDay(); 
    const diffToMonday = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(y, m - 1, diffToMonday);
    
    const weekDays = [];
    for (let i = 0; i < 6; i++) { 
      const currentDay = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const year = currentDay.getFullYear();
      const month = String(currentDay.getMonth() + 1).padStart(2, '0');
      const dayOfMonth = String(currentDay.getDate()).padStart(2, '0');
      weekDays.push(`${year}-${month}-${dayOfMonth}`);
    }
    return weekDays;
  };

  const getLocalDayOfWeek = (dateString) => {
    if (!dateString) return 0;
    const [y, m, d] = dateString.split('-');
    return new Date(y, m - 1, d).getDay();
  };

  const selectedDayOfWeek = getLocalDayOfWeek(selectedDate);
  const targetClasses = useMemo(() => 
    visibleClasses.filter(c => c.days.includes(selectedDayOfWeek)), 
    [visibleClasses, selectedDayOfWeek]
  );

  useEffect(() => {
    if (isReadOnly || !isLoaded) return;
    setRecords(prev => {
      let updated = false;
      let next = { ...prev };

      const ensureRecord = (date, stId) => {
        if (!next[date]) {
          next[date] = {};
          updated = true;
        }
        if (!next[date][stId]) {
          next[date] = { ...next[date], [stId]: { progress: 100, remark: '' } };
          updated = true;
        }
      };

      if (viewMode === 'daily') {
        targetClasses.forEach(c => visibleStudents.filter(s => s.classId === c.id).forEach(s => ensureRecord(selectedDate, s.id)));
      } else {
        const wDates = getWeekDays(selectedDate);
        visibleClasses.forEach(c => {
          const classDays = wDates.filter(d => c.days.includes(getLocalDayOfWeek(d)));
          visibleStudents.filter(s => s.classId === c.id).forEach(s => classDays.forEach(d => ensureRecord(d, s.id)));
        });
      }
      return updated ? next : prev;
    });
  }, [isLoaded, selectedDate, viewMode, targetClasses, visibleClasses, visibleStudents, isReadOnly]);

  const handleSpecificDateRecordChange = (dateStr, studentId, field, value) => {
    if (isReadOnly) return;
    setRecords(prev => {
      const dateRecords = prev[dateStr] || {};
      const studentRecord = dateRecords[studentId] || { progress: 100, remark: '' };
      return { 
        ...prev, 
        [dateStr]: { 
          ...dateRecords, 
          [studentId]: { ...studentRecord, [field]: value } 
        } 
      };
    });
    // DB 직접 쓰기 대신 큐에 위임
    queueUpdate(`records.${dateStr}.${studentId}.${field}`, value);
  };

  const handleRecordChange = (studentId, field, value) => {
    handleSpecificDateRecordChange(selectedDate, studentId, field, value);
  };

  const handleQuickRemark = (dateStr, studentId, type) => {
    if (isReadOnly) return;

    // 1. 현재 렌더링된 상태를 기준으로 연산 (setState 외부에서 처리)
    const currentRecord = (records[dateStr] || {})[studentId] || { progress: 100, remark: '' };
    let newRemark = currentRecord.remark || '';
    let newProgress = currentRecord.progress ?? 100;

    if (type === '결석') {
      newRemark = newRemark.replace(/지각/g, '').trim();
      if (newRemark.includes('결석')) {
        newRemark = newRemark.replace(/결석/g, '').replace(/\s+/g, ' ').trim();
        newProgress = 100;
      } else {
        newRemark = (newRemark + ' 결석').trim();
        newProgress = null;
      }
    } else if (type === '지각') {
      newRemark = newRemark.replace(/결석/g, '').trim();
      if (newRemark.includes('지각')) {
        newRemark = newRemark.replace(/지각/g, '').replace(/\s+/g, ' ').trim();
      } else {
        newRemark = (newRemark + ' 지각').trim();
        if (newProgress === null) newProgress = 100;
      }
    }

    // 2. 값에 변화가 있을 때만 React 상태와 Queue 업데이트를 각각 독립적으로 실행
    if (currentRecord.remark !== newRemark || currentRecord.progress !== newProgress) {
      queueUpdate(`records.${dateStr}.${studentId}.remark`, newRemark);
      queueUpdate(`records.${dateStr}.${studentId}.progress`, newProgress);
      
      setRecords(prev => ({
        ...prev,
        [dateStr]: {
          ...(prev[dateStr] || {}),
          [studentId]: { ...currentRecord, remark: newRemark, progress: newProgress }
        }
      }));
    }
  };

  const importPreviousRemark = (studentId, currentDate) => {
    const sortedDates = Object.keys(records).sort((a, b) => b.localeCompare(a));
    const prevDate = sortedDates.find(d => d < currentDate && records[d][studentId]?.remark?.trim());
    if (prevDate) {
      handleSpecificDateRecordChange(currentDate, studentId, 'remark', records[prevDate][studentId].remark);
      showToast(`이전(${prevDate}) 특이사항을 불러왔습니다.`);
    } else {
      showToast('이전 특이사항 기록이 없습니다.', 'error');
    }
  };

  
  // ================================================================
  // SECTION 11 : 주간 테스트 함수들 
  // ================================================================
  const handleAddLectureTestRow = () => {
    if (isReadOnly || !testClassId) return;
    const newId = 'test_' + Date.now();
    const newTestObj = { id: newId, classId: testClassId, date: getTodayLocal(), subject: '', totalQ: '', scores: {} };
    
    setTestRecords(prev => ({ ...prev, [newId]: newTestObj }));
    updatePartialData({ [`testRecords.${newId}`]: newTestObj }); 
  };

  const handleLectureTestChange = (testId, field, value) => {
    if (isReadOnly) return;
    
    setTestRecords(prev => ({ ...prev, [testId]: { ...prev[testId], [field]: value } }));
    updatePartialData({ [`testRecords.${testId}.${field}`]: value }); 
  };

  const handleDeleteTestRow = (testId) => {
    if (isReadOnly) return;
    setTestToDelete({ id: testId, type: 'lecture' });
  };

  const confirmDeleteTest = () => {
    if (testToDelete && !isReadOnly) {
      if (testToDelete.type === 'lecture') {
        setTestRecords(prev => { const copy = { ...prev }; delete copy[testToDelete.id]; return copy; });
        updatePartialData({ [`testRecords.${testToDelete.id}`]: deleteField() }); 
      } else {
        setIndividualTestRecords(prev => { const copy = { ...prev }; delete copy[testToDelete.id]; return copy; });
        updatePartialData({ [`individualTestRecords.${testToDelete.id}`]: deleteField() }); 
      }
      setTestToDelete(null);
      showToast('테스트 기록이 삭제되었습니다.');
    }
  };

  const handleLectureScoreChange = (testId, studentId, field, value) => {
    if (isReadOnly) return;
    const numericValue = value === '' ? '' : Number(value);
    const testData = testRecords[testId];
    const totalQ = Number(testData.totalQ);

    let finalValueToSave = numericValue;
    let shouldClearRetest = false;

    setTestRecords(prev => {
      const prevScores = prev[testId].scores[studentId] || {score: '', retest: ''};
      let newScores = { ...prevScores, [field]: numericValue };

      if (numericValue !== '' && totalQ > 0 && numericValue > totalQ) {
        const errorKey = `${testId}_${studentId}_${field}`;
        setTestErrors(e => ({ ...e, [errorKey]: true }));
        setTimeout(() => setTestErrors(e => ({ ...e, [errorKey]: false })), 2500);
        newScores[field] = ''; 
        finalValueToSave = ''; 
      } else if (field === 'score' && numericValue !== '' && totalQ > 0) {
        if (numericValue / totalQ >= 0.8) {
          newScores.retest = ''; 
          shouldClearRetest = true; 
        }
      }
      return { ...prev, [testId]: { ...prev[testId], scores: { ...prev[testId].scores, [studentId]: newScores } } };
    });

    const basePath = `testRecords.${testId}.scores.${studentId}`;
    const updates = { [`${basePath}.${field}`]: finalValueToSave };
    if (shouldClearRetest) {
      updates[`${basePath}.retest`] = '';
    }
    updatePartialData(updates);
  };

  const calculateTestAverage = (testId) => {
    const testData = testRecords[testId];
    if (!testData) return 0;
    let totalScore = 0, count = 0;
    visibleStudents.filter(s => s.classId === testData.classId).forEach(s => {
      const r = testData.scores[s.id];
      if (r && r.score !== '') {
        totalScore += (r.retest !== '' && r.retest !== undefined) ? Number(r.retest) : Number(r.score);
        count++;
      }
    });
    return count === 0 ? 0 : (totalScore / count).toFixed(1);
  };

  const handleExportCSV = () => {
    if (!testClassId) return;
    const selectedClass = classes.find(c => c.id === testClassId);
    
    let csvContent = "\uFEFF시험날짜,테스트과정,총문제,";
    const classStds = visibleStudents.filter(s => s.classId === testClassId).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
    
    classStds.forEach(s => { csvContent += `${s.name}(점수),${s.name}(재시),`; });
    csvContent += "전체평균\n";

    if (selectedClass?.type === 'individual') {
      showToast("개별진도반은 현재 CSV 다운로드 기능을 지원하지 않습니다.", "error");
      return;
    }

    const tests = Object.values(testRecords).filter(t => t.classId === testClassId).sort((a, b) => a.date.localeCompare(b.date));
    tests.forEach(test => {
      csvContent += `${test.date},${test.subject},${test.totalQ},`;
      classStds.forEach(s => {
        const score = test.scores[s.id] || {score: '', retest: ''};
        csvContent += `${score.score},${score.retest},`;
      });
      csvContent += `${calculateTestAverage(test.id)}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `주간테스트결과_${selectedClass?.name || '데이터'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddIndivTestRow = () => {
    if (isReadOnly || !testClassId || !selectedIndivStudent) return;
    const newId = 'itest_' + Date.now();
    const newTestObj = { id: newId, classId: testClassId, studentId: selectedIndivStudent, date: getTodayLocal(), subject: '', totalQ: '', score: '', retest: '' };
    
    setIndividualTestRecords(prev => ({ ...prev, [newId]: newTestObj }));
    updatePartialData({ [`individualTestRecords.${newId}`]: newTestObj });
  };

  const handleIndivTestChange = (testId, field, value) => {
    if (isReadOnly) return;
    const isNumField = field === 'totalQ' || field === 'score' || field === 'retest';
    const finalVal = isNumField ? (value === '' ? '' : Number(value)) : value;

    let finalValueToSave = finalVal;
    let shouldClearRetest = false;

    setIndividualTestRecords(prev => {
      const testData = prev[testId];
      const totalQ = Number(testData.totalQ);
      let newRecord = { ...testData, [field]: finalVal };

      if ((field === 'score' || field === 'retest') && finalVal !== '') {
          if (totalQ > 0 && finalVal > totalQ) {
              const errorKey = `${testId}_${field}`;
              setTestErrors(e => ({ ...e, [errorKey]: true }));
              setTimeout(() => setTestErrors(e => ({ ...e, [errorKey]: false })), 2500);
              newRecord[field] = ''; 
              finalValueToSave = '';
          } else if (field === 'score') {
              if (totalQ > 0 && (finalVal / totalQ) >= 0.8) {
                  newRecord.retest = '';
                  shouldClearRetest = true;
              }
          }
      }
      return { ...prev, [testId]: newRecord };
    });

    const updates = { [`individualTestRecords.${testId}.${field}`]: finalValueToSave };
    if (shouldClearRetest) {
      updates[`individualTestRecords.${testId}.retest`] = '';
    }
    updatePartialData(updates);
  };

  // ================================================================
  // SECTION 12 : 리포트 생성 및 동시성 함수들
  // ================================================================
  const handleClassWeeklyProgressChange = (classId, value) => {
    if (isReadOnly) return;
    setClassWeeklyProgress(prev => ({...prev, [classId]: value}));
    updatePartialData({ [`classWeeklyProgress.${classId}`]: value });
  };

  const handleIndividualWeeklyProgressChange = (studentId, value) => {
    if (isReadOnly) return;
    setIndividualWeeklyProgress(prev => ({...prev, [studentId]: value}));
    updatePartialData({ [`individualWeeklyProgress.${studentId}`]: value });
  };

  const handleReportRemarkChange = (studentId, value) => {
    if (isReadOnly) return;
    setReportRemarks(prev => ({...prev, [studentId]: value}));
    updatePartialData({ [`reportRemarks.${studentId}`]: value });
  };

  const getAutoAttendanceRemark = (studentId) => {
    let remarks = [];
    Object.entries(records).sort(([a], [b]) => a.localeCompare(b)).forEach(([d, recordObj]) => {
      if (d >= reportStartDate && d <= reportEndDate && recordObj[studentId]) {
        const r = recordObj[studentId].remark || '';
        if (r.includes('결석') || r.includes('지각')) {
           const [, m, day] = d.split('-');
           const dateObj = new Date(d);
           const dayStr = DAYS.find(x => x.val === dateObj.getDay())?.label || '';
           const formattedDate = `${m}-${day}(${dayStr})`;
           
           if (r.includes('결석')) remarks.push(`${formattedDate} 결석`);
           if (r.includes('지각')) remarks.push(`${formattedDate} 지각`);
        }
      }
    });
    return remarks.length > 0 ? remarks.join(', ') : '';
  };

  const buildReportText = (mainTpl, itemTpl, noTestMsg, stdName, avgProg, weekProg, remark, testDataArr) => {
    let testStr = '';
    if (testDataArr && testDataArr.length > 0) {
      testStr = testDataArr.map(t => {
        let str = itemTpl;
        str = str.replace(/\[단원명\]/g, t.subject || '미기재');
        str = str.replace(/\[맞은개수\]/g, t.score);
        str = str.replace(/\[총문제수\]/g, t.totalQ || '?');
        str = str.replace(/\[통과여부\]/g, t.isPass ? '통과' : '불통과');
        str = str.replace(/\[반평균\]/g, t.classAvg || ''); 
        return str;
      }).join('\n\n'); 
    } else {
      testStr = noTestMsg;
    }

    let report = mainTpl;
    report = report.replace(/\[학생이름\]/g, stdName);
    report = report.replace(/\[과제성취도\]/g, avgProg);
    report = report.replace(/\[주간진도\]/g, weekProg || '기재되지 않음');
    report = report.replace(/\[비고\]/g, remark || '없음');
    report = report.replace(/\[테스트결과목록\]/g, testStr); 
    
    return report.trim();
  };

  const getDynamicBasicReport = (student) => {
    const stdClass = classes.find(c => c.id === student.classId);
    const isIndiv = stdClass?.type === 'individual';
    const tests = [];
    let currentItemTpl = testItemTemplate || DEFAULT_TEST_ITEM_TEMPLATE;
    const currentWeeklyProgress = isIndiv ? (individualWeeklyProgress[student.id] || '') : (classWeeklyProgress[student.classId] || '');

    if (isIndiv) {
      currentItemTpl = currentItemTpl.replace(/\n?반 평균 : \[반평균\]/g, '').replace(/\[반평균\]/g, '');
      // 🚨 a.date 또는 b.date가 없을 경우 빈 문자열('')로 대체하여 크래시 방어
      Object.values(individualTestRecords).sort((a,b)=> (a?.date || '').localeCompare(b?.date || '')).forEach(t => {
        if (t.studentId === student.id && t.date >= reportStartDate && t.date <= reportEndDate) {
          if (t.score !== '') {
            const activeScore = t.retest !== '' && t.retest !== undefined ? Number(t.retest) : Number(t.score);
            tests.push({ subject: t.subject, score: activeScore, totalQ: t.totalQ, isPass: (Number(t.totalQ) > 0 && (activeScore / Number(t.totalQ)) >= 0.8), classAvg: '' });
          }
        }
      });
    } else {
      // 🚨 a.date 또는 b.date가 없을 경우 빈 문자열('')로 대체하여 크래시 방어
      Object.entries(testRecords).sort(([, a], [, b]) => (a?.date || '').localeCompare(b?.date || '')).forEach(([testId, testData]) => {
        if (testData.classId === student.classId && testData.date >= reportStartDate && testData.date <= reportEndDate) {
          const sInfo = testData.scores?.[student.id]; // scores 구조가 없는 데이터 방어
          if (sInfo && sInfo.score !== '') {
            const activeScore = sInfo.retest !== '' && sInfo.retest !== undefined ? Number(sInfo.retest) : Number(sInfo.score);
            const classAvgStr = `${calculateTestAverage(testId)} / ${testData.totalQ||'?'}`;
            tests.push({ subject: testData.subject, score: activeScore, totalQ: testData.totalQ, isPass: (Number(testData.totalQ) > 0 && (activeScore / Number(testData.totalQ)) >= 0.8), classAvg: classAvgStr });
          }
        }
      });
    }

    // 변경 전: Object.values(records).filter((_, i) => Object.keys(records)[i] >= ...
    // 변경 후: 가독성 확보 및 명시적 날짜 정렬 추가
    const stdRecords = Object.entries(records)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)) // 시간순 보장
      .filter(([dateStr]) => dateStr >= reportStartDate && dateStr <= reportEndDate)
      .map(([_, dayRecords]) => dayRecords[student.id])
      .filter(r => r && r.progress !== undefined && r.progress !== null && !(r.remark || '').includes('결석'));
    
    const avgProgress = stdRecords.length > 0 ? Math.round(stdRecords.reduce((sum, r) => sum + r.progress, 0) / stdRecords.length) : 100;
    
    const autoRemark = getAutoAttendanceRemark(student.id);
    const manualRemark = reportRemarks[student.id] !== undefined ? reportRemarks[student.id] : autoRemark;
    
    return buildReportText(offlineTemplate || DEFAULT_TEMPLATE, currentItemTpl, noTestMessage || DEFAULT_NO_TEST_MSG, student.name || '이름없음', avgProgress, currentWeeklyProgress, manualRemark, tests);
  };

  const handleCopy = (text, studentId, progress) => {
    if (!progress || progress.trim() === '') {
      showToast('⚠️ 주간 진도를 입력해야 복사할 수 있습니다.', 'error');
      return;
    }
    
    try {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
      setCopiedId(studentId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      showToast('복사 실패', 'error');
    }
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown size={14} className="text-gray-400" />;
    return sortConfig.direction === 'asc' ? <ArrowUp size={14} className="text-blue-600" /> : <ArrowDown size={14} className="text-blue-600" />;
  };

  const restoreDefaultTemplates = () => {
    setOfflineTemplate(DEFAULT_TEMPLATE);
    setTestItemTemplate(DEFAULT_TEST_ITEM_TEMPLATE);
    setNoTestMessage(DEFAULT_NO_TEST_MSG);
    showToast('모든 템플릿이 기본값으로 초기화되었습니다.');
  };

  if (!isLoaded) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={32}/></div>;

  // ================================================================
  // SECTION 13 : UI 렌더링 시작
  // ================================================================
  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans relative ${isReadOnly ? 'bg-emerald-50' : 'bg-gray-50'}`}>
      <style>{`
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-lg shadow-xl font-bold text-sm flex items-center gap-2 transition-all ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
          <Check size={16} className={toast.type === 'error' ? 'hidden' : 'block'} />
          <AlertCircle size={16} className={toast.type === 'error' ? 'block' : 'hidden'} />
          {toast.message}
        </div>
      )}

      {/* 📍 여기에 붙여넣으세요: 🚀 전송 상태 UI 시작 */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2 pointer-events-none transition-all">
        {syncState.pending > 0 && syncState.failed === 0 && (
          <div className="bg-gray-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold">
            <Loader2 className="animate-spin text-blue-400" size={18} />
            <span>서버 동기화 중... ({syncState.pending}건 대기)</span>
          </div>
        )}
        {syncState.pending === 0 && syncState.failed === 0 && Object.keys(syncQueueRef.current).length === 0 && (
          <div className="bg-green-50 text-green-700 border border-green-200 px-5 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-bold opacity-0 animate-[fadeInOut_3s_ease-in-out]">
            <Check className="text-green-600" size={18} />
            <span>모든 데이터 안전하게 저장됨</span>
          </div>
        )}
        {syncState.failed > 0 && (
          <div className="bg-red-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold pointer-events-auto">
            <AlertCircle size={18} />
            <span>저장 실패! ({syncState.failed}건) 네트워크 확인 요망</span>
          </div>
        )}
        <style>{`@keyframes fadeInOut { 0% { opacity: 0; transform: translateY(10px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(10px); } }`}</style>
      </div>
      {/* 📍 전송 상태 UI 끝 */}

      {classDeleteWarning && !isReadOnly && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 text-orange-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold text-gray-900">삭제 불가</h3>
            </div>
            <p className="text-gray-600 mb-6">⚠️ 소속된 학생이 있습니다.<br/>학생을 모두 삭제하거나 다른 반으로 이동시켜야 반을 삭제할 수 있습니다.</p>
            <div className="flex justify-end">
              <button onClick={() => setClassDeleteWarning(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">확인</button>
            </div>
          </div>
        </div>
      )}

      {classToDelete && !isReadOnly && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold text-gray-900">반 삭제 확인</h3>
            </div>
            <p className="text-gray-600 mb-6">정말 이 반을 삭제하시겠습니까?<br/>이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setClassToDelete(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium">취소</button>
              <button onClick={confirmDeleteClass} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-sm">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {studentToDelete && !isReadOnly && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold text-gray-900">학생 삭제 확인</h3>
            </div>
            <p className="text-gray-600 mb-6">정말로 이 학생을 삭제하시겠습니까?<br/>모든 데이터가 함께 삭제됩니다.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setStudentToDelete(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium">취소</button>
              <button onClick={confirmDeleteStudent} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium shadow-sm">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {testToDelete && !isReadOnly && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-lg font-bold text-gray-900">테스트 삭제 확인</h3>
            </div>
            <p className="text-gray-600 mb-6">이 테스트 기록을 완전히 삭제하시겠습니까?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setTestToDelete(null)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium">취소</button>
              <button onClick={confirmDeleteTest} className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium shadow-sm">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        <header className="mb-6 flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="text-blue-600"/> 임팩트수학 통합관리</h1>
            <span className="text-xs text-gray-500">{role === 'admin' ? '👑 관리자' : role === 'office' ? '🏢 행정팀' : `👨‍🏫 ${instructors.find(i => i.id === teacherId)?.name || '알 수 없는'} 강사`} 계정 접속중</span>
          </div>
          <button onClick={async () => { 
            try { await signOut(auth); } catch(e){} 
            setRole(null); localStorage.removeItem('userRole'); localStorage.removeItem('teacherId'); 
          }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 font-bold">
            <LogOut size={16}/> 로그아웃
          </button>
        </header>

        {isReadOnly && (
          <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200 flex items-center gap-2 text-sm font-bold shadow-sm">
            <Lock size={16} className="text-emerald-600" /> 행정팀 전용 (읽기 전용) 모드입니다. 데이터 열람 및 복사만 가능하며 안전하게 보호됩니다.
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b mb-6 overflow-x-auto pb-1">
          {role === 'admin' && (
            <button 
              onClick={() => handleTabChange('instructors')} 
              className={`px-4 py-2.5 text-sm font-bold rounded-t-lg ${activeTab === 'instructors' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}
            >
              강사 관리
            </button>
          )}
          {[
            { id: 'daily', icon: Calendar, label: '일일 과제/체크' },
            { id: 'tests', icon: FileText, label: '주간 테스트' },
            { id: 'students', icon: Users, label: '학생 관리' },
            { id: 'classes', icon: BookOpen, label: '반 관리' },
            { id: 'report', icon: ClipboardList, label: '주간 리포트 (전송용)', highlight: true },
            { id: 'settings', icon: Settings, label: '설정' }
          ].filter(tab => !(isReadOnly && tab.id === 'settings')).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : tab.highlight 
                    ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 border-b-0' 
                    : 'text-gray-500 hover:bg-gray-200'
              }`}
            >
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        {/* 🚀 전송 상태 UI (가장 확실하고 정직한 인디케이터) */}
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-2 pointer-events-none transition-all">
          {syncState.pending > 0 && syncState.failed === 0 && (
            <div className="bg-gray-800 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold">
              <Loader2 className="animate-spin text-blue-400" size={18} />
              <span>서버 동기화 중... ({syncState.pending}건 대기)</span>
            </div>
          )}
          {syncState.pending === 0 && syncState.failed === 0 && Object.keys(syncQueueRef.current).length === 0 && (
            <div className="bg-green-50 text-green-700 border border-green-200 px-5 py-3 rounded-full shadow-xl flex items-center gap-2 text-sm font-bold opacity-0 animate-[fadeInOut_3s_ease-in-out]">
              <Check className="text-green-600" size={18} />
              <span>모든 데이터 안전하게 저장됨</span>
            </div>
          )}
          {syncState.failed > 0 && (
            <div className="bg-red-600 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-bold pointer-events-auto">
              <AlertCircle size={18} />
              <span>저장 실패! ({syncState.failed}건) 네트워크 확인 요망</span>
            </div>
          )}
          <style>{`@keyframes fadeInOut { 0% { opacity: 0; transform: translateY(10px); } 10% { opacity: 1; transform: translateY(0); } 90% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(10px); } }`}</style>
        </div>
        

        

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
          
          {/* ============================================================
              SECTION 14 : [탭] 강사 관리 UI 
              ============================================================ */}
          {role === 'admin' && activeTab === 'instructors' && (
             <div>
               <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
                 <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><UserCog size={18}/> 신규 강사 (DB 연결용 정보 생성)</h3>
                 <div className="flex flex-wrap gap-4 items-end">
                   <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">강사 이름</label><input type="text" value={newInstName} onChange={e=>setNewInstName(e.target.value)} placeholder="예) 홍길동" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                   <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">이메일 ID 앞자리 (Firebase 연동용)</label><input type="text" value={newInstId} onChange={e=>setNewInstId(e.target.value)} placeholder="teacher_01" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                   <button onClick={handleAddInstructor} className="bg-blue-800 text-white px-6 py-2 rounded font-bold hover:bg-blue-900 transition-colors">생성</button>
                 </div>
               </div>
               <table className="w-full text-left border-collapse border border-gray-200">
                 <thead><tr className="bg-gray-100 text-gray-700 text-sm border-b"><th className="p-3">강사명</th><th className="p-3">아이디 (Firebase 연동)</th><th className="p-3 text-center">관리</th></tr></thead>
                 <tbody className="divide-y divide-gray-100">
                   {instructors.map(inst => (
                     <tr key={inst.id}>
                       {editingInstId === inst.id ? (
                         <>
                           <td className="p-2"><input type="text" value={editInstData.name} onChange={e => setEditInstData({...editInstData, name: e.target.value})} className="border rounded p-1 w-full text-sm" /></td>
                           <td className="p-3 text-gray-400 text-sm">{inst.username} (ID불변)</td>
                           <td className="p-2 text-center flex justify-center gap-2">
                             <button onClick={saveEditedInst} className="text-green-600 hover:bg-green-100 p-1.5 rounded"><Check size={16} /></button>
                             <button onClick={() => setEditingInstId(null)} className="text-gray-500 hover:bg-gray-200 p-1.5 rounded"><X size={16} /></button>
                           </td>
                         </>
                       ) : (
                         <>
                           <td className="p-3 font-medium">{inst.name}</td><td className="p-3 text-gray-600">{inst.username}</td>
                           <td className="p-3 text-center flex justify-center gap-2">
                             <button onClick={() => startEditingInst(inst)} className="text-blue-500 hover:bg-blue-50 p-1.5 rounded"><Edit2 size={16}/></button>
                             <button onClick={() => handleDeleteInstructor(inst.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button>
                           </td>
                         </>
                       )}
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
          )}

          {/* ============================================================
              SECTION 15 : [탭] 반 관리 UI
              ============================================================ */}
          {activeTab === 'classes' && (
            <div>
              {!isReadOnly && (
                <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-4">새로운 반 추가</h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">반 이름</label><input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="예) 월수금 중등기초반" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div className="w-56"><label className="block text-xs font-medium text-gray-500 mb-1">수업 형태 (테스트 방식)</label>
                      <div className="flex gap-2 h-[42px]">
                        <button onClick={() => setNewClassType('lecture')} className={`flex-1 rounded border font-bold text-sm transition-colors ${newClassType === 'lecture' ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>판서반</button>
                        <button onClick={() => setNewClassType('individual')} className={`flex-1 rounded border font-bold text-sm transition-colors ${newClassType === 'individual' ? 'bg-purple-600 text-white border-purple-600 shadow-md' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>개별반</button>
                      </div>
                    </div>
                    {role === 'admin' && (
                      <div className="w-32"><label className="block text-xs font-medium text-gray-500 mb-1">담당 강사</label><select value={newClassInstructor} onChange={e => setNewClassInstructor(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">선택...</option>{instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}</select></div>
                    )}
                    <div className="flex-[2]"><label className="block text-xs font-medium text-gray-500 mb-1">수업 요일 선택</label>
                      <div className="flex gap-2">{DAYS.map(day => (<button key={day.val} onClick={() => toggleDaySelection(day.val)} className={`w-10 h-10 rounded-full flex items-center justify-center font-medium transition-colors ${newClassDays.includes(day.val) ? 'bg-blue-600 text-white shadow-md' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-100'}`}>{day.label}</button>))}</div>
                    </div>
                  </div>
                  <button onClick={handleAddClass} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"><Plus size={18} /> 반 추가</button>
                </div>
              )}
              
              {(role === 'admin' || role === 'office') && (
                <div className="mb-4 flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm w-fit">
                  <span className="text-sm font-bold text-gray-700">👨‍🏫 강사별 반 보기:</span>
                  <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)} className="border border-gray-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">전체 강사</option>
                    {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name} 강사</option>)}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleClasses
                  .filter(c => !(role === 'admin' || role === 'office') || !filterInstructor || c.instructorId === filterInstructor)
                  .map((cls, idx) => {
                  const color = CLASS_COLORS[idx % CLASS_COLORS.length];
                  
                  if (editingClassId === cls.id && !isReadOnly) {
                    return (
                      <div key={cls.id} className={`border ${color.border} rounded-lg p-4 bg-white shadow-md relative group border-2`}>
                        <div className="mb-3">
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">반 이름 수정</label>
                          <input type="text" value={editClassData.name} onChange={e => setEditClassData({...editClassData, name: e.target.value})} className="w-full border border-gray-300 rounded p-1.5 text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="mb-3">
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">요일 수정</label>
                          <div className="flex flex-wrap gap-1">
                            {DAYS.map(day => (
                              <button key={day.val} onClick={() => setEditClassData(prev => ({...prev, days: (prev.days || []).includes(day.val) ? (prev.days || []).filter(d=>d!==day.val) : [...(prev.days || []), day.val]}))} className={`text-xs px-2 py-1 rounded border transition-colors ${(editClassData.days || []).includes(day.val) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{day.label}</button>))}
                          </div>
                        </div>
                        {role === 'admin' && (
                          <div className="mb-4">
                            <label className="block text-[10px] font-bold text-gray-500 mb-1">강사 변경</label>
                            <select value={editClassData.instructorId} onChange={e => setEditClassData({...editClassData, instructorId: e.target.value})} className="w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-2 focus:ring-blue-500 outline-none">
                              <option value="">선택...</option>
                              {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="flex justify-end gap-2 mt-4 border-t pt-3">
                          <button onClick={() => setEditingClassId(null)} className="px-3 py-1.5 text-xs font-bold bg-gray-200 text-gray-700 rounded hover:bg-gray-300">취소</button>
                          <button onClick={saveEditedClass} className="px-3 py-1.5 text-xs font-bold bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"><Check size={14}/> 저장</button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <div key={cls.id} className={`border ${color.border} rounded-lg p-4 pb-12 bg-white shadow-sm relative group`}>
                      <div className="flex justify-between items-start mb-2">
                        <h4 className={`font-bold text-lg ${color.text}`}>
                          {cls.name} <span className="text-sm font-normal text-gray-500">({instructors.find(i => i.id === cls.instructorId)?.name || '미지정'} 강사)</span>
                        </h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cls.type === 'individual' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{cls.type === 'individual' ? '개별반' : '판서반'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">{(cls.days || []).map(d => (<span key={d} className={`text-xs ${color.bg} ${color.text} px-2 py-1 rounded border ${color.border}`}>{DAYS.find(day => day.val === d)?.label}</span>))}</div>
                      <div className="text-sm text-gray-500 flex items-center justify-between">
                        <span className="flex items-center gap-1"><Users size={14} /> {visibleStudents.filter(s => s.classId === cls.id).length}명</span>
                        {role === 'admin' && <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 border font-medium">담당: {instructors.find(i => i.id === cls.instructorId)?.name || '미지정'}</span>}
                      </div>
                      {!isReadOnly && (
                        <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditingClass(cls)} className="bg-white text-blue-500 hover:bg-blue-50 p-1.5 rounded shadow border border-gray-200" title="반 수정"><Edit2 size={14} /></button>
                          <button onClick={() => handleDeleteClass(cls.id)} className="bg-white text-red-500 hover:bg-red-50 p-1.5 rounded shadow border border-gray-200" title="반 삭제"><Trash2 size={14} /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ============================================================
              SECTION 16 : [탭] 학생 관리 UI
              ============================================================ */}
          {activeTab === 'students' && (
            <div>
              {!isReadOnly && (
                <div className="bg-gray-50 p-4 rounded-lg mb-8 flex flex-wrap gap-4 items-end border border-gray-200">
                  <div className="flex-1 min-w-[150px]"><label className="block text-xs font-medium text-gray-500 mb-1">학생 이름</label><input type="text" value={newStudentName} onChange={e => setNewStudentName(e.target.value)} placeholder="홍길동" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="flex-1 min-w-[150px]"><label className="block text-xs font-medium text-gray-500 mb-1">학교</label><input type="text" value={newStudentSchool} onChange={e => setNewStudentSchool(e.target.value)} placeholder="한국중학교" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                  <div className="flex-1 min-w-[150px]"><label className="block text-xs font-medium text-gray-500 mb-1">소속 반</label>
                    <select value={newStudentClass} onChange={e => setNewStudentClass(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"><option value="">반 선택...</option>{visibleClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type==='individual'?'개별':'판서'})</option>)}</select>
                  </div>
                  <button onClick={handleAddStudent} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"><Plus size={18} /> 학생 추가</button>
                </div>
              )}
              
              {(role === 'admin' || role === 'office') && (
                <div className="mb-4 flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-200 shadow-sm w-fit">
                  <span className="text-sm font-bold text-gray-700">👨‍🏫 강사별 학생 보기:</span>
                  <select value={filterInstructor} onChange={e => setFilterInstructor(e.target.value)} className="border border-gray-300 rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none">
                    <option value="">전체 강사</option>
                    {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name} 선생님</option>)}
                  </select>
                </div>
              )}
              <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-sm border-b border-gray-200">
                      <th className="p-3 cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('name')}>
                        <div className="flex items-center gap-2">이름 {renderSortIcon('name')}</div>
                      </th>
                      <th className="p-3 cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('school')}>
                        <div className="flex items-center gap-2">학교 {renderSortIcon('school')}</div>
                      </th>
                      <th className="p-3 cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('classId')}><div className="flex items-center gap-2">소속 반 {renderSortIcon('classId')}</div></th>
                      {(role === 'admin' || role === 'office') && <th className="p-3 cursor-pointer hover:bg-gray-200 transition-colors select-none" onClick={() => handleSort('instructorId')}><div className="flex items-center gap-2">담당 강사 {renderSortIcon('instructorId')}</div></th>}
                      {!isReadOnly && <th className="p-3 w-24 text-center">관리</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {getSortedStudentsForManagement().map(student => {
                      const schoolTheme = getSchoolColor(student.school);
                      const clsIndex = classes.findIndex(c => c.id === student.classId);
                      const classTheme = clsIndex !== -1 ? CLASS_COLORS[clsIndex % CLASS_COLORS.length] : { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };

                      return (
                        <tr key={student.id} className="hover:bg-gray-50">
                          {editingStudentId === student.id && !isReadOnly ? (
                            <>
                              <td className="p-2"><input type="text" value={editStudentData.name} onChange={e => setEditStudentData({...editStudentData, name: e.target.value})} className="border rounded p-1 w-full" /></td>
                              <td className="p-2"><input type="text" value={editStudentData.school} onChange={e => setEditStudentData({...editStudentData, school: e.target.value})} className="border rounded p-1 w-full" /></td>
                              <td className="p-2"><select value={editStudentData.classId} onChange={e => setEditStudentData({...editStudentData, classId: e.target.value})} className="border rounded p-1 w-full">{visibleClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></td>
                              <td className="p-2 text-center flex justify-center gap-2"><button onClick={saveEditedStudent} className="text-green-600 hover:bg-green-100 p-1 rounded"><Check size={18} /></button><button onClick={() => setEditingStudentId(null)} className="text-gray-500 hover:bg-gray-200 p-1 rounded"><X size={18} /></button></td>
                            </>
                          ) : (
                            <>
                              <td className="p-3 font-medium text-gray-800">{student.name}</td>
                              <td className="p-3"><span className={`${schoolTheme} px-2 py-1 rounded text-xs font-medium border`}>{student.school}</span></td>
                              <td className="p-3"><span className={`${classTheme.bg} ${classTheme.text} ${classTheme.border} border px-2 py-1 rounded text-xs font-medium`}>{classes.find(c => c.id === student.classId)?.name || '알 수 없음'}</span></td>
                              {(role === 'admin' || role === 'office') && <td className="p-3 text-sm font-medium text-gray-600">{instructors.find(i => i.id === classes.find(c => c.id === student.classId)?.instructorId)?.name || '미지정'}</td>}
                              {!isReadOnly && (
                                <td className="p-3 text-center flex justify-center gap-2">
                                  <button onClick={() => startEditingStudent(student)} className="text-blue-500 hover:bg-blue-100 p-1 rounded"><Edit2 size={18} /></button>
                                  <button onClick={() => setStudentToDelete(student.id)} className="text-red-500 hover:bg-red-100 p-1 rounded"><Trash2 size={18} /></button>
                                </td>
                              )}
                            </>
                          )}
                        </tr>
                      )
                    })}
                    {visibleStudents.length === 0 && <tr><td colSpan="4" className="text-center p-8 text-gray-500">등록된 학생이 없습니다.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================
              SECTION 17 : [탭] 일일 출결/과제 UI
              ============================================================ */}
          {activeTab === 'daily' && (
            <div>
              <div className="flex flex-col md:flex-row md:items-start gap-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2 mt-2">
                  <Calendar size={18} className="text-blue-600" />
                  <label className="font-semibold text-gray-700 whitespace-nowrap">기준 날짜:</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none w-36" />
                </div>
                {viewMode === 'daily' && (
                  <div className="flex flex-col gap-2 md:ml-auto w-full md:w-auto">
                    <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-gray-200 shadow-sm overflow-x-auto">
                      <span className="text-xs font-bold text-gray-400 whitespace-nowrap px-2">지난주</span>
                      {getWeekDays(lastWeekDatesInit.start).map((dateStr, idx) => {
                        const [, m, d] = dateStr.split('-');
                        const isSelected = dateStr === selectedDate;
                        const isToday = dateStr === getTodayLocal();
                        return (
                          <button key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`relative px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isSelected ? 'bg-blue-600 text-white shadow-sm' : isToday ? 'bg-blue-50 text-blue-700 border border-blue-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {['월', '화', '수', '목', '금', '토'][idx]} ({Number(m)}/{Number(d)})
                            {isToday && <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">오늘</span>}
                          </button>
                        )
                      })}
                    </div>
                    <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-gray-200 shadow-sm overflow-x-auto">
                      <span className="text-xs font-bold text-gray-500 whitespace-nowrap px-2">이번주</span>
                      {getWeekDays(weekDatesInit.start).map((dateStr, idx) => {
                        const [, m, d] = dateStr.split('-');
                        const isSelected = dateStr === selectedDate;
                        const isToday = dateStr === getTodayLocal();
                        return (
                          <button key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`relative px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isSelected ? 'bg-blue-600 text-white shadow-sm' : isToday ? 'bg-blue-50 text-blue-700 border border-blue-300' : 'text-gray-600 hover:bg-gray-100'}`}>
                            {['월', '화', '수', '목', '금', '토'][idx]} ({Number(m)}/{Number(d)})
                            {isToday && <span className="absolute -top-2 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">오늘</span>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mb-6">
                <button onClick={() => setViewMode('daily')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>일간 뷰</button>
                <button onClick={() => setViewMode('weekly')} className={`px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-sm ${viewMode === 'weekly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>주간 통합 뷰</button>
              </div>

              {viewMode === 'daily' ? (
                targetClasses.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">해당 요일에 수업이 있는 반이 없습니다.</div>
                ) : (
                  <div className="space-y-8">
                    {targetClasses.map((cls, idx) => {
                      const color = CLASS_COLORS[idx % CLASS_COLORS.length];
                      const classStudents = visibleStudents.filter(s => s.classId === cls.id).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
                      return (
                        <div key={cls.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                          <div className={`${color.bg} px-4 py-3 border-b ${color.border}`}>
                            <h3 className={`font-bold text-lg ${color.text}`}>{cls.name}</h3>
                          </div>
                          {classStudents.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500 text-center">배정된 학생이 없습니다.</div>
                          ) : (
                            <div className="divide-y divide-gray-100">
                              {classStudents.map(student => {
                                const record = (records[selectedDate] && records[selectedDate][student.id]) || { progress: 100, remark: '' };
                                return (
                                  <div key={student.id} className="p-4 flex flex-col md:flex-row md:items-center gap-4 hover:bg-gray-50/50 transition-colors">
                                    <div className="w-48">
                                      <div className="font-medium text-gray-900">{student.name}</div>
                                      <div className="text-xs text-gray-500">{student.school}</div>
                                    </div>
                                    <div className="flex-[2] flex flex-col gap-2">
                                      <div className="text-sm font-medium text-gray-600 flex justify-between items-center">
                                        <span>과제 달성률</span>
                                        <span className={`font-bold ${record.progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>{record.progress}%</span>
                                      </div>
                                      <div className={`flex w-full bg-gray-100 rounded-md overflow-hidden border border-gray-200 ${isReadOnly || record.remark.includes('결석') ? 'opacity-40 grayscale bg-gray-200' : ''}`}>
                                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((val) => (
                                          <button key={val} 
                                            onClick={() => handleRecordChange(student.id, 'progress', val)}
                                            disabled={isReadOnly || record.remark.includes('결석')}
                                            className={`flex-1 h-8 text-[10px] font-medium transition-colors outline-none
                                              ${record.progress === val ? 'bg-blue-600 text-white font-bold scale-105 shadow-sm relative z-10' : 'text-gray-500 hover:bg-gray-200'}
                                              ${record.progress === 100 && val === 100 ? '!bg-green-500' : ''}
                                              ${(isReadOnly || record.remark.includes('결석')) ? 'cursor-not-allowed hover:bg-transparent' : ''}`}
                                          >
                                            {val === 0 || val === 100 ? `${val}%` : val}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <div className={`flex-1 mt-6 md:mt-0 flex flex-wrap xl:flex-nowrap items-center gap-1 ${isReadOnly ? 'pointer-events-none' : ''}`}>
                                      <input type="text" placeholder="결석/지각/특이사항 입력" value={record.remark} onChange={(e) => handleRecordChange(student.id, 'remark', e.target.value)}
                                        className="flex-1 border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none min-w-[120px]" />
                                      <button onClick={() => importPreviousRemark(student.id, selectedDate)} title="이전 수업 코멘트 불러오기" className="p-2 text-gray-400 hover:text-blue-600 rounded bg-white border border-gray-200 hover:bg-blue-50 transition-colors flex-shrink-0">
                                        <Copy size={16} />
                                      </button>
                                      <button onClick={() => handleQuickRemark(selectedDate, student.id, '결석')} className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors flex-shrink-0 ${record.remark.includes('결석') ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}>결석</button>
                                      <button onClick={() => handleQuickRemark(selectedDate, student.id, '지각')} className={`px-3 py-1.5 text-xs font-bold rounded border transition-colors flex-shrink-0 ${record.remark.includes('지각') ? 'bg-orange-500 text-white border-orange-600' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'}`}>지각</button>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                <div className="space-y-8">
                  {visibleClasses.map((cls, idx) => {
                    const color = CLASS_COLORS[idx % CLASS_COLORS.length];
                    const classStudents = visibleStudents.filter(s => s.classId === cls.id).sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
                    if (classStudents.length === 0) return null;

                    const weekDates = getWeekDays(selectedDate).filter(date => cls.days.includes(getLocalDayOfWeek(date)));
                    if (weekDates.length === 0) return null;

                    return (
                      <div key={cls.id} className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-white">
                        <div className={`${color.bg} px-4 py-3 border-b ${color.border}`}>
                          <h3 className={`font-bold text-lg ${color.text}`}>{cls.name}</h3>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-center text-sm">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="p-3 w-32 border-r whitespace-nowrap sticky left-0 bg-gray-100 z-20">학생명</th>
                                {weekDates.map(d => {
                                  const [, m, day] = d.split('-');
                                  return <th key={d} className="p-3 border-r min-w-[260px] whitespace-nowrap">{Number(m)}/{Number(day)} ({DAYS.find(dayObj=>dayObj.val===getLocalDayOfWeek(d))?.label})</th>
                                })}
                                <th className="p-3 w-20 bg-blue-50 whitespace-nowrap">주간평균</th>
                              </tr>
                            </thead>
                            <tbody className={isReadOnly ? 'pointer-events-none' : ''}>
                              {classStudents.map(student => {
                                const validProgs = weekDates.map(d => {
                                  const r = records[d]?.[student.id];
                                  if (r && (r.remark || '').includes('결석')) return null;
                                  return r && r.progress !== undefined && r.progress !== null ? r.progress : 100;
                                }).filter(p => p !== null);
                                const avg = validProgs.length ? Math.round(validProgs.reduce((a,b)=>a+b,0)/validProgs.length) : 0;

                                return (
                                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="p-3 border-r font-medium whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50 z-10">{student.name}</td>
                                    {weekDates.map(d => {
                                      const record = records[d]?.[student.id] || { progress: 100, remark: '' };
                                      const isAbsent = (record.remark || '').includes('결석');

                                      return (
                                        <td key={d} className="p-3 border-r text-left align-top">
                                          <div className="flex flex-col gap-2">
                                            <div className="text-xs font-medium text-gray-600 flex justify-between items-center">
                                              <span>과제 달성률</span>
                                              <span className={`font-bold ${record.progress === 100 && !isAbsent ? 'text-green-600' : 'text-blue-600'}`}>
                                                {isAbsent ? '-' : `${record.progress}%`}
                                              </span>
                                            </div>
                                            <div className={`flex w-full bg-gray-100 rounded-md overflow-hidden border border-gray-200 ${isReadOnly || isAbsent ? 'opacity-40 grayscale bg-gray-200' : ''}`}>
                                              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => (
                                                <button 
                                                  key={val} 
                                                  onClick={() => handleSpecificDateRecordChange(d, student.id, 'progress', val)}
                                                  disabled={isReadOnly || isAbsent}
                                                  className={`flex-1 h-7 text-[9px] font-medium transition-colors outline-none
                                                    ${record.progress === val ? 'bg-blue-600 text-white font-bold shadow-sm relative z-10' : 'text-gray-500 hover:bg-gray-200'}
                                                    ${record.progress === 100 && val === 100 ? '!bg-green-500' : ''}
                                                    ${(isReadOnly || isAbsent) ? 'cursor-not-allowed hover:bg-transparent' : ''}`}
                                                >
                                                  {val === 0 || val === 100 ? `${val}%` : val}
                                                </button>
                                              ))}
                                            </div>
                                            <div className="flex items-center gap-1 mt-1">
                                              <input type="text" placeholder="특이사항 입력" value={record.remark} onChange={(e) => handleSpecificDateRecordChange(d, student.id, 'remark', e.target.value)} className="flex-1 w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none min-w-[80px]" />
                                              <button onClick={() => importPreviousRemark(student.id, d)} title="이전 특이사항 복사" className="text-gray-400 hover:text-blue-600 p-1.5 bg-gray-50 border border-gray-200 hover:bg-blue-50 rounded transition-colors flex-shrink-0"><Copy size={14}/></button>
                                              <button onClick={() => handleQuickRemark(d, student.id, '결석')} className={`px-1.5 py-1 text-[10px] font-bold rounded border transition-colors flex-shrink-0 ${(record.remark||'').includes('결석') ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}>결석</button>
                                              <button onClick={() => handleQuickRemark(d, student.id, '지각')} className={`px-1.5 py-1 text-[10px] font-bold rounded border transition-colors flex-shrink-0 ${(record.remark||'').includes('지각') ? 'bg-orange-500 text-white border-orange-600' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'}`}>지각</button>
                                            </div>
                                          </div>
                                        </td>
                                      )
                                    })}
                                    <td className="p-3 font-bold text-blue-600 bg-blue-50/30">{avg}%</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================
              SECTION 18 : [탭] 주간 테스트 UI
              ============================================================ */}
          {activeTab === 'tests' && (
            <div>
              <div className="flex flex-wrap gap-4 items-end mb-6 bg-purple-50 p-4 rounded-lg border border-purple-100">
                {(role === 'admin' || role === 'office') && (
                  <div className="flex-1 min-w-[150px] max-w-[200px]">
                    <label className="block text-xs font-bold text-purple-800 mb-1">담당 강사 필터</label>
                    <select value={filterInstructor} onChange={e => { setFilterInstructor(e.target.value); setTestClassId(''); setSelectedIndivStudent(null); }} className="w-full border border-purple-200 rounded-md p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white font-bold text-gray-700">
                      <option value="">전체 강사</option>
                      {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name} 강사</option>)}
                    </select>
                  </div>
                )}
                <div className="flex-1 min-w-[200px] max-w-xs">
                  <label className="block text-xs font-bold text-purple-800 mb-1">대상 반 선택</label>
                  <select value={testClassId} onChange={e => { setTestClassId(e.target.value); setSelectedIndivStudent(null); }} className="w-full border border-purple-200 rounded-md p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white font-bold text-gray-700">
                    <option value="">반을 선택해주세요...</option>
                    {visibleClasses
                      .filter(c => !(role === 'admin' || role === 'office') || !filterInstructor || c.instructorId === filterInstructor)
                      .map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.type==='individual'?'개별':'판서'}) - {instructors.find(i => i.id === c.instructorId)?.name || '미지정'} 강사
                        </option>
                    ))}
                  </select>
                </div>
                {visibleClasses.some(c => c.id === testClassId) && visibleClasses.find(c => c.id === testClassId)?.type !== 'individual' && !isReadOnly && (
                  <button onClick={handleAddLectureTestRow} className="bg-purple-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-purple-700 shadow-sm font-bold"><Plus size={18} /> 공통 테스트 항목 추가</button>
                )}
                {visibleClasses.some(c => c.id === testClassId) && visibleClasses.find(c => c.id === testClassId)?.type !== 'individual' && (
                  <button onClick={handleExportCSV} className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700 shadow-sm font-bold"><Download size={18} /> CSV 다운로드</button>
                )}
              </div>

              {!visibleClasses.some(c => c.id === testClassId) ? (
                <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">대상 반을 먼저 선택해주세요.</div>
              ) : (
                (() => {
                  const selectedClass = visibleClasses.find(c => c.id === testClassId);
                  const isIndividual = selectedClass?.type === 'individual';
                  const classStds = visibleStudents.filter(s => s.classId === testClassId).sort((a,b)=>a.name.localeCompare(b.name, 'ko-KR'));

                  // =====================================================================
                  // 1. 개별반 (Individual) 렌더링 로직
                  // =====================================================================
                  if (isIndividual) {
                    if (classStds.length === 0) return <div className="text-center p-8 text-gray-500">학생을 먼저 추가해주세요.</div>;
                    
                    if (!selectedIndivStudent && classStds.length > 0) setSelectedIndivStudent('all');
                    const isViewAll = selectedIndivStudent === 'all';
                    
                    return (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="flex bg-gray-100 border-b border-gray-200 overflow-x-auto relative">
                          <div className="sticky left-0 z-10 flex-shrink-0 bg-gray-100 shadow-[3px_0_5px_-2px_rgba(0,0,0,0.15)] border-r-2 border-gray-300">
                            <button onClick={() => setSelectedIndivStudent('all')} className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors h-full w-full ${selectedIndivStudent === 'all' ? 'bg-white text-purple-700 border-t-2 border-purple-600' : 'text-gray-700 hover:bg-gray-200'}`}>전체보기</button>
                          </div>
                          <div className="flex flex-nowrap">
                            {classStds.map(std => <button key={std.id} onClick={() => setSelectedIndivStudent(std.id)} className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors ${selectedIndivStudent === std.id ? 'bg-white text-purple-700 border-t-2 border-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}>{std.name}</button>)}
                          </div>
                        </div>

                        <div className="p-4 bg-gray-50/50">
                          {isViewAll ? (
                            <div className="space-y-8">
                              {classStds.map(student => {
                                const studentTests = Object.values(individualTestRecords)
                                  .filter(t => t.studentId === student.id)
                                  .sort((a, b) => a.date.localeCompare(b.date));

                                return (
                                  <div key={student.id} className="bg-white border border-purple-100 rounded-lg shadow-sm overflow-hidden">
                                    <div className="bg-purple-50 px-4 py-3 border-b border-purple-100 flex justify-between items-center">
                                      <h4 className="font-bold text-purple-900">{student.name} 학생</h4>
                                      <span className="text-xs text-purple-600 font-bold bg-purple-100 px-2 py-1 rounded">총 {studentTests.length}건</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="w-full text-center min-w-[700px] border-collapse">
                                        <thead>
                                          <tr className="bg-gray-50 text-gray-700 text-sm border-b border-gray-200">
                                            <th className="p-2 border-r border-gray-200 w-32 whitespace-nowrap">시험날짜</th>
                                            <th className="p-2 border-r border-gray-200 min-w-[150px] whitespace-nowrap">테스트 과정명</th>
                                            <th className="p-2 border-r border-gray-200 w-16 whitespace-nowrap">총문항</th>
                                            <th className="p-2 border-r border-gray-200 w-16">점수</th>
                                            <th className="p-2 border-r border-gray-200 w-16">재시</th>
                                            {!isReadOnly && <th className="p-2 w-12">삭제</th>}
                                          </tr>
                                        </thead>
                                        <tbody className={`divide-y divide-gray-200 ${isReadOnly ? 'pointer-events-none' : ''}`}>
                                          {studentTests.map(test => {
                                            const tQ = Number(test.totalQ);
                                            const hasScore = test.score !== '';
                                            const isInitialPass = hasScore && tQ > 0 && (Number(test.score) / tQ >= 0.8);
                                            const hasRetest = test.retest !== '';
                                            const isRetestPass = hasRetest && tQ > 0 && (Number(test.retest) / tQ >= 0.8);
                                            const scoreError = testErrors[`${test.id}_score`];
                                            const retestError = testErrors[`${test.id}_retest`];

                                            return (
                                              <tr key={test.id} className="hover:bg-gray-50 group">
                                                <td className="p-2 border-r border-gray-200 align-middle relative hover:bg-purple-50 transition-colors cursor-pointer">
                                                  <input type="date" value={test.date} onChange={e => handleIndivTestChange(test.id, 'date', e.target.value)} onClick={(e) => { try { e.target.showPicker(); } catch(err){} }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
                                                  <div className="font-bold text-purple-800 text-center pointer-events-none relative z-10">{formatShortDate(test.date)}</div>
                                                </td>
                                                <td className="p-2 border-r border-gray-200 text-left align-middle">
                                                  <input type="text" value={test.subject} onChange={e => handleIndivTestChange(test.id, 'subject', e.target.value)} placeholder="단원명 입력" className="w-full text-sm outline-none bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-500 rounded p-1.5 border border-transparent hover:border-purple-200" />
                                                </td>
                                                <td className="p-2 border-r border-gray-200">
                                                  <input type="number" value={test.totalQ} onChange={e => handleIndivTestChange(test.id, 'totalQ', e.target.value)} className="w-full text-center outline-none font-bold text-gray-700 bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-300 rounded" placeholder="문항"/>
                                                </td>
                                                <td className="p-2 border-r border-gray-200 align-top pt-3">
                                                  <input type="number" value={test.score} onChange={e => handleIndivTestChange(test.id, 'score', e.target.value)} className={`w-full text-center outline-none font-bold rounded ${scoreError ? 'bg-red-50 border border-red-500 text-red-600 placeholder-red-500 focus:ring-0' : 'text-blue-700 bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-300'}`} placeholder={scoreError ? "범위초과" : "점수"}/>
                                                  {hasScore && <div className={`text-[10px] font-bold text-center mt-1 ${isInitialPass?'text-green-600':'text-red-500'}`}>{isInitialPass?'통과':'미통과'}</div>}
                                                </td>
                                                <td className="p-2 border-r border-gray-200 align-top pt-3">
                                                  <input type="number" value={test.retest} disabled={isInitialPass} onChange={e => handleIndivTestChange(test.id, 'retest', e.target.value)} className={`w-full text-center outline-none font-bold rounded ${isInitialPass ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' : retestError ? 'bg-red-50 border border-red-500 text-red-600 placeholder-red-500 focus:ring-0' : 'text-orange-600 bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-300'}`} placeholder={retestError ? "범위초과" : "재시"}/>
                                                  {!isInitialPass && hasRetest && <div className={`text-[10px] font-bold text-center mt-1 ${isRetestPass?'text-green-600':'text-red-500'}`}>{isRetestPass?'통과':'미통과'}</div>}
                                                </td>
                                                {!isReadOnly && (
                                                  <td className="p-2 text-center">
                                                    <button onClick={() => setTestToDelete({ id: test.id, type: 'individual' })} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                                  </td>
                                                )}
                                              </tr>
                                            )
                                          })}
                                          {studentTests.length === 0 && <tr><td colSpan={isReadOnly ? 5 : 6} className="py-6 text-gray-400 text-sm bg-white">등록된 테스트 기록이 없습니다.</td></tr>}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                              <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-lg text-gray-800">{classStds.find(s=>s.id===selectedIndivStudent)?.name} 학생 테스트 기록</h4>
                                {!isReadOnly && <button onClick={handleAddIndivTestRow} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded font-bold text-sm hover:bg-purple-200 flex items-center gap-1"><Plus size={16}/> 새 테스트 기록</button>}
                              </div>
                              <div className="overflow-x-auto pb-4">
                                <table className="w-full text-center min-w-[700px] border-collapse">
                                  <thead>
                                    <tr className="bg-purple-50 text-purple-900 text-sm font-bold border-y border-purple-200">
                                      <th className="p-2 border-r border-purple-100 w-32 whitespace-nowrap">시험날짜</th>
                                      <th className="p-2 border-r border-purple-100 min-w-[150px] whitespace-nowrap">테스트 과정명</th>
                                      <th className="p-2 border-r border-purple-100 w-16 whitespace-nowrap">총문항</th>
                                      <th className="p-2 border-r border-purple-100 w-16">점수</th>
                                      <th className="p-2 border-r border-purple-100 w-16">재시</th>
                                      {!isReadOnly && <th className="p-2 w-12">삭제</th>}
                                    </tr>
                                  </thead>
                                  <tbody className={`divide-y divide-gray-200 border-b border-gray-200 ${isReadOnly ? 'pointer-events-none' : ''}`}>
                                    {Object.values(individualTestRecords).filter(t => t.studentId === selectedIndivStudent).sort((a,b) => a.date.localeCompare(b.date)).map(test => {
                                      const tQ = Number(test.totalQ);
                                      const hasScore = test.score !== '';
                                      const isInitialPass = hasScore && tQ > 0 && (Number(test.score) / tQ >= 0.8);
                                      const hasRetest = test.retest !== '';
                                      const isRetestPass = hasRetest && tQ > 0 && (Number(test.retest) / tQ >= 0.8);
                                      const scoreError = testErrors[`${test.id}_score`];
                                      const retestError = testErrors[`${test.id}_retest`];

                                      return (
                                        <tr key={test.id} className="hover:bg-gray-50 group">
                                          <td className="p-2 border-r border-gray-200 align-middle relative hover:bg-purple-50 transition-colors cursor-pointer">
                                            <input type="date" value={test.date} onChange={e => handleIndivTestChange(test.id, 'date', e.target.value)} onClick={(e) => { try { e.target.showPicker(); } catch(err){} }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
                                            <div className="font-bold text-purple-800 text-center pointer-events-none relative z-10">{formatShortDate(test.date)}</div>
                                          </td>
                                          <td className="p-2 border-r border-gray-200 text-left align-middle">
                                            <input type="text" value={test.subject} onChange={e => handleIndivTestChange(test.id, 'subject', e.target.value)} placeholder="단원명 입력" className="w-full text-sm outline-none bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-500 rounded p-1.5 border border-transparent hover:border-purple-200" />
                                          </td>
                                          <td className="p-2 border-r border-gray-200">
                                            <input type="number" value={test.totalQ} onChange={e => handleIndivTestChange(test.id, 'totalQ', e.target.value)} className="w-full text-center outline-none font-bold text-gray-700 bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-300 rounded" placeholder="문항"/>
                                          </td>
                                          <td className="p-2 border-r border-gray-200 align-top pt-3">
                                            <input type="number" value={test.score} onChange={e => handleIndivTestChange(test.id, 'score', e.target.value)} className={`w-full text-center outline-none font-bold rounded ${scoreError ? 'bg-red-50 border border-red-500 text-red-600 placeholder-red-500 focus:ring-0' : 'text-blue-700 bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-300'}`} placeholder={scoreError ? "범위초과" : "점수"}/>
                                            {hasScore && <div className={`text-[10px] font-bold text-center mt-1 ${isInitialPass?'text-green-600':'text-red-500'}`}>{isInitialPass?'통과':'미통과'}</div>}
                                          </td>
                                          <td className="p-2 border-r border-gray-200 align-top pt-3">
                                            <input type="number" value={test.retest} disabled={isInitialPass} onChange={e => handleIndivTestChange(test.id, 'retest', e.target.value)} className={`w-full text-center outline-none font-bold rounded ${isInitialPass ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' : retestError ? 'bg-red-50 border border-red-500 text-red-600 placeholder-red-500 focus:ring-0' : 'text-orange-600 bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-300'}`} placeholder={retestError ? "범위초과" : "재시"}/>
                                            {!isInitialPass && hasRetest && <div className={`text-[10px] font-bold text-center mt-1 ${isRetestPass?'text-green-600':'text-red-500'}`}>{isRetestPass?'통과':'미통과'}</div>}
                                          </td>
                                          {!isReadOnly && (
                                            <td className="p-2 text-center">
                                              <button onClick={() => setTestToDelete({ id: test.id, type: 'individual' })} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                            </td>
                                          )}
                                        </tr>
                                      )
                                    })}
                                    {Object.values(individualTestRecords).filter(t => t.studentId === selectedIndivStudent).length === 0 && <tr><td colSpan={isReadOnly ? 5 : 6} className="py-10 text-gray-400">등록된 테스트 기록이 없습니다.</td></tr>}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  } 
                  // =====================================================================
                  // 2. 판서반 (Lecture) 렌더링 로직 (기존 원본 복구)
                  // =====================================================================
                  else {
                    return (
                      <div className="border border-gray-200 rounded-xl shadow-sm overflow-x-auto bg-white">
                        <table className="w-full text-center min-w-max border-collapse">
                          <thead>
                            <tr className="bg-purple-50 text-purple-900 text-sm font-bold border-b border-purple-200">
                              <th className="p-3 border-r border-purple-100 w-32 sticky left-0 bg-purple-50 z-10 shadow-[1px_0_0_#e9d5ff] whitespace-nowrap">시험날짜</th>
                              <th className="p-3 border-r border-purple-100 min-w-[150px] whitespace-nowrap">공통 과정명</th>
                              <th className="p-3 border-r border-purple-100 w-16 whitespace-nowrap">총문항</th>
                              {classStds.map(student => (
                                <th key={student.id} colSpan="2" className="p-2 border-r border-purple-100 bg-purple-100/50">
                                  <div className="text-sm">{student.name}</div><div className="text-[10px] font-normal text-purple-600">{student.school}</div>
                                </th>
                              ))}
                              {!isReadOnly && <th className="p-3 border-l border-purple-100 bg-purple-50 w-12">삭제</th>}
                            </tr>
                            <tr className="bg-white text-xs text-gray-500 border-b border-gray-200">
                              <th className="border-r border-gray-200 sticky left-0 bg-white z-10 shadow-[1px_0_0_#e5e7eb]"></th><th className="border-r border-gray-200"></th><th className="border-r border-gray-200"></th>
                              {classStds.map(student => (<React.Fragment key={student.id + '_sub'}><th className="p-1.5 border-r border-gray-200 bg-gray-50">점수</th><th className="p-1.5 border-r border-gray-200 bg-gray-50">재시</th></React.Fragment>))}
                              {!isReadOnly && <th></th>}
                            </tr>
                          </thead>
                          <tbody className={`divide-y divide-gray-200 text-sm ${isReadOnly ? 'pointer-events-none' : ''}`}>
                            {Object.values(testRecords).filter(t => t.classId === testClassId).sort((a, b) => a.date.localeCompare(b.date)).map(test => (
                              <tr key={test.id} className="hover:bg-gray-50">
                                <td className="p-2 border-r border-gray-200 sticky left-0 bg-white group-hover:bg-purple-50 z-10 shadow-[1px_0_0_#e5e7eb] align-middle relative cursor-pointer">
                                  <input type="date" value={test.date} onChange={(e) => handleLectureTestChange(test.id, 'date', e.target.value)} onClick={(e) => { try { e.target.showPicker(); } catch(err){} }} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"/>
                                  <div className="font-bold text-purple-800 text-center pointer-events-none relative z-10">{formatShortDate(test.date)}</div>
                                </td>
                                <td className="p-2 border-r border-gray-200 text-left align-middle">
                                  <input type="text" value={test.subject} onChange={(e) => handleLectureTestChange(test.id, 'subject', e.target.value)} placeholder="단원명 입력" className="w-full text-sm outline-none bg-transparent focus:bg-white focus:ring-2 focus:ring-purple-500 rounded p-1.5 border border-transparent hover:border-purple-200"/>
                                </td>
                                <td className="p-2 border-r border-gray-200">
                                  <input type="number" value={test.totalQ} onChange={(e) => handleLectureTestChange(test.id, 'totalQ', e.target.value)} className="w-full bg-transparent text-center outline-none font-bold focus:bg-white focus:ring-2 focus:ring-purple-300 rounded"/>
                                </td>
                                
                                {classStds.map(student => {
                                  const studentScore = test.scores[student.id] || { score: '', retest: '' };
                                  const totalQNum = Number(test.totalQ);
                                  const hasScore = studentScore.score !== '';
                                  const isInitialPass = hasScore && totalQNum > 0 && (Number(studentScore.score) / totalQNum >= 0.8);
                                  const hasRetest = studentScore.retest !== '';
                                  const isRetestPass = hasRetest && totalQNum > 0 && (Number(studentScore.retest) / totalQNum >= 0.8);
                                  
                                  const scoreError = testErrors[`${test.id}_${student.id}_score`];
                                  const retestError = testErrors[`${test.id}_${student.id}_retest`];

                                  return (
                                    <React.Fragment key={student.id + '_inputs'}>
                                      <td className="p-1 border-r border-gray-200 relative align-top pt-2">
                                        <input type="number" value={studentScore.score} onChange={(e) => handleLectureScoreChange(test.id, student.id, 'score', e.target.value)} className={`w-full max-w-[50px] mx-auto block text-center outline-none font-bold rounded p-1 ${scoreError ? 'bg-red-50 text-red-600 border border-red-500 placeholder-red-500 focus:ring-0' : 'text-blue-700 focus:bg-white focus:ring-2 focus:ring-purple-300'}`} placeholder={scoreError ? "범위초과" : ""} />
                                        {hasScore && <div className={`text-[10px] font-bold text-center mt-1 ${isInitialPass?'text-green-600':'text-red-500'}`}>{isInitialPass?'통과':'미통과'}</div>}
                                      </td>
                                      <td className="p-1 border-r border-gray-200 relative align-top pt-2 bg-orange-50/30">
                                        <input type="number" value={studentScore.retest} disabled={isInitialPass} onChange={(e) => handleLectureScoreChange(test.id, student.id, 'retest', e.target.value)} className={`w-full max-w-[50px] mx-auto block text-center outline-none font-bold rounded p-1 ${isInitialPass ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50' : retestError ? 'bg-red-50 text-red-600 border border-red-500 placeholder-red-500 focus:ring-0' : 'text-orange-600 focus:bg-white focus:ring-2 focus:ring-purple-300'}`} placeholder={retestError ? "범위초과" : ""} />
                                        {hasScore && studentScore.retest !== '' && <div className={`text-[10px] font-bold text-center mt-1 ${isRetestPass?'text-green-600':'text-red-500'}`}>{isRetestPass?'통과':'미통과'}</div>}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}
                                {!isReadOnly && <td className="p-2 text-center"><button onClick={() => setTestToDelete({ id: test.id, type: 'lecture' })} className="text-gray-300 hover:text-red-500 p-1 rounded transition-colors"><Trash2 size={16} /></button></td>}
                              </tr>
                            ))}
                            {Object.values(testRecords).filter(t => t.classId === testClassId).length === 0 && <tr><td colSpan={4 + classStds.length * 2} className="text-center py-10 text-gray-500">항목 추가 버튼을 눌러 테스트를 등록하세요.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    );
                  }
                })()
              )}
            </div>
          )}

          {/* ============================================================
              SECTION 19 : [탭] 주간 리포트 UI
              ============================================================ */}
          {activeTab === 'report' && (
            <div className="space-y-6 pointer-events-auto">
              <div className="bg-gradient-to-r from-blue-50 border border-blue-100 to-indigo-50 p-6 rounded-xl mb-8 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-indigo-900 mb-1 flex items-center gap-2"><ClipboardList className="text-indigo-500" size={20} /> 학부모 전송 리포트 생성기</h3>
                    <p className="text-sm text-indigo-700">기본양식(오프라인)을 바탕으로 누적 데이터를 취합합니다.</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg border border-indigo-100">
                  <div><label className="block text-xs font-bold text-indigo-800 mb-1">시작일 (월)</label><input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" /></div>
                  <div><label className="block text-xs font-bold text-indigo-800 mb-1">종료일 (토)</label><input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" /></div>
                  
                  {(role === 'admin' || role === 'office') && (
                    <div className="flex-1 min-w-[150px] max-w-[200px]">
                      <label className="block text-xs font-bold text-indigo-800 mb-1">담당 강사 필터</label>
                      <select value={filterInstructor} onChange={e => { setFilterInstructor(e.target.value); setReportClassId(''); }} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800">
                        <option value="">전체 강사</option>
                        {instructors.map(inst => <option key={inst.id} value={inst.id}>{inst.name} 강사</option>)}
                      </select>
                    </div>
                  )}

                  <div className="flex-1 min-w-[200px]"><label className="block text-xs font-bold text-indigo-800 mb-1">대상 반 선택</label>
                    <select value={reportClassId} onChange={e => setReportClassId(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800">
                      <option value="">반을 선택하세요...</option>
                      {visibleClasses
                        .filter(c => !(role === 'admin' || role === 'office') || !filterInstructor || c.instructorId === filterInstructor)
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.type==='individual'?'개별':'판서'}) - {instructors.find(i => i.id === c.instructorId)?.name || '미지정'} 강사
                          </option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {reportClassId && visibleClasses.find(c => c.id === reportClassId)?.type !== 'individual' && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-indigo-800 mb-1">선택 기간 공통 진도 (판서반)</label>
                    <input type="text" value={classWeeklyProgress[reportClassId] || ''} onChange={(e) => handleClassWeeklyProgressChange(reportClassId, e.target.value)} readOnly={isReadOnly} placeholder="예) 다항식의 연산 전체" className={`w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none ${isReadOnly ? 'bg-gray-50' : 'bg-white'}`} />
                  </div>
                )}
              </div>

              {reportClassId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visibleStudents.filter(s => s.classId === reportClassId).sort((a,b) => (a?.name || '').localeCompare(b?.name || '', 'ko-KR')).map(student => {
                    const isExcluded = excludeFromReport[student.id] || false;
                    const autoRemark = getAutoAttendanceRemark(student.id);
                    const manualRemark = reportRemarks[student.id] !== undefined ? reportRemarks[student.id] : autoRemark;
                    
                    const currentReportText = getDynamicBasicReport(student);

                    const stdClass = visibleClasses.find(c => c.id === student.classId);
                    const currentWeeklyProgress = stdClass?.type === 'individual' ? individualWeeklyProgress[student.id] : classWeeklyProgress[student.classId];

                    return (
                      <div key={student.id} className="border border-gray-300 rounded-xl p-5 bg-white shadow-sm flex flex-col gap-4 relative overflow-hidden">
                        
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3 relative z-20">
                          <div className="font-bold text-lg text-gray-900">{student.name} <span className="text-sm font-normal text-gray-500">({student.school})</span></div>
                          <div className="flex gap-2">
                            <button onClick={() => {if(!isReadOnly) updatePartialData({ [`excludeFromReport.${student.id}`]: !isExcluded }); setExcludeFromReport(prev => ({...prev, [student.id]: !prev[student.id]}));}} disabled={isReadOnly} className={`px-2.5 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 border ${isExcluded ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}>
                              {isExcluded ? <Check size={12}/> : <X size={12}/>} {isExcluded ? '전송 포함하기' : '전송 제외'}
                            </button>
                          </div>
                        </div>
                        
                        <div className={`flex flex-col flex-1 gap-3 relative z-10 transition-all ${isExcluded ? 'opacity-30 grayscale pointer-events-none select-none' : ''}`}>
                          
                          <div>
                            {visibleClasses.find(c => c.id === student.classId)?.type === 'individual' && (
                              <input type="text" value={individualWeeklyProgress[student.id] || ''} onChange={(e) => handleIndividualWeeklyProgressChange(student.id, e.target.value)} readOnly={isReadOnly} placeholder="학생 개별 주간 진도 입력" className={`w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-3 ${isReadOnly ? 'bg-gray-50' : 'bg-indigo-50/50'}`} />
                            )}
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">선생님 특별 비고 작성란 (결석/지각 날짜가 표기되어 있습니다)</label>
                            <textarea value={manualRemark} onChange={(e) => handleReportRemarkChange(student.id, e.target.value)} readOnly={isReadOnly} placeholder="이번 주 지각/결석 기록이 자동으로 표시되며, 추가할 내용을 자유롭게 적어주세요." className={`w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y h-20 ${isReadOnly ? 'bg-gray-100 text-gray-600' : 'bg-yellow-50/30'}`} />
                          </div>
                          
                          <div className="relative flex-1 flex flex-col">
                            <div className="flex justify-between items-end mb-1">
                              <label className="text-[10px] font-bold text-gray-500">최종 전송 텍스트</label>
                              
                              {!isReadOnly && (
                                <div className="flex gap-2">
                                  {customReports[student.id] !== undefined && (
                                    <button
                                      onClick={() => {
                                        if (window.confirm('수정한 내용을 지우고 원래의 자동생성 상태로 되돌리시겠습니까?')) {
                                          setCustomReports(prev => { const next = {...prev}; delete next[student.id]; return next; });
                                          if (editingReportId === student.id) setEditingReportId(null);
                                        }
                                      }}
                                      disabled={isExcluded}
                                      className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-red-50 text-red-500 disabled:opacity-50"
                                    >
                                      <RefreshCcw size={14} /> <span className="text-xs font-bold">초기화</span>
                                    </button>
                                  )}
                                  
                                  <button 
                                    onClick={() => {
                                      if (editingReportId === student.id) {
                                        setCustomReports(prev => ({...prev, [student.id]: editReportText}));
                                        setEditingReportId(null);
                                      } else {
                                        setEditReportText(customReports[student.id] !== undefined ? customReports[student.id] : currentReportText);
                                        setEditingReportId(student.id);
                                      }
                                    }}
                                    disabled={isExcluded}
                                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${editingReportId === student.id ? 'bg-green-50 hover:bg-green-100' : 'hover:bg-gray-100'} disabled:opacity-50`}
                                  >
                                    {editingReportId === student.id ? (
                                      <><Check size={14} className="text-green-600"/> <span className="text-xs font-bold text-green-700">저장하기</span></>
                                    ) : (
                                      <><Edit2 size={14} className="text-blue-500"/> <span className="text-xs font-bold text-blue-600">수정하기</span></>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                            
                            <textarea 
                              value={editingReportId === student.id ? editReportText : (customReports[student.id] !== undefined ? customReports[student.id] : currentReportText)} 
                              onChange={(e) => setEditReportText(e.target.value)}
                              readOnly={isReadOnly || editingReportId !== student.id} 
                              className={`w-full h-full min-h-[250px] border rounded-md p-4 outline-none resize-none text-sm leading-relaxed pb-12 transition-all duration-200
                                ${editingReportId === student.id 
                                  ? 'bg-white border-blue-400 ring-2 ring-blue-100 text-gray-900 shadow-inner' 
                                  : 'border-gray-200 bg-gray-50 text-gray-800'}`} 
                            />
                            
                            <button 
                              onClick={() => handleCopy(customReports[student.id] !== undefined ? customReports[student.id] : currentReportText, student.id, currentWeeklyProgress)} 
                              disabled={isExcluded || editingReportId === student.id} 
                              className={`absolute bottom-3 right-3 text-white px-5 py-2 rounded shadow-md flex items-center gap-2 text-sm font-bold transition-colors disabled:opacity-50 ${copiedId === student.id ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'}`}
                            >
                              {copiedId === student.id ? <Check size={14} /> : <Copy size={14} />}
                              {copiedId === student.id ? '복사 완료!' : '복사하기'}
                            </button>
                          </div>
                        </div>

                        {isExcluded && (
                          <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none mt-10">
                            <div className="bg-red-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg opacity-90 text-lg flex items-center gap-2">
                              <X size={20}/> 전송 제외된 학생입니다
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl font-medium">대상 반을 선택하면 학생별 리포트가 나타납니다.</div>}
            </div>
          )}

          {/* ============================================================
              SECTION 20 : [탭] 설정 UI  (관리자 전용)
              ============================================================ */}
          {activeTab === 'settings' && !isReadOnly && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {role === 'admin' && (
                <>
                  <div className="bg-red-50 p-6 rounded-xl border border-red-200 shadow-sm mb-6">
                    <h3 className="text-lg font-bold text-red-900 mb-2 flex items-center gap-2"><AlertCircle size={20} /> 서버 데이터베이스 강제 청소</h3>
                    <p className="text-sm text-red-700 mb-4">삭제해도 계속 부활하는 과거의 유령 테스트 데이터들을 서버에서 완전히 날려버립니다.</p>
                    <button onClick={async () => {
                      if(window.confirm('정말 테스트 데이터를 완전히 초기화하시겠습니까? (현재 입력된 테스트도 모두 백지화됩니다)')) {
                        setTestRecords({}); setIndividualTestRecords({});
                        try { await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData'), { testRecords: {}, individualTestRecords: {} }); alert('청소 완료! 새로고침을 진행해주세요.'); window.location.reload(); } catch(e) { alert('청소 실패: DB 접근 권한을 확인하세요.'); }
                      }
                    }} className="bg-red-600 text-white px-4 py-2 rounded font-bold hover:bg-red-700 shadow-sm">유령 테스트 데이터 영구 삭제</button>
                  </div>

                  <div className="bg-green-50 p-6 rounded-xl border border-green-200 shadow-sm mb-6">
                    <h3 className="text-lg font-bold text-green-900 mb-2 flex items-center gap-2"><Download size={20} /> 전체 시스템 데이터 백업 및 복구</h3>
                    <p className="text-sm text-green-700 mb-4">학원의 모든 데이터(강사, 반, 학생, 성적 등)를 백업하거나, 이전 백업 파일로 복구합니다.</p>
                    <div className="flex flex-wrap gap-3">
                      <button onClick={handleExportAllDataToJSON} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 shadow-sm flex items-center gap-2 w-fit transition">
                        <Download size={18} /> PC로 파일 다운로드
                      </button>
                      <button onClick={handleBackupToGoogleDrive} disabled={isDriveSyncing} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 w-80 whitespace-nowrap transition disabled:opacity-50">
                        {isDriveSyncing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} />}
                        {isDriveSyncing ? '클라우드 전송 중...' : '구글 드라이브에 백업하기'}
                      </button>
                      <label className="bg-gray-700 text-white px-4 py-2 rounded font-bold hover:bg-gray-800 shadow-sm flex items-center gap-2 w-fit transition cursor-pointer">
                        <Upload size={18} /> JSON 백업 파일로 복구하기
                        <input type="file" accept=".json" onChange={handleImportFromJSON} className="hidden" />
                      </label>
                    </div>
                    <p className="text-xs text-green-600 mt-3 font-medium">⚠️ 복구 시 현재 서버의 모든 데이터가 백업 파일 내용으로 덮어씌워집니다. 복구 전 반드시 최신 백업을 먼저 해두세요.</p>
                  </div>
                  
                  <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Eye size={20} className="text-blue-500" /> 시스템 외관 설정 (관리자 전용)</h3>
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">브라우저 탭 이름 (Title)</label>
                        <input type="text" value={systemSettings?.title || ''} onChange={(e) => setSystemSettings(prev => ({...prev, title: e.target.value}))} placeholder="예: 임팩트 수학학원" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1">브라우저 아이콘 (Favicon URL)</label>
                        <p className="text-[10px] text-gray-500 mb-1">인터넷에 올려진 이미지 주소(http://...)를 입력하세요. (.png, .ico 권장)</p>
                        <input type="text" value={systemSettings?.iconUrl || ''} onChange={(e) => setSystemSettings(prev => ({...prev, iconUrl: e.target.value}))} placeholder="예: https://example.com/icon.png" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {role === 'teacher' && (
                <div className="bg-blue-50 p-6 rounded-xl border border-blue-200 shadow-sm mb-6">
                  <h3 className="text-lg font-bold text-blue-900 mb-2 flex items-center gap-2"><Sparkles size={20} /> 구글 드라이브 백업</h3>
                  <p className="text-sm text-blue-700 mb-4">현재까지의 학원 데이터를 클라우드에 안전하게 백업합니다.</p>
                  <button onClick={handleBackupToGoogleDrive} disabled={isDriveSyncing} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 w-80 whitespace-nowrap transition disabled:opacity-50">
                    {isDriveSyncing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} />}
                    {isDriveSyncing ? '클라우드 전송 중...' : '구글 드라이브에 백업하기'}
                  </button>
                </div>
              )}

              <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Settings size={20} className="text-gray-500" /> 리포트 기본 양식 템플릿 설정</h3>
                
                <div className="mb-8">
                  <div className="flex justify-between items-end mb-2">
                    <label className="font-bold text-gray-800 text-sm">1. 전체 메시지 뼈대</label>
                    <button onClick={restoreDefaultTemplates} className="text-xs text-blue-600 hover:underline">전체 기본값으로 초기화</button>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg mb-3 border border-gray-200 text-xs">
                    <p className="font-bold text-gray-700 mb-2 flex items-center gap-1"><AlertCircle size={14}/> 입력 가능 태그 설명 (클릭하여 복사 및 사용 가능)</p>
                    <ul className="space-y-1.5 text-gray-600">
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-blue-600">[학생이름]</code> : 학생의 실명이 입력됩니다. (예: 홍길동)</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-blue-600">[과제성취도]</code> : 지정된 기간 내 과제 달성률 평균 (%)</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-blue-600">[주간진도]</code> : 해당 반(또는 개별)의 이번 주 진도 텍스트</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-blue-600">[테스트결과목록]</code> : 아래 2번 항목인 '개별 테스트 양식'이 시험 횟수만큼 반복 생성되어 들어갈 자리입니다.</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-blue-600">[비고]</code> : 리포트 화면에서 적은 '선생님 특별 비고' 내용</li>
                    </ul>
                  </div>
                  <textarea value={offlineTemplate} onChange={(e) => setOfflineTemplate(e.target.value)} className="w-full h-48 border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y bg-gray-50" />
                </div>

                <div className="mb-8">
                  <label className="font-bold text-gray-800 text-sm mb-2 block">2. 반복되는 개별 테스트 결과 표시 양식</label>
                  <p className="text-xs text-gray-500 mb-2">위 전체 틀의 <code className="font-bold">[테스트결과목록]</code> 영역에 들어갈 한 줄의 양식입니다.</p>
                  <div className="bg-gray-50 p-4 rounded-lg mb-3 border border-gray-200 text-xs">
                    <ul className="space-y-1.5 text-gray-600">
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-emerald-600">[단원명]</code> : 테스트 등록 시 적은 과정명</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-emerald-600">[맞은개수]</code> : 학생이 맞힌 점수 (재시를 본 경우 재시 점수 출력)</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-emerald-600">[총문제수]</code> : 테스트의 총 문항 수</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-emerald-600">[통과여부]</code> : 80% 이상 통과, 미만 미통과 표시</li>
                      <li><code className="bg-white px-1.5 py-0.5 rounded border border-gray-300 font-bold text-emerald-600">[반평균]</code> : 판서반의 경우 해당 테스트의 반 전체 평균 점수</li>
                    </ul>
                  </div>
                  <textarea value={testItemTemplate} onChange={(e) => setTestItemTemplate(e.target.value)} className="w-full h-24 border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none resize-y bg-gray-50" />
                </div>

                <div>
                  <label className="font-bold text-gray-800 text-sm mb-2 block">3. 테스트 기록이 없을 경우 안내 문구</label>
                  <input type="text" value={noTestMessage} onChange={(e) => setNoTestMessage(e.target.value)} className="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-gray-50" />
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
