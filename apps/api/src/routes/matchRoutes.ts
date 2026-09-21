import { Router } from 'express';
import { MatchController } from '../controllers/matchController';

const router = Router();

// Job analysis endpoints
router.post('/jobs/:id/analyze', MatchController.analyzeJob);
router.get('/jobs/:id/analysis', MatchController.getJobAnalysis);

// Job match endpoints
router.post('/jobs/:id/match', MatchController.matchJob);
router.get('/jobs/:id/match', MatchController.getJobMatch);

// Batch & listing endpoints
router.post('/matches/recalculate', MatchController.recalculateMatches);
router.get('/matches', MatchController.listMatches);
router.get('/matches/:id', MatchController.getMatchById);

export default router;
