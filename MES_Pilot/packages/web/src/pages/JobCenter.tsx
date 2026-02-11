import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client.ts';
import { getSocket } from '../api/socket.ts';
import { useSocketEvent } from '../hooks/useSocketEvent.ts';
import type { Area, WorkOrder, Product, WorkCenter } from '../types/models.ts';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge badge-draft',
  released: 'badge badge-released',
  started: 'badge badge-active',
  in_progress: 'badge badge-in-progress',
  on_hold: 'badge badge-on-hold',
  completed: 'badge badge-completed',
};

export default function JobCenter() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lng = i18n.language;

  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  /* ── Data fetching ─────────────────────────────────── */

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  const { data: workOrders = [], isLoading: woLoading } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders', selectedAreaId],
    queryFn: () => apiFetch(`/api/work-orders?areaId=${selectedAreaId}`),
    enabled: !!selectedAreaId,
  });

  /* ── Socket: join area room + live updates ─────────── */

  // Join area room when selected
  const handleAreaChange = useCallback((areaId: string) => {
    if (selectedAreaId) {
      getSocket().emit('leave-area', selectedAreaId);
    }
    setSelectedAreaId(areaId);
    if (areaId) {
      getSocket().emit('join-area', areaId);
    }
  }, [selectedAreaId]);

  const handleStatusChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['work-orders', selectedAreaId] });
  }, [queryClient, selectedAreaId]);

  const handleCountUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['work-orders', selectedAreaId] });
  }, [queryClient, selectedAreaId]);

  useSocketEvent('work-order:status-changed', handleStatusChanged);
  useSocketEvent('production:count-updated', handleCountUpdated);

  /* ── Render helpers ────────────────────────────────── */

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const progressPct = (wo: WorkOrder) => {
    const target = Number(wo.quantityTarget) || 1;
    const produced = Number(wo.quantityProduced) || 0;
    return Math.min(100, Math.round((produced / target) * 100));
  };

  return (
    <div>
      <h1>{t('nav.jobCenter')}</h1>

      {/* ── Area Selector ──────────────────────────────── */}
      <div className="job-center-toolbar">
        <select
          value={selectedAreaId}
          onChange={(e) => handleAreaChange(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="">{t('jobCenter.selectArea')}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{i18nName(a.nameI18n)}</option>
          ))}
        </select>

        <button className="primary" onClick={() => setShowCreateForm(true)}>
          {t('jobs.create')}
        </button>
      </div>

      {/* ── Create Work Order Modal ────────────────────── */}
      {showCreateForm && (
        <CreateWorkOrderForm
          areas={areas}
          defaultAreaId={selectedAreaId}
          lng={lng}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {/* ── Work Order Grid ────────────────────────────── */}
      {selectedAreaId && woLoading && <p>{t('common.loading')}</p>}

      {selectedAreaId && !woLoading && workOrders.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>
          {t('common.noData')}
        </p>
      )}

      <div className="wo-grid">
        {workOrders.map((wo) => (
          <div
            key={wo.id}
            className="wo-card"
            onClick={() => navigate(`/work-orders/${wo.id}`)}
          >
            <div className="wo-card-header">
              <span className="wo-order-number">{wo.orderNumber}</span>
              <span className={STATUS_BADGE[wo.status] || 'badge'}>{wo.status}</span>
            </div>

            <div className="wo-card-product">
              {i18nName(wo.product?.nameI18n)}
            </div>
            <div className="wo-card-wc">
              {i18nName(wo.workCenter?.nameI18n)}
            </div>

            {/* Progress */}
            <div className="wo-progress-bar-container">
              <div className="wo-progress-bar" style={{ width: `${progressPct(wo)}%` }} />
            </div>
            <div className="wo-progress-label">
              {Number(wo.quantityProduced)} / {Number(wo.quantityTarget)} ({progressPct(wo)}%)
            </div>

            {/* Priority */}
            {wo.priority > 0 && (
              <div className="wo-priority">
                {t('jobCenter.priority')}: {wo.priority}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Create Work Order Form (inline dialog)
   ══════════════════════════════════════════════════════════ */

function CreateWorkOrderForm({
  areas,
  defaultAreaId,
  lng,
  onClose,
}: {
  areas: Area[];
  defaultAreaId: string;
  lng: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [areaId, setAreaId] = useState(defaultAreaId);
  const [productId, setProductId] = useState('');
  const [workCenterId, setWorkCenterId] = useState('');
  const [quantityTarget, setQuantityTarget] = useState('');
  const [priority, setPriority] = useState('0');
  const [scheduledStart, setScheduledStart] = useState('');

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['products'],
    queryFn: () => apiFetch('/api/products'),
  });

  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ['work-centers'],
    queryFn: () => apiFetch('/api/work-centers'),
  });

  const filteredWc = workCenters.filter((wc) => wc.areaId === areaId);

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch('/api/work-orders', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {
      productId,
      areaId,
      workCenterId,
      quantityTarget: Number(quantityTarget),
      priority: Number(priority),
    };
    if (scheduledStart) body.scheduledStart = scheduledStart;
    mutation.mutate(body);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('jobs.create')}</h2>
        <form onSubmit={handleSubmit} className="form-stack">
          <label>{t('jobCenter.area')}</label>
          <select value={areaId} onChange={(e) => { setAreaId(e.target.value); setWorkCenterId(''); }}>
            <option value="">--</option>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{i18nName(a.nameI18n)}</option>
            ))}
          </select>

          <label>{t('jobCenter.product')}</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">--</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.sku} — {i18nName(p.nameI18n)}</option>
            ))}
          </select>

          <label>{t('jobCenter.workCenter')}</label>
          <select value={workCenterId} onChange={(e) => setWorkCenterId(e.target.value)}>
            <option value="">--</option>
            {filteredWc.map((wc) => (
              <option key={wc.id} value={wc.id}>{i18nName(wc.nameI18n)}</option>
            ))}
          </select>

          <label>{t('jobCenter.quantity')}</label>
          <input
            type="number"
            min="1"
            value={quantityTarget}
            onChange={(e) => setQuantityTarget(e.target.value)}
            required
          />

          <label>{t('jobCenter.priority')}</label>
          <input
            type="number"
            min="0"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />

          <label>{t('jobCenter.scheduledStart')}</label>
          <input
            type="datetime-local"
            value={scheduledStart}
            onChange={(e) => setScheduledStart(e.target.value)}
          />

          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button
              type="submit"
              className="primary"
              disabled={!productId || !areaId || !workCenterId || !quantityTarget || mutation.isPending}
            >
              {mutation.isPending ? t('common.loading') : t('common.create')}
            </button>
          </div>

          {mutation.isError && (
            <p className="error-text">{(mutation.error as Error).message}</p>
          )}
        </form>
      </div>
    </div>
  );
}
