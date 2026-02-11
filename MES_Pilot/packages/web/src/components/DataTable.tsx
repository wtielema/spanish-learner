import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
}

export default function DataTable<T>({ columns, data, loading, onRowClick }: DataTableProps<T>) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--color-text-muted)' }}>
        {t('common.noData')}
      </div>
    );
  }

  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col.key}>{col.header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item, idx) => (
          <tr
            key={idx}
            onClick={() => onRowClick?.(item)}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            {columns.map((col) => (
              <td key={col.key}>
                {col.render
                  ? col.render(item)
                  : String((item as Record<string, unknown>)[col.key] ?? '')}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
