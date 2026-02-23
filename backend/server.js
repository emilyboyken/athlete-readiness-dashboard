const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
app.use(cors());
app.use(express.json());

const db = new Database("readiness.db");

db.exec(`
CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE,
  sleep_hours REAL,
  soreness INTEGER,
  stress INTEGER,
  rpe INTEGER,
  minutes INTEGER,
  training_load REAL,
  readiness INTEGER
);
`);

function calcReadiness({ sleep_hours, soreness, stress, rpe, minutes }) {
  const training_load = rpe * minutes;
  let readiness =
    100 - (soreness * 4 + stress * 3) + (sleep_hours * 5) - (training_load / 50);

  readiness = Math.max(0, Math.min(100, Math.round(readiness)));
  return { training_load, readiness };
}

app.get("/", (req, res) => {
  res.json({ status: "backend running" });
});

app.get("/checkins", (req, res) => {
  const rows = db.prepare("SELECT * FROM checkins ORDER BY date DESC").all();
  res.json(rows);
});

app.post("/checkins", (req, res) => {
  const { date, sleep_hours, soreness, stress, rpe, minutes } = req.body;

  const { training_load, readiness } = calcReadiness({
    sleep_hours,
    soreness,
    stress,
    rpe,
    minutes,
  });

  const stmt = db.prepare(`
    INSERT INTO checkins (date, sleep_hours, soreness, stress, rpe, minutes, training_load, readiness)
    VALUES (@date, @sleep_hours, @soreness, @stress, @rpe, @minutes, @training_load, @readiness)
    ON CONFLICT(date) DO UPDATE SET
      sleep_hours=excluded.sleep_hours,
      soreness=excluded.soreness,
      stress=excluded.stress,
      rpe=excluded.rpe,
      minutes=excluded.minutes,
      training_load=excluded.training_load,
      readiness=excluded.readiness
  `);

  stmt.run({
    date,
    sleep_hours,
    soreness,
    stress,
    rpe,
    minutes,
    training_load,
    readiness,
  });

  res.json({ date, training_load, readiness });
});

app.listen(5000, () => {
  console.log("Backend running on http://localhost:5000");
});