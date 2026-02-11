import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client.ts';
import { useSocketEvent } from '../hooks/useSocketEvent.ts';
import type { WorkOrder, ProductionLog, QcCheck, ReasonCode } from '../types/models.ts';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge badge-draft',
  released: 'badge badge-released',
  started: 'badge badge-active',
  in_progress: 'badge badge-in-progress',
  on_hold: 'badge badge-on-hold',
  completed: 'badge badge-completed',
};

export default function WorkOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const lng = i18n.language;

  const [countValue, setCountValue] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDowntimeDialog, setShowDowntimeDialog] = useState(false);
  const [showHoldDialog, setShowHoldDialog] = useState(false);

  /* ── Data ──────────────────────────────────────────── */

  const { data: wo, isLoading } = useQuery<WorkOrder>({
    queryKey: ['work-order', id],
    queryFn: () => apiFetch(`/api/work-orders/${id}`),
    enabled: !!id,
  });

  const { data: logs = [] } = useQuery<ProductionLog[]>({
    queryKey: ['work-order-logs', id],
    queryFn: () => apiFetch(`/api/work-orders/${id}/logs`),
    enabled: !!id,
  });

  const { data: qcChecks = [] } = useQuery<QcCheck[]>({
    queryKey: ['work-order-qc', id],
    queryFn: () => apiFetch(`/api/work-orders/${id}/qc-checks`),
    enabled: !!id,
  });

  /* ── Socket live updates ───────────────────────────── */

  const handleLiveUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['work-order', id] });
    queryClient.invalidateQueries({ queryKey: ['work-order-logs', id] });
    queryClient.invalidateQueries({ queryKey: ['work-order-qc', id] });
  }, [queryClient, id]);

  useSocketEvent('work-order:status-changed', handleLiveUpdate);
  useSocketEvent('production:count-updated', handleLiveUpdate);

  /* ── Mutations ─────────────────────────────────────── */

  const actionMutation = useMutation({
    mutationFn: ({ action, body }: { action: string; body?: Record<string, unknown> }) =>
      apiFetch(`/api/work-orders/${id}/${action}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['work-order-logs', id] });
    },
  });

  const logMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/work-orders/${id}/logs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', id] });
      queryClient.invalidateQueries({ queryKey: ['work-order-logs', id] });
      setCountValue('');
    },
  });

  /* ── Helpers ───────────────────────────────────────── */

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const progressPct = wo
    ? Math.min(100, Math.round((Number(wo.quantityProduced) / (Number(wo.quantityTarget) || 1)) * 100))
    : 0;

  const status = wo?.status || '';
  const isPending = actionMutation.isPending || logMutation.isPending;

  if (isLoading) return <p>{t('common.loading')}</p>;
  if (!wo) return <p>{t('common.noData')}</p>;

  const handleLogCount = () => {
    if (!countValue) return;
    logMutation.mutate({ eventType: 'count', value: Number(countValue) });
  };

  const pendingChecks = qcChecks.filter(
    (c) => c.status === 'pending' || c.status === 'due',
  );

  return (
    <div className="wo-detail">
      {/* ── Back button ─────────────────────────────────── */}
      <button onClick={() => navigate('/job-center')} style={{ marginBottom: 16 }}>
        &larr; {t('nav.jobCenter')}
      </button>

      {/* ── Header ──────────────────────────────────────── */}
      <div className="wo-detail-header">
        <h1>{wo.orderNumber}</h1>
        <span className={STATUS_BADGE[status] || 'badge'}>{status}</span>
      </div>

      <div className="wo-detail-meta">
        <div><strong>{t('jobCenter.product')}:</strong> {i18nName(wo.product?.nameI18n)}</div>
        <div><strong>{t('jobCenter.workCenter')}:</strong> {i18nName(wo.workCenter?.nameI18n)}</div>
        {wo.controlRecipeId && (
          <div><strong>{t('woDetail.recipe')}:</strong> {wo.controlRecipeId}</div>
        )}
      </div>

      {/* ── Progress ────────────────────────────────────── */}
      <div className="wo-detail-section">
        <h2>{t('woDetail.progress')}</h2>
        <div className="wo-progress-bar-container large">
          <div className="wo-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="wo-progress-stats">
          <span>{t('woDetail.produced')}: {Number(wo.quantityProduced)} / {Number(wo.quantityTarget)}</span>
          <span>{t('woDetail.rejected')}: {Number(wo.quantityRejected)}</span>
        </div>
      </div>

      {/* ── Action Buttons ──────────────────────────────── */}
      <div className="wo-detail-section">
        <h2>{t('woDetail.actions')}</h2>
        <div className="wo-action-row">
          {status === 'draft' && (
            <button
              className="action-btn release"
              disabled={isPending}
              onClick={() => actionMutation.mutate({ action: 'release' })}
            >
              {t('woDetail.release')}
            </button>
          )}
          {status === 'released' && (
            <button
              className="action-btn start"
              disabled={isPending}
              onClick={() => actionMutation.mutate({ action: 'start' })}
            >
              {t('jobs.start')}
            </button>
          )}
          {(status === 'started' || status === 'in_progress') && (
            <>
              {/* Log Count */}
              <div className="action-inline-group">
                <input
                  type="number"
                  min="1"
                  placeholder={t('woDetail.countPlaceholder')}
                  value={countValue}
                  onChange={(e) => setCountValue(e.target.value)}
                  style={{ width: 100 }}
                />
                <button
                  className="action-btn count"
                  disabled={isPending || !countValue}
                  onClick={handleLogCount}
                >
                  {t('woDetail.logCount')}
                </button>
              </div>

              <button
                className="action-btn reject"
                disabled={isPending}
                onClick={() => setShowRejectDialog(true)}
              >
                {t('woDetail.logReject')}
              </button>

              <button
                className="action-btn downtime"
                disabled={isPending}
                onClick={() => setShowDowntimeDialog(true)}
              >
                {t('woDetail.logDowntime')}
              </button>

              <button
                className="action-btn hold"
                disabled={isPending}
                onClick={() => setShowHoldDialog(true)}
              >
                {t('jobs.hold')}
              </button>

              <button
                className="action-btn complete"
                disabled={isPending}
                onClick={() => actionMutation.mutate({ action: 'complete' })}
              >
                {t('jobs.complete')}
              </button>
            </>
          )}
          {status === 'on_hold' && (
            <button
              className="action-btn start"
              disabled={isPending}
              onClick={() => actionMutation.mutate({ action: 'resume' })}
            >
              {t('jobs.resume')}
            </button>
          )}
        </div>

        {actionMutation.isError && (
          <p className="error-text">{(actionMutation.error as Error).message}</p>
        )}
        {logMutation.isError && (
          <p className="error-text">{(logMutation.error as Error).message}</p>
        )}
      </div>

      {/* ── QC Checks Due ───────────────────────────────── */}
      {pendingChecks.length > 0 && (
        <div className="wo-detail-section">
          <h2>{t('woDetail.qcChecksDue')}</h2>
          <div className="qc-due-list">
            {pendingChecks.map((check) => (
              <div key={check.id} className="qc-due-item">
                <span>{i18nName(check.template?.nameI18n)}</span>
                <span className="badge badge-in-progress">{check.status}</span>
                <button
                  className="primary"
                  onClick={() => navigate(`/qc-checks?checkId=${check.id}`)}
                >
                  {t('jobs.complete')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Production Logs ─────────────────────────────── */}
      <div className="wo-detail-section">
        <h2>{t('woDetail.productionLogs')}</h2>
        {logs.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)' }}>{t('common.noData')}</p>
        ) : (
          <div className="log-list">
            {logs.map((log) => (
              <div key={log.id} className="log-item">
                <span className={`badge badge-${log.eventType === 'count' ? 'active' : log.eventType === 'reject' ? 'on-hold' : 'in-progress'}`}>
                  {log.eventType}
                </span>
                {log.value != null && <span className="log-value">{Number(log.value)}</span>}
                {log.comment && <span className="log-comment">{log.comment}</span>}
                <span className="log-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialogs ─────────────────────────────────────── */}
      {showRejectDialog && wo.areaId && (
        <RejectDialog
          workOrderId={id!}
          areaId={wo.areaId}
          lng={lng}
          onClose={() => setShowRejectDialog(false)}
        />
      )}
      {showDowntimeDialog && wo.areaId && (
        <DowntimeDialog
          workOrderId={id!}
          areaId={wo.areaId}
          lng={lng}
          onClose={() => setShowDowntimeDialog(false)}
        />
      )}
      {showHoldDialog && (
        <HoldDialog
          workOrderId={id!}
          onClose={() => setShowHoldDialog(false)}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Reject Dialog
   ══════════════════════════════════════════════════════════ */

function RejectDialog({
  workOrderId,
  areaId,
  lng,
  onClose,
}: {
  workOrderId: string;
  areaId: string;
  lng: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reasonCodeId, setReasonCodeId] = useState('');
  const [value, setValue] = useState('');

  const { data: reasonCodes = [] } = useQuery<ReasonCode[]>({
    queryKey: ['reason-codes'],
    queryFn: () => apiFetch('/api/reason-codes'),
  });

  const rejectCodes = reasonCodes.filter(
    (rc) => rc.category === 'reject' && (!rc.areaId || rc.areaId === areaId),
  );

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/work-orders/${workOrderId}/logs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-order-logs', workOrderId] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('woDetail.logReject')}</h2>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({
              eventType: 'reject',
              value: Number(value),
              reasonCodeId: reasonCodeId || undefined,
            });
          }}
        >
          <label>{t('woDetail.reasonCode')}</label>
          <select value={reasonCodeId} onChange={(e) => setReasonCodeId(e.target.value)}>
            <option value="">--</option>
            {rejectCodes.map((rc) => (
              <option key={rc.id} value={rc.id}>{i18nName(rc.nameI18n)}</option>
            ))}
          </select>

          <label>{t('woDetail.rejectCount')}</label>
          <input
            type="number"
            min="1"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
          />

          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="primary" disabled={!value || mutation.isPending}>
              {mutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
          {mutation.isError && <p className="error-text">{(mutation.error as Error).message}</p>}
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Downtime Dialog
   ══════════════════════════════════════════════════════════ */

function DowntimeDialog({
  workOrderId,
  areaId,
  lng,
  onClose,
}: {
  workOrderId: string;
  areaId: string;
  lng: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reasonCodeId, setReasonCodeId] = useState('');
  const [comment, setComment] = useState('');

  const { data: reasonCodes = [] } = useQuery<ReasonCode[]>({
    queryKey: ['reason-codes'],
    queryFn: () => apiFetch('/api/reason-codes'),
  });

  const downtimeCodes = reasonCodes.filter(
    (rc) => rc.category === 'downtime' && (!rc.areaId || rc.areaId === areaId),
  );

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/work-orders/${workOrderId}/logs`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['work-order-logs', workOrderId] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('woDetail.logDowntime')}</h2>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({
              eventType: 'downtime',
              reasonCodeId: reasonCodeId || undefined,
              comment: comment || undefined,
            });
          }}
        >
          <label>{t('woDetail.reasonCode')}</label>
          <select value={reasonCodeId} onChange={(e) => setReasonCodeId(e.target.value)}>
            <option value="">--</option>
            {downtimeCodes.map((rc) => (
              <option key={rc.id} value={rc.id}>{i18nName(rc.nameI18n)}</option>
            ))}
          </select>

          <label>{t('woDetail.comment')}</label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />

          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="primary" disabled={mutation.isPending}>
              {mutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
          {mutation.isError && <p className="error-text">{(mutation.error as Error).message}</p>}
        </form>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Hold Dialog
   ══════════════════════════════════════════════════════════ */

function HoldDialog({
  workOrderId,
  onClose,
}: {
  workOrderId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');

  const mutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/work-orders/${workOrderId}/hold`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-order', workOrderId] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('jobs.hold')}</h2>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ reason });
          }}
        >
          <label>{t('woDetail.holdReason')}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
          />

          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button type="submit" className="primary" disabled={!reason || mutation.isPending}>
              {mutation.isPending ? t('common.loading') : t('jobs.hold')}
            </button>
          </div>
          {mutation.isError && <p className="error-text">{(mutation.error as Error).message}</p>}
        </form>
      </div>
    </div>
  );
}
