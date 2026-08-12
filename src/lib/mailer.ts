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
