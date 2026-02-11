import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import I18nInput from '../components/I18nInput';

interface Product {
  id: string;
  sku: string;
  nameI18n: Record<string, string>;
  descriptionI18n?: Record<string, string>;
  isActive: boolean;
}

const EMPTY_FORM: { sku: string; nameI18n: Record<string, string>; descriptionI18n: Record<string, string> } = {
  sku: '',
  nameI18n: { en: '', nl: '', zh: '' },
  descriptionI18n: { en: '', nl: '', zh: '' },
};

export default function ProductList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/api/products'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/api/products', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: typeof form }) =>
      apiFetch(`/api/products/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      closeModal();
    },
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      sku: product.sku,
      nameI18n: { en: '', nl: '', zh: '', ...product.nameI18n },
      descriptionI18n: { en: '', nl: '', zh: '', ...product.descriptionI18n },
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

  const columns: Column<Product>[] = [
    { key: 'sku', header: 'SKU' },
    {
      key: 'name',
      header: 'Name',
      render: (p) => p.nameI18n[i18n.language] || p.nameI18n.en || '',
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (p) => (
        <span className={`badge ${p.isActive ? 'badge-active' : 'badge-draft'}`}>
          {p.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (p) => (
        <button onClick={(e) => { e.stopPropagation(); openEdit(p); }}>
          {t('common.edit')}
        </button>
      ),
    },
  ];

  const saving = createMutation.isPending || updateMutation.isPending;

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.products')}</h1>
        <button className="primary" onClick={openCreate}>
          {t('common.create')} Product
        </button>
      </div>

      <DataTable columns={columns} data={products} loading={isLoading} />

      <Modal
        open={modalOpen}
        onClose={closeModal}
        title={editing ? 'Edit Product' : 'Create Product'}
      >
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label className="form-label">SKU</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="e.g. PROD-001"
              required
              style={{ width: '100%' }}
            />
          </div>

          <I18nInput
            label="Name"
            value={form.nameI18n}
            onChange={(v) => setForm({ ...form, nameI18n: v })}
          />

          <I18nInput
            label="Description"
            value={form.descriptionI18n}
            onChange={(v) => setForm({ ...form, descriptionI18n: v })}
          />

          <div className="modal-actions">
            <button type="button" onClick={closeModal}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
