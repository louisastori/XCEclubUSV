const path = require('path');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', '..', 'data.sqlite');
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      bib INTEGER
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_rounds INTEGER NOT NULL DEFAULT 4,
      category TEXT NOT NULL DEFAULT 'Open',
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS event_participants (
      event_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (event_id, participant_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
    CREATE TABLE IF NOT EXISTS heats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL,
      round_number INTEGER NOT NULL,
      bracket TEXT NOT NULL,
      stage_tier INTEGER NOT NULL DEFAULT 0,
      heat_index INTEGER NOT NULL,
      UNIQUE(event_id, round_number, bracket, heat_index),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS heat_participants (
      heat_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      PRIMARY KEY (heat_id, participant_id),
      FOREIGN KEY (heat_id) REFERENCES heats(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
    CREATE TABLE IF NOT EXISTS heat_results (
      heat_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      points INTEGER NOT NULL,
      time_ms INTEGER DEFAULT NULL,
      time_text TEXT DEFAULT NULL,
      PRIMARY KEY (heat_id, participant_id),
      FOREIGN KEY (heat_id) REFERENCES heats(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
    CREATE TABLE IF NOT EXISTS heat_times (
      heat_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      time_ms INTEGER DEFAULT NULL,
      time_text TEXT DEFAULT NULL,
      PRIMARY KEY (heat_id, participant_id),
      FOREIGN KEY (heat_id) REFERENCES heats(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
  `);

  const resultsCols = db.prepare('PRAGMA table_info(heat_results)').all().map((c) => c.name);
  if (!resultsCols.includes('time_ms')) {
    db.exec('ALTER TABLE heat_results ADD COLUMN time_ms INTEGER DEFAULT NULL');
  }
  if (!resultsCols.includes('time_text')) {
    db.exec('ALTER TABLE heat_results ADD COLUMN time_text TEXT DEFAULT NULL');
  }

  const participantCols = db.prepare('PRAGMA table_info(participants)').all().map((c) => c.name);
  if (!participantCols.includes('bib')) {
    db.exec('ALTER TABLE participants ADD COLUMN bib INTEGER');
  }

  const eventCols = db.prepare('PRAGMA table_info(events)').all().map((c) => c.name);
  if (!eventCols.includes('category')) {
    db.exec("ALTER TABLE events ADD COLUMN category TEXT NOT NULL DEFAULT 'Open'");
  }

  const heatsCols = db.prepare('PRAGMA table_info(heats)').all().map((c) => c.name);
  if (!heatsCols.includes('stage_tier')) {
    db.exec('ALTER TABLE heats ADD COLUMN stage_tier INTEGER NOT NULL DEFAULT 0');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS heat_times (
      heat_id INTEGER NOT NULL,
      participant_id INTEGER NOT NULL,
      time_ms INTEGER DEFAULT NULL,
      time_text TEXT DEFAULT NULL,
      PRIMARY KEY (heat_id, participant_id),
      FOREIGN KEY (heat_id) REFERENCES heats(id) ON DELETE CASCADE,
      FOREIGN KEY (participant_id) REFERENCES participants(id)
    );
  `);
}

ensureSchema();

module.exports = db;
