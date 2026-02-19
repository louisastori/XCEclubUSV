class BracketService {
  constructor(repository, { splitIntoGroupsOf3Or4 }) {
    this.repository = repository;
    this.splitIntoGroupsOf3Or4 = splitIntoGroupsOf3Or4;
  }

  initialPoolsComplete(eventId) {
    const rows = this.repository.listInitialPoolFillStatus(eventId);
    if (!rows.length) return false;
    return rows.every((row) => Number(row.slots) > 0 && Number(row.slots) === Number(row.filled));
  }

  buildPoolsQualification(eventId) {
    if (!this.initialPoolsComplete(eventId)) {
      return null;
    }

    const rows = this.repository.listInitialPoolRows(eventId);
    if (!rows.length) {
      return null;
    }

    const roundSet = new Set(rows.map((row) => Number(row.round_number)));
    if (roundSet.size < 3) {
      return null;
    }

    const byPool = new Map();
    rows.forEach((row) => {
      const poolIndex = Number(row.heat_index);
      const participantId = Number(row.participant_id);
      if (!byPool.has(poolIndex)) {
        byPool.set(poolIndex, new Map());
      }
      const pool = byPool.get(poolIndex);
      if (!pool.has(participantId)) {
        pool.set(participantId, {
          id: participantId,
          name: row.name,
          bib: row.bib !== null && row.bib !== undefined ? Number(row.bib) : null,
          points: 0,
          position_sum: 0,
          best_position: Number.POSITIVE_INFINITY,
        });
      }
      const entry = pool.get(participantId);
      if (row.points !== null && row.points !== undefined) {
        entry.points += Number(row.points);
      }
      if (row.position !== null && row.position !== undefined) {
        const pos = Number(row.position);
        entry.position_sum += pos;
        if (pos < entry.best_position) {
          entry.best_position = pos;
        }
      }
    });

    const makeParticipant = (entry, poolRank) => ({
      id: entry.id,
      name: entry.name,
      position: poolRank,
      points: entry.points,
    });

    const winnersQualified = [];
    const losersQualified = [];
    Array.from(byPool.keys())
      .sort((a, b) => a - b)
      .forEach((poolIndex) => {
        const ranked = Array.from(byPool.get(poolIndex).values())
          .sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (a.position_sum !== b.position_sum) return a.position_sum - b.position_sum;
            if (a.best_position !== b.best_position) return a.best_position - b.best_position;
            const bibA = a.bib ?? 999999;
            const bibB = b.bib ?? 999999;
            if (bibA !== bibB) return bibA - bibB;
            return a.name.localeCompare(b.name);
          });

        if (!ranked.length) {
          return;
        }

        const winnersCount = ranked.length <= 1 ? ranked.length : Math.min(2, ranked.length - 1);
        const winners = ranked.slice(0, winnersCount);
        const losers = ranked.slice(winnersCount);

        winners.forEach((entry, idx) => {
          winnersQualified.push({
            ...entry,
            pool_index: poolIndex,
            pool_rank: idx + 1,
          });
        });
        losers.forEach((entry, idx) => {
          losersQualified.push({
            ...entry,
            pool_index: poolIndex,
            pool_rank: winnersCount + idx + 1,
          });
        });
      });

    const buildHeatsFromQualified = (qualified, seedBase) => {
      if (!qualified.length) {
        return [];
      }

      const heatSizes = this.splitKnockoutHeatSizes(qualified.length);
      if (!heatSizes.length) {
        return [];
      }

      const ordered = [...qualified].sort((a, b) => {
        if (a.pool_rank !== b.pool_rank) return a.pool_rank - b.pool_rank;
        if (b.points !== a.points) return b.points - a.points;
        if (a.position_sum !== b.position_sum) return a.position_sum - b.position_sum;
        const bibA = a.bib ?? 999999;
        const bibB = b.bib ?? 999999;
        if (bibA !== bibB) return bibA - bibB;
        return a.name.localeCompare(b.name);
      });

      const heats = [];
      let offset = 0;
      heatSizes.forEach((size, idx) => {
        const slice = ordered.slice(offset, offset + size);
        offset += size;
        heats.push({
          heat_id: -(seedBase + idx + 1),
          stage_tier: 0,
          heat_index: idx + 1,
          participants: slice.map((entry, slotIdx) => makeParticipant(entry, slotIdx + 1)),
        });
      });

      return heats;
    };

    const winnersHeats = buildHeatsFromQualified(winnersQualified, 1000);
    const losersHeats = buildHeatsFromQualified(losersQualified, 2000);

    const qualificationRound = Math.max(...Array.from(roundSet)) + 1;
    return {
      round: qualificationRound,
      winnersHeats,
      losersHeats,
    };
  }

  hasBracketHeats(eventId) {
    return this.repository.countBracketHeats(eventId) > 0;
  }

  insertQualificationHeats(eventId, qualification) {
    qualification.winnersHeats.forEach((heat) => {
      const heatId = this.repository.insertHeat(eventId, qualification.round, 'winners', 0, heat.heat_index);
      heat.participants.forEach((runner) => {
        this.repository.insertHeatParticipant(heatId, runner.id);
      });
    });

    qualification.losersHeats.forEach((heat) => {
      const heatId = this.repository.insertHeat(eventId, qualification.round, 'losers', 0, heat.heat_index);
      heat.participants.forEach((runner) => {
        this.repository.insertHeatParticipant(heatId, runner.id);
      });
    });
  }

  updateEventTotalRoundsAtLeast(eventId, round) {
    this.repository.updateEventTotalRoundsAtLeast(eventId, round);
  }

  needsLegacyQualificationRepair(eventId, qualification) {
    const qualificationRound = Number(qualification?.round || 0);
    if (!qualificationRound) return false;

    const bracketRows = this.repository.listBracketRowsForRepair(eventId);
    if (!bracketRows.length) return false;

    // Ne jamais reecrire un tableau deja entame.
    const hasBracketResults = bracketRows.some((row) => Number(row.filled || 0) > 0);
    if (hasBracketResults) return false;

    const hasInvalidSize = bracketRows.some((row) => {
      const slots = Number(row.slots || 0);
      return slots < 3 || slots > 4;
    });
    if (!hasInvalidSize) return false;

    const hasQualificationRound = bracketRows.some((row) => Number(row.round_number) === qualificationRound);
    return hasQualificationRound;
  }

  repairLegacyQualificationHeats(eventId, qualification) {
    if (!this.needsLegacyQualificationRepair(eventId, qualification)) {
      return false;
    }

    this.repository.runInTransaction(() => {
      this.repository.deleteBracketHeatsByEvent(eventId);
      this.insertQualificationHeats(eventId, qualification);
      this.updateEventTotalRoundsAtLeast(eventId, qualification.round);
    });
    return true;
  }

  ensureQualificationHeatsGenerated(eventId) {
    const qualification = this.buildPoolsQualification(eventId);
    if (!qualification) {
      return false;
    }

    if (this.repairLegacyQualificationHeats(eventId, qualification)) {
      return true;
    }

    if (this.hasBracketHeats(eventId)) {
      return false;
    }

    this.insertQualificationHeats(eventId, qualification);
    this.updateEventTotalRoundsAtLeast(eventId, qualification.round);

    return true;
  }

  roundFinished(eventId, round) {
    const rows = this.repository.listRoundFillStatus(eventId, round);
    if (!rows.length) return false;
    return rows.every((row) => Number(row.slots) === Number(row.filled));
  }

  roundBracketFinished(eventId, round, bracket) {
    const rows = this.repository.listBracketRoundFillStatus(eventId, round, bracket);
    if (!rows.length) return false;
    return rows.every((row) => Number(row.slots) > 0 && Number(row.slots) === Number(row.filled));
  }

  hasBracketRound(eventId, round, bracket) {
    return this.repository.countBracketRoundHeats(eventId, round, bracket) > 0;
  }

  splitKnockoutHeatSizes(count) {
    if (count < 3) return [];
    if (count <= 4) {
      return [count];
    }
    try {
      return this.splitIntoGroupsOf3Or4(count);
    } catch (err) {
      return [];
    }
  }

  collectBracketTransitions(eventId, round, bracket) {
    const rows = this.repository.listBracketTransitionRows(eventId, round, bracket);

    const byTier = new Map();
    rows.forEach((row) => {
      const tier = Number(row.stage_tier || 0);
      const heatIndex = Number(row.heat_index);
      if (!byTier.has(tier)) {
        byTier.set(tier, new Map());
      }
      const tierMap = byTier.get(tier);
      if (!tierMap.has(heatIndex)) {
        tierMap.set(heatIndex, []);
      }
      tierMap.get(heatIndex).push(Number(row.participant_id));
    });

    const transitions = new Map();
    const pushToTier = (tier, participantIds) => {
      if (!participantIds.length) return;
      if (!transitions.has(tier)) {
        transitions.set(tier, []);
      }
      transitions.get(tier).push(...participantIds);
    };

    const tiers = Array.from(byTier.keys()).sort((a, b) => a - b);
    tiers.forEach((tier) => {
      const heatsMap = byTier.get(tier);
      const heatIndexes = Array.from(heatsMap.keys()).sort((a, b) => a - b);
      if (heatIndexes.length <= 1) {
        // Un seul groupe dans ce niveau: finale de niveau, pas de propagation.
        return;
      }

      heatIndexes.forEach((heatIndex) => {
        const ranked = heatsMap.get(heatIndex) || [];
        const size = ranked.length;
        if (size <= 0) return;
        const toAdvance = size >= 3 ? 2 : 1;
        const advancers = ranked.slice(0, toAdvance);
        const dropped = ranked.slice(toAdvance);
        pushToTier(tier, advancers);
        pushToTier(tier + 1, dropped);
      });
    });

    return transitions;
  }

  generateNextBracketRound(eventId, bracket, fromRound) {
    const nextRound = Number(fromRound) + 1;
    if (this.hasBracketRound(eventId, nextRound, bracket)) {
      return false;
    }
    if (!this.roundBracketFinished(eventId, fromRound, bracket)) {
      return false;
    }

    const transitions = this.collectBracketTransitions(eventId, fromRound, bracket);
    const tiers = Array.from(transitions.keys()).sort((a, b) => a - b);
    const hasPlayableTier = tiers.some((tier) => {
      const ids = transitions.get(tier) || [];
      return ids.length >= 3;
    });
    if (!hasPlayableTier) {
      return false;
    }

    let nextHeatIndex = 1;
    let insertedAny = false;
    tiers.forEach((tier) => {
      const participantIds = transitions.get(tier) || [];
      if (participantIds.length < 3) {
        return;
      }
      const sizes = this.splitKnockoutHeatSizes(participantIds.length);
      if (!sizes.length) {
        return;
      }

      let offset = 0;
      sizes.forEach((size) => {
        const slice = participantIds.slice(offset, offset + size);
        offset += size;
        const heatId = this.repository.insertHeat(eventId, nextRound, bracket, tier, nextHeatIndex);
        insertedAny = true;
        nextHeatIndex += 1;
        slice.forEach((pid) => {
          this.repository.insertHeatParticipant(heatId, pid);
        });
      });
    });

    if (!insertedAny) {
      return false;
    }

    this.updateEventTotalRoundsAtLeast(eventId, nextRound);
    return true;
  }

  ensureBracketProgression(eventId) {
    let changed = false;
    let guard = 0;

    while (guard < 8) {
      let generatedInPass = false;
      ['winners', 'losers'].forEach((bracket) => {
        const fromRound = this.repository.getMaxBracketRound(eventId, bracket);
        if (!fromRound) {
          return;
        }
        if (this.generateNextBracketRound(eventId, bracket, fromRound)) {
          generatedInPass = true;
        }
      });

      if (!generatedInPass) {
        break;
      }
      changed = true;
      guard += 1;
    }

    return changed;
  }

  bracketView(eventId) {
    const qualification = this.buildPoolsQualification(eventId);
    const qualificationSeedByRunner = new Map();
    if (qualification) {
      qualification.winnersHeats.forEach((heat) => {
        heat.participants.forEach((runner) => {
          qualificationSeedByRunner.set(`winners:${qualification.round}:${heat.heat_index}:${runner.id}`, {
            position: runner.position,
            points: runner.points,
          });
        });
      });
      qualification.losersHeats.forEach((heat) => {
        heat.participants.forEach((runner) => {
          qualificationSeedByRunner.set(`losers:${qualification.round}:${heat.heat_index}:${runner.id}`, {
            position: runner.position,
            points: runner.points,
          });
        });
      });
    }

    const rows = this.repository.listBracketViewRows(eventId);
    const data = { initial: {}, winners: {}, losers: {} };

    rows.forEach((row) => {
      const bracket = row.bracket;
      const round = Number(row.round_number);
      const heatId = Number(row.heat_id);
      if (!data[bracket][round]) {
        data[bracket][round] = {};
      }
      if (!data[bracket][round][heatId]) {
        data[bracket][round][heatId] = {
          heat_id: heatId,
          stage_tier: Number(row.stage_tier || 0),
          heat_index: Number(row.heat_index),
          participants: [],
        };
      }
      const seedKey = `${bracket}:${round}:${Number(row.heat_index)}:${Number(row.participant_id)}`;
      const seed = qualificationSeedByRunner.get(seedKey);
      data[bracket][round][heatId].participants.push({
        id: Number(row.participant_id),
        name: row.name,
        position: row.position !== null ? Number(row.position) : (seed?.position ?? null),
        points: row.points !== null ? Number(row.points) : (seed?.points ?? null),
      });
    });

    const normalized = {};
    Object.entries(data).forEach(([bracket, rounds]) => {
      normalized[bracket] = {};
      Object.entries(rounds).forEach(([roundKey, heats]) => {
        const list = Object.values(heats).sort((a, b) => {
          if (a.stage_tier !== b.stage_tier) return a.stage_tier - b.stage_tier;
          return a.heat_index - b.heat_index;
        });
        normalized[bracket][Number(roundKey)] = list;
      });
      const sortedRounds = Object.keys(normalized[bracket]).map(Number).sort((a, b) => a - b);
      const tmp = {};
      sortedRounds.forEach((round) => {
        tmp[round] = normalized[bracket][round];
      });
      normalized[bracket] = tmp;
    });

    const hasWinnerHeats = Object.keys(normalized.winners || {}).length > 0;
    const hasLoserHeats = Object.keys(normalized.losers || {}).length > 0;
    if (!hasWinnerHeats && !hasLoserHeats && qualification) {
      const round = qualification.round;
      if (qualification.winnersHeats.length) {
        normalized.winners[round] = qualification.winnersHeats;
      }
      if (qualification.losersHeats.length) {
        normalized.losers[round] = qualification.losersHeats;
      }
    }

    return {
      initial: normalized.initial || {},
      winners: normalized.winners || {},
      losers: normalized.losers || {},
    };
  }

  leaderboard(eventId) {
    return this.repository.listLeaderboardRows(eventId);
  }

  eventComplete(eventId) {
    const rounds = this.repository.listEventRoundNumbers(eventId);
    if (!rounds.length) return false;
    return rounds.every((round) => this.roundFinished(eventId, round));
  }

  finalRanking(eventId) {
    if (this.repository.countBracketHeats(eventId) === 0) {
      return [];
    }
    if (!this.eventComplete(eventId)) {
      return [];
    }

    const rows = this.repository.listFinalRankingRows(eventId);
    if (!rows.length) {
      return [];
    }

    const latestByParticipant = new Map();
    rows.forEach((row) => {
      const pid = Number(row.participant_id);
      const current = latestByParticipant.get(pid);
      if (!current) {
        latestByParticipant.set(pid, row);
        return;
      }
      const curRound = Number(current.round_number);
      const newRound = Number(row.round_number);
      if (newRound > curRound) {
        latestByParticipant.set(pid, row);
        return;
      }
      if (newRound === curRound) {
        const curTier = Number(current.stage_tier || 0);
        const newTier = Number(row.stage_tier || 0);
        if (newTier < curTier) {
          latestByParticipant.set(pid, row);
          return;
        }
        if (newTier === curTier) {
          const curPos = Number(current.position || 999);
          const newPos = Number(row.position || 999);
          if (newPos < curPos) {
            latestByParticipant.set(pid, row);
          }
        }
      }
    });

    const rankingRows = Array.from(latestByParticipant.values());
    rankingRows.sort((a, b) => {
      const bracketA = a.bracket === 'winners' ? 0 : 1;
      const bracketB = b.bracket === 'winners' ? 0 : 1;
      if (bracketA !== bracketB) return bracketA - bracketB;

      const tierA = Number(a.stage_tier || 0);
      const tierB = Number(b.stage_tier || 0);
      if (tierA !== tierB) return tierA - tierB;

      const roundA = Number(a.round_number || 0);
      const roundB = Number(b.round_number || 0);
      if (roundA !== roundB) return roundB - roundA;

      const posA = Number(a.position || 999);
      const posB = Number(b.position || 999);
      if (posA !== posB) return posA - posB;

      const ptsA = Number(a.points || 0);
      const ptsB = Number(b.points || 0);
      if (ptsA !== ptsB) return ptsB - ptsA;

      return String(a.name).localeCompare(String(b.name));
    });

    return rankingRows.map((row, idx) => ({
      place: idx + 1,
      name: row.name,
      bracket: row.bracket,
      points: Number(row.points || 0),
      stage_tier: Number(row.stage_tier || 0),
      position: Number(row.position || 0),
    }));
  }
}

module.exports = {
  BracketService,
};
