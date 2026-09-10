import React from 'react';
import { CHIP_COLORS } from './helpers';

export default function PreviewSection({ preview, setPreview, saving, saveTemplate, resetUpload, bodyRef }) {
    if (!preview) return null;
    return (
        <div className="preview-card">
            <div className="preview-header">
                <div className="section-title">
                    <span className="step-num">2</span>
                    {preview.id ? 'Edit Template' : preview.manual ? 'New Template' : 'Review & Edit Extracted Template'}
                </div>
                {!preview.id && !preview.manual && <span className="ai-badge">🤖 AI Extracted</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="pfield">
                    <div className="field-label">Template Name</div>
                    <input
                        className="pinput"
                        value={preview.name}
                        onChange={e => setPreview(p => ({ ...p, name: e.target.value }))}
                        placeholder="e.g. Interview Call Letter"
                    />
                </div>
                {/* Subject */}
                <div className="pfield">
                    <div className="field-label">Email Subject</div>
                    <input
                        className="pinput"
                        value={preview.subject}
                        onChange={e => setPreview(p => ({ ...p, subject: e.target.value }))}
                        placeholder="Email subject line…"
                    />
                </div>
                <div className="pfield">
                    <div className="field-label">Template Type</div>
                    <select
                        className="pinput"
                        value={preview.template_type || 'General'}
                        onChange={e => setPreview(p => ({ ...p, template_type: e.target.value }))}
                    >
                        <option value="Interview">Interview</option>
                        <option value="General">General</option>
                    </select>
                </div>
            </div>

            {/* Body */}
            <div className="pfield">
                <div className="field-label">Email Body</div>
                <textarea
                    ref={bodyRef}
                    className="ptextarea"
                    value={preview.body}
                    onChange={e => setPreview(p => ({ ...p, body: e.target.value }))}
                    placeholder="Email body with {{variables}}…"
                    rows={10}
                />
                <div style={{ fontSize: '.78rem', color: '#94a3b8', marginTop: '5px' }}>
                    💡 Use <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{'{CANDIDATE_NAME}'}</code> or <code style={{ background: '#f1f5f9', padding: '1px 5px', borderRadius: 4 }}>{'{{variable_name}}'}</code> for dynamic placeholders
                </div>
            </div>

            {/* Variables */}
            <div className="pfield">
                <div className="field-label" style={{ marginBottom: '10px' }}>
                    Detected Variables
                    <span style={{
                        background: '#ede9fe', color: '#7c3aed',
                        borderRadius: '50px', padding: '2px 10px',
                        fontSize: '.75rem', fontWeight: 800, marginLeft: '8px'
                    }}>
                        {preview.variables.length}
                    </span>
                </div>
                {preview.variables.length > 0 ? (
                    <div className="vars-wrap">
                        {preview.variables.map((v, i) => {
                            const c = CHIP_COLORS[i % CHIP_COLORS.length];
                            return (
                                <span key={i} className="var-chip" style={{ background: c.bg, color: c.color, border: `1.5px solid ${c.color}30` }}>
                                    {'{{' + v + '}}'}
                                    <button className="chip-remove" onClick={() => setPreview(p => ({ ...p, variables: p.variables.filter((_, j) => j !== i) }))}>✕</button>
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <div style={{ color: '#94a3b8', fontSize: '.88rem' }}>
                        No variables detected. Add <code>{'{CANDIDATE_NAME}'}</code> or <code>{'{{variable_name}}'}</code> in the body above.
                    </div>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
                <button className="reset-btn" onClick={resetUpload}>{preview.id ? '✕ Cancel' : '↺ Start Over'}</button>
                <button className="save-btn" disabled={saving} onClick={saveTemplate}>
                    {saving
                        ? <><span className="spinner" style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,.4)' }} /> Saving…</>
                        : <>💾 {preview.id ? 'Update Template' : 'Save Template'}</>}
                </button>
            </div>
        </div>
    );
}
