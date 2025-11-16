// ============================
// Simple Client-Side Router
// ============================

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
    this.container = null;

    // Listen for navigation
    window.addEventListener('popstate', () => this.handleRoute());
    document.addEventListener('click', (e) => this.handleClick(e));
  }

  setContainer(elementId) {
    this.container = document.getElementById(elementId);
    return this;
  }

  register(path, handler) {
    this.routes.set(path, handler);
    return this;
  }

  navigate(path, data = {}) {
    if (path !== window.location.pathname) {
      window.history.pushState(data, '', path);
    }
    this.handleRoute();
  }

  async handleRoute() {
    const path = window.location.pathname;
    const handler = this.routes.get(path) || this.routes.get('*');

    if (!handler || !this.container) {
      console.warn('No route handler found for:', path);
      return;
    }

    this.currentRoute = path;

    try {
      // Handler can return HTML string or Promise
      const content = await handler();
      this.container.innerHTML = content;

      // Emit route change event for other components
      window.dispatchEvent(new CustomEvent('routechange', {
        detail: { path, data: window.history.state }
      }));
    } catch (error) {
      console.error('Route handler error:', error);
      this.container.innerHTML = `
        <div class="card">
          <h2 class="err">Error loading page</h2>
          <p>${error.message}</p>
        </div>
      `;
    }
  }

  handleClick(e) {
    // Handle clicks on <a> tags with data-route attribute
    const link = e.target.closest('[data-route]');
    if (!link) return;

    e.preventDefault();
    const path = link.getAttribute('data-route');
    const data = link.dataset.routeData ? JSON.parse(link.dataset.routeData) : {};
    this.navigate(path, data);
  }

  start() {
    this.handleRoute();
    return this;
  }
}

// Create singleton instance
window.router = new Router();

// Export for modules
export default window.router;
