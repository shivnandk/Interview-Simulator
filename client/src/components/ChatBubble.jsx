import React from 'react';

const ChatBubble = ({ message }) => {
    const { role, content, isSystem } = message;
    const isUser = role === 'user';
    const isAI = role === 'assistant' && !isSystem;

    return (
        <div className={`message ${isUser ? 'user-msg' : 'ai-msg'}`}>
            <span className="message-role">
                {isSystem ? 'System' : isUser ? 'You' : 'AI Interviewer'}
            </span>
            <div className="content">{content}</div>
        </div>
    );
};

export default ChatBubble;
