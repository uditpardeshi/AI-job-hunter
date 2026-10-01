import { Router } from 'express';
import { ApprovalController } from '../controllers/approvalController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/', ApprovalController.listApprovals);
router.get('/:id', ApprovalController.getApproval);
router.put('/:id/answers', ApprovalController.updateAnswers);
router.post('/:id/approve', ApprovalController.approve);
router.post('/:id/submit-manually', ApprovalController.submitManually);
router.post('/:id/reject', ApprovalController.reject);

export default router;
