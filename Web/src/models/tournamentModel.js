const { tournamentService } = require('../services/tournamentService');

class TournamentModel {
  buildHomeView(error = null) {
    const activeEvent = tournamentService.getActiveEvent();
    const latestEvent = activeEvent || tournamentService.getLatestEvent();
    const participants = tournamentService.listParticipants();
    const eventIdForStats = latestEvent ? latestEvent.id : null;
    const currentRound = activeEvent ? tournamentService.roundToPlay(activeEvent.id) : null;
    const heats = activeEvent && currentRound ? tournamentService.getHeats(activeEvent.id, currentRound) : [];
    const leaderboard = latestEvent ? tournamentService.leaderboard(eventIdForStats) : [];
    const finalRanking = latestEvent ? tournamentService.finalRanking(eventIdForStats) : [];
    const brackets = latestEvent ? tournamentService.bracketView(eventIdForStats) : {};
    const chronosDone = this.computeChronosDone(activeEvent, currentRound);
    const chronoBoard = this.buildChronoBoard(latestEvent, eventIdForStats, participants);
    const currentRoundParticipants = this.extractCurrentRoundParticipants(heats);

    return {
      error,
      activeEvent,
      latestEvent,
      participants,
      currentRound,
      heats,
      leaderboard,
      finalRanking,
      brackets,
      chronosDone,
      chronoBoard,
      currentRoundParticipants,
    };
  }

  computeChronosDone(activeEvent, currentRound) {
    if (!activeEvent || !currentRound) {
      return false;
    }

    if (currentRound > 1) {
      return true;
    }

    return tournamentService.timesComplete(activeEvent.id, currentRound);
  }

  buildChronoBoard(latestEvent, eventIdForStats, participants) {
    if (latestEvent) {
      return tournamentService.chronoBoard(eventIdForStats);
    }

    return participants.map((p) => ({
      id: p.id,
      name: p.name,
      bib: p.bib,
      best_text: null,
      rank: null,
    }));
  }

  extractCurrentRoundParticipants(heats) {
    const participantById = {};
    heats.forEach((heat) => {
      heat.participants.forEach((participant) => {
        participantById[participant.participant_id] = participant.name;
      });
    });

    return Object.keys(participantById)
      .map(Number)
      .sort((a, b) => a - b)
      .reduce((acc, participantId) => {
        acc[participantId] = participantById[participantId];
        return acc;
      }, {});
  }
}

const tournamentModel = new TournamentModel();

module.exports = {
  tournamentModel,
  TournamentModel,
};
