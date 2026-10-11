import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Swal from 'sweetalert2';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { templateManagementStyles } from './template-management/styles';
import { SettingsCard } from './shared';

const PreviewSection = lazy(() => import('./template-management/PreviewSection'));
const AvailableVariables = lazy(() => import('./template-management/AvailableVariables'));

const API = '/api';
const authHeaders = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const BLANK = { name: '', subject: '', body: '', variables: [], template_type: 'General', manual: true };

// One full page to create an email template, to edit one (?id=...), or to review what AI read from a file.
export default function TemplateEditor() {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const id = params.get('id');
    const [preview, setPreview] = useState(null);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const bodyRef = useRef(null);

    useEffect(() => {
        let alive = true;
        const open = async () => {
            if (id) {
                try {
                    const res = await fetch(`${API}/templates/`, { headers: authHeaders() });
                    const list = await res.json();
                    const t = (Array.isArray(list) ? list : []).find(x => String(x.id) === String(id));
                    if (!t) { Swal.fire({ icon: 'error', title: 'Template not found' }); navigate('/settings/templates'); return; }
                    let vars = [];
                    try { vars = JSON.parse(t.variables || '[]'); } catch { vars = []; }
                    if (alive) setPreview({ id: t.id, name: t.name || '', subject: t.subject || '', body: t.body || '', variables: Array.isArray(vars) ? vars : [], template_type: t.template_type || 'General' });
                } catch { navigate('/settings/templates'); return; }
            } else {
                let draft = null;
                try { draft = JSON.parse(sessionStorage.getItem('tpl_draft') || 'null'); } catch { draft = null; }
                if (alive) setPreview(draft ? { ...draft, manual: false } : { ...BLANK });
            }
            if (alive) setLoading(false);
        };
        open();
        return () => { alive = false; };
    }, [id]);

    const back = () => { sessionStorage.removeItem('tpl_draft'); navigate('/settings/templates'); };

    const saveTemplate = async () => {
        if (!preview) return;
        if (!preview.name.trim()) { Swal.fire({ icon: 'warning', title: 'Missing Name', text: 'Please enter a template name.' }); return; }
        if (!preview.subject.trim()) { Swal.fire({ icon: 'warning', title: 'Missing Subject', text: 'Please enter an email subject.' }); return; }
        if (!preview.body.trim()) { Swal.fire({ icon: 'warning', title: 'Missing Body', text: 'Email body cannot be empty.' }); return; }
        const isEditing = !!preview.id;
        setSaving(true);
        try {
            const res = await fetch(isEditing ? `${API}/templates/${preview.id}` : `${API}/templates/save`, {
                method: isEditing ? 'PUT' : 'POST',
                headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: preview.name, subject: preview.subject, body: preview.body,
                    variables: JSON.stringify(preview.variables), template_type: preview.template_type || 'General',
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || 'Save failed');
            await Swal.fire({ icon: 'success', title: isEditing ? 'Template Updated!' : 'Template Saved!', text: `"${preview.name}" has been saved.`, timer: 1600, showConfirmButton: false });
            sessionStorage.removeItem('tpl_draft');
            navigate('/settings/templates');
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const insertVariable = (varText) => {
        const el = bodyRef.current;
        let cursorPos = null;
        setPreview(p => {
            if (!p) return p;
            const currentBody = p.body || '';
            let body;
            if (el && typeof el.selectionStart === 'number') {
                const start = el.selectionStart, end = el.selectionEnd;
                body = currentBody.slice(0, start) + varText + currentBody.slice(end);
                cursorPos = start + varText.length;
            } else {
                body = currentBody ? `${currentBody} ${varText}` : varText;
                cursorPos = body.length;
            }
            const m = varText.match(/^\{\{(.+)\}\}$/);
            const varName = m ? m[1] : varText.replace(/[{}]/g, '');
            const variables = p.variables.includes(varName) ? p.variables : [...p.variables, varName];
            return { ...p, body, variables };
        });
        if (el) requestAnimationFrame(() => { el.focus(); if (cursorPos != null) el.setSelectionRange(cursorPos, cursorPos); });
    };

    const title = id ? 'Edit Template' : preview && preview.fromFile ? 'Review Template from File' : 'Create Template';

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            <style>{templateManagementStyles}</style>
            <div className="tpl-page">
                <SettingsCard
                    title={title}
                    desc={preview && preview.fromFile ? `AI read "${preview.fromFile}". Check the details, fix anything, pick the category and save.` : 'Write the email, pick the category it is for, and save it.'}
                    actions={<button className="reset-btn" onClick={back}>&larr; Back to Templates</button>}
                >
                    {loading ? <div className="p-4 text-center">Loading...</div> : (
                        <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                            <PreviewSection
                                preview={preview}
                                setPreview={setPreview}
                                saving={saving}
                                saveTemplate={saveTemplate}
                                resetUpload={back}
                                bodyRef={bodyRef}
                                onInsertVar={insertVariable}
                            />
                            <AvailableVariables onInsert={insertVariable} />
                        </Suspense>
                    )}
                </SettingsCard>
            </div>
        </div>
    );
}
