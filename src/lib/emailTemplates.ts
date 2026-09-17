// Shared {{placeholder}} substitution for employee-facing email templates
// (welcome/credentials emails). Used by both the approval-flow draft creator
// and the standalone draft-from-template endpoint, which had drifted into
// two separate copies of this logic before being consolidated here.
export interface EmployeeTemplateVars {
  fullName?: string;
  email?: string;
  // Omit when the real password isn't available/appropriate to reveal
  // (e.g. re-sending to an already-active employee) - defaults to masked.
  password?: string;
  empCode?: string;
  officialEmail?: string;
  officialNo?: string;
  loginUrl?: string;
  companyLogo?: string;
  companyName?: string;
  officialDetailsHtml?: string;
}

// Applied to both subject and body so a variable works the same everywhere,
// and accepts {var}, {{var}}, or {VAR} (any brace count/case) since the
// "Available Variables" panel in Template Management shows the candidate
// template convention (single brace, uppercase) right next to these.
export function fillEmployeeTemplate(rawBody: string, vars: EmployeeTemplateVars): string {
  let body = rawBody || '';
  body = body.replace(/\{{1,2}(candidate_name|name)\}{1,2}/gi, vars.fullName || 'Employee');
  body = body.replace(/\{{1,2}email\}{1,2}/gi, vars.email || '');
  body = body.replace(/\{{1,2}password\}{1,2}/gi, vars.password ?? '********');
  body = body.replace(/\{{1,2}emp_code\}{1,2}/gi, vars.empCode || '');
  body = body.replace(/\{{1,2}login_url\}{1,2}/gi, vars.loginUrl || '');
  body = body.replace(/\{{1,2}official_email\}{1,2}/gi, vars.officialEmail || '');
  body = body.replace(/\{{1,2}official_no\}{1,2}/gi, vars.officialNo || '');
  body = body.replace(/\{{1,2}official_details_section\}{1,2}/gi, vars.officialDetailsHtml || '');
  body = body.replace(/\{{1,2}company_logo\}{1,2}/gi, vars.companyLogo || '');
  body = body.replace(/\{{1,2}company_name\}{1,2}/gi, vars.companyName || '');
  return body;
}

// company_settings.company_logo is stored as a base64 data: URI (uploaded via
// a plain <input type=file> + FileReader, never written to a public path).
// That renders fine in the app itself, but most email clients - Gmail
// included - strip or refuse to load data: URI images in HTML mail as a
// spam/tracking precaution, which is why the logo shows as a broken image
// in a sent email even though it looks fine everywhere in the UI. Emailing
// it has to go through a cid-referenced inline attachment instead, which
// every mainstream client renders.
export function buildCompanyLogoEmail(rawLogo: string | undefined, altText: string): {
  html: string;
  attachment: { filename: string; content: string; encoding: string; contentType: string; cid: string } | null;
} {
  if (!rawLogo) return { html: '', attachment: null };

  const dataUriMatch = rawLogo.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!dataUriMatch) {
    // Already a real URL (e.g. hosted elsewhere) - use it directly, no
    // attachment needed.
    return {
      html: `<img src="${rawLogo}" alt="${altText}" style="height:36px;margin-bottom:16px" />`,
      attachment: null,
    };
  }

  const [, mimeType, base64Data] = dataUriMatch;
  const ext = mimeType.split('/')[1] || 'png';
  const cid = 'company-logo';
  return {
    html: `<img src="cid:${cid}" alt="${altText}" style="height:36px;margin-bottom:16px" />`,
    attachment: {
      filename: `logo.${ext}`,
      content: base64Data,
      encoding: 'base64',
      contentType: mimeType,
      cid,
    },
  };
}
