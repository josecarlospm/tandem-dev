import React, { useState } from 'react';
import { Users, X, Shield, Crown, User, Trash2, Plus, Lock } from 'lucide-react';

export default function UserManagementModal({ currentUser, users = [], onClose, onCreateUser, onDeleteUser }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('User');
  const [title, setTitle] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const isOwner = currentUser?.role === 'Owner';
  const isAdmin = currentUser?.role === 'Admin';
  const canManageUsers = isOwner || isAdmin;

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) return;
    onCreateUser({
      name,
      email: email || `${name.toLowerCase().replace(/\s+/g, '')}@tandem.local`,
      password: password.trim(),
      role,
      title: title || 'Team Member'
    });
    setName('');
    setEmail('');
    setPassword('');
    setTitle('');
    setRole('User');
    setShowAddForm(false);
  };

  const getRoleBadge = (userRole) => {
    if (userRole === 'Owner') {
      return (
        <span className="tag-badge" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.25)' }}>
          <Crown size={10} /> Owner
        </span>
      );
    }
    if (userRole === 'Admin') {
      return (
        <span className="tag-badge" style={{ background: 'rgba(94, 106, 210, 0.12)', color: '#818cf8', borderColor: 'rgba(94, 106, 210, 0.28)' }}>
          <Shield size={10} /> Admin
        </span>
      );
    }
    return (
      <span className="tag-badge">
        <User size={10} /> User
      </span>
    );
  };

  const canDeleteTarget = (targetUser) => {
    if (targetUser.id === currentUser?.id) return false;
    if (isOwner) return true;
    if (isAdmin) return targetUser.role === 'User';
    return false;
  };

  return (
    <div className="task-drawer-overlay" onClick={onClose}>
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '12px', width: '560px', maxWidth: '92vw', padding: '24px', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(94, 106, 210, 0.14)', border: '1px solid rgba(94, 106, 210, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Users size={16} color="#818cf8" />
            </div>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-heading)', margin: 0 }}>
                Team & Access Control
              </h2>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span>Signed in as <strong style={{ color: 'var(--text-normal)' }}>{currentUser?.name}</strong></span>
                {getRoleBadge(currentUser?.role)}
              </div>
            </div>
          </div>

          <button className="btn btn-secondary" style={{ width: '28px', height: '28px', padding: 0 }} onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Member List */}
        <div style={{ marginBottom: '18px', maxHeight: '260px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {users.map(u => {
            const isSelf = u.id === currentUser?.id;
            const deletable = canDeleteTarget(u);

            return (
              <div 
                key={u.id}
                style={{ background: 'var(--bg-surface)', border: isSelf ? '1px solid rgba(94, 106, 210, 0.35)' : '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={u.avatar} alt={u.name} className="avatar-img" style={{ width: '32px', height: '32px', border: '1px solid var(--border-strong)' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)' }}>
                        {u.name} {isSelf && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(You)</span>}
                      </span>
                      {getRoleBadge(u.role)}
                    </div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', display: 'block', marginTop: '1px' }}>
                      {u.title || u.role} · {u.email}
                    </span>
                  </div>
                </div>

                {deletable ? (
                  <button 
                    className="btn btn-danger" 
                    style={{ height: '26px', padding: '0 8px', fontSize: '11px' }}
                    onClick={() => onDeleteUser(u.id)}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                ) : (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {isSelf ? 'Active' : 'Protected'}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Add User Section */}
        {canManageUsers ? (
          <div>
            {!showAddForm ? (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowAddForm(true)}>
                <Plus size={14} /> Add Team Member
              </button>
            ) : (
              <form onSubmit={handleCreate} style={{ background: 'var(--bg-surface)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-heading)', marginBottom: '12px' }}>New Team Member</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>Full Name</label>
                    <input 
                      type="text" 
                      className="chat-input" 
                      style={{ height: '32px', fontSize: '12px' }}
                      placeholder="e.g. Elena Rostova" 
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>Role</label>
                    <select 
                      value={role} 
                      onChange={(e) => setRole(e.target.value)}
                      style={{ width: '100%', height: '32px', background: 'var(--bg-chat-input)', color: 'var(--text-heading)', border: '1px solid var(--border-color)', padding: '0 10px', borderRadius: '7px', fontSize: '12px' }}
                    >
                      <option value="User">User (Chat & Tasks)</option>
                      <option value="Admin">Admin (Users & Agents)</option>
                      {isOwner && <option value="Owner">Owner (Full Access)</option>}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>Email</label>
                    <input 
                      type="email" 
                      className="chat-input" 
                      style={{ height: '32px', fontSize: '12px' }}
                      placeholder="elena@tandem.local" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>Initial Password</label>
                    <input 
                      type="password" 
                      className="chat-input" 
                      style={{ height: '32px', fontSize: '12px' }}
                      placeholder="Set password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-normal)', display: 'block', marginBottom: '4px' }}>Title</label>
                    <input 
                      type="text" 
                      className="chat-input" 
                      style={{ height: '32px', fontSize: '12px' }}
                      placeholder="Software Engineer" 
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" style={{ height: '28px', fontSize: '12px' }} onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" style={{ height: '28px', fontSize: '12px' }}>Create Member</button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '12px', padding: '6px 0' }}>
            <Lock size={12} />
            <span>Regular users have read-only access to team directory.</span>
          </div>
        )}
      </div>
    </div>
  );
}
