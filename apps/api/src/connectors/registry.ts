import { IJobSourceConnector, IApplicationConnector } from './types';
import { MockJobSource } from './mock/mockSource';
import { ArbeitnowJobSource } from './arbeitnow/arbeitnowSource';
import { RemoteOKJobSource } from './remoteok/remoteokSource';
import { HimalayasJobSource } from './himalayas/himalayasSource';
import { pool } from '../db';
import { JobSourceConfig, SourceCapabilities } from '@ai-job-hunter/shared';
import { logger } from '../utils/logger';

export class JobSourceRegistry {
  private static instance: JobSourceRegistry;
  private connectors: Map<string, IJobSourceConnector> = new Map();

  private constructor() {
    this.register(new MockJobSource());
    this.register(new ArbeitnowJobSource());
    this.register(new RemoteOKJobSource());
    this.register(new HimalayasJobSource());
  }

  public static getInstance(): JobSourceRegistry {
    if (!JobSourceRegistry.instance) {
      JobSourceRegistry.instance = new JobSourceRegistry();
    }
    return JobSourceRegistry.instance;
  }

  public register(connector: IJobSourceConnector): void {
    this.connectors.set(connector.id, connector);
    logger.info(`Registered job source connector: [${connector.id}] ${connector.name}`);
  }

  public getConnector(id: string): IJobSourceConnector | undefined {
    return this.connectors.get(id);
  }

  public getApplicationConnector(id: string): IApplicationConnector | undefined {
    const conn = this.connectors.get(id);
    if (conn && 'canApply' in conn && typeof (conn as any).canApply === 'function') {
      return conn as unknown as IApplicationConnector;
    }
    return undefined;
  }

  public getSourceCapabilities(id: string): SourceCapabilities {
    const conn = this.connectors.get(id);
    if (conn && typeof conn.getSourceCapabilities === 'function') {
      return conn.getSourceCapabilities();
    }
    // Default conservative fallback
    return {
      jobSearch: false,
      jobDetails: false,
      apiAvailable: false,
      publicFeedAvailable: false,
      applicationUrlAvailable: true,
      automatedApplicationAllowed: false,
      browserAutomationAllowed: false,
      requiresAuthentication: false,
      requiresHumanApproval: true,
      applicationMode: 'MANUAL_ONLY',
    };
  }

  public getAllConnectors(): IJobSourceConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Return connector instances for all sources that are enabled in the PostgreSQL database.
   */
  public async getEnabledConnectors(): Promise<IJobSourceConnector[]> {
    const res = await pool.query(
      'SELECT id, enabled, automated_collection_allowed FROM job_sources WHERE enabled = true;'
    );
    const enabledIds = new Set(
      res.rows
        .filter((r) => r.enabled && r.automated_collection_allowed)
        .map((r) => r.id)
    );

    return this.getAllConnectors().filter((c) => enabledIds.has(c.id));
  }

  /**
   * Return all sources with their persistent database configs.
   */
  public async getSourceConfigs(): Promise<JobSourceConfig[]> {
    const res = await pool.query(
      `SELECT id, name, slug, enabled, api_available, public_feed_available,
              automated_collection_allowed, automated_application_allowed,
              browser_automation_allowed, application_mode, requires_human_approval,
              requires_authentication, rate_limit_delay_ms, last_sync_at, created_at, updated_at
       FROM job_sources ORDER BY name ASC;`
    );

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      enabled: row.enabled,
      apiAvailable: row.api_available,
      publicFeedAvailable: row.public_feed_available,
      automatedCollectionAllowed: row.automated_collection_allowed,
      automatedApplicationAllowed: row.automated_application_allowed,
      browserAutomationAllowed: row.browser_automation_allowed,
      applicationMode: row.application_mode,
      requiresHumanApproval: row.requires_human_approval,
      requiresAuthentication: row.requires_authentication,
      rateLimitDelayMs: row.rate_limit_delay_ms,
      lastSyncAt: row.last_sync_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

export const sourceRegistry = JobSourceRegistry.getInstance();
