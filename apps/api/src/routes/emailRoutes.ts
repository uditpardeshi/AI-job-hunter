import { Router } from 'express';
import { EmailController } from '../controllers/emailController';

const router = Router();

router.get('/emails', EmailController.listEmails);
router.get('/emails/drafts', EmailController.listDrafts);
router.post('/emails/drafts', EmailController.saveDraft);
router.post('/emails/generate', EmailController.generateDraft);
router.post('/emails/generate-draft', EmailController.generateDraft);
router.post('/emails/send', EmailController.sendEmail);

router.get('/emails/:id', EmailController.getEmail);
router.post('/emails/:id/associate', EmailController.associateEmail);
router.patch('/emails/:id/associate', EmailController.associateEmail);
router.post('/emails/:id/suggestion', EmailController.handleSuggestion);

router.get('/applications/:applicationId/contacts', EmailController.listContacts);
router.post('/applications/:applicationId/contacts', EmailController.createContact);
router.delete('/applications/:applicationId/contacts/:contactId', EmailController.deleteContact);

export default router;
