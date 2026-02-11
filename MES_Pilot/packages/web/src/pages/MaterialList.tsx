import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import I18nInput from '../components/I18nInput';

interface Material {
  id: string;
  code: string;
  nameI18n: Record<string, string>;
  category: string;
  unitOfMeasure: string;
}

const EMPTY_FORM: { code: string; nameI18n: Record<string, string>; category: string; unitOfMeasure: string } = {
  code: '',
  nameI18n: { en: '', nl: '', zh: '' },
  category: '',
  unitOfMeasure: '',
};

const CATEGORIES = ['raw_material', 'packaging', 'consumable', 'intermediate', 'finished_good'];

export default function MaterialList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: materials = [], isLoading } = useQuery<Material[]>({
    queryKey: ['materials'],
    queryFn: () => apiFetch('/api/materials'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/api/materials', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      closeModal();
    },
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate(form);
  }

  function categoryLabel(cat: string): string {
    return cat.replace(/_/g, ' ');
  }

  const columns: Column<Material>[] = [
    { key: 'code', header: 'Code' },
    {
      key: 'name',
      header: 'Name',
      render: (m) => m.nameI18n[i18n.language] || m.nameI18n.en || '',
    },
    {
      key: 'category',
      header: 'Category',
      render: (m) => <span className="badge">{categoryLabel(m.category)}</span>,
    },
    { key: 'unitOfMeasure', header: 'Unit of Measure' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.materials')}</h1>
        <button className="primary" onClick={openCreate}>
          {t('common.create')} Material
        </button>
      </div>

      <DataTable columns={columns} data={materials} loading={isLoading} />

      <Modal open={modalOpen} onClose={closeModal} title="Create Material">
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label className="form-label">Code</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="e.g. MAT-001"
              required
              style={{ width: '100%' }}
            />
          </div>

          <I18nInput
            label="Name"
            value={form.nameI18n}
            onChange={(v) => setForm({ ...form, nameI18n: v })}
          />

          <div className="form-field">
            <label className="form-label">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select category...</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {categoryLabel(cat)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Unit of Measure</label>
            <input
              type="text"
              value={form.unitOfMeasure}
              onChange={(e) => setForm({ ...form, unitOfMeasure: e.target.value })}
              placeholder="e.g. kg, L, pcs"
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
