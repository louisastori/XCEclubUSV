const express = require('express');
const controller = require('../controllers/tournamentController');

const router = express.Router();

router.get('/', controller.showHome);

router.post('/participants', controller.addParticipant);
router.post('/participants/delete-all', controller.deleteAllParticipants);
router.post('/participants/:id/delete', controller.deleteParticipant);
router.post('/participants/seed/:count', controller.seedParticipants);
router.get('/participants/seed/:count', controller.seedParticipants); // fallback pour déclenchement via lien

router.post('/events/start', controller.startEvent);
router.post('/events/:id/close', controller.closeEvent);
router.post('/events/:eventId/round/:round/times', controller.submitTimes);
router.post('/events/:eventId/round/:round/results', controller.submitResults);

module.exports = router;
