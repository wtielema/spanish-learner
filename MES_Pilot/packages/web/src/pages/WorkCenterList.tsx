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

interface WorkCenter {
  id: string;
  nameI18n: Record<string, string>;
  areaId: string;
  area?: Area;
}

const EMPTY_FORM: { nameI18n: Record<string, string>; areaId: string } = {
  nameI18n: { en: '', nl: '', zh: '' },
  areaId: '',
};

export default function WorkCenterList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WorkCenter | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: workCenters = [], isLoading } = useQuery<WorkCenter[]>({
    queryKey: ['work-centers'],
    queryFn: () => apiFetch('/api/work-centers'),
  });

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/api/work-centers', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['work-centers'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof form }) =>
      apiFetch(`/api/work-centers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['work-centers'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/work-centers/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['work-centers'] }); },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/work-centers/${id}/clone`, { method: 'POST' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['work-centers'] }); },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, areaId: areas[0]?.id ?? '' });
    setModalOpen(true);
  }

  function openEdit(wc: WorkCenter) {
    setEditing(wc);
    setForm({ nameI18n: { ...wc.nameI18n }, areaId: wc.areaId });
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

  function handleDelete(wc: WorkCenter) {
    if (window.confirm(`Delete work center "${wc.nameI18n[i18n.language] || wc.nameI18n.en}"?`)) {
      deleteMutation.mutate(wc.id);
    }
  }

  function handleClone(wc: WorkCenter) {
    cloneMutation.mutate(wc.id);
  }

  function getAreaName(wc: WorkCenter): string {
    if (wc.area) return wc.area.nameI18n[i18n.language] || wc.area.nameI18n.en || '';
    const area = areas.find((a) => a.id === wc.areaId);
    return area ? (area.nameI18n[i18n.language] || area.nameI18n.en || '') : '';
  }

  const columns: Column<WorkCenter>[] = [
    { key: 'name', header: 'Name', render: (wc) => wc.nameI18n[i18n.language] || wc.nameI18n.en || '' },
    { key: 'area', header: 'Area', render: getAreaName },
    {
      key: 'actions',
      header: 'Actions',
      render: (wc) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(wc); }}>{t('common.edit')}</button>
          <button onClick={(e) => { e.stopPropagation(); handleClone(wc); }}>Clone</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(wc); }} style={{ color: 'var(--status-on-hold)' }}>{t('common.delete')}</button>
        </div>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.workCenters')}</h1>
        <button className="primary" onClick={openCreate}>{t('common.create')} Work Center</button>
      </div>

      <DataTable columns={columns} data={workCenters} loading={isLoading} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Work Center' : 'Create Work Center'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <I18nInput label="Name" value={form.nameI18n} onChange={(v) => setForm({ ...form, nameI18n: v })} />

          <div className="form-field">
            <label className="form-label">Area</label>
            <select value={form.areaId} onChange={(e) => setForm({ ...form, areaId: e.target.value })} style={{ width: '100%' }}>
              <option value="">-- Select Area --</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>{a.nameI18n[i18n.language] || a.nameI18n.en}</option>
              ))}
            </select>
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
