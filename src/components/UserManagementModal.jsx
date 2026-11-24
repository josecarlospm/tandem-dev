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
        <span className="tag-badge border-amber-200 bg-amber-50 text-amber-600">
          <Crown size={10} /> Owner
        </span>
      );
    }
    if (userRole === 'Admin') {
      return (
        <span className="tag-badge border-accent-mid bg-accent-soft text-accent">
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
        className="modal-panel w-[560px] max-w-[92vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="mb-[18px] flex items-center justify-between border-b border-line pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-accent-mid bg-accent-soft text-accent">
              <Users size={16} />
            </div>
            <div>
              <h2 className="m-0 text-[15px] font-semibold text-ink-heading">
                Team & Access Control
              </h2>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                <span>Signed in as <strong className="text-ink">{currentUser?.name}</strong></span>
                {getRoleBadge(currentUser?.role)}
              </div>
            </div>
          </div>

          <button className="btn btn-secondary h-7 w-7 p-0" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Member List */}
        <div className="mb-[18px] flex max-h-[260px] flex-col gap-1.5 overflow-y-auto">
          {users.map(u => {
            const isSelf = u.id === currentUser?.id;
            const deletable = canDeleteTarget(u);

            return (
              <div
                key={u.id}
                className={`flex items-center justify-between rounded-lg border bg-surface-muted px-3.5 py-2.5 ${
                  isSelf ? 'border-accent-mid' : 'border-line'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={u.avatar}
                    alt={u.name}
                    className="avatar-img h-8 w-8 border border-line-strong"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-ink-heading">
                        {u.name} {isSelf && <span className="font-normal text-ink-muted">(You)</span>}
                      </span>
                      {getRoleBadge(u.role)}
                    </div>
                    <span className="mt-px block text-[11.5px] text-ink-muted">
                      {u.title || u.role} · {u.email}
                    </span>
                  </div>
                </div>

                {deletable ? (
                  <button
                    className="btn btn-danger h-[26px] px-2 text-[11px]"
                    onClick={() => onDeleteUser(u.id)}
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                ) : (
                  <span className="text-[11px] text-ink-muted">
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
              <button className="btn btn-primary w-full justify-center" onClick={() => setShowAddForm(true)}>
                <Plus size={14} /> Add Team Member
              </button>
            ) : (
              <form onSubmit={handleCreate} className="rounded-lg border border-line bg-surface-muted p-4">
                <h3 className="mb-3 text-[13px] font-semibold text-ink-heading">New Team Member</h3>

                <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink">Full Name</label>
                    <input
                      type="text"
                      className="chat-input h-8 text-xs"
                      placeholder="e.g. Elena Rostova"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-ink">Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="h-8 w-full rounded-lg border border-line bg-white px-2.5 text-xs text-ink-heading"
                    >
                      <option value="User">User (Chat & Tasks)</option>
                      <option value="Admin">Admin (Users & Agents)</option>
                      {isOwner && <option value="Owner">Owner (Full Access)</option>}
                    </select>
                  </div>
                </div>

                <div className="mb-3.5 grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="mb-1 block text-[11px] text-ink">Email</label>
                    <input
                      type="email"
                      className="chat-input h-8 text-xs"
                      placeholder="elena@tandem.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-ink">Initial Password</label>
                    <input
                      type="password"
                      className="chat-input h-8 text-xs"
                      placeholder="Set password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-[11px] text-ink">Title</label>
                    <input
                      type="text"
                      className="chat-input h-8 text-xs"
                      placeholder="Software Engineer"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary h-7 text-xs" onClick={() => setShowAddForm(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary h-7 text-xs">Create Member</button>
                </div>
              </form>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 px-0 py-1.5 text-xs text-ink-muted">
            <Lock size={12} />
            <span>Regular users have read-only access to team directory.</span>
          </div>
        )}
      </div>
    </div>
  );
}
