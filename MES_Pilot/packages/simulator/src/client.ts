/**
 * MES API client for the plant simulator.
 * Communicates with the MES backend to report production events.
 */

export class MesClient {
  private cookie = '';

  constructor(private baseUrl: string) {}

  private async request(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.cookie) {
      headers['Cookie'] = this.cookie;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Capture set-cookie header for session management
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      // Extract the cookie name=value pair (before the first ';')
      this.cookie = setCookie.split(';')[0];
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MES API error ${res.status} ${method} ${path}: ${text}`);
    }

    return res;
  }

  /**
   * Authenticate with the MES system using an email (magic-link style or dev login).
   */
  async login(email: string): Promise<void> {
    await this.request('POST', '/api/auth/login', { email });
  }

  /**
   * Retrieve work orders for a given area.
   */
  async getWorkOrders(areaId: string): Promise<unknown[]> {
    const res = await this.request('GET', `/api/work-orders?areaId=${encodeURIComponent(areaId)}`);
    return (await res.json()) as unknown[];
  }

  /**
   * Start a work order (transition to "running" state).
   */
  async startWorkOrder(workOrderId: string): Promise<void> {
    await this.request('POST', `/api/work-orders/${encodeURIComponent(workOrderId)}/start`);
  }

  /**
   * Log a production event (good unit, reject, measurement, etc.).
   */
  async logProduction(
    workOrderId: string,
    eventType: string,
    value: number,
    reasonCodeId?: string
  ): Promise<void> {
    const body: Record<string, unknown> = {
      eventType,
      value,
    };
    if (reasonCodeId) {
      body.reasonCodeId = reasonCodeId;
    }
    await this.request(
      'POST',
      `/api/work-orders/${encodeURIComponent(workOrderId)}/production`,
      body
    );
  }

  /**
   * Complete a work order (transition to "completed" state).
   */
  async completeWorkOrder(workOrderId: string): Promise<void> {
    await this.request('POST', `/api/work-orders/${encodeURIComponent(workOrderId)}/complete`);
  }
}
