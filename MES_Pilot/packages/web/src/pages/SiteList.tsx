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
  timezone: string;
  locale: string;
}

const EMPTY_FORM: { nameI18n: Record<string, string>; timezone: string; locale: string } = {
  nameI18n: { en: '', nl: '', zh: '' },
  timezone: 'UTC',
  locale: 'en',
};

export default function SiteList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ['sites'],
    queryFn: () => apiFetch('/api/sites'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => apiFetch('/api/sites', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); closeModal(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof form }) =>
      apiFetch(`/api/sites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); closeModal(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/sites/${id}`, { method: 'DELETE' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites'] }); },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(site: Site) {
    setEditing(site);
    setForm({ nameI18n: { ...site.nameI18n }, timezone: site.timezone, locale: site.locale });
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

  function handleDelete(site: Site) {
    if (window.confirm(`Delete site "${site.nameI18n[i18n.language] || site.nameI18n.en}"?`)) {
      deleteMutation.mutate(site.id);
    }
  }

  const columns: Column<Site>[] = [
    { key: 'name', header: 'Name', render: (s) => s.nameI18n[i18n.language] || s.nameI18n.en || '' },
    { key: 'timezone', header: 'Timezone' },
    { key: 'locale', header: 'Locale' },
    {
      key: 'actions',
      header: 'Actions',
      render: (s) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={(e) => { e.stopPropagation(); openEdit(s); }}>{t('common.edit')}</button>
          <button onClick={(e) => { e.stopPropagation(); handleDelete(s); }} style={{ color: 'var(--status-on-hold)' }}>{t('common.delete')}</button>
        </div>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.sites')}</h1>
        <button className="primary" onClick={openCreate}>{t('common.create')} Site</button>
      </div>

      <DataTable columns={columns} data={sites} loading={isLoading} />

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Edit Site' : 'Create Site'}>
        <form onSubmit={handleSubmit} className="modal-form">
          <I18nInput label="Name" value={form.nameI18n} onChange={(v) => setForm({ ...form, nameI18n: v })} />

          <div className="form-field">
            <label className="form-label">Timezone</label>
            <input
              type="text"
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              placeholder="e.g. Europe/Amsterdam"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Locale</label>
            <select value={form.locale} onChange={(e) => setForm({ ...form, locale: e.target.value })} style={{ width: '100%' }}>
              <option value="en">English</option>
              <option value="nl">Nederlands</option>
              <option value="zh">Chinese</option>
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
