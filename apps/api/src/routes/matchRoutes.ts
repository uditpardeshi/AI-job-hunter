import { Router } from 'express';
import { MatchController } from '../controllers/matchController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

// Job analysis endpoints
router.post('/jobs/:id/analyze', requireAuth, MatchController.analyzeJob);
router.get('/jobs/:id/analysis', requireAuth, MatchController.getJobAnalysis);

// Job match endpoints
router.post('/jobs/:id/match', requireAuth, MatchController.matchJob);
router.get('/jobs/:id/match', requireAuth, MatchController.getJobMatch);

// Batch & listing endpoints
router.post('/matches/recalculate', requireAuth, MatchController.recalculateMatches);
router.get('/matches', requireAuth, MatchController.listMatches);
router.get('/matches/:id', requireAuth, MatchController.getMatchById);

export default router;
