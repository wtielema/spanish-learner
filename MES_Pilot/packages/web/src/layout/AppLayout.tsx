import { Outlet, NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthContext';

export default function AppLayout() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuth();

  const changeLocale = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="header-title">MES Pilot</div>
        <div className="header-actions">
          <span className="user-name">{user?.displayName}</span>
          <div className="locale-selector">
            <button
              className={i18n.language === 'en' ? 'active' : ''}
              onClick={() => changeLocale('en')}
            >
              EN
            </button>
            <button
              className={i18n.language === 'nl' ? 'active' : ''}
              onClick={() => changeLocale('nl')}
            >
              NL
            </button>
          </div>
          <button className="logout-btn" onClick={logout}>
            {t('auth.logout')}
          </button>
        </div>
      </header>

      <aside className="app-sidebar">
        <nav>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.dashboard')}
          </NavLink>

          <div className="nav-group-label">{t('nav.operations')}</div>
          <NavLink to="/job-center" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.jobCenter')}
          </NavLink>

          <div className="nav-group-label">{t('nav.quality')}</div>
          <NavLink to="/qc-checks" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.qcChecks')}
          </NavLink>
          <NavLink to="/deviations" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.deviations')}
          </NavLink>

          <div className="nav-group-label">{t('nav.engineering')}</div>
          <NavLink to="/recipes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.recipes')}
          </NavLink>
          <NavLink to="/products" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.products')}
          </NavLink>
          <NavLink to="/materials" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.materials')}
          </NavLink>

          <div className="nav-group-label">{t('nav.config')}</div>
          <NavLink to="/sites" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.sites')}
          </NavLink>
          <NavLink to="/areas" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.areas')}
          </NavLink>
          <NavLink to="/work-centers" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.workCenters')}
          </NavLink>
          <NavLink to="/reason-codes" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.reasonCodes')}
          </NavLink>
          <NavLink to="/qc-templates" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.qcTemplates')}
          </NavLink>

          <div className="nav-group-label">{t('nav.administration')}</div>
          <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>
            {t('nav.users')}
          </NavLink>
        </nav>
      </aside>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
