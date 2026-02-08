// js/router.js
export class Router {
  constructor(routes) {
    this.routes = routes;
    window.addEventListener('hashchange', () => this.resolve());
  }

  resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const route = this.routes[hash] || this.routes['/'];
    route();
  }

  navigate(path) {
    window.location.hash = path;
  }
}
