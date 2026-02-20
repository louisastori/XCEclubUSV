(() => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const stateApi = window.XCEState;
  const viewApi = window.XCEView;
  if (!stateApi || !viewApi) {
    return;
  }

  let currentError = null;

  function renderApp() {
    const view = stateApi.buildHomeView(currentError);
    viewApi.render(view);
  }

  function runAction(action) {
    try {
      action();
      currentError = null;
    } catch (err) {
      currentError = err && err.message ? err.message : String(err);
    }
    renderApp();
  }

  function shuffle(array) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  function fillRandomChronos() {
    const inputs = Array.from(document.querySelectorAll('#round-times-form input[name^="times_global["]'));
    const values = Array.from({ length: inputs.length }, () => {
      const totalSeconds = 60 + Math.floor(Math.random() * 91);
      const centi = Math.floor(Math.random() * 100);
      return totalSeconds * 1000 + centi * 10;
    });
    shuffle(values);

    inputs.forEach((input, index) => {
      const ms = values[index];
      const totalSeconds = Math.floor(ms / 1000);
      const hh = Math.floor(totalSeconds / 3600);
      const mm = Math.floor((totalSeconds % 3600) / 60);
      const ss = totalSeconds % 60;
      const cc = Math.floor((ms % 1000) / 10);
      input.value = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(cc).padStart(2, '0')}`;
    });
  }

  function fillRandomResults() {
    document.querySelectorAll('#round-results-form fieldset.heat').forEach((heat) => {
      const inputs = Array.from(heat.querySelectorAll('input[type="number"][data-participant-id]'));
      const positions = Array.from({ length: inputs.length }, (_, index) => index + 1);
      shuffle(positions);
      inputs.forEach((input, index) => {
        input.value = String(positions[index]);
      });
    });
  }

  document.addEventListener('click', (event) => {
    const button = event.target && event.target.closest ? event.target.closest('button') : null;
    if (!button) return;

    if (button.id === 'fill-random') {
      event.preventDefault();
      fillRandomChronos();
      return;
    }

    if (button.id === 'results-random') {
      event.preventDefault();
      fillRandomResults();
      return;
    }

    const action = button.dataset.action;
    if (!action) return;
    event.preventDefault();

    if (action === 'seed') {
      runAction(() => stateApi.seedParticipants(Number(button.dataset.count)));
      return;
    }

    if (action === 'delete-all-participants') {
      runAction(() => stateApi.deleteAllParticipants());
      return;
    }

    if (action === 'delete-participant') {
      runAction(() => stateApi.deleteParticipant(Number(button.dataset.participantId)));
      return;
    }

    if (action === 'close-event') {
      runAction(() => stateApi.closeEvent(Number(button.dataset.eventId)));
    }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;

    if (form.id === 'add-participant-form') {
      event.preventDefault();
      runAction(() => {
        const nameInput = form.querySelector('input[name="name"]');
        stateApi.addParticipantAutoBib(nameInput ? nameInput.value : '');
      });
      return;
    }

    if (form.id === 'start-event-form') {
      event.preventDefault();
      runAction(() => {
        const nameInput = form.querySelector('input[name="event_name"]');
        const categoryInput = form.querySelector('input[name="event_category"]');
        stateApi.startEvent(
          nameInput ? nameInput.value : 'Course XCE',
          3,
          categoryInput ? categoryInput.value : 'Open'
        );
      });
      return;
    }

    if (form.id === 'round-times-form') {
      event.preventDefault();
      runAction(() => {
        const eventId = Number(form.dataset.eventId);
        const round = Number(form.dataset.round);
        const timesGlobal = {};
        form.querySelectorAll('input[name^="times_global["]').forEach((input) => {
          const match = input.name.match(/^times_global\[(\d+)\]$/);
          if (!match) return;
          timesGlobal[match[1]] = String(input.value || '').trim();
        });
        stateApi.saveTimes(eventId, round, timesGlobal);
      });
      return;
    }

    if (form.id === 'round-results-form') {
      event.preventDefault();
      runAction(() => {
        const eventId = Number(form.dataset.eventId);
        const round = Number(form.dataset.round);
        const results = {};

        form.querySelectorAll('fieldset.heat').forEach((heat) => {
          const heatId = heat.dataset.heatId;
          if (!heatId) return;
          const byParticipant = {};
          heat.querySelectorAll('input[type="number"][data-participant-id]').forEach((input) => {
            const participantId = input.dataset.participantId;
            if (!participantId) return;
            byParticipant[participantId] = String(input.value || '').trim();
          });
          results[heatId] = byParticipant;
        });

        stateApi.saveResults(eventId, round, results);
      });
    }
  });

  renderApp();
})();
