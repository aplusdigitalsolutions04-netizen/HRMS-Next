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
