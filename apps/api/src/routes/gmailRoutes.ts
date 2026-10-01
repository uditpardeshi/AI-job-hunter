import { Router } from 'express';
import { GmailController } from '../controllers/gmailController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.get('/integrations/gmail', requireAuth, GmailController.getConnection);
router.get('/integrations/gmail/connect', requireAuth, GmailController.getConnectUrl);
router.get('/integrations/gmail/callback', GmailController.handleCallback);
router.post('/integrations/gmail/disconnect', requireAuth, GmailController.disconnect);
router.post('/integrations/gmail/sync', requireAuth, GmailController.sync);

export default router;
