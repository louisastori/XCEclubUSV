const { tournamentService } = require('../services/tournamentService');
const { tournamentModel } = require('../models/tournamentModel');

function renderHome(res, error = null) {
  res.render('index', tournamentModel.buildHomeView(error));
}

function withHomeErrorHandling(handler) {
  return (req, res) => {
    try {
      handler(req, res);
    } catch (err) {
      renderHome(res, err.message);
    }
  };
}

const showHome = (req, res) => {
  renderHome(res);
};

const addParticipant = withHomeErrorHandling((req, res) => {
  tournamentService.addParticipantAutoBib(req.body.name || '');
  res.redirect('/');
});

const deleteParticipant = withHomeErrorHandling((req, res) => {
  tournamentService.deleteParticipant(Number(req.params.id));
  res.redirect('/');
});

const deleteAllParticipants = withHomeErrorHandling((req, res) => {
  tournamentService.deleteAllParticipants();
  res.redirect('/');
});

const seedParticipants = withHomeErrorHandling((req, res) => {
  const count = Number(req.params.count);
  tournamentService.seedParticipants(count);
  res.redirect('/');
});

const startEvent = withHomeErrorHandling((req, res) => {
  const name = (req.body.event_name || 'Course XCE').trim() || 'Course XCE';
  const category = (req.body.event_category || 'Open').trim() || 'Open';
  tournamentService.startEvent(name, 3, category);
  res.redirect('/');
});

const closeEvent = withHomeErrorHandling((req, res) => {
  tournamentService.closeEvent(Number(req.params.id));
  res.redirect('/');
});

const submitTimes = withHomeErrorHandling((req, res) => {
  const eventId = Number(req.params.eventId);
  const round = Number(req.params.round);
  tournamentService.saveTimes(eventId, round, req.body.times_global || {});
  res.redirect('/');
});

const submitResults = withHomeErrorHandling((req, res) => {
  const eventId = Number(req.params.eventId);
  const round = Number(req.params.round);
  tournamentService.saveResults(eventId, round, req.body.results || {});
  res.redirect('/');
});

module.exports = {
  showHome,
  addParticipant,
  deleteParticipant,
  deleteAllParticipants,
  seedParticipants,
  startEvent,
  closeEvent,
  submitTimes,
  submitResults,
};
