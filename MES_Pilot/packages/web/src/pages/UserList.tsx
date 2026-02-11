import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import type { Column } from '../components/DataTable';

interface AreaRole {
  areaId: string;
  areaName?: string;
  roleId: string;
  roleName?: string;
}

interface User {
  id: string;
  displayName: string;
  email: string;
  locale: string;
  active: boolean;
  areaRoles?: AreaRole[];
}

interface Role {
  id: string;
  name: string;
}

interface Area {
  id: string;
  nameI18n: Record<string, string>;
}

export default function UserList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [assignForm, setAssignForm] = useState({ areaId: '', roleId: '' });

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => apiFetch('/api/users'),
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['roles'],
    queryFn: () => apiFetch('/api/roles'),
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, areaId, roleId }: { userId: string; areaId: string; roleId: string }) =>
      apiFetch(`/api/users/${userId}/areas`, { method: 'POST', body: JSON.stringify({ areaId, roleId }) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });

  const removeMutation = useMutation({
    mutationFn: ({ userId, areaId }: { userId: string; areaId: string }) =>
      apiFetch(`/api/users/${userId}/areas/${areaId}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['users'] }); },
  });

  function toggleExpand(user: User) {
    if (expandedUserId === user.id) {
      setExpandedUserId(null);
    } else {
      setExpandedUserId(user.id);
      setAssignForm({ areaId: areas[0]?.id ?? '', roleId: roles[0]?.id ?? '' });
    }
  }

  function handleAssign(userId: string) {
    if (!assignForm.areaId || !assignForm.roleId) return;
    assignMutation.mutate({ userId, areaId: assignForm.areaId, roleId: assignForm.roleId });
    setAssignForm({ areaId: areas[0]?.id ?? '', roleId: roles[0]?.id ?? '' });
  }

  function handleRemove(userId: string, areaId: string) {
    removeMutation.mutate({ userId, areaId });
  }

  function getAreaName(areaId: string): string {
    const area = areas.find((a) => a.id === areaId);
    return area ? (area.nameI18n[i18n.language] || area.nameI18n.en || '') : areaId;
  }

  function getRoleName(roleId: string): string {
    const role = roles.find((r) => r.id === roleId);
    return role ? role.name : roleId;
  }

  const columns: Column<User>[] = [
    { key: 'displayName', header: 'Display Name' },
    { key: 'email', header: 'Email' },
    { key: 'locale', header: 'Locale' },
    {
      key: 'active',
      header: 'Status',
      render: (u) => (
        <span className={`badge ${u.active ? 'badge-active' : 'badge-draft'}`}>
          {u.active ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.users')}</h1>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
          <div className="spinner" />
        </div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
          {t('common.noData')}
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <UserRow
                key={user.id}
                user={user}
                columns={columns}
                expanded={expandedUserId === user.id}
                onToggle={() => toggleExpand(user)}
                areas={areas}
                roles={roles}
                assignForm={assignForm}
                onAssignFormChange={setAssignForm}
                onAssign={() => handleAssign(user.id)}
                onRemove={(areaId) => handleRemove(user.id, areaId)}
                getAreaName={getAreaName}
                getRoleName={getRoleName}
                i18nLang={i18n.language}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

interface UserRowProps {
  user: User;
  columns: Column<User>[];
  expanded: boolean;
  onToggle: () => void;
  areas: Area[];
  roles: Role[];
  assignForm: { areaId: string; roleId: string };
  onAssignFormChange: (form: { areaId: string; roleId: string }) => void;
  onAssign: () => void;
  onRemove: (areaId: string) => void;
  getAreaName: (areaId: string) => string;
  getRoleName: (roleId: string) => string;
  i18nLang: string;
}

interface Area {
  id: string;
  nameI18n: Record<string, string>;
}

interface Role {
  id: string;
  name: string;
}

function UserRow({
  user,
  columns,
  expanded,
  onToggle,
  areas,
  roles,
  assignForm,
  onAssignFormChange,
  onAssign,
  onRemove,
  getAreaName,
  getRoleName,
  i18nLang,
}: UserRowProps) {
  return (
    <>
      <tr onClick={onToggle} style={{ cursor: 'pointer' }}>
        {columns.map((col) => (
          <td key={col.key}>
            {col.render
              ? col.render(user)
              : String((user as unknown as Record<string, unknown>)[col.key] ?? '')}
          </td>
        ))}
      </tr>
      {expanded && (
        <tr>
          <td colSpan={columns.length} style={{ background: 'var(--color-bg)', padding: 16 }}>
            <div style={{ marginBottom: 12 }}>
              <strong>Area-Role Assignments</strong>
            </div>

            {user.areaRoles && user.areaRoles.length > 0 ? (
              <table style={{ marginBottom: 16 }}>
                <thead>
                  <tr>
                    <th>Area</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {user.areaRoles.map((ar) => (
                    <tr key={`${ar.areaId}-${ar.roleId}`}>
                      <td>{ar.areaName || getAreaName(ar.areaId)}</td>
                      <td>{ar.roleName || getRoleName(ar.roleId)}</td>
                      <td>
                        <button
                          onClick={(e) => { e.stopPropagation(); onRemove(ar.areaId); }}
                          style={{ color: 'var(--status-on-hold)' }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>
                No area-role assignments
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select
                value={assignForm.areaId}
                onChange={(e) => onAssignFormChange({ ...assignForm, areaId: e.target.value })}
              >
                <option value="">-- Area --</option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nameI18n[i18nLang] || a.nameI18n.en}
                  </option>
                ))}
              </select>
              <select
                value={assignForm.roleId}
                onChange={(e) => onAssignFormChange({ ...assignForm, roleId: e.target.value })}
              >
                <option value="">-- Role --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <button className="primary" onClick={(e) => { e.stopPropagation(); onAssign(); }}>
                Assign
              </button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
