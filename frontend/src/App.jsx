import React, { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

function clampNum(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function App() {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [checkins, setCheckins] = useState([]);
  const [error, setError] = useState("");
  
  const [athletes, setAthletes] = useState([]);
  const [selectedAthlete, setSelectedAthlete] = useState("Default");
  const [newAthlete, setNewAthlete] = useState("");
  
  const [form, setForm] = useState({
    date: todayISO(),
    sleep_hours: 7,
    soreness: 3,
    stress: 3,
    rpe: 6,
    minutes: 45,
  });

  async function loadAthletes() {
  const res = await fetch("/api/athletes");
  if (!res.ok) throw new Error(`GET athletes failed: ${res.status}`);
  const list = await res.json();
  setAthletes(list);
  if (list.length && !list.includes(selectedAthlete)) {
    setSelectedAthlete(list[0]);
  }
}

async function loadCheckins() {
  setLoading(true);
  setError("");
  try {
    await loadAthletes();
    const qs = selectedAthlete ? `?athlete=${encodeURIComponent(selectedAthlete)}` : "";
    const res = await fetch(`/api/checkins${qs}`);
    if (!res.ok) throw new Error(`GET failed: ${res.status}`);
    const data = await res.json();
    setCheckins(data);
  } catch (e) {
    setError(String(e?.message ?? e));
  } finally {
    setLoading(false);
  }
}

  useEffect(() => {
  loadCheckins();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [selectedAthlete]);

  const latest = checkins?.[0];

  const slicedForChart = useMemo(() => {
    const sortedAsc = [...checkins].sort((a, b) => (a.date > b.date ? 1 : -1));
    return sortedAsc.slice(Math.max(0, sortedAsc.length - days));
  }, [checkins, days]);

  const chartData = useMemo(() => {
    return {
      labels: slicedForChart.map((r) => r.date),
      datasets: [
        {
          label: "Readiness",
          data: slicedForChart.map((r) => r.readiness),
          tension: 0.25,
          yAxisID: "readinessAxis",
        },
        {
          label: "Training Load",
          data: slicedForChart.map((r) => r.training_load),
          tension: 0.25,
          yAxisID: "loadAxis",
        },
      ],
    };
  }, [slicedForChart]);

  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      plugins: { legend: { position: "top" } },
      scales: {
        readinessAxis: {
          type: "linear",
          position: "left",
          min: 0,
          max: 100,
          title: { display: true, text: "Readiness (0-100)" },
        },
        loadAxis: {
          type: "linear",
          position: "right",
          grid: { drawOnChartArea: false },
          title: { display: true, text: "Training Load (RPE × minutes)" },
        },
      },
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = {
      athlete: selectedAthlete,
      date: form.date,
      sleep_hours: clampNum(form.sleep_hours, 0, 14),
      soreness: clampNum(form.soreness, 1, 10),
      stress: clampNum(form.stress, 1, 10),
      rpe: clampNum(form.rpe, 1, 10),
      minutes: clampNum(form.minutes, 0, 300),
    };

    try {
      const res = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`POST failed: ${res.status}`);
      await res.json();
      await loadCheckins();
    } catch (e2) {
      setError(String(e2?.message ?? e2));
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    border: "1px solid #e5e7eb",
    borderRadius: 14,
    padding: 16,
    background: "white",
  };

  const labelStyle = { fontSize: 12, color: "#4b5563", marginBottom: 6 };
  const inputStyle = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    outline: "none",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f7fb" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: 20 }}>
        <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Athlete Readiness Dashboard</h1>
            <p style={{ marginTop: 6, color: "#6b7280" }}>
              Log daily recovery + training metrics. View readiness trends and training load.
            </p>
          </div>
<div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
  <select
    value={selectedAthlete}
    onChange={(e) => setSelectedAthlete(e.target.value)}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      background: "white",
    }}
  >
    {athletes.map((a) => (
      <option key={a} value={a}>
        {a}
      </option>
    ))}
    {!athletes.includes("Default") ? <option value="Default">Default</option> : null}
  </select>

  <input
    placeholder="New athlete name"
    value={newAthlete}
    onChange={(e) => setNewAthlete(e.target.value)}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      background: "white",
    }}
  />

  <button
    onClick={() => {
      const name = newAthlete.trim();
      if (!name) return;
      if (!athletes.includes(name)) setAthletes((prev) => [...prev, name].sort());
      setSelectedAthlete(name);
      setNewAthlete("");
    }}
    style={{
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #e5e7eb",
      background: "white",
      cursor: "pointer",
      fontWeight: 600,
    }}
  >
    Use athlete
  </button>
</div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setDays(7)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: days === 7 ? "white" : "transparent",
                cursor: "pointer",
              }}
            >
              7 days
            </button>
            <button
              onClick={() => setDays(30)}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: days === 30 ? "white" : "transparent",
                cursor: "pointer",
              }}
            >
              30 days
            </button>
          </div>
        </header>

        {error ? (
          <div style={{ ...cardStyle, borderColor: "#fecaca", background: "#fff1f2", color: "#9f1239", marginTop: 12 }}>
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Latest readiness</div>
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6 }}>
              {latest ? latest.readiness : "—"}
            </div>
            <div style={{ color: "#6b7280", marginTop: 6 }}>
              {latest ? `Date: ${latest.date}` : "Add your first check-in."}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Latest training load</div>
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6 }}>
              {latest ? Math.round(latest.training_load) : "—"}
            </div>
            <div style={{ color: "#6b7280", marginTop: 6 }}>Load = RPE × minutes</div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Entries</div>
            <div style={{ fontSize: 36, fontWeight: 700, marginTop: 6 }}>{checkins.length}</div>
            <div style={{ color: "#6b7280", marginTop: 6 }}>
              {loading ? "Syncing…" : "Stored in SQLite via your API"}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12, marginTop: 12 }}>
          <div style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>Trends ({days} days)</h2>
              <button
                onClick={loadCheckins}
                style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                }}
              >
                Refresh
              </button>
            </div>
            <div style={{ marginTop: 12 }}>
              {slicedForChart.length ? (
                <Line data={chartData} options={chartOptions} />
              ) : (
                <div style={{ color: "#6b7280", padding: 12 }}>No data yet — submit a check-in to see charts.</div>
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Daily check-in</h2>
            <form onSubmit={submit} style={{ marginTop: 12, display: "grid", gap: 10 }}>
              <div>
                <div style={labelStyle}>Date</div>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  required
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={labelStyle}>Sleep (hours)</div>
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    value={form.sleep_hours}
                    onChange={(e) => setForm((f) => ({ ...f, sleep_hours: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <div style={labelStyle}>Minutes</div>
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    max="300"
                    value={form.minutes}
                    onChange={(e) => setForm((f) => ({ ...f, minutes: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={labelStyle}>Soreness (1–10)</div>
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    max="10"
                    value={form.soreness}
                    onChange={(e) => setForm((f) => ({ ...f, soreness: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <div style={labelStyle}>Stress (1–10)</div>
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    max="10"
                    value={form.stress}
                    onChange={(e) => setForm((f) => ({ ...f, stress: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <div style={labelStyle}>RPE (1–10)</div>
                <input
                  style={inputStyle}
                  type="number"
                  min="1"
                  max="10"
                  value={form.rpe}
                  onChange={(e) => setForm((f) => ({ ...f, rpe: e.target.value }))}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 4,
                  padding: "12px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontWeight: 600,
                }}
              >
                {loading ? "Saving…" : "Save check-in"}
              </button>

              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Tip: Submit multiple days to see the trend line fill in.
              </div>
            </form>
          </div>
        </div>

        <div style={{ marginTop: 16, color: "#6b7280", fontSize: 12 }}>
          Running locally: frontend (5174) → proxy → backend (5000)
        </div>
      </div>
    </div>
  );
}