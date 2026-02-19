const db = require('../models/db');
const { TournamentRepository } = require('../repositories/tournamentRepository');
const { ParticipantsService } = require('./participantsService');
const { BracketService } = require('./bracketService');
const { EventService } = require('./eventService');
const utils = require('./utils/tournamentUtils');

class TournamentService {
  constructor(eventService, participantsService, bracketService) {
    this.eventService = eventService;
    this.participantsService = participantsService;
    this.bracketService = bracketService;
  }

  getLatestEvent() {
    return this.eventService.getLatestEvent();
  }

  getActiveEvent() {
    return this.eventService.getActiveEvent();
  }

  addParticipantAutoBib(name) {
    return this.participantsService.addParticipantAutoBib(name);
  }

  listParticipants() {
    return this.participantsService.listParticipants();
  }

  seedParticipants(count) {
    return this.participantsService.seedParticipants(count);
  }

  deleteParticipant(participantId) {
    return this.participantsService.deleteParticipant(participantId);
  }

  deleteAllParticipants() {
    return this.participantsService.deleteAllParticipants();
  }

  startEvent(name, totalRounds = 3, category = 'Open') {
    return this.eventService.startEvent(name, totalRounds, category);
  }

  closeEvent(eventId) {
    return this.eventService.closeEvent(eventId);
  }

  roundToPlay(eventId) {
    return this.eventService.roundToPlay(eventId);
  }

  getHeats(eventId, round) {
    return this.eventService.getHeats(eventId, round);
  }

  saveTimes(eventId, round, timesGlobal) {
    return this.eventService.saveTimes(eventId, round, timesGlobal);
  }

  saveResults(eventId, round, results) {
    return this.eventService.saveResults(eventId, round, results);
  }

  timesComplete(eventId, round) {
    return this.eventService.timesComplete(eventId, round);
  }

  bracketView(eventId) {
    return this.bracketService.bracketView(eventId);
  }

  leaderboard(eventId) {
    return this.bracketService.leaderboard(eventId);
  }

  finalRanking(eventId) {
    return this.bracketService.finalRanking(eventId);
  }

  chronoBoard(eventId) {
    return this.participantsService.chronoBoard(eventId);
  }
}

const repository = new TournamentRepository(db);
const participantsService = new ParticipantsService(repository, utils);
const bracketService = new BracketService(repository, utils);
const eventService = new EventService(repository, participantsService, bracketService, utils);
const service = new TournamentService(eventService, participantsService, bracketService);

module.exports = {
  tournamentService: service,
  TournamentService,
};
