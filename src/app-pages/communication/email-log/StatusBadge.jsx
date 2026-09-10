import React from 'react';

export default function StatusBadge({ status }) {
    if (status === 'sent') return <span className="el-badge el-badge-sent"><span className="el-badge-dot el-badge-dot-sent" /> Sent</span>;
    if (status === 'failed') return <span className="el-badge el-badge-failed"><span className="el-badge-dot el-badge-dot-failed" /> Failed</span>;
    return <span className="el-badge el-badge-pending"><span className="el-badge-dot el-badge-dot-pending" /> Pending</span>;
}
