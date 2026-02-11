import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { apiFetch } from '../api/client';
import Modal from '../components/Modal';
import I18nInput from '../components/I18nInput';

/* ===== Type definitions ===== */

interface RecipeParameter {
  id: string;
  nameI18n: Record<string, string>;
  paramType: string;
  value: string;
  unit: string;
  lowerLimit?: number;
  upperLimit?: number;
}

interface RecipePhase {
  id: string;
  sequence: number;
  nameI18n: Record<string, string>;
  phaseType: string;
  durationTargetMin?: number;
  instructionsI18n?: Record<string, string>;
  parameters?: RecipeParameter[];
}

interface RecipeMaterial {
  id: string;
  phaseId?: string;
  phase?: { nameI18n: Record<string, string> };
  materialId: string;
  material?: { nameI18n: Record<string, string> };
  quantityPerBatch: number;
  unit: string;
  scalingType: string;
  isCritical: boolean;
}

interface Recipe {
  id: string;
  productId: string;
  product?: { nameI18n: Record<string, string> };
  versionNumber: number;
  areaType: string;
  status: string;
  notes?: string;
  createdBy?: { displayName: string };
  approvedBy?: { displayName: string };
  phases?: RecipePhase[];
  materials?: RecipeMaterial[];
}

interface MaterialOption {
  id: string;
  nameI18n: Record<string, string>;
}

/* ===== Status helpers ===== */

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

/* ===== Lifecycle action config ===== */

interface LifecycleAction {
  label: string;
  endpoint: string;
  className: string;
}

const LIFECYCLE_ACTIONS: Record<string, LifecycleAction> = {
  draft: { label: 'Submit for Review', endpoint: 'submit', className: 'badge-completed' },
  in_review: { label: 'Approve', endpoint: 'approve', className: 'badge-in-progress' },
  approved: { label: 'Activate', endpoint: 'activate', className: 'badge-active' },
  active: { label: 'Obsolete', endpoint: 'obsolete', className: 'badge-draft' },
};

/* ===== Empty forms ===== */

const EMPTY_PHASE_FORM: {
  sequence: number;
  nameI18n: Record<string, string>;
  phaseType: string;
  durationTargetMin: string | number;
  instructionsI18n: Record<string, string>;
} = {
  sequence: 1,
  nameI18n: { en: '', nl: '', zh: '' },
  phaseType: 'processing',
  durationTargetMin: '',
  instructionsI18n: { en: '', nl: '', zh: '' },
};

const EMPTY_PARAM_FORM: {
  nameI18n: Record<string, string>;
  paramType: string;
  value: string;
  unit: string;
  lowerLimit: string;
  upperLimit: string;
} = {
  nameI18n: { en: '', nl: '', zh: '' },
  paramType: 'numeric',
  value: '',
  unit: '',
  lowerLimit: '',
  upperLimit: '',
};

const EMPTY_MATERIAL_FORM = {
  phaseId: '',
  materialId: '',
  quantityPerBatch: '',
  unit: '',
  isCritical: false,
  scalingType: 'linear',
};

const PHASE_TYPES = ['preparation', 'processing', 'cleaning', 'cooling', 'packaging', 'quality_check'];
const SCALING_TYPES = ['linear', 'fixed', 'step'];

/* ===== Component ===== */

export default function RecipeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [paramModalOpen, setParamModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [phaseForm, setPhaseForm] = useState(EMPTY_PHASE_FORM);
  const [paramForm, setParamForm] = useState(EMPTY_PARAM_FORM);
  const [materialForm, setMaterialForm] = useState(EMPTY_MATERIAL_FORM);
  const [activePhaseId, setActivePhaseId] = useState<string | null>(null);

  const lang = i18n.language;

  /* ===== Queries ===== */

  const { data: recipe, isLoading, error } = useQuery<Recipe>({
    queryKey: ['recipe', id],
    queryFn: () => apiFetch(`/api/recipes/${id}`),
    enabled: !!id,
  });

  const { data: materialOptions = [] } = useQuery<MaterialOption[]>({
    queryKey: ['materials'],
    queryFn: () => apiFetch('/api/materials'),
  });

  /* ===== Mutations ===== */

  const lifecycleMutation = useMutation({
    mutationFn: (endpoint: string) =>
      apiFetch(`/api/recipes/${id}/${endpoint}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });

  const addPhaseMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/recipes/${id}/phases`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      setPhaseModalOpen(false);
    },
  });

  const addParamMutation = useMutation({
    mutationFn: ({ phaseId, body }: { phaseId: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/recipes/phases/${phaseId}/parameters`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      setParamModalOpen(false);
    },
  });

  const addMaterialMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      apiFetch(`/api/recipes/${id}/materials`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipe', id] });
      setMaterialModalOpen(false);
    },
  });

  /* ===== Helpers ===== */

  function i18nText(obj?: Record<string, string>): string {
    if (!obj) return '';
    return obj[lang] || obj.en || '';
  }

  const isDraft = recipe?.status === 'draft';
  const lifecycleAction = recipe ? LIFECYCLE_ACTIONS[recipe.status] : undefined;

  /* ===== Form handlers ===== */

  function openAddPhase() {
    const nextSeq = (recipe?.phases?.length ?? 0) + 1;
    setPhaseForm({ ...EMPTY_PHASE_FORM, sequence: nextSeq });
    setPhaseModalOpen(true);
  }

  function handlePhaseSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      sequence: phaseForm.sequence,
      nameI18n: phaseForm.nameI18n,
      phaseType: phaseForm.phaseType,
      instructionsI18n: phaseForm.instructionsI18n,
    };
    if (phaseForm.durationTargetMin !== '') {
      body.durationTargetMin = Number(phaseForm.durationTargetMin);
    }
    addPhaseMutation.mutate(body);
  }

  function openAddParam(phaseId: string) {
    setActivePhaseId(phaseId);
    setParamForm(EMPTY_PARAM_FORM);
    setParamModalOpen(true);
  }

  function handleParamSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activePhaseId) return;
    const body: Record<string, unknown> = {
      nameI18n: paramForm.nameI18n,
      paramType: paramForm.paramType,
      value: paramForm.value,
      unit: paramForm.unit,
    };
    if (paramForm.lowerLimit !== '') body.lowerLimit = Number(paramForm.lowerLimit);
    if (paramForm.upperLimit !== '') body.upperLimit = Number(paramForm.upperLimit);
    addParamMutation.mutate({ phaseId: activePhaseId, body });
  }

  function openAddMaterial() {
    setMaterialForm(EMPTY_MATERIAL_FORM);
    setMaterialModalOpen(true);
  }

  function handleMaterialSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      materialId: materialForm.materialId,
      quantityPerBatch: Number(materialForm.quantityPerBatch),
      unit: materialForm.unit,
      isCritical: materialForm.isCritical,
      scalingType: materialForm.scalingType,
    };
    if (materialForm.phaseId) body.phaseId = materialForm.phaseId;
    addMaterialMutation.mutate(body);
  }

  /* ===== Render ===== */

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div>
        <h1>Recipe Not Found</h1>
        <p className="error-text">{error instanceof Error ? error.message : 'Recipe not found'}</p>
        <button onClick={() => navigate('/recipes')} style={{ marginTop: 16 }}>
          Back to Recipes
        </button>
      </div>
    );
  }

  const phases = [...(recipe.phases ?? [])].sort((a, b) => a.sequence - b.sequence);
  const materials = recipe.materials ?? [];

  return (
    <div>
      {/* ===== Header ===== */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => navigate('/recipes')} style={{ marginBottom: 12, fontSize: 13 }}>
          &larr; Back to Recipes
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>
            {i18nText(recipe.product?.nameI18n)} v{recipe.versionNumber}
          </h1>
          <span className={`badge ${STATUS_BADGES[recipe.status] || 'badge-draft'}`}>
            {statusLabel(recipe.status)}
          </span>
          <span className="badge">{recipe.areaType}</span>
        </div>

        {recipe.notes && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: 8 }}>{recipe.notes}</p>
        )}

        <div style={{ display: 'flex', gap: 24, marginTop: 8, color: 'var(--color-text-muted)', fontSize: 13 }}>
          {recipe.createdBy && <span>Created by: {recipe.createdBy.displayName}</span>}
          {recipe.approvedBy && <span>Approved by: {recipe.approvedBy.displayName}</span>}
        </div>

        {/* Lifecycle button */}
        {lifecycleAction && (
          <button
            className="primary"
            onClick={() => lifecycleMutation.mutate(lifecycleAction.endpoint)}
            disabled={lifecycleMutation.isPending}
            style={{ marginTop: 16 }}
          >
            {lifecycleMutation.isPending ? t('common.loading') : lifecycleAction.label}
          </button>
        )}
        {lifecycleMutation.isError && (
          <p className="error-text" style={{ marginTop: 8 }}>
            {lifecycleMutation.error instanceof Error
              ? lifecycleMutation.error.message
              : 'Action failed'}
          </p>
        )}
      </div>

      {/* ===== Phases Section ===== */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ color: '#fff', fontSize: 18 }}>Phases</h2>
          {isDraft && (
            <button className="primary" onClick={openAddPhase}>
              + Add Phase
            </button>
          )}
        </div>

        {phases.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 8 }}>
            No phases defined yet.
          </div>
        ) : (
          phases.map((phase) => (
            <div
              key={phase.id}
              style={{
                background: 'var(--color-surface)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                border: '1px solid var(--color-border)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{ color: 'var(--color-text-muted)', fontWeight: 700, fontSize: 13 }}>
                  #{phase.sequence}
                </span>
                <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>
                  {i18nText(phase.nameI18n)}
                </span>
                <span className="badge">{phase.phaseType.replace(/_/g, ' ')}</span>
                {phase.durationTargetMin != null && (
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                    {phase.durationTargetMin} min
                  </span>
                )}
              </div>

              {phase.instructionsI18n && i18nText(phase.instructionsI18n) && (
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 12 }}>
                  {i18nText(phase.instructionsI18n)}
                </p>
              )}

              {/* Parameters table */}
              {phase.parameters && phase.parameters.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <h4 style={{ color: 'var(--color-text-muted)', fontSize: 12, textTransform: 'uppercase', marginBottom: 6 }}>
                    Parameters
                  </h4>
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Value</th>
                        <th>Unit</th>
                        <th>Lower Limit</th>
                        <th>Upper Limit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {phase.parameters.map((param) => (
                        <tr key={param.id}>
                          <td>{i18nText(param.nameI18n)}</td>
                          <td><span className="badge">{param.paramType}</span></td>
                          <td>{param.value}</td>
                          <td>{param.unit || '-'}</td>
                          <td>{param.lowerLimit ?? '-'}</td>
                          <td>{param.upperLimit ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isDraft && (
                <button
                  onClick={() => openAddParam(phase.id)}
                  style={{ fontSize: 13, marginTop: 4 }}
                >
                  + Add Parameter
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* ===== Materials Section ===== */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ color: '#fff', fontSize: 18 }}>Materials</h2>
          {isDraft && (
            <button className="primary" onClick={openAddMaterial}>
              + Add Material
            </button>
          )}
        </div>

        {materials.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 8 }}>
            No materials defined yet.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Phase</th>
                <th>Qty / Batch</th>
                <th>Unit</th>
                <th>Scaling</th>
                <th>Critical</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((mat) => (
                <tr key={mat.id}>
                  <td>{i18nText(mat.material?.nameI18n) || mat.materialId}</td>
                  <td>{i18nText(mat.phase?.nameI18n) || mat.phaseId || '-'}</td>
                  <td>{mat.quantityPerBatch}</td>
                  <td>{mat.unit}</td>
                  <td>{mat.scalingType}</td>
                  <td>
                    {mat.isCritical ? (
                      <span className="badge badge-on-hold">Critical</span>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ===== Add Phase Modal ===== */}
      <Modal open={phaseModalOpen} onClose={() => setPhaseModalOpen(false)} title="Add Phase">
        <form onSubmit={handlePhaseSubmit} className="modal-form">
          <div className="form-field">
            <label className="form-label">Sequence</label>
            <input
              type="number"
              min={1}
              value={phaseForm.sequence}
              onChange={(e) => setPhaseForm({ ...phaseForm, sequence: Number(e.target.value) })}
              required
              style={{ width: '100%' }}
            />
          </div>

          <I18nInput
            label="Phase Name"
            value={phaseForm.nameI18n}
            onChange={(v) => setPhaseForm({ ...phaseForm, nameI18n: v })}
          />

          <div className="form-field">
            <label className="form-label">Phase Type</label>
            <select
              value={phaseForm.phaseType}
              onChange={(e) => setPhaseForm({ ...phaseForm, phaseType: e.target.value })}
              required
              style={{ width: '100%' }}
            >
              {PHASE_TYPES.map((pt) => (
                <option key={pt} value={pt}>
                  {pt.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Duration Target (min)</label>
            <input
              type="number"
              min={0}
              step="any"
              value={phaseForm.durationTargetMin}
              onChange={(e) => setPhaseForm({ ...phaseForm, durationTargetMin: e.target.value })}
              placeholder="Optional"
              style={{ width: '100%' }}
            />
          </div>

          <I18nInput
            label="Instructions"
            value={phaseForm.instructionsI18n}
            onChange={(v) => setPhaseForm({ ...phaseForm, instructionsI18n: v })}
          />

          <div className="modal-actions">
            <button type="button" onClick={() => setPhaseModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={addPhaseMutation.isPending}>
              {addPhaseMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ===== Add Parameter Modal ===== */}
      <Modal open={paramModalOpen} onClose={() => setParamModalOpen(false)} title="Add Parameter">
        <form onSubmit={handleParamSubmit} className="modal-form">
          <I18nInput
            label="Parameter Name"
            value={paramForm.nameI18n}
            onChange={(v) => setParamForm({ ...paramForm, nameI18n: v })}
          />

          <div className="form-field">
            <label className="form-label">Type</label>
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
            <label className="form-label">Value</label>
            <input
              type="text"
              value={paramForm.value}
              onChange={(e) => setParamForm({ ...paramForm, value: e.target.value })}
              required
              style={{ width: '100%' }}
            />
          </div>

          <div className="form-field">
            <label className="form-label">Unit</label>
            <input
              type="text"
              value={paramForm.unit}
              onChange={(e) => setParamForm({ ...paramForm, unit: e.target.value })}
              placeholder="e.g. C, rpm, bar"
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

      {/* ===== Add Material Modal ===== */}
      <Modal open={materialModalOpen} onClose={() => setMaterialModalOpen(false)} title="Add Material">
        <form onSubmit={handleMaterialSubmit} className="modal-form">
          <div className="form-field">
            <label className="form-label">Material</label>
            <select
              value={materialForm.materialId}
              onChange={(e) => setMaterialForm({ ...materialForm, materialId: e.target.value })}
              required
              style={{ width: '100%' }}
            >
              <option value="">Select material...</option>
              {materialOptions.map((m) => (
                <option key={m.id} value={m.id}>
                  {i18nText(m.nameI18n) || m.id}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label">Phase</label>
            <select
              value={materialForm.phaseId}
              onChange={(e) => setMaterialForm({ ...materialForm, phaseId: e.target.value })}
              style={{ width: '100%' }}
            >
              <option value="">No specific phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.sequence} {i18nText(p.nameI18n)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Quantity per Batch</label>
              <input
                type="number"
                step="any"
                min={0}
                value={materialForm.quantityPerBatch}
                onChange={(e) => setMaterialForm({ ...materialForm, quantityPerBatch: e.target.value })}
                required
                style={{ width: '100%' }}
              />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label className="form-label">Unit</label>
              <input
                type="text"
                value={materialForm.unit}
                onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                placeholder="e.g. kg, L"
                required
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div className="form-field">
            <label className="form-label">Scaling Type</label>
            <select
              value={materialForm.scalingType}
              onChange={(e) => setMaterialForm({ ...materialForm, scalingType: e.target.value })}
              required
              style={{ width: '100%' }}
            >
              {SCALING_TYPES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={materialForm.isCritical}
                onChange={(e) => setMaterialForm({ ...materialForm, isCritical: e.target.checked })}
                style={{ width: 'auto' }}
              />
              Critical material
            </label>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={() => setMaterialModalOpen(false)}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary" disabled={addMaterialMutation.isPending}>
              {addMaterialMutation.isPending ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
