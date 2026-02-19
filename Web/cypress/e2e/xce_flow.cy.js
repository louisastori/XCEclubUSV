/// <reference types="cypress" />

/**
 * Scenario end-to-end:
 * 1) Reset DB
 * 2) Add 4 participants
 * 3) Start event
 * 4) Submit results for the 3 pool rounds
 * 5) Check bracket view: top 2 in winners, others in losers (qualification round)
 */

describe('XCE flow', () => {
  const fillRoundResultsByHeat = () => {
    cy.get('fieldset.heat').each(($heat) => {
      cy.wrap($heat).find('input[type="number"]').each(($el, idx) => {
        cy.wrap($el).clear().type(String(idx + 1));
      });
    });
  };

  beforeEach(() => {
    cy.task('resetDb');
    cy.visit('/');
  });

  it('creates event and splits winners/losers after 3 pool rounds with groups of 4', () => {
    cy.contains('button', 'Liste 16').click();
    cy.get('input[name="event_name"]').clear().type('Test XCE');
    cy.get('form[action="/events/start"] button[type="submit"]').click();

    cy.get('input[name^="times_global["]').should('have.length', 16);
    cy.get('input[name^="times_global["]').each(($el, idx) => {
      const sec = String(10 + idx).padStart(2, '0');
      cy.wrap($el).clear().type(`00:00:${sec}:00`);
    });
    cy.get('form[action*="/times"] button[type="submit"]').click();

    const submitRound = () => {
      cy.get('input[type="number"]').should('have.length', 16);
      fillRoundResultsByHeat();
      cy.get('form[action*="/results"] button[type="submit"]').click();
    };

    submitRound();
    submitRound();
    submitRound();

    cy.contains('.tab-btn', 'Tableau graphique').click();

    cy.contains('.bracket-card', 'Tableau gagnant').within(() => {
      cy.contains('.round-title', 'Tour 4').should('exist');
      cy.get('.match-list').first().find('li').should('have.length', 4);
    });

    cy.contains('.bracket-card', 'Tableau perdant').within(() => {
      cy.contains('.round-title', 'Tour 4').should('exist');
      cy.get('.match-list').first().find('li').should('have.length', 4);
    });
  });

  it('generates next winners/losers stage after bracket results (semi/final)', () => {
    cy.contains('button', 'Liste 16').click();

    cy.get('input[name="event_name"]').clear().type('Test XCE 16');
    cy.get('form[action="/events/start"] button[type="submit"]').click();

    cy.get('input[name^="times_global["]').should('have.length', 16);
    cy.get('input[name^="times_global["]').each(($el, idx) => {
      const sec = String(10 + idx).padStart(2, '0');
      cy.wrap($el).clear().type(`00:00:${sec}:00`);
    });
    cy.get('form[action*="/times"] button[type="submit"]').click();

    for (let i = 0; i < 3; i++) {
      fillRoundResultsByHeat();
      cy.get('form[action*="/results"] button[type="submit"]').click();
    }

    fillRoundResultsByHeat();
    cy.get('form[action*="/results"] button[type="submit"]').click();

    cy.contains('.tab-btn', 'Tableau graphique').click();

    cy.contains('.bracket-card', 'Tableau gagnant').within(() => {
      cy.contains('.round-title', 'Tour 5').should('exist');
      cy.contains('.round-title', 'Tour 5')
        .parent()
        .find('.match')
        .should('have.length', 2);
    });

    cy.contains('.bracket-card', 'Tableau perdant').within(() => {
      cy.contains('.round-title', 'Tour 5').should('exist');
      cy.contains('.round-title', 'Tour 5')
        .parent()
        .find('.match')
        .should('have.length', 2);
    });
  });
});
