import { pool } from '../db';
import {
  DashboardData,
  DashboardStats,
  DashboardAnalytics,
  ApplicationStatus,
  Application,
  Job,
} from '@ai-job-hunter/shared';
import { ApplicationService } from './applicationService';

export class DashboardService {
  /**
   * Aggregate all dashboard metrics, recent activity, upcoming follow-ups, and analytics.
   */
  public static async getDashboardData(userId: string): Promise<DashboardData> {
    // 1. Total jobs found
    const jobsCountRes = await pool.query(
      `SELECT COUNT(*)::int AS total FROM jobs WHERE status = 'active';`
    );
    const jobsFound = jobsCountRes.rows[0]?.total || 0;

    // 2. Application counts by status
    const statusCountsRes = await pool.query(
      `
      SELECT status, COUNT(*)::int AS count
      FROM applications
      WHERE user_id = $1
      GROUP BY status;
      `,
      [userId]
    );

    const countsMap: Record<string, number> = {};
    for (const r of statusCountsRes.rows) {
      countsMap[r.status] = Number(r.count);
    }

    const stats: DashboardStats = {
      jobsFound,
      saved: countsMap['SAVED'] || 0,
      shortlisted: countsMap['SHORTLISTED'] || 0,
      ready: countsMap['READY'] || 0,
      applied: countsMap['APPLIED'] || 0,
      interviews: countsMap['INTERVIEW'] || 0,
      offers: countsMap['OFFER'] || 0,
      rejected: countsMap['REJECTED'] || 0,
      withdrawn: countsMap['WITHDRAWN'] || 0,
    };

    // 3. Recent applications (Top 5 updated)
    const recentAppsData = await ApplicationService.listApplications(userId, {
      page: 1,
      limit: 5,
      sortBy: 'last_updated_at',
      sortOrder: 'DESC',
    });
    const recentApplications = recentAppsData.applications;

    // 4. Upcoming follow-ups
    const followUpsRes = await pool.query(
      `
      SELECT 
        a.*,
        j.title AS job_title,
        j.company AS job_company,
        j.location AS job_location,
        j.remote_type AS job_remote_type,
        j.employment_type AS job_employment_type,
        j.source_id AS job_source_id,
        j.status AS job_status,
        jm.match_score
      FROM applications a
      JOIN jobs j ON a.job_id = j.id
      LEFT JOIN candidate_profiles cp ON a.user_id = cp.user_id
      LEFT JOIN job_matches jm ON jm.job_id = a.job_id AND jm.candidate_id = cp.id
      WHERE a.user_id = $1 
        AND a.next_follow_up_at IS NOT NULL
        AND a.next_follow_up_at >= NOW() - INTERVAL '1 day'
      ORDER BY a.next_follow_up_at ASC
      LIMIT 5;
      `,
      [userId]
    );

    const upcomingFollowUps: Application[] = followUpsRes.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      candidateId: row.candidate_id,
      jobId: row.job_id,
      status: row.status,
      savedAt: row.saved_at?.toISOString() || row.saved_at,
      shortlistedAt: row.shortlisted_at?.toISOString() || row.shortlisted_at,
      readyAt: row.ready_at?.toISOString() || row.ready_at,
      appliedAt: row.applied_at?.toISOString() || row.applied_at,
      interviewAt: row.interview_at?.toISOString() || row.interview_at,
      offerAt: row.offer_at?.toISOString() || row.offer_at,
      rejectedAt: row.rejected_at?.toISOString() || row.rejected_at,
      withdrawnAt: row.withdrawn_at?.toISOString() || row.withdrawn_at,
      lastUpdatedAt: row.last_updated_at?.toISOString() || row.last_updated_at,
      nextFollowUpAt: row.next_follow_up_at?.toISOString() || row.next_follow_up_at,
      externalApplicationUrl: row.external_application_url,
      resumeId: row.resume_id,
      tailoredResumeId: row.tailored_resume_id,
      coverLetterId: row.cover_letter_id,
      notes: row.notes,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
      job: {
        id: row.job_id,
        sourceId: row.job_source_id,
        sourceJobId: '',
        title: row.job_title,
        company: row.job_company,
        location: row.job_location,
        remoteType: row.job_remote_type,
        employmentType: row.job_employment_type,
        description: '',
        skills: [],
        status: row.job_status,
        firstSeenAt: '',
        lastSeenAt: '',
        createdAt: '',
        updatedAt: '',
      },
      match:
        row.match_score !== null
          ? ({
              jobId: row.job_id,
              candidateId: '',
              matchScore: Number(row.match_score),
              components: {} as any,
              matchedSkills: [],
              missingRequiredSkills: [],
              missingPreferredSkills: [],
              strengths: [],
              concerns: [],
              explanation: '',
              modelVersion: '',
              scoringVersion: '',
            } as any)
          : null,
    }));

    // 5. Recent jobs with match score & application status
    const recentJobsRes = await pool.query(
      `
      SELECT 
        j.*,
        jm.match_score,
        a.status AS app_status
      FROM jobs j
      LEFT JOIN candidate_profiles cp ON cp.user_id = $1
      LEFT JOIN job_matches jm ON jm.job_id = j.id AND jm.candidate_id = cp.id
      LEFT JOIN applications a ON a.job_id = j.id AND a.user_id = $1 AND a.status != 'WITHDRAWN'
      WHERE j.status = 'active'
      ORDER BY j.created_at DESC
      LIMIT 6;
      `,
      [userId]
    );

    const recentJobs = recentJobsRes.rows.map((row) => ({
      id: row.id,
      sourceId: row.source_id,
      sourceJobId: row.source_job_id,
      title: row.title,
      company: row.company,
      location: row.location,
      remoteType: row.remote_type,
      employmentType: row.employment_type,
      description: row.description,
      skills: row.skills || [],
      jobUrl: row.job_url,
      status: row.status,
      firstSeenAt: row.first_seen_at?.toISOString() || row.first_seen_at,
      lastSeenAt: row.last_seen_at?.toISOString() || row.last_seen_at,
      createdAt: row.created_at?.toISOString() || row.created_at,
      updatedAt: row.updated_at?.toISOString() || row.updated_at,
      matchScore: row.match_score !== null ? Number(row.match_score) : null,
      applicationStatus: (row.app_status as ApplicationStatus) || null,
    }));

    // 6. Analytics: Applications by status
    const applicationsByStatus: { status: ApplicationStatus; count: number }[] = [
      { status: 'SAVED', count: stats.saved },
      { status: 'SHORTLISTED', count: stats.shortlisted },
      { status: 'READY', count: stats.ready },
      { status: 'APPLIED', count: stats.applied },
      { status: 'INTERVIEW', count: stats.interviews },
      { status: 'OFFER', count: stats.offers },
      { status: 'REJECTED', count: stats.rejected },
      { status: 'WITHDRAWN', count: stats.withdrawn },
    ];

    // Applications over time (last 14 days)
    const overTimeRes = await pool.query(
      `
      SELECT TO_CHAR(created_at, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
      FROM applications
      WHERE user_id = $1 AND created_at >= NOW() - INTERVAL '14 days'
      GROUP BY day
      ORDER BY day ASC;
      `,
      [userId]
    );

    const applicationsOverTime = overTimeRes.rows.map((r) => ({
      date: r.day,
      count: Number(r.count),
    }));

    const interviewCount = stats.interviews;
    const offerCount = stats.offers;
    const totalTracked =
      stats.saved +
      stats.shortlisted +
      stats.ready +
      stats.applied +
      stats.interviews +
      stats.offers +
      stats.rejected +
      stats.withdrawn;
    const appliedCount = stats.applied + stats.interviews + stats.offers + stats.rejected;
    const interviewRate =
      appliedCount > 0 ? Math.round(((stats.interviews + stats.offers) / appliedCount) * 100) : 0;
    const offerRate =
      appliedCount > 0 ? Math.round((stats.offers / appliedCount) * 100) : 0;

    const analytics: DashboardAnalytics = {
      applicationsOverTime,
      applicationsByStatus,
      totalTracked,
      interviewCount,
      offerCount,
      interviewRate,
      offerRate,
    };

    return {
      stats,
      recentApplications,
      upcomingFollowUps,
      recentJobs,
      analytics,
    };
  }
}
