// src/routes/jarRoutes.ts
import express, { Router } from 'express';
import { JarController } from '../controllers/JarController';
import { validateTranslationParams, validateFileUpload } from '../middleware/validationMiddleware';
import { uploadMiddleware, handleFileUploadError } from '../middleware/uploadMiddleware';

const router: Router = express.Router();
const jarController = new JarController();

router.post(
  '/', 
  uploadMiddleware.single('jarFile'),
  validateFileUpload,
  validateTranslationParams,
  (req, res, next) => jarController.processJarFile(req, res, next)
);

router.use(handleFileUploadError);

export default router;