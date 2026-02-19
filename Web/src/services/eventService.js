class EventService {
  constructor(repository, participantsService, bracketService, { parseChrono, splitIntoGroupsOf3Or4, shuffle }) {
    this.repository = repository;
    this.participantsService = participantsService;
    this.bracketService = bracketService;
    this.parseChrono = parseChrono;
    this.splitIntoGroupsOf3Or4 = splitIntoGroupsOf3Or4;
    this.shuffle = shuffle;
    this.POINTS = [4, 3, 2, 1];
  }

  getLatestEvent() {
    return this.repository.getLatestEvent();
  }

  getActiveEvent() {
    return this.repository.getActiveEvent();
  }

  startEvent(name, totalRounds = 3, category = 'Open') {
    const participants = this.participantsService.listParticipants();
    if (participants.length < 2) {
      throw new Error('Au moins 2 participants necessaires');
    }

    const ids = participants.map((participant) => participant.id);
    // Shuffle separement pairs / impairs puis concat (pairs en premier, impairs ensuite)
    const evenIds = ids.filter((id) => id % 2 === 0);
    const oddIds = ids.filter((id) => id % 2 !== 0);
    this.shuffle(evenIds);
    this.shuffle(oddIds);
    const orderedIds = [...evenIds, ...oddIds];

    const groupSizes = this.splitIntoGroupsOf3Or4(orderedIds.length);

    this.repository.runInTransaction(() => {
      this.repository.archiveActiveEvents();
      const eventId = this.repository.insertEvent(name, totalRounds, category || 'Open');
      orderedIds.forEach((participantId) => this.repository.insertEventParticipant(eventId, participantId));

      // Genere d'emblee tous les tours avec les memes groupes (stabilite sur 3 courses)
      for (let round = 1; round <= totalRounds; round += 1) {
        this.generateHeatsFixed(eventId, round, 'initial', orderedIds, groupSizes);
      }
    });
  }

  closeEvent(eventId) {
    this.repository.archiveEventById(eventId);
  }

  roundToPlay(eventId) {
    // Rattrapage automatique: si les 3 tours de poule sont termines, on cree
    // les groupes gagnant/perdant meme pour un evenement deja en cours.
    this.bracketService.ensureQualificationHeatsGenerated(eventId);
    this.bracketService.ensureBracketProgression(eventId);

    const rounds = this.repository.listEventRoundNumbers(eventId);
    for (const round of rounds) {
      if (!this.roundFinished(eventId, round)) {
        return round;
      }
    }

    const event = this.getActiveEvent();
    if (event && event.total_rounds > (rounds.length ? Math.max(...rounds) : 0)) {
      return null;
    }
    return null;
  }

  getHeats(eventId, round) {
    const heats = this.repository.listHeatsByRound(eventId, round);
    return heats.map((heat) => ({
      ...heat,
      participants: this.participantsForHeat(heat.id),
    }));
  }

  saveTimes(eventId, round, timesGlobal) {
    if (!timesGlobal || Object.keys(timesGlobal).length === 0) {
      throw new Error('Aucun chrono transmis');
    }

    this.repository.runInTransaction(() => {
      for (const [participantIdRaw, chrono] of Object.entries(timesGlobal)) {
        const participantId = Number(participantIdRaw);
        const heatRow = this.repository.findHeatForParticipantInRound(eventId, round, participantId);
        if (!heatRow) continue;
        const [timeMs, timeText] = this.parseChrono(chrono);
        this.repository.upsertHeatTime(heatRow.heat_id, participantId, timeMs, timeText);
      }
    });
  }

  saveResults(eventId, round, results) {
    if (!results || Object.keys(results).length === 0) {
      throw new Error('Aucun resultat transmis');
    }

    this.repository.runInTransaction(() => {
      for (const [heatIdRaw, byParticipant] of Object.entries(results)) {
        const heatId = Number(heatIdRaw);
        if (!Number.isFinite(heatId) || heatId <= 0) {
          // Ignore cles vides ou invalides provenant du formulaire
          continue;
        }
        const expected = this.participantsForHeat(heatId);
        if (!expected || expected.length === 0) {
          // Groupe absent ou deja nettoye : on ignore pour eviter le blocage.
          continue;
        }

        const slots = expected.length;
        const positions = Object.values(byParticipant).map((value) => Number(value));
        const uniquePositions = new Set(positions);
        if (uniquePositions.size !== positions.length) {
          throw new Error(`Positions dupliquees dans le groupe ${heatId}`);
        }
        const maxPos = Math.max(...positions);
        const minPos = Math.min(...positions);
        if (maxPos > slots || minPos < 1) {
          throw new Error(`Positions invalides dans le groupe ${heatId}`);
        }

        this.repository.deleteHeatResultsByHeat(heatId);
        for (const [participantIdRaw, posRaw] of Object.entries(byParticipant)) {
          const participantId = Number(participantIdRaw);
          const position = Number(posRaw);
          const points = this.POINTS[position - 1] ?? this.POINTS[this.POINTS.length - 1];
          const timeRow = this.repository.getHeatTimeByHeatAndParticipant(heatId, participantId) || {
            time_ms: null,
            time_text: null,
          };
          this.repository.insertHeatResult(
            heatId,
            participantId,
            position,
            points,
            timeRow.time_ms,
            timeRow.time_text
          );
        }
        this.repository.deleteHeatTimesByHeat(heatId);
      }

      this.recalcPoints(eventId);
      this.bracketService.ensureQualificationHeatsGenerated(eventId);
      this.bracketService.ensureBracketProgression(eventId);
    });
  }

  timesComplete(eventId, round) {
    return this.repository.isRoundTimesComplete(eventId, round);
  }

  roundFinished(eventId, round) {
    const rows = this.repository.listRoundFillStatus(eventId, round);
    if (!rows.length) return false;
    return rows.every((row) => Number(row.slots) === Number(row.filled));
  }

  participantsForHeat(heatId) {
    const rows = this.repository.listParticipantsByHeat(heatId);

    // Ordre chrono deterministe : bib croissant (puis id) pour coherence avec la saisie des chronos
    const ordered = [...rows].sort((a, b) => {
      const bibA = a.bib ?? 999999;
      const bibB = b.bib ?? 999999;
      if (bibA === bibB) return a.participant_id - b.participant_id;
      return bibA - bibB;
    });
    const chronoOrderMap = new Map(ordered.map((row, index) => [row.participant_id, index + 1]));

    return rows.map((row) => ({
      ...row,
      chrono_order: chronoOrderMap.get(row.participant_id) || null,
    }));
  }

  recalcPoints(eventId) {
    this.repository.recalcEventPoints(eventId);
  }

  generateHeatsFixed(eventId, round, bracket, participantIds, groupSizes) {
    if (!participantIds || participantIds.length === 0) return;

    let offset = 0;
    groupSizes.forEach((size, idx) => {
      const group = participantIds.slice(offset, offset + size);
      offset += size;
      const heatId = this.repository.insertHeat(eventId, round, bracket, 0, idx + 1);
      group.forEach((participantId) => this.repository.insertHeatParticipant(heatId, participantId));
    });
  }
}

module.exports = {
  EventService,
};
