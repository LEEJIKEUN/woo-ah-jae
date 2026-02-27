export default function UsagePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10 text-slate-100">
      <article className="space-y-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-6 md:p-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-extrabold tracking-tight">📢 WooAhJae 이용 안내 (필독)</h1>
          <p className="text-sm leading-7 text-slate-300">
            안녕하세요.
            <br />
            WooAhJae는 재외국민 및 국제학교 학생들을 위한 학습·프로젝트 협업 플랫폼입니다.
          </p>
          <p className="text-sm leading-7 text-slate-300">
            학생들이 스스로 프로젝트를 만들고, 함께 공부하며, 자신의 학습 과정을 체계적으로 관리할 수 있도록 설계되었습니다.
            <br />
            아래 이용 방법을 꼭 확인해 주세요.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1️⃣ 회원가입 및 승인</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>실명, 학교, 학년 정보를 정확히 입력해주세요.</li>
            <li>재학증명서 또는 학생증을 업로드하면 관리자가 확인 후 승인합니다.</li>
            <li>승인 완료 후 모든 기능을 이용할 수 있습니다.</li>
          </ul>
          <p className="text-sm text-slate-400">※ 승인 과정은 안전한 커뮤니티 운영을 위한 절차입니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2️⃣ 프로젝트 참여 방법</h2>
          <p className="text-sm leading-7 text-slate-300">WooAhJae의 핵심은 학생 주도 프로젝트 활동입니다.</p>
          <p className="text-sm font-semibold text-slate-200">✔ 프로젝트 둘러보기</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>교과 / 창체 / 교내대회 / 교외대회 / 공인시험 탭에서</li>
            <li>현재 모집 중인 프로젝트를 확인할 수 있습니다.</li>
          </ul>
          <p className="text-sm font-semibold text-slate-200">✔ 프로젝트 신청</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>상세보기를 눌러 프로젝트 설명 확인</li>
            <li>신청서 작성</li>
            <li>프로젝트 대표 학생의 승인 후 참여 가능</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">3️⃣ 프로젝트 협업 공간</h2>
          <p className="text-sm leading-7 text-slate-300">프로젝트에 참여하면 전용 협업 공간이 생성됩니다.</p>
          <p className="text-sm leading-7 text-slate-300">해당 공간에서:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>💬 팀 채팅 (실시간 소통)</li>
            <li>📂 파일 업로드 및 공유</li>
            <li>🎥 Zoom 회의 링크 공유</li>
            <li>📝 Google Docs / 스프레드시트 연동</li>
            <li>📢 공지 작성</li>
          </ul>
          <p className="text-sm leading-7 text-slate-300">등을 통해 실제 협업이 이루어집니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4️⃣ 내 정보 &gt; 주간 스터디 플래너</h2>
          <p className="text-sm leading-7 text-slate-300">WooAhJae는 단순 커뮤니티가 아니라 학습 관리 플랫폼입니다.</p>
          <p className="text-sm font-semibold text-slate-200">📅 주간 스터디 플래너 기능</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>요일별 학습 계획 입력</li>
            <li>목표 시간 설정</li>
            <li>실제 공부 시간 기록</li>
            <li>달성률 자동 계산</li>
            <li>관리자 피드백 수신</li>
          </ul>
          <p className="text-sm text-slate-400">관리자가 남긴 피드백은 공지 형태로 상단에 표시됩니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">5️⃣ 수강과목 설정 및 활동 기록</h2>
          <p className="text-sm font-semibold text-slate-200">📚 1학기 / 2학기 과목 설정</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>과목을 직접 입력하여 추가</li>
            <li>각 과목 클릭 시 활동 기록 작성 가능</li>
          </ul>
          <p className="text-sm font-semibold text-slate-200">✍ 활동 기록 기능</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>텍스트 입력</li>
            <li>실시간 글자 수 표시</li>
            <li>바이트 수 계산</li>
            <li>1500자 제한 관리</li>
          </ul>
          <p className="text-sm text-slate-400">생기부·특례 준비에 활용할 수 있습니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">6️⃣ 서류설정 및 PDF 열람</h2>
          <p className="text-sm leading-7 text-slate-300">WooAhJae는 개인 서류 관리 기능도 제공합니다.</p>
          <p className="text-sm font-semibold text-slate-200">📄 업로드 가능 서류</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>자격 관련 서류</li>
            <li>생활기록부</li>
            <li>각종 증빙 자료</li>
          </ul>
          <p className="text-sm font-semibold text-slate-200">📘 PDF 전자 열람 기능</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>웹 상에서 전자책처럼 열람</li>
            <li>확대/축소</li>
            <li>펜/형광펜/밑줄 기능</li>
            <li>주석 저장 가능</li>
          </ul>
          <p className="text-sm text-slate-400">설정완료로 표시한 문서는 상단에 고정됩니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">7️⃣ 커뮤니티 게시판</h2>
          <p className="text-sm leading-7 text-slate-300">학습+입시 정보 공유 게시판에서는:</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>특례 자격 조건</li>
            <li>재외국민 전형 정보</li>
            <li>공인시험 정보</li>
            <li>외국대 전형</li>
            <li>과목별 정보</li>
          </ul>
          <p className="text-sm leading-7 text-slate-300">를 자유롭게 공유할 수 있습니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">8️⃣ 현재 서비스 상태 안내</h2>
          <p className="text-sm leading-7 text-slate-300">WooAhJae는 현재 지속적으로 개선 중인 플랫폼입니다.</p>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>기능이 업데이트될 수 있습니다.</li>
            <li>UI가 일부 변경될 수 있습니다.</li>
            <li>새로운 기능이 추가될 수 있습니다.</li>
          </ul>
          <p className="text-sm text-slate-400">보다 나은 학습 환경을 만들기 위한 과정이니 양해 부탁드립니다.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">9️⃣ 이용 시 유의사항</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm leading-7 text-slate-300">
            <li>허위 정보 기재 금지</li>
            <li>타인 비방 금지</li>
            <li>자료 무단 공유 금지</li>
            <li>개인정보 보호 유의</li>
          </ul>
          <p className="text-sm text-slate-400">커뮤니티 질서를 지켜주세요.</p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">🔟 앞으로의 방향</h2>
          <p className="text-sm leading-7 text-slate-300">WooAhJae는 단순 정보 공유 사이트가 아니라,</p>
          <blockquote className="space-y-1 border-l-2 border-slate-500 pl-4 text-sm leading-7 text-slate-300">
            <p>학생들이 스스로 기획하고</p>
            <p>함께 연구하고</p>
            <p>성장 과정을 기록하는 공간</p>
          </blockquote>
          <p className="text-sm leading-7 text-slate-300">이 되는 것을 목표로 합니다.</p>
          <p className="text-sm leading-7 text-slate-300">여러분의 적극적인 참여가 플랫폼을 성장시킵니다.</p>
          <p className="text-sm leading-7 text-slate-300">감사합니다.</p>
        </section>
      </article>
    </main>
  );
}

