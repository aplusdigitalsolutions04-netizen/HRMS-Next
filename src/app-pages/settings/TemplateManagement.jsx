import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import Swal from 'sweetalert2';
import { useNavigate } from 'react-router-dom';
import { templateManagementStyles } from './template-management/styles';
import { SettingsCard } from './shared';
import { fileIcon } from './template-management/helpers';

const SavedTemplatesTable = lazy(() => import('./template-management/SavedTemplatesTable'));

const API = '/api';
const authHeaders = () => ({ Authorization: 'Bearer ' + sessionStorage.getItem('token') });
const ALLOWED = ['pdf', 'docx', 'doc', 'html'];

// The list of email templates. A new template is made on its own page (Create Template), and a PDF / DOCX / HTML
// file can be dropped anywhere on this page (or picked with Upload file): AI reads it and opens the same page
// filled in, ready to review.
export default function TemplateManagement() {
    const navigate = useNavigate();
    const fileInputRef = useRef();
    const [dragging, setDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadName, setUploadName] = useState('');

    const [templates, setTemplates] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loadingList, setLoadingList] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        fetch(`${API}/template-categories`, { headers: authHeaders() }).then(r => r.json()).then(d => setCategories(d.categories || [])).catch(() => {});
    }, [templates.length]);

    const fetchTemplates = async () => {
        setLoadingList(true);
        try {
            const res = await fetch(`${API}/templates/`, { headers: authHeaders() });
            if (res.status === 401) { sessionStorage.removeItem('token'); window.location.href = '/login'; return; }
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        } catch (e) {
            setTemplates([]);
        } finally {
            setLoadingList(false);
        }
    };
    useEffect(() => { fetchTemplates(); }, []);

    /* ── a file: check the type, let AI read it, then open the editor page with the result ── */
    const handleFile = useCallback(async (f) => {
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!ALLOWED.includes(ext)) {
            Swal.fire({ icon: 'warning', title: 'Unsupported file', text: 'Please use a PDF, DOCX or HTML file.' });
            return;
        }
        setUploading(true);
        setUploadName(f.name);
        try {
            const fd = new FormData();
            fd.append('file', f);
            const res = await fetch(`${API}/templates/upload`, { method: 'POST', headers: authHeaders(), body: fd });
            const json = await res.json();
            if (!res.ok) throw new Error(json.detail || 'Upload failed');
            const d = json.data || {};
            sessionStorage.setItem('tpl_draft', JSON.stringify({
                name: d.name || '', subject: d.subject || '', body: d.body || '',
                variables: Array.isArray(d.variables) ? d.variables : [], template_type: 'General', fromFile: f.name,
            }));
            navigate('/settings/template-editor');
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Could not read the file', text: err.message });
        } finally {
            setUploading(false);
        }
    }, [navigate]);

    /* ── drag and drop anywhere on the page ── */
    useEffect(() => {
        let depth = 0;
        const hasFiles = (e) => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
        const enter = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; setDragging(true); };
        const over = (e) => { if (!hasFiles(e)) return; e.preventDefault(); };
        const leave = (e) => { if (!hasFiles(e)) return; depth = Math.max(0, depth - 1); if (depth === 0) setDragging(false); };
        const drop = (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; setDragging(false); handleFile(e.dataTransfer.files[0]); };
        window.addEventListener('dragenter', enter);
        window.addEventListener('dragover', over);
        window.addEventListener('dragleave', leave);
        window.addEventListener('drop', drop);
        return () => {
            window.removeEventListener('dragenter', enter);
            window.removeEventListener('dragover', over);
            window.removeEventListener('dragleave', leave);
            window.removeEventListener('drop', drop);
        };
    }, [handleFile]);

    const newTemplate = () => { sessionStorage.removeItem('tpl_draft'); navigate('/settings/template-editor'); };
    const editTemplate = (t) => { sessionStorage.removeItem('tpl_draft'); navigate(`/settings/template-editor?id=${t.id}`); };

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

    const TYPES = [
        { label: 'PDF', bg: '#fee2e2', color: '#991b1b' },
        { label: 'DOCX', bg: '#dbeafe', color: '#1d4ed8' },
        { label: 'HTML', bg: '#dcfce7', color: '#166534' },
    ];

    return (
        <div style={{ fontFamily: "'Inter', sans-serif" }}>
            <style>{templateManagementStyles}</style>

            {(dragging || uploading) && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(37,99,235,.14)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: uploading ? 'auto' : 'none' }}>
                    <div style={{ background: '#fff', border: '2px dashed #2563eb', borderRadius: 18, padding: '34px 46px', textAlign: 'center', boxShadow: '0 20px 60px rgba(30,64,175,.25)' }}>
                        <div style={{ fontSize: '2.4rem', marginBottom: 6 }}>{uploading ? '✨' : '☁️'}</div>
                        <div style={{ fontWeight: 700, color: '#1e40af', fontSize: '1.1rem', fontFamily: "'Outfit', sans-serif" }}>
                            {uploading ? `Reading ${uploadName} with AI…` : 'Drop your file to make a template'}
                        </div>
                        <div style={{ color: '#64748b', fontSize: '.88rem', marginTop: 6 }}>PDF, DOCX or HTML</div>
                    </div>
                </div>
            )}

            <div className="tpl-page">
                <SettingsCard
                    title="Template Management"
                    desc="Make the email templates used for candidates, employees and request mails."
                    actions={
                        <>
                            <button
                                onClick={fetchTemplates}
                                style={{
                                    background: 'transparent', border: '1.5px solid #e2e8f0', borderRadius: '10px',
                                    padding: '9px 16px', fontSize: '.85rem', cursor: 'pointer', fontWeight: 600,
                                    color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px',
                                    fontFamily: "'Outfit', sans-serif", boxShadow: 'none'
                                }}
                            >
                                🔄 Refresh
                            </button>
                            <button className="extract-btn" style={{ marginTop: 0, padding: '9px 20px', fontSize: '.9rem' }} onClick={newTemplate}>
                                + Create Template
                            </button>
                        </>
                    }
                >
                    {/* what a file may be, and where it can be dropped */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 14, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 12 }}>
                        <span style={{ fontSize: '.84rem', color: '#475569', fontWeight: 600 }}>Make a template from a file:</span>
                        {TYPES.map(t => <span key={t.label} className="type-badge" style={{ background: t.bg, color: t.color }}>{t.label}</span>)}
                        <span style={{ fontSize: '.82rem', color: '#64748b' }}>Drag and drop it anywhere on this page, or</span>
                        <input ref={fileInputRef} type="file" accept=".pdf,.docx,.doc,.html" style={{ display: 'none' }} onChange={e => { handleFile(e.target.files[0]); e.target.value = ''; }} />
                        <button className="reset-btn" style={{ padding: '6px 14px' }} disabled={uploading} onClick={() => fileInputRef.current && fileInputRef.current.click()}>
                            {fileIcon('x.pdf')} Upload file
                        </button>
                        <span style={{ fontSize: '.8rem', color: '#94a3b8', marginLeft: 'auto' }}>AI reads the file and opens the editor filled in.</span>
                    </div>

                    <Suspense fallback={<div className="p-4 text-center">Loading...</div>}>
                        <SavedTemplatesTable
                            templates={templates}
                            categories={categories}
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
