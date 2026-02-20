(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function pointsFromPosition(position) {
    const map = [4, 3, 2, 1];
    if (!position) return 0;
    return map[position - 1] || 1;
  }

  function computeInitialTotals(brackets) {
    const totals = {};
    Object.values(brackets.initial || {}).forEach((roundHeats) => {
      roundHeats.forEach((heat) => {
        heat.participants.forEach((runner) => {
          if (runner.id === null || runner.id === undefined) return;
          const points = runner.points !== null && runner.points !== undefined
            ? Number(runner.points)
            : pointsFromPosition(Number(runner.position || 0));
          totals[runner.id] = (totals[runner.id] || 0) + points;
        });
      });
    });
    return totals;
  }

  function renderParticipantsSection(view) {
    const tableHtml = view.participants.length
      ? `
      <table>
        <tr>
          <th>#</th><th>Nom</th><th>Dossard</th><th>Meilleur chrono</th><th>Rang chrono</th><th>Actions</th>
        </tr>
        ${view.chronoBoard.map((row, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.bib ?? '-'}</td>
            <td>${row.best_text || '-'}</td>
            <td>${row.rank || '-'}</td>
            <td>
              <button type="button" class="danger" data-action="delete-participant" data-participant-id="${row.id}">Supprimer</button>
            </td>
          </tr>
        `).join('')}
      </table>
    `
      : '<p>Ajoute tes premiers participants.</p>';

    const seedButtons = (window.XCEState.SEED_COUNTS || [])
      .map((count) => `<button type="button" class="secondary" data-action="seed" data-count="${count}">Liste ${count}</button>`)
      .join('');

    return `
      <h2>Participants</h2>
      ${tableHtml}
      <div class="actions">
        ${seedButtons}
        <button type="button" class="danger" data-action="delete-all-participants">Supprimer tous</button>
      </div>
      <form id="add-participant-form">
        <label>Nom du participant
          <input type="text" name="name" required>
        </label>
        <button type="submit">Ajouter</button>
      </form>
    `;
  }

  function renderEventSection(view) {
    if (view.activeEvent) {
      return `
        <h2>Evenement</h2>
        <p>Evenement actif : <strong>${escapeHtml(view.activeEvent.name)}</strong> (${view.activeEvent.totalRounds} tours)</p>
        <p style="margin-top:4px;color:#555;">Categorie : <strong>${escapeHtml(view.activeEvent.category || 'Open')}</strong></p>
        <button type="button" data-action="close-event" data-event-id="${view.activeEvent.id}">Terminer l'evenement</button>
      `;
    }

    return `
      <h2>Evenement</h2>
      <p>Cree un evenement pour generer le tour 1 (groupes randomises).</p>
      <form id="start-event-form">
        <label>Nom
          <input type="text" name="event_name" placeholder="Course XCE locale" required>
        </label>
        <label>Categorie
          <input type="text" name="event_category" placeholder="Open / U17 / Dames..." />
        </label>
        <button type="submit">Demarrer (3 tours)</button>
      </form>
    `;
  }

  function renderRoundSection(view) {
    if (!view.activeEvent) {
      return `
        <h2>Tour en cours</h2>
        <p class="muted">Demarre un evenement pour lancer les tours.</p>
      `;
    }

    if (view.currentRound && !view.chronosDone) {
      const participants = Object.entries(view.currentRoundParticipants).sort((a, b) => Number(a[0]) - Number(b[0]));
      if (!participants.length) {
        return `
          <h2>Tour en cours</h2>
          <p>Tour n ${view.currentRound} / ${view.activeEvent.totalRounds}</p>
          <p class="muted">Aucun participant a chronometrer.</p>
        `;
      }

      return `
        <h2>Tour en cours</h2>
        <p>Tour n ${view.currentRound} / ${view.activeEvent.totalRounds}</p>
        <form id="round-times-form" data-event-id="${view.activeEvent.id}" data-round="${view.currentRound}">
          <div class="chrono-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
              <h3 style="margin:0;">Chronos (ordre dossard)</h3>
              <button type="button" id="fill-random" class="secondary">Pre-remplir aleatoirement</button>
            </div>
            ${participants.map(([participantId, participantName]) => `
              <label>
                ${escapeHtml(participantName)} - chrono (hh:mm:ss:cc)
                <input
                  type="text"
                  name="times_global[${participantId}]"
                  placeholder="00:01:32:12"
                  pattern="[0-9]{2}:[0-9]{2}:[0-9]{2}:[0-9]{2}"
                  inputmode="numeric"
                >
              </label>
            `).join('')}
          </div>
          <button type="submit">Enregistrer les chronos</button>
        </form>
      `;
    }

    if (view.currentRound && view.chronosDone) {
      return `
        <h2>Tour en cours</h2>
        <p>Tour n ${view.currentRound} / ${view.activeEvent.totalRounds}</p>
        <form id="round-results-form" data-event-id="${view.activeEvent.id}" data-round="${view.currentRound}">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;">
            <div></div>
            <button type="button" id="results-random" class="secondary">Resultats aleatoires</button>
          </div>
          <div class="flex">
            ${view.heats.map((heat) => `
              <fieldset class="heat" data-heat-id="${heat.id}">
                <legend>
                  Groupe ${heat.heatIndex}
                  ${Number(heat.stageTier || 0) > 0 ? '<span class="badge">classement</span>' : ''}
                  ${heat.bracket === 'winners' ? '<span class="badge win">gagnante</span>' : ''}
                  ${heat.bracket === 'losers' ? '<span class="badge lose">perdante</span>' : ''}
                  ${heat.bracket === 'initial' ? '<span class="badge">initiale</span>' : ''}
                </legend>
                ${heat.participants.map((participant) => `
                  <label>
                    ${escapeHtml(participant.name)} (ordre chrono: ${participant.chrono_order ?? '-'}) - position
                    <input type="number" data-participant-id="${participant.participant_id}" min="1" max="${heat.participants.length}" required>
                  </label>
                `).join('')}
              </fieldset>
            `).join('')}
          </div>
          <button type="submit">Enregistrer les resultats</button>
        </form>
      `;
    }

    return `
      <h2>Tour en cours</h2>
      <p>Tous les tours (${view.activeEvent.totalRounds}) sont termines.</p>
    `;
  }

  function renderBracketCard(title, pillClass, pillLabel, rounds, options) {
    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
    if (!roundNumbers.length) {
      return `
        <div class="bracket-card">
          <div class="bracket-title">${title} <span class="pill ${pillClass}">${pillLabel}</span></div>
          <p class="muted">${options.emptyText}</p>
        </div>
      `;
    }

    return `
      <div class="bracket-card">
        <div class="bracket-title">${title} <span class="pill ${pillClass}">${pillLabel}</span></div>
        <div class="${options.tree ? 'rounds tree' : 'rounds'}"${options.tree ? ` data-connector-color="${options.connectorColor}"` : ''}>
          ${roundNumbers.map((round) => `
            <div class="round">
              <div class="round-title">Tour ${round}</div>
              ${rounds[round].map((heat) => `
                <div class="match ${options.matchClass}">
                  <div class="match-head">Groupe ${heat.heat_index}${Number(heat.stage_tier || 0) > 0 ? ' - classement' : ''}</div>
                  <ul class="match-list">
                    ${heat.participants.map((runner) => {
                      const position = runner.position;
                      const posClass = position ? `pos${position}` : '';
                      const label = position ? `#${position}` : '?';
                      const total = options.initialTotals ? options.initialTotals[runner.id] : null;
                      return `
                        <li>
                          <span>${escapeHtml(runner.name)}</span>
                          <span class="pos-chip ${posClass}">${label}</span>
                          ${options.showTotals ? `<span class="pts-chip">${total !== null && total !== undefined ? `total ${total} pts` : '-'}</span>` : ''}
                        </li>
                      `;
                    }).join('')}
                  </ul>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderBracketSection(view) {
    if (!view.latestEvent) {
      return '<h2>Tableau graphique</h2><p class="muted">Cree d abord un evenement.</p>';
    }

    const totals = computeInitialTotals(view.brackets);
    return `
      <h2>Tableau graphique</h2>
      <p class="muted">Les tableaux gagnant/perdant se generent automatiquement apres les poules.</p>
      <div class="bracket-grid">
        ${renderBracketCard('Tour initial', 'initial', 'randomise', view.brackets.initial || {}, {
          tree: false,
          connectorColor: '#0b7dda',
          matchClass: '',
          emptyText: 'Les groupes initiaux apparaissent apres demarrage.',
          showTotals: true,
          initialTotals: totals,
        })}
        ${renderBracketCard('Tableau gagnant', 'win', 'gagnants', view.brackets.winners || {}, {
          tree: true,
          connectorColor: '#0fa36d',
          matchClass: 'win',
          emptyText: 'Aucun groupe gagnant pour le moment.',
          showTotals: false,
          initialTotals: null,
        })}
        ${renderBracketCard('Tableau perdant', 'lose', 'perdants', view.brackets.losers || {}, {
          tree: true,
          connectorColor: '#f59f00',
          matchClass: 'lose',
          emptyText: 'Pas encore de tableau perdant.',
          showTotals: false,
          initialTotals: null,
        })}
      </div>
    `;
  }

  function renderRankingSection(view) {
    if (!view.finalRanking || !view.finalRanking.length) {
      return '<h2>Classement</h2><p class="muted">Le classement final apparait quand tous les tours sont termines.</p>';
    }

    return `
      <h2>Classement</h2>
      <table>
        <tr><th>Place</th><th>Nom</th><th>Tableau</th><th>Niveau</th></tr>
        ${view.finalRanking.map((row) => `
          <tr>
            <td><strong>${row.place}</strong></td>
            <td>${escapeHtml(row.name)}</td>
            <td>${row.bracket === 'winners' ? 'Gagnant' : 'Perdant'}</td>
            <td>${row.stage_tier === 0 ? 'Finale' : `Classement ${row.stage_tier}`}</td>
          </tr>
        `).join('')}
      </table>
    `;
  }

  function render(view) {
    const errorContainer = document.getElementById('error-container');
    const participantsSection = document.getElementById('participants-section');
    const eventSection = document.getElementById('event-section');
    const roundSection = document.getElementById('round-section');
    const bracketSection = document.getElementById('bracket-section');
    const rankingSection = document.getElementById('ranking-section');

    if (!errorContainer || !participantsSection || !eventSection || !roundSection || !bracketSection || !rankingSection) {
      return;
    }

    errorContainer.innerHTML = view.error ? `<p class="error">Erreur : ${escapeHtml(view.error)}</p>` : '';
    participantsSection.innerHTML = renderParticipantsSection(view);
    eventSection.innerHTML = renderEventSection(view);
    roundSection.innerHTML = renderRoundSection(view);
    bracketSection.innerHTML = renderBracketSection(view);
    rankingSection.innerHTML = renderRankingSection(view);

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 60);
  }

  window.XCEView = {
    render,
  };
})();
