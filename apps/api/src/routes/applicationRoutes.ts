import { Router } from 'express';
import { ApplicationController } from '../controllers/applicationController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/applications', ApplicationController.listApplications);
router.post('/applications', ApplicationController.createApplication);

router.get('/applications/:id', ApplicationController.getApplication);
router.put('/applications/:id', ApplicationController.updateApplication);
router.delete('/applications/:id', ApplicationController.deleteApplication);

router.patch('/applications/:id/status', ApplicationController.updateStatus);
router.patch('/applications/:id/follow-up', ApplicationController.updateFollowUp);
router.post('/applications/:id/notes', ApplicationController.addNote);
router.get('/applications/:id/timeline', ApplicationController.getTimeline);

export default router;
