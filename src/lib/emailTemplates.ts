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
  officialEmail?: string;
  officialNo?: string;
  loginUrl?: string;
  companyLogo?: string;
  officialDetailsHtml?: string;
}

export function fillEmployeeTemplate(rawBody: string, vars: EmployeeTemplateVars): string {
  let body = rawBody || '';
  body = body.replace(/\{{1,2}(candidate_name|name)\}{1,2}/gi, vars.fullName || 'Employee');
  body = body.replace(/\{{1,2}email\}{1,2}/gi, vars.email || '');
  body = body.replace(/\{{1,2}password\}{1,2}/gi, vars.password ?? '********');
  body = body.replace(/{{login_url}}/gi, vars.loginUrl || '');
  body = body.replace(/{{official_email}}/gi, vars.officialEmail || '');
  body = body.replace(/{{official_no}}/gi, vars.officialNo || '');
  body = body.replace(/{{official_details_section}}/gi, vars.officialDetailsHtml || '');
  body = body.replace(/{{company_logo}}/gi, vars.companyLogo || '');
  return body;
}
