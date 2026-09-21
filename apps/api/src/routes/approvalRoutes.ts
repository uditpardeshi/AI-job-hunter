import { Router } from 'express';
import { ApprovalController } from '../controllers/approvalController';

const router = Router();

router.get('/', ApprovalController.listApprovals);
router.get('/:id', ApprovalController.getApproval);
router.put('/:id/answers', ApprovalController.updateAnswers);
router.post('/:id/approve', ApprovalController.approve);
router.post('/:id/reject', ApprovalController.reject);

export default router;
