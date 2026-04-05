// ============================================
// NBA PLAYER GUESSING GAME - ENHANCED VERSION
// ============================================

// Check for game mode and difficulty
const urlParams = new URLSearchParams(window.location.search);
const isDaily = urlParams.get('mode') === 'daily';
const difficulty = urlParams.get('diff') || 'medium';

// Difficulty thresholds (minimum PPG to be included)
const DIFFICULTY_THRESHOLDS = {
    easy: 15,    // Stars only
    medium: 8,   // Starters & key rotation
    hard: 0      // All rotation players
};

// Constants
const MIN_MPG = 10; // Minimum minutes per game filter
const POINTS = { round1: 150, round2: 100, round3: 50 };

// Seeded random for daily challenge (same player for everyone each day)
function seededRandom(seed) {
    const x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

function getTodaysSeed() {
    const today = new Date();
    return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
}

function getDailyPlayerIndex(playerCount) {
    const seed = getTodaysSeed();
    return Math.floor(seededRandom(seed) * playerCount);
}

// Stat categories for stat selection (used in Round 1, 2, and 3)
const STAT_CATEGORIES = {
    'Scoring': ['RPG', 'APG'],
    'Shooting %': ['FG%', '3P%', 'FT%', 'eFG%'],
    'Volume': ['3PM', 'FGM', 'FTM'],
    'Rebounds': ['ORB', 'DRB'],
    'Defense': ['STL', 'BLK'],
    'Other': ['TOV', 'G', 'GS', 'PF']
};

const STAT_LABELS = {
    'G': 'Games', 'GS': 'Games Started',
    'FG%': 'FG%', '3P%': '3PT%', 'FT%': 'FT%', 'eFG%': 'eFG%',
    'FGM': 'FG Made', '3PM': '3PT Made', 'FTM': 'FT Made',
    'ORB': 'Off Reb', 'DRB': 'Def Reb',
    'STL': 'Steals', 'BLK': 'Blocks',
    'TOV': 'Turnovers', 'PF': 'Fouls',
    'RPG': 'Reb/Game', 'APG': 'Ast/Game', 'PPG': 'Pts/Game'
};

const NICKNAMES = {
    'lbj': 'lebron james', 'king james': 'lebron james', 'bron': 'lebron james',
    'steph': 'stephen curry', 'chef curry': 'stephen curry',
    'kd': 'kevin durant', 'greek freak': 'giannis antetokounmpo',
    'giannis': 'giannis antetokounmpo', 'joker': 'nikola jokic', 'jokic': 'nikola jokic',
    'ant': 'anthony edwards', 'ja': 'ja morant', 'dame': 'damian lillard',
    'book': 'devin booker', 'wemby': 'victor wembanyama', 'jb': 'jaylen brown',
    'sga': 'shai gilgeous-alexander', 'pg': 'paul george', 'ad': 'anthony davis',
    'luka': 'luka doncic', 'trae': 'trae young', 'zion': 'zion williamson',
    'cp3': 'chris paul', 'russ': 'russell westbrook', 'kawhi': 'kawhi leonard',
    'jimmy': 'jimmy butler', 'bam': 'bam adebayo', 'kat': 'karl-anthony towns',
    'harden': 'james harden', 'kyrie': 'kyrie irving'
};

// Game State
const state = {
    allPlayers: [],
    filteredPlayers: [],
    currentPlayer: null,
    currentRound: 1,
    totalScore: 0,
    playersAttempted: 0,
    usedIndices: [],
    revealedStats: ['PPG'],
    selectedStatRound1: null,
    selectedStatRound2: null,
    guessHistory: [],
    currentStreak: 0,
    bestStreak: 0,
    dailyCompleted: false,
    dailyResult: null, // { score, round, date }
    playerName: '',
    highScores: [], // Array of { name, score, date }
    sessionStats: {
        round1: { correct: 0, total: 0 },
        round2: { correct: 0, total: 0 },
        round3: { correct: 0, total: 0 }
    }
};

// DOM Elements
const el = {
    loading: document.getElementById('loading'),
    score: document.getElementById('score'),
    scoreAnimation: document.getElementById('score-animation'),
    currentStreak: document.getElementById('current-streak'),
    playersAttempted: document.getElementById('players-attempted'),
    maxPoints: document.getElementById('max-points'),
    currentRound: document.getElementById('current-round'),
    progressBar: document.getElementById('progress-bar'),
    roundDots: document.querySelectorAll('.round-dot'),
    hintValue1: document.getElementById('hint-value-1'),
    hintCard2: document.getElementById('hint-card-2'),
    hintLabel2: document.getElementById('hint-label-2'),
    hintValue2: document.getElementById('hint-value-2'),
    hintCard3: document.getElementById('hint-card-3'),
    hintLabel3: document.getElementById('hint-label-3'),
    hintValue3: document.getElementById('hint-value-3'),
    statSelection: document.getElementById('stat-selection'),
    selectionPrompt: document.getElementById('selection-prompt'),
    statCategories: document.getElementById('stat-categories'),
    playerInput: document.getElementById('player-input'),
    autocompleteDropdown: document.getElementById('autocomplete-dropdown'),
    submitBtn: document.getElementById('submit-btn'),
    feedback: document.getElementById('feedback'),
    feedbackText: document.getElementById('feedback-text'),
    historyBody: document.getElementById('history-body'),
    nextBtn: document.getElementById('next-btn'),
    rosterTitle: document.getElementById('roster-title'),
    rosterList: document.getElementById('roster-list'),
    statsBtn: document.getElementById('stats-btn'),
    modalOverlay: document.getElementById('modal-overlay'),
    modalBody: document.getElementById('modal-body'),
    modalClose: document.getElementById('modal-close'),
    nameModal: document.getElementById('name-modal'),
    nameInput: document.getElementById('player-name-input'),
    nameSubmitBtn: document.getElementById('name-submit-btn')
};

// ============================================
// DATA LOADING & PARSING
// ============================================

async function loadCSV() {
    try {
        const response = await fetch('nba_players_2025-26_stats.csv');
        const text = await response.text();
        parseCSV(text);
        loadHighScores();

        // Check if daily mode and already completed
        if (isDaily && loadDailyResult()) {
            showDailyCompleted();
            return;
        }

        el.loading.classList.add('hidden');

        // Always show name modal for Endless mode (fresh start each time)
        if (!isDaily) {
            resetGameState();
            showNameModal();
        } else {
            startNewPlayer();
        }
    } catch (error) {
        console.error('Error loading CSV:', error);
        el.loading.innerHTML = '<p style="color: #ef4444;">Error loading data. Please refresh.</p>';
    }
}

function resetGameState() {
    // Reset all game state for a fresh playthrough
    state.totalScore = 0;
    state.playersAttempted = 0;
    state.currentStreak = 0;
    state.usedIndices = [];
    state.sessionStats = {
        round1: { correct: 0, total: 0 },
        round2: { correct: 0, total: 0 },
        round3: { correct: 0, total: 0 }
    };
    el.score.textContent = '0';
    el.currentStreak.textContent = '0';
    el.playersAttempted.textContent = '0';
}

function showNameModal() {
    el.nameModal.classList.remove('hidden');
    el.nameInput.value = '';
    el.nameInput.focus();
}

function hideNameModal() {
    el.nameModal.classList.add('hidden');
}

function submitName() {
    const name = el.nameInput.value.trim();
    if (name.length === 0) {
        el.nameInput.classList.add('shake');
        setTimeout(() => el.nameInput.classList.remove('shake'), 400);
        return;
    }

    state.playerName = name;
    hideNameModal();
    startNewPlayer();
}

// High scores management (tracked by streak)
function loadHighScores() {
    try {
        const saved = localStorage.getItem('nba_high_scores_v2');
        if (saved) {
            state.highScores = JSON.parse(saved);
        }
    } catch (e) {
        state.highScores = [];
    }
}

function saveHighScore(streak) {
    if (!state.playerName || streak === 0) return;

    const entry = {
        name: state.playerName,
        streak: streak,
        score: state.totalScore,
        date: new Date().toLocaleDateString()
    };

    // Always add as a new entry (each playthrough is separate)
    state.highScores.push(entry);

    // Sort by streak descending and keep top 10
    state.highScores.sort((a, b) => b.streak - a.streak);
    state.highScores = state.highScores.slice(0, 10);

    try {
        localStorage.setItem('nba_high_scores_v2', JSON.stringify(state.highScores));
    } catch (e) {
        console.log('Could not save high scores');
    }
}

function parseCSV(text) {
    const lines = text.trim().split('\n');
    const headers = parseCSVLine(lines[0]);

    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === headers.length) {
            const player = {};
            headers.forEach((h, idx) => player[h] = values[idx]);

            const games = parseFloat(player['G']) || 1;
            const minutes = parseFloat(player['MP']) || 0;
            const mpg = minutes / games;

            // Calculate per-game stats (main stats shown with /Game suffix)
            player['PPG'] = (parseFloat(player['PTS']) / games).toFixed(1);
            player['RPG'] = (parseFloat(player['TRB']) / games).toFixed(1);
            player['APG'] = (parseFloat(player['AST']) / games).toFixed(1);
            player['MPG'] = mpg.toFixed(1);

            // Per-game stats (no suffix needed - implied per game)
            player['FGM'] = (parseFloat(player['FG']) / games).toFixed(1);
            player['3PM'] = (parseFloat(player['3P']) / games).toFixed(1);
            player['FTM'] = (parseFloat(player['FT']) / games).toFixed(1);
            player['ORB'] = (parseFloat(player['ORB']) / games).toFixed(1);
            player['DRB'] = (parseFloat(player['DRB']) / games).toFixed(1);
            player['STL'] = (parseFloat(player['STL']) / games).toFixed(1);
            player['BLK'] = (parseFloat(player['BLK']) / games).toFixed(1);
            player['TOV'] = (parseFloat(player['TOV']) / games).toFixed(1);
            player['PF'] = (parseFloat(player['PF']) / games).toFixed(1);

            // Format percentages
            ['FG%', '3P%', '2P%', 'eFG%', 'FT%'].forEach(stat => {
                const val = parseFloat(player[stat]);
                player[stat] = !isNaN(val) ? (val * 100).toFixed(1) + '%' : 'N/A';
            });

            state.allPlayers.push(player);
        }
    }

    // Filter players with MPG >= 10 and by difficulty
    const minPPG = DIFFICULTY_THRESHOLDS[difficulty] || 0;
    state.filteredPlayers = state.allPlayers.filter(p => {
        const mpg = parseFloat(p['MPG']) || 0;
        const ppg = parseFloat(p['PPG']) || 0;
        return mpg >= MIN_MPG && ppg >= minPPG;
    });
    console.log(`Loaded ${state.allPlayers.length} players, ${state.filteredPlayers.length} after filtering (MPG >= ${MIN_MPG}, PPG >= ${minPPG})`);
}

function parseCSVLine(line) {
    const values = [];
    let current = '', inQuotes = false;
    for (const char of line) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; }
        else current += char;
    }
    values.push(current.trim());
    return values;
}

// ============================================
// GAME LOGIC
// ============================================

function startNewPlayer() {
    // Check if daily mode already completed
    if (isDaily && state.dailyCompleted) {
        showDailyCompleted();
        return;
    }

    // Reset for new player
    state.currentRound = 1;
    state.revealedStats = ['PPG'];
    state.selectedStatRound1 = null;
    state.selectedStatRound2 = null;
    state.guessHistory = [];

    let idx;
    if (isDaily) {
        // Daily mode: use seeded random for same player each day
        idx = getDailyPlayerIndex(state.filteredPlayers.length);
    } else {
        // Endless mode: random player
        let available = state.filteredPlayers.map((_, i) => i).filter(i => !state.usedIndices.includes(i));
        if (available.length === 0) {
            state.usedIndices = [];
            available = state.filteredPlayers.map((_, i) => i);
        }
        idx = available[Math.floor(Math.random() * available.length)];
        state.usedIndices.push(idx);
    }

    state.currentPlayer = state.filteredPlayers[idx];
    console.log('Current player:', state.currentPlayer['Player']);

    // Update UI - reset round dots explicitly first
    resetRoundDots();
    updateRoundUI();
    showRound1Hint();
    updateRoster();
    clearGuessHistory();
    hideFeedback();
    hideNextButton();
    clearInput();

    // In Round 1, show stat selection immediately (player chooses 1 stat)
    showStatSelection();

    // Update header for daily mode
    if (isDaily) {
        const logoEl = document.querySelector('.header-logo');
        logoEl.innerHTML = '<span style="color: var(--gold);">Daily Challenge</span>';
    }
}

function showRound1Hint() {
    const p = state.currentPlayer;
    el.hintValue1.textContent = `${p['Team']} | ${p['PPG']} PPG`;

    // Reset hint cards
    el.hintCard2.classList.remove('revealed');
    el.hintCard2.classList.add('locked');
    el.hintLabel2.textContent = 'Your Pick';
    el.hintValue2.textContent = '🔒';

    el.hintCard3.classList.remove('revealed');
    el.hintCard3.classList.add('locked');
    el.hintLabel3.textContent = 'Your Pick';
    el.hintValue3.textContent = '🔒';
}

function updateRoundUI() {
    el.currentRound.textContent = state.currentRound;
    el.maxPoints.textContent = POINTS[`round${state.currentRound}`];
    el.progressBar.style.width = `${state.currentRound * 33.33}%`;

    // Reset all round dots first, then set appropriate states
    el.roundDots.forEach((dot, i) => {
        dot.classList.remove('active', 'correct', 'wrong');
        const round = i + 1;
        if (round < state.currentRound) {
            dot.classList.add('wrong');
        } else if (round === state.currentRound) {
            dot.classList.add('active');
        }
    });
}

function resetRoundDots() {
    // Explicitly reset all round dots to starting state
    el.roundDots.forEach((dot, i) => {
        dot.classList.remove('active', 'correct', 'wrong');
        if (i === 0) {
            dot.classList.add('active');
        }
    });
}

function handleGuess() {
    const guess = el.playerInput.value.trim();
    if (!guess) return;

    const isCorrect = checkAnswer(guess);
    addToHistory(guess, isCorrect);

    if (isCorrect) {
        handleCorrect();
    } else {
        handleWrong(guess);
    }
}

function checkAnswer(guess) {
    const playerName = state.currentPlayer['Player'].toLowerCase();
    let g = guess.toLowerCase().trim();

    // Check nicknames
    if (NICKNAMES[g]) g = NICKNAMES[g];

    // Normalize accents
    const normalize = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normPlayer = normalize(playerName);
    const normGuess = normalize(g);

    if (normPlayer === normGuess) return true;

    // Last name match
    const lastName = normPlayer.split(' ').pop();
    if (normGuess === lastName) return true;

    // Partial match (min 3 chars)
    if (normPlayer.includes(normGuess) && normGuess.length >= 3) return true;
    if (normGuess.includes(normPlayer)) return true;

    return false;
}

function handleCorrect() {
    const points = POINTS[`round${state.currentRound}`];
    state.totalScore += points;
    state.playersAttempted++;
    state.sessionStats[`round${state.currentRound}`].correct++;
    state.sessionStats[`round${state.currentRound}`].total++;

    // Update streak
    state.currentStreak++;
    if (state.currentStreak > state.bestStreak) {
        state.bestStreak = state.currentStreak;
    }
    el.currentStreak.textContent = state.currentStreak;

    // Animate score
    animateScore(points);

    // Update displays
    el.score.textContent = state.totalScore;
    el.playersAttempted.textContent = state.playersAttempted;

    // Mark round as correct
    el.roundDots[state.currentRound - 1].classList.remove('active');
    el.roundDots[state.currentRound - 1].classList.add('correct');

    showFeedback('correct', `Correct! +${points} points`);
    disableInput();
    hideStatSelection();

    if (isDaily) {
        // Save daily result
        state.dailyCompleted = true;
        state.dailyResult = { score: points, round: state.currentRound, won: true, date: getTodaysSeed() };
        saveDailyResult();
        showDailyResult(true, points);
    } else {
        showNextButton();
    }
    saveSessionStats();
}

function handleWrong(guess) {
    // Shake input
    el.playerInput.classList.add('shake');
    setTimeout(() => el.playerInput.classList.remove('shake'), 400);

    state.sessionStats[`round${state.currentRound}`].total++;

    if (state.currentRound < 3) {
        // Mark round as wrong, advance
        el.roundDots[state.currentRound - 1].classList.remove('active');
        el.roundDots[state.currentRound - 1].classList.add('wrong');

        state.currentRound++;
        updateRoundUI();

        showFeedback('wrong', `Wrong! Moving to Round ${state.currentRound}`);
        clearInput();

        setTimeout(() => {
            hideFeedback();
            // Only show stat selection for Round 2 (one more stat to pick)
            // Round 3 has no stat selection - just final guess
            if (state.currentRound === 2) {
                showStatSelection();
            } else {
                enableInput();
                el.playerInput.focus();
            }
        }, 1200);
    } else {
        // Round 3 fail - reveal answer and end streak
        el.roundDots[2].classList.remove('active');
        el.roundDots[2].classList.add('wrong');

        state.playersAttempted++;
        el.playersAttempted.textContent = state.playersAttempted;

        // Save the final streak before resetting
        const finalStreak = state.currentStreak;

        // Reset streak
        state.currentStreak = 0;
        el.currentStreak.textContent = state.currentStreak;

        showFeedback('reveal', `The answer was ${state.currentPlayer['Player']}`);
        disableInput();
        hideStatSelection();

        if (isDaily) {
            // Save daily result
            state.dailyCompleted = true;
            state.dailyResult = { score: 0, round: 3, won: false, date: getTodaysSeed() };
            saveDailyResult();
            showDailyResult(false, 0);
        } else {
            // Save high score and show Game Over screen
            saveHighScore(finalStreak);
            setTimeout(() => showGameOver(finalStreak), 1500);
        }
        saveSessionStats();
    }
}

function animateScore(points) {
    el.scoreAnimation.textContent = `+${points}`;
    el.scoreAnimation.classList.remove('show');
    void el.scoreAnimation.offsetWidth; // Trigger reflow
    el.scoreAnimation.classList.add('show');
}

// ============================================
// DAILY CHALLENGE
// ============================================

function saveDailyResult() {
    try {
        localStorage.setItem('nba_daily_result', JSON.stringify(state.dailyResult));
    } catch (e) {
        console.log('Could not save daily result');
    }
}

function loadDailyResult() {
    try {
        const saved = localStorage.getItem('nba_daily_result');
        if (saved) {
            const data = JSON.parse(saved);
            // Check if it's today's result
            if (data.date === getTodaysSeed()) {
                state.dailyCompleted = true;
                state.dailyResult = data;
                return true;
            }
        }
    } catch (e) {
        console.log('No daily result found');
    }
    return false;
}

function showDailyResult(won, points) {
    setTimeout(() => {
        const message = won
            ? `You got today's player in Round ${state.currentRound} for ${points} points!`
            : `Better luck tomorrow! The answer was ${state.currentPlayer['Player']}`;

        el.feedback.className = 'feedback daily-result';
        el.feedbackText.innerHTML = `
            <div class="daily-title">${won ? '🎉 Daily Complete!' : '😔 Daily Failed'}</div>
            <div class="daily-message">${message}</div>
            <a href="index.html" class="daily-home-btn">Back to Home</a>
        `;
        el.feedback.classList.remove('hidden');
    }, 1500);
}

function showDailyCompleted() {
    el.loading.classList.add('hidden');
    const result = state.dailyResult;
    const message = result.won
        ? `You got today's player in Round ${result.round} for ${result.score} points!`
        : `You didn't get today's player. Come back tomorrow!`;

    document.querySelector('.game-content').innerHTML = `
        <div class="daily-already-complete">
            <h2>Daily Challenge Complete</h2>
            <p>${message}</p>
            <a href="index.html" class="play-btn">Back to Home</a>
            <a href="game.html" class="play-btn" style="margin-top: 12px; background: var(--accent-tan);">Play Endless Mode</a>
        </div>
    `;
}

// ============================================
// STAT SELECTION
// ============================================

function showStatSelection() {
    disableInput();
    el.statSelection.classList.remove('hidden');
    el.statCategories.innerHTML = '';

    // Determine prompt text based on round
    if (state.currentRound === 1) {
        el.selectionPrompt.textContent = 'Choose a stat to reveal:';
    } else if (state.currentRound === 2) {
        el.selectionPrompt.textContent = 'Choose another stat to reveal:';
    } else {
        el.selectionPrompt.textContent = 'Choose one final stat to reveal:';
    }

    // Build set of already-revealed stats (PPG is always shown)
    const excluded = new Set(['PPG']);
    if (state.selectedStatRound1) excluded.add(state.selectedStatRound1);
    if (state.selectedStatRound2) excluded.add(state.selectedStatRound2);

    // Show all stat categories
    for (const [category, stats] of Object.entries(STAT_CATEGORIES)) {
        const available = stats.filter(s => !excluded.has(s));
        if (available.length === 0) continue;

        const container = document.createElement('div');
        container.className = 'stat-category';
        container.innerHTML = `
            <div class="stat-category-title">${category}</div>
            <div class="stat-category-buttons"></div>
        `;

        const btns = container.querySelector('.stat-category-buttons');
        available.forEach(stat => {
            const btn = document.createElement('button');
            btn.className = 'stat-btn';
            btn.textContent = STAT_LABELS[stat] || stat;
            btn.onclick = () => selectStat(stat);
            btns.appendChild(btn);
        });

        el.statCategories.appendChild(container);
    }
}

function selectStat(stat) {
    state.revealedStats.push(stat);

    const p = state.currentPlayer;
    let value = p[stat];

    // Format value - keep decimals for per-game and percentage stats
    const keepDecimals = ['RPG', 'APG', 'FG%', '3P%', '2P%', 'eFG%', 'FT%', 'FGM', '3PM', 'FTM', 'ORB', 'DRB', 'STL', 'BLK', 'TOV', 'PF'];
    if (!keepDecimals.includes(stat)) {
        value = Math.round(parseFloat(value) || 0).toLocaleString();
    }

    if (state.currentRound === 1) {
        // Round 1 selection goes to hint card 2
        state.selectedStatRound1 = stat;
        el.hintCard2.classList.remove('locked');
        el.hintCard2.classList.add('revealed');
        el.hintLabel2.textContent = STAT_LABELS[stat] || stat;
        el.hintValue2.textContent = value;
    } else if (state.currentRound === 2) {
        // Round 2 selection goes to hint card 3
        state.selectedStatRound2 = stat;
        el.hintCard3.classList.remove('locked');
        el.hintCard3.classList.add('revealed');
        el.hintLabel3.textContent = STAT_LABELS[stat] || stat;
        el.hintValue3.textContent = value;
    }
    // Round 3: no stat selection (all hints already revealed)

    hideStatSelection();
    enableInput();
    el.playerInput.focus();
}

function hideStatSelection() {
    el.statSelection.classList.add('hidden');
}

// ============================================
// ROSTER SIDEBAR
// ============================================

function updateRoster() {
    const team = state.currentPlayer['Team'];
    const teams = team.includes('/') ? team.split('/') : [team];

    el.rosterTitle.textContent = teams.length > 1 ? 'TEAM ROSTERS' : `${team} ROSTER`;
    el.rosterList.innerHTML = '';

    // For traded players, show separate team sections
    teams.forEach((teamCode, idx) => {
        // Add team subheader for multi-team players
        if (teams.length > 1) {
            const header = document.createElement('div');
            header.className = 'roster-team-header';
            header.textContent = `${teamCode} ROSTER`;
            el.rosterList.appendChild(header);
        }

        // Get players from this team (using filteredPlayers for consistency with autocomplete)
        const roster = state.filteredPlayers.filter(p => {
            const pTeam = p['Team'];

            // Check if player's team matches
            if (pTeam.includes('/')) {
                return pTeam.split('/').includes(teamCode);
            }
            return pTeam === teamCode;
        });

        // Sort alphabetically by last name
        roster.sort((a, b) => {
            const lastA = a['Player'].split(' ').pop().toLowerCase();
            const lastB = b['Player'].split(' ').pop().toLowerCase();
            return lastA.localeCompare(lastB);
        });

        roster.forEach(player => {
            const div = document.createElement('div');
            div.className = 'roster-player';
            const position = player['Pos'] || 'N/A';
            div.innerHTML = `
                <span class="player-name">${player['Player']}</span>
                <span class="player-pos">${position}</span>
            `;
            div.onclick = () => {
                el.playerInput.value = player['Player'];
                el.playerInput.focus();
                hideAutocomplete();
            };
            el.rosterList.appendChild(div);
        });

        // Add spacing between team sections
        if (teams.length > 1 && idx < teams.length - 1) {
            const spacer = document.createElement('div');
            spacer.className = 'roster-spacer';
            el.rosterList.appendChild(spacer);
        }
    });
}

// ============================================
// GUESS HISTORY
// ============================================

function addToHistory(guess, correct) {
    const points = correct ? POINTS[`round${state.currentRound}`] : 0;
    state.guessHistory.push({
        round: state.currentRound,
        guess,
        correct,
        points
    });
    renderHistory();
}

function renderHistory() {
    el.historyBody.innerHTML = '';

    if (state.guessHistory.length === 0) {
        el.historyBody.innerHTML = '<tr><td colspan="4" class="history-empty">No guesses yet</td></tr>';
        return;
    }

    state.guessHistory.forEach(h => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>Round ${h.round}</td>
            <td>${h.guess}</td>
            <td class="${h.correct ? 'result-correct' : 'result-wrong'}">${h.correct ? '✓ Correct' : '✗ Wrong'}</td>
            <td class="points-cell ${h.points > 0 ? 'earned' : ''}">${h.points > 0 ? '+' + h.points : '0'}</td>
        `;
        el.historyBody.appendChild(tr);
    });
}

function clearGuessHistory() {
    state.guessHistory = [];
    renderHistory();
}

// ============================================
// AUTOCOMPLETE
// ============================================

let selectedIdx = -1;

function setupAutocomplete() {
    el.playerInput.addEventListener('input', handleAutocompleteInput);
    el.playerInput.addEventListener('focus', handleAutocompleteInput);
    el.playerInput.addEventListener('blur', () => setTimeout(hideAutocomplete, 200));
    el.playerInput.addEventListener('keydown', handleAutocompleteKeydown);
}

function handleAutocompleteInput() {
    const q = el.playerInput.value.trim().toLowerCase();
    selectedIdx = -1;

    if (q.length < 2) {
        hideAutocomplete();
        return;
    }

    const norm = q.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const matches = state.filteredPlayers.filter(p => {
        const name = p['Player'].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        return name.includes(norm);
    }).slice(0, 8);

    if (matches.length === 0) {
        hideAutocomplete();
        return;
    }

    showAutocomplete(matches);
}

function showAutocomplete(matches) {
    el.autocompleteDropdown.innerHTML = '';

    matches.forEach((p, i) => {
        const div = document.createElement('div');
        div.className = 'autocomplete-item';
        div.innerHTML = `
            <span class="player-name">${p['Player']}</span>
            <span class="player-team">${p['Team']}</span>
        `;
        div.onclick = () => {
            el.playerInput.value = p['Player'];
            hideAutocomplete();
        };
        div.onmouseenter = () => {
            selectedIdx = i;
            updateAutocompleteSelection();
        };
        el.autocompleteDropdown.appendChild(div);
    });

    el.autocompleteDropdown.classList.remove('hidden');
}

function hideAutocomplete() {
    el.autocompleteDropdown.classList.add('hidden');
    selectedIdx = -1;
}

function handleAutocompleteKeydown(e) {
    const items = el.autocompleteDropdown.querySelectorAll('.autocomplete-item');
    const hidden = el.autocompleteDropdown.classList.contains('hidden');

    if (e.key === 'Enter') {
        e.preventDefault();
        if (!hidden && selectedIdx >= 0 && items[selectedIdx]) {
            items[selectedIdx].click();
        } else {
            hideAutocomplete();
            handleGuess();
        }
    } else if (e.key === 'ArrowDown' && !hidden) {
        e.preventDefault();
        selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
        updateAutocompleteSelection();
    } else if (e.key === 'ArrowUp' && !hidden) {
        e.preventDefault();
        selectedIdx = Math.max(selectedIdx - 1, 0);
        updateAutocompleteSelection();
    } else if (e.key === 'Escape') {
        hideAutocomplete();
        clearInput();
    }
}

function updateAutocompleteSelection() {
    const items = el.autocompleteDropdown.querySelectorAll('.autocomplete-item');
    items.forEach((item, i) => item.classList.toggle('selected', i === selectedIdx));
}

// ============================================
// STATS MODAL
// ============================================

function showStatsModal() {
    const s = state.sessionStats;
    const totalAttempts = s.round1.total + s.round2.total + s.round3.total;
    const totalCorrect = s.round1.correct + s.round2.correct + s.round3.correct;
    const avgPts = state.playersAttempted > 0 ? (state.totalScore / state.playersAttempted).toFixed(1) : '0';

    const pct = (c, t) => t > 0 ? ((c / t) * 100).toFixed(0) + '%' : '-';

    el.modalBody.innerHTML = `
        <div class="stat-row">
            <span class="stat-name">Total Score</span>
            <span class="stat-val highlight">${state.totalScore.toLocaleString()}</span>
        </div>
        <div class="stat-row">
            <span class="stat-name">Players Attempted</span>
            <span class="stat-val">${state.playersAttempted}</span>
        </div>
        <div class="stat-row">
            <span class="stat-name">Average Points/Player</span>
            <span class="stat-val">${avgPts}</span>
        </div>
        <div class="stat-row">
            <span class="stat-name">Overall Accuracy</span>
            <span class="stat-val">${pct(totalCorrect, totalAttempts)}</span>
        </div>
        <div class="stat-row">
            <span class="stat-name">Current Streak</span>
            <span class="stat-val">${state.currentStreak}</span>
        </div>
        <div class="stat-row">
            <span class="stat-name">Best Streak</span>
            <span class="stat-val highlight">${state.bestStreak}</span>
        </div>

        <div class="accuracy-section">
            <div class="accuracy-title">Accuracy by Round</div>
            <div class="accuracy-row">
                <span class="round-name">Round 1 (150 pts)</span>
                <span class="accuracy-val">${s.round1.correct}/${s.round1.total} ${pct(s.round1.correct, s.round1.total)}</span>
            </div>
            <div class="accuracy-row">
                <span class="round-name">Round 2 (100 pts)</span>
                <span class="accuracy-val">${s.round2.correct}/${s.round2.total} ${pct(s.round2.correct, s.round2.total)}</span>
            </div>
            <div class="accuracy-row">
                <span class="round-name">Round 3 (50 pts)</span>
                <span class="accuracy-val">${s.round3.correct}/${s.round3.total} ${pct(s.round3.correct, s.round3.total)}</span>
            </div>
        </div>

        <div class="leaderboard-section">
            <div class="leaderboard-title">High Scores</div>
            <div class="leaderboard-list">
                ${renderLeaderboard()}
            </div>
        </div>
    `;

    el.modalOverlay.classList.remove('hidden');
}

function renderLeaderboard() {
    if (state.highScores.length === 0) {
        return '<div class="leaderboard-empty">No high scores yet. Keep playing!</div>';
    }

    return state.highScores.map((entry, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        const isCurrentPlayer = entry.name === state.playerName;
        return `
            <div class="leaderboard-entry ${isCurrentPlayer ? 'current-player' : ''}">
                <span class="leaderboard-rank ${rankClass}">${i + 1}.</span>
                <span class="leaderboard-name">${entry.name}</span>
                <span class="leaderboard-streak">${entry.streak || 0} streak</span>
                <span class="leaderboard-score">${(entry.score || 0).toLocaleString()} pts</span>
            </div>
        `;
    }).join('');
}

function hideStatsModal() {
    el.modalOverlay.classList.add('hidden');
}

function showGameOver(finalStreak) {
    // Build the leaderboard HTML
    let leaderboardHTML = '';
    if (state.highScores.length === 0) {
        leaderboardHTML = '<div class="leaderboard-empty">No high scores yet.</div>';
    } else {
        leaderboardHTML = state.highScores.map((entry, i) => {
            const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
            const isCurrentRun = entry.name === state.playerName && entry.streak === finalStreak && entry.score === state.totalScore;
            return `
                <div class="leaderboard-entry ${isCurrentRun ? 'current-player' : ''}">
                    <span class="leaderboard-rank ${rankClass}">${i + 1}.</span>
                    <span class="leaderboard-name">${entry.name}</span>
                    <span class="leaderboard-streak">${entry.streak} streak</span>
                    <span class="leaderboard-score">${entry.score.toLocaleString()} pts</span>
                </div>
            `;
        }).join('');
    }

    el.modalBody.innerHTML = `
        <div class="game-over-content">
            <div class="game-over-title">Game Over!</div>
            <div class="game-over-answer">The answer was <strong>${state.currentPlayer['Player']}</strong></div>
            <div class="game-over-stats">
                <div class="game-over-stat">
                    <span class="game-over-stat-value">${finalStreak}</span>
                    <span class="game-over-stat-label">Streak</span>
                </div>
                <div class="game-over-stat">
                    <span class="game-over-stat-value">${state.totalScore.toLocaleString()}</span>
                    <span class="game-over-stat-label">Total Score</span>
                </div>
                <div class="game-over-stat">
                    <span class="game-over-stat-value">${state.playersAttempted}</span>
                    <span class="game-over-stat-label">Players</span>
                </div>
            </div>
            <div class="leaderboard-section">
                <div class="leaderboard-title">🏆 Top 10 All-Time</div>
                <div class="leaderboard-list">
                    ${leaderboardHTML}
                </div>
            </div>
            <button class="play-again-btn" id="play-again-btn">Play Again</button>
        </div>
    `;

    // Update modal header for game over
    const modalHeader = document.querySelector('.modal-header h2');
    modalHeader.textContent = 'Game Over';

    el.modalOverlay.classList.remove('hidden');

    // Add play again listener
    document.getElementById('play-again-btn').addEventListener('click', () => {
        hideStatsModal();
        resetGameState();
        showNameModal();
    });
}

function loadSessionStats() {
    try {
        const saved = localStorage.getItem('nba_game_stats');
        if (saved) {
            const data = JSON.parse(saved);
            state.totalScore = data.totalScore || 0;
            state.playersAttempted = data.playersAttempted || 0;
            state.bestStreak = data.bestStreak || 0;
            state.sessionStats = data.sessionStats || state.sessionStats;

            el.score.textContent = state.totalScore;
            el.playersAttempted.textContent = state.playersAttempted;
        }
    } catch (e) {
        console.log('No saved stats found');
    }
}

function saveSessionStats() {
    try {
        localStorage.setItem('nba_game_stats', JSON.stringify({
            totalScore: state.totalScore,
            playersAttempted: state.playersAttempted,
            bestStreak: state.bestStreak,
            sessionStats: state.sessionStats
        }));
    } catch (e) {
        console.log('Could not save stats');
    }
}

// ============================================
// UI HELPERS
// ============================================

function showFeedback(type, message) {
    el.feedback.className = `feedback ${type}`;
    el.feedbackText.textContent = message;
    el.feedback.classList.remove('hidden');
}

function hideFeedback() {
    el.feedback.classList.add('hidden');
}

function showNextButton() {
    el.nextBtn.classList.remove('hidden');
}

function hideNextButton() {
    el.nextBtn.classList.add('hidden');
}

function enableInput() {
    el.playerInput.disabled = false;
    el.submitBtn.disabled = false;
}

function disableInput() {
    el.playerInput.disabled = true;
    el.submitBtn.disabled = true;
}

function clearInput() {
    el.playerInput.value = '';
    hideAutocomplete();
}

// ============================================
// EVENT LISTENERS
// ============================================

el.submitBtn.addEventListener('click', handleGuess);
el.nextBtn.addEventListener('click', startNewPlayer);
el.statsBtn.addEventListener('click', showStatsModal);
el.modalClose.addEventListener('click', hideStatsModal);
el.modalOverlay.addEventListener('click', (e) => {
    if (e.target === el.modalOverlay) hideStatsModal();
});

// Name modal listeners
el.nameSubmitBtn.addEventListener('click', submitName);
el.nameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitName();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.modalOverlay.classList.contains('hidden')) {
        hideStatsModal();
    }
});

// ============================================
// INITIALIZE
// ============================================

setupAutocomplete();
loadCSV();
