const RESEND_API_URL = "https://api.resend.com/emails";

function getMailerConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }
  if (!from) {
    throw new Error("MAIL_FROM is not set");
  }
  if (!appUrl) {
    throw new Error("NEXT_PUBLIC_APP_URL or APP_URL is not set");
  }

  return { apiKey, from, appUrl };
}

async function postResend(params: {
  apiKey: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      text: params.text,
      html: params.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { id?: string };
  return payload.id ?? null;
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetUrl: string;
  expiresMinutes: number;
}) {
  const { apiKey, from } = getMailerConfig();

  const subject = "[Woo Ah Jae] 비밀번호 재설정 안내";
  const text = [
    "비밀번호 재설정 요청이 접수되었습니다.",
    `아래 링크를 클릭해 ${params.expiresMinutes}분 내에 비밀번호를 변경해 주세요.`,
    "",
    params.resetUrl,
    "",
    "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#0f172a;">
      <h2 style="margin:0 0 16px;">Woo Ah Jae 비밀번호 재설정</h2>
      <p>비밀번호 재설정 요청이 접수되었습니다.</p>
      <p>아래 버튼을 눌러 <strong>${params.expiresMinutes}분</strong> 내에 비밀번호를 변경해 주세요.</p>
      <p style="margin:20px 0;">
        <a href="${params.resetUrl}" style="background:#0f172a;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;display:inline-block;">비밀번호 재설정</a>
      </p>
      <p>버튼이 동작하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요.</p>
      <p><a href="${params.resetUrl}">${params.resetUrl}</a></p>
      <p style="margin-top:20px;color:#475569;">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
    </div>
  `;

  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

export async function sendParentConsentEmail(params: {
  to: string; // 자녀(학생) 이메일
  childName: string;
  parentName: string;
  parentEmail: string;
  consentUrl: string;
}) {
  const { apiKey, from } = getMailerConfig();

  const subject = "[우아재] 보호자 연결 동의 요청";
  const text = [
    `${params.childName} 님,`,
    "",
    `${params.parentName}(${params.parentEmail}) 님이 회원님의 보호자(학부모)임을 확인하고,`,
    "회원님의 강의 학습 현황과 탐구활동 멘토링 현황 열람에 대한 동의를 요청했습니다.",
    "",
    "본인의 보호자가 맞다면 아래 링크에서 '동의'를 눌러 주세요.",
    params.consentUrl,
    "",
    "본인이 모르는 요청이라면 무시하거나 '동의 안 함'을 눌러 주세요.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.7; color:#2c2823; max-width:520px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">보호자 연결 동의 요청</h2>
      <p><strong>${params.childName}</strong> 님,</p>
      <p><strong>${params.parentName}</strong> (${params.parentEmail}) 님이 회원님의 <strong>보호자(학부모)</strong>임을 확인하고,
      회원님의 <strong>강의 학습 현황</strong>과 <strong>탐구활동 멘토링 현황</strong>을 열람하는 것에 대한 동의를 요청했습니다.</p>
      <p>본인의 보호자가 맞다면 아래 버튼을 눌러 동의해 주세요. 동의하면 보호자가 바로 열람할 수 있습니다.</p>
      <p style="margin:22px 0;">
        <a href="${params.consentUrl}" style="background:#4E6B5A;color:#fff;padding:11px 20px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:700;">동의하러 가기</a>
      </p>
      <p style="color:#8A8479;">버튼이 동작하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요.</p>
      <p><a href="${params.consentUrl}">${params.consentUrl}</a></p>
      <p style="margin-top:18px; color:#8A8479;">본인이 모르는 요청이라면 이 메일을 무시하거나 링크에서 '동의 안 함'을 눌러 주세요.</p>
    </div>
  `;

  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

export async function sendEmailVerificationCode(params: {
  to: string;
  code: string;
  expiresMinutes: number;
}) {
  const { apiKey, from } = getMailerConfig();

  const subject = "[우아재] 이메일 인증 코드";
  const text = [
    "우아재 회원가입 이메일 인증 코드입니다.",
    "",
    `인증 코드: ${params.code}`,
    "",
    `이 코드는 ${params.expiresMinutes}분간 유효합니다.`,
    "본인이 요청하지 않았다면 이 메일을 무시해 주세요.",
  ].join("\n");

  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.6; color:#2c2823; max-width:480px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">우아재 이메일 인증</h2>
      <p>회원가입을 위한 이메일 인증 코드입니다. 아래 6자리 코드를 입력해 주세요.</p>
      <div style="margin:22px 0; padding:18px 0; text-align:center; background:#FBF8F2; border:1px solid #E4DBC7; border-radius:12px;">
        <span style="font-size:32px; font-weight:700; letter-spacing:10px; color:#6B5342;">${params.code}</span>
      </div>
      <p style="color:#8A8479;">이 코드는 <strong>${params.expiresMinutes}분</strong>간 유효합니다.</p>
      <p style="margin-top:18px; color:#8A8479;">본인이 요청하지 않았다면 이 메일을 무시해 주세요.</p>
    </div>
  `;

  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

export async function sendFacilitatorApprovalEmail(params: { to: string; name: string }) {
  const { apiKey, from } = getMailerConfig();
  const subject = "[우아재] 퍼실리테이터 인력풀 등록이 완료되었습니다";
  const text = [
    `${params.name}님, 안녕하세요.`,
    "",
    "우아재 퍼실리테이터 인력풀 등록이 완료되었습니다. 지원해 주셔서 감사합니다.",
    "앞으로 강좌가 배정될 때 담당자가 안내 전화를 드릴 예정입니다.",
    "",
    "[퍼실리테이터 역할 안내]",
    "- 담당 강좌의 학습 운영을 돕고, 수강생의 탐구활동을 멘토링합니다.",
    "- 과제·상호피드백 관리, 1:1 멘토링, 게시판 소통 등을 지원합니다.",
    "",
    "[성장 경로 (가안)]",
    "일정 기준(활동 성실도·수강생 만족도·운영 기여 등)에 따라",
    "멘토 → 우수 멘토 → 관리 멘토 로 승격할 수 있으며, 등급에 따라 시급도 인상됩니다.",
    "",
    "함께하게 되어 반갑습니다. 우아재 드림.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.7; color:#2c2823; max-width:560px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">퍼실리테이터 인력풀 등록 완료</h2>
      <p><strong>${params.name}</strong>님, 안녕하세요.</p>
      <p>우아재 <strong>퍼실리테이터 인력풀 등록이 완료</strong>되었습니다. 지원해 주셔서 감사합니다.<br/>앞으로 강좌가 배정될 때 담당자가 <strong>안내 전화</strong>를 드릴 예정입니다.</p>
      <div style="margin:18px 0; padding:14px 16px; background:#FBF8F2; border:1px solid #E4DBC7; border-radius:12px;">
        <p style="margin:0 0 6px; font-weight:700; color:#6B5342;">퍼실리테이터 역할</p>
        <p style="margin:0; color:#334155;">담당 강좌의 학습 운영을 돕고, 수강생의 탐구활동을 멘토링합니다. 과제·상호피드백 관리, 1:1 멘토링, 게시판 소통 등을 지원합니다.</p>
      </div>
      <div style="margin:18px 0; padding:14px 16px; background:#FBF8F2; border:1px solid #E4DBC7; border-radius:12px;">
        <p style="margin:0 0 6px; font-weight:700; color:#6B5342;">성장 경로 (가안)</p>
        <p style="margin:0; color:#334155;">활동 성실도·수강생 만족도·운영 기여 등 기준에 따라 <strong>멘토 → 우수 멘토 → 관리 멘토</strong>로 승격할 수 있으며, 등급에 따라 <strong>시급도 인상</strong>됩니다.</p>
      </div>
      <p style="color:#8A8479;">함께하게 되어 반갑습니다. — 우아재 드림</p>
    </div>
  `;
  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

export async function sendFacilitatorRejectionEmail(params: { to: string; name: string }) {
  const { apiKey, from } = getMailerConfig();
  const subject = "[우아재] 퍼실리테이터 지원 결과 안내";
  const text = [
    `${params.name}님, 안녕하세요.`,
    "",
    "우아재 퍼실리테이터에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.",
    "아쉽게도 이번 퍼실리테이터 인력풀 등록에는 함께하지 못하게 되었습니다.",
    "",
    "지원자 개개인의 역량과 무관하게, 현재 운영 상황과 배정 계획에 따른 결정임을 너그러이 이해해 주시면 감사하겠습니다.",
    "다음 기회에 다시 지원해 주시면 반갑게 검토하겠습니다.",
    "",
    "관심과 성원에 다시 한번 감사드립니다. 우아재 드림.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.7; color:#2c2823; max-width:560px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">퍼실리테이터 지원 결과 안내</h2>
      <p><strong>${params.name}</strong>님, 안녕하세요.</p>
      <p>우아재 퍼실리테이터에 관심을 갖고 지원해 주셔서 진심으로 감사드립니다.<br/>아쉽게도 <strong>이번 인력풀 등록</strong>에는 함께하지 못하게 되었습니다.</p>
      <p style="color:#334155;">지원자 개개인의 역량과 무관하게 현재 운영 상황과 배정 계획에 따른 결정임을 너그러이 이해해 주시면 감사하겠습니다. <strong>다음 기회</strong>에 다시 지원해 주시면 반갑게 검토하겠습니다.</p>
      <p style="color:#8A8479;">관심과 성원에 다시 한번 감사드립니다. — 우아재 드림</p>
    </div>
  `;
  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

export async function sendFacilitatorCourseAssignedEmail(params: { to: string; name: string; courseTitle: string }) {
  const { apiKey, from } = getMailerConfig();
  const subject = `[우아재] 담당 강좌 배정 안내 — ${params.courseTitle}`;
  const text = [
    `${params.name}님, 안녕하세요.`,
    "",
    `'${params.courseTitle}' 강좌의 담당 퍼실리테이터(멘토)로 배정되었습니다.`,
    "이제 해당 강좌의 강의실에 입장해 수강생 멘토링·운영을 시작하실 수 있습니다.",
    "우아재에 로그인 후 강좌 강의실에서 확인해 주세요.",
    "",
    "함께해 주셔서 감사합니다. — 우아재 드림",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.7; color:#2c2823; max-width:560px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">담당 강좌 배정 안내</h2>
      <p><strong>${params.name}</strong>님, 안녕하세요.</p>
      <p><strong>'${params.courseTitle}'</strong> 강좌의 담당 퍼실리테이터(멘토)로 배정되었습니다.</p>
      <p style="color:#334155;">이제 해당 강좌의 강의실에 입장해 수강생 멘토링·운영을 시작하실 수 있습니다. 우아재에 로그인 후 강좌 강의실에서 확인해 주세요.</p>
      <p style="color:#8A8479;">함께해 주셔서 감사합니다. — 우아재 드림</p>
    </div>
  `;
  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

/** 학부모 자녀 연결 인증코드(자녀 이메일로 발송). 코드를 학부모가 입력하면 연결 완료. */
export async function sendChildLinkCodeEmail(params: { to: string; code: string; parentName: string; expiresMinutes: number }) {
  const { apiKey, from } = getMailerConfig();
  const subject = "[우아재] 자녀 연결 인증코드";
  const text = [
    `${params.parentName || "학부모"} 님이 우아재에서 자녀(회원) 연결을 요청했습니다.`,
    "",
    `인증코드: ${params.code}`,
    `이 코드를 학부모님께 알려주시면 연결이 완료됩니다. (${params.expiresMinutes}분 내 유효)`,
    "",
    "요청한 적이 없다면 이 메일을 무시하세요.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.7; color:#2c2823; max-width:520px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">자녀 연결 인증코드</h2>
      <p><strong>${params.parentName || "학부모"}</strong> 님이 우아재에서 자녀 연결을 요청했습니다.</p>
      <p style="font-size:26px; font-weight:800; letter-spacing:4px; color:#8C6E59; background:#FBF8F2; border:1px solid #E4DBC7; border-radius:10px; padding:14px 16px; text-align:center;">${params.code}</p>
      <p style="color:#334155;">이 코드를 학부모님께 알려주시면 연결이 완료됩니다. (${params.expiresMinutes}분 내 유효)</p>
      <p style="color:#8A8479;">요청한 적이 없다면 이 메일을 무시하세요. — 우아재</p>
    </div>
  `;
  return postResend({ apiKey, from, to: params.to, subject, text, html });
}

/** 새 강좌 개설 요청 접수 알림(관리자 → 담당자). spec 은 사람이 읽을 수 있는 강좌 사양 텍스트. */
export async function sendCourseRequestEmail(params: { to: string; requesterEmail: string; title: string; spec: string }) {
  const { apiKey, from } = getMailerConfig();
  const subject = `[우아재] 새 강좌 개설 요청 — ${params.title}`;
  const text = [
    "새 강좌 개설 요청이 접수되었습니다.",
    `요청자: ${params.requesterEmail}`,
    "",
    params.spec,
    "",
    "담당자가 강좌 구조를 구성한 뒤 공개됩니다.",
  ].join("\n");
  const html = `
    <div style="font-family: Arial, sans-serif; line-height:1.7; color:#2c2823; max-width:640px;">
      <h2 style="margin:0 0 12px; color:#6B5342;">새 강좌 개설 요청</h2>
      <p style="color:#8A8479; margin:0 0 12px;">요청자: ${params.requesterEmail}</p>
      <pre style="white-space:pre-wrap; font-family: ui-monospace, Menlo, monospace; font-size:13px; background:#FBF8F2; border:1px solid #E4DBC7; border-radius:10px; padding:16px; color:#2c2823;">${params.spec.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string))}</pre>
      <p style="color:#8A8479;">담당자가 강좌 구조를 구성한 뒤 공개됩니다. — 우아재</p>
    </div>
  `;
  return postResend({ apiKey, from, to: params.to, subject, text, html });
}
