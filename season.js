// ============================================================================
// season.js — чемпионат Формулы 1: сезон из 4 гонок, каждая трасса ровно один раз,
// порядок трасс каждый новый сезон другой. Очки: 25-18-15-12-10-8-6-4-2-1.
// Таблицы: кубок гонщиков и кубок конструкторов. Сохраняется в localStorage.
// ============================================================================

const SEASON_KEY = 'fiaSim.season.v2';
let season = null;

function shuffleArr(a) {
    const r = a.slice();
    for (let i = r.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [r[i], r[j]] = [r[j], r[i]];
    }
    return r;
}

function loadSeason() {
    try {
        const raw = localStorage.getItem(SEASON_KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (s && Array.isArray(s.order) && s.order.length === TRACKS_DB.length && Array.isArray(s.results)) return s;
    } catch (e) { /* хранилище недоступно */ }
    return null;
}

function saveSeason() {
    try { localStorage.setItem(SEASON_KEY, JSON.stringify(season)); } catch (e) { /* ignore */ }
}

// Новый сезон: другой порядок трасс, чем в прошлом
function newSeason() {
    const prev = season ? season.order.join(',') : '';
    const base = TRACKS_DB.map((_, i) => i);
    let order, tries = 0;
    do { order = shuffleArr(base); tries++; } while (order.join(',') === prev && tries < 30);
    season = { order, results: [], team: null, seat: 0, number: (season ? season.number + 1 : 1) };
    saveSeason();
    return season;
}

function ensureSeason() { if (!season) season = loadSeason() || newSeason(); return season; }
function seasonDone() { return season.results.length >= season.order.length; }
function seasonNextTrack() { return season.order[Math.min(season.results.length, season.order.length - 1)]; }
function seasonStarted() { return season.results.length > 0; }

function recordSeasonRace(rows) {
    if (seasonDone()) return;
    season.results.push({ track: season.order[season.results.length], rows });
    saveSeason();
}

function teamColorByName(teamName) {
    const t = F1_CATALOG.find(c => c.teamName === teamName);
    return t ? t.livery.primary : '#64748b';
}

function driverStandings() {
    const map = new Map();
    season.results.forEach((race, ri) => {
        race.rows.forEach(r => {
            if (!map.has(r.name)) map.set(r.name, { name: r.name, team: r.team, pts: 0, wins: 0, best: 99, perRound: [], isPlayer: false });
            const d = map.get(r.name);
            d.pts += r.pts; d.perRound[ri] = r.pts;
            if (r.pos === 1) d.wins++;
            d.best = Math.min(d.best, r.pos);
            if (r.isPlayer) d.isPlayer = true;
        });
    });
    return [...map.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.best - b.best);
}

function constructorStandings() {
    const map = new Map();
    season.results.forEach((race, ri) => {
        race.rows.forEach(r => {
            if (!map.has(r.team)) map.set(r.team, { team: r.team, pts: 0, wins: 0, perRound: [], hasPlayer: false });
            const t = map.get(r.team);
            t.pts += r.pts; t.perRound[ri] = (t.perRound[ri] || 0) + r.pts;
            if (r.pos === 1) t.wins++;
            if (r.isPlayer) t.hasPlayer = true;
        });
    });
    return [...map.values()].sort((a, b) => b.pts - a.pts || b.wins - a.wins);
}
