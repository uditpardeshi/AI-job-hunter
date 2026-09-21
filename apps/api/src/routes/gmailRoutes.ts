import { Router } from 'express';
import { GmailController } from '../controllers/gmailController';

const router = Router();

router.get('/integrations/gmail', GmailController.getConnection);
router.get('/integrations/gmail/connect', GmailController.getConnectUrl);
router.get('/integrations/gmail/callback', GmailController.handleCallback);
router.post('/integrations/gmail/disconnect', GmailController.disconnect);
router.post('/integrations/gmail/sync', GmailController.sync);

export default router;
