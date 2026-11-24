import React, { useState } from 'react';
import {
  Hash, MessageSquare, LayoutGrid, Cpu, Users, Shield, Zap, Plus, MessageCircle, User, Lock, Crown, Globe, UserPlus, PanelLeftClose, PanelLeftOpen, Check
} from 'lucide-react';

export default function Sidebar({
  state,
  activeServer,
  activeTab,
  setActiveTab,
  activeChannel,
  setActiveChannel,
  activeDM,
  setActiveDM,
  currentUser,
  unreadCounts = {},
  onMarkRead,
  onOpenUserManagement,
  onCreateChannel,
  isCollapsed = false,
  onToggleCollapse
}) {
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChName, setNewChName] = useState('');
  const [newChTopic, setNewChTopic] = useState('');
  const [newChIsPrivate, setNewChIsPrivate] = useState(false);
  const [newChInvitedUsers, setNewChInvitedUsers] = useState([]);

  const allServerChannels = state.channels[activeServer?.id] || [];

  const visibleChannels = allServerChannels.filter(ch => {
    if (!ch.isPrivate) return true;
    return ch.allowedUserIds && ch.allowedUserIds.includes(currentUser.id);
  });

  const renderRoleBadge = (role) => {
    if (role === 'Owner') return <Crown size={11} className="text-warning" />;
    if (role === 'Admin') return <Shield size={11} className="text-accent" />;
    return <User size={11} className="text-ink-muted" />;
  };

  const handleCreateChannel = (e) => {
    e.preventDefault();
    if (!newChName.trim()) return;
    onCreateChannel({
      name: newChName,
      topic: newChTopic,
      isPrivate: newChIsPrivate,
      allowedUserIds: newChIsPrivate ? newChInvitedUsers : undefined
    });
    setNewChName('');
    setNewChTopic('');
    setNewChIsPrivate(false);
    setNewChInvitedUsers([]);
    setShowCreateChannel(false);
  };

  const toggleInvitedUser = (userId) => {
    setNewChInvitedUsers(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  if (isCollapsed) {
    return (
      <div className="sidebar collapsed">
        <div className="flex h-[52px] items-center justify-center border-b border-line">
          <button
            className="btn btn-secondary h-8 w-8 p-0"
            title="Expand Sidebar"
            onClick={onToggleCollapse}
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>

        <div className="view-mode-tabs">
          <button
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            title="Chat View"
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={15} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
            title="Kanban Board"
            onClick={() => setActiveTab('board')}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
            title="Agents Hub"
            onClick={() => setActiveTab('agents')}
          >
            <Cpu size={15} />
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto py-1.5">
          {visibleChannels.map(ch => {
            const unreadCount = unreadCounts[ch.id] || 0;
            const isActive = activeTab === 'chat' && !activeDM && activeChannel?.id === ch.id;

            return (
              <div
                key={ch.id}
                className={`channel-item ${isActive ? 'active' : ''}`}
                title={`#${ch.name}`}
                onClick={() => {
                  setActiveChannel(ch);
                  setActiveDM(null);
                  setActiveTab('chat');
                  if (onMarkRead) onMarkRead(ch.id);
                }}
              >
                {ch.isPrivate ? <Lock size={14} className="text-warning" /> : <Hash size={15} className={isActive ? 'text-ink-heading' : 'text-ink-muted'} />}
                {unreadCount > 0 && !isActive && (
                  <div className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex justify-center border-t border-line py-3">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="avatar-img h-7 w-7 border border-line-strong"
            title={`${currentUser.name} (${currentUser.role})`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar">
      <div className="server-header">
        <span className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-[5px] border border-accent-mid bg-accent-soft text-accent">
            <Zap size={12} />
          </span>
          <span className="truncate">{activeServer?.name || 'Tandem'}</span>
        </span>
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            className="btn btn-secondary h-[26px] w-[26px] p-0"
            title="Manage Team & Permissions"
            onClick={onOpenUserManagement}
          >
            <Users size={13} className="text-ink-muted" />
          </button>
          <button
            className="btn btn-secondary h-[26px] w-[26px] p-0"
            title="Collapse Sidebar"
            onClick={onToggleCollapse}
          >
            <PanelLeftClose size={13} className="text-ink-muted" />
          </button>
        </div>
      </div>

      <div className="user-switcher">
        <div className="flex items-center gap-2.5">
          <div className="avatar-wrapper">
            <img
              src={currentUser.avatar}
              alt={currentUser.name}
              className="avatar-img h-7 w-7 border border-line-strong"
            />
            <div className="status-dot online" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] font-semibold leading-tight text-ink-heading">
              {currentUser.name}
            </div>
            <div className="mt-px flex items-center gap-1 text-[11px] text-ink-muted">
              {renderRoleBadge(currentUser.role)}
              <span>{currentUser.role}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="view-mode-tabs">
        <button
          className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          <MessageSquare size={13} />
          Chat
        </button>
        <button
          className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
          onClick={() => setActiveTab('board')}
        >
          <LayoutGrid size={13} />
          Board
        </button>
        <button
          className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          <Cpu size={13} />
          Agents
        </button>
      </div>

      <div className="sidebar-section">
        <span>Channels ({visibleChannels.length})</span>
        <button
          title="Create Channel"
          onClick={() => setShowCreateChannel(!showCreateChannel)}
          className={`flex items-center rounded border-0 bg-transparent p-0.5 cursor-pointer ${showCreateChannel ? 'text-ink-heading' : 'text-ink-muted'}`}
        >
          <Plus size={13} />
        </button>
      </div>

      {showCreateChannel && (
        <div className="mx-2.5 mb-2 mt-1 rounded-lg border border-line-strong bg-white p-3 shadow-soft" style={{ animation: 'popupSlide 0.14s ease-out' }}>
          <form onSubmit={handleCreateChannel}>
            <div className="mb-2.5">
              <label className="mb-1 block text-[11px] font-medium text-ink">Channel name</label>
              <input
                type="text"
                className="chat-input h-[30px] text-xs"
                placeholder="e.g. design-reviews"
                value={newChName}
                onChange={(e) => setNewChName(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="mb-2.5">
              <label className="mb-1 block text-[11px] font-medium text-ink">
                Topic <span className="text-ink-muted">(optional)</span>
              </label>
              <input
                type="text"
                className="chat-input h-[30px] text-xs"
                placeholder="Purpose of this channel"
                value={newChTopic}
                onChange={(e) => setNewChTopic(e.target.value)}
              />
            </div>

            <div className="mb-2.5">
              <label className="mb-1.5 block text-[11px] font-medium text-ink">Visibility</label>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => { setNewChIsPrivate(false); setNewChInvitedUsers([]); }}
                  className={`flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11.5px] font-medium transition-all duration-150 cursor-pointer ${
                    !newChIsPrivate
                      ? 'border border-emerald-300 bg-emerald-50 text-success'
                      : 'border border-line bg-surface-muted text-ink-muted'
                  }`}
                >
                  <Globe size={12} /> Public
                </button>
                <button
                  type="button"
                  onClick={() => setNewChIsPrivate(true)}
                  className={`flex h-7 flex-1 items-center justify-center gap-1 rounded-md text-[11.5px] font-medium transition-all duration-150 cursor-pointer ${
                    newChIsPrivate
                      ? 'border border-amber-300 bg-amber-50 text-warning'
                      : 'border border-line bg-surface-muted text-ink-muted'
                  }`}
                >
                  <Lock size={12} /> Private
                </button>
              </div>
            </div>

            {newChIsPrivate && (
              <div className="mb-2.5">
                <label className="mb-1.5 flex items-center gap-1 text-[11px] font-medium text-ink">
                  <UserPlus size={11} /> Invite members
                </label>
                <div className="flex max-h-24 flex-col gap-0.5 overflow-y-auto">
                  {state.users.filter(u => u.id !== currentUser.id).map(u => {
                    const isInvited = newChInvitedUsers.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        onClick={() => toggleInvitedUser(u.id)}
                        className={`flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 ${
                          isInvited ? 'border border-accent-mid bg-accent-soft' : 'border border-transparent'
                        }`}
                      >
                        <img src={u.avatar} alt={u.name} className="avatar-img h-[18px] w-[18px]" />
                        <span className={`flex-1 text-[11.5px] ${isInvited ? 'font-medium text-ink-heading' : 'text-ink'}`}>
                          {u.name}
                        </span>
                        {isInvited && <Check size={12} className="text-accent" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-1.5">
              <button type="button" className="btn btn-secondary h-[26px] px-2 text-[11px]" onClick={() => setShowCreateChannel(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary h-[26px] px-2.5 text-[11px]" disabled={!newChName.trim()}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {visibleChannels.map(ch => {
          const unreadCount = unreadCounts[ch.id] || 0;
          const isActive = activeTab === 'chat' && !activeDM && activeChannel?.id === ch.id;

          return (
            <div
              key={ch.id}
              className={`channel-item ${isActive ? 'active' : ''}`}
              onClick={() => {
                setActiveChannel(ch);
                setActiveDM(null);
                setActiveTab('chat');
                if (onMarkRead) onMarkRead(ch.id);
              }}
            >
              {ch.isPrivate ? (
                <Lock size={13.5} className="flex-shrink-0 text-warning opacity-85" />
              ) : (
                <Hash size={14.5} className={`flex-shrink-0 ${isActive ? 'text-ink-heading' : 'text-ink-muted'}`} />
              )}
              <span className={`truncate ${unreadCount > 0 || isActive ? 'font-medium' : 'font-normal'}`}>
                {ch.name}
              </span>

              {unreadCount > 0 && !isActive && (
                <span className="unread-badge">{unreadCount}</span>
              )}
            </div>
          );
        })}

        <div className="sidebar-section mt-3.5">
          <span>Direct messages</span>
          <MessageCircle size={11} />
        </div>

        <div className="px-2 pb-3">
          {state.dms.map(dm => {
            const isAgent = dm.isAgent;
            const agentObj = isAgent ? state.agents.find(a => a.id === dm.targetId) : null;
            const userObj = !isAgent ? state.users.find(u => u.id === dm.targetId) : null;
            const isActive = activeTab === 'chat' && activeDM?.id === dm.id;
            const unreadCount = unreadCounts[dm.id] || 0;

            return (
              <div
                key={dm.id}
                className={`presence-card relative cursor-pointer ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setActiveDM(dm);
                  setActiveTab('chat');
                  if (onMarkRead) onMarkRead(dm.id);
                }}
              >
                <div className="avatar-wrapper">
                  <img src={dm.avatar} alt={dm.name} className="avatar-img h-[26px] w-[26px] border border-line" />
                  <div className={`status-dot ${isAgent ? (agentObj?.status || 'online') : (userObj?.status || 'online')}`} />
                </div>
                <div className="presence-info flex-1">
                  <span className={`presence-name ${isActive ? 'text-ink-heading' : 'text-ink'} ${unreadCount > 0 || isActive ? 'font-semibold' : 'font-normal'}`}>
                    {dm.name}
                  </span>
                  <span className="presence-role flex items-center gap-1">
                    {isAgent ? (agentObj?.cliEngine || 'AI Agent') : (
                      <>
                        {renderRoleBadge(userObj?.role)}
                        <span>{userObj?.role}</span>
                      </>
                    )}
                  </span>
                </div>

                {unreadCount > 0 && !isActive && (
                  <span className="unread-badge">{unreadCount}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
