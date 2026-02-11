import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import DataTable from '../components/DataTable';
import type { Column } from '../components/DataTable';
import Modal from '../components/Modal';
import I18nInput from '../components/I18nInput';

interface QcParam {
  id: string;
  nameI18n: Record<string, string>;
  paramType: string;
  unit?: string;
  lowerLimit?: number;
  upperLimit?: number;
  expectedValue?: string;
}

interface QcTemplate {
  id: string;
  nameI18n: Record<string, string>;
  trigger: string;
  triggerValue?: string;
  areaId?: string;
  isMandatory: boolean;
  params?: QcParam[];
}

interface WorkCenter {
  id: string;
  nameI18n: Record<string, string>;
}

const EMPTY_FORM: { nameI18n: Record<string, string>; trigger: string; triggerValue: string; areaId: string; isMandatory: boolean } = {
  nameI18n: { en: '', nl: '', zh: '' },
  trigger: 'phase_start',
  triggerValue: '',
  areaId: '',
  isMandatory: false,
};

const EMPTY_PARAM_FORM: { nameI18n: Record<string, string>; paramType: string; unit: string; lowerLimit: string; upperLimit: string; expectedValue: string } = {
  nameI18n: { en: '', nl: '', zh: '' },
  paramType: 'numeric',
  unit: '',
  lowerLimit: '',
  upperLimit: '',
  expectedValue: '',
};

const TRIGGER_TYPES = ['phase_start', 'phase_end', 'batch_start', 'batch_end', 'time_interval', 'manual'];

export default function QcTemplateList() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [paramForm, setParamForm] = useState(EMPTY_PARAM_FORM);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [selectedWorkCenters, setSelectedWorkCenters] = useState<string[]>([]);

  const { data: templates = [], isLoading } = useQuery<QcTemplate[]>({
    queryKey: ['qc-templates'],
    queryFn: () => apiFetch('/api/qc-templates'),
  });

  const { data: workCenters = [] } = useQuery<WorkCenter[]>({
    queryKey: ['work-centers'],
    queryFn: () => apiFetch('/api/work-centers'),
  });

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      apiFetch('/api/qc-templates', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-templates'] });
      closeModal();
    },
  });

  const addParamMutation = useMutation({
    mutationFn: ({ templateId, body }: { templateId: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/qc-templates/${templateId}/params`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-templates'] });
      setParamModalOpen(false);
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ templateId, workCenterIds }: { templateId: string; workCenterIds: string[] }) =>
      apiFetch(`/api/qc-templates/${templateId}/assign`, {
        method: 'POST',
        body: JSON.stringify({ workCenterIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-templates'] });
      setAssignModalOpen(false);
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

  function openAddParam(templateId: string) {
    setActiveTemplateId(templateId);
    setParamForm(EMPTY_PARAM_FORM);
    setParamModalOpen(true);
  }

  function handleParamSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTemplateId) return;
    const body: Record<string, unknown> = {
      nameI18n: paramForm.nameI18n,
      paramType: paramForm.paramType,
      unit: paramForm.unit || undefined,
      expectedValue: paramForm.expectedValue || undefined,
    };
    if (paramForm.lowerLimit !== '') body.lowerLimit = Number(paramForm.lowerLimit);
    if (paramForm.upperLimit !== '') body.upperLimit = Number(paramForm.upperLimit);
    addParamMutation.mutate({ templateId: activeTemplateId, body });
  }

  function openAssign(templateId: string) {
    setActiveTemplateId(templateId);
    setSelectedWorkCenters([]);
    setAssignModalOpen(true);
  }

  function handleAssignSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTemplateId) return;
    assignMutation.mutate({ templateId: activeTemplateId, workCenterIds: selectedWorkCenters });
  }

  function toggleWorkCenter(wcId: string) {
    setSelectedWorkCenters((prev) =>
      prev.includes(wcId) ? prev.filter((id) => id !== wcId) : [...prev, wcId]
    );
  }

  function triggerLabel(trigger: string): string {
    return trigger.replace(/_/g, ' ');
  }

  const columns: Column<QcTemplate>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (tpl) => tpl.nameI18n[i18n.language] || tpl.nameI18n.en || '',
    },
    {
      key: 'trigger',
      header: 'Trigger Type',
      render: (tpl) => <span className="badge">{triggerLabel(tpl.trigger)}</span>,
    },
    {
      key: 'triggerValue',
      header: 'Trigger Value',
      render: (tpl) => tpl.triggerValue || '-',
    },
    {
      key: 'areaId',
      header: 'Area',
      render: (tpl) => tpl.areaId || '-',
    },
    {
      key: 'isMandatory',
      header: 'Mandatory',
      render: (tpl) => (
        <span className={`badge ${tpl.isMandatory ? 'badge-on-hold' : 'badge-draft'}`}>
          {tpl.isMandatory ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (tpl) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpandedId(expandedId === tpl.id ? null : tpl.id);
            }}
          >
            {expandedId === tpl.id ? 'Collapse' : 'Expand'}
          </button>
          <button onClick={(e) => { e.stopPropagation(); openAddParam(tpl.id); }}>
            + Param
          </button>
          <button onClick={(e) => { e.stopPropagation(); openAssign(tpl.id); }}>
            Assign WC
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>{t('nav.qcTemplates')}</h1>
        <button className="primary" onClick={openCreate}>
          {t('common.create')} Template
        </button>
      </div>

      <DataTable columns={columns} data={templates} loading={isLoading} />

      {/* Expanded params for selected template */}
      {expandedId && (() => {
        const tpl = templates.find((t) => t.id === expandedId);
        if (!tpl?.params?.length) return (
          <div style={{ padding: 16, background: 'var(--color-surface)', borderRadius: 8, marginTop: 8, color: 'var(--color-text-muted)' }}>
            No parameters defined for this template.
          </div>
        );
        return (
          <div style={{ padding: 16, background: 'var(--color-surface)', borderRadius: 8, marginTop: 8 }}>
            <h3 style={{ marginBottom: 8, color: '#fff' }}>
              Parameters: {tpl.nameI18n[i18n.language] || tpl.nameI18n.en}
            </h3>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Unit</th>
                  <th>Lower Limit</th>
                  <th>Upper Limit</th>
                  <th>Expected</th>
                </tr>
              </thead>
              <tbody>
                {tpl.params.map((p) => (
                  <tr key={p.id}>
                    <td>{p.nameI18n[i18n.language] || p.nameI18n.en || ''}</td>
                    <td><span className="badge">{p.paramType}</span></td>
                    <td>{p.unit || '-'}</td>
                    <td>{p.lowerLimit ?? '-'}</td>
                    <td>{p.upperLimit ?? '-'}</td>
                    <td>{p.expectedValue || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* Create Template Modal */}
      <Modal open={modalOpen} onClose={closeModal} title="Create QC Template">
        <form onSubmit={handleSubmit} className="modal-form">
          <I18nInput
            label="Name"
            value={form.nameI18n}
            onChange={(v) => setForm({ ...form, nameI18n: v })}
          />

          <div className="form-field">
            <label className="form-label">Trigger Type</label>
            <select
              value={form.trigger}
              onChange={(e) => setForm({ ...form, trigger: e.target.value })}
              required
              style={{ width: '100%' }}
            >
              {TRIGGER_TYPES.map((tr) => (
                <option key={tr} value={tr}>
                  {triggerLabel(tr)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Trigger Value</label>
            <input
              type="text"
              value={form.triggerValue}
              onChange={(e) => setForm({ ...form, triggerValue: e.target.value })}
              placeholder="Optional"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Area ID</label>
            <input
              type="text"
              value={form.areaId}
              onChange={(e) => setForm({ ...form, areaId: e.target.value })}
              placeholder="Optional"
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.isMandatory}
                onChange={(e) => setForm({ ...form, isMandatory: e.target.checked })}
                style={{ width: 'auto' }}
              />
              Mandatory
            </label>
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

      {/* Add Parameter Modal */}
      <Modal
        open={paramModalOpen}
        onClose={() => setParamModalOpen(false)}
        title="Add QC Parameter"
      >
        <form onSubmit={handleParamSubmit} className="modal-form">
          <I18nInput
            label="Parameter Name"
            value={paramForm.nameI18n}
            onChange={(v) => setParamForm({ ...paramForm, nameI18n: v })}
          />

          <div className="form-field">
            <label className="form-label">Parameter Type</label>
            <select
              value={paramForm.paramType}
              onChange={(e) => setParamForm({ ...paramForm, paramType: e.target.value })}
              required
              style={{ width: '100%' }}
            >
              <option value="numeric">Numeric</option>
              <option value="boolean">Boolean</option>
              <option value="text">Text</option>
              <option value="select">Select</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Unit</label>
            <input
              type="text"
              value={paramForm.unit}
              onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })}
              placeholder="e.g. pH, mg/L"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Lower Limit</label>
              <input
                type="number"
                step="any"
                value={paramForm.lowerLimit}
                onChange={(e) => setParamForm({ ...paramForm, lowerLimit: e.target.value })}
                placeholder="Optional"
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Upper Limit</label>
              <input
                type="number"
                step="any"
                value={paramForm.upperLimit}
                onChange={(e) => setParamForm({ ...paramForm, upperLimit: e.target.value })}
                placeholder="Optional"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Expected Value</label>
            <input
              type="text"
              value={paramForm.expectedValue}
              onChange={(e) => setParamForm({ ...paramForm, expectedValue: e.target.value })}
              placeholder="Optional"
              style={{ width: '100%' }}
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={() => setParamModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={addParamMutation.isPending}>
              {addParamMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign Work Centers Modal */}
      <Modal
        open={assignModalOpen}
        onClose={() => setAssignModalOpen(false)}
        title="Assign Work Centers"
      >
        <form onSubmit={handleAssignSubmit} className="modal-form">
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {workCenters.map((wc) => (
              <label
                key={wc.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={selectedWorkCenters.includes(wc.id)}
                  onChange={() => toggleWorkCenter(wc.id)}
                  style={{ width: 'auto' }}
                />
                {wc.nameI18n[i18n.language] || wc.nameI18n.en || wc.id}
              </label>
            ))}
            {workCenters.length === 0 && (
              <div style={{ color: 'var(--color-text-muted)', padding: 16 }}>
                No work centers available.
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="button" onClick={() => setAssignModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={assignMutation.isPending}>
              {assignMutation.isPending ? t('common.loading') : 'Assign'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
