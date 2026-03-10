/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
import React, { useState, useEffect, useRef } from 'react';
import { Users, BookOpen, Calendar, Plus, Trash2, Edit2, Check, X, AlertCircle, Sparkles, Copy, Loader2, FileText, Download, Settings, ArrowUp, ArrowDown, ArrowUpDown, RefreshCcw, LogOut, Lock, UserCog, ClipboardList, Eye } from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';

// --- 1. Firebase 설정 ---
let firebaseConfig;
const userActualConfig = {
  apiKey: "AIzaSyBe6DBEXLKaGyYFLLzYou6qmrOOZifNcEA",
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
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'impact-math-admin-app';

// 공통 상수
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

// 이번 주 월~토 날짜 구하기
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
const weekDatesInit = getThisWeekMonSat();

const getDayName = (dateStr) => {
  if(!dateStr) return '';
  const d = new Date(dateStr);
  return DAYS.find(x => x.val === d.getDay())?.label || '';
};

const getSchoolColor = (schoolName) => {
  if (!schoolName) return 'bg-gray-50 text-gray-700 border-gray-200';
  const colors = ['bg-pink-50 text-pink-700 border-pink-200', 'bg-indigo-50 text-indigo-700 border-indigo-200', 'bg-teal-50 text-teal-700 border-teal-200', 'bg-orange-50 text-orange-700 border-orange-200', 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'];
  let hash = 0;
  for (let i = 0; i < schoolName.length; i++) hash += schoolName.charCodeAt(i);
  return colors[hash % colors.length];
};

// --- 자동 높이 조절 Textarea 컴포넌트 ---
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

// --- 1. 로그인 화면 컴포넌트 ---
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

// --- 2. 최상위 App 컴포넌트 ---
export default function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(() => localStorage.getItem('userRole') || null); 
  const [teacherId, setTeacherId] = useState(() => localStorage.getItem('teacherId') || null);
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (err) { console.warn("Auth warning:", err.message); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser, (error) => { console.warn("Auth state warning:", error.message); });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (id, pw) => {
    setLoginError('');
    if (id === 'admin' && pw === 'admin') { setRole('admin'); localStorage.setItem('userRole', 'admin'); return; }
    if (id === 'office' && pw === 'office') { setRole('office'); localStorage.setItem('userRole', 'office'); return; }
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const instructorsList = docSnap.data().instructors || [];
        const matched = instructorsList.find(inst => inst.username === id && inst.password === pw);
        if (matched) { setRole('teacher'); setTeacherId(matched.id); localStorage.setItem('userRole', 'teacher'); localStorage.setItem('teacherId', matched.id); return; }
      }
      setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
    } catch(e) {
      setLoginError('데이터베이스 연결 중 오류가 발생했습니다.');
    }
  };

  if (!role) return <LoginScreen onLogin={handleLogin} error={loginError} />;
  return <MainApp role={role} user={user} setRole={setRole} teacherId={teacherId} />;
}

// --- 3. 메인 앱 컴포넌트 ---
function MainApp({ role, user, setRole, teacherId }) {
  const isReadOnly = role === 'office';
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('report');
  
  const loadData = (key, defaultData) => {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0) || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
      return defaultData;
    }
    return parsed;
  };

  // === [시작] 데모용 풍부한 목데이터 생성 로직 ===
  const d1 = new Date(weekDatesInit.start);
  const d2 = new Date(d1); d2.setDate(d1.getDate() + 2);
  const d3 = new Date(d1); d3.setDate(d1.getDate() + 4);
  const date1 = weekDatesInit.start;
  const date2 = d2.toISOString().split('T')[0];
  const date3 = d3.toISOString().split('T')[0];

  const initialClasses = [
    { id: 'c1', name: '중등 2-1 심화 (판서반)', days: [1, 3, 5], instructorId: 't1', type: 'lecture' },
    { id: 'c2', name: '중등 3-1 기본 (판서반)', days: [2, 4], instructorId: 't1', type: 'lecture' },
    { id: 'c3', name: '고등 수(상) 실력 (판서반)', days: [1, 5], instructorId: 't1', type: 'lecture' },
    { id: 'c4', name: '중등 개별진도 (개별반)', days: [1, 3, 5], instructorId: 't1', type: 'individual' },
    { id: 'c5', name: '고등 개별진도 (개별반)', days: [2, 4, 6], instructorId: 't1', type: 'individual' }
  ];

  const initialStudents = [
    { id: 's1', name: '김지민', school: '임팩트중', classId: 'c1' }, { id: 's2', name: '이서준', school: '임팩트중', classId: 'c1' }, { id: 's3', name: '박도윤', school: '임팩트중', classId: 'c1' }, { id: 's4', name: '최시우', school: '임팩트중', classId: 'c1' }, { id: 's5', name: '정하준', school: '임팩트중', classId: 'c1' },
    { id: 's6', name: '한지우', school: '수학중', classId: 'c2' }, { id: 's7', name: '오지훈', school: '수학중', classId: 'c2' }, { id: 's8', name: '서건우', school: '수학중', classId: 'c2' }, { id: 's9', name: '윤우진', school: '수학중', classId: 'c2' }, { id: 's10', name: '장서진', school: '수학중', classId: 'c2' },
    { id: 's11', name: '임민준', school: '과학고', classId: 'c3' }, { id: 's12', name: '권예준', school: '과학고', classId: 'c3' }, { id: 's13', name: '신유준', school: '과학고', classId: 'c3' }, { id: 's14', name: '송주원', school: '과학고', classId: 'c3' }, { id: 's15', name: '안수호', school: '과학고', classId: 'c3' },
    { id: 's16', name: '강다은', school: '미래중', classId: 'c4' }, { id: 's17', name: '조하은', school: '미래중', classId: 'c4' }, { id: 's18', name: '백서연', school: '미래중', classId: 'c4' }, { id: 's19', name: '유하윤', school: '미래중', classId: 'c4' }, { id: 's20', name: '설지유', school: '미래중', classId: 'c4' },
    { id: 's21', name: '구민서', school: '영재고', classId: 'c5' }, { id: 's22', name: '양서현', school: '영재고', classId: 'c5' }, { id: 's23', name: '진수아', school: '영재고', classId: 'c5' }, { id: 's24', name: '차은서', school: '영재고', classId: 'c5' }, { id: 's25', name: '우지안', school: '영재고', classId: 'c5' }
  ];

  const initialRecords = { [date1]: {}, [date2]: {}, [date3]: {} };
  initialStudents.forEach(s => {
    initialRecords[date1][s.id] = { progress: 100, remark: '' };
    initialRecords[date2][s.id] = { progress: 100, remark: '' };
    initialRecords[date3][s.id] = { progress: 90, remark: '' };
  });
  
  // 간헐적 지각/결석/성취도 반영
  initialRecords[date1]['s2'] = { progress: 0, remark: '결석' };
  initialRecords[date1]['s7'] = { progress: 80, remark: '지각' };
  initialRecords[date2]['s12'] = { progress: 50, remark: '과제 미흡' };
  initialRecords[date2]['s18'] = { progress: 0, remark: '결석' };
  initialRecords[date3]['s22'] = { progress: 90, remark: '지각' };
  initialRecords[date3]['s4'] = { progress: 70, remark: '' };

  const initialTestRecords = {
    't_c1_1': { id: 't_c1_1', classId: 'c1', date: date1, subject: '유리수와 순환소수', totalQ: '20', scores: { 's1': {score:20}, 's2': {score:''}, 's3': {score:15, retest:18}, 's4': {score:19}, 's5': {score:16} }},
    't_c1_2': { id: 't_c1_2', classId: 'c1', date: date2, subject: '식의 계산', totalQ: '15', scores: { 's1': {score:15}, 's2': {score:14}, 's3': {score:12, retest:15}, 's4': {score:15}, 's5': {score:11, retest:14} }},
    't_c1_3': { id: 't_c1_3', classId: 'c1', date: date3, subject: '일차부등식', totalQ: '20', scores: { 's1': {score:18}, 's2': {score:19}, 's3': {score:16}, 's4': {score:20}, 's5': {score:17} }},
    
    't_c2_1': { id: 't_c2_1', classId: 'c2', date: date1, subject: '제곱근과 실수', totalQ: '10', scores: { 's6': {score:10}, 's7': {score:8}, 's8': {score:9}, 's9': {score:6, retest:9}, 's10': {score:10} }},
    't_c2_2': { id: 't_c2_2', classId: 'c2', date: date2, subject: '근호를 포함한 식의 계산', totalQ: '20', scores: { 's6': {score:20}, 's7': {score:19}, 's8': {score:15, retest:18}, 's9': {score:14, retest:19}, 's10': {score:20} }},
    't_c2_3': { id: 't_c2_3', classId: 'c2', date: date3, subject: '다항식의 곱셈', totalQ: '15', scores: { 's6': {score:15}, 's7': {score:15}, 's8': {score:14}, 's9': {score:15}, 's10': {score:12, retest:15} }},
    
    't_c3_1': { id: 't_c3_1', classId: 'c3', date: date1, subject: '다항식의 연산', totalQ: '20', scores: { 's11': {score:19}, 's12': {score:20}, 's13': {score:16}, 's14': {score:17}, 's15': {score:18} }},
    't_c3_2': { id: 't_c3_2', classId: 'c3', date: date2, subject: '나머지 정리', totalQ: '20', scores: { 's11': {score:20}, 's12': {score:18}, 's13': {score:19}, 's14': {score:15, retest:20}, 's15': {score:16} }},
    't_c3_3': { id: 't_c3_3', classId: 'c3', date: date3, subject: '인수분해', totalQ: '20', scores: { 's11': {score:20}, 's12': {score:19}, 's13': {score:20}, 's14': {score:20}, 's15': {score:19} }},
  };

  const initialIndivTests = {};
  let indivTestId = 1;
  const subjectsC4 = ['1차 방정식', '그래프와 비례', '기본 도형'];
  const subjectsC5 = ['복소수', '이차방정식', '이차함수'];
  
  initialStudents.filter(s => s.classId === 'c4').forEach(s => {
    [date1, date2, date3].forEach((d, idx) => {
      initialIndivTests[`it_${indivTestId}`] = { id: `it_${indivTestId}`, classId: 'c4', studentId: s.id, date: d, subject: subjectsC4[idx], totalQ: '15', score: (10 + Math.floor(Math.random()*6)), retest: '' };
      indivTestId++;
    });
  });
  initialStudents.filter(s => s.classId === 'c5').forEach(s => {
    [date1, date2, date3].forEach((d, idx) => {
      initialIndivTests[`it_${indivTestId}`] = { id: `it_${indivTestId}`, classId: 'c5', studentId: s.id, date: d, subject: subjectsC5[idx], totalQ: '20', score: (15 + Math.floor(Math.random()*6)), retest: '' };
      indivTestId++;
    });
  });
  // === [끝] 데모용 풍부한 목데이터 생성 로직 ===

  const [instructors, setInstructors] = useState(() => loadData('instructors', [{ id: 't1', username: 'teacher', password: '1234', name: '김선생' }]));
  const [classes, setClasses] = useState(() => loadData('classes', initialClasses));
  const [students, setStudents] = useState(() => loadData('students', initialStudents));
  const [records, setRecords] = useState(() => loadData('records', initialRecords));
  const [testRecords, setTestRecords] = useState(() => loadData('testRecords', initialTestRecords));
  const [individualTestRecords, setIndividualTestRecords] = useState(() => loadData('individualTestRecords', initialIndivTests));

  const [reportRemarks, setReportRemarks] = useState({});
  const [excludeFromReport, setExcludeFromReport] = useState(() => loadData('excludeFromReport', {})); 
  const [classWeeklyProgress, setClassWeeklyProgress] = useState({});
  const [individualWeeklyProgress, setIndividualWeeklyProgress] = useState({});
  // 시스템 제목/아이콘 및 강사 필터 상태 추가
  const [systemSettings, setSystemSettings] = useState(() => loadData('systemSettings', { title: '임팩트 수학학원', iconUrl: '' }));
  const [filterInstructor, setFilterInstructor] = useState('');

  const [offlineTemplate, setOfflineTemplate] = useState(DEFAULT_TEMPLATE);
  const [testItemTemplate, setTestItemTemplate] = useState(DEFAULT_TEST_ITEM_TEMPLATE);
  const [noTestMessage, setNoTestMessage] = useState(DEFAULT_NO_TEST_MSG);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [testClassId, setTestClassId] = useState('c1');
  const [testErrors, setTestErrors] = useState({}); 
  const [reportStartDate, setReportStartDate] = useState(weekDatesInit.start);
  const [reportEndDate, setReportEndDate] = useState(weekDatesInit.end);
  const [reportClassId, setReportClassId] = useState('c1');
  
  const [viewMode, setViewMode] = useState('daily');
  const [sortConfig, setSortConfig] = useState({ key: 'name', direction: 'asc' });

  // 커스텀 모달 및 알림 상태 
  const [toast, setToast] = useState(null);
  const [classToDelete, setClassToDelete] = useState(null);
  const [classDeleteWarning, setClassDeleteWarning] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState(null);
  const [testToDelete, setTestToDelete] = useState(null);

  const [selectedIndivStudent, setSelectedIndivStudent] = useState(null);
  const [editingStudentId, setEditingStudentId] = useState(null);
  const [editStudentData, setEditStudentData] = useState({ name: '', school: '', classId: '' });

  const [copiedId, setCopiedId] = useState(null);

  const showToast = (message, type = 'success') => { 
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000); 
  };

  // DB 로드 및 에러 방지 (무한 로딩 100% 차단 로직)
  useEffect(() => {
    let isMounted = true;

    // 만약 서버 통신이 실패하거나 권한이 없어도 2.5초 뒤에는 무조건 화면을 엽니다.
    const fallbackTimer = setTimeout(() => {
      if (isMounted) setIsLoaded(true);
    }, 2500);

    const fetchDb = async () => {
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        if (docSnap.exists()) {
          const d = docSnap.data();
          if(d.instructors) setInstructors(d.instructors);
          if(d.classes && d.classes.length > 0) setClasses(d.classes);
          if(d.students && d.students.length > 0) setStudents(d.students);
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
        setIsLoaded(true);
        clearTimeout(fallbackTimer);
      } catch (e) {
        if (isMounted) setIsLoaded(true);
        clearTimeout(fallbackTimer);
      }
    };

    fetchDb();

    return () => {
      isMounted = false;
      clearTimeout(fallbackTimer);
    };
  }, []); // 의존성 배열을 비워 한 번만 실행되도록 고정

  // 데이터 동기화
  const syncData = (key, value) => {
    if (!isLoaded || isReadOnly) return;
    setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData'), { [key]: value }, { merge: true }).catch(e => console.warn(e));
  };

  useEffect(() => { if(isLoaded) syncData('instructors', instructors); }, [instructors, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('classes', classes); }, [classes, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('students', students); }, [students, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('records', records); }, [records, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('testRecords', testRecords); }, [testRecords, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('individualTestRecords', individualTestRecords); }, [individualTestRecords, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('classWeeklyProgress', classWeeklyProgress); }, [classWeeklyProgress, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('individualWeeklyProgress', individualWeeklyProgress); }, [individualWeeklyProgress, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('reportRemarks', reportRemarks); }, [reportRemarks, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('excludeFromReport', excludeFromReport); }, [excludeFromReport, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('offlineTemplate', offlineTemplate); }, [offlineTemplate, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('testItemTemplate', testItemTemplate); }, [testItemTemplate, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('noTestMessage', noTestMessage); }, [noTestMessage, isLoaded]);
  useEffect(() => { if(isLoaded) syncData('systemSettings', systemSettings); }, [systemSettings, isLoaded]);

  // 브라우저 탭 제목 및 아이콘 실시간 반영 로직
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

  // --- 권한 및 필터링 ---
  const visibleClasses = role === 'teacher' ? classes.filter(c => c.instructorId === teacherId) : classes;
  const visibleStudents = role === 'teacher' ? students.filter(s => visibleClasses.some(c => c.id === s.classId)) : students;

  // --- 강사/학생/반 관리 로직 ---
  const [newInstName, setNewInstName] = useState('');
  const [newInstId, setNewInstId] = useState('');
  const [newInstPw, setNewInstPw] = useState('');

  const handleAddInstructor = () => {
    if (!newInstName || !newInstId || !newInstPw) return showToast('강사 정보를 모두 입력하세요.', 'error');
    setInstructors([...instructors, { id: 'inst_' + Date.now(), name: newInstName, username: newInstId, password: newInstPw }]);
    setNewInstName(''); setNewInstId(''); setNewInstPw('');
    showToast('신규 강사가 생성되었습니다.');
  };

  const handleDeleteInstructor = (id) => {
    if (classes.some(c => c.instructorId === id)) {
      showToast('이 강사에게 배정된 반이 있습니다. 반을 먼저 변경/삭제하세요.', 'error');
      return;
    }
    if (window.confirm('정말 이 강사 계정을 삭제하시겠습니까?')) {
      setInstructors(instructors.filter(i => i.id !== id));
      showToast('강사 계정이 삭제되었습니다.', 'success');
    }
  };

  const [newClassName, setNewClassName] = useState('');
  const [newClassDays, setNewClassDays] = useState([]);
  const [newClassInstructor, setNewClassInstructor] = useState(''); 
  const [newClassType, setNewClassType] = useState('lecture'); 

  const handleAddClass = () => {
    if (isReadOnly) return;
    if (!newClassName.trim() || newClassDays.length === 0) return showToast('반 이름과 요일을 입력하세요.', 'error');
    const assignedInst = role === 'admin' ? newClassInstructor : teacherId;
    if (!assignedInst) return showToast('담당 강사를 지정해주세요.', 'error');

    setClasses([...classes, { id: Date.now().toString(), name: newClassName, days: newClassDays, instructorId: assignedInst, type: newClassType }]);
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
    setClasses(classes.map(c => c.id === editingClassId ? { ...c, ...editClassData } : c));
    setEditingClassId(null);
    showToast('반 정보가 수정되었습니다.');
  };

  // --- 학생 관리 로직 ---
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentSchool, setNewStudentSchool] = useState('');
  const [newStudentClass, setNewStudentClass] = useState('');

  const handleAddStudent = () => {
    if (isReadOnly) return;
    if (!newStudentName.trim() || !newStudentClass) return showToast('정보를 모두 입력해주세요.', 'error');
    setStudents([...students, { id: Date.now().toString(), name: newStudentName, school: newStudentSchool, classId: newStudentClass }]);
    setNewStudentName(''); setNewStudentSchool('');
    showToast('학생이 등록되었습니다.');
  };

  const startEditingStudent = (student) => {
    setEditingStudentId(student.id);
    setEditStudentData({ name: student.name, school: student.school, classId: student.classId });
  };

  const saveEditedStudent = () => {
    setStudents(students.map(s => s.id === editingStudentId ? { ...s, ...editStudentData } : s));
    setEditingStudentId(null);
    showToast('학생 정보가 수정되었습니다.');
  };

  const confirmDeleteStudent = () => {
    if (studentToDelete && !isReadOnly) {
      setStudents(students.filter(s => s.id !== studentToDelete));
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
    // 1. 강사 필터 적용 (관리자/행정팀 전용)
    let filtered = [...visibleStudents];
    if ((role === 'admin' || role === 'office') && filterInstructor) {
      filtered = filtered.filter(s => {
        const cls = classes.find(c => c.id === s.classId);
        return cls && cls.instructorId === filterInstructor;
      });
    }
    // 2. 정렬 적용
    return filtered.sort((a, b) => {
      let aVal = a[sortConfig.key]; let bVal = b[sortConfig.key];
      if (sortConfig.key === 'classId') {
        aVal = classes.find(c => c.id === a.classId)?.name || ''; bVal = classes.find(c => c.id === b.classId)?.name || '';
      }
      if (sortConfig.key === 'instructorId') { // 강사별 정렬 추가
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

  // --- 일일 출결/과제 로직 ---
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

  const handleSpecificDateRecordChange = (dateStr, studentId, field, value) => {
    if (isReadOnly) return;
    setRecords(prev => {
      const dateRecords = prev[dateStr] || {};
      return { ...prev, [dateStr]: { ...dateRecords, [studentId]: { ...(dateRecords[studentId] || { progress: 0, remark: '' }), [field]: value } } };
    });
  };

  const handleRecordChange = (studentId, field, value) => {
    handleSpecificDateRecordChange(selectedDate, studentId, field, value);
  };

  const handleQuickRemark = (dateStr, studentId, type) => {
    if (isReadOnly) return;
    setRecords(prev => {
      const dateRecords = prev[dateStr] || {};
      const studentRecord = dateRecords[studentId] || { progress: 0, remark: '' };
      let currentRemark = studentRecord.remark || '';
      let newProgress = studentRecord.progress;

      if (type === '결석') {
        currentRemark = currentRemark.replace(/지각/g, '').trim(); 
        if (currentRemark.includes('결석')) {
          currentRemark = currentRemark.replace(/결석/g, '').replace(/\s+/g, ' ').trim();
        } else {
          currentRemark = (currentRemark + ' 결석').trim();
          newProgress = 0;
        }
      } else if (type === '지각') {
        currentRemark = currentRemark.replace(/결석/g, '').trim(); 
        if (currentRemark.includes('지각')) {
          currentRemark = currentRemark.replace(/지각/g, '').replace(/\s+/g, ' ').trim();
        } else {
          currentRemark = (currentRemark + ' 지각').trim();
        }
      }
      return { ...prev, [dateStr]: { ...dateRecords, [studentId]: { ...studentRecord, remark: currentRemark, progress: newProgress } } };
    });
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

  const selectedDayOfWeek = getLocalDayOfWeek(selectedDate);
  const targetClasses = visibleClasses.filter(c => c.days.includes(selectedDayOfWeek));

  // --- 판서반(공통) 테스트 로직 ---
  const handleAddLectureTestRow = () => {
    if (isReadOnly || !testClassId) return;
    const newId = 'test_' + Date.now();
    setTestRecords(prev => ({ ...prev, [newId]: { id: newId, classId: testClassId, date: new Date().toISOString().split('T')[0], subject: '', totalQ: '', scores: {} } }));
  };

  const handleLectureTestChange = (testId, field, value) => {
    if (isReadOnly) return;
    setTestRecords(prev => ({ ...prev, [testId]: { ...prev[testId], [field]: value } }));
  };

  const handleDeleteTestRow = (testId) => {
    if (isReadOnly) return;
    setTestToDelete({ id: testId, type: 'lecture' });
  };

  const confirmDeleteTest = () => {
    if (testToDelete && !isReadOnly) {
      if (testToDelete.type === 'lecture') {
        setTestRecords(prev => { const copy = { ...prev }; delete copy[testToDelete.id]; return copy; });
      } else {
        setIndividualTestRecords(prev => { const copy = { ...prev }; delete copy[testToDelete.id]; return copy; });
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

    setTestRecords(prev => {
      const prevScores = prev[testId].scores[studentId] || {score: '', retest: ''};
      let newScores = { ...prevScores, [field]: numericValue };

      if (numericValue !== '' && totalQ > 0 && numericValue > totalQ) {
        const errorKey = `${testId}_${studentId}_${field}`;
        setTestErrors(e => ({ ...e, [errorKey]: true }));
        setTimeout(() => setTestErrors(e => ({ ...e, [errorKey]: false })), 2500);
        newScores[field] = ''; 
      } else if (field === 'score' && numericValue !== '' && totalQ > 0) {
        if (numericValue / totalQ >= 0.8) newScores.retest = ''; 
      }
      return { ...prev, [testId]: { ...prev[testId], scores: { ...prev[testId].scores, [studentId]: newScores } } };
    });
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
      showToast("개별진도반은 현재 CSV 다운로드 기능을 지원하지 않습니다. (추후 업데이트 예정)", "error");
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

  // --- 개별반(개인) 테스트 로직 ---
  const handleAddIndivTestRow = () => {
    if (isReadOnly || !testClassId || !selectedIndivStudent) return;
    const newId = 'itest_' + Date.now();
    setIndividualTestRecords(prev => ({ ...prev, [newId]: { id: newId, classId: testClassId, studentId: selectedIndivStudent, date: new Date().toISOString().split('T')[0], subject: '', totalQ: '', score: '', retest: '' } }));
  };

  const handleIndivTestChange = (testId, field, value) => {
    if (isReadOnly) return;
    const isNumField = field === 'totalQ' || field === 'score' || field === 'retest';
    const finalVal = isNumField ? (value === '' ? '' : Number(value)) : value;

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
          } else if (field === 'score') {
              if (totalQ > 0 && (finalVal / totalQ) >= 0.8) newRecord.retest = '';
          }
      }
      return { ...prev, [testId]: newRecord };
    });
  };

  // --- 결석/지각 자동 멘트 생성 (날짜만 단순 나열) ---
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

  // --- 리포트 생성 로직 ---
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
    let currentItemTpl = testItemTemplate;
    const currentWeeklyProgress = isIndiv ? (individualWeeklyProgress[student.id] || '') : (classWeeklyProgress[student.classId] || '');

    if (isIndiv) {
      currentItemTpl = currentItemTpl.replace(/\n?반 평균 : \[반평균\]/g, '').replace(/\[반평균\]/g, '');
      Object.values(individualTestRecords).sort((a,b)=>a.date.localeCompare(b.date)).forEach(t => {
        if (t.studentId === student.id && t.date >= reportStartDate && t.date <= reportEndDate) {
          if (t.score !== '') {
            const activeScore = t.retest !== '' && t.retest !== undefined ? Number(t.retest) : Number(t.score);
            tests.push({ subject: t.subject, score: activeScore, totalQ: t.totalQ, isPass: (Number(t.totalQ) > 0 && (activeScore / Number(t.totalQ)) >= 0.8), classAvg: '' });
          }
        }
      });
    } else {
      Object.entries(testRecords).sort(([, a], [, b]) => a.date.localeCompare(b.date)).forEach(([testId, testData]) => {
        if (testData.classId === student.classId && testData.date >= reportStartDate && testData.date <= reportEndDate) {
          const sInfo = testData.scores[student.id];
          if (sInfo && sInfo.score !== '') {
            const activeScore = sInfo.retest !== '' && sInfo.retest !== undefined ? Number(sInfo.retest) : Number(sInfo.score);
            const classAvgStr = `${calculateTestAverage(testId)} / ${testData.totalQ||'?'}`;
            tests.push({ subject: testData.subject, score: activeScore, totalQ: testData.totalQ, isPass: (Number(testData.totalQ) > 0 && (activeScore / Number(testData.totalQ)) >= 0.8), classAvg: classAvgStr });
          }
        }
      });
    }

    const stdRecords = Object.values(records).filter((_, i) => Object.keys(records)[i] >= reportStartDate && Object.keys(records)[i] <= reportEndDate).map(d => d[student.id]).filter(r => r && r.progress !== undefined);
    const avgProgress = stdRecords.length > 0 ? Math.round(stdRecords.reduce((sum, r) => sum + r.progress, 0) / stdRecords.length) : 0;
    
    const autoRemark = getAutoAttendanceRemark(student.id);
    const manualRemark = reportRemarks[student.id] !== undefined ? reportRemarks[student.id] : autoRemark;
    
    return buildReportText(offlineTemplate, currentItemTpl, noTestMessage, student.name, avgProgress, currentWeeklyProgress, manualRemark, tests);
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

  return (
    <div className={`min-h-screen p-4 md:p-8 font-sans relative ${isReadOnly ? 'bg-emerald-50' : 'bg-gray-50'}`}>
      <style>{`
        input[type="number"]::-webkit-outer-spin-button, input[type="number"]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
      `}</style>

      {/* --- 공통 토스트 알림 컴포넌트 --- */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-3 rounded-lg shadow-xl font-bold text-sm flex items-center gap-2 transition-all ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'}`}>
          <Check size={16} className={toast.type === 'error' ? 'hidden' : 'block'} />
          <AlertCircle size={16} className={toast.type === 'error' ? 'block' : 'hidden'} />
          {toast.message}
        </div>
      )}

      {/* --- 반 삭제 경고 모달 (학생 존재시) --- */}
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

      {/* --- 반 삭제 확인 모달 (학생 0명) --- */}
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

      {/* --- 학생 삭제 확인 모달 --- */}
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

      {/* --- 테스트 기록 삭제 확인 모달 --- */}
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
            <span className="text-xs text-gray-500">{role === 'admin' ? '👑 관리자' : role === 'office' ? '🏢 행정팀' : '👨‍🏫 강사'} 계정 접속중</span>
          </div>
          <button onClick={() => { setRole(null); localStorage.removeItem('userRole'); localStorage.removeItem('teacherId'); }} className="flex items-center gap-1 text-sm text-gray-500 hover:text-red-500 font-bold"><LogOut size={16}/> 로그아웃</button>
        </header>

        {isReadOnly && (
          <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-lg border border-emerald-200 flex items-center gap-2 text-sm font-bold shadow-sm">
            <Lock size={16} className="text-emerald-600" /> 행정팀 전용 (읽기 전용) 모드입니다. 데이터 열람 및 복사만 가능하며 안전하게 보호됩니다.
          </div>
        )}

        <div className="flex flex-wrap gap-2 border-b mb-6 overflow-x-auto pb-1">
          {role === 'admin' && <button onClick={() => setActiveTab('instructors')} className={`px-4 py-2.5 text-sm font-bold rounded-t-lg ${activeTab === 'instructors' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-200'}`}>강사 관리</button>}
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
              onClick={() => setActiveTab(tab.id)}
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 min-h-[500px]">
          
          {/* 강사 관리 */}
          {role === 'admin' && activeTab === 'instructors' && (
             <div>
               <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
                 <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><UserCog size={18}/> 신규 강사 계정 생성</h3>
                 <div className="flex flex-wrap gap-4 items-end">
                   <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">강사 이름</label><input type="text" value={newInstName} onChange={e=>setNewInstName(e.target.value)} placeholder="예) 홍길동" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                   <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">아이디</label><input type="text" value={newInstId} onChange={e=>setNewInstId(e.target.value)} placeholder="teacher_01" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                   <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">비밀번호</label><input type="text" value={newInstPw} onChange={e=>setNewInstPw(e.target.value)} placeholder="임시 비밀번호" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                   <button onClick={handleAddInstructor} className="bg-blue-800 text-white px-6 py-2 rounded font-bold hover:bg-blue-900 transition-colors">생성</button>
                 </div>
               </div>
               <table className="w-full text-left border-collapse border border-gray-200">
                  <thead><tr className="bg-gray-100 text-gray-700 text-sm border-b"><th className="p-3">강사명</th><th className="p-3">아이디</th><th className="p-3">비밀번호</th><th className="p-3 text-center">관리</th></tr></thead>
                  <tbody className="divide-y divide-gray-100">
                    {instructors.map(inst => (
                      <tr key={inst.id}><td className="p-3 font-medium">{inst.name}</td><td className="p-3 text-gray-600">{inst.username}</td><td className="p-3 text-gray-600">{inst.password}</td><td className="p-3 text-center"><button onClick={()=>handleDeleteInstructor(inst.id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded"><Trash2 size={16}/></button></td></tr>
                    ))}
                  </tbody>
               </table>
             </div>
          )}

          {/* 반 관리 */}
          {activeTab === 'classes' && (
            <div>
              {!isReadOnly && (
                <div className="bg-gray-50 p-6 rounded-lg mb-8 border border-gray-200">
                  <h3 className="font-semibold text-gray-700 mb-4">새로운 반 추가</h3>
                  <div className="flex flex-col md:flex-row gap-4 mb-4">
                    <div className="flex-1"><label className="block text-xs font-medium text-gray-500 mb-1">반 이름</label><input type="text" value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder="예) 월수금 중등기초반" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" /></div>
                    <div className="w-40"><label className="block text-xs font-medium text-gray-500 mb-1">수업 형태 (테스트 방식)</label>
                      <select value={newClassType} onChange={e => setNewClassType(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700">
                        <option value="lecture">칠판 판서반 (공통)</option>
                        <option value="individual">개별 진도반 (개별)</option>
                      </select>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleClasses.map((cls, idx) => {
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
                              <button key={day.val} onClick={() => setEditClassData(prev => ({...prev, days: prev.days.includes(day.val) ? prev.days.filter(d=>d!==day.val) : [...prev.days, day.val]}))} className={`text-xs px-2 py-1 rounded border transition-colors ${editClassData.days.includes(day.val) ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{day.label}</button>
                            ))}
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
                        <h4 className={`font-bold text-lg ${color.text}`}>{cls.name}</h4>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${cls.type === 'individual' ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>{cls.type === 'individual' ? '개별반' : '판서반'}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 mb-3">{cls.days.map(d => (<span key={d} className={`text-xs ${color.bg} ${color.text} px-2 py-1 rounded border ${color.border}`}>{DAYS.find(day => day.val === d)?.label}</span>))}</div>
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

          {/* 학생 관리 */}
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
              
              {/* 관리자/행정팀용 강사 필터 드롭다운 */}
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

          {/* 일일 출결/과제 */}
          {activeTab === 'daily' && (
            <div>
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6 bg-blue-50 p-4 rounded-lg border border-blue-100">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-blue-600" />
                  <label className="font-semibold text-gray-700 whitespace-nowrap">기준 날짜:</label>
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-blue-500 outline-none w-36" />
                </div>
                <div className="flex items-center gap-1 md:ml-auto bg-white p-1 rounded-md border border-gray-200 shadow-sm overflow-x-auto">
                  {getWeekDays(selectedDate).map((dateStr, idx) => {
                    const [, m, d] = dateStr.split('-');
                    const label = `${['월', '화', '수', '목', '금', '토'][idx]} (${Number(m)}/${Number(d)})`;
                    const isSelected = dateStr === selectedDate;
                    return (
                      <button key={dateStr} onClick={() => setSelectedDate(dateStr)} className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap ${isSelected ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
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
                                const record = (records[selectedDate] && records[selectedDate][student.id]) || { progress: 0, remark: '' };
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
                                      <div className={`flex w-full bg-gray-100 rounded-md overflow-hidden border border-gray-200 ${isReadOnly ? 'pointer-events-none' : ''}`}>
                                        {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((val) => (
                                          <button key={val} onClick={() => handleRecordChange(student.id, 'progress', val)}
                                            className={`flex-1 h-8 text-[10px] font-medium transition-colors outline-none
                                              ${record.progress === val ? 'bg-blue-600 text-white font-bold scale-105 shadow-sm relative z-10' : 'text-gray-500 hover:bg-gray-200'}
                                              ${record.progress === 100 && val === 100 ? '!bg-green-500' : ''}`}
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
                                const validProgs = weekDates.map(d => records[d]?.[student.id]?.progress).filter(p => p !== undefined);
                                const avg = validProgs.length ? Math.round(validProgs.reduce((a,b)=>a+b,0)/validProgs.length) : 0;

                                return (
                                  <tr key={student.id} className="border-b border-gray-100 hover:bg-gray-50">
                                    <td className="p-3 border-r font-medium whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50 z-10">{student.name}</td>
                                    {weekDates.map(d => {
                                      const record = records[d]?.[student.id] || { progress: 0, remark: '' };
                                      return (
                                        <td key={d} className="p-3 border-r text-left align-top">
                                          <div className="flex flex-col gap-2">
                                            <div className="text-xs font-medium text-gray-600 flex justify-between items-center">
                                              <span>과제 달성률</span>
                                              <span className={`font-bold ${record.progress === 100 ? 'text-green-600' : 'text-blue-600'}`}>{record.progress}%</span>
                                            </div>
                                            <div className="flex w-full bg-gray-100 rounded-md overflow-hidden border border-gray-200">
                                              {[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(val => (
                                                <button key={val} onClick={() => handleSpecificDateRecordChange(d, student.id, 'progress', val)}
                                                  className={`flex-1 h-7 text-[9px] font-medium transition-colors outline-none
                                                    ${record.progress === val ? 'bg-blue-600 text-white font-bold shadow-sm relative z-10' : 'text-gray-500 hover:bg-gray-200'}
                                                    ${record.progress === 100 && val === 100 ? '!bg-green-500' : ''}`}
                                                >
                                                  {val === 0 || val === 100 ? `${val}%` : val}
                                                </button>
                                              ))}
                                            </div>
                                            <div className="flex items-center gap-1 mt-1">
                                              <input type="text" placeholder="특이사항 입력" value={record.remark} onChange={(e) => handleSpecificDateRecordChange(d, student.id, 'remark', e.target.value)} className="flex-1 w-full border border-gray-300 rounded p-1.5 text-xs focus:ring-1 focus:ring-blue-500 outline-none min-w-[80px]" />
                                              <button onClick={() => importPreviousRemark(student.id, d)} title="이전 특이사항 복사" className="text-gray-400 hover:text-blue-600 p-1.5 bg-gray-50 border border-gray-200 hover:bg-blue-50 rounded transition-colors flex-shrink-0"><Copy size={14}/></button>
                                              <button onClick={() => handleQuickRemark(d, student.id, '결석')} className={`px-1.5 py-1 text-[10px] font-bold rounded border transition-colors flex-shrink-0 ${record.remark.includes('결석') ? 'bg-red-500 text-white border-red-600' : 'bg-red-50 text-red-600 border-red-100 hover:bg-red-100'}`}>결석</button>
                                              <button onClick={() => handleQuickRemark(d, student.id, '지각')} className={`px-1.5 py-1 text-[10px] font-bold rounded border transition-colors flex-shrink-0 ${record.remark.includes('지각') ? 'bg-orange-500 text-white border-orange-600' : 'bg-orange-50 text-orange-600 border-orange-100 hover:bg-orange-100'}`}>지각</button>
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

          {/* 주간 테스트 */}
          {activeTab === 'tests' && (
            <div>
              <div className="flex flex-wrap gap-4 items-end mb-6 bg-purple-50 p-4 rounded-lg border border-purple-100">
                <div className="flex-1 min-w-[200px] max-w-xs">
                  <label className="block text-xs font-bold text-purple-800 mb-1">대상 반 선택</label>
                  <select value={testClassId} onChange={e => { setTestClassId(e.target.value); setSelectedIndivStudent(null); }} className="w-full border border-purple-200 rounded-md p-2 focus:ring-2 focus:ring-purple-500 outline-none bg-white font-bold text-gray-700">
                    <option value="">반을 선택해주세요...</option>
                    {visibleClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type==='individual'?'개별':'판서'})</option>)}
                  </select>
                </div>
                {testClassId && visibleClasses.find(c => c.id === testClassId)?.type !== 'individual' && !isReadOnly && (
                  <button onClick={handleAddLectureTestRow} className="bg-purple-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-purple-700 shadow-sm font-bold"><Plus size={18} /> 공통 테스트 항목 추가</button>
                )}
                {testClassId && visibleClasses.find(c => c.id === testClassId)?.type !== 'individual' && (
                  <button onClick={handleExportCSV} className="bg-green-600 text-white px-4 py-2 rounded-md flex items-center gap-2 hover:bg-green-700 shadow-sm font-bold"><Download size={18} /> CSV 다운로드</button>
                )}
              </div>

              {!testClassId ? (
                <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl">대상 반을 먼저 선택해주세요.</div>
              ) : (
                (() => {
                  const selectedClass = visibleClasses.find(c => c.id === testClassId);
                  const isIndividual = selectedClass?.type === 'individual';
                  const classStds = visibleStudents.filter(s => s.classId === testClassId).sort((a,b)=>a.name.localeCompare(b.name, 'ko-KR'));

                  if (isIndividual) {
                    // --- 개별반 렌더링 로직 ---
                    if (classStds.length === 0) return <div className="text-center p-8 text-gray-500">학생을 먼저 추가해주세요.</div>;
                    if (!selectedIndivStudent && classStds.length > 0) setSelectedIndivStudent(classStds[0].id);

                    const indivTests = Object.values(individualTestRecords).filter(t => t.studentId === selectedIndivStudent).sort((a,b) => a.date.localeCompare(b.date));

                    return (
                      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="flex bg-gray-100 border-b border-gray-200 overflow-x-auto">
                          {classStds.map(std => (
                            <button key={std.id} onClick={() => setSelectedIndivStudent(std.id)} className={`px-6 py-3 font-bold text-sm whitespace-nowrap transition-colors ${selectedIndivStudent === std.id ? 'bg-white text-purple-700 border-t-2 border-purple-600' : 'text-gray-500 hover:bg-gray-200'}`}>
                              {std.name}
                            </button>
                          ))}
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-lg text-gray-800">{classStds.find(s=>s.id===selectedIndivStudent)?.name} 학생 테스트 기록</h4>
                            {!isReadOnly && <button onClick={handleAddIndivTestRow} className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded font-bold text-sm hover:bg-purple-200 flex items-center gap-1"><Plus size={16}/> 새 테스트 기록</button>}
                          </div>
                          <div className="overflow-x-auto pb-4">
                            <table className="w-full text-center min-w-[700px] border-collapse">
                              <thead>
                                <tr className="bg-purple-50 text-purple-900 text-sm font-bold border-y border-purple-200">
                                  <th className="p-2 border-r border-purple-100 w-36">시험날짜</th>
                                  <th className="p-2 border-r border-purple-100 min-w-[200px]">테스트 과정명 (자동줄바꿈)</th>
                                  <th className="p-2 border-r border-purple-100 w-16">총문제</th>
                                  <th className="p-2 border-r border-purple-100 w-16">점수</th>
                                  <th className="p-2 border-r border-purple-100 w-16">재시</th>
                                  {!isReadOnly && <th className="p-2 w-12">삭제</th>}
                                </tr>
                              </thead>
                              <tbody className={`divide-y divide-gray-200 border-b border-gray-200 ${isReadOnly ? 'pointer-events-none' : ''}`}>
                                {indivTests.map(test => {
                                  const tQ = Number(test.totalQ);
                                  const hasScore = test.score !== '';
                                  const isInitialPass = hasScore && tQ > 0 && (Number(test.score) / tQ >= 0.8);
                                  const hasRetest = test.retest !== '';
                                  const isRetestPass = hasRetest && tQ > 0 && (Number(test.retest) / tQ >= 0.8);
                                  
                                  const scoreError = testErrors[`${test.id}_score`];
                                  const retestError = testErrors[`${test.id}_retest`];

                                  return (
                                    <tr key={test.id} className="hover:bg-gray-50 group">
                                      <td className="p-2 border-r border-gray-200">
                                        <input type="date" value={test.date} onChange={e => handleIndivTestChange(test.id, 'date', e.target.value)} className="w-full text-center outline-none bg-transparent focus:ring-2 focus:ring-purple-500 rounded text-sm"/>
                                        <div className="text-[10px] text-gray-400 mt-0.5">{getDayName(test.date)}요일</div>
                                      </td>
                                      <td className="p-2 border-r border-gray-200 text-left">
                                        <AutoResizeTextarea value={test.subject} onChange={e => handleIndivTestChange(test.id, 'subject', e.target.value)} placeholder="단원명 입력" className="w-full text-sm outline-none bg-transparent focus:ring-2 focus:ring-purple-500 rounded p-1" />
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
                                {indivTests.length === 0 && <tr><td colSpan={isReadOnly ? "5" : "6"} className="py-10 text-gray-400">등록된 테스트 기록이 없습니다.</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    // --- 판서반(공통) 렌더링 로직 ---
                    return (
                      <div className="border border-gray-200 rounded-xl shadow-sm overflow-x-auto bg-white">
                        <table className="w-full text-center min-w-max border-collapse">
                          <thead>
                            <tr className="bg-purple-50 text-purple-900 text-sm font-bold border-b border-purple-200">
                              <th className="p-3 border-r border-purple-100 w-36 sticky left-0 bg-purple-50 z-10 shadow-[1px_0_0_#e9d5ff]">시험날짜</th>
                              <th className="p-3 border-r border-purple-100 min-w-[200px]">공통 과정명 (단원명)</th>
                              <th className="p-3 border-r border-purple-100 w-16">총문제</th>
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
                                <td className="p-2 border-r border-gray-200 sticky left-0 bg-white group-hover:bg-gray-50 z-10 shadow-[1px_0_0_#e5e7eb]">
                                  <input type="date" value={test.date} onChange={(e) => handleLectureTestChange(test.id, 'date', e.target.value)} className="w-full bg-transparent text-center outline-none focus:ring-2 focus:ring-purple-500 rounded text-sm"/>
                                  <div className="text-[10px] text-gray-400 mt-0.5">{getDayName(test.date)}요일</div>
                                </td>
                                <td className="p-2 border-r border-gray-200 text-left">
                                  <AutoResizeTextarea value={test.subject} onChange={(e) => handleLectureTestChange(test.id, 'subject', e.target.value)} placeholder="단원명 입력" className="w-full outline-none bg-transparent focus:ring-2 focus:ring-purple-500 rounded p-1"/>
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

          {/* 주간 리포트 */}
          {activeTab === 'report' && (
            <div className="space-y-6 pointer-events-auto">
              <div className="bg-gradient-to-r from-blue-50 border border-blue-100 to-indigo-50 p-6 rounded-xl mb-8 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-indigo-900 mb-1 flex items-center gap-2"><ClipboardList className="text-indigo-500" size={20} /> 학부모 전송 리포트 생성기</h3>
                    <p className="text-sm text-indigo-700">기본양식(오프라인)을 바탕으로 이번 주 누적 데이터를 취합합니다.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-lg border border-indigo-100">
                  <div><label className="block text-xs font-bold text-indigo-800 mb-1">시작일 (월)</label><input type="date" value={reportStartDate} onChange={(e) => setReportStartDate(e.target.value)} className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" /></div>
                  <div><label className="block text-xs font-bold text-indigo-800 mb-1">종료일 (토)</label><input type="date" value={reportEndDate} onChange={(e) => setReportEndDate(e.target.value)} className="border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-medium" /></div>
                  <div className="flex-1 min-w-[200px]"><label className="block text-xs font-bold text-indigo-800 mb-1">대상 반 선택</label>
                    <select value={reportClassId} onChange={e => setReportClassId(e.target.value)} className="w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-gray-800">
                      <option value="">반을 선택하세요...</option>
                      {visibleClasses.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type==='individual'?'개별':'판서'})</option>)}
                    </select>
                  </div>
                </div>
                
                {reportClassId && visibleClasses.find(c => c.id === reportClassId)?.type !== 'individual' && (
                  <div className="mt-4">
                    <label className="block text-xs font-bold text-indigo-800 mb-1">이번 주 공통 진도 (판서반)</label>
                    <input type="text" value={classWeeklyProgress[reportClassId] || ''} onChange={(e) => {if(!isReadOnly) setClassWeeklyProgress(prev => ({...prev, [reportClassId]: e.target.value}))}} readOnly={isReadOnly} placeholder="예) 다항식의 연산 전체" className={`w-full border border-gray-300 rounded-md p-2 focus:ring-2 focus:ring-indigo-500 outline-none ${isReadOnly ? 'bg-gray-50' : 'bg-white'}`} />
                  </div>
                )}
              </div>

              {reportClassId ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {visibleStudents.filter(s => s.classId === reportClassId).sort((a,b) => a.name.localeCompare(b.name, 'ko-KR')).map(student => {
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
                            <button onClick={() => {if(!isReadOnly) setExcludeFromReport(prev => ({...prev, [student.id]: !prev[student.id]}))}} disabled={isReadOnly} className={`px-2.5 py-1.5 rounded text-xs font-bold transition flex items-center gap-1 border ${isExcluded ? 'bg-red-50 text-red-600 border-red-200' : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'}`}>
                              {isExcluded ? <Check size={12}/> : <X size={12}/>} {isExcluded ? '전송 포함하기' : '전송 제외'}
                            </button>
                          </div>
                        </div>
                        
                        <div className={`flex flex-col flex-1 gap-3 relative z-10 transition-all ${isExcluded ? 'opacity-30 grayscale pointer-events-none select-none' : ''}`}>
                          
                          <div>
                            {visibleClasses.find(c => c.id === student.classId)?.type === 'individual' && (
                              <input type="text" value={individualWeeklyProgress[student.id] || ''} onChange={(e) => {if(!isReadOnly) setIndividualWeeklyProgress(prev => ({...prev, [student.id]: e.target.value}))}} readOnly={isReadOnly} placeholder="학생 개별 주간 진도 입력" className={`w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-3 ${isReadOnly ? 'bg-gray-50' : 'bg-indigo-50/50'}`} />
                            )}
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">선생님 특별 비고 작성란 (결석/지각 날짜가 표기되어 있습니다)</label>
                            <textarea value={manualRemark} onChange={(e) => {if(!isReadOnly) setReportRemarks(prev => ({...prev, [student.id]: e.target.value}))}} readOnly={isReadOnly} placeholder="이번 주 지각/결석 기록이 자동으로 표시되며, 추가할 내용을 자유롭게 적어주세요." className={`w-full border border-gray-300 rounded-md p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-y h-20 ${isReadOnly ? 'bg-gray-100 text-gray-600' : 'bg-yellow-50/30'}`} />
                          </div>
                          
                          <div className="relative flex-1 flex flex-col">
                            <label className="text-[10px] font-bold text-gray-500 mb-1 block">최종 전송 텍스트 (자동 생성됨)</label>
                            <textarea value={currentReportText} readOnly className="w-full h-full min-h-[250px] border border-gray-200 rounded-md p-4 text-gray-800 bg-gray-50 outline-none resize-none text-sm leading-relaxed pb-12" />
                            <button onClick={() => handleCopy(currentReportText, student.id, currentWeeklyProgress)} disabled={isExcluded} className={`absolute bottom-3 right-3 text-white px-5 py-2 rounded shadow-md flex items-center gap-2 text-sm font-bold transition-colors disabled:opacity-50 ${copiedId === student.id ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-800 hover:bg-gray-900'}`}>
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

          {/* 설정 */}
          {activeTab === 'settings' && !isReadOnly && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* 관리자 전용 브라우저 탭 설정 */}
              {role === 'admin' && (
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
