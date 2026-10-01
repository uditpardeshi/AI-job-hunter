import { Router } from 'express';
import { TailoringController } from '../controllers/tailoringController';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

// Tailored Resume Endpoints
router.post('/jobs/:jobId/tailor-resume', TailoringController.tailorResume);
router.get('/jobs/:jobId/tailored-resumes', TailoringController.listTailoredResumes);

router.get('/tailored-resumes/:id', TailoringController.getTailoredResume);
router.put('/tailored-resumes/:id', TailoringController.updateTailoredResume);
router.post('/tailored-resumes/:id/validate', TailoringController.validateTailoredResume);
router.get('/tailored-resumes/:id/ats-analysis', TailoringController.getAtsAnalysis);
router.get('/tailored-resumes/:id/export/pdf', TailoringController.exportResumePdf);
router.get('/tailored-resumes/:id/export/docx', TailoringController.exportResumeDocx);

// Cover Letter Endpoints
router.post('/jobs/:jobId/cover-letter', TailoringController.generateCoverLetter);
router.get('/jobs/:jobId/cover-letters', TailoringController.listCoverLetters);

router.get('/cover-letters/:id', TailoringController.getCoverLetter);
router.put('/cover-letters/:id', TailoringController.updateCoverLetter);
router.get('/cover-letters/:id/export/pdf', TailoringController.exportCoverLetterPdf);
router.get('/cover-letters/:id/export/docx', TailoringController.exportCoverLetterDocx);

export default router;
