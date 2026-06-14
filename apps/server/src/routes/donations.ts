import { Router } from 'express';
import { DonationController } from '../controllers/DonationController';

const router = Router();

router.post('/', DonationController.createDonation);
router.get('/', DonationController.getDonations);
router.get('/stats', DonationController.getDonationStats);

export default router;
