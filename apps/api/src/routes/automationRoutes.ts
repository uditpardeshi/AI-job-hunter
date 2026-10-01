import { Router } from 'express';
import { AutomationController } from '../controllers/automationController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

// Settings & Controls
router.get('/settings', AutomationController.getSettings);
router.put('/settings', AutomationController.updateSettings);
router.post('/kill-switch', AutomationController.triggerKillSwitch);
router.post('/resume', AutomationController.resumeKillSwitch);
router.get('/summary', AutomationController.getSummary);

// Runs & Pipeline execution
router.post('/run', AutomationController.triggerRun);
router.get('/runs', AutomationController.listRuns);
router.get('/history', AutomationController.listRuns);
router.get('/runs/:id', AutomationController.getRun);
router.get('/events', AutomationController.listEvents);

// Search Profiles
router.get('/profiles', AutomationController.listProfiles);
router.post('/profiles', AutomationController.createProfile);
router.get('/profiles/:id', AutomationController.getProfile);
router.put('/profiles/:id', AutomationController.updateProfile);
router.delete('/profiles/:id', AutomationController.deleteProfile);

export default router;
