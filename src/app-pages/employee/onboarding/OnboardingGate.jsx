import React from 'react';
import CompleteProfile from './CompleteProfile';
import PendingReview from './PendingReview';

// Shown instead of the normal employee dashboard for any account that
// hasn't been approved yet - status is set at login time (see HRLogin.jsx)
// and re-checked after a successful submission so the screen swaps without
// a full reload.
export default function OnboardingGate({ status, onSubmitted }) {
    if (status === 'pending') return <PendingReview />;
    // 'invited' (blank form) and 'needs_correction' (pre-filled + HR remark)
    // both land on the same form - CompleteProfile fetches /api/profile
    // itself to decide what to pre-fill and whether to show a remark banner.
    return <CompleteProfile onSubmitted={onSubmitted} />;
}
