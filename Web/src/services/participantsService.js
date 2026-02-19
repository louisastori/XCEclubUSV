class ParticipantsService {
  constructor(repository, { parseChrono }) {
    this.repository = repository;
    this.parseChrono = parseChrono;
  }

  addParticipantAutoBib(name) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Nom requis');
    }
    const next = this.repository.getNextBib();
    this.repository.insertParticipantIgnore(trimmed, next);
  }

  listParticipants() {
    return this.repository.listParticipants();
  }

  seedParticipants(count) {
    const allowed = [8, 16, 32, 36, 48, 52, 64];
    if (!allowed.includes(count)) {
      throw new Error('Taille de liste non autorisee');
    }

    this.repository.runInTransaction(() => {
      this.repository.clearTournamentData();
      for (let i = 1; i <= count; i += 1) {
        const name = `Coureur ${String(i).padStart(2, '0')}`;
        this.addParticipantAutoBib(name);
      }
    });
  }

  chronoBoard(eventId) {
    const participants = this.listParticipants();
    const times = this.repository.listChronoRows(eventId);

    const best = new Map(participants.map((p) => [p.id, { ...p, best_ms: null, best_text: null }]));

    times.forEach((row) => {
      const entry = best.get(row.id);
      if (!entry) return;
      if (row.time_ms !== null && row.time_ms !== undefined) {
        const ms = Number(row.time_ms);
        if (entry.best_ms === null || ms < entry.best_ms) {
          entry.best_ms = ms;
          entry.best_text = row.time_text || entry.best_text;
        }
      } else if (row.time_text && entry.best_ms === null && !entry.best_text) {
        entry.best_text = row.time_text;
      }
    });

    // Si best_ms est absent mais le texte est au bon format, on recalcule pour pouvoir classer
    best.forEach((val) => {
      if (val.best_ms === null && val.best_text) {
        const parsed = this.parseChrono(val.best_text);
        if (parsed[0] !== null) {
          val.best_ms = parsed[0];
        }
      }
    });

    const rows = Array.from(best.values());
    rows.sort((a, b) => {
      const aNull = a.best_ms === null;
      const bNull = b.best_ms === null;
      if (aNull && bNull) return a.name.localeCompare(b.name);
      if (aNull) return 1;
      if (bNull) return -1;
      if (Number(a.best_ms) === Number(b.best_ms)) return a.name.localeCompare(b.name);
      return Number(a.best_ms) < Number(b.best_ms) ? -1 : 1;
    });

    let rank = 0;
    let lastMs = null;
    rows.forEach((row) => {
      if (row.best_ms === null) {
        row.rank = null;
        return;
      }
      if (lastMs === null || Number(row.best_ms) !== Number(lastMs)) {
        rank += 1;
        lastMs = Number(row.best_ms);
      }
      row.rank = rank;
    });

    return rows;
  }

  deleteParticipant(participantId) {
    if (!participantId || participantId <= 0) return;
    this.repository.runInTransaction(() => {
      this.repository.deleteParticipantReferences(participantId);
    });
  }

  deleteAllParticipants() {
    this.repository.runInTransaction(() => {
      this.repository.clearTournamentData();
    });
  }
}

module.exports = {
  ParticipantsService,
};
