(() => {
  if (typeof window === 'undefined') {
    return;
  }

  const STORAGE_KEY = 'xce-static-state-v1';
  const SEED_COUNTS = [8, 16, 32, 36, 48, 52, 64];
  const POINTS = [4, 3, 2, 1];

  function clone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function parseChrono(chrono) {
    if (!chrono) return [null, null];
    const trimmed = String(chrono).trim();

    let hh = 0;
    let mm = 0;
    let ss = 0;
    let cc = 0;
    let match = trimmed.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (match) {
      hh = Number(match[1]);
      mm = Number(match[2]);
      ss = Number(match[3]);
      cc = Number(match[4]);
    } else {
      match = trimmed.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
      if (!match) return [null, trimmed];
      mm = Number(match[1]);
      ss = Number(match[2]);
      cc = Number(match[3]);
    }

    const ms = ((hh * 3600 + mm * 60 + ss) * 1000) + cc * 10;
    const norm = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(cc).padStart(2, '0')}`;
    return [ms, norm];
  }

  function splitIntoGroupsOf3Or4(count) {
    if (count < 3) {
      throw new Error('Au moins 3 participants requis pour former des groupes de 3 ou 4.');
    }
    for (let nb4 = Math.floor(count / 4); nb4 >= 0; nb4 -= 1) {
      const remaining = count - nb4 * 4;
      if (remaining === 0) {
        return Array(nb4).fill(4);
      }
      if (remaining % 3 === 0) {
        const nb3 = remaining / 3;
        return [...Array(nb4).fill(4), ...Array(nb3).fill(3)];
      }
    }
    throw new Error('Impossible de former uniquement des groupes de 3 ou 4 avec ce nombre de participants.');
  }

  function splitKnockoutHeatSizes(count) {
    if (count < 3) return [];
    if (count <= 4) return [count];
    try {
      return splitIntoGroupsOf3Or4(count);
    } catch (err) {
      return [];
    }
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function pointsFromPosition(position) {
    return POINTS[position - 1] ?? POINTS[POINTS.length - 1];
  }

  function defaultState() {
    return {
      seq: {
        participant: 1,
        event: 1,
        heat: 1,
      },
      participants: [],
      events: [],
      activeEventId: null,
    };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      const base = defaultState();
      const state = {
        ...base,
        ...parsed,
      };
      state.seq = {
        ...base.seq,
        ...(parsed.seq || {}),
      };
      state.participants = Array.isArray(parsed.participants) ? parsed.participants : [];
      state.events = Array.isArray(parsed.events) ? parsed.events : [];

      const maxParticipantId = state.participants.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
      const maxEventId = state.events.reduce((max, row) => Math.max(max, Number(row.id) || 0), 0);
      const maxHeatId = state.events.reduce((max, event) => {
        const heats = Array.isArray(event.heats) ? event.heats : [];
        return Math.max(max, ...heats.map((heat) => Number(heat.id) || 0), 0);
      }, 0);

      state.seq.participant = Math.max(Number(state.seq.participant) || 1, maxParticipantId + 1);
      state.seq.event = Math.max(Number(state.seq.event) || 1, maxEventId + 1);
      state.seq.heat = Math.max(Number(state.seq.heat) || 1, maxHeatId + 1);

      state.events.forEach((event) => {
        event.heats = Array.isArray(event.heats) ? event.heats : [];
        event.participantIds = Array.isArray(event.participantIds) ? event.participantIds : [];
        event.eventPoints = event.eventPoints && typeof event.eventPoints === 'object' ? event.eventPoints : {};
      });

      return state;
    } catch (err) {
      return defaultState();
    }
  }

  const state = loadState();

  function saveState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function listParticipants() {
    return clone(state.participants).sort((a, b) => {
      const bibA = a.bib === null || a.bib === undefined ? 999999 : Number(a.bib);
      const bibB = b.bib === null || b.bib === undefined ? 999999 : Number(b.bib);
      if (bibA !== bibB) return bibA - bibB;
      return String(a.name).localeCompare(String(b.name));
    });
  }

  function getEvent(eventId) {
    return state.events.find((event) => Number(event.id) === Number(eventId)) || null;
  }

  function getLatestEvent() {
    if (!state.events.length) return null;
    return [...state.events].sort((a, b) => Number(b.id) - Number(a.id))[0];
  }

  function getActiveEvent() {
    if (!state.activeEventId) return null;
    return getEvent(state.activeEventId);
  }

  function createHeat(eventId, roundNumber, bracket, stageTier, heatIndex, participantIds, seedMap = null) {
    const heat = {
      id: state.seq.heat,
      eventId: Number(eventId),
      roundNumber: Number(roundNumber),
      bracket: String(bracket),
      stageTier: Number(stageTier || 0),
      heatIndex: Number(heatIndex),
      participantIds: [...participantIds],
      seed: seedMap ? clone(seedMap) : {},
      times: {},
      results: {},
    };
    state.seq.heat += 1;
    return heat;
  }

  function participantsForHeat(heat) {
    const rows = heat.participantIds
      .map((participantId) => {
        const participant = state.participants.find((row) => Number(row.id) === Number(participantId));
        if (!participant) return null;
        return {
          participant_id: Number(participant.id),
          name: participant.name,
          bib: participant.bib,
        };
      })
      .filter(Boolean);

    const ordered = [...rows].sort((a, b) => {
      const bibA = a.bib ?? 999999;
      const bibB = b.bib ?? 999999;
      if (bibA !== bibB) return bibA - bibB;
      return a.participant_id - b.participant_id;
    });

    const chronoOrder = new Map(ordered.map((row, index) => [row.participant_id, index + 1]));
    return rows.map((row) => ({
      ...row,
      chrono_order: chronoOrder.get(row.participant_id) || null,
    }));
  }

  function getHeats(event, roundNumber) {
    return event.heats
      .filter((heat) => Number(heat.roundNumber) === Number(roundNumber))
      .sort((a, b) => {
        const bracketDiff = String(a.bracket).localeCompare(String(b.bracket));
        if (bracketDiff !== 0) return bracketDiff;
        const tierDiff = Number(a.stageTier || 0) - Number(b.stageTier || 0);
        if (tierDiff !== 0) return tierDiff;
        return Number(a.heatIndex) - Number(b.heatIndex);
      })
      .map((heat) => ({
        ...clone(heat),
        participants: participantsForHeat(heat),
      }));
  }

  function roundFinished(event, roundNumber) {
    const heats = event.heats.filter((heat) => Number(heat.roundNumber) === Number(roundNumber));
    if (!heats.length) return false;
    return heats.every((heat) => Object.keys(heat.results || {}).length === heat.participantIds.length);
  }

  function timesComplete(event, roundNumber) {
    const heats = event.heats.filter((heat) => Number(heat.roundNumber) === Number(roundNumber));
    if (!heats.length) return false;
    return heats.every((heat) => Object.keys(heat.times || {}).length === heat.participantIds.length);
  }

  function eventComplete(event) {
    const rounds = Array.from(new Set(event.heats.map((heat) => Number(heat.roundNumber)))).sort((a, b) => a - b);
    if (!rounds.length) return false;
    return rounds.every((roundNumber) => roundFinished(event, roundNumber));
  }

  function recalcEventPoints(event) {
    const next = {};
    event.participantIds.forEach((participantId) => {
      next[String(participantId)] = 0;
    });

    event.heats.forEach((heat) => {
      Object.entries(heat.results || {}).forEach(([participantId, result]) => {
        next[String(participantId)] = (next[String(participantId)] || 0) + Number(result.points || 0);
      });
    });

    event.eventPoints = next;
  }

  function addParticipantAutoBib(name) {
    const trimmed = String(name || '').trim();
    if (!trimmed) throw new Error('Nom requis');
    if (state.participants.some((participant) => participant.name === trimmed)) {
      return;
    }

    const nextBib = state.participants.reduce((max, participant) => {
      const bib = Number(participant.bib);
      return Number.isFinite(bib) ? Math.max(max, bib) : max;
    }, 0) + 1;

    state.participants.push({
      id: state.seq.participant,
      name: trimmed,
      bib: nextBib,
    });
    state.seq.participant += 1;
    saveState();
  }

  function seedParticipants(count) {
    if (!SEED_COUNTS.includes(count)) {
      throw new Error('Taille de liste non autorisee');
    }

    state.participants = [];
    state.events = [];
    state.activeEventId = null;
    state.seq = { participant: 1, event: 1, heat: 1 };

    for (let i = 1; i <= count; i += 1) {
      state.participants.push({
        id: state.seq.participant,
        name: `Coureur ${String(i).padStart(2, '0')}`,
        bib: i,
      });
      state.seq.participant += 1;
    }

    saveState();
  }

  function deleteParticipant(participantId) {
    const pid = Number(participantId);
    if (!pid) return;

    state.participants = state.participants.filter((participant) => Number(participant.id) !== pid);
    state.events.forEach((event) => {
      event.participantIds = event.participantIds.filter((id) => Number(id) !== pid);
      delete event.eventPoints[String(pid)];
      event.heats.forEach((heat) => {
        heat.participantIds = heat.participantIds.filter((id) => Number(id) !== pid);
        delete heat.seed[String(pid)];
        delete heat.times[String(pid)];
        delete heat.results[String(pid)];
      });
    });

    saveState();
  }

  function deleteAllParticipants() {
    state.participants = [];
    state.events = [];
    state.activeEventId = null;
    state.seq = { participant: 1, event: 1, heat: 1 };
    saveState();
  }

  function startEvent(name, totalRounds = 3, category = 'Open') {
    const participants = listParticipants();
    if (participants.length < 2) {
      throw new Error('Au moins 2 participants necessaires');
    }

    state.events.forEach((event) => {
      if (event.status === 'active') {
        event.status = 'archived';
      }
    });

    const ids = participants.map((participant) => participant.id);
    const evenIds = ids.filter((id) => id % 2 === 0);
    const oddIds = ids.filter((id) => id % 2 !== 0);
    shuffle(evenIds);
    shuffle(oddIds);
    const orderedIds = [...evenIds, ...oddIds];
    const groupSizes = splitIntoGroupsOf3Or4(orderedIds.length);

    const event = {
      id: state.seq.event,
      name: (String(name || '').trim() || 'Course XCE'),
      category: (String(category || '').trim() || 'Open'),
      totalRounds: Number(totalRounds || 3),
      status: 'active',
      createdAt: new Date().toISOString(),
      participantIds: [...orderedIds],
      eventPoints: Object.fromEntries(orderedIds.map((id) => [String(id), 0])),
      heats: [],
    };
    state.seq.event += 1;

    for (let roundNumber = 1; roundNumber <= event.totalRounds; roundNumber += 1) {
      let offset = 0;
      groupSizes.forEach((size, index) => {
        const group = orderedIds.slice(offset, offset + size);
        offset += size;
        event.heats.push(createHeat(event.id, roundNumber, 'initial', 0, index + 1, group));
      });
    }

    state.events.push(event);
    state.activeEventId = event.id;
    saveState();
  }

  function closeEvent(eventId) {
    const event = getEvent(eventId);
    if (!event) return;

    event.status = 'archived';
    if (Number(state.activeEventId) === Number(event.id)) {
      state.activeEventId = null;
    }
    saveState();
  }

  function saveTimes(eventId, roundNumber, timesGlobal) {
    const event = getEvent(eventId);
    if (!event) throw new Error('Evenement introuvable');
    if (!timesGlobal || !Object.keys(timesGlobal).length) throw new Error('Aucun chrono transmis');

    Object.entries(timesGlobal).forEach(([participantIdRaw, chrono]) => {
      const participantId = Number(participantIdRaw);
      const heat = event.heats.find(
        (item) => Number(item.roundNumber) === Number(roundNumber)
          && item.participantIds.some((id) => Number(id) === participantId)
      );
      if (!heat) return;
      const [time_ms, time_text] = parseChrono(chrono);
      heat.times[String(participantId)] = { time_ms, time_text };
    });

    saveState();
  }

  function saveResults(eventId, roundNumber, results) {
    const event = getEvent(eventId);
    if (!event) throw new Error('Evenement introuvable');
    if (!results || !Object.keys(results).length) throw new Error('Aucun resultat transmis');

    Object.entries(results).forEach(([heatIdRaw, byParticipant]) => {
      const heatId = Number(heatIdRaw);
      if (!Number.isFinite(heatId) || heatId <= 0) return;
      const heat = event.heats.find(
        (item) => Number(item.id) === heatId && Number(item.roundNumber) === Number(roundNumber)
      );
      if (!heat || !heat.participantIds.length) return;

      const positions = Object.values(byParticipant).map((value) => Number(value));
      const uniquePositions = new Set(positions);
      if (uniquePositions.size !== positions.length) {
        throw new Error(`Positions dupliquees dans le groupe ${heatId}`);
      }
      const maxPos = Math.max(...positions);
      const minPos = Math.min(...positions);
      if (maxPos > heat.participantIds.length || minPos < 1) {
        throw new Error(`Positions invalides dans le groupe ${heatId}`);
      }

      heat.results = {};
      Object.entries(byParticipant).forEach(([participantIdRaw, posRaw]) => {
        const participantId = Number(participantIdRaw);
        const position = Number(posRaw);
        const points = pointsFromPosition(position);
        const time = heat.times[String(participantId)] || { time_ms: null, time_text: null };
        heat.results[String(participantId)] = {
          position,
          points,
          time_ms: time.time_ms,
          time_text: time.time_text,
        };
      });
      heat.times = {};
    });

    recalcEventPoints(event);
    ensureQualificationHeatsGenerated(event);
    ensureBracketProgression(event);
    saveState();
  }

  function buildPoolsQualification(event) {
    const initialHeats = event.heats.filter((heat) => heat.bracket === 'initial');
    if (!initialHeats.length) return null;

    const rounds = Array.from(new Set(initialHeats.map((heat) => Number(heat.roundNumber))));
    if (rounds.length < 3) return null;
    if (!rounds.every((roundNumber) => roundFinished(event, roundNumber))) return null;

    const byPool = new Map();
    initialHeats.forEach((heat) => {
      const poolIndex = Number(heat.heatIndex);
      if (!byPool.has(poolIndex)) {
        byPool.set(poolIndex, new Map());
      }
      const pool = byPool.get(poolIndex);

      heat.participantIds.forEach((participantId) => {
        const participant = state.participants.find((row) => Number(row.id) === Number(participantId));
        if (!participant) return;

        if (!pool.has(participantId)) {
          pool.set(participantId, {
            id: Number(participantId),
            name: participant.name,
            bib: participant.bib ?? null,
            points: 0,
            position_sum: 0,
            best_position: Number.POSITIVE_INFINITY,
          });
        }

        const entry = pool.get(participantId);
        const result = heat.results[String(participantId)];
        if (!result) return;

        entry.points += Number(result.points || 0);
        entry.position_sum += Number(result.position || 0);
        entry.best_position = Math.min(entry.best_position, Number(result.position || 999));
      });
    });

    const winnersQualified = [];
    const losersQualified = [];

    Array.from(byPool.keys()).sort((a, b) => a - b).forEach((poolIndex) => {
      const ranked = Array.from(byPool.get(poolIndex).values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (a.position_sum !== b.position_sum) return a.position_sum - b.position_sum;
        if (a.best_position !== b.best_position) return a.best_position - b.best_position;
        const bibA = a.bib ?? 999999;
        const bibB = b.bib ?? 999999;
        if (bibA !== bibB) return bibA - bibB;
        return a.name.localeCompare(b.name);
      });

      if (!ranked.length) return;
      const winnersCount = ranked.length <= 1 ? ranked.length : Math.min(2, ranked.length - 1);

      ranked.slice(0, winnersCount).forEach((entry, idx) => {
        winnersQualified.push({ ...entry, pool_rank: idx + 1 });
      });
      ranked.slice(winnersCount).forEach((entry, idx) => {
        losersQualified.push({ ...entry, pool_rank: winnersCount + idx + 1 });
      });
    });

    function buildHeatsFromQualified(qualified, bracket, roundNumber) {
      if (!qualified.length) return [];
      const heatSizes = splitKnockoutHeatSizes(qualified.length);
      if (!heatSizes.length) return [];

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
      heatSizes.forEach((size, index) => {
        const slice = ordered.slice(offset, offset + size);
        offset += size;

        const seedMap = {};
        slice.forEach((entry, slotIndex) => {
          seedMap[String(entry.id)] = {
            position: slotIndex + 1,
            points: entry.points,
          };
        });

        heats.push(createHeat(
          event.id,
          roundNumber,
          bracket,
          0,
          index + 1,
          slice.map((entry) => entry.id),
          seedMap
        ));
      });

      return heats;
    }

    const qualificationRound = Math.max(...rounds) + 1;
    return {
      round: qualificationRound,
      winnersHeats: buildHeatsFromQualified(winnersQualified, 'winners', qualificationRound),
      losersHeats: buildHeatsFromQualified(losersQualified, 'losers', qualificationRound),
    };
  }

  function ensureQualificationHeatsGenerated(event) {
    const hasBracketHeats = event.heats.some((heat) => heat.bracket === 'winners' || heat.bracket === 'losers');
    if (hasBracketHeats) return false;

    const qualification = buildPoolsQualification(event);
    if (!qualification) return false;

    event.heats.push(...qualification.winnersHeats, ...qualification.losersHeats);
    event.totalRounds = Math.max(Number(event.totalRounds || 3), Number(qualification.round));
    return true;
  }

  function roundBracketFinished(event, roundNumber, bracket) {
    const heats = event.heats.filter(
      (heat) => Number(heat.roundNumber) === Number(roundNumber) && heat.bracket === bracket
    );
    if (!heats.length) return false;
    return heats.every((heat) => Object.keys(heat.results || {}).length === heat.participantIds.length);
  }

  function collectBracketTransitions(event, roundNumber, bracket) {
    const heats = event.heats
      .filter((heat) => Number(heat.roundNumber) === Number(roundNumber) && heat.bracket === bracket)
      .sort((a, b) => {
        const tierDiff = Number(a.stageTier || 0) - Number(b.stageTier || 0);
        if (tierDiff !== 0) return tierDiff;
        return Number(a.heatIndex) - Number(b.heatIndex);
      });

    const byTier = new Map();
    heats.forEach((heat) => {
      const tier = Number(heat.stageTier || 0);
      if (!byTier.has(tier)) {
        byTier.set(tier, []);
      }
      byTier.get(tier).push(heat);
    });

    const transitions = new Map();

    function pushToTier(tier, participantIds) {
      if (!participantIds.length) return;
      if (!transitions.has(tier)) {
        transitions.set(tier, []);
      }
      transitions.get(tier).push(...participantIds);
    }

    Array.from(byTier.keys()).sort((a, b) => a - b).forEach((tier) => {
      const tierHeats = byTier.get(tier);
      if (tierHeats.length <= 1) {
        return;
      }

      tierHeats.forEach((heat) => {
        const ranked = [...heat.participantIds].sort((a, b) => {
          const resultA = heat.results[String(a)] || { position: 999 };
          const resultB = heat.results[String(b)] || { position: 999 };
          return Number(resultA.position || 999) - Number(resultB.position || 999);
        });

        const toAdvance = ranked.length >= 3 ? 2 : 1;
        pushToTier(tier, ranked.slice(0, toAdvance));
        pushToTier(tier + 1, ranked.slice(toAdvance));
      });
    });

    return transitions;
  }

  function generateNextBracketRound(event, bracket, fromRound) {
    const nextRound = Number(fromRound) + 1;
    const hasNext = event.heats.some(
      (heat) => Number(heat.roundNumber) === nextRound && heat.bracket === bracket
    );
    if (hasNext) return false;
    if (!roundBracketFinished(event, fromRound, bracket)) return false;

    const transitions = collectBracketTransitions(event, fromRound, bracket);
    const tiers = Array.from(transitions.keys()).sort((a, b) => a - b);

    let inserted = false;
    let nextHeatIndex = 1;

    tiers.forEach((tier) => {
      const participantIds = transitions.get(tier) || [];
      if (participantIds.length < 3) return;

      const sizes = splitKnockoutHeatSizes(participantIds.length);
      if (!sizes.length) return;

      let offset = 0;
      sizes.forEach((size) => {
        const slice = participantIds.slice(offset, offset + size);
        offset += size;
        event.heats.push(createHeat(event.id, nextRound, bracket, tier, nextHeatIndex, slice));
        nextHeatIndex += 1;
        inserted = true;
      });
    });

    if (inserted) {
      event.totalRounds = Math.max(Number(event.totalRounds || 3), nextRound);
    }

    return inserted;
  }

  function ensureBracketProgression(event) {
    let changed = false;
    let guard = 0;

    while (guard < 8) {
      let generated = false;
      ['winners', 'losers'].forEach((bracket) => {
        const rounds = event.heats
          .filter((heat) => heat.bracket === bracket)
          .map((heat) => Number(heat.roundNumber));
        if (!rounds.length) return;

        const fromRound = Math.max(...rounds);
        if (generateNextBracketRound(event, bracket, fromRound)) {
          generated = true;
        }
      });

      if (!generated) {
        break;
      }
      changed = true;
      guard += 1;
    }

    return changed;
  }

  function roundToPlay(event) {
    let changed = false;
    if (ensureQualificationHeatsGenerated(event)) changed = true;
    if (ensureBracketProgression(event)) changed = true;
    if (changed) saveState();

    const rounds = Array.from(new Set(event.heats.map((heat) => Number(heat.roundNumber)))).sort((a, b) => a - b);
    for (const roundNumber of rounds) {
      if (!roundFinished(event, roundNumber)) {
        return roundNumber;
      }
    }
    return null;
  }

  function bracketView(event) {
    const rows = { initial: {}, winners: {}, losers: {} };

    event.heats
      .slice()
      .sort((a, b) => {
        const bracketDiff = String(a.bracket).localeCompare(String(b.bracket));
        if (bracketDiff !== 0) return bracketDiff;
        const roundDiff = Number(a.roundNumber) - Number(b.roundNumber);
        if (roundDiff !== 0) return roundDiff;
        const tierDiff = Number(a.stageTier || 0) - Number(b.stageTier || 0);
        if (tierDiff !== 0) return tierDiff;
        return Number(a.heatIndex) - Number(b.heatIndex);
      })
      .forEach((heat) => {
        if (!rows[heat.bracket][heat.roundNumber]) {
          rows[heat.bracket][heat.roundNumber] = [];
        }

        rows[heat.bracket][heat.roundNumber].push({
          heat_id: Number(heat.id),
          stage_tier: Number(heat.stageTier || 0),
          heat_index: Number(heat.heatIndex),
          participants: heat.participantIds.map((participantId) => {
            const participant = state.participants.find((row) => Number(row.id) === Number(participantId));
            const result = heat.results[String(participantId)] || null;
            const seed = heat.seed[String(participantId)] || null;
            return {
              id: Number(participantId),
              name: participant ? participant.name : `Participant ${participantId}`,
              position: result ? Number(result.position) : (seed ? Number(seed.position) : null),
              points: result ? Number(result.points) : (seed ? Number(seed.points) : null),
            };
          }),
        });
      });

    Object.values(rows).forEach((roundMap) => {
      Object.keys(roundMap).forEach((round) => {
        roundMap[round].sort((a, b) => {
          if (a.stage_tier !== b.stage_tier) return a.stage_tier - b.stage_tier;
          return a.heat_index - b.heat_index;
        });
      });
    });

    return rows;
  }

  function finalRanking(event) {
    const hasBracketHeats = event.heats.some((heat) => heat.bracket === 'winners' || heat.bracket === 'losers');
    if (!hasBracketHeats) return [];
    if (!eventComplete(event)) return [];

    const latestByParticipant = new Map();

    event.heats
      .filter((heat) => heat.bracket === 'winners' || heat.bracket === 'losers')
      .forEach((heat) => {
        Object.entries(heat.results || {}).forEach(([participantIdRaw, result]) => {
          const participantId = Number(participantIdRaw);
          const row = {
            participant_id: participantId,
            bracket: heat.bracket,
            round_number: Number(heat.roundNumber),
            stage_tier: Number(heat.stageTier || 0),
            position: Number(result.position || 0),
            points: Number(event.eventPoints[String(participantId)] || 0),
          };

          const current = latestByParticipant.get(participantId);
          if (!current) {
            latestByParticipant.set(participantId, row);
            return;
          }

          if (row.round_number > current.round_number) {
            latestByParticipant.set(participantId, row);
            return;
          }

          if (row.round_number === current.round_number) {
            if (row.stage_tier < current.stage_tier) {
              latestByParticipant.set(participantId, row);
              return;
            }

            if (row.stage_tier === current.stage_tier && row.position < current.position) {
              latestByParticipant.set(participantId, row);
            }
          }
        });
      });

    const rows = Array.from(latestByParticipant.values())
      .map((row) => {
        const participant = state.participants.find((item) => Number(item.id) === Number(row.participant_id));
        return {
          ...row,
          name: participant ? participant.name : `Participant ${row.participant_id}`,
        };
      })
      .sort((a, b) => {
        const bracketA = a.bracket === 'winners' ? 0 : 1;
        const bracketB = b.bracket === 'winners' ? 0 : 1;
        if (bracketA !== bracketB) return bracketA - bracketB;

        if (a.stage_tier !== b.stage_tier) return a.stage_tier - b.stage_tier;
        if (a.round_number !== b.round_number) return b.round_number - a.round_number;
        if (a.position !== b.position) return a.position - b.position;
        if (a.points !== b.points) return b.points - a.points;
        return a.name.localeCompare(b.name);
      });

    return rows.map((row, index) => ({
      place: index + 1,
      name: row.name,
      bracket: row.bracket,
      stage_tier: row.stage_tier,
    }));
  }

  function chronoBoard(event) {
    const bestByParticipant = new Map(listParticipants().map((participant) => [participant.id, {
      id: participant.id,
      name: participant.name,
      bib: participant.bib,
      best_ms: null,
      best_text: null,
      rank: null,
    }]));

    if (event) {
      event.heats.forEach((heat) => {
        Object.entries(heat.times || {}).forEach(([participantIdRaw, time]) => {
          const participantId = Number(participantIdRaw);
          const entry = bestByParticipant.get(participantId);
          if (!entry) return;

          const ms = time.time_ms === null || time.time_ms === undefined ? null : Number(time.time_ms);
          if (ms !== null && (entry.best_ms === null || ms < entry.best_ms)) {
            entry.best_ms = ms;
            entry.best_text = time.time_text || entry.best_text;
          }
        });

        Object.entries(heat.results || {}).forEach(([participantIdRaw, result]) => {
          const participantId = Number(participantIdRaw);
          const entry = bestByParticipant.get(participantId);
          if (!entry) return;

          const ms = result.time_ms === null || result.time_ms === undefined ? null : Number(result.time_ms);
          if (ms !== null && (entry.best_ms === null || ms < entry.best_ms)) {
            entry.best_ms = ms;
            entry.best_text = result.time_text || entry.best_text;
          }
        });
      });
    }

    const rows = Array.from(bestByParticipant.values()).sort((a, b) => {
      const aNull = a.best_ms === null;
      const bNull = b.best_ms === null;
      if (aNull && bNull) return a.name.localeCompare(b.name);
      if (aNull) return 1;
      if (bNull) return -1;
      if (a.best_ms !== b.best_ms) return a.best_ms - b.best_ms;
      return a.name.localeCompare(b.name);
    });

    let rank = 0;
    let last = null;
    rows.forEach((row) => {
      if (row.best_ms === null) {
        row.rank = null;
        return;
      }
      if (last === null || row.best_ms !== last) {
        rank += 1;
        last = row.best_ms;
      }
      row.rank = rank;
    });

    return rows;
  }

  function buildHomeView(error = null) {
    const activeEvent = getActiveEvent();
    const latestEvent = activeEvent || getLatestEvent();
    const participants = listParticipants();
    const currentRound = activeEvent ? roundToPlay(activeEvent) : null;
    const heats = activeEvent && currentRound ? getHeats(activeEvent, currentRound) : [];
    const brackets = latestEvent ? bracketView(latestEvent) : { initial: {}, winners: {}, losers: {} };
    const ranking = latestEvent ? finalRanking(latestEvent) : [];
    const chrono = chronoBoard(latestEvent);
    const chronosDone = activeEvent && currentRound
      ? (currentRound > 1 || timesComplete(activeEvent, currentRound))
      : false;

    const currentRoundParticipants = {};
    heats.forEach((heat) => {
      heat.participants.forEach((participant) => {
        currentRoundParticipants[participant.participant_id] = participant.name;
      });
    });

    return {
      error,
      activeEvent: activeEvent ? clone(activeEvent) : null,
      latestEvent: latestEvent ? clone(latestEvent) : null,
      participants,
      currentRound,
      heats,
      brackets,
      finalRanking: ranking,
      chronoBoard: chrono,
      chronosDone,
      currentRoundParticipants,
    };
  }

  function clearStorage() {
    state.participants = [];
    state.events = [];
    state.activeEventId = null;
    state.seq = { participant: 1, event: 1, heat: 1 };
    saveState();
  }

  window.XCEState = {
    SEED_COUNTS,
    buildHomeView,
    addParticipantAutoBib,
    seedParticipants,
    deleteParticipant,
    deleteAllParticipants,
    startEvent,
    closeEvent,
    saveTimes,
    saveResults,
    clearStorage,
  };
})();
