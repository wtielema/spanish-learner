import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client.ts';
import type { QcDeviation, WorkOrder } from '../types/models.ts';

const SEVERITY_BADGE: Record<string, string> = {
  minor: 'badge badge-in-progress',
  major: 'badge badge-blocked',
  critical: 'badge badge-on-hold',
};

export default function Deviations() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [severityFilter, setSeverityFilter] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: deviations = [], isLoading } = useQuery<QcDeviation[]>({
    queryKey: ['qc-deviations'],
    queryFn: () => apiFetch('/api/qc-deviations'),
  });

  const filtered = severityFilter
    ? deviations.filter((d) => d.severity === severityFilter)
    : deviations;

  return (
    <div>
      <h1>{t('quality.deviations')}</h1>

      <div className="job-center-toolbar">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="">{t('deviations.allSeverities')}</option>
          <option value="minor">{t('deviations.minor')}</option>
          <option value="major">{t('deviations.major')}</option>
          <option value="critical">{t('deviations.critical')}</option>
        </select>

        <button className="primary" onClick={() => setShowCreateForm(true)}>
          {t('deviations.create')}
        </button>
      </div>

      {isLoading && <p>{t('common.loading')}</p>}

      {!isLoading && filtered.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>{t('common.noData')}</p>
      )}

      {filtered.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t('deviations.severity')}</th>
              <th>{t('deviations.workOrder')}</th>
              <th>{t('deviations.description')}</th>
              <th>{t('deviations.created')}</th>
              <th>{t('deviations.status')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dev) => (
              <tr key={dev.id}>
                <td>
                  <span className={SEVERITY_BADGE[dev.severity] || 'badge'}>
                    {dev.severity}
                  </span>
                </td>
                <td>{dev.workOrder?.orderNumber || dev.workOrderId}</td>
                <td>{dev.description}</td>
                <td>{new Date(dev.createdAt).toLocaleString()}</td>
                <td>
                  {dev.resolvedAt ? (
                    <span className="badge badge-active">{t('deviations.resolved')}</span>
                  ) : (
                    <span className="badge badge-in-progress">{t('deviations.open')}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showCreateForm && (
        <CreateDeviationForm
          onClose={() => setShowCreateForm(false)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ['qc-deviations'] });
            setShowCreateForm(false);
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create Deviation Form
   ══════════════════════════════════════════════════════════ */

function CreateDeviationForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;

  const [workOrderId, setWorkOrderId] = useState('');
  const [severity, setSeverity] = useState('minor');
  const [description, setDescription] = useState('');

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders-all'],
    queryFn: () => apiFetch('/api/work-orders'),
  });

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const mutation = useMutation({
    mutationFn: (body: { workOrderId: string; severity: string; description: string }) =>
      apiFetch('/api/qc-deviations', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      onCreated();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('deviations.create')}</h2>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ workOrderId, severity, description });
          }}
        >
          <label>{t('deviations.workOrder')}</label>
          <select value={workOrderId} onChange={(e) => setWorkOrderId(e.target.value)} required>
            <option value="">--</option>
            {workOrders.map((wo) => (
              <option key={wo.id} value={wo.id}>
                {wo.orderNumber} — {i18nName(wo.product?.nameI18n)}
              </option>
            ))}
          </select>

          <label>{t('deviations.severity')}</label>
          <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="minor">{t('deviations.minor')}</option>
            <option value="major">{t('deviations.major')}</option>
            <option value="critical">{t('deviations.critical')}</option>
          </select>

          <label>{t('deviations.description')}</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            required
          />

          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button
              type="submit"
              className="primary"
              disabled={!workOrderId || !description || mutation.isPending}
            >
              {mutation.isPending ? t('common.loading') : t('common.create')}
            </button>
          </div>
          {mutation.isError && <p className="error-text">{(mutation.error as Error).message}</p>}
        </form>
      </div>
    </div>
  );
}
