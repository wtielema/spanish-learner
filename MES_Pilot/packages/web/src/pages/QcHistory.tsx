import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '../api/client.ts';
import type { QcCheck, QcTemplate } from '../types/models.ts';

const STATUS_BADGE: Record<string, string> = {
  passed: 'badge badge-active',
  failed: 'badge badge-on-hold',
};

export default function QcHistory() {
  const { t, i18n } = useTranslation();
  const lng = i18n.language;

  const [templateFilter, setTemplateFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedCheck, setSelectedCheck] = useState<QcCheck | null>(null);

  // SPC selectors
  const [spcTemplateId, setSpcTemplateId] = useState('');
  const [spcParamId, setSpcParamId] = useState('');

  const i18nName = (obj: Record<string, string> | null | undefined) =>
    obj?.[lng] || obj?.en || '';

  /* ── Fetch templates for filter dropdowns ────────────── */

  const { data: templates = [] } = useQuery<QcTemplate[]>({
    queryKey: ['qc-templates'],
    queryFn: () => apiFetch('/api/qc-templates'),
  });

  /* ── Fetch check history ─────────────────────────────── */

  const queryParams = new URLSearchParams();
  if (templateFilter) queryParams.set('templateId', templateFilter);
  if (statusFilter) queryParams.set('status', statusFilter);
  const qs = queryParams.toString();

  const { data: checks = [], isLoading } = useQuery<QcCheck[]>({
    queryKey: ['qc-checks-history', templateFilter, statusFilter],
    queryFn: () => apiFetch(`/api/qc-checks/history${qs ? `?${qs}` : ''}`),
  });

  /* ── OOS count per check ─────────────────────────────── */

  const oosCount = (check: QcCheck) =>
    (check.results || []).filter((r) => r.isInSpec === false).length;

  /* ── SPC: templates with numeric params ──────────────── */

  const spcTemplates = useMemo(
    () =>
      templates.filter(
        (tpl) => tpl.params?.some((p) => p.paramType === 'numeric'),
      ),
    [templates],
  );

  const spcParams = useMemo(() => {
    if (!spcTemplateId) return [];
    const tpl = templates.find((t) => t.id === spcTemplateId);
    return (tpl?.params || []).filter((p) => p.paramType === 'numeric');
  }, [templates, spcTemplateId]);

  const selectedParam = useMemo(
    () => spcParams.find((p) => p.id === spcParamId),
    [spcParams, spcParamId],
  );

  /* ── SPC data points ─────────────────────────────────── */

  const spcData = useMemo(() => {
    if (!spcTemplateId || !spcParamId) return [];

    // Get all checks for the selected template, sorted chronologically
    const relevantChecks = checks
      .filter((c) => c.templateId === spcTemplateId)
      .sort(
        (a, b) =>
          new Date(a.completedAt!).getTime() -
          new Date(b.completedAt!).getTime(),
      );

    return relevantChecks
      .map((c) => {
        const result = (c.results || []).find((r) => r.paramId === spcParamId);
        if (!result || result.value == null) return null;
        const numVal = parseFloat(result.value);
        if (isNaN(numVal)) return null;
        return {
          date: new Date(c.completedAt!).toLocaleDateString(),
          datetime: new Date(c.completedAt!).toLocaleString(),
          value: numVal,
          isInSpec: result.isInSpec !== false,
          workOrder: c.workOrder?.orderNumber || '',
        };
      })
      .filter(Boolean) as Array<{
      date: string;
      datetime: string;
      value: number;
      isInSpec: boolean;
      workOrder: string;
    }>;
  }, [checks, spcTemplateId, spcParamId]);

  /* ── SPC statistics ──────────────────────────────────── */

  const spcStats = useMemo(() => {
    if (spcData.length < 2) return null;
    const values = spcData.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) /
      (values.length - 1);
    const sigma = Math.sqrt(variance);
    return {
      mean,
      sigma,
      ucl: mean + 3 * sigma,
      lcl: mean - 3 * sigma,
    };
  }, [spcData]);

  /* ── SPC custom dot renderer ─────────────────────────── */

  const renderDot = (props: {
    cx?: number;
    cy?: number;
    index?: number;
    payload?: (typeof spcData)[number];
  }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={payload.isInSpec ? 'var(--status-active)' : 'var(--status-on-hold)'}
        stroke="none"
      />
    );
  };

  /* ── SPC custom tooltip ──────────────────────────────── */

  const SpcTooltip = ({
    active,
    payload: tooltipPayload,
  }: {
    active?: boolean;
    payload?: Array<{ payload: (typeof spcData)[number] }>;
  }) => {
    if (!active || !tooltipPayload?.length) return null;
    const d = tooltipPayload[0].payload;
    return (
      <div className="spc-tooltip">
        <div>
          <strong>
            {d.value} {selectedParam?.unit || ''}
          </strong>
        </div>
        <div>{d.datetime}</div>
        <div>{d.workOrder}</div>
        <div
          style={{
            color: d.isInSpec
              ? 'var(--status-active)'
              : 'var(--status-on-hold)',
          }}
        >
          {d.isInSpec ? t('qcHistory.inSpec') : t('qcHistory.outOfSpec')}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1>{t('qcHistory.title')}</h1>

      {/* ── Section A: History Table ─────────────────────── */}
      <div className="job-center-toolbar">
        <select
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
          style={{ minWidth: 220 }}
        >
          <option value="">{t('qcHistory.allTemplates')}</option>
          {templates.map((tpl) => (
            <option key={tpl.id} value={tpl.id}>
              {i18nName(tpl.nameI18n)}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 140 }}
        >
          <option value="">{t('qcHistory.allStatuses')}</option>
          <option value="passed">{t('qcHistory.passed')}</option>
          <option value="failed">{t('qcHistory.failed')}</option>
        </select>
      </div>

      {isLoading && <p>{t('common.loading')}</p>}

      {!isLoading && checks.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>
          {t('common.noData')}
        </p>
      )}

      {checks.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t('qcHistory.date')}</th>
              <th>{t('qcHistory.workOrder')}</th>
              <th>{t('qcHistory.template')}</th>
              <th>{t('qcHistory.status')}</th>
              <th>{t('qcHistory.oosCount')}</th>
            </tr>
          </thead>
          <tbody>
            {checks.map((check) => (
              <tr
                key={check.id}
                onClick={() => setSelectedCheck(check)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  {check.completedAt
                    ? new Date(check.completedAt).toLocaleString()
                    : '—'}
                </td>
                <td>{check.workOrder?.orderNumber || '—'}</td>
                <td>{i18nName(check.template?.nameI18n)}</td>
                <td>
                  <span className={STATUS_BADGE[check.status] || 'badge'}>
                    {t(`qcHistory.${check.status}`)}
                  </span>
                </td>
                <td>{oosCount(check)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Detail Modal ────────────────────────────────── */}
      {selectedCheck && (
        <div
          className="modal-overlay"
          onClick={() => setSelectedCheck(null)}
        >
          <div
            className="modal-content modal-wide"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>
              {i18nName(selectedCheck.template?.nameI18n)} —{' '}
              {selectedCheck.workOrder?.orderNumber}
            </h2>
            <table>
              <thead>
                <tr>
                  <th>{t('qcHistory.parameter')}</th>
                  <th>{t('qcHistory.value')}</th>
                  <th>{t('qcHistory.unit')}</th>
                  <th>{t('qcHistory.limits')}</th>
                  <th>{t('qcHistory.status')}</th>
                </tr>
              </thead>
              <tbody>
                {(selectedCheck.results || []).map((result) => {
                  const param =
                    result.param ||
                    selectedCheck.template?.params?.find(
                      (p) => p.id === result.paramId,
                    );
                  return (
                    <tr key={result.id}>
                      <td>{param ? i18nName(param.nameI18n) : result.paramId}</td>
                      <td>{result.value ?? '—'}</td>
                      <td>{param?.unit || '—'}</td>
                      <td>
                        {param?.lowerLimit != null && param?.upperLimit != null
                          ? `${Number(param.lowerLimit)} – ${Number(param.upperLimit)}`
                          : '—'}
                      </td>
                      <td>
                        <span
                          className={
                            result.isInSpec === false
                              ? 'badge badge-on-hold'
                              : 'badge badge-active'
                          }
                        >
                          {result.isInSpec === false
                            ? t('qcHistory.outOfSpec')
                            : t('qcHistory.inSpec')}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button onClick={() => setSelectedCheck(null)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section B: SPC Trend Chart ──────────────────── */}
      <div className="spc-section">
        <h2>{t('qcHistory.spcTitle')}</h2>

        <div className="job-center-toolbar">
          <select
            value={spcTemplateId}
            onChange={(e) => {
              setSpcTemplateId(e.target.value);
              setSpcParamId('');
            }}
            style={{ minWidth: 220 }}
          >
            <option value="">{t('qcHistory.selectTemplate')}</option>
            {spcTemplates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {i18nName(tpl.nameI18n)}
              </option>
            ))}
          </select>

          <select
            value={spcParamId}
            onChange={(e) => setSpcParamId(e.target.value)}
            style={{ minWidth: 180 }}
            disabled={!spcTemplateId}
          >
            <option value="">{t('qcHistory.selectParam')}</option>
            {spcParams.map((p) => (
              <option key={p.id} value={p.id}>
                {i18nName(p.nameI18n)}
                {p.unit ? ` (${p.unit})` : ''}
              </option>
            ))}
          </select>
        </div>

        {spcData.length > 0 && selectedParam && (
          <>
            <div className="spc-legend">
              <span className="spc-legend-item">
                <span
                  className="spc-legend-swatch"
                  style={{ background: 'var(--color-primary)' }}
                />
                {t('qcHistory.measured')}
              </span>
              {selectedParam.upperLimit != null && (
                <span className="spc-legend-item">
                  <span
                    className="spc-legend-swatch"
                    style={{ background: 'var(--status-on-hold)' }}
                  />
                  {t('qcHistory.specLimits')}
                </span>
              )}
              {spcStats && (
                <>
                  <span className="spc-legend-item">
                    <span
                      className="spc-legend-swatch"
                      style={{ background: 'var(--status-in-progress)' }}
                    />
                    {t('qcHistory.controlLimits')}
                  </span>
                  <span className="spc-legend-item">
                    <span
                      className="spc-legend-swatch"
                      style={{ background: 'var(--status-completed)' }}
                    />
                    {t('qcHistory.mean')}
                  </span>
                </>
              )}
            </div>

            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={spcData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  stroke="var(--color-text-muted)"
                  tick={{ fontSize: 12 }}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<SpcTooltip />} />

                {/* Spec limits — solid red */}
                {selectedParam.upperLimit != null && (
                  <ReferenceLine
                    y={Number(selectedParam.upperLimit)}
                    stroke="var(--status-on-hold)"
                    strokeWidth={2}
                    label={{ value: 'USL', position: 'right', fill: 'var(--status-on-hold)', fontSize: 12 }}
                  />
                )}
                {selectedParam.lowerLimit != null && (
                  <ReferenceLine
                    y={Number(selectedParam.lowerLimit)}
                    stroke="var(--status-on-hold)"
                    strokeWidth={2}
                    label={{ value: 'LSL', position: 'right', fill: 'var(--status-on-hold)', fontSize: 12 }}
                  />
                )}

                {/* Control limits — dashed amber */}
                {spcStats && (
                  <>
                    <ReferenceLine
                      y={spcStats.ucl}
                      stroke="var(--status-in-progress)"
                      strokeDasharray="6 3"
                      strokeWidth={1.5}
                      label={{ value: 'UCL', position: 'right', fill: 'var(--status-in-progress)', fontSize: 12 }}
                    />
                    <ReferenceLine
                      y={spcStats.lcl}
                      stroke="var(--status-in-progress)"
                      strokeDasharray="6 3"
                      strokeWidth={1.5}
                      label={{ value: 'LCL', position: 'right', fill: 'var(--status-in-progress)', fontSize: 12 }}
                    />
                    {/* Center line — dashed blue */}
                    <ReferenceLine
                      y={spcStats.mean}
                      stroke="var(--status-completed)"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                      label={{ value: `x̄=${spcStats.mean.toFixed(2)}`, position: 'right', fill: 'var(--status-completed)', fontSize: 12 }}
                    />
                  </>
                )}

                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={renderDot}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </>
        )}

        {spcTemplateId && spcParamId && spcData.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>
            {t('common.noData')}
          </p>
        )}
      </div>
    </div>
  );
}
