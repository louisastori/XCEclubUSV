class TournamentRepository {
  constructor(database) {
    this.db = database;
    this.statements = {
      getLatestEvent: this.db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT 1'),
      getNextBib: this.db.prepare('SELECT COALESCE(MAX(bib), 0) + 1 AS bib FROM participants'),
      insertParticipantIgnore: this.db.prepare('INSERT OR IGNORE INTO participants(name, bib) VALUES(:name, :bib)'),
      listParticipants: this.db.prepare('SELECT id, name, bib FROM participants ORDER BY COALESCE(bib, 999999), name'),
      archiveActiveEvents: this.db.prepare("UPDATE events SET status='archived' WHERE status='active'"),
      insertEvent: this.db.prepare('INSERT INTO events(name, total_rounds, category) VALUES(:name, :rounds, :cat)'),
      insertEventParticipant: this.db.prepare('INSERT INTO event_participants(event_id, participant_id) VALUES(:e, :p)'),
      archiveEventById: this.db.prepare("UPDATE events SET status='archived' WHERE id=:id"),
      getActiveEvent: this.db.prepare("SELECT * FROM events WHERE status='active' ORDER BY id DESC LIMIT 1"),
      listEventRounds: this.db.prepare('SELECT DISTINCT round_number FROM heats WHERE event_id=:e ORDER BY round_number'),
      listHeatsByRound: this.db.prepare(
        'SELECT * FROM heats WHERE event_id=:e AND round_number=:r ORDER BY bracket, stage_tier, heat_index'
      ),
      findHeatForParticipantInRound: this.db.prepare(`
        SELECT hp.heat_id AS heat_id
        FROM heat_participants hp
        JOIN heats h ON h.id = hp.heat_id
        WHERE h.event_id = :e AND h.round_number = :r AND hp.participant_id = :p
        LIMIT 1
      `),
      upsertHeatTime: this.db.prepare(`
        INSERT INTO heat_times(heat_id, participant_id, time_ms, time_text)
        VALUES(:h, :p, :tms, :tt)
        ON CONFLICT(heat_id, participant_id)
        DO UPDATE SET time_ms = excluded.time_ms, time_text = excluded.time_text
      `),
      deleteHeatResultsByHeat: this.db.prepare('DELETE FROM heat_results WHERE heat_id=:h'),
      insertHeatResult: this.db.prepare(`
        INSERT INTO heat_results(heat_id, participant_id, position, points, time_ms, time_text)
        VALUES(:h, :p, :pos, :pts, :tms, :tt)
      `),
      getHeatTimeByHeatAndParticipant: this.db.prepare(
        'SELECT time_ms, time_text FROM heat_times WHERE heat_id=:h AND participant_id=:p'
      ),
      deleteHeatTimesByHeat: this.db.prepare('DELETE FROM heat_times WHERE heat_id=:h'),
      listRoundFillStatus: this.db.prepare(`
        SELECT h.id,
               (SELECT COUNT(*) FROM heat_participants hp WHERE hp.heat_id = h.id) AS slots,
               (SELECT COUNT(*) FROM heat_results hr WHERE hr.heat_id = h.id) AS filled
        FROM heats h
        WHERE h.event_id=:e AND h.round_number=:r
      `),
      listParticipantsByHeat: this.db.prepare(`
        SELECT hp.participant_id, p.name, p.bib
        FROM heat_participants hp
        JOIN participants p ON p.id = hp.participant_id
        WHERE hp.heat_id = :h
      `),
      recalcEventPoints: this.db.prepare(`
        UPDATE event_participants
        SET points = (
          SELECT COALESCE(SUM(hr.points), 0)
          FROM heat_results hr
          JOIN heats h ON h.id = hr.heat_id
          WHERE h.event_id = event_participants.event_id
            AND hr.participant_id = event_participants.participant_id
        )
        WHERE event_id = :e
      `),
      insertHeat: this.db.prepare(
        'INSERT INTO heats(event_id, round_number, bracket, stage_tier, heat_index) VALUES(:e,:r,:b,:t,:i)'
      ),
      insertHeatParticipant: this.db.prepare('INSERT INTO heat_participants(heat_id, participant_id) VALUES(:h,:p)'),
      getRoundTimesComplete: this.db.prepare(`
        SELECT COUNT(*) = SUM(CASE WHEN ht.time_ms IS NOT NULL OR ht.time_text IS NOT NULL THEN 1 ELSE 0 END) AS complete
        FROM heat_participants hp
        JOIN heats h ON h.id = hp.heat_id
        LEFT JOIN heat_times ht ON ht.heat_id = hp.heat_id AND ht.participant_id = hp.participant_id
        WHERE h.event_id = :e AND h.round_number = :r
      `),
      listInitialPoolFillStatus: this.db.prepare(`
        SELECT h.id,
               (SELECT COUNT(*) FROM heat_participants hp WHERE hp.heat_id = h.id) AS slots,
               (SELECT COUNT(*) FROM heat_results hr WHERE hr.heat_id = h.id) AS filled
        FROM heats h
        WHERE h.event_id=:e AND h.bracket='initial'
      `),
      listInitialPoolRows: this.db.prepare(`
        SELECT h.round_number, h.heat_index,
               hp.participant_id, p.name, p.bib,
               hr.position, hr.points
        FROM heats h
        JOIN heat_participants hp ON hp.heat_id = h.id
        JOIN participants p ON p.id = hp.participant_id
        LEFT JOIN heat_results hr ON hr.heat_id = h.id AND hr.participant_id = hp.participant_id
        WHERE h.event_id = :e AND h.bracket = 'initial'
        ORDER BY h.round_number, h.heat_index, hp.participant_id
      `),
      countBracketHeats: this.db.prepare(`
        SELECT COUNT(*) AS total
        FROM heats
        WHERE event_id = :e AND bracket IN ('winners', 'losers')
      `),
      updateEventTotalRoundsAtLeast: this.db.prepare(`
        UPDATE events
        SET total_rounds = CASE
          WHEN total_rounds < :r THEN :r
          ELSE total_rounds
        END
        WHERE id = :e
      `),
      listBracketRowsForRepair: this.db.prepare(`
        SELECT h.id, h.round_number, h.bracket, h.heat_index,
               (SELECT COUNT(*) FROM heat_participants hp WHERE hp.heat_id = h.id) AS slots,
               (SELECT COUNT(*) FROM heat_results hr WHERE hr.heat_id = h.id) AS filled
        FROM heats h
        WHERE h.event_id = :e
          AND h.bracket IN ('winners', 'losers')
        ORDER BY h.round_number, h.bracket, h.heat_index
      `),
      deleteBracketHeatsByEvent: this.db.prepare(`
        DELETE FROM heats
        WHERE event_id = :e
          AND bracket IN ('winners', 'losers')
      `),
      listBracketRoundFillStatus: this.db.prepare(`
        SELECT h.id,
               (SELECT COUNT(*) FROM heat_participants hp WHERE hp.heat_id = h.id) AS slots,
               (SELECT COUNT(*) FROM heat_results hr WHERE hr.heat_id = h.id) AS filled
        FROM heats h
        WHERE h.event_id=:e AND h.round_number=:r AND h.bracket=:b
      `),
      countBracketRoundHeats: this.db.prepare(`
        SELECT COUNT(*) AS total
        FROM heats
        WHERE event_id = :e AND round_number = :r AND bracket = :b
      `),
      listBracketTransitionRows: this.db.prepare(`
        SELECT h.stage_tier, h.heat_index, hp.participant_id, p.bib, hr.position
        FROM heats h
        JOIN heat_participants hp ON hp.heat_id = h.id
        JOIN participants p ON p.id = hp.participant_id
        JOIN heat_results hr ON hr.heat_id = h.id AND hr.participant_id = hp.participant_id
        WHERE h.event_id = :e AND h.round_number = :r AND h.bracket = :b
        ORDER BY h.stage_tier ASC, h.heat_index ASC, hr.position ASC, COALESCE(p.bib, 999999) ASC, hp.participant_id ASC
      `),
      getMaxBracketRound: this.db.prepare(`
        SELECT MAX(round_number) AS r
        FROM heats
        WHERE event_id = :e AND bracket = :b
      `),
      listBracketViewRows: this.db.prepare(`
        SELECT h.id AS heat_id, h.round_number, h.bracket, h.stage_tier, h.heat_index,
               hp.participant_id, p.name,
               hr.position, hr.points
        FROM heats h
        JOIN heat_participants hp ON hp.heat_id = h.id
        JOIN participants p ON p.id = hp.participant_id
        LEFT JOIN heat_results hr ON hr.heat_id = h.id AND hr.participant_id = hp.participant_id
        WHERE h.event_id = :e
        ORDER BY h.bracket, h.round_number, h.stage_tier, h.heat_index, hp.participant_id
      `),
      listLeaderboardRows: this.db.prepare(`
        SELECT p.name, ep.points
        FROM event_participants ep
        JOIN participants p ON p.id = ep.participant_id
        WHERE ep.event_id = :e
        ORDER BY ep.points DESC, p.name ASC
      `),
      listFinalRankingRows: this.db.prepare(`
        SELECT hr.participant_id, p.name, h.bracket, h.round_number, h.stage_tier, h.heat_index,
               hr.position, COALESCE(ep.points, 0) AS points
        FROM heat_results hr
        JOIN heats h ON h.id = hr.heat_id
        JOIN participants p ON p.id = hr.participant_id
        LEFT JOIN event_participants ep ON ep.event_id = h.event_id AND ep.participant_id = hr.participant_id
        WHERE h.event_id = :e
          AND h.bracket IN ('winners', 'losers')
      `),
      listChronoRows: this.db.prepare(`
        SELECT p.id, p.name, p.bib, ht.time_ms, ht.time_text
        FROM heat_times ht
        JOIN heat_participants hp ON hp.heat_id = ht.heat_id AND hp.participant_id = ht.participant_id
        JOIN heats h ON h.id = ht.heat_id
        JOIN participants p ON p.id = ht.participant_id
        WHERE h.event_id = :e
        UNION ALL
        SELECT p.id, p.name, p.bib, hr.time_ms, hr.time_text
        FROM heat_results hr
        JOIN heats h ON h.id = hr.heat_id
        JOIN participants p ON p.id = hr.participant_id
        WHERE h.event_id = :e
      `),
      deleteHeatTimesByParticipant: this.db.prepare('DELETE FROM heat_times WHERE participant_id=:p'),
      deleteHeatResultsByParticipant: this.db.prepare('DELETE FROM heat_results WHERE participant_id=:p'),
      deleteHeatParticipantsByParticipant: this.db.prepare('DELETE FROM heat_participants WHERE participant_id=:p'),
      deleteEventParticipantsByParticipant: this.db.prepare('DELETE FROM event_participants WHERE participant_id=:p'),
      deleteParticipantById: this.db.prepare('DELETE FROM participants WHERE id=:p'),
      deleteAllHeatTimes: this.db.prepare('DELETE FROM heat_times'),
      deleteAllHeatResults: this.db.prepare('DELETE FROM heat_results'),
      deleteAllHeatParticipants: this.db.prepare('DELETE FROM heat_participants'),
      deleteAllEventParticipants: this.db.prepare('DELETE FROM event_participants'),
      deleteAllHeats: this.db.prepare('DELETE FROM heats'),
      deleteAllEvents: this.db.prepare('DELETE FROM events'),
      deleteAllParticipants: this.db.prepare('DELETE FROM participants'),
    };
  }

  runInTransaction(work) {
    return this.db.transaction(work)();
  }

  getLatestEvent() {
    return this.statements.getLatestEvent.get() || null;
  }

  getNextBib() {
    const row = this.statements.getNextBib.get();
    return Number(row?.bib || 1);
  }

  insertParticipantIgnore(name, bib) {
    this.statements.insertParticipantIgnore.run({ name, bib });
  }

  listParticipants() {
    return this.statements.listParticipants.all();
  }

  archiveActiveEvents() {
    this.statements.archiveActiveEvents.run();
  }

  insertEvent(name, totalRounds, category) {
    const result = this.statements.insertEvent.run({
      name,
      rounds: totalRounds,
      cat: category,
    });
    return result.lastInsertRowid;
  }

  insertEventParticipant(eventId, participantId) {
    this.statements.insertEventParticipant.run({ e: eventId, p: participantId });
  }

  archiveEventById(eventId) {
    this.statements.archiveEventById.run({ id: eventId });
  }

  getActiveEvent() {
    return this.statements.getActiveEvent.get() || null;
  }

  listEventRoundNumbers(eventId) {
    return this.statements.listEventRounds
      .all({ e: eventId })
      .map((row) => Number(row.round_number));
  }

  listHeatsByRound(eventId, round) {
    return this.statements.listHeatsByRound.all({ e: eventId, r: round });
  }

  findHeatForParticipantInRound(eventId, round, participantId) {
    return this.statements.findHeatForParticipantInRound.get({
      e: eventId,
      r: round,
      p: participantId,
    }) || null;
  }

  upsertHeatTime(heatId, participantId, timeMs, timeText) {
    this.statements.upsertHeatTime.run({
      h: heatId,
      p: participantId,
      tms: timeMs,
      tt: timeText,
    });
  }

  deleteHeatResultsByHeat(heatId) {
    this.statements.deleteHeatResultsByHeat.run({ h: heatId });
  }

  insertHeatResult(heatId, participantId, position, points, timeMs, timeText) {
    this.statements.insertHeatResult.run({
      h: heatId,
      p: participantId,
      pos: position,
      pts: points,
      tms: timeMs,
      tt: timeText,
    });
  }

  getHeatTimeByHeatAndParticipant(heatId, participantId) {
    return this.statements.getHeatTimeByHeatAndParticipant.get({
      h: heatId,
      p: participantId,
    }) || null;
  }

  deleteHeatTimesByHeat(heatId) {
    this.statements.deleteHeatTimesByHeat.run({ h: heatId });
  }

  listRoundFillStatus(eventId, round) {
    return this.statements.listRoundFillStatus.all({ e: eventId, r: round });
  }

  listParticipantsByHeat(heatId) {
    return this.statements.listParticipantsByHeat.all({ h: heatId });
  }

  recalcEventPoints(eventId) {
    this.statements.recalcEventPoints.run({ e: eventId });
  }

  insertHeat(eventId, round, bracket, stageTier, heatIndex) {
    return this.statements.insertHeat.run({
      e: eventId,
      r: round,
      b: bracket,
      t: stageTier,
      i: heatIndex,
    }).lastInsertRowid;
  }

  insertHeatParticipant(heatId, participantId) {
    this.statements.insertHeatParticipant.run({ h: heatId, p: participantId });
  }

  isRoundTimesComplete(eventId, round) {
    const row = this.statements.getRoundTimesComplete.get({ e: eventId, r: round });
    return Boolean(row && row.complete);
  }

  listInitialPoolFillStatus(eventId) {
    return this.statements.listInitialPoolFillStatus.all({ e: eventId });
  }

  listInitialPoolRows(eventId) {
    return this.statements.listInitialPoolRows.all({ e: eventId });
  }

  countBracketHeats(eventId) {
    const row = this.statements.countBracketHeats.get({ e: eventId });
    return Number(row?.total || 0);
  }

  updateEventTotalRoundsAtLeast(eventId, round) {
    this.statements.updateEventTotalRoundsAtLeast.run({ e: eventId, r: round });
  }

  listBracketRowsForRepair(eventId) {
    return this.statements.listBracketRowsForRepair.all({ e: eventId });
  }

  deleteBracketHeatsByEvent(eventId) {
    this.statements.deleteBracketHeatsByEvent.run({ e: eventId });
  }

  listBracketRoundFillStatus(eventId, round, bracket) {
    return this.statements.listBracketRoundFillStatus.all({
      e: eventId,
      r: round,
      b: bracket,
    });
  }

  countBracketRoundHeats(eventId, round, bracket) {
    const row = this.statements.countBracketRoundHeats.get({
      e: eventId,
      r: round,
      b: bracket,
    });
    return Number(row?.total || 0);
  }

  listBracketTransitionRows(eventId, round, bracket) {
    return this.statements.listBracketTransitionRows.all({
      e: eventId,
      r: round,
      b: bracket,
    });
  }

  getMaxBracketRound(eventId, bracket) {
    const row = this.statements.getMaxBracketRound.get({
      e: eventId,
      b: bracket,
    });
    if (!row || row.r === null) {
      return null;
    }
    return Number(row.r);
  }

  listBracketViewRows(eventId) {
    return this.statements.listBracketViewRows.all({ e: eventId });
  }

  listLeaderboardRows(eventId) {
    return this.statements.listLeaderboardRows.all({ e: eventId });
  }

  listFinalRankingRows(eventId) {
    return this.statements.listFinalRankingRows.all({ e: eventId });
  }

  listChronoRows(eventId) {
    return this.statements.listChronoRows.all({ e: eventId });
  }

  deleteParticipantReferences(participantId) {
    this.statements.deleteHeatTimesByParticipant.run({ p: participantId });
    this.statements.deleteHeatResultsByParticipant.run({ p: participantId });
    this.statements.deleteHeatParticipantsByParticipant.run({ p: participantId });
    this.statements.deleteEventParticipantsByParticipant.run({ p: participantId });
    this.statements.deleteParticipantById.run({ p: participantId });
  }

  clearTournamentData() {
    this.statements.deleteAllHeatTimes.run();
    this.statements.deleteAllHeatResults.run();
    this.statements.deleteAllHeatParticipants.run();
    this.statements.deleteAllEventParticipants.run();
    this.statements.deleteAllHeats.run();
    this.statements.deleteAllEvents.run();
    this.statements.deleteAllParticipants.run();
  }
}

module.exports = {
  TournamentRepository,
};
