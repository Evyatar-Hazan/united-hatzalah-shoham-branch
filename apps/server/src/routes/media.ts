import { Router } from 'express';
import { MediaController } from '../controllers/MediaController';

const router = Router();

router.get('/gallery', MediaController.getGallery);
router.get('/stories', MediaController.getStories);
router.post('/gallery', MediaController.addGalleryItem);
router.post('/stories', MediaController.addStory);

export default router;
