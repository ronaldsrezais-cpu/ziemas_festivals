import { FESTIVAL_SITE_URL, type EmailTemplate } from "@/lib/email-template";
import { emailConfiguration } from "@/lib/email-configuration";

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
export function protocolEmail(template: EmailTemplate, data: { schoolName: string; sportName: string; fileName: string; protocolId: number }) {
  const config = emailConfiguration();
  const url = `${FESTIVAL_SITE_URL}/api/start-protocols/${data.protocolId}`;
  const subject = `Pieejams starta protokols: ${data.sportName}`.replace(/[\r\n]/g, " ").slice(0, 240);
  const body = `Labdien!\n\n${data.schoolName} dalībniekiem ir pieejams sporta veida “${data.sportName}” starta protokols.\n\nFails: ${data.fileName}\nAtvērt starta protokolu: ${url}\nVisi starta protokoli: ${FESTIVAL_SITE_URL}/#starta-protokoli\n\nTiekamies Festivālā!\n${template.footer}\n${template.replyTo}`;
  const html = `<!doctype html><html lang="lv"><body style="margin:0;padding:24px;background:#f0f1ff;font-family:Arial,sans-serif;color:#0c0942"><div style="max-width:600px;margin:auto;padding:28px;background:white;border-radius:16px;border-top:8px solid ${template.accentColor}">${template.showLogo ? `<img src="${FESTIVAL_SITE_URL}/brand/logo-email.png" width="280" alt="Latvijas skolu Ziemas festivāls" style="max-width:100%;height:auto">` : ""}<h1>Pieejams starta protokols</h1><p>Labdien!</p><p>${escape(data.schoolName)} dalībniekiem ir pieejams sporta veida <strong>${escape(data.sportName)}</strong> starta protokols.</p><p>${escape(data.fileName)}</p><p><a href="${url}" style="display:inline-block;padding:16px 22px;background:#2910bf;color:white;border-radius:8px;text-decoration:none;font-weight:bold">Atvērt starta protokolu</a></p><p><a href="${FESTIVAL_SITE_URL}/#starta-protokoli">Visi starta protokoli</a></p><p>Tiekamies Festivālā!</p><p style="white-space:pre-line;font-size:13px">${escape(template.footer)}</p><a href="mailto:${escape(template.replyTo)}">${escape(template.replyTo)}</a></div></body></html>`;
  const name = template.senderName.replace(/[\\"]/g, character => `\\${character}`);
  return { subject, body, html, replyTo: template.replyTo,
    sender: config.senderValid ? `"${name}" <${config.senderAddress}>` : null };
}
