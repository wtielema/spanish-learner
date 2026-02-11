import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const en = {
  nav: {
    jobCenter: 'Job Center',
    quality: 'Quality',
    recipes: 'Recipes',
    config: 'Configuration',
    users: 'Users',
    dashboard: 'Dashboard',
    qcChecks: 'QC Checks',
    deviations: 'Deviations',
    products: 'Products',
    materials: 'Materials',
    sites: 'Sites',
    areas: 'Areas',
    workCenters: 'Work Centers',
    reasonCodes: 'Reason Codes',
    qcTemplates: 'QC Templates',
    operations: 'Operations',
    engineering: 'Engineering',
    administration: 'Administration',
  },
  auth: {
    login: 'Login',
    logout: 'Logout',
    email: 'Email',
  },
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    loading: 'Loading...',
    noData: 'No data',
  },
  jobs: {
    workOrders: 'Work Orders',
    create: 'Create Work Order',
    start: 'Start',
    complete: 'Complete',
    hold: 'Hold',
    resume: 'Resume',
  },
  quality: {
    checks: 'QC Checks',
    deviations: 'Deviations',
    holds: 'Holds',
    templates: 'QC Templates',
  },
};

const nl = {
  nav: {
    jobCenter: 'Taakcentrum',
    quality: 'Kwaliteit',
    recipes: 'Recepten',
    config: 'Configuratie',
    users: 'Gebruikers',
    dashboard: 'Dashboard',
    qcChecks: 'Kwaliteitscontroles',
    deviations: 'Afwijkingen',
    products: 'Producten',
    materials: 'Materialen',
    sites: 'Locaties',
    areas: 'Gebieden',
    workCenters: 'Werkcentra',
    reasonCodes: 'Redencodes',
    qcTemplates: 'QC Sjablonen',
    operations: 'Operaties',
    engineering: 'Engineering',
    administration: 'Administratie',
  },
  auth: {
    login: 'Inloggen',
    logout: 'Uitloggen',
    email: 'E-mail',
  },
  common: {
    save: 'Opslaan',
    cancel: 'Annuleren',
    delete: 'Verwijderen',
    edit: 'Bewerken',
    create: 'Aanmaken',
    loading: 'Laden...',
    noData: 'Geen gegevens',
  },
  jobs: {
    workOrders: 'Werkorders',
    create: 'Werkorder Aanmaken',
    start: 'Starten',
    complete: 'Voltooien',
    hold: 'Blokkeren',
    resume: 'Hervatten',
  },
  quality: {
    checks: 'Kwaliteitscontroles',
    deviations: 'Afwijkingen',
    holds: 'Blokkeringen',
    templates: 'QC Sjablonen',
  },
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    nl: { translation: nl },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
