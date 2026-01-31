import React from 'react';

const ChatBubble = ({ message }) => {
    const { role, content, isSystem, isPartial } = message;
    const isUser = role === 'user';
    const isAI = role === 'assistant' && !isSystem;

    const getRoleLabel = () => {
        if (isSystem) return 'System';
        if (isUser) return 'You';
        return 'AI Interviewer';
    };

    return (
        <div 
            className={`message ${isUser ? 'user-msg' : 'ai-msg'} ${isPartial ? 'partial' : ''}`}
            role="article"
            aria-label={`${getRoleLabel()} message`}
        >
            <span className="message-role" aria-label="speaker">
                {getRoleLabel()}
            </span>
            <div className="content">
                {content}
                {isPartial && (
                    <span className="partial-indicator" aria-label="message in progress">
                        <span className="dot"></span>
                        <span className="dot"></span>
                        <span className="dot"></span>
                    </span>
                )}
            </div>
        </div>
    );
};

export default ChatBubble;