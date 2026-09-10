import React from 'react';
import { fileIcon } from './helpers';

export default function UploadSection({ file, dragging, uploading, uploadError, fileInputRef, onDragOver, onDragLeave, onDrop, onFileChange, resetUpload, extractWithAI, createManually }) {
    return (
        <div>
            <div className="section-title" style={{ marginBottom: '22px' }}>
                <span className="step-num">1</span>
                Upload Template File
            </div>

            {/* Drop Zone */}
            <div
                className={`drop-zone${dragging ? ' drag-over' : ''}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={() => !file && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef} type="file"
                    accept=".pdf,.docx,.doc,.html"
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                />
                <div style={{ fontSize: '2.8rem', marginBottom: '10px' }}>
                    {file ? fileIcon(file.name) : '☁️'}
                </div>
                <div style={{ fontWeight: 700, color: '#4338ca', fontSize: '1.05rem', fontFamily: "'Outfit', sans-serif" }}>
                    {file ? 'File Selected!' : 'Drag & Drop your file here'}
                </div>
                <div style={{ color: '#64748b', fontSize: '.88rem', marginTop: '6px' }}>
                    {file ? 'Ready to extract — click the button below' : 'or click anywhere to browse'}
                </div>

                <div className="supported-types" style={{ marginTop: '14px' }}>
                    {[
                        { label: 'PDF', bg: '#fee2e2', color: '#991b1b' },
                        { label: 'DOCX', bg: '#dbeafe', color: '#1d4ed8' },
                        { label: 'HTML', bg: '#dcfce7', color: '#166534' },
                    ].map(t => (
                        <span key={t.label} className="type-badge" style={{ background: t.bg, color: t.color }}>
                            {t.label}
                        </span>
                    ))}
                </div>
            </div>

            {/* File pill */}
            {file && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
                    <span className="file-pill">
                        {fileIcon(file.name)} {file.name}
                        <button className="remove-file" onClick={resetUpload} title="Remove file">✕</button>
                    </span>
                </div>
            )}

            {/* Error */}
            {uploadError && (
                <div style={{
                    marginTop: '14px', padding: '12px 16px', borderRadius: '10px',
                    background: '#fee2e2', color: '#991b1b', fontSize: '.9rem',
                    fontWeight: 600, border: '1px solid #fecaca'
                }}>
                    {uploadError}
                </div>
            )}

            {/* Extract Button */}
            <div style={{ textAlign: 'center' }}>
                <button
                    className="extract-btn"
                    disabled={!file || uploading}
                    onClick={extractWithAI}
                >
                    {uploading
                        ? <><span className="spinner" /> Extracting with AI…</>
                        : <>✨ Extract with AI</>
                    }
                </button>
            </div>

            {/* Manual creation fallback — no file needed */}
            <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '18px', borderTop: '1px dashed #e2e8f0' }}>
                <div style={{ color: '#94a3b8', fontSize: '.85rem', marginBottom: '10px' }}>
                    Don't have a PDF, DOCX, or HTML file?
                </div>
                <button className="reset-btn" onClick={createManually}>
                    ✏️ Create Template Manually
                </button>
            </div>
        </div>
    );
}
