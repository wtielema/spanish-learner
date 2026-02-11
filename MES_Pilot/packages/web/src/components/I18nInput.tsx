import { useState } from 'react';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'nl', label: 'NL' },
  { code: 'zh', label: 'ZH' },
];

interface I18nInputProps {
  value: Record<string, string>;
  onChange: (value: Record<string, string>) => void;
  label: string;
}

export default function I18nInput({ value, onChange, label }: I18nInputProps) {
  const [activeLang, setActiveLang] = useState('en');

  return (
    <div className="i18n-input">
      <label className="form-label">{label}</label>
      <div className="i18n-tabs">
        {LANGUAGES.map((lang) => (
          <button
            key={lang.code}
            type="button"
            className={`i18n-tab ${activeLang === lang.code ? 'active' : ''}`}
            onClick={() => setActiveLang(lang.code)}
          >
            {lang.label}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={value[activeLang] ?? ''}
        onChange={(e) => onChange({ ...value, [activeLang]: e.target.value })}
        placeholder={`${label} (${activeLang.toUpperCase()})`}
        style={{ width: '100%' }}
      />
    </div>
  );
}
