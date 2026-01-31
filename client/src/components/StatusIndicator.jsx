import React from 'react';

const StatusIndicator = ({ status }) => {
    const { state, text } = status;

    const getStatusClass = () => {
        switch (state) {
            case 'listening':
                return 'status-listening';
            case 'processing':
                return 'status-processing';
            case 'speaking':
                return 'status-speaking';
            case 'connecting':
                return 'status-connecting';
            case 'error':
                return 'status-error';
            default:
                return '';
        }
    };

    const getAriaLabel = () => {
        return `Status: ${text}`;
    };

    return (
        <div 
            id="statusContainer" 
            className={getStatusClass()}
            role="status"
            aria-live="polite"
            aria-label={getAriaLabel()}
        >
            <div className="status-badge">
                <div className="status-dot" aria-hidden="true"></div>
                <span id="statusText">{text}</span>
            </div>
        </div>
    );
};

export default StatusIndicator;