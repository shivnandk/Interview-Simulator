import React from 'react';

const StatusIndicator = ({ status }) => {
    const { state, text } = status;

    const getStatusClass = () => {
        if (state === 'listening') return 'status-listening';
        if (state === 'processing') return 'status-processing';
        if (state === 'speaking') return 'status-speaking';
        return '';
    };

    return (
        <div id="statusContainer" className={getStatusClass()}>
            <div className="status-badge">
                <div className="status-dot"></div>
                <span id="statusText">{text}</span>
            </div>
        </div>
    );
};

export default StatusIndicator;
