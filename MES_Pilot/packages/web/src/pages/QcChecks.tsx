import { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client.ts';
import type { Area, WorkOrder, QcCheck, QcTemplateParam } from '../types/models.ts';

const CHECK_STATUS_BADGE: Record<string, string> = {
  pending: 'badge badge-draft',
  due: 'badge badge-in-progress',
  passed: 'badge badge-active',
  failed: 'badge badge-on-hold',
  skipped: 'badge badge-draft',
};

export default function QcChecks() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const lng = i18n.language;
  const [searchParams] = useSearchParams();
  const checkIdFromUrl = searchParams.get('checkId');

  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [activeCheckId, setActiveCheckId] = useState<string | null>(checkIdFromUrl);

  /* ── Fetch areas ───────────────────────────────────── */

  const { data: areas = [] } = useQuery<Area[]>({
    queryKey: ['areas'],
    queryFn: () => apiFetch('/api/areas'),
  });

  /* ── Fetch active work orders for the area ─────────── */

  const { data: workOrders = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders', selectedAreaId],
    queryFn: () => apiFetch(`/api/work-orders?areaId=${selectedAreaId}`),
    enabled: !!selectedAreaId,
  });

  const activeWos = workOrders.filter(
    (wo) => wo.status === 'started' || wo.status === 'in_progress',
  );

  /* ── Fetch QC checks per work order ────────────────── */

  const { data: checksMap = {} } = useQuery<Record<string, QcCheck[]>>({
    queryKey: ['qc-checks-by-area', selectedAreaId, activeWos.map((w) => w.id).join(',')],
    queryFn: async () => {
      const results: Record<string, QcCheck[]> = {};
      await Promise.all(
        activeWos.map(async (wo) => {
          const checks = await apiFetch<QcCheck[]>(`/api/work-orders/${wo.id}/qc-checks`);
          results[wo.id] = checks;
        }),
      );
      return results;
    },
    enabled: activeWos.length > 0,
  });

  const allChecks: (QcCheck & { _workOrder?: WorkOrder })[] = [];
  for (const wo of activeWos) {
    const checks = checksMap[wo.id] || [];
    for (const check of checks) {
      allChecks.push({ ...check, _workOrder: wo });
    }
  }

  /* ── Helpers ───────────────────────────────────────── */

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  /* ── Active check completion form ──────────────────── */

  const activeCheck = allChecks.find((c) => c.id === activeCheckId) || null;

  const handleCheckCompleted = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['qc-checks-by-area'] });
    setActiveCheckId(null);
  }, [queryClient]);

  return (
    <div>
      <h1>{t('quality.checks')}</h1>

      {/* ── Area Selector ──────────────────────────────── */}
      <div className="job-center-toolbar">
        <select
          value={selectedAreaId}
          onChange={(e) => setSelectedAreaId(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="">{t('jobCenter.selectArea')}</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>{i18nName(a.nameI18n)}</option>
          ))}
        </select>
      </div>

      {/* ── Check list ─────────────────────────────────── */}
      {selectedAreaId && allChecks.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>{t('common.noData')}</p>
      )}

      {allChecks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t('qcChecks.template')}</th>
              <th>{t('qcChecks.workOrder')}</th>
              <th>{t('qcChecks.status')}</th>
              <th>{t('qcChecks.scheduledAt')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {allChecks.map((check) => (
              <tr key={check.id}>
                <td>{i18nName(check.template?.nameI18n)}</td>
                <td>{check._workOrder?.orderNumber}</td>
                <td>
                  <span className={CHECK_STATUS_BADGE[check.status] || 'badge'}>
                    {check.status}
                  </span>
                </td>
                <td>
                  {check.scheduledAt
                    ? new Date(check.scheduledAt).toLocaleString()
                    : '—'}
                </td>
                <td>
                  {(check.status === 'pending' || check.status === 'due') && (
                    <button
                      className="primary"
                      onClick={() => setActiveCheckId(check.id)}
                    >
                      {t('qcChecks.complete')}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Check Completion Form (modal) ──────────────── */}
      {activeCheck && (
        <CompleteCheckForm
          check={activeCheck}
          lng={lng}
          onClose={() => setActiveCheckId(null)}
          onCompleted={handleCheckCompleted}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Complete Check Form
   ══════════════════════════════════════════════════════════ */

function CompleteCheckForm({
  check,
  lng,
  onClose,
  onCompleted,
}: {
  check: QcCheck;
  lng: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { t } = useTranslation();
  const params = check.template?.params || [];

  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of params) {
      initial[p.id] = p.paramType === 'boolean' ? 'false' : '';
    }
    return initial;
  });

  const [comments, setComments] = useState<Record<string, string>>({});
  const [outOfSpec, setOutOfSpec] = useState<Record<string, boolean>>({});

  const mutation = useMutation({
    mutationFn: (body: { results: Array<{ paramId: string; value: string; comment?: string }> }) =>
      apiFetch(`/api/qc-checks/${check.id}/complete`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      onCompleted();
    },
  });

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  const handleNumericBlur = (param: QcTemplateParam, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    const lower = param.lowerLimit != null ? Number(param.lowerLimit) : null;
    const upper = param.upperLimit != null ? Number(param.upperLimit) : null;
    const oos =
      (lower != null && num < lower) || (upper != null && num > upper);
    setOutOfSpec((prev) => ({ ...prev, [param.id]: oos }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const results = params.map((p) => ({
      paramId: p.id,
      value: values[p.id] ?? '',
      comment: comments[p.id] || undefined,
    }));
    mutation.mutate({ results });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-wide" onClick={(e) => e.stopPropagation()}>
        <h2>{t('qcChecks.completeCheck')}: {i18nName(check.template?.nameI18n)}</h2>
        <form className="form-stack" onSubmit={handleSubmit}>
          {params
            .slice()
            .sort((a, b) => a.sequence - b.sequence)
            .map((param) => (
              <div key={param.id} className="qc-param-row">
                <label>
                  {i18nName(param.nameI18n)}
                  {param.unit && <span className="param-unit"> ({param.unit})</span>}
                </label>

                {param.paramType === 'numeric' && (
                  <div className="qc-numeric-field">
                    {param.targetValue != null && (
                      <span className="param-target">
                        {t('qcChecks.target')}: {Number(param.targetValue)}
                        {param.lowerLimit != null && param.upperLimit != null
                          ? ` [${Number(param.lowerLimit)} - ${Number(param.upperLimit)}]`
                          : ''}
                      </span>
                    )}
                    <input
                      type="number"
                      step="any"
                      value={values[param.id] || ''}
                      onChange={(e) => setValues((prev) => ({ ...prev, [param.id]: e.target.value }))}
                      onBlur={(e) => handleNumericBlur(param, e.target.value)}
                      className={outOfSpec[param.id] ? 'input-out-of-spec' : ''}
                      required
                    />
                    {outOfSpec[param.id] && (
                      <span className="oos-warning">{t('qcChecks.outOfSpec')}</span>
                    )}
                  </div>
                )}

                {param.paramType === 'boolean' && (
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={values[param.id] === 'true'}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [param.id]: e.target.checked ? 'true' : 'false',
                        }))
                      }
                    />
                    <span>{values[param.id] === 'true' ? t('qcChecks.pass') : t('qcChecks.fail')}</span>
                  </label>
                )}

                {param.paramType === 'text' && (
                  <input
                    type="text"
                    value={values[param.id] || ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [param.id]: e.target.value }))}
                    required
                  />
                )}

                {param.paramType === 'selection' && (
                  <select
                    value={values[param.id] || ''}
                    onChange={(e) => setValues((prev) => ({ ...prev, [param.id]: e.target.value }))}
                    required
                  >
                    <option value="">--</option>
                    {(param.optionsI18n?.[lng] || param.optionsI18n?.en || []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {/* Optional comment */}
                <input
                  type="text"
                  placeholder={t('woDetail.comment')}
                  value={comments[param.id] || ''}
                  onChange={(e) => setComments((prev) => ({ ...prev, [param.id]: e.target.value }))}
                  className="param-comment-input"
                />
              </div>
            ))}

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
