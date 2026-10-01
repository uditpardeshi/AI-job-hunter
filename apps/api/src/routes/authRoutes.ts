import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { requireAuth } from '../middleware/authMiddleware';

export const authRouter = Router();

authRouter.post('/auth/register', AuthController.register);
authRouter.post('/auth/login', AuthController.login);
authRouter.post('/auth/logout', AuthController.logout);
authRouter.get('/auth/me', requireAuth, AuthController.getCurrentUser);

export default authRouter;
