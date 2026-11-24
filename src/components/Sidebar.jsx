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
    if (role === 'Owner') return <Crown size={11} color="#f59e0b" />;
    if (role === 'Admin') return <Shield size={11} color="#818cf8" />;
    return <User size={11} color="var(--text-muted)" />;
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

  // --- COLLAPSED MINI SIDEBAR VIEW ---
  if (isCollapsed) {
    return (
      <div className="sidebar collapsed">
        {/* Collapse Toggle */}
        <div style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid var(--border-subtle)' }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: '32px', height: '32px', padding: 0 }}
            title="Expand Sidebar"
            onClick={onToggleCollapse}
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>

        {/* View Mode Icons */}
        <div className="view-mode-tabs">
          <button 
            className={`tab-btn ${activeTab === 'chat' ? 'active' : ''}`}
            title="Chat View"
            onClick={() => setActiveTab('chat')}
            style={{ justifyContent: 'center', padding: '8px 0' }}
          >
            <MessageSquare size={15} />
          </button>
          <button 
            className={`tab-btn ${activeTab === 'board' ? 'active' : ''}`}
            title="Trello Kanban Board"
            onClick={() => setActiveTab('board')}
            style={{ justifyContent: 'center', padding: '8px 0' }}
          >
            <LayoutGrid size={15} />
          </button>
          <button 
            className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
            title="AI Agents Hub"
            onClick={() => setActiveTab('agents')}
            style={{ justifyContent: 'center', padding: '8px 0' }}
          >
            <Cpu size={15} />
          </button>
        </div>

        {/* Channel Icons */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0', display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
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
                {ch.isPrivate ? <Lock size={14} color="#f59e0b" /> : <Hash size={15} color={isActive ? 'var(--text-heading)' : 'var(--text-muted)'} />}
                {unreadCount > 0 && !isActive && (
                  <div style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* User Badge */}
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'center' }}>
          <img 
            src={currentUser.avatar} 
            alt={currentUser.name}
            className="avatar-img"
            title={`${currentUser.name} (${currentUser.role})`}
            style={{ width: '28px', height: '28px', border: '1px solid var(--border-strong)' }}
          />
        </div>
      </div>
    );
  }

  // --- FULL EXPANDED SIDEBAR VIEW ---
  return (
    <div className="sidebar">
      {/* Workspace Header */}
      <div className="server-header">
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <span style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'rgba(94, 106, 210, 0.15)', border: '1px solid rgba(94, 106, 210, 0.35)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={12} color="#818cf8" />
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeServer?.name || 'Tandem'}</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <button 
            className="btn btn-secondary" 
            style={{ width: '26px', height: '26px', padding: 0 }}
            title="Manage Team & Permissions"
            onClick={onOpenUserManagement}
          >
            <Users size={13} color="var(--text-muted)" />
          </button>
          <button 
            className="btn btn-secondary" 
            style={{ width: '26px', height: '26px', padding: 0 }}
            title="Collapse Sidebar"
            onClick={onToggleCollapse}
          >
            <PanelLeftClose size={13} color="var(--text-muted)" />
          </button>
        </div>
      </div>

      {/* Authenticated User Profile Badge */}
      <div className="user-switcher">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div className="avatar-wrapper">
            <img 
              src={currentUser.avatar} 
              alt={currentUser.name}
              className="avatar-img"
              style={{ width: '28px', height: '28px', border: '1px solid var(--border-strong)' }}
            />
            <div className="status-dot online" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-heading)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: 1.25 }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
              {renderRoleBadge(currentUser.role)}
              <span>{currentUser.role}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main View Mode Segmented Control */}
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
          Trello
        </button>
        <button 
          className={`tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          <Cpu size={13} />
          Agents
        </button>
      </div>

      {/* Text Channels Section */}
      <div className="sidebar-section">
        <span>Channels ({visibleChannels.length})</span>
        <button 
          title="Create Channel"
          onClick={() => setShowCreateChannel(!showCreateChannel)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '3px', display: 'flex', alignItems: 'center', borderRadius: '4px', color: showCreateChannel ? 'var(--text-heading)' : 'var(--text-muted)' }}
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Inline Create Channel Form */}
      {showCreateChannel && (
        <div style={{ margin: '4px 10px 8px', padding: '12px', background: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-strong)', animation: 'popupSlide 0.14s ease-out' }}>
          <form onSubmit={handleCreateChannel}>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>
                Channel Name
              </label>
              <input
                type="text"
                className="chat-input"
                placeholder="e.g. design-reviews"
                value={newChName}
                onChange={(e) => setNewChName(e.target.value)}
                required
                autoFocus
                style={{ height: '30px', fontSize: '12px' }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>
                Topic <span style={{ color: 'var(--text-muted)' }}>(optional)</span>
              </label>
              <input
                type="text"
                className="chat-input"
                placeholder="Purpose of this channel"
                value={newChTopic}
                onChange={(e) => setNewChTopic(e.target.value)}
                style={{ height: '30px', fontSize: '12px' }}
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-normal)', display: 'block', marginBottom: '5px' }}>
                Visibility
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  type="button"
                  onClick={() => { setNewChIsPrivate(false); setNewChInvitedUsers([]); }}
                  style={{ 
                    flex: 1, height: '28px', fontSize: '11.5px', fontWeight: 500, borderRadius: '6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.12s',
                    background: !newChIsPrivate ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: !newChIsPrivate ? '#10b981' : 'var(--text-muted)',
                    border: !newChIsPrivate ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--border-color)'
                  }}
                >
                  <Globe size={12} /> Public
                </button>
                <button 
                  type="button"
                  onClick={() => setNewChIsPrivate(true)}
                  style={{ 
                    flex: 1, height: '28px', fontSize: '11.5px', fontWeight: 500, borderRadius: '6px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', transition: 'all 0.12s',
                    background: newChIsPrivate ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255,255,255,0.03)',
                    color: newChIsPrivate ? '#f59e0b' : 'var(--text-muted)',
                    border: newChIsPrivate ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid var(--border-color)'
                  }}
                >
                  <Lock size={12} /> Private
                </button>
              </div>
            </div>

            {newChIsPrivate && (
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-normal)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '5px' }}>
                  <UserPlus size={11} /> Invite Members
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxHeight: '96px', overflowY: 'auto' }}>
                  {state.users.filter(u => u.id !== currentUser.id).map(u => {
                    const isInvited = newChInvitedUsers.includes(u.id);
                    return (
                      <div 
                        key={u.id}
                        onClick={() => toggleInvitedUser(u.id)}
                        style={{ 
                          display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 7px', borderRadius: '5px', cursor: 'pointer',
                          background: isInvited ? 'rgba(94, 106, 210, 0.14)' : 'transparent',
                          border: isInvited ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid transparent'
                        }}
                      >
                        <img src={u.avatar} alt={u.name} className="avatar-img" style={{ width: '18px', height: '18px' }} />
                        <span style={{ fontSize: '11.5px', color: isInvited ? 'var(--text-heading)' : 'var(--text-normal)', fontWeight: isInvited ? 500 : 400, flex: 1 }}>
                          {u.name}
                        </span>
                        {isInvited && <Check size={12} color="#818cf8" />}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
              <button type="button" className="btn btn-secondary" style={{ height: '26px', padding: '0 8px', fontSize: '11px' }} onClick={() => setShowCreateChannel(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!newChName.trim()} style={{ height: '26px', padding: '0 10px', fontSize: '11px', opacity: newChName.trim() ? 1 : 0.4 }}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Channel List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
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
                <Lock size={13.5} color="#f59e0b" style={{ flexShrink: 0, opacity: 0.85 }} />
              ) : (
                <Hash size={14.5} color={isActive ? 'var(--text-heading)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unreadCount > 0 || isActive ? 500 : 400 }}>
                {ch.name}
              </span>

              {unreadCount > 0 && !isActive && (
                <span className="unread-badge">
                  {unreadCount}
                </span>
              )}
            </div>
          );
        })}

        {/* Direct Messages (DMs) Section */}
        <div className="sidebar-section" style={{ marginTop: '14px' }}>
          <span>Direct Messages</span>
          <MessageCircle size={11} />
        </div>

        <div style={{ padding: '0 8px 12px' }}>
          {state.dms.map(dm => {
            const isAgent = dm.isAgent;
            const agentObj = isAgent ? state.agents.find(a => a.id === dm.targetId) : null;
            const userObj = !isAgent ? state.users.find(u => u.id === dm.targetId) : null;
            const isActive = activeTab === 'chat' && activeDM?.id === dm.id;
            const unreadCount = unreadCounts[dm.id] || 0;

            return (
              <div
                key={dm.id}
                className={`presence-card ${isActive ? 'active' : ''}`}
                style={{ cursor: 'pointer', position: 'relative' }}
                onClick={() => {
                  setActiveDM(dm);
                  setActiveTab('chat');
                  if (onMarkRead) onMarkRead(dm.id);
                }}
              >
                <div className="avatar-wrapper">
                  <img src={dm.avatar} alt={dm.name} className="avatar-img" style={{ width: '26px', height: '26px', border: '1px solid var(--border-color)' }} />
                  <div className={`status-dot ${isAgent ? (agentObj?.status || 'online') : (userObj?.status || 'online')}`} />
                </div>
                <div className="presence-info" style={{ flex: 1 }}>
                  <span className="presence-name" style={{ color: isActive ? 'var(--text-heading)' : 'var(--text-normal)', fontWeight: unreadCount > 0 || isActive ? 600 : 450 }}>
                    {dm.name}
                  </span>
                  <span className="presence-role" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {isAgent ? (agentObj?.cliEngine || 'AI Agent') : (
                      <>
                        {renderRoleBadge(userObj?.role)}
                        <span>{userObj?.role}</span>
                      </>
                    )}
                  </span>
                </div>

                {unreadCount > 0 && !isActive && (
                  <span className="unread-badge">
                    {unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
