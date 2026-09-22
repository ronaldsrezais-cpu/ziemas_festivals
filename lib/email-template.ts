import { z } from "zod";

export const EMAIL_TEMPLATE_KEY = "approval_email_template";
export const FESTIVAL_SITE_URL = "https://ziemas-festivals.vercel.app";
const singleLine = (max: number) => z.string().trim().min(1).max(max).refine(value => !/[\r\n]/.test(value), "Šim laukam jābūt vienā rindā.");
const tokensValid = (value: string) => !/\{\{|\}\}/.test(value.replace(/\{\{(skola|skolotajs)\}\}/g, ""));
export const emailTemplateSchema = z.object({
  senderName: singleLine(100).refine(value => !/[<>]/.test(value), "Sūtītāja vārdā nedrīkst būt < vai >."),
  subject: singleLine(180),
  heading: singleLine(160),
  message: z.string().trim().min(1).max(6000),
  buttonLabel: singleLine(60),
  footer: z.string().trim().max(1500),
  replyTo: z.string().trim().email().max(254),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  showLogo: z.boolean(),
}).refine(template => [template.subject, template.heading, template.message, template.footer].every(tokensValid),
  "Atļautie mainīgie ir {{skola}} un {{skolotajs}}. Kodu un saiti sistēma pievieno automātiski.");
export type EmailTemplate = z.infer<typeof emailTemplateSchema>;
export const defaultEmailTemplate: EmailTemplate = {
  senderName: "Latvijas skolu Ziemas festivāls",
  subject: "Apstiprināta dalība Latvijas skolu Ziemas festivālā",
  heading: "Jūsu skola ir apstiprināta!",
  message: "Labdien, {{skolotajs}}!\n\n{{skola}} dalība Latvijas skolu Ziemas festivālā ir apstiprināta.\n\nAtveriet skolas sadaļu un ievadiet zemāk redzamo piekļuves kodu, lai pievienotu komandas vadītājus un dalībniekus. Kad sastāvs ir gatavs, nospiediet “Pabeigt pieteikumu”.\n\nTiekamies Festivālā!",
  buttonLabel: "Atvērt skolas sadaļu",
  footer: "Latvijas Sporta federāciju padome\nJautājumu gadījumā atbildiet uz šo e-pastu.",
  replyTo: "ziemasfestivals@lsfp.lv",
  accentColor: "#2910bf",
  showLogo: true,
};
export function readEmailTemplate(value?: string): EmailTemplate {
  if (!value) return { ...defaultEmailTemplate };
  try { return emailTemplateSchema.parse(JSON.parse(value)); }
  catch { return { ...defaultEmailTemplate }; }
}
export type EmailContext = { schoolName: string; teacherName: string; code: string };
export const sampleEmailContext: EmailContext = { schoolName: "Parauga vidusskola", teacherName: "Parauga skolotājs", code: "PARAUGS" };
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
function buttonTextColor(hex: string) {
  const channels = hex.slice(1).match(/.{2}/g)?.map(part => parseInt(part, 16) / 255) ?? [0, 0, 0];
  const [r, g, b] = channels.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.179 ? "#000000" : "#ffffff";
}
export function renderApprovalEmail(template: EmailTemplate, context: EmailContext) {
  const replace = (value: string) => value.replace(/\{\{(skola|skolotajs)\}\}/g, (_, key: string) =>
    (key === "skola" ? context.schoolName : context.teacherName).replace(/[\r\n]+/g, " "));
  const subject = replace(template.subject).slice(0, 240);
  const heading = replace(template.heading);
  const message = replace(template.message);
  const footer = replace(template.footer);
  const schoolUrl = `${FESTIVAL_SITE_URL}/skolai`;
  const paragraphs = (value: string, style: string) => value.split(/\n\s*\n/).map(paragraph =>
    `<p style="${style}">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`).join("");
  const accent = /^#[0-9a-fA-F]{6}$/.test(template.accentColor) ? template.accentColor : defaultEmailTemplate.accentColor;
  // The canonical line remains independent of editable content so existing
  // school-code recovery and idempotent retries continue to work.
  const text = [`Skolas piekļuves kods: ${context.code}`, "", heading, "", message, "",
    `${template.buttonLabel}: ${schoolUrl}`, "", footer, template.replyTo].join("\n");
  const html = `<!doctype html><html lang="lv"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f0f1ff;font-family:Arial,Helvetica,sans-serif;color:#0c0942">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f1ff"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td style="height:8px;background:${accent};font-size:1px;line-height:8px">&nbsp;</td></tr>
${template.showLogo ? `<tr><td style="padding:32px 28px 12px"><img src="${FESTIVAL_SITE_URL}/brand/logo-email.png" width="280" alt="Latvijas skolu Ziemas festivāls" style="display:block;border:0;width:280px;max-width:100%;height:auto"></td></tr>` : ""}
<tr><td style="padding:24px 28px"><h1 style="margin:0 0 24px;font-size:28px;line-height:1.2;color:#0c0942">${escapeHtml(heading)}</h1>
${paragraphs(message, "margin:0 0 18px;font-size:16px;line-height:1.65;color:#262443")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;background:#f0f1ff;border:1px solid #c7cfff;border-radius:10px"><tr><td align="center" style="padding:22px 12px"><p style="margin:0 0 10px;font-size:14px;color:#46425c">Skolas piekļuves kods</p><strong style="font-family:Arial,Helvetica,sans-serif;font-size:28px;letter-spacing:4px;color:#0c0942">${escapeHtml(context.code)}</strong></td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${accent}" style="border-radius:8px"><a href="${schoolUrl}" style="display:inline-block;padding:16px 22px;border:1px solid ${accent};border-radius:8px;color:${buttonTextColor(accent)};font-size:16px;font-weight:bold;text-decoration:none">${escapeHtml(template.buttonLabel)}</a></td></tr></table>
<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#625e78">Skolas sadaļa: <a href="${schoolUrl}" style="color:#2910bf;word-break:break-all">${schoolUrl}</a></p>
</td></tr><tr><td style="padding:24px 28px;background:#f7f7fc;border-top:1px solid #e4e4f0">
${paragraphs(footer, "margin:0 0 10px;font-size:13px;line-height:1.6;color:#625e78")}
<a href="mailto:${escapeHtml(template.replyTo)}" style="font-size:13px;color:#2910bf">${escapeHtml(template.replyTo)}</a>
</td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
