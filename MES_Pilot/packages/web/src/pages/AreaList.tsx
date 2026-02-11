import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import I18nInput from '../components/I18nInput';

interface Site {
  id: string;
  nameI18n: Record<string, string>;
}

interface Area {
  id: string;
  nameI18n: Record<string, string>;
  areaType: 'batch' | 'discrete' | 'packaging';
  siteId: string;
  site?: Site;
}

type AreaType = Area['areaType'];

const AREA_TYPES: AreaType[] = ['batch', 'discrete', 'packaging'];

const BADGE_COLORS: Record<AreaType, string> = {
  batch: 'badge-completed',
  discrete: 'badge-active',
  packaging: 'badge-in-progress',
};

const EMPTY_FORM: { nameI18n: Record<string, string>; areaType: AreaType; siteId: string } = {
  nameI18n: { en: '', nl: '', zh: '' },
  areaType: 'batch',
  siteId: '',
};

export default function AreaList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: areas = [], isLoading } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => apiFetch('/api/sites'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch('/api/areas', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['areas'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof form }) =>
      apiFetch(`/api/areas/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['areas'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/areas/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['areas'] }); },
  });

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, siteId: sites[0]?.id ?? '' });
    setModalOpen(true);
  }

  function openEdit(area: Area) {
    setEditing(area);
    setForm({ nameI18n: { ...area.nameI18n }, areaType: area.areaType, siteId: area.siteId });
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

  function handleDelete(area: Area) {
    if (window.confirm(`Delete area "${area.nameI18n[i18n.language] || area.nameI18n.en}"?`)) {
      deleteMutation.mutate(area.id);
    }
  }

  function getSiteName(area: Area): string {
    if (area.site) return area.site.nameI18n[i18n.language] || area.site.nameI18n.en || '';
    const site = sites.find((s) => s.id === area.siteId);
    return site ? (site.nameI18n[i18n.language] || site.nameI18n.en || '') : '';
  }

  const columns: Column<Area>[] = [
    { key: 'name', header: 'Name', render: (a) => a.nameI18n[i18n.language] || a.nameI18n.en || '' },
    {
      key: 'areaType',
      header: 'Area Type',
      render: (a) => <span className={`badge ${BADGE_COLORS[a.areaType]}`}>{a.areaType}</span>,
    },
    { key: 'site', header: 'Site', render: getSiteName },
    {
      key: 'actions',
      header: 'Actions',
      render: (a) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(a); }}>{t('common.edit')}</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(a); }} style={{ color: 'var(--status-on-hold)' }}>{t('common.delete')}</button>
        </div>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.areas')}</h1>
        <button className="primary" onClick={openCreate}>{t('common.create')} Area</button>
      </div>

      <DataTable columns={columns} data={areas} loading={isLoading} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Area' : 'Create Area'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <I18nInput label="Name" value={form.nameI18n} onChange={(v) => setForm({ ...form, nameI18n: v })} />

          <div className="form-field">
            <label className="form-label">Site</label>
            <select value={form.siteId} onChange={(e) => setForm({ ...form, siteId: e.target.value })} style={{ width: '100%' }}>
              <option value="">-- Select Site --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>{s.nameI18n[i18n.language] || s.nameI18n.en}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Area Type</label>
            <select value={form.areaType} onChange={(e) => setForm({ ...form, areaType: e.target.value as AreaType })} style={{ width: '100%' }}>
              {AREA_TYPES.map((at) => (
                <option key={at} value={at}>{at}</option>
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
