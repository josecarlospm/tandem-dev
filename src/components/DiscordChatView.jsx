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
      return { name: 'System', avatar: '', color: '#2563eb', isSystem: true };
    }
    if (senderType === 'agent') {
      const agent = agents.find(a => a.id === senderId);
      return {
        name: agent ? agent.name : 'AI Agent',
        avatar: agent ? agent.avatar : 'https://api.dicebear.com/7.x/bottts/svg?seed=agent',
        color: agent ? agent.color : '#2563eb',
        cliEngine: agent ? agent.cliEngine : 'CLI Engine',
        isAgent: true
      };
    }
    const user = users.find(u => u.id === senderId);
    return {
      name: user ? user.name : 'Teammate',
      avatar: user ? user.avatar : 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100',
      color: user ? user.color : '#2563eb',
      isAgent: false
    };
  };

  const renderRoleIcon = (role) => {
    if (role === 'Owner') return <Crown size={10.5} className="text-warning" />;
    if (role === 'Admin') return <Shield size={10.5} className="text-accent" />;
    return <User size={10.5} className="text-ink-muted" />;
  };

  const activeReplies = activeThreadMessage ? (messageThreads[activeThreadMessage.id] || []) : [];

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Main Chat Area */}
      <div className="chat-container">
        {/* View Header */}
        <div className="view-header">
          <div className="header-title">
            {isDM ? (
              <AtSign size={16} className="text-ink-muted" style={activeDM.color ? { color: activeDM.color } : undefined} />
            ) : channel?.isPrivate ? (
              <Lock size={15} className="text-warning" />
            ) : (
              <Hash size={16} className="text-ink-muted" />
            )}
            <span>{conversationTitle}</span>
            {conversationTopic && (
              <>
                <span className="font-light text-line-strong">·</span>
                <span className="max-w-[420px] overflow-hidden text-ellipsis whitespace-nowrap text-xs font-normal text-ink-muted">
                  {conversationTopic}
                </span>
              </>
            )}
          </div>
          <div className="header-actions">
            <span className="tag-badge h-6 px-2.5 text-[11px]">
              {isDM ? (
                <span>Direct Message</span>
              ) : channel?.isPrivate ? (
                <>
                  <Lock size={11} className="text-warning" />
                  <span>Private</span>
                </>
              ) : (
                <>
                  <Globe size={11} className="text-ink-muted" />
                  <span>Public</span>
                </>
              )}
            </span>

            {!isDM && (
              <button 
                className={`btn h-7 px-2.5 text-xs ${showMembersPanel ? 'btn-primary' : 'btn-secondary'}`}
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
            <div className="px-5 py-[60px] text-center text-ink-muted">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] border border-line bg-surface-muted">
                <Hash size={18} className="text-ink-muted" />
              </div>
              <h3 className="text-sm font-semibold text-ink-heading">
                {isDM ? `@${conversationTitle}` : `#${conversationTitle}`}
              </h3>
              <p className="mt-1 text-[12.5px]">
                Type <code className="rounded border border-line bg-slate-50 px-1 font-mono text-[11.5px] text-ink-heading">@</code> to mention an AI agent or teammate.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              // System notifications
              if (msg.senderType === 'system') {
                return (
                  <div key={msg.id} className="my-0.5 flex items-center gap-2.5 rounded-lg border border-line bg-accent-soft px-3.5 py-2 text-[12.5px]">
                    <Sparkles size={14} className="flex-shrink-0 text-accent" />
                    <div className="flex-1 text-ink">
                      <MarkdownRenderer content={msg.content} agents={agents} users={users} />
                    </div>
                    <span className="flex-shrink-0 text-[10.5px] text-ink-muted">{msg.timestamp}</span>
                  </div>
                );
              }

              const sender = getSenderDetails(msg.senderId, msg.senderType);
              const repliesCount = (messageThreads[msg.id] || []).length;

              return (
                <div key={msg.id} className="chat-message relative">
                  <img src={sender.avatar} alt={sender.name} className="avatar-img mt-0.5 h-[34px] w-[34px] flex-shrink-0 border border-line" />
                  <div className="min-w-0 flex-1">
                    <div className="msg-header">
                      <span className="msg-author" style={sender.isAgent ? { color: sender.color } : undefined}>{sender.name}</span>
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
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <button 
                        className={`btn btn-secondary h-6 px-2 text-[11px] ${repliesCount > 0 ? 'text-ink-heading' : 'text-ink-muted'}`}
                        onClick={() => setActiveThreadMessage(msg)}
                      >
                        <MessageSquare size={11} />
                        <span>{repliesCount > 0 ? `${repliesCount} ${repliesCount === 1 ? 'reply' : 'replies'}` : 'Reply in thread'}</span>
                      </button>

                      <button 
                        className="btn btn-secondary h-6 px-2 text-[11px] text-ink-muted"
                        onClick={() => {
                          setConvertingMessage(msg);
                          setTaskTitle(`Task: ${msg.content.slice(0, 50).replace(/\n/g, ' ')}...`);
                          setTaskAgentId('agent-antigravity');
                        }}
                        title="Convert message & thread into a task card"
                      >
                        <Zap size={11} className="text-accent" />
                        <span>Convert to Task</span>
                      </button>

                      {msg.cardId && (
                        <span className="tag-badge h-6 border-success/25 bg-success/10 text-success">
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
                <span className="text-[10px] text-ink-muted">↑↓ to navigate · Enter to select</span>
              </div>
              <div className="mention-popup-list">
                {filteredTargets.map((target, idx) => (
                  <div 
                    key={target.id}
                    className={`mention-item ${idx === selectedIndex ? 'selected' : ''}`}
                    onClick={() => selectMentionTarget(target)}
                  >
                    <img src={target.avatar} alt={target.name} className="avatar-img h-[22px] w-[22px]" />
                    <div className="flex-1">
                      <div
                        className="mention-name flex items-center gap-1.5"
                        style={target.isAgent ? { color: target.color } : undefined}
                      >
                        <span>@{target.name}</span>
                        {target.isAgent && <span className="msg-badge text-[9.5px]">AGENT</span>}
                      </div>
                      <div className="mention-sub">{target.sub}</div>
                    </div>
                    <div className={`status-dot ${target.status} relative bottom-auto right-auto`} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="input-wrapper flex-col items-stretch gap-2">
            {(activeTypers.length > 0 || busyAgent) && (
              <div className="flex flex-wrap items-center gap-2.5">
                {activeTypers.length > 0 && (
                  <div className="flex items-center gap-1 text-[11.5px] text-ink-muted">
                    <span className="font-semibold text-ink">{activeTypers.map(u => u.name).join(', ')}</span>
                    <span>is typing...</span>
                  </div>
                )}

                {busyAgent && (
                  <div className="ai-working-chip">
                    <Loader2 size={12.5} className="animate-spin" />
                    <span>{busyAgent.name} is executing via {busyAgent.cliEngine}...</span>
                  </div>
                )}
              </div>
            )}

            {busyAgent && <div className="live-working-bar" />}

            <form onSubmit={handleSend} className="flex w-full items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                className="chat-input"
                placeholder={isDM ? `Message @${activeDM.name}...` : `Message #${channel?.name || 'general'} (type @ to mention agents)`}
                value={text}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
              />
              <button type="submit" className="btn btn-primary h-9 px-3.5">
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Channel Members Side Panel */}
      {showMembersPanel && !isDM && (
        <div className="flex h-full w-[268px] flex-col border-l border-line bg-surface-muted">
          <div className="flex h-[50px] items-center justify-between border-b border-line px-4">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-heading">
              <Users size={14} className="text-ink-muted" />
              Members ({totalMemberCount})
            </span>
            <button className="btn btn-secondary h-[26px] w-[26px] p-0" onClick={() => setShowMembersPanel(false)}>
              <X size={14} />
            </button>
          </div>

          <div className="border-b border-line-soft p-3">
            <button 
              className="btn btn-secondary w-full justify-center text-xs"
              onClick={() => setShowAddMemberModal(true)}
            >
              <UserPlus size={13} /> Add Agent or Member
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {/* AI Agents Section */}
            <div className="mb-[18px]">
              <div className="mb-2 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">
                <Bot size={12} /> AI Agents ({channelMembersAgents.length})
              </div>

              <div className="flex flex-col gap-1">
                {channelMembersAgents.map(bot => (
                  <div key={bot.id} className="flex items-center justify-between rounded-md border border-line-soft bg-white px-2.5 py-1.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="avatar-wrapper">
                        <img src={bot.avatar} alt={bot.name} className="avatar-img h-6 w-6" />
                        <div className={`status-dot ${bot.status || 'online'}`} />
                      </div>
                      <div className="min-w-0">
                        <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-ink-heading">
                          {bot.name}
                        </span>
                        <span className="block text-[10.5px] text-ink-muted">
                          {bot.cliEngine}
                        </span>
                      </div>
                    </div>

                    <button 
                      className="btn btn-secondary h-[22px] px-1.5 text-[10.5px]"
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
              <div className="mb-2 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">
                <User size={12} /> Teammates ({channelMembersUsers.length})
              </div>

              <div className="flex flex-col gap-1">
                {channelMembersUsers.map(u => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <div key={u.id} className="flex items-center justify-between rounded-md border border-line-soft bg-white px-2.5 py-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="avatar-wrapper">
                          <img src={u.avatar} alt={u.name} className="avatar-img h-6 w-6" />
                          <div className={`status-dot ${u.status || 'online'}`} />
                        </div>
                        <div className="min-w-0">
                          <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium text-ink-heading">
                            {u.name} {isSelf && <span className="font-normal text-ink-muted">(You)</span>}
                          </span>
                          <span className="flex items-center gap-1 text-[10.5px] text-ink-muted">
                            {renderRoleIcon(u.role)}
                            <span>{u.role}</span>
                          </span>
                        </div>
                      </div>

                      {channel?.isPrivate && !isSelf && (
                        <button 
                          className="btn btn-danger h-[22px] w-[22px] p-0"
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
            className="w-[460px] max-w-[90vw] rounded-xl border border-line bg-white p-6 shadow-modal"
          >
            <div className="mb-[18px] flex items-center justify-between border-b border-line pb-3.5">
              <div>
                <h3 className="m-0 text-[15px] font-semibold text-ink-heading">
                  Add to #{channel?.name}
                </h3>
                <span className="text-xs text-ink-muted">
                  Invite AI agents or workspace teammates to this channel.
                </span>
              </div>

              <button className="btn btn-secondary h-7 w-7 p-0" onClick={() => setShowAddMemberModal(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="mb-[18px]">
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                <Bot size={12} /> Available AI Agents ({availableAgentsToAdd.length})
              </h4>

              {availableAgentsToAdd.length === 0 ? (
                <div className="rounded-md border border-line-soft bg-surface-muted p-2.5 text-xs text-ink-muted">
                  All AI agents are already members of #{channel?.name}.
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {availableAgentsToAdd.map(bot => (
                    <div key={bot.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-muted px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img src={bot.avatar} alt={bot.name} className="avatar-img h-[30px] w-[30px]" />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold text-ink-heading">{bot.name}</span>
                            <span className="msg-badge">{bot.cliEngine}</span>
                          </div>
                          <span className="block text-[11px] text-ink-muted">
                            {bot.role}
                          </span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-primary h-7 px-2.5 text-[11.5px]"
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
              <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                <Users size={12} /> Available Teammates ({availableUsersToAdd.length})
              </h4>

              {availableUsersToAdd.length === 0 ? (
                <div className="rounded-md border border-line-soft bg-surface-muted p-2.5 text-xs text-ink-muted">
                  All workspace teammates are already members of #{channel?.name}.
                </div>
              ) : (
                <div className="flex max-h-40 flex-col gap-1.5 overflow-y-auto">
                  {availableUsersToAdd.map(u => (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border border-line bg-surface-muted px-3 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <img src={u.avatar} alt={u.name} className="avatar-img h-7 w-7" />
                        <div>
                          <span className="block text-[12.5px] font-semibold text-ink-heading">{u.name}</span>
                          <span className="text-[11px] text-ink-muted">{u.role} · {u.email}</span>
                        </div>
                      </div>

                      <button 
                        className="btn btn-secondary h-7 px-2.5 text-[11.5px]"
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
            className="w-[480px] max-w-[92vw] rounded-xl border border-line bg-white p-6 shadow-modal"
          >
            <div className="mb-[18px] flex items-center justify-between border-b border-line pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-mid bg-accent-soft">
                  <Zap size={16} className="text-accent" />
                </div>
                <div>
                  <h3 className="m-0 text-[15px] font-semibold text-ink-heading">
                    Convert to AI Task
                  </h3>
                  <span className="text-xs text-ink-muted">
                    Creates a Kanban card and dispatches an AI agent
                  </span>
                </div>
              </div>

              <button className="btn btn-secondary h-7 w-7 p-0" onClick={() => setConvertingMessage(null)}>
                <X size={14} />
              </button>
            </div>

            <form onSubmit={(e) => {
              e.preventDefault();
              if (!taskTitle.trim()) return;
              onConvertMessageToTask(convertingMessage.id, targetId, taskTitle, taskAgentId);
              setConvertingMessage(null);
            }}>
              <div className="mb-3.5">
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
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

              <div className="mb-3.5">
                <label className="mb-1 block text-[11.5px] font-medium text-ink">
                  Assigned AI Agent
                </label>
                <select 
                  value={taskAgentId} 
                  onChange={(e) => setTaskAgentId(e.target.value)}
                  className="h-9 w-full rounded-md border border-line bg-white px-3 text-[13px] text-ink-heading outline-none"
                >
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.cliEngine}) — {a.role}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-5 rounded-lg border border-line bg-surface-muted p-3">
                <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <span>Context Payload</span>
                  <span>{(messageThreads[convertingMessage.id] || []).length} thread replies</span>
                </div>
                <div className="max-h-[110px] overflow-y-auto rounded-md border border-line bg-slate-50 px-2.5 py-2 font-mono text-xs text-ink">
                  <div>"{convertingMessage.content}"</div>
                  {(messageThreads[convertingMessage.id] || []).length > 0 && (
                    <div className="mt-1.5 border-t border-line-soft pt-1.5">
                      {(messageThreads[convertingMessage.id] || []).map((r, i) => (
                        <div key={i} className="mt-0.5 text-[11px] text-ink-muted">
                          • {r.content}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
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
        <div className="flex h-full w-[360px] flex-col border-l border-line bg-surface-muted">
          {/* Thread Header */}
          <div className="flex h-[50px] items-center justify-between border-b border-line px-4">
            <div className="flex items-center gap-2">
              <MessageSquare size={14} className="text-ink-muted" />
              <span className="text-[13px] font-semibold text-ink-heading">
                Thread
              </span>
              {activeThreadMessage.cardId && (
                <span className="tag-badge border-success/25 bg-success/10 text-success">
                  Synced
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {!activeThreadMessage.cardId && (
                <button 
                  className="btn btn-secondary h-[26px] px-2 text-[11px]"
                  onClick={() => {
                    setConvertingMessage(activeThreadMessage);
                    setTaskTitle(`Task: ${activeThreadMessage.content.slice(0, 50).replace(/\n/g, ' ')}...`);
                    setTaskAgentId('agent-antigravity');
                  }}
                >
                  <Zap size={11} className="text-accent" />
                  <span>To Task</span>
                </button>
              )}

              <button className="btn btn-secondary h-[26px] w-[26px] p-0" onClick={() => setActiveThreadMessage(null)}>
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Original Parent Message */}
          <div className="border-b border-line bg-white px-4 py-3.5">
            <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-muted">
              Parent Message
            </div>
            <div className="text-[12.5px] leading-[1.45] text-ink-heading">
              <MarkdownRenderer content={activeThreadMessage.content} agents={agents} users={users} />
            </div>
          </div>

          {/* Thread Replies List */}
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-3.5">
            {activeReplies.length === 0 ? (
              <div className="py-6 text-center text-xs text-ink-muted">
                No replies yet.
              </div>
            ) : (
              activeReplies.map(r => {
                const rSender = getSenderDetails(r.senderId, r.senderType);
                return (
                  <div key={r.id} className="flex gap-2.5 rounded-lg border border-line-soft bg-white px-3 py-2.5">
                    <img src={rSender.avatar} alt={rSender.name} className="avatar-img h-6 w-6" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-xs font-semibold text-ink-heading"
                          style={rSender.isAgent ? { color: rSender.color } : undefined}
                        >
                          {rSender.name}
                        </span>
                        <span className="text-[10.5px] text-ink-muted">{r.timestamp}</span>
                      </div>
                      <div className="mt-0.5 text-[12.5px] text-ink">
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
          <form onSubmit={handleSendThreadReply} className="border-t border-line bg-white px-4 py-3">
            <div className="flex gap-2">
              <input 
                type="text"
                className="chat-input h-8 flex-1 text-xs"
                placeholder="Reply in thread..."
                value={threadReplyText}
                onChange={(e) => setThreadReplyText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary h-8 px-3">
                <Send size={13} />
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
