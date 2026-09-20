import { Router } from 'express';
import { JobController } from '../controllers/jobController';

export const jobRouter = Router();

// Jobs search and detail routes
jobRouter.get('/jobs', JobController.getJobs);
jobRouter.post('/jobs/sync', JobController.triggerSync);
jobRouter.get('/jobs/:id', JobController.getJobById);

// Job sources and sync logs routes
jobRouter.get('/job-sources', JobController.getSources);
jobRouter.get('/job-sources/:id', JobController.getSourceById);
jobRouter.get('/job-sources/:id/syncs', JobController.getSourceSyncs);
