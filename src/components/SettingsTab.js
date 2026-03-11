import React from 'react';
import { Download, Sparkles, Loader2, AlertCircle, Eye, Settings } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';

export default function SettingsTab({
  isReadOnly,
  role,
  handleExportAllDataToJSON,
  handleBackupToGoogleDrive,
  isDriveSyncing,
  setTestRecords,
  setIndividualTestRecords,
  db,
  appId,
  systemSettings,
  setSystemSettings,
  restoreDefaultTemplates,
  offlineTemplate,
  setOfflineTemplate,
  testItemTemplate,
  setTestItemTemplate,
  noTestMessage,
  setNoTestMessage
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 1. 데이터 백업 기능 블록 */}
      <div className="bg-green-50 p-6 rounded-xl border border-green-200 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-green-900 mb-2 flex items-center gap-2"><Download size={20} /> 전체 시스템 데이터 백업</h3>
        <p className="text-sm text-green-700 mb-4">학원의 모든 데이터(강사, 반, 학생, 성적 등)를 백업합니다. PC 다운로드 또는 구글 드라이브 저장을 선택하세요.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExportAllDataToJSON} className="bg-green-600 text-white px-4 py-2 rounded font-bold hover:bg-green-700 shadow-sm flex items-center gap-2 w-fit transition">
            <Download size={18} /> PC로 파일 다운로드
          </button>
          <button onClick={handleBackupToGoogleDrive} disabled={isDriveSyncing} className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow-sm flex items-center gap-2 w-fit transition disabled:opacity-50">
            {isDriveSyncing ? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18} />}
            {isDriveSyncing ? '클라우드 전송 중...' : '구글 드라이브에 백업하기'}
          </button>
        </div>
      </div>

      {/* 2. 관리자 전용 기능 묶음 */}
      {role === 'admin' && (
        <>
          {/* 서버 데이터 강제 청소 */}
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

          {/* 시스템 외관 및 자동 백업 타이머 설정 */}
          <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><Eye size={20} className="text-blue-500" /> 시스템 외관 설정 (관리자 전용)</h3>
            <div className="flex flex-col gap-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-2">
                <label className="block text-sm font-bold text-blue-900 mb-1 flex items-center gap-2">⏰ 클라우드 자동 백업 시간 설정</label>
                <p className="text-[11px] text-blue-700 mb-2">지정된 시간이 지나고 관리자 계정으로 접속 중일 때 백그라운드에서 구글 드라이브로 1회 자동 전송됩니다.</p>
                <input type="time" value={systemSettings?.autoBackupTime || ''} onChange={(e) => setSystemSettings(prev => ({...prev, autoBackupTime: e.target.value}))} className="w-40 border border-blue-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white font-bold" />
                <button onClick={() => setSystemSettings(prev => ({...prev, autoBackupTime: ''}))} className="ml-2 text-xs text-gray-500 underline hover:text-gray-700">시간 해제(자동백업 끄기)</button>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">브라우저 탭 이름 (Title)</label>
                <input type="text" value={systemSettings?.title || ''} onChange={(e) => setSystemSettings(prev => ({...prev, title: e.target.value}))} placeholder="예: 임팩트 수학학원" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">브라우저 아이콘 (Favicon URL)</label>
                <p className="text-[10px] text-gray-500 mb-1">인터넷에 올려진 이미지 주소(http://...)를 입력하세요. (.png, .ico 권장)</p>
                <input type="text" value={systemSettings?.iconUrl || ''} onChange={(e) => setSystemSettings(prev => ({...prev, iconUrl: e.target.value}))} placeholder="예: [https://example.com/icon.png](https://example.com/icon.png)" className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50" />
              </div>
            </div>
          </div>
        </>
      )}

      {/* 3. 리포트 기본 양식 템플릿 설정 */}
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
  );
}
