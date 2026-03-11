import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';

// 1. 빈 창고(Context) 생성
const AcademyContext = createContext();

// 2. 다른 파일에서 창고 데이터를 쉽게 꺼내 쓰기 위한 도구(Custom Hook)
export const useAcademy = () => useContext(AcademyContext);

// 3. 창고 관리인(Provider) 컴포넌트
export const AcademyProvider = ({ children, db, appId, user, isReadOnly }) => {
  const [isLoaded, setIsLoaded] = useState(false);

  // 로컬 초기 데이터 로더
  const loadData = (key, defaultData) => {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : null;
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0) || (typeof parsed === 'object' && Object.keys(parsed).length === 0)) {
      return defaultData;
    }
    return parsed;
  };

  // --- 중앙 집중 관리 상태(State)들 ---
  const [instructors, setInstructors] = useState(() => loadData('instructors', [{ id: 't1', username: 'teacher', password: '1234', name: '김선생' }]));
  const [classes, setClasses] = useState(() => loadData('classes', [
    { id: 'c1', name: '1 월금반', days: [1, 5], instructorId: 't1', type: 'lecture' },
    { id: 'c2', name: '2 월수금반', days: [1, 3, 5], instructorId: 't1', type: 'lecture' },
    { id: 'c3', name: '3 수토반', days: [3, 6], instructorId: 't1', type: 'individual' }
  ]));
  const [students, setStudents] = useState(() => loadData('students', [
    { id: 's1', name: '홍길동', school: '가나중', classId: 'c1' },
    { id: 's2', name: '홍이동', school: '가나중', classId: 'c1' },
    { id: 's4', name: '삼길동', school: '다라중', classId: 'c2' },
    { id: 's7', name: '어리기', school: '마바중', classId: 'c3' },
  ]));
  const [records, setRecords] = useState({});
  const [testRecords, setTestRecords] = useState({});
  const [individualTestRecords, setIndividualTestRecords] = useState({});
  const [reportRemarks, setReportRemarks] = useState({});
  const [excludeFromReport, setExcludeFromReport] = useState({});
  const [classWeeklyProgress, setClassWeeklyProgress] = useState({});
  const [individualWeeklyProgress, setIndividualWeeklyProgress] = useState({});
  
  const [systemSettings, setSystemSettings] = useState(() => loadData('systemSettings', { title: '임팩트 수학학원', iconUrl: '' }));
  
  const DEFAULT_TEMPLATE = `안녕하세요. 임팩트수학학원 [학생이름]학생 담임입니다.\n\n주간 테스트 결과 및 성취도 안내드립니다.\n[테스트결과목록]\n과제물 성취도 : 평균 [과제성취도]%\n주간 진도 : [주간진도]\n\n비고 : [비고]`;
  const DEFAULT_TEST_ITEM_TEMPLATE = `테스트 과정 : [단원명]\n테스트 결과 : [맞은개수]/[총문제수] [통과여부]\n반 평균 : [반평균]`;
  const DEFAULT_NO_TEST_MSG = `이번 주 진행된 테스트가 없습니다.`;

  const [offlineTemplate, setOfflineTemplate] = useState(DEFAULT_TEMPLATE);
  const [testItemTemplate, setTestItemTemplate] = useState(DEFAULT_TEST_ITEM_TEMPLATE);
  const [noTestMessage, setNoTestMessage] = useState(DEFAULT_NO_TEST_MSG);

  // --- 인간 개입(잠금 해제) 로직 ---
  const isUserInteraction = useRef(false);
  const initialDataSnapshot = useRef({});

  useEffect(() => {
    const unlockSync = () => { isUserInteraction.current = true; };
    window.addEventListener('mousedown', unlockSync, { once: true });
    window.addEventListener('keydown', unlockSync, { once: true });
    window.addEventListener('touchstart', unlockSync, { once: true });
    return () => {
      window.removeEventListener('mousedown', unlockSync);
      window.removeEventListener('keydown', unlockSync);
      window.removeEventListener('touchstart', unlockSync);
    };
  }, []);

  // --- DB 불러오기 ---
  useEffect(() => {
    let isMounted = true;
    const fetchDb = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
        const docSnap = await getDoc(docRef);
        if (!isMounted) return;
        
        if (docSnap.exists()) {
          const d = docSnap.data();
          initialDataSnapshot.current = JSON.parse(JSON.stringify(d)); // 원본 박제

          if(d.instructors) setInstructors(d.instructors);
          if(d.classes) setClasses(d.classes);
          if(d.students) setStudents(d.students);
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
  }, [user, db, appId]);

  // --- 스마트 DB 동기화 ---
  const syncData = async (key, value) => {
    if (!isLoaded || isReadOnly || !isUserInteraction.current) return;
    if (JSON.stringify(initialDataSnapshot.current[key]) === JSON.stringify(value)) return; 

    const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'academy', 'mainData');
    try {
      await updateDoc(docRef, { [key]: value });
      initialDataSnapshot.current[key] = JSON.parse(JSON.stringify(value));
    } catch (error) {
      if (error.code === 'not-found') { await setDoc(docRef, { [key]: value }); }
      else { console.error("Firebase 저장 에러:", error); }
    }
  };

  useEffect(() => { syncData('instructors', instructors); }, [instructors]);
  useEffect(() => { syncData('classes', classes); }, [classes]);
  useEffect(() => { syncData('students', students); }, [students]);
  useEffect(() => { syncData('records', records); }, [records]);
  useEffect(() => { syncData('testRecords', testRecords); }, [testRecords]);
  useEffect(() => { syncData('individualTestRecords', individualTestRecords); }, [individualTestRecords]);
  useEffect(() => { syncData('classWeeklyProgress', classWeeklyProgress); }, [classWeeklyProgress]);
  useEffect(() => { syncData('individualWeeklyProgress', individualWeeklyProgress); }, [individualWeeklyProgress]);
  useEffect(() => { syncData('reportRemarks', reportRemarks); }, [reportRemarks]);
  useEffect(() => { syncData('excludeFromReport', excludeFromReport); }, [excludeFromReport]);
  useEffect(() => { syncData('offlineTemplate', offlineTemplate); }, [offlineTemplate]);
  useEffect(() => { syncData('testItemTemplate', testItemTemplate); }, [testItemTemplate]);
  useEffect(() => { syncData('noTestMessage', noTestMessage); }, [noTestMessage]);
  useEffect(() => { syncData('systemSettings', systemSettings); }, [systemSettings]);

  // 4. 창고 데이터 방출 (Export)
  const value = {
    isLoaded,
    instructors, setInstructors,
    classes, setClasses,
    students, setStudents,
    records, setRecords,
    testRecords, setTestRecords,
    individualTestRecords, setIndividualTestRecords,
    reportRemarks, setReportRemarks,
    excludeFromReport, setExcludeFromReport,
    classWeeklyProgress, setClassWeeklyProgress,
    individualWeeklyProgress, setIndividualWeeklyProgress,
    systemSettings, setSystemSettings,
    offlineTemplate, setOfflineTemplate,
    testItemTemplate, setTestItemTemplate,
    noTestMessage, setNoTestMessage,
    DEFAULT_TEMPLATE, DEFAULT_TEST_ITEM_TEMPLATE, DEFAULT_NO_TEST_MSG
  };

  return (
    <AcademyContext.Provider value={value}>
      {children}
    </AcademyContext.Provider>
  );
};
