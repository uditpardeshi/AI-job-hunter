import { Queue, Worker, Job as BullJob } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';
import { pool } from '../db';
import { sourceRegistry } from '../connectors/registry';
import { JobCollector } from '../services/jobCollector';
import { MatchingService } from '../services/matching/matchingService';
import { AutomationService } from '../services/automationService';
import { ApplicationService } from '../services/applicationService';
import { ApplicationPreparationService } from '../services/applicationPreparationService';

// Redis connection for BullMQ
export const getQueueRedisConnection = () => {
  return new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
};

export class QueueManager {
  private static redisConn = getQueueRedisConnection();

  public static discoveryQueue = new Queue('job-discovery', { connection: this.redisConn });
  public static processingQueue = new Queue('job-processing', { connection: this.redisConn });
  public static matchingQueue = new Queue('matching', { connection: this.redisConn });
  public static materialQueue = new Queue('material-generation', { connection: this.redisConn });
  public static preparationQueue = new Queue('application-preparation', { connection: this.redisConn });
  public static submissionQueue = new Queue('application-submission', { connection: this.redisConn });

  private static workers: Worker[] = [];

  /**
   * Initialize all queue workers
   */
  public static initWorkers(): void {
    logger.info('Initializing BullMQ automation workers...');

    // 1. Discovery Worker
    const discoveryWorker = new Worker(
      'job-discovery',
      async (job: BullJob) => {
        const { userId, runId, source } = job.data;
        logger.info(`[DiscoveryWorker] Starting discovery run ${runId} for user ${userId}, source=${source || 'all'}`);
        return await QueueManager.executePipeline(userId, runId, source);
      },
      { connection: getQueueRedisConnection(), concurrency: 2 }
    );

    discoveryWorker.on('failed', (job, err) => {
      logger.error(`[DiscoveryWorker] Job ${job?.id} failed:`, err.message);
    });

    this.workers.push(discoveryWorker);
  }

  /**
   * Close all queues and workers cleanly
   */
  public static async closeAll(): Promise<void> {
    for (const worker of this.workers) {
      await worker.close();
    }
    await this.discoveryQueue.close();
    await this.processingQueue.close();
    await this.matchingQueue.close();
    await this.materialQueue.close();
    await this.preparationQueue.close();
    await this.submissionQueue.close();
    await this.redisConn.quit();
  }

  /**
   * Trigger an automation run either asynchronously via queue or directly
   */
  public static async triggerRun(
    userId: string,
    source?: string
  ): Promise<{ runId: string; status: string; message: string }> {
    const settings = await AutomationService.getSettings(userId);
    if (settings.killSwitchActive) {
      throw new Error('Cannot start automation: Emergency Kill Switch is active');
    }

    const run = await AutomationService.startAutomationRun(userId, 'JOB_DISCOVERY', { source });

    // Enqueue to discovery worker
    try {
      await this.discoveryQueue.add(
        'discover',
        { userId, runId: run.id, source },
        { removeOnComplete: 100, removeOnFail: 200 }
      );
      return {
        runId: run.id,
        status: 'QUEUED',
        message: 'Automation pipeline queued successfully',
      };
    } catch (err: any) {
      // Fallback: If Redis queue fails, run inline in background
      logger.warn(`Failed to enqueue in BullMQ, running directly: ${err.message}`);
      this.executePipeline(userId, run.id, source).catch((e) => {
        logger.error('Background direct pipeline execution failed:', e);
      });
      return {
        runId: run.id,
        status: 'RUNNING',
        message: 'Automation pipeline started directly',
      };
    }
  }

  /**
   * Complete End-to-End Pipeline Execution:
   * Discovery -> Deduplication -> AI Matching -> Search Profiles Evaluation ->
   * Shortlisting -> Materials Generation -> Application Preparation -> Approval Queue
   */
  public static async executePipeline(
    userId: string,
    runId: string,
    targetSource?: string
  ): Promise<{
    processed: number;
    succeeded: number;
    failed: number;
    shortlisted: number;
  }> {
    const settings = await AutomationService.getSettings(userId);
    if (settings.killSwitchActive) {
      logger.warn(`Pipeline run ${runId} aborted: Kill switch is active`);
      await AutomationService.updateAutomationRun(runId, {
        status: 'CANCELLED',
        errorSummary: 'Emergency Kill Switch is active',
      });
      return { processed: 0, succeeded: 0, failed: 0, shortlisted: 0 };
    }

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let shortlisted = 0;

    try {
      await AutomationService.updateAutomationRun(runId, { status: 'RUNNING' });

      // Step 1: Collect / Sync Jobs
      logger.info(`[Pipeline ${runId}] Step 1: Discovering jobs...`);
      const collector = new JobCollector();
      const syncResults = await collector.sync(targetSource);

      for (const res of syncResults) {
        processed += res.jobsFound;
        succeeded += res.jobsCreated + res.jobsUpdated;
      }

      await AutomationService.logAutomationEvent({
        automationRunId: runId,
        userId,
        eventType: 'JOB_DISCOVERED',
        status: 'SUCCESS',
        message: `Discovered ${processed} jobs (${succeeded} new/updated) from sources: ${syncResults.map((s) => s.sourceId).join(', ') || targetSource || 'all'}`,
        metadata: { syncResults },
      });

      // Step 2: Get Candidate Profile
      const profileRes = await pool.query(
        `SELECT * FROM candidate_profiles WHERE user_id = $1`,
        [userId]
      );
      const candidateRow = profileRes.rows[0];

      if (!candidateRow) {
        logger.warn(`[Pipeline ${runId}] No candidate profile found for user ${userId}. Skipping matching & preparation.`);
        await AutomationService.updateAutomationRun(runId, {
          status: 'COMPLETED',
          itemsProcessed: processed,
          itemsSucceeded: succeeded,
          itemsFailed: failed,
        });
        return { processed, succeeded, failed, shortlisted };
      }

      const candidateProfile: any = {
        id: candidateRow.id,
        userId: candidateRow.user_id,
        basics: {
          ...candidateRow.basics,
          summary: candidateRow.summary || candidateRow.basics?.summary || null,
        },
        skills: candidateRow.skills || [],
        experience: candidateRow.experience || [],
        education: candidateRow.education || [],
        projects: candidateRow.projects || [],
        certifications: candidateRow.certifications || [],
        achievements: candidateRow.achievements || [],
        preferences: candidateRow.preferences || {},
        verificationStatus: candidateRow.verification_status,
        createdAt: candidateRow.created_at,
        updatedAt: candidateRow.updated_at,
      };

      // Step 3: Get Active Search Profiles
      const searchProfiles = await AutomationService.listSearchProfiles(userId);

      // Step 4: Fetch recent active jobs for matching
      let jobsToMatchQuery = `
        SELECT j.* FROM jobs j
        WHERE j.status = 'active'
      `;
      const params: any[] = [];
      if (targetSource) {
        params.push(targetSource);
        jobsToMatchQuery += ` AND j.source_id = $${params.length}`;
      }
      jobsToMatchQuery += ` ORDER BY j.created_at DESC LIMIT 30`;

      const jobsRes = await pool.query(jobsToMatchQuery, params);
      const jobs = jobsRes.rows;

      logger.info(`[Pipeline ${runId}] Step 2: Matching ${jobs.length} jobs against candidate profile...`);

      for (const job of jobs) {
        try {
          // AI Matching
          const matchResult = await MatchingService.matchCandidateWithJob(candidateProfile, job.id);

          await AutomationService.logAutomationEvent({
            automationRunId: runId,
            userId,
            candidateId: candidateProfile.id,
            jobId: job.id,
            eventType: 'JOB_MATCHED',
            status: 'SUCCESS',
            message: `Matched "${job.title}" at ${job.company}: ${matchResult.matchScore}% overall score`,
            metadata: { matchScore: matchResult.matchScore, explanation: matchResult.explanation },
          });

          // Step 5: Evaluate against search profiles & settings
          if (settings.autoShortlistingEnabled) {
            const evalResult = AutomationService.evaluateJobAgainstProfiles(
              job,
              matchResult.matchScore,
              searchProfiles
            );

            if (evalResult.shouldShortlist) {
              // Check if an application already exists
              const existingAppRes = await pool.query(
                `SELECT id, status FROM applications WHERE user_id = $1 AND job_id = $2`,
                [userId, job.id]
              );

              let appId: string;
              if (existingAppRes.rows.length === 0) {
                // Create application shortlisted
                const newApp = await ApplicationService.createApplication(userId, {
                  jobId: job.id,
                  status: 'SHORTLISTED',
                  notes: `Auto-shortlisted by AI Job Hunter. Reasons: ${evalResult.reasons.join('; ')}`,
                });
                appId = newApp.id;
                shortlisted++;

                await AutomationService.logAutomationEvent({
                  automationRunId: runId,
                  userId,
                  candidateId: candidateProfile.id,
                  jobId: job.id,
                  applicationId: appId,
                  eventType: 'JOB_SHORTLISTED',
                  status: 'SUCCESS',
                  message: `Auto-shortlisted: ${job.title} at ${job.company} (${evalResult.reasons[0] || 'High match'})`,
                  metadata: { reasons: evalResult.reasons, matchScore: matchResult.matchScore },
                });
              } else {
                appId = existingAppRes.rows[0].id;
              }

              // Step 6: Prepare Application Package
              logger.info(`[Pipeline ${runId}] Preparing application package for app ${appId}...`);
              await ApplicationPreparationService.prepareApplication({
                userId,
                jobId: job.id,
                applicationId: appId,
                automationRunId: runId,
              });
            } else {
              await AutomationService.logAutomationEvent({
                automationRunId: runId,
                userId,
                candidateId: candidateProfile.id,
                jobId: job.id,
                eventType: 'JOB_EXCLUDED',
                status: 'INFO',
                message: `Skipped "${job.title}": ${evalResult.reasons.join(', ')}`,
                metadata: { matchScore: matchResult.matchScore },
              });
            }
          }
        } catch (jobErr: any) {
          logger.warn(`Error processing job ${job.id} in pipeline: ${jobErr.message}`);
          failed++;
        }
      }

      await AutomationService.updateAutomationRun(runId, {
        status: 'COMPLETED',
        itemsProcessed: processed,
        itemsSucceeded: succeeded,
        itemsFailed: failed,
        metadata: { jobsEvaluated: jobs.length, shortlistedCount: shortlisted },
      });

      logger.info(
        `[Pipeline ${runId}] Completed: ${processed} discovered, ${shortlisted} shortlisted, ${failed} failed.`
      );

      return { processed, succeeded, failed, shortlisted };
    } catch (err: any) {
      logger.error(`[Pipeline ${runId}] Execution error:`, err.message);
      await AutomationService.updateAutomationRun(runId, {
        status: 'FAILED',
        errorSummary: err.message,
      });
      throw err;
    }
  }
}
