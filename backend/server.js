const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database("readiness.db");

/**
 * MIGRATION:
 * Old table: checkins with UNIQUE(date)
 * New table: checkins with athlete + UNIQUE(athlete, date)
 * Existing rows become athlete = "Default"
 */
function migrateToMultiAthlete() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkins_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete TEXT NOT NULL,
      date TEXT NOT NULL,
      sleep_hours REAL,
      soreness INTEGER,
      stress INTEGER,
      rpe INTEGER,
      minutes INTEGER,
      training_load REAL,
      readiness INTEGER,
      UNIQUE(athlete, date)
    );
  `);

  const oldExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='checkins'`)
    .get();

  if (oldExists) {
    const cols = db.prepare(`PRAGMA table_info(checkins)`).all();
    const hasAthlete = cols.some((c) => c.name === "athlete");

    if (!hasAthlete) {
      db.exec(`
        INSERT OR IGNORE INTO checkins_new (
          athlete, date, sleep_hours, soreness, stress, rpe, minutes, training_load, readiness
        )
        SELECT
          'Default' as athlete,
          date, sleep_hours, soreness, stress, rpe, minutes, training_load, readiness
        FROM checkins;
      `);

      db.exec(`DROP TABLE checkins;`);
      db.exec(`ALTER TABLE checkins_new RENAME TO checkins;`);
      return;
    }
  }

  const finalExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='checkins'`)
    .get();

  if (!finalExists) {
    db.exec(`ALTER TABLE checkins_new RENAME TO checkins;`);
  } else {
    const newStillExists = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='checkins_new'`)
      .get();
    if (newStillExists) db.exec(`DROP TABLE checkins_new;`);
  }
}

migrateToMultiAthlete();

function calcReadiness({ sleep_hours, soreness, stress, rpe, minutes }) {
  const training_load = Number(rpe) * Number(minutes);

  let readiness =
    100 -
    (Number(soreness) * 4 + Number(stress) * 3) +
    (Number(sleep_hours) * 5) -
    (training_load / 50);

  readiness = Math.max(0, Math.min(100, Math.round(readiness)));
  return { training_load, readiness };
}

app.get("/", (req, res) => {
  res.json({ status: "backend running" });
});

app.get("/api/athletes", (req, res) => {
  const rows = db
    .prepare(`SELECT DISTINCT athlete FROM checkins ORDER BY athlete ASC`)
    .all();
  res.json(rows.map((r) => r.athlete));
});

app.get("/api/checkins", (req, res) => {
  const athlete = req.query.athlete;

  if (athlete) {
    const rows = db
      .prepare(`SELECT * FROM checkins WHERE athlete = ? ORDER BY date DESC`)
      .all(String(athlete));
    return res.json(rows);
  }

  const rows = db.prepare(`SELECT * FROM checkins ORDER BY date DESC`).all();
  res.json(rows);
});

app.post("/api/checkins", (req, res) => {
  const { athlete, date, sleep_hours, soreness, stress, rpe, minutes } = req.body;

  const athleteName = (athlete ?? "").trim() || "Default";
  if (!date) return res.status(400).json({ error: "date is required (YYYY-MM-DD)" });

  const { training_load, readiness } = calcReadiness({
    sleep_hours,
    soreness,
    stress,
    rpe,
    minutes,
  });

  const stmt = db.prepare(`
    INSERT INTO checkins (
      athlete, date, sleep_hours, soreness, stress, rpe, minutes, training_load, readiness
    )
    VALUES (
      @athlete, @date, @sleep_hours, @soreness, @stress, @rpe, @minutes, @training_load, @readiness
    )
    ON CONFLICT(athlete, date) DO UPDATE SET
      sleep_hours = excluded.sleep_hours,
      soreness = excluded.soreness,
      stress = excluded.stress,
      rpe = excluded.rpe,
      minutes = excluded.minutes,
      training_load = excluded.training_load,
      readiness = excluded.readiness
  `);

  stmt.run({
    athlete: athleteName,
    date,
    sleep_hours,
    soreness,
    stress,
    rpe,
    minutes,
    training_load,
    readiness,
  });

  res.json({ athlete: athleteName, date, training_load, readiness });
});

app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});