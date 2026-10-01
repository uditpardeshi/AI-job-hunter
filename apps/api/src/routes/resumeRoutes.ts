import { Router } from 'express';
import { ResumeController } from '../controllers/resumeController';
import { resumeUploadMiddleware } from '../services/storageService';
import { requireAuth } from '../middleware/authMiddleware';

export const resumeRouter = Router();

// All resume and profile routes strictly require authentication
resumeRouter.use(requireAuth);

// Resume upload and processing routes
resumeRouter.post('/resumes', resumeUploadMiddleware.single('resume'), ResumeController.uploadResume);
resumeRouter.get('/resumes', ResumeController.listResumes);
resumeRouter.get('/resumes/versions', ResumeController.getVersions);
resumeRouter.get('/resumes/:id', ResumeController.getResume);
resumeRouter.delete('/resumes/:id', ResumeController.deleteResume);
resumeRouter.post('/resumes/:id/process', ResumeController.processResume);

// Candidate profile routes
resumeRouter.get('/profile', ResumeController.getProfile);
resumeRouter.put('/profile', ResumeController.updateProfile);
resumeRouter.get('/profile/preferences', ResumeController.getPreferences);
resumeRouter.put('/profile/preferences', ResumeController.updatePreferences);
