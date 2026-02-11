import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import I18nInput from '../components/I18nInput';

interface Area {
  id: string;
  nameI18n: Record<string, string>;
}

type ReasonCategory = 'downtime' | 'reject' | 'hold';

interface ReasonCode {
  id: string;
  nameI18n: Record<string, string>;
  category: ReasonCategory;
  areaId: string | null;
  area?: Area | null;
  requiresComment: boolean;
}

const CATEGORIES: ReasonCategory[] = ['downtime', 'reject', 'hold'];

const CATEGORY_BADGE: Record<ReasonCategory, string> = {
  downtime: 'badge-in-progress',
  reject: 'badge-on-hold',
  hold: 'badge-draft',
};

interface FormState {
  nameI18n: Record<string, string>;
  category: ReasonCategory;
  areaId: string;
  requiresComment: boolean;
}

const EMPTY_FORM: FormState = {
  nameI18n: { en: '', nl: '', zh: '' },
  category: 'downtime',
  areaId: '',
  requiresComment: false,
};

export default function ReasonCodeList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ReasonCode | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [filterCategory, setFilterCategory] = useState<string>('');

  const { data: reasonCodes = [], isLoading } = useQuery<ReasonCode[]>({
    queryKey: ['reason-codes'],
    queryFn: () => apiFetch('/api/reason-codes'),
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  const createMutation = useMutation({
    mutationFn: (body: FormState) => {
      const payload = { ...body, areaId: body.areaId || undefined };
      return apiFetch('/api/reason-codes', { method: 'POST', body: JSON.stringify(payload) });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reason-codes'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: FormState }) => {
      const payload = { ...body, areaId: body.areaId || undefined };
      return apiFetch(`/api/reason-codes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reason-codes'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reason-codes/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['reason-codes'] }); },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(rc: ReasonCode) {
    setEditing(rc);
    setForm({
      nameI18n: { ...rc.nameI18n },
      category: rc.category,
      areaId: rc.areaId ?? '',
      requiresComment: rc.requiresComment,
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      updateMutation.mutate({ id: editing.id, body: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleDelete(rc: ReasonCode) {
    if (window.confirm(`Delete reason code "${rc.nameI18n[i18n.language] || rc.nameI18n.en}"?`)) {
      deleteMutation.mutate(rc.id);
    }
  }

  function getAreaName(rc: ReasonCode): string {
    if (!rc.areaId) return 'Site-level';
    if (rc.area) return rc.area.nameI18n[i18n.language] || rc.area.nameI18n.en || '';
    const area = areas.find((a) => a.id === rc.areaId);
    return area ? (area.nameI18n[i18n.language] || area.nameI18n.en || '') : '';
  }

  const filtered = filterCategory
    ? reasonCodes.filter((rc) => rc.category === filterCategory)
    : reasonCodes;

  const columns: Column<ReasonCode>[] = [
    { key: 'name', header: 'Name', render: (rc) => rc.nameI18n[i18n.language] || rc.nameI18n.en || '' },
    {
      key: 'category',
      header: 'Category',
      render: (rc) => <span className={`badge ${CATEGORY_BADGE[rc.category]}`}>{rc.category}</span>,
    },
    { key: 'area', header: 'Area', render: getAreaName },
    {
      key: 'requiresComment',
      header: 'Requires Comment',
      render: (rc) => rc.requiresComment ? 'Yes' : 'No',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (rc) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(rc); }}>{t('common.edit')}</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(rc); }} style={{ color: 'var(--status-on-hold)' }}>{t('common.delete')}</button>
        </div>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.reasonCodes')}</h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            style={{ minWidth: 150 }}
          >
            <option value="">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className="primary" onClick={openCreate}>{t('common.create')} Reason Code</button>
        </div>
      </div>

      <DataTable columns={columns} data={filtered} loading={isLoading} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Reason Code' : 'Create Reason Code'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <I18nInput label="Name" value={form.nameI18n} onChange={(v) => setForm({ ...form, nameI18n: v })} />

          <div className="form-field">
            <label className="form-label">Category</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ReasonCategory })} style={{ width: '100%' }}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Area (optional, leave empty for site-level)</label>
            <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })} style={{ width: '100%' }}>
              <option value="">Site-level (no area)</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nameI18n[i18n.language] || a.nameI18n.en}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.requiresComment}
                onChange={(e) => setForm({ ...form, requiresComment: e.target.checked })}
                style={{ width: 'auto' }}
              />
              Requires Comment
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={closeModal}>{t('common.cancel')}</button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
