/**
 * Real Exness status & on-demand account snapshot store (NO fake/simulated numbers).
 * Every figure stays null ("BELUM DIAMBIL") until retrieved from /api/exness/*.
 */
export class ExnessMarketFeed {
  public demoConfigured = false;
  public realConfigured = false;
  public demoBalance: number | null = null;
  public demoCurrency: string | null = null;
  public realBalance: number | null = null;
  public realCurrency: string | null = null;

  public async refreshStatus(): Promise<void> {
    try {
      const resp = await fetch('/api/exness/status');
      if (!resp.ok) return;
      const data = await resp.json();
      this.demoConfigured = Boolean(data?.demo?.configured);
      this.realConfigured = Boolean(data?.real?.configured);
    } catch {
      // ignore offline
    }
  }

  public setRetrievedAccount(profile: 'demo' | 'real', balance: number | null, currency: string | null) {
    if (profile === 'demo') {
      this.demoBalance = balance;
      this.demoCurrency = currency;
    } else {
      this.realBalance = balance;
      this.realCurrency = currency;
    }
  }
}
