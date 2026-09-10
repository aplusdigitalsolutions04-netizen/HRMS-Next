export const formatEmailBody = (body) => {
  if (!body) return '—';
  const htmlRegex = /<\/?[a-z][\s\S]*>/i;
  if (htmlRegex.test(body)) return body;
  return body.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br />')}</p>`).join('');
};

export const formatDT = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
};

export const formatDate = (dt) => {
  if (!dt) return '—';
  return new Date(dt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
};
