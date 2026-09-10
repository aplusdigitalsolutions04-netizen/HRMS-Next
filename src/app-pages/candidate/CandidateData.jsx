import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import { fillVariables, parseVars, CHIP_COLORS, buildTemplateVars, saveEmailDraft, createReminder } from './candidate-data/helpers';
import { candidateDataStyles } from './candidate-data/styles';
import CandidateTable from './candidate-data/CandidateTable';
import AddCandidateModal from './candidate-data/AddCandidateModal';
import StatusModal from './candidate-data/StatusModal';
import InterviewModal from './candidate-data/InterviewModal';
import EmailActionModal from './candidate-data/EmailActionModal';
import EmailComposeModal from './candidate-data/EmailComposeModal';
import CandidateEmailActionModal from './candidate-data/CandidateEmailActionModal';

const API = '/api';
const auth = () => ({ Authorization: 'Bearer ' + localStorage.getItem('token') });

const CandidateData = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [candidates, setCandidates] = useState([]);
    const [loadingCandidates, setLoadingCandidates] = useState(true);
    const [fetchError, setFetchError] = useState('');
    const [applyPosts, setApplyPosts] = useState([]);

    const [isCandidateModalOpen, setIsCandidateModalOpen] = useState(false);
    const [isStatusModalOpen, setIsStatusModalOpen]       = useState(false);
    const [isEmailModalOpen, setIsEmailModalOpen]         = useState(false);

    const [currentCandidateId,    setCurrentCandidateId]    = useState(null);
    const [currentCandidateName,  setCurrentCandidateName]  = useState('');
    const [currentCandidateEmail, setCurrentCandidateEmail] = useState('');
    const [currentCandidateMobile, setCurrentCandidateMobile] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [companyLogo, setCompanyLogo] = useState('');

    const [currentInterviewId, setCurrentInterviewId] = useState(null);
    const [originalRound, setOriginalRound] = useState('');
    const [applyPost,      setApplyPost]      = useState('');
    const [roundSelect,    setRoundSelect]    = useState('');
    const [interviewDate,  setInterviewDate]  = useState('');
    const [modeSelect,     setModeSelect]     = useState('');

    const [previousInterviews, setPreviousInterviews] = useState([]);
    const [formError,      setFormError]      = useState('');

    const [selectedInterviewId, setSelectedInterviewId] = useState(null);
    const [selectedStatus,      setSelectedStatus]      = useState('');
    const [statusRemarks,       setStatusRemarks]       = useState('');
    const [statusComments,      setStatusComments]      = useState('');

    /* ── Email modal state ── */
    const [emailTemplates,    setEmailTemplates]    = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [emailTo,           setEmailTo]           = useState('');
    const [emailCC,           setEmailCC]           = useState('');
    const [emailBCC,          setEmailBCC]          = useState('');
    const [emailCCList,       setEmailCCList]       = useState([]);
    const [emailBCCList,      setEmailBCCList]      = useState([]);
    const [showCC,            setShowCC]            = useState(false);
    const [showBCC,           setShowBCC]           = useState(false);

    const [isPreviewMode,     setIsPreviewMode]     = useState(false);
    const [hasDraftAvailable, setHasDraftAvailable] = useState(false);
    const [emailSubject,      setEmailSubject]      = useState('');
    const [emailBody,         setEmailBody]         = useState('');
    const [emailSending,      setEmailSending]      = useState('');   // '' | 'sending' | 'sent' | 'error'
    const [emailMessage,      setEmailMessage]      = useState('');
    const [emailHistory,      setEmailHistory]      = useState([]);
    const [emailTab,          setEmailTab]          = useState('compose'); // 'compose' | 'history'

    const [selectedTemplateName, setSelectedTemplateName] = useState('');

    /* ── Custom sender fields ── */
    const [showSenderFields, setShowSenderFields] = useState(false);
    const [senderEmail, setSenderEmail] = useState('');
    const [senderPassword, setSenderPassword] = useState('');

    /* ── Email Action Modal state (after Save Interview) ── */
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [actionTemplates,   setActionTemplates]   = useState([]);
    const [actionTemplateId,  setActionTemplateId]  = useState('');
    const [actionTemplateSubject, setActionTemplateSubject] = useState('');
    const [actionSaving,      setActionSaving]      = useState('');
    const [actionMessage,     setActionMessage]     = useState('');

    /* ── Email status per candidate ── */
    const [emailStatuses, setEmailStatuses] = useState({});
    const [emailCandidateModal, setEmailCandidateModal] = useState(null);
    const [emailCandidateStatus, setEmailCandidateStatus] = useState(null);

    /* ── Add Candidate modal (self-contained in AddCandidateModal) ── */
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);

    /* ── load candidates ── */
    useEffect(() => { fetchCandidates(); }, []);

    useEffect(() => {
        fetch(`${API}/settings/company`, { headers: auth() })
            .then(res => res.ok ? res.json() : {})
            .then(data => { setCompanyName(data.company_name || ''); setCompanyLogo(data.company_logo || ''); })
            .catch(() => {});
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('newCandidate')) {
            // Clean the URL without reload
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, [location.search]);

    const fetchCandidates = () => {
        setLoadingCandidates(true);
        setFetchError('');
        fetch(`${API}/candidate/data`, { headers: auth() })
            .then(res => {
                if (res.status === 401) { localStorage.removeItem('token'); window.location.href = '/login'; return; }
                if (!res.ok) throw new Error(`Server error: ${res.status}`);
                return res.json();
            })
            .then(data => {
                const arr = Array.isArray(data) ? data : (data?.data || []);
                setCandidates(arr);
                setFetchError('');
                loadEmailStatuses(arr);
            })
            .catch(err => {
                setCandidates([]);
                setFetchError(
                    err.message.includes('fetch') || err.message.includes('Failed')
                        ? 'Cannot connect to the backend server. Please make sure it is running on /api'
                        : err.message
                );
            })
            .finally(() => setLoadingCandidates(false));
    };

    const loadEmailStatuses = async (candidatesList) => {
        if (candidatesList.length === 0) { setEmailStatuses({}); return; }
        try {
            const res = await fetch(`${API}/candidate/email-status/batch`, {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: candidatesList.map(c => c.id) }),
            });
            const map = await res.json();
            setEmailStatuses(map && typeof map === 'object' ? map : {});
        } catch {
            setEmailStatuses({});
        }
    };

    const loadApplyPosts = () => {
        fetch(`${API}/HRMS/GetApplyPostList`, { headers: auth() })
            .then(r => r.json())
            .then(d => setApplyPosts(Array.isArray(d) ? d : []))
            .catch(() => setApplyPosts([]));
    };

    /* ── load saved templates ── */
    const loadTemplates = () => {
        fetch(`${API}/templates/`, { headers: auth() })
            .then(r => r.json())
            .then(d => setEmailTemplates(Array.isArray(d) ? d : []))
            .catch(() => setEmailTemplates([]));
    };

    const editCandidate = (id) => {
        setFormError('');
        setCurrentCandidateId(id);
        setCurrentInterviewId(null);
        setOriginalRound('');
        loadApplyPosts();
        fetch(`${API}/candidate/details/${id}`, { headers: auth() })
            .then(r => r.json())
            .then(d => {
                setCurrentCandidateName(d.candidate_name || '');
                setCurrentCandidateEmail(d.email_id || '');
                setCurrentCandidateMobile(d.contact_number || '');
                setApplyPost(d.current_interview?.apply_post || '');
                setRoundSelect(d.current_interview?.interview_round || '');
                setInterviewDate(d.current_interview?.interview_date
                    ? d.current_interview.interview_date.split('T')[0] : '');
                setModeSelect(d.current_interview?.interview_mode || '');
                setPreviousInterviews(d.previous_interviews || []);
                if (d.current_interview) {
                    setCurrentInterviewId(d.current_interview.id);
                    setOriginalRound(d.current_interview.interview_round || '');
                }
                setIsCandidateModalOpen(true);
            })
            .catch(console.error);
    };

    const deleteCandidate = (id) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'This candidate and all related interviews will be permanently deleted!',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, delete it!',
        }).then(result => {
            if (!result.isConfirmed) return;
            fetch(`${API}/candidate/delete/${id}`, { method: 'DELETE', headers: auth() })
                .then(async r => {
                    const data = await r.json();
                    if (!r.ok) throw new Error(data.detail || `Server error: ${r.status}`);
                    if (data.success) {
                        Swal.fire('Deleted!', 'Candidate has been deleted.', 'success');
                        fetchCandidates();
                    } else {
                        throw new Error(data.detail || 'Could not delete candidate.');
                    }
                })
                .catch(err => Swal.fire('Error!', err.message, 'error'));
        });
    };

    /* ── save / update interview → open email action modal ── */
    const saveInterview = () => {
        setFormError('');
        if (!roundSelect) { setFormError('⚠️  Please select Interview Round'); return; }
        if (!interviewDate) { setFormError('⚠️  Please select Interview Date'); return; }

        // Round name changed → add new round (POST); same round → update in place (PUT)
        const isNewRound = !currentInterviewId || (originalRound && roundSelect !== originalRound);
        const url = isNewRound ? `${API}/interview/save` : `${API}/interview/update/${currentInterviewId}`;
        const method = isNewRound ? 'POST' : 'PUT';

        fetch(url, {
            method,
            headers: { ...auth(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                candidate_id:     currentCandidateId,
                apply_post:       applyPost,
                interview_round:  roundSelect,
                interview_date:   interviewDate,
                interview_mode:   modeSelect,
                status:           'Scheduled',
            }),
        })
        .then(r => r.json())
        .then(data => {
            if (!data.success) throw new Error(data.detail || 'Save failed');
            setCurrentInterviewId(null);
            setOriginalRound('');
            setIsCandidateModalOpen(false);
            fetchCandidates();
            if (isNewRound) openActionModal();
        })
        .catch(err => {
            Swal.fire('Error', err.message, 'error');
        });
    };

    /* ── Open Email Action Modal ── */
    const openActionModal = () => {
        setActionTemplateId('');
        setActionTemplateSubject('');
        setActionSaving('');
        setActionMessage('');
        fetch(`${API}/templates/`, { headers: auth() })
            .then(r => r.json())
            .then(d => {
                const all = Array.isArray(d) ? d : [];
                setActionTemplates(all.filter(t => t.template_type === 'Interview'));
            })
            .catch(() => setActionTemplates([]));
        setIsActionModalOpen(true);
    };

    /* ── shared template-variable map for the currently open candidate/interview ── */
    const currentTemplateVars = () => buildTemplateVars({
        candidateName: currentCandidateName,
        candidateEmail: currentCandidateEmail,
        candidateMobile: currentCandidateMobile,
        applyPost, roundSelect, interviewDate, modeSelect,
        companyName, senderEmail, companyLogo,
    });

    /* ── Handle template selection in action modal ── */
    const onActionTemplateSelect = (tplId) => {
        setActionTemplateId(tplId);
        setActionTemplateSubject('');
        if (!tplId) return;
        const tpl = actionTemplates.find(t => t.id === tplId);
        if (!tpl) return;
        setActionTemplateSubject(fillVariables(tpl.subject, currentTemplateVars()));
    };

    /* ── Handle template selection in the Candidate Pool email-action modal ──
       forcedSubject lets "Edit Draft" restore a saved subject verbatim. ── */
    const onCandidateTemplateSelect = (tplId, forcedSubject) => {
        setActionTemplateId(tplId);
        setSelectedTemplateName('');
        if (forcedSubject !== undefined) { setActionTemplateSubject(forcedSubject); return; }
        if (!tplId) { setActionTemplateSubject(''); return; }
        const tpl = actionTemplates.find(t => t.id === tplId);
        if (!tpl) return;
        setSelectedTemplateName(tpl.name);
        setActionTemplateSubject(fillVariables(tpl.subject, currentTemplateVars()));
    };

    /* ── Save as Draft ── */
    const saveAsDraft = async () => {
        const tpl = actionTemplates.find(t => t.id === actionTemplateId);
        setActionSaving('draft');
        setActionMessage('');
        const vars = currentTemplateVars();
        const subject = actionTemplateSubject || fillVariables(tpl.subject, vars);
        const body = fillVariables(tpl.body, vars);
        try {
            await saveEmailDraft({
                candidate_id: currentCandidateId,
                candidate_name: currentCandidateName,
                to_email: currentCandidateEmail,
                subject, body,
                template_id: actionTemplateId,
                template_name: tpl ? tpl.name : '',
            });
            setActionSaving('');
            setIsActionModalOpen(false);
            Swal.fire({ icon: 'success', title: 'Draft Saved!', text: `Interview invitation draft saved for ${currentCandidateName}`, timer: 2000, showConfirmButton: false });
        } catch (err) {
            setActionSaving('');
            setActionMessage(err.message);
        }
    };

    /* ── Remind Me Later ── */
    const remindMeLater = async () => {
        const tpl = actionTemplates.find(t => t.id === actionTemplateId);
        setActionSaving('remind');
        setActionMessage('');
        const vars = currentTemplateVars();
        const subject = actionTemplateSubject || (tpl ? fillVariables(tpl.subject, vars) : '');
        const body = tpl ? fillVariables(tpl.body, vars) : '';
        try {
            const draftData = await saveEmailDraft({
                candidate_id: currentCandidateId,
                candidate_name: currentCandidateName,
                to_email: currentCandidateEmail,
                subject, body,
                template_id: actionTemplateId,
                template_name: tpl ? tpl.name : '',
            });
            await createReminder({
                candidate_id: currentCandidateId,
                candidate_name: currentCandidateName,
                candidate_email: currentCandidateEmail,
                job_role: applyPost,
                communication_type: 'Interview Invitation',
                draft_id: draftData.id,
            });
            setActionSaving('');
            setIsActionModalOpen(false);
            Swal.fire({ icon: 'success', title: 'Reminder Scheduled!', text: `Interview invitation pending for ${currentCandidateName}`, timer: 2000, showConfirmButton: false });
        } catch (err) {
            setActionSaving('');
            setActionMessage(err.message);
        }
    };

    /* ── Send Now (open email compose) ── */
    const sendNow = () => {
        setIsActionModalOpen(false);
        openEmailModal();
    };

    /* ── Open Email Action Modal (from Candidate Pool Email button) ── */
    const [emailModalLoading, setEmailModalLoading] = useState(false);
    const openEmailAction = (candidate, statusData) => {
        setCurrentCandidateId(candidate.id);
        setCurrentCandidateName(candidate.candidate_name);
        setCurrentCandidateEmail(candidate.email_id || '');
        setCurrentCandidateMobile(candidate.contact_number || '');
        setApplyPost(candidate.apply_post || '');
        setRoundSelect(candidate.interview_round || '');
        setInterviewDate(candidate.interview_date ? candidate.interview_date.split('T')[0] : '');
        setModeSelect(candidate.interview_mode || '');
        setEmailCandidateStatus(statusData || { status: 'no_email' });
        setEmailCandidateModal(true);
        setActionTemplateId('');
        setActionTemplateSubject('');
        setSelectedTemplateName('');
        setActionSaving('');
        setActionMessage('');
        setSenderEmail('');
        setSenderPassword('');
        fetch(`${API}/templates/`, { headers: auth() })
            .then(r => r.json())
            .then(d => setActionTemplates(Array.isArray(d) ? d : []))
            .catch(() => setActionTemplates([]));
    };

    const closeEmailActionModal = () => {
        setEmailCandidateModal(false);
        setEmailCandidateStatus(null);
        fetchCandidates();
    };

    /* ── Send email from Candidate Email Action Modal ── */
    const sendCandidateEmail = async (statusData) => {
        if (!actionTemplateId && !statusData?.draft?.subject && !statusData?.draft?.body) {
            Swal.fire({ icon:'warning', title:'Select Template', text:'Please select an email template or save a draft first.' });
            return;
        }
        setActionSaving('sending');
        const vars = currentTemplateVars();
        const tpl = actionTemplates.find(t => t.id === actionTemplateId);
        const draft = statusData?.draft;
        const subject = tpl ? (actionTemplateSubject || fillVariables(tpl.subject, vars)) : (draft?.subject || '');
        const body = tpl ? fillVariables(tpl.body, vars) : (draft?.body || '');
        const templateName = tpl?.name || selectedTemplateName || draft?.template_name || null;
        try {
            const res = await fetch(`${API}/email/send-template`, {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_email: currentCandidateEmail,
                    subject, body,
                    candidate_id: currentCandidateId,
                    candidate_name: currentCandidateName,
                    job_role: applyPost,
                    template_name: templateName,
                    sender_email: showSenderFields ? (senderEmail || null) : null,
                    sender_password: showSenderFields ? (senderPassword || null) : null,
                }),
            });
            const d = await res.json();
            if (res.ok) {
                // Update draft if exists
                if (statusData?.draft?.id) {
                    await fetch(`${API}/email/drafts/${statusData.draft.id}`, {
                        method: 'PUT',
                        headers: { ...auth(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'SENT' }),
                    }).catch(() => {});
                }
                // Complete reminder if exists
                if (statusData?.reminder?.id) {
                    await fetch(`${API}/reminders/${statusData.reminder.id}`, {
                        method: 'PUT',
                        headers: { ...auth(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'COMPLETED', email_sent: true }),
                    }).catch(() => {});
                }
                Swal.fire({ icon:'success', title:'Email Sent!', text:`Interview invitation sent to ${currentCandidateName}`, timer:2000, showConfirmButton:false });
                setActionSaving('');
                closeEmailActionModal();
            } else {
                setActionSaving('');
                Swal.fire({ icon:'error', title:'Failed', text:d.detail || d.message || 'Could not send email.' });
            }
        } catch (e) {
            setActionSaving('');
            Swal.fire({ icon:'error', title:'Error', text:e.message });
        }
    };

    /* ── Save as Draft from Candidate Email Action Modal ── */
    const saveCandidateDraft = async () => {
        const tpl = actionTemplates.find(t => t.id === actionTemplateId);
        if (!tpl) { Swal.fire({ icon:'warning', title:'Select Template', text:'Please select an email template.' }); return; }
        setActionSaving('draft');
        const vars = currentTemplateVars();
        const subject = actionTemplateSubject || fillVariables(tpl.subject, vars);
        const body = fillVariables(tpl.body, vars);
        try {
            const d = await saveEmailDraft({
                candidate_id: currentCandidateId,
                candidate_name: currentCandidateName,
                to_email: currentCandidateEmail,
                subject, body,
                template_id: tpl.id,
                template_name: tpl.name,
            });
            Swal.fire({ icon:'success', title:'Draft Saved!', timer:1500, showConfirmButton:false });
            setEmailCandidateStatus(prev => ({ ...prev, status:'draft_saved', draft:{ ...(prev?.draft||{}), id:d.id, subject, body, template_id:tpl.id, template_name:tpl.name, to_email:currentCandidateEmail, status:'DRAFT' } }));
        } catch (e) {
            Swal.fire({ icon:'error', title:'Error', text:e.message });
        }
        setActionSaving('');
    };

    /* ── Create Reminder from Candidate Email Action Modal ── */
    const createCandidateReminder = async () => {
        const tpl = actionTemplates.find(t => t.id === actionTemplateId);
        if (!tpl) { Swal.fire({ icon:'warning', title:'Select Template', text:'Please select an email template.' }); return; }
        setActionSaving('remind');
        const vars = currentTemplateVars();
        const subject = actionTemplateSubject || fillVariables(tpl.subject, vars);
        const body = fillVariables(tpl.body, vars);
        try {
            const draftData = await saveEmailDraft({
                candidate_id: currentCandidateId,
                candidate_name: currentCandidateName,
                to_email: currentCandidateEmail,
                subject, body,
                template_id: tpl.id,
                template_name: tpl.name,
            });
            const remData = await createReminder({
                candidate_id: currentCandidateId,
                candidate_name: currentCandidateName,
                candidate_email: currentCandidateEmail,
                job_role: applyPost,
                communication_type: 'Interview Invitation',
                draft_id: draftData.id,
            });
            Swal.fire({ icon:'success', title:'Reminder Scheduled!', timer:1500, showConfirmButton:false });
            setEmailCandidateStatus(prev => ({ ...prev, status:'reminder_active', draft:{ ...(prev?.draft||{}), id:draftData.id, subject, body, status:'DRAFT' }, reminder:{ ...(prev?.reminder||{}), id:remData.id, status:'ACTIVE', reminder_time:remData.reminder_time, default_delay:remData.default_delay } }));
        } catch (e) {
            Swal.fire({ icon:'error', title:'Error', text:e.message });
        }
        setActionSaving('');
    };

    /* ── load email history for current candidate ── */
    const loadEmailHistory = (candidateId) => {
        if (!candidateId) return;
        fetch(`${API}/email/logs/${candidateId}`, { headers: auth() })
            .then(r => r.json())
            .then(d => setEmailHistory(Array.isArray(d) ? d : []))
            .catch(() => setEmailHistory([]));
    };

    /* ── open email compose modal ── */
    const openEmailModal = async () => {
        loadTemplates();
        loadEmailHistory(currentCandidateId);
        setSelectedTemplateId('');
        setEmailTo(currentCandidateEmail);
        setEmailSending('');
        setEmailMessage('');
        setEmailTab('compose');
        setIsPreviewMode(false);
        setIsEmailModalOpen(true);

        // Clear sender fields (never pre-filled — entered fresh each time)
        setSenderEmail('');
        setSenderPassword('');

        // Load default CC/BCC from SMTP settings
        setShowCC(false);
        setShowBCC(false);
        setEmailCC('');
        setEmailBCC('');
        setEmailCCList([]);
        setEmailBCCList([]);
        try {
            const smtpRes = await fetch(`${API}/settings/smtp`, { headers: auth() });
            if (smtpRes.ok) {
                const smtp = await smtpRes.json();
                const ccDef = (smtp.default_cc_emails || '').split(',').filter(Boolean);
                const bccDef = (smtp.default_bcc_emails || '').split(',').filter(Boolean);
                if (ccDef.length > 0) {
                    setEmailCCList(ccDef);
                    setShowCC(true);
                }
                if (bccDef.length > 0) {
                    setEmailBCCList(bccDef);
                    setShowBCC(true);
                }
            }
        } catch (e) { /* ignore */ }
        
        setEmailSubject('');
        setEmailBody('');

        try {
            const response = await fetch(`${API}/email/draft/${currentCandidateId}`, {
                headers: auth()
            });
            if (response.ok) {
                const draft = await response.json();
                if (draft && draft.id) {
                    setHasDraftAvailable(true);
                    Swal.fire({
                        title: 'Draft Found!',
                        text: `We found a draft saved for ${currentCandidateName}. Would you like to restore it?`,
                        icon: 'info',
                        showCancelButton: true,
                        confirmButtonText: 'Restore Draft',
                        cancelButtonText: 'Start Fresh',
                        confirmButtonColor: '#4338ca',
                        cancelButtonColor: '#64748b',
                    }).then((result) => {
                        if (result.isConfirmed) {
                            setEmailTo(draft.to_email || currentCandidateEmail);
                            setEmailCC(draft.cc || '');
                            setEmailBCC(draft.bcc || '');
                            setShowCC(!!draft.cc);
                            setShowBCC(!!draft.bcc);
                            setEmailSubject(draft.subject || '');
                            setEmailBody(draft.body || '');
                            setSelectedTemplateId(draft.template_id || '');
                        }
                    });
                } else {
                    setHasDraftAvailable(false);
                }
            }
        } catch (err) {
            console.error("Failed to check for drafts:", err);
        }
    };

    /* ── save email draft ── */
    const saveDraft = async () => {
        try {
            const res = await fetch(`${API}/email/draft`, {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    candidate_id:   currentCandidateId,
                    candidate_name: currentCandidateName,
                    to_email:       emailTo,
                    cc:             emailCC || null,
                    bcc:            emailBCC || null,
                    subject:        emailSubject || '',
                    body:           emailBody || '',
                    template_id:    selectedTemplateId || null
                })
            });
            const data = await res.json();
            if (data.id) {
                Swal.fire({
                    icon: 'success',
                    title: 'Draft Saved',
                    text: 'Your email draft has been successfully saved.',
                    timer: 1500,
                    showConfirmButton: false
                });
                setHasDraftAvailable(true);
            } else {
                throw new Error("Failed to save draft.");
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error Saving Draft',
                text: err.message
            });
        }
    };

    /* ── discard email draft ── */
    const discardDraft = async () => {
        Swal.fire({
            title: 'Discard Draft?',
            text: 'This will permanently delete your saved draft.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'Yes, discard it!'
        }).then(async (result) => {
            if (result.isConfirmed) {
                try {
                    await fetch(`${API}/email/draft/${currentCandidateId}`, {
                        method: 'DELETE',
                        headers: auth()
                    });
                    setHasDraftAvailable(false);
                    setSelectedTemplateId('');
                    setEmailTo(currentCandidateEmail || '');
                    setEmailCC('');
                    setEmailBCC('');
                    setShowCC(false);
                    setShowBCC(false);
                    setEmailSubject('');
                    setEmailBody('');
                    Swal.fire('Discarded!', 'Your draft has been deleted.', 'success');
                } catch (err) {
                    Swal.fire('Error', 'Failed to discard draft.', 'error');
                }
            }
        });
    };


    /* ── when user picks a template → auto-fill + substitute variables ── */
    const onTemplateSelect = (templateId) => {
        setSelectedTemplateId(templateId);
        setEmailSending('');
        setEmailMessage('');

        if (!templateId) {
            setEmailSubject('');
            setEmailBody('');
            return;
        }

        const tpl = emailTemplates.find(t => t.id === templateId);
        if (!tpl) return;

        let interviewTime = '';
        if (interviewDate) {
            try { const d = new Date(interviewDate); interviewTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); } catch {}
        }
        const variableMap = {
            candidate_name:   currentCandidateName || '',
            interview_date:   interviewDate || '',
            interview_time:   interviewTime,
            apply_post:       applyPost || '',
            job_role:         applyPost || '',
            interview_round:  roundSelect || '',
            interview_mode:   modeSelect || '',
            candidate_email:  currentCandidateEmail || '',
            email_id:         currentCandidateEmail || '',
            contact_number:   currentCandidateMobile || '',
            sender_name:      'HR Team',
            company_name:     companyName,
            company_logo:     companyLogo || '',
            hr_name:          'Yashi Mishra',
            sender_email:     senderEmail || '',
            hr_email:         senderEmail || '',
        };

        setEmailSubject(fillVariables(tpl.subject, variableMap));
        setEmailBody(fillVariables(tpl.body, variableMap));
    };

    /* ── send email via SMTP ── */
    const sendEmail = async () => {
        if (!emailTo || !emailTo.includes('@')) {
            Swal.fire({ icon: 'warning', title: 'Invalid Email', text: 'Please provide a valid recipient email.' });
            return;
        }
        if (!emailSubject.trim()) {
            Swal.fire({ icon: 'warning', title: 'Missing Subject', text: 'Please enter an email subject.' });
            return;
        }
        if (!emailBody.trim()) {
            Swal.fire({ icon: 'warning', title: 'Empty Body', text: 'Please enter the email body.' });
            return;
        }

        setEmailSending('sending');
        setEmailMessage('');

        // Resolve template name from selected template
        const selectedTpl = emailTemplates.find(t => t.id === selectedTemplateId);
        const finalCC = showCC ? (emailCCList.filter(Boolean).join(',') + (emailCC.trim() ? ',' + emailCC.trim() : '')) : '';
        const finalBCC = showBCC ? (emailBCCList.filter(Boolean).join(',') + (emailBCC.trim() ? ',' + emailBCC.trim() : '')) : '';

        try {
            const res = await fetch(`${API}/email/send-template`, {
                method: 'POST',
                headers: { ...auth(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_email:        emailTo,
                    cc:              finalCC || null,
                    bcc:             finalBCC || null,
                    subject:         emailSubject,
                    body:            emailBody,
                    candidate_id:    currentCandidateId,
                    candidate_name:  currentCandidateName,
                    job_role:        applyPost,
                    interview_round: roundSelect,
                    interview_date:  interviewDate || null,
                    template_name:   selectedTpl ? selectedTpl.name : null,
                    sender_email:    senderEmail || null,
                    sender_password: senderPassword || null,
                }),
            });
            const json = await res.json();

            if (res.ok) {
                setEmailSending('sent');
                setEmailMessage(json.message || 'Email sent successfully!');
                setIsPreviewMode(false);

                // Clear the saved draft since it is successfully sent
                try {
                    await fetch(`${API}/email/draft/${currentCandidateId}`, {
                        method: 'DELETE',
                        headers: auth()
                    });
                    setHasDraftAvailable(false);
                } catch (draftErr) {
                    console.error("Failed to delete draft after send:", draftErr);
                }

                loadEmailHistory(currentCandidateId);
                setTimeout(() => {
                    setIsEmailModalOpen(false);
                    setIsCandidateModalOpen(false);
                    fetchCandidates();
                }, 2000);
            } else {
                setEmailSending('error');
                setEmailMessage(json.detail || json.message || 'Failed to send email.');
                loadEmailHistory(currentCandidateId);
            }
        } catch (e) {
            setEmailSending('error');
            setEmailMessage('Network error: ' + e.message);
        }
    };


    const closeEmailModal = () => {
        setIsEmailModalOpen(false);
        setIsCandidateModalOpen(false);
        fetchCandidates();
    };

    /* ── status update ── */
    const onStatusChange = (id, status) => {
        if (status === 'Scheduled') return;
        Swal.fire({
            title: 'Confirm Status Change?',
            text: `Change status to "${status}"`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, Update',
        }).then(result => {
            if (result.isConfirmed) {
                setSelectedInterviewId(id);
                setSelectedStatus(status);
                setIsStatusModalOpen(true);
            }
        });
    };

    const saveStatus = () => {
        fetch(`${API}/HRMS/UpdateInterviewStatus`, {
            method: 'POST',
            headers: { ...auth(), 'Content-Type': 'application/json' },
            body: JSON.stringify({
                interview_id: selectedInterviewId,
                status:       selectedStatus,
                remarks:      statusRemarks,
                comments:     statusComments,
            }),
        }).then(() => {
            Swal.fire({ icon: 'success', title: 'Status Updated' }).then(() => {
                setIsStatusModalOpen(false);
                setIsCandidateModalOpen(false);
                fetchCandidates();
            });
        });
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        if (isNaN(d)) return dateStr;
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return `${String(d.getDate()).padStart(2,'0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    /* ─────────────────── RENDER ─────────────────── */
    return (
        <React.Fragment>
            <style>{candidateDataStyles}</style>

            {/* ══════════════════════════ MAIN TABLE CARD ══════════════════════════ */}
            <CandidateTable
                candidates={candidates}
                emailStatuses={emailStatuses}
                loadingCandidates={loadingCandidates}
                fetchError={fetchError}
                formatDate={formatDate}
                onRefresh={fetchCandidates}
                onAdd={() => navigate('/candidates/add')}
                onEdit={editCandidate}
                onView={id => navigate(`/candidates/view/${id}`)}
                onEmailAction={openEmailAction}
                onDelete={deleteCandidate}
            />

            {/* ══════════════════════════ INTERVIEW MODAL ══════════════════════════ */}
            <InterviewModal
                isOpen={isCandidateModalOpen}
                candidateName={currentCandidateName}
                formError={formError}
                applyPost={applyPost}
                applyPosts={applyPosts}
                roundSelect={roundSelect}
                interviewDate={interviewDate}
                modeSelect={modeSelect}
                onApplyPostChange={v => { setApplyPost(v); setFormError(''); }}
                onRoundChange={v => { setRoundSelect(v); setFormError(''); }}
                onDateChange={v => { setInterviewDate(v); setFormError(''); }}
                onModeChange={v => { setModeSelect(v); setFormError(''); }}
                previousInterviews={previousInterviews}
                onPrevStatusChange={onStatusChange}
                onSave={saveInterview}
                onCancel={() => setIsCandidateModalOpen(false)}
            />

            {/* ══════════════════════════ STATUS MODAL ══════════════════════════ */}
            <StatusModal
                isOpen={isStatusModalOpen}
                remarks={statusRemarks}
                comments={statusComments}
                onRemarksChange={setStatusRemarks}
                onCommentsChange={setStatusComments}
                onSave={saveStatus}
                onCancel={() => setIsStatusModalOpen(false)}
            />

            {/* ══════════════════════════ EMAIL ACTION MODAL ══════════════════════════ */}
            <EmailActionModal
                isOpen={isActionModalOpen}
                candidateName={currentCandidateName}
                candidateEmail={currentCandidateEmail}
                templates={actionTemplates}
                templateId={actionTemplateId}
                templateSubject={actionTemplateSubject}
                message={actionMessage}
                saving={actionSaving}
                onTemplateSelect={onActionTemplateSelect}
                onSendNow={sendNow}
                onSaveDraft={saveAsDraft}
                onRemindLater={remindMeLater}
                onClose={() => setIsActionModalOpen(false)}
            />

            {/* ══════════════════════════ EMAIL COMPOSE MODAL ══════════════════════════ */}
            <EmailComposeModal
                isOpen={isEmailModalOpen}
                candidateName={currentCandidateName}
                candidateEmail={currentCandidateEmail}
                applyPost={applyPost}
                roundSelect={roundSelect}
                interviewDate={interviewDate}
                modeSelect={modeSelect}
                emailTab={emailTab}
                setEmailTab={setEmailTab}
                loadEmailHistory={() => loadEmailHistory(currentCandidateId)}
                emailHistory={emailHistory}
                emailTemplates={emailTemplates}
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={onTemplateSelect}
                emailTo={emailTo}
                setEmailTo={setEmailTo}
                senderEmail={senderEmail}
                setSenderEmail={setSenderEmail}
                senderPassword={senderPassword}
                setSenderPassword={setSenderPassword}
                showCC={showCC}
                setShowCC={setShowCC}
                showBCC={showBCC}
                setShowBCC={setShowBCC}
                emailCC={emailCC}
                setEmailCC={setEmailCC}
                emailCCList={emailCCList}
                setEmailCCList={setEmailCCList}
                emailBCC={emailBCC}
                setEmailBCC={setEmailBCC}
                emailBCCList={emailBCCList}
                setEmailBCCList={setEmailBCCList}
                emailSubject={emailSubject}
                setEmailSubject={setEmailSubject}
                emailBody={emailBody}
                setEmailBody={setEmailBody}
                emailSending={emailSending}
                emailMessage={emailMessage}
                isPreviewMode={isPreviewMode}
                setIsPreviewMode={setIsPreviewMode}
                hasDraftAvailable={hasDraftAvailable}
                onClose={closeEmailModal}
                onSaveDraft={saveDraft}
                onDiscardDraft={discardDraft}
                onSendEmail={sendEmail}
            />

            {/* ══════════════════════════ CANDIDATE EMAIL ACTION MODAL ══════════════════════════ */}
            {emailCandidateModal && (
                <CandidateEmailActionModal
                    candidateId={currentCandidateId}
                    candidateName={currentCandidateName}
                    candidateEmail={currentCandidateEmail}
                    status={emailCandidateStatus}
                    setStatus={setEmailCandidateStatus}
                    templates={actionTemplates}
                    templateId={actionTemplateId}
                    templateSubject={actionTemplateSubject}
                    senderEmail={senderEmail}
                    setSenderEmail={setSenderEmail}
                    senderPassword={senderPassword}
                    setSenderPassword={setSenderPassword}
                    saving={actionSaving}
                    onTemplateSelect={onCandidateTemplateSelect}
                    onSend={sendCandidateEmail}
                    onSaveDraft={saveCandidateDraft}
                    onCreateReminder={createCandidateReminder}
                    onClose={closeEmailActionModal}
                />
            )}

            {/* ══════════════════════════ ADD CANDIDATE MODAL ══════════════════════════ */}
            <AddCandidateModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSaved={fetchCandidates}
            />
        </React.Fragment>
    );
};

export default CandidateData;
