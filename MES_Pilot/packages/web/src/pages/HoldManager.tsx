import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client.ts';
import type { QcHold } from '../types/models.ts';

export default function HoldManager() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeOnly, setActiveOnly] = useState(true);
  const [releaseHoldId, setReleaseHoldId] = useState<string | null>(null);

  const { data: holds = [], isLoading } = useQuery<QcHold[]>({
    queryKey: ['qc-holds', activeOnly],
    queryFn: () => apiFetch(`/api/qc-holds${activeOnly ? '?active=true' : ''}`),
  });

  const activeHold = holds.find((h) => h.id === releaseHoldId) || null;

  return (
    <div>
      <h1>{t('quality.holds')}</h1>

      <div className="job-center-toolbar">
        <label className="toggle-label" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          <span style={{ marginLeft: 8 }}>{t('holds.activeOnly')}</span>
        </label>
      </div>

      {isLoading && <p>{t('common.loading')}</p>}

      {!isLoading && holds.length === 0 && (
        <p style={{ color: 'var(--color-text-muted)', marginTop: 24 }}>{t('common.noData')}</p>
      )}

      {holds.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>{t('holds.workOrder')}</th>
              <th>{t('holds.holdType')}</th>
              <th>{t('holds.placedBy')}</th>
              <th>{t('holds.placedAt')}</th>
              <th>{t('holds.status')}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {holds.map((hold) => {
              const isActive = !hold.releasedAt;
              return (
                <tr key={hold.id}>
                  <td>{hold.workOrder?.orderNumber || hold.workOrderId}</td>
                  <td>{hold.holdType}</td>
                  <td>{hold.placedBy}</td>
                  <td>{new Date(hold.placedAt).toLocaleString()}</td>
                  <td>
                    {isActive ? (
                      <span className="badge badge-on-hold">{t('holds.active')}</span>
                    ) : (
                      <span className="badge badge-active">{t('holds.released')}</span>
                    )}
                  </td>
                  <td>
                    {isActive && (
                      <button className="primary" onClick={() => setReleaseHoldId(hold.id)}>
                        {t('holds.releaseHold')}
                      </button>
                    )}
                    {!isActive && hold.disposition && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                        {hold.disposition}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {activeHold && (
        <ReleaseHoldDialog
          holdId={activeHold.id}
          onClose={() => setReleaseHoldId(null)}
          onReleased={() => {
            queryClient.invalidateQueries({ queryKey: ['qc-holds'] });
            setReleaseHoldId(null);
          }}
        />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   Release Hold Dialog
   ══════════════════════════════════════════════════════════ */

function ReleaseHoldDialog({
  holdId,
  onClose,
  onReleased,
}: {
  holdId: string;
  onClose: () => void;
  onReleased: () => void;
}) {
  const { t } = useTranslation();

  const [disposition, setDisposition] = useState('release');
  const [justification, setJustification] = useState('');

  const mutation = useMutation({
    mutationFn: (body: { disposition: string; justification: string }) =>
      apiFetch(`/api/qc-holds/${holdId}/release`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      onReleased();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{t('holds.releaseHold')}</h2>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate({ disposition, justification });
          }}
        >
          <label>{t('holds.disposition')}</label>
          <div className="radio-group">
            {(['release', 'rework', 'scrap'] as const).map((val) => (
              <label key={val} className="radio-label">
                <input
                  type="radio"
                  name="disposition"
                  value={val}
                  checked={disposition === val}
                  onChange={(e) => setDisposition(e.target.value)}
                />
                <span>{t(`holds.${val}`)}</span>
              </label>
            ))}
          </div>

          <label>{t('holds.justification')}</label>
          <textarea
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={4}
            required
          />

          <div className="form-actions">
            <button type="button" onClick={onClose}>{t('common.cancel')}</button>
            <button
              type="submit"
              className="primary"
              disabled={!justification || mutation.isPending}
            >
              {mutation.isPending ? t('common.loading') : t('holds.releaseHold')}
            </button>
          </div>
          {mutation.isError && <p className="error-text">{(mutation.error as Error).message}</p>}
        </form>
      </div>
    </div>
  );
}
