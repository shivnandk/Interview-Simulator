import React, { useState } from 'react';

const ROLES = [
    { id: 'backend', label: 'Backend Engineer' },
    { id: 'frontend', label: 'Frontend Engineer' },
    { id: 'fullstack', label: 'Fullstack Engineer' },
    { id: 'dsa', label: 'DSA / Algorithms' },
    { id: 'system-design', label: 'System Design' },
    { id: 'custom', label: 'Custom Role' }
];

const EXPERIENCE_LEVELS = [
    { id: 'fresher', label: 'Fresher' },
    { id: '1-3', label: '1–3 Years' },
    { id: '3-5', label: '3–5 Years' },
    { id: 'senior', label: 'Senior (5+ Years)' }
];

const TOPICS = [
    'Node.js', 'React', 'JavaScript', 'Python', 'Go',
    'SQL', 'NoSQL', 'System Design', 'Cloud / AWS',
    'Testing', 'Security', 'Architecture', 'Soft Skills'
];

const STYLES = [
    { id: 'conversational', label: 'Conversational' },
    { id: 'hint-based', label: 'Hint-based' },
    { id: 'strict', label: 'Strict' }
];

const InterviewSetup = ({ onStart }) => {
    const [config, setConfig] = useState({
        role: 'backend',
        experience: '1-3',
        topics: [],
        style: 'conversational',
        difficulty: 'medium'
    });

    const handleTopicToggle = (topic) => {
        setConfig(prev => ({
            ...prev,
            topics: prev.topics.includes(topic)
                ? prev.topics.filter(t => t !== topic)
                : [...prev.topics, topic]
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onStart(config);
    };

    return (
        <div className="setup-container">
            <div className="setup-card">
                <header className="setup-header">
                    <h2>🎯 Configure Your Interview</h2>
                    <p>Personalize your experience to get the most relevant feedback.</p>
                </header>

                <form onSubmit={handleSubmit} className="setup-form">
                    <div className="setup-grid">
                        {/* Role Selection */}
                        <div className="form-group">
                            <label>Target Role</label>
                            <select
                                value={config.role}
                                onChange={(e) => setConfig({ ...config, role: e.target.value })}
                            >
                                {ROLES.map(role => (
                                    <option key={role.id} value={role.id}>{role.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Experience Level */}
                        <div className="form-group">
                            <label>Experience Level</label>
                            <select
                                value={config.experience}
                                onChange={(e) => setConfig({ ...config, experience: e.target.value })}
                            >
                                {EXPERIENCE_LEVELS.map(level => (
                                    <option key={level.id} value={level.id}>{level.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Style */}
                        <div className="form-group">
                            <label>Interview Style</label>
                            <div className="style-chips">
                                {STYLES.map(style => (
                                    <button
                                        key={style.id}
                                        type="button"
                                        className={`style-chip ${config.style === style.id ? 'active' : ''}`}
                                        onClick={() => setConfig({ ...config, style: style.id })}
                                    >
                                        {style.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Difficulty */}
                        <div className="form-group">
                            <label>Difficulty</label>
                            <div className="difficulty-radio">
                                {['Easy', 'Medium', 'Hard'].map(level => (
                                    <label key={level} className="radio-label">
                                        <input
                                            type="radio"
                                            name="difficulty"
                                            value={level.toLowerCase()}
                                            checked={config.difficulty === level.toLowerCase()}
                                            onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}
                                        />
                                        <span>{level}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Topic Selection */}
                    <div className="form-group topics-section">
                        <label>Topics to Cover (Optional)</label>
                        <div className="topics-grid">
                            {TOPICS.map(topic => (
                                <button
                                    key={topic}
                                    type="button"
                                    className={`topic-chip ${config.topics.includes(topic) ? 'active' : ''}`}
                                    onClick={() => handleTopicToggle(topic)}
                                >
                                    {topic}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="setup-footer">
                        <button type="submit" className="btn-primary start-button">
                            <span>🚀</span> Start AI Interview
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
        .setup-container {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 20px;
          background: var(--bg-color);
        }
        .setup-card {
          background: var(--surface-color);
          border: 1px solid var(--border-color);
          border-radius: 16px;
          padding: 32px;
          width: 100%;
          max-width: 650px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          animation: slideUp 0.4s ease-out;
        }
        .setup-header { margin-bottom: 24px; text-align: center; }
        .setup-header h2 { margin: 0 0 8px 0; color: white; }
        .setup-header p { color: var(--text-secondary); margin: 0; }
        
        .setup-form { display: flex; flex-direction: column; gap: 24px; }
        .setup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        
        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-group label { font-size: 0.875rem; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
        
        select {
          background: #2a2a2a;
          border: 1px solid #444;
          color: white;
          padding: 10px 12px;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
        }
        
        .style-chips { display: flex; gap: 8px; }
        .style-chip {
          background: #2a2a2a;
          border: 1px solid #444;
          color: var(--text-secondary);
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
        }
        .style-chip.active {
          background: var(--primary-color);
          border-color: var(--primary-color);
          color: white;
        }
        
        .difficulty-radio { display: flex; gap: 16px; align-items: center; padding: 10px 0; }
        .radio-label { display: flex; align-items: center; gap: 6px; cursor: pointer; color: var(--text-secondary); }
        .radio-label input { width: 16px; height: 16px; }
        .radio-label input:checked + span { color: white; }
        
        .topics-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .topic-chip {
          background: #2a2a2a;
          border: 1px solid #444;
          color: var(--text-secondary);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 0.8125rem;
          cursor: pointer;
        }
        .topic-chip.active {
          border-color: var(--secondary-color);
          color: var(--secondary-color);
          background: rgba(16, 185, 129, 0.1);
        }
        
        .setup-footer { margin-top: 12px; }
        .start-button {
          width: 100%;
          justify-content: center;
          padding: 16px;
          font-size: 1.1rem;
          border-radius: 12px;
        }
        
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 600px) {
          .setup-grid { grid-template-columns: 1fr; }
          .setup-card { padding: 20px; }
        }
      `}</style>
        </div>
    );
};

export default InterviewSetup;
