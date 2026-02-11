import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';

interface Recipe {
  id: string;
  productId: string;
  product?: { nameI18n: Record<string, string> };
  versionNumber: number;
  areaType: string;
  status: string;
  createdBy?: { displayName: string };
  notes?: string;
}

interface Product {
  id: string;
  nameI18n: Record<string, string>;
}

const STATUS_BADGES: Record<string, string> = {
  draft: 'badge-draft',
  in_review: 'badge-completed',
  approved: 'badge-in-progress',
  active: 'badge-active',
  obsolete: 'badge-draft',
};

function statusLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

export default function RecipeList() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');

  const { data: recipes = [], isLoading } = useQuery<Recipe[]>({
    queryKey: ['recipes'],
    queryFn: () => apiFetch('/api/recipes'),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/api/products'),
  });

  const filtered = recipes.filter((r) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (productFilter && r.productId !== productFilter) return false;
    return true;
  });

  function productName(recipe: Recipe): string {
    if (recipe.product) {
      return recipe.product.nameI18n[i18n.language] || recipe.product.nameI18n.en || '';
    }
    const p = products.find((prod) => prod.id === recipe.productId);
    return p ? (p.nameI18n[i18n.language] || p.nameI18n.en || '') : recipe.productId;
  }

  const columns: Column<Recipe>[] = [
    {
      key: 'product',
      header: 'Product Name',
      render: (r) => productName(r),
    },
    {
      key: 'versionNumber',
      header: 'Version',
    },
    {
      key: 'areaType',
      header: 'Area Type',
      render: (r) => <span className="badge">{r.areaType}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => (
        <span className={`badge ${STATUS_BADGES[r.status] || 'badge-draft'}`}>
          {statusLabel(r.status)}
        </span>
      ),
    },
    {
      key: 'createdBy',
      header: 'Created By',
      render: (r) => r.createdBy?.displayName || '-',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/recipes/${r.id}`);
          }}
        >
          View
        </button>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Recipes</h1>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 160 }}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="in_review">In Review</option>
          <option value="approved">Approved</option>
          <option value="active">Active</option>
          <option value="obsolete">Obsolete</option>
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">All Products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameI18n[i18n.language] || p.nameI18n.en || p.id}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        loading={isLoading}
        onRowClick={(r) => navigate(`/recipes/${r.id}`)}
      />
    </div>
  );
}
