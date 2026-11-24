import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, Send, Sparkles, Bot, User, AtSign, Loader2, Zap, MessageSquare, X, Users, Plus, UserPlus, Shield, Crown, Globe, Lock, CheckCircle2
} from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

export default function DiscordChatView({ 
  channel, 
  activeDM,
  messages = [], 
  messageThreads = {},
  users = [], 
  agents = [], 
  currentUser,
  typingUsers = {},
  onSendMessage,
  onSendThreadReply,
  onTyping,
  onAddChannelMember,
  onRemoveChannelMember,
  onConvertMessageToTask
}) {
  const [text, setText] = useState('');
  const [showMentionPopup, setShowMentionPopup] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Active message thread drawer state
  const [activeThreadMessage, setActiveThreadMessage] = useState(null);
  const [threadReplyText, setThreadReplyText] = useState('');

  // Channel members panel & add member modal state
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Convert Message to AI Task state
  const [convertingMessage, setConvertingMessage] = useState(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskAgentId, setTaskAgentId] = useState('agent-antigravity');

  const messagesEndRef = useRef(null);
  const threadEndRef = useRef(null);
  const inputRef = useRef(null);

  const isDM = !!activeDM;
  const targetId = isDM ? activeDM.id : channel?.id;
  const conversationTitle = isDM ? activeDM.name : (channel?.name || 'general');
  const conversationTopic = isDM ? `Direct Message with ${activeDM.name}` : (channel?.topic || '');

  const busyAgent = agents.find(a => a.status === 'busy');
  const activeTypers = Object.values(typingUsers[targetId] || {}).filter(u => u.id !== currentUser.id);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeDM, busyAgent]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThreadMessage, messageThreads]);

  // Channel member calculations
  const allowedIds = (!isDM && channel?.allowedUserIds) 
    ? channel.allowedUserIds 
    : [...users.map(u => u.id), ...agents.map(a => a.id)];

  const channelMembersUsers = users.filter(u => allowedIds.includes(u.id));
  const channelMembersAgents = agents.filter(a => allowedIds.includes(a.id));
  const totalMemberCount = channelMembersUsers.length + channelMembersAgents.length;

  const availableAgentsToAdd = agents.filter(a => !allowedIds.includes(a.id));
  const availableUsersToAdd = users.filter(u => !allowedIds.includes(u.id));

  const allMentionTargets = [
    ...agents.map(a => ({
      id: a.id,
      name: a.name,
      sub: `CLI: ${a.cliEngine}`,
      avatar: a.avatar,
      color: a.color,
      status: a.status || 'online',
      isAgent: true
    })),
    ...users.map(u => ({
      id: u.id,
      name: u.name,
      sub: u.role,
      avatar: u.avatar,
      color: u.color || '#3b82f6',
      status: u.status || 'online',
      isAgent: false
    }))
  ];

  const filteredTargets = allMentionTargets.filter(t => 
    t.name.toLowerCase().includes(mentionFilter.toLowerCase()) ||
    t.sub.toLowerCase().includes(mentionFilter.toLowerCase())
  );

  const handleInputChange = (e) => {
    const val = e.target.value;
    setText(val);
    if (!isDM && channel) {
      onTyping(channel.id, currentUser);
    }

    const lastAtIndex = val.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const query = val.slice(lastAtIndex + 1);
      if (!query.includes(' ')) {
        setShowMentionPopup(true);
        setMentionFilter(query);
        setSelectedIndex(0);
        return;
      }
    }
    setShowMentionPopup(false);
  };

  const handleKeyDown = (e) => {
    if (showMentionPopup && filteredTargets.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredTargets.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredTargets.length) % filteredTargets.length);
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMentionTarget(filteredTargets[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowMentionPopup(false);
      }
    }
  };

  const selectMentionTarget = (target) => {
    const lastAtIndex = text.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const newText = text.slice(0, lastAtIndex) + `@${target.name} `;
      setText(newText);
    }
    setShowMentionPopup(false);
    inputRef.current?.focus();
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSendMessage(text);
    setText('');
    setShowMentionPopup(false);
  };

  const handleSendThreadReply = (e) => {
    e.preventDefault();
    if (!threadReplyText.trim() || !activeThreadMessage) return;
    onSendThreadReply(activeThreadMessage.id, targetId, threadReplyText);
    setThreadReplyText('');
  };

  const getSenderDetails = (senderId, senderType) => {
    if (senderType === 'system') {
      return { name: 'System', avatar: '', color: '#818cf8', isSystem: true };
    }
    if (senderType === 'agent') {
      const agent = agents.find(a => a.id === senderId);
      return {
        name: agent ? agent.name : 'AI Agent',
        avatar: agent ? agent.avatar : 'https://api.dicebear.com/7.x/bottts/svg?seed=agent',
        color: agent ? agent.color : '#818cf8',
        cliEngine: agent ? agent.cliEngine : 'CLI Engine',
        isAgent: true
      };
    }
    const user = users.find(u => u.id === senderId);
    return {
      name: user ? user.name : 'Teammate',
      avatar: user ? user.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      color: user ? user.color : '#3b82f6',
      isAgent: false
    };
  };

  const renderRoleIcon = (role) => {
    if (role === 'Owner') return <Crown size={10.5} color="#f59e0b" />;
    if (role === 'Admin') return <Shield size={10.5} color="#818cf8" />;
    return <User size={10.5} color="var(--text-muted)" />;
  };

  const activeReplies = activeThreadMessage ? (messageThreads[activeThreadMessage.id] || []) : [];

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
      {/* Main Chat Area */}
      <div className="chat-container">
        {/* View Header */}
        <div className="view-header">
          <div className="header-title">
            {isDM ? (
              <AtSign size={16} color={activeDM.color || 'var(--text-muted)'} />
            ) : channel?.isPrivate ? (
              <Lock size={15} color="#f59e0b" />
            ) : (
              <Hash size={16} color="var(--text-muted)" />
            )}
            <span>{conversationTitle}</span>
            {conversationTopic && (
              <>
                <span style={{ color: 'var(--border-strong)', fontWeight: 300 }}>·</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '420px' }}>
                  {conversationTopic}
                </span>
              </>
            )}
          </div>
          <div className="header-actions">
            <span className="tag-badge" style={{ height: '24px', padding: '0 9px', fontSize: '11px' }}>
              {isDM ? (
                <span>Direct Message</span>
              ) : channel?.isPrivate ? (
                <>
                  <Lock size={11} color="#f59e0b" />
                  <span>Private</span>
                </>
              ) : (
                <>
                  <Globe size={11} color="var(--text-muted)" />
                  <span>Public</span>
                </>
              )}
            </span>

            {!isDM && (
              <button 
                className={`btn ${showMembersPanel ? 'btn-primary' : 'btn-secondary'}`}
                style={{ height: '28px', padding: '0 10px', fontSize: '12px' }}
                onClick={() => setShowMembersPanel(!showMembersPanel)}
                title="View Channel Members & Agents"
              >
                <Users size={13} />
                <span>{totalMemberCount}</span>
              </button>
            )}
          </div>
        </div>

        {/* Messages Feed */}
        <div className="messages-feed">
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Hash size={18} color="var(--text-muted)" />
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-heading)' }}>
                {isDM ? `@${conversationTitle}` : `#${conversationTitle}`}
              </h3>
              <p style={{ marginTop: '4px', fontSize: '12.5px' }}>
                Type <code>@</code> to mention an AI agent or teammate.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              // System notifications
              if (msg.senderType === 'system') {
                return (
                  <div key={msg.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-surface)', border: '1px solid var(--border-color)', padding: '9px 14px', borderRadius: '8px', fontSize: '12.5px', margin: '2px 0' }}>
                    <Sparkles size={14} color="#818cf8" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, color: 'var(--text-normal)' }}>
                      <MarkdownRenderer content={msg.content} agents={agents} users={users} />
                    </div>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', flexShrink: 0 }}>{msg.timestamp}</span>
                  </div>
                );
              }

              const sender = getSenderDetails(msg.senderId, msg.senderType);
              const repliesCount = (messageThreads[msg.id] || []).length;

              return (
                <div key={msg.id} className="chat-message" style={{ position: 'relative' }}>
                  <img src={sender.avatar} alt={sender.name} className="avatar-img" style={{ width: '34px', height: '34px', border: '1px solid var(--border-color)', flexShrink: 0, marginTop: '2px' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="msg-header">
                      <span className="msg-author" style={{ color: sender.isAgent ? sender.color : 'var(--text-heading)' }}>{sender.name}</span>
                      {sender.isAgent && (
                        <span className="msg-badge">
                          {sender.cliEngine}
                        </span>
                      )}
                      <span className="msg-time">{msg.timestamp}</span>
                    </div>

                    <div className="msg-body">
                      <MarkdownRenderer content={msg.content} agents={agents} users={users} />
                    </div>

                    {/* Message Actions Row */}
                    <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '24px', padding: '0 8px', fontSize: '11px', color: repliesCount > 0 ? 'var(--text-heading)' : 'var(--text-muted)' }}
                        onClick={() => setActiveThreadMessage(msg)}
                      >
                        <MessageSquare size={11} />
                        <span>{repliesCount > 0 ? `${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}` : 'Reply in thread'}</span>
                      </button>

                      <button 
                        className="btn btn-secondary"
                        style={{ height: '24px', padding: '0 8px', fontSize: '11px', color: 'var(--text-muted)' }}
                        onClick={() => {
                          setConvertingMessage(msg);
                          setTaskTitle(`Task: ${msg.content.slice(0, 50).replace(/\n/g, ' ')}...`);
                          setTaskAgentId('agent-antigravity');
                        }}
                        title="Convert message & thread into a task card"
                      >
                        <Zap size={11} color="#818cf8" />
                        <span>Convert to Task</span>
                      </button>

                      {msg.cardId && (
                        <span className="tag-badge" style={{ height: '24px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                          <CheckCircle2 size={11} />
                          <span>Synced to Board</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <div className="chat-input-bar">
          {/* Mention Autocomplete Popup */}
          {showMentionPopup && (
            <div className="mention-popup">
              <div className="mention-popup-header">
                <span>Mention Agent or Teammate</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>↑↓ to navigate · Enter to select</span>
              </div>
              <div className="mention-popup-list">
                {filteredTargets.map((target, idx) => (
                  <div 
                    key={target.id}
                    className={`mention-item ${idx === selectedIndex ? 'selected' : ''}`}
                    onClick={() => selectMentionTarget(target)}
                  >
                    <img src={target.avatar} alt={target.name} className="avatar-img" style={{ width: '22px', height: '22px' }} />
                    <div style={{ flex: 1 }}>
                      <div className="mention-name" style={{ color: target.isAgent ? target.color : 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>@{target.name}</span>
                        {target.isAgent && <span className="msg-badge" style={{ fontSize: '9.5px' }}>AGENT</span>}
                      </div>
                      <div className="mention-sub">{target.sub}</div>
                    </div>
                    <div className={`status-dot ${target.status}`} style={{ position: 'relative', bottom: 'auto', right: 'auto' }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="input-wrapper" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
            {(activeTypers.length > 0 || busyAgent) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                {activeTypers.length > 0 && (
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-normal)' }}>{activeTypers.map(u => u.name).join(', ')}</span>
                    <span>is typing...</span>
                  </div>
                )}

                {busyAgent && (
                  <div className="ai-working-chip">
                    <Loader2 size={12.5} style={{ animation: 'spin 1.2s linear infinite' }} />
                    <span>{busyAgent.name} is executing via {busyAgent.cliEngine}...</span>
                  </div>
                )}
              </div>
            )}

            {busyAgent && <div className="live-working-bar" />}

            <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
              <input
                ref={inputRef}
                type="text"
                className="chat-input"
                placeholder={isDM ? `Message @${activeDM.name}...` : `Message #${channel?.name || 'general'} (type @ to mention agents)`}
                value={text}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <button type="submit" className="btn btn-primary" style={{ height: '36px', padding: '0 14px' }}>
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Channel Members Side Panel */}
      {showMembersPanel && !isDM && (
        <div style={{ width: '268px', background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ height: '50px', padding: '0 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={14} color="var(--text-muted)" />
              Members ({totalMemberCount})
            </span>
            <button className="btn btn-secondary" style={{ width: '26px', height: '26px', padding: 0 }} onClick={() => setShowMembersPanel(false)}>
              <X size={14} />
            </button>
          </div>

          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <button 
              className="btn btn-secondary" 
              style={{ width: '100%', justifyContent: 'center', fontSize: '12px' }}
              onClick={() => setShowAddMemberModal(true)}
            >
              <UserPlus size={13} /> Add Agent or Member
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
            {/* AI Agents Section */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Bot size={12} /> AI Agents ({channelMembersAgents.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {channelMembersAgents.map(bot => (
                  <div key={bot.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                      <div className="avatar-wrapper">
                        <img src={bot.avatar} alt={bot.name} className="avatar-img" style={{ width: '24px', height: '24px' }} />
                        <div className={`status-dot ${bot.status || 'online'}`} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-heading)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {bot.name}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block' }}>
                          {bot.cliEngine}
                        </span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-secondary" 
                      style={{ height: '22px', padding: '0 7px', fontSize: '10.5px' }}
                      title={`Mention @${bot.name}`}
                      onClick={() => {
                        setText(prev => `${prev} @${bot.name} `);
                        inputRef.current?.focus();
                      }}
                    >
                      @Mention
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Teammates Section */}
            <div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <User size={12} /> Teammates ({channelMembersUsers.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {channelMembersUsers.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <div key={u.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '7px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <div className="avatar-wrapper">
                          <img src={u.avatar} alt={u.name} className="avatar-img" style={{ width: '24px', height: '24px' }} />
                          <div className={`status-dot ${u.status || 'online'}`} />
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-heading)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.name} {isSelf && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
                          </span>
                          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {renderRoleIcon(u.role)}
                            <span>{u.role}</span>
                          </span>
                        </div>
                      </div>

                      {channel?.isPrivate && !isSelf && (
                        <button 
                          className="btn btn-danger" 
                          style={{ height: '22px', width: '22px', padding: 0 }}
                          title="Remove member"
                          onClick={() => onRemoveChannelMember(channel.id, u.id)}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add AI Bot / Teammate Modal */}
      {showAddMemberModal && (
        <div className="task-drawer-overlay" onClick={() => setShowAddMemberModal(false)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '460px', maxWidth: '90vw', padding: '24px', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
                  Add to #{channel?.name}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Invite AI agents or workspace teammates to this channel.
                </span>
              </div>

              <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: 0 }} onClick={() => setShowAddMemberModal(false)}>
                <X size={14} />
              </button>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Bot size={12} /> Available AI Agents ({availableAgentsToAdd.length})
              </h4>

              {availableAgentsToAdd.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px', background: 'var(--bg-surface)', borderRadius: '7px', border: '1px solid var(--border-subtle)' }}>
                  All AI agents are already members of #{channel?.name}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {availableAgentsToAdd.map(bot => (
                    <div key={bot.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={bot.avatar} alt={bot.name} className="avatar-img" style={{ width: '30px', height: '30px' }} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>{bot.name}</span>
                            <span className="msg-badge">{bot.cliEngine}</span>
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>
                            {bot.role}
                          </span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-primary" 
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }}
                        onClick={() => onAddChannelMember(channel.id, bot.id)}
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users size={12} /> Available Teammates ({availableUsersToAdd.length})
              </h4>

              {availableUsersToAdd.length === 0 ? (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '10px', background: 'var(--bg-surface)', borderRadius: '7px', border: '1px solid var(--border-subtle)' }}>
                  All workspace teammates are already members of #{channel?.name}.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {availableUsersToAdd.map(u => (
                    <div key={u.id} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={u.avatar} alt={u.name} className="avatar-img" style={{ width: '28px', height: '28px' }} />
                        <div>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)', display: 'block' }}>{u.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{u.role} · {u.email}</span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-secondary" 
                        style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }}
                        onClick={() => onAddChannelMember(channel.id, u.id)}
                      >
                        <Plus size={12} /> Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Convert Message/Thread to AI Task Modal */}
      {convertingMessage && (
        <div className="task-drawer-overlay" onClick={() => setConvertingMessage(null)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '480px', maxWidth: '92vw', padding: '24px', boxShadow: 'var(--shadow-lg)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(94, 106, 210, 0.15)', border: '1px solid rgba(94, 106, 210, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={16} color="#818cf8" />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
                    Convert to AI Task
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Creates a Kanban card and dispatches an AI agent
                  </span>
                </div>
              </div>

              <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: 0 }} onClick={() => setConvertingMessage(null)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!taskTitle.trim()) return;
              onConvertMessageToTask(convertingMessage.id, targetId, taskTitle, taskAgentId);
              setConvertingMessage(null);
            }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>
                  Task Title
                </label>
                <input 
                  type="text" 
                  className="chat-input"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  required
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>
                  Assigned AI Agent
                </label>
                <select 
                  value={taskAgentId} 
                  onChange={(e) => setTaskAgentId(e.target.value)}
                  style={{ width: '100%', height: '36px', background: 'var(--bg-chat-input)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', padding: '0 12px', borderRadius: '7px', fontSize: '13px' }}
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.cliEngine}) — {a.role}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px', background: 'var(--bg-surface)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Context Payload</span>
                  <span>{(messageThreads[convertingMessage.id] || []).length} thread replies</span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-normal)', maxHeight: '110px', overflowY: 'auto', background: 'var(--bg-darkest)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border-subtle)', fontFamily: 'var(--font-mono)' }}>
                  <div>"{convertingMessage.content}"</div>
                  {(messageThreads[convertingMessage.id] || []).length > 0 && (
                    <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                      {(messageThreads[convertingMessage.id] || []).map((r, i) => (
                        <div key={i} style={{ color: 'var(--text-muted)', fontSize: '11px', marginTop: '2px' }}>
                          • {r.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setConvertingMessage(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Zap size={13} /> Create & Run Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Message Thread Side Panel */}
      {activeThreadMessage && (
        <div style={{ width: '360px', background: 'var(--bg-sidebar)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Thread Header */}
          <div style={{ height: '50px', padding: '0 16px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={14} color="var(--text-muted)" />
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                Thread
              </span>
              {activeThreadMessage.cardId && (
                <span className="tag-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.25)' }}>
                  Synced
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {!activeThreadMessage.cardId && (
                <button 
                  className="btn btn-secondary"
                  style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                  onClick={() => {
                    setConvertingMessage(activeThreadMessage);
                    setTaskTitle(`Task: ${activeThreadMessage.content.slice(0, 50).replace(/\n/g, ' ')}...`);
                    setTaskAgentId('agent-antigravity');
                  }}
                >
                  <Zap size={11} color="#818cf8" />
                  <span>To Task</span>
                </button>
              )}

              <button className="btn btn-secondary" style={{ width: '26px', height: '26px', padding: 0 }} onClick={() => setActiveThreadMessage(null)}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Original Parent Message */}
          <div style={{ padding: '14px 16px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Parent Message
            </div>
            <div style={{ fontSize: '12.5px', color: 'var(--text-heading)', lineHeight: 1.45 }}>
              <MarkdownRenderer content={activeThreadMessage.content} agents={agents} users={users} />
            </div>
          </div>

          {/* Thread Replies List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {activeReplies.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px', padding: '24px 0' }}>
                No replies yet.
              </div>
            ) : (
              activeReplies.map(r => {
                const rSender = getSenderDetails(r.senderId, r.senderType);
                return (
                  <div key={r.id} style={{ display: 'flex', gap: '10px', background: 'var(--bg-surface)', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                    <img src={rSender.avatar} alt={rSender.name} className="avatar-img" style={{ width: '24px', height: '24px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: rSender.isAgent ? rSender.color : 'var(--text-heading)' }}>{rSender.name}</span>
                        <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{r.timestamp}</span>
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--text-normal)', marginTop: '2px' }}>
                        <MarkdownRenderer content={r.content} agents={agents} users={users} />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          {/* Thread Reply Input Form */}
          <form onSubmit={handleSendThreadReply} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-main)' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text"
                className="chat-input"
                style={{ flex: 1, height: '32px', fontSize: '12px' }}
                placeholder="Reply in thread..."
                value={threadReplyText}
                onChange={(e) => setThreadReplyText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" style={{ height: '32px', padding: '0 12px' }}>
                <Send size={13} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
