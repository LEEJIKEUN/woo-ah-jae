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

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend send failed: ${response.status} ${body}`);
  }
}
