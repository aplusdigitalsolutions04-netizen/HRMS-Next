import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Swal from 'sweetalert2';
import { templateManagementStyles } from './template-management/styles';
import { SettingsCard } from './shared';

const UploadSection = lazy(() => import('./template-management/UploadSection'));
const PreviewSection = lazy(() => import('./template-management/PreviewSection'));
const AvailableVariables = lazy(() => import('./template-management/AvailableVariables'));
const SavedTemplatesTable = lazy(() => import('./template-management/SavedTemplatesTable'));

const API = '/api';
const authHeaders = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

export default function TemplateManagement() {
    /* ── upload state ── */
    const [file, setFile] = useState(null);
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const fileInputRef = useRef();

    /* ── preview / edit state ── */
    const [preview, setPreview] = useState(null); // { name, subject, body, variables[] }
    const [saving, setSaving] = useState(false);
    const bodyRef = useRef(null);

    /* ── saved templates ── */
    const [templates, setTemplates] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    /* ── upload/create panel is collapsed behind a button so the table is
       what you see first ── */
    const [showAddPanel, setShowAddPanel] = useState(false);

    /* ── load list on mount ── */
    useEffect(() => { fetchTemplates(); }, []);

    const fetchTemplates = async () => {
        setLoadingList(true);
        try {
            const res = await fetch(`${API}/templates/`, { headers: authHeaders() });
            if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        } catch (e) {
            setTemplates([]);
        } finally {
            setLoadingList(false);
        }
    };

    /* ── drag-drop ── */
    const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
    const onDragLeave = () => setDragging(false);
    const onDrop = (e) => {
        e.preventDefault();
        setDragging(false);
        const f = e.dataTransfer.files[0];
        if (f) handleFileSelect(f);
    };
    const onFileChange = (e) => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); };

    const handleFileSelect = (f) => {
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'doc', 'html'].includes(ext)) {
            setUploadError('❌ Unsupported file type. Please upload PDF, DOCX, or HTML.');
            return;
        }
        setUploadError('');
        setFile(f);
        setPreview(null);
    };

    const extractWithAI = async () => {
        if (!file) { setUploadError('Please select a file first.'); return; }
        setUploading(true);
        setUploadError('');
        setPreview(null);

        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fetch(`${API}/templates/upload`, {
                method: 'POST',
                headers: authHeaders(),
                body: fd,
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || 'Upload failed');
            const d = json.data;
            setPreview({
                name: d.name || '',
                subject: d.subject || '',
                body: d.body || '',
                variables: Array.isArray(d.variables) ? d.variables : [],
            });
        } catch (err) {
            setUploadError('⚠️ ' + err.message);
        } finally {
            setUploading(false);
        }
    };

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
                    name: preview.name,
                    subject: preview.subject,
                    body: preview.body,
                    variables: JSON.stringify(preview.variables),
                    template_type: preview.template_type || 'General',
                }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || 'Save failed');
            Swal.fire({ icon: 'success', title: isEditing ? 'Template Updated!' : 'Template Saved!', text: `"${preview.name}" has been saved successfully.`, timer: 2000, showConfirmButton: false });
            setFile(null);
            setPreview(null);
            fetchTemplates();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Save Failed', text: err.message });
        } finally {
            setSaving(false);
        }
    };

    const editTemplate = (t) => {
        let vars = [];
        try { vars = JSON.parse(t.variables || '[]'); } catch { vars = []; }
        setFile(null);
        setPreview({
            id: t.id,
            name: t.name || '',
            subject: t.subject || '',
            body: t.body || '',
            variables: Array.isArray(vars) ? vars : [],
            template_type: t.template_type || 'General',
        });
        setShowAddPanel(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteTemplate = (id, name) => {
        Swal.fire({
            title: 'Delete Template?',
            html: `<span style="color:#64748b">Are you sure you want to delete <strong>"${name}"</strong>? This action cannot be undone.</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, Delete',
            cancelButtonText: 'Cancel',
        }).then(async (result) => {
            if (!result.isConfirmed) return;
            try {
                const res = await fetch(`${API}/templates/${id}`, { method: 'DELETE', headers: authHeaders() });
                if (!res.ok) throw new Error('Delete failed');
                Swal.fire({ icon: 'success', title: 'Deleted!', timer: 1500, showConfirmButton: false });
                fetchTemplates();
            } catch (e) {
                Swal.fire({ icon: 'error', title: 'Error', text: e.message });
            }
        });
    };

    const resetUpload = () => {
        setFile(null);
        setPreview(null);
        setUploadError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowAddPanel(false);
    };

    const createManually = () => {
        setFile(null);
        setUploadError('');
        setPreview({ name: '', subject: '', body: '', variables: [], template_type: 'General', manual: true });
    };

    const insertVariable = (varText) => {
        const el = bodyRef.current;
        let cursorPos = null;
        setPreview(p => {
            if (!p) return p;
            const currentBody = p.body || '';
            let body;
            // Use selectionStart even if textarea is not currently the active element
            if (el && typeof el.selectionStart === 'number') {
                const start = el.selectionStart;
                const end = el.selectionEnd;
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
        if (el) {
            requestAnimationFrame(() => {
                el.focus();
                if (cursorPos != null) el.setSelectionRange(cursorPos, cursorPos);
            });
        }
    };

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            <style>{templateManagementStyles}</style>

            <div className="tpl-page">
                <SettingsCard
                    title="Template Management"
                    desc="Upload email templates (PDF, DOCX, HTML) and let AI extract the structure for SMTP use."
                >

                <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                    {!showAddPanel ? (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
                            <button className="extract-btn" onClick={() => setShowAddPanel(true)}>
                                + Add Template
                            </button>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
                                <button className="reset-btn" onClick={resetUpload}>✕ Close</button>
                            </div>

                            <UploadSection
                                file={file}
                                dragging={dragging}
                                uploading={uploading}
                                uploadError={uploadError}
                                fileInputRef={fileInputRef}
                                onDragOver={onDragOver}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                                onFileChange={onFileChange}
                                resetUpload={resetUpload}
                                extractWithAI={extractWithAI}
                                createManually={createManually}
                            />

                            <PreviewSection
                                preview={preview}
                                setPreview={setPreview}
                                saving={saving}
                                saveTemplate={saveTemplate}
                                resetUpload={resetUpload}
                                bodyRef={bodyRef}
                            />

                            <AvailableVariables onInsert={preview ? insertVariable : undefined} />
                        </>
                    )}

                    <SavedTemplatesTable
                        templates={templates}
                        loadingList={loadingList}
                        expandedId={expandedId}
                        setExpandedId={setExpandedId}
                        deleteTemplate={deleteTemplate}
                        fetchTemplates={fetchTemplates}
                        editTemplate={editTemplate}
                    />
                </Suspense>
                </SettingsCard>
            </div>
        </div>
    );
}
