export class Router {
  constructor(routes) {
    this.routes = routes;
    window.addEventListener('hashchange', () => this.resolve());
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0];
    const route = this.routes[path] || this.routes['/'];
    try {
      const result = route();
      if (result && typeof result.catch === 'function') {
        result.catch(e => {
          document.getElementById('app').innerHTML = `<div style="padding:20px;color:#e94560;"><h2>Error</h2><pre>${e.message}</pre><button class="btn-primary" onclick="location.hash='/'">Back</button></div>`;
        });
      }
    } catch (e) {
      console.error('Route error:', e);
    }
  }

  navigate(path) {
    const currentHash = window.location.hash;
    window.location.hash = path;
    if (currentHash === '#' + path) {
      this.resolve();
    }
  }
}
