// Bias Detective: quick rounds where the learner names the bias in a field example,
// then reads its definition and counter-strategy.
(async function () {
  'use strict';
  const { esc } = App;
  const root = document.getElementById('detective-root');
  const stats = document.getElementById('det-stats');
  const ROUND = 5;
  const OPTIONS = 3;
  const KEYS = 'ABC';
  // Biases whose field examples are close enough that offering both would be unfair.
  const CLOSE = [['affinity', 'language'], ['stereotyping', 'threat'], ['attribution', 'ethnocentrism'], ['confirmation', 'anchoring'], ['saviour', 'deficit']];

  let S;
  try {
    S = await App.loadScenarios();
  } catch (err) {
    App.showError(root, err);
    return;
  }
  const biases = S.biases;
  let round = null;

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  const tooClose = (a, b) => CLOSE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

  function showStats() {
    const d = Game.detective();
    stats.textContent = `${Object.keys(d.found).length} of ${biases.length} biases spotted${d.rounds ? ` · best round ${d.best}/${ROUND}` : ''}`;
  }

  // Cards favor biases the learner hasn't spotted yet, so each round teaches something new.
  function newRound() {
    const found = Game.detective().found;
    const order = shuffle(biases.filter((b) => !found[b.id])).concat(shuffle(biases.filter((b) => found[b.id])));
    round = {
      index: 0,
      results: [],
      xp: 0,
      cards: order.slice(0, ROUND).map((b) => ({
        bias: b,
        options: shuffle([b, ...shuffle(biases.filter((o) => o.id !== b.id && !tooClose(o.id, b.id))).slice(0, OPTIONS - 1)])
      }))
    };
  }

  function dots() {
    return `<div class="det-dots" aria-hidden="true">${round.cards.map((_, i) =>
      `<span class="${i < round.results.length ? (round.results[i] ? 'is-right' : 'is-wrong') : i === round.index ? 'is-current' : ''}"></span>`).join('')}</div>`;
  }

  function start() {
    const played = Game.detective().rounds;
    root.innerHTML = `
      <div class="d-flex flex-wrap align-items-center gap-3">
        <button class="btn btn-primary btn-lg" id="det-start"><i class="bi bi-play-fill" aria-hidden="true"></i> ${played ? 'Play another round' : 'Start a round'}</button>
        <span class="small text-muted-2">+${Game.XP.bias} XP for each new bias you spot · +${Game.XP.perfect} XP for a perfect round</span>
      </div>`;
    document.getElementById('det-start').addEventListener('click', () => {
      newRound();
      card();
      root.querySelector('.choice-btn').focus();
    });
  }

  function card() {
    const c = round.cards[round.index];
    root.innerHTML = `
      <div class="d-flex justify-content-between align-items-center gap-2 mb-2">
        <p class="eyebrow mb-0">Case ${round.index + 1} of ${ROUND}</p>${dots()}
      </div>
      <p class="det-clue">“${esc(c.bias.fieldExample)}”</p>
      <fieldset>
        <legend class="small fw-semibold text-muted-2">Which bias is at play?</legend>
        <div class="d-grid gap-2" id="det-options">
          ${c.options.map((o, i) => `
            <button type="button" class="choice-btn" data-id="${o.id}"><span class="choice-key" aria-hidden="true">${KEYS[i]}</span><span>${esc(o.name)}</span></button>`).join('')}
        </div>
      </fieldset>
      <p class="kbd-hint mt-2 mb-0">Tip: press <kbd>A</kbd>–<kbd>C</kbd> to answer, then <kbd>Enter</kbd>.</p>
      <div id="det-feedback" class="mt-3" tabindex="-1"></div>`;
    document.getElementById('det-options').addEventListener('click', (e) => {
      const b = e.target.closest('.choice-btn');
      if (b && !b.disabled) answer(b.dataset.id);
    });
  }

  function answer(id) {
    const c = round.cards[round.index];
    const right = id === c.bias.id;
    round.results.push(right);
    const xp = right ? Game.onBiasSpotted(c.bias) : 0;
    round.xp += xp;
    root.querySelectorAll('#det-options .choice-btn').forEach((b) => {
      b.disabled = true;
      if (b.dataset.id === c.bias.id) b.classList.add('is-right');
      else if (b.dataset.id === id) b.classList.add('is-wrong');
      else b.classList.add('is-dimmed');
    });
    root.querySelector('.det-dots').outerHTML = dots();
    const fb = document.getElementById('det-feedback');
    fb.innerHTML = `
      <div class="feedback-box rating-${right ? 'strong' : 'weak'} p-3">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
          <strong>${right ? '<i class="bi bi-check-circle-fill text-success" aria-hidden="true"></i> Correct.'
            : `<i class="bi bi-x-circle-fill text-danger" aria-hidden="true"></i> Not quite. This is ${esc(c.bias.name)}.`}</strong>
          ${xp ? `<span class="xp-pop">+${xp} XP · new bias</span>` : ''}
        </div>
        <p class="small mb-1"><strong>What it is:</strong> ${esc(c.bias.definition)}</p>
        <p class="small mb-0"><strong>Counter-strategy:</strong> ${esc(c.bias.counter)}</p>
      </div>
      <div class="text-end mt-3">
        <button class="btn btn-primary" id="det-next">${round.index + 1 < ROUND ? 'Next case' : 'See your score'} <i class="bi bi-arrow-right" aria-hidden="true"></i></button>
      </div>`;
    fb.focus();
    showStats();
    document.getElementById('det-next').addEventListener('click', () => {
      round.index += 1;
      if (round.index < ROUND) {
        card();
        root.querySelector('.choice-btn').focus();
      } else {
        finish();
      }
    });
  }

  function finish() {
    const score = round.results.filter(Boolean).length;
    round.xp += Game.onDetectiveRound(score, ROUND);
    const missed = round.cards.filter((_, i) => !round.results[i]).map((c) => c.bias);
    const found = Object.keys(Game.detective().found).length;
    root.innerHTML = `
      <div class="text-center py-1" id="det-result" tabindex="-1">
        <p class="eyebrow mb-1">Round complete</p>
        <div class="result-stars mb-1">${Game.starsHtml(score === ROUND ? 3 : score >= 3 ? 2 : 1)}</div>
        <p class="h4 mb-1">You spotted ${score} of ${ROUND}</p>
        <p class="mb-2">${score === ROUND ? 'A perfect round. Well observed.' : score >= 3 ? 'Good work. Review the ones you missed.' : 'Every miss is a pattern you will now notice in the field.'}</p>
        <p class="mb-3">${round.xp ? `<span class="xp-pop">+${round.xp} XP</span>` : '<span class="xp-pop is-zero">No new XP this round</span>'}
          <span class="small text-muted-2 ms-1">${found} of ${biases.length} biases spotted so far</span></p>
        ${missed.length ? `<p class="small mb-3">Review: ${missed.map((b) => `<a href="#bias-${b.id}">${esc(b.name)}</a>`).join(', ')}</p>` : ''}
        <div class="d-flex flex-wrap justify-content-center gap-2">
          <button class="btn btn-primary" id="det-again"><i class="bi bi-arrow-repeat" aria-hidden="true"></i> Play again</button>
          <a class="btn btn-outline-primary" href="#lib-h">Study the bias library</a>
        </div>
      </div>`;
    document.getElementById('det-result').focus();
    showStats();
    document.getElementById('det-again').addEventListener('click', () => {
      newRound();
      card();
      root.querySelector('.choice-btn').focus();
    });
  }

  // Keyboard play while focus is in the game: A–C answer, Enter moves on.
  root.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || !round) return;
    const key = e.key.toUpperCase();
    const option = KEYS.includes(key) && root.querySelectorAll('#det-options .choice-btn:not(:disabled)')[KEYS.indexOf(key)];
    if (option) {
      e.preventDefault();
      option.click();
      return;
    }
    const next = document.getElementById('det-next');
    if (next && e.key === 'Enter' && !e.target.closest('button, a')) {
      e.preventDefault();
      next.click();
    }
  });

  showStats();
  start();
})();
