export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export type Cta = { url: string; label: string; note: string }

const PARAGRAPH_STYLE =
  "font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #444444;"

const PREHEADER_PADDING =
  "&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;"

function eyebrowRow(eyebrow: string) {
  return `
                  <tr>
                    <td style="padding: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 12px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; color: #3A4A2B;">${eyebrow}</td>
                  </tr>`
}

function headingRow(heading: string) {
  return `
                  <tr>
                    <td style="padding: 0 0 16px 0; font-family: Georgia, 'Times New Roman', Times, serif; font-size: 32px; font-style: italic; font-weight: normal; line-height: 1.2; color: #1a1a1a;">${heading}</td>
                  </tr>`
}

function ctaRows({ url, label, note }: Cta) {
  const href = escapeHtml(url)
  return `
                  <tr>
                    <td align="center" style="padding: 0 0 12px 0;">
                      <!--[if mso]>
                      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:500px;" arcsize="25%" stroke="f" fillcolor="#3A4A2B">
                        <w:anchorlock/>
                        <center style="color:#ffffff;font-family:Arial, Helvetica, sans-serif;font-size:16px;font-weight:bold;">${label}</center>
                      </v:roundrect>
                      <![endif]-->
                      <!--[if !mso]><!-->
                      <table role="presentation" class="btn-table" width="500" cellpadding="0" cellspacing="0" border="0" style="width: 500px; border-collapse: separate;">
                        <tr>
                          <td align="center" bgcolor="#3A4A2B" style="background-color: #3A4A2B; border-radius: 12px;">
                            <a href="${href}" target="_blank" style="display: block; padding: 14px 0; font-family: Arial, Helvetica, sans-serif; font-size: 16px; font-weight: bold; line-height: 20px; color: #ffffff; text-decoration: none;">${label}</a>
                          </td>
                        </tr>
                      </table>
                      <!--<![endif]-->
                    </td>
                  </tr>
                  <tr>
                    <td align="center" style="padding: 0 0 32px 0; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.5; color: #888888;">${note}</td>
                  </tr>`
}

export function brandedHtml({
  preheader,
  eyebrow,
  heading,
  paragraphs,
  cta,
  signoff,
}: {
  preheader: string
  eyebrow?: string
  heading?: string
  paragraphs: string[]
  cta?: Cta
  signoff: string
}) {
  const rows = paragraphs
    .map((p, i) => {
      const bottom = i === paragraphs.length - 1 ? 28 : 12
      return `
                  <tr>
                    <td style="padding: 0 0 ${bottom}px 0; ${PARAGRAPH_STYLE}">${p}</td>
                  </tr>`
    })
    .join("")
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
    <title>${heading ?? "Patriot HackFest"}</title>
    <!--[if mso]>
    <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
    <![endif]-->
    <style>
      body { margin: 0; padding: 0; width: 100% !important; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
      table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; border-collapse: collapse; }
      img { border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
      @media only screen and (max-width: 620px) {
        .card-pad { padding: 28px 20px !important; }
        .btn-table { width: 100% !important; }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f4f0df;" bgcolor="#f4f0df">
    <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all; font-size: 1px; line-height: 1px; color: #f4f0df; opacity: 0;">${preheader}${PREHEADER_PADDING}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f4f0df" style="width: 100%; background-color: #f4f0df;">
      <tr>
        <td align="center" style="padding: 40px 16px;">
          <!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width: 100%; max-width: 600px; background-color: #ffffff; border-radius: 16px; border-collapse: separate;">
            <tr>
              <td class="card-pad" style="padding: 40px; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #444444;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="padding: 0 0 32px 0;">
                      <img src="https://app.patriothackfest.com/logo.png" width="160" alt="Patriot HackFest" style="display: block; width: 160px; max-width: 160px; height: auto; font-family: Arial, Helvetica, sans-serif; font-size: 18px; font-weight: bold; color: #3A4A2B;">
                    </td>
                  </tr>${eyebrow === undefined ? "" : eyebrowRow(eyebrow)}${heading === undefined ? "" : headingRow(heading)}${rows}${cta ? ctaRows(cta) : ""}
                  <tr>
                    <td style="padding: 0 0 8px 0; font-family: Arial, Helvetica, sans-serif; font-size: 20px; font-weight: bold; line-height: 1.3; color: #1a1a1a;">Stay Connected</td>
                  </tr>
                  <tr>
                    <td style="padding: 0 0 24px 0; font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #444444;">Questions? Reach out anytime at <a href="mailto:hello@patriothackfest.com" style="color: #3A4A2B; font-weight: bold; text-decoration: underline;">hello@patriothackfest.com</a></td>
                  </tr>
                  <tr>
                    <td style="font-family: Arial, Helvetica, sans-serif; font-size: 15px; line-height: 1.6; color: #444444;">
                      ${signoff}<br>
                      <strong style="color: #1a1a1a;">&mdash; The Patriot HackFest Team</strong>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0 0 0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;"><a href="https://patriothackfest.com" target="_blank" style="color: #3A4A2B; text-decoration: underline;">patriothackfest.com</a></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          <!--[if mso]></td></tr></table><![endif]-->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width: 100%; max-width: 600px;">
            <tr>
              <td align="center" style="padding: 20px 16px 0 16px; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.5; color: #8a8672;">You're receiving this because you applied to Patriot HackFest.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`
}

export function brandedText({
  body,
  cta,
  signoff,
}: {
  body: string
  cta?: Cta
  signoff: string
}) {
  const action = cta ? `${cta.label}: ${cta.url}\n${cta.note}\n\n` : ""
  return `${body}

${action}Stay Connected
Questions? Reach out anytime at hello@patriothackfest.com

${signoff}
— The Patriot HackFest Team
https://patriothackfest.com

You're receiving this because you applied to Patriot HackFest.
`
}
