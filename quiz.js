
(function (root) {
  "use strict";

  const Rules = root.SnakeLadderRules;
  if (!Rules) return;

  const Rewards = root.Rewards || { unlock: function () {} };

  const Fx = root.Fx || { play: function () {} };

  let quiz = null;

  function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function squareOptions(correct, pool) {
    const opts = [correct];
    shuffle(pool.filter(function (v) { return v !== correct; })).forEach(function (v) {
      if (opts.length < 4 && opts.indexOf(v) === -1) opts.push(v);
    });
    let f = 1;
    while (opts.length < 4) {
      const v = correct + f;
      if (v > 0 && v <= Rules.TOTAL && opts.indexOf(v) === -1) opts.push(v);
      f++;
    }
    return shuffle(opts);
  }

  function countOptions(correct) {
    const opts = [correct];
    const cands = [];
    for (let d = 1; d <= 3; d++) cands.push(correct - d, correct + d);
    shuffle(cands).forEach(function (v) {
      if (opts.length < 4 && v > 0 && opts.indexOf(v) === -1) opts.push(v);
    });
    return shuffle(opts);
  }

  function buildQuiz() {
    const ladders = Object.keys(Rules.LADDERS).map(Number);
    const snakes = Object.keys(Rules.SNAKES).map(Number);
    const pool = ladders.concat(snakes);
    const ladderCount = ladders.length;
    const snakeCount = snakes.length;

    const biggest = ladders.reduce(function (a, b) {
      return Rules.LADDERS[b] - b > Rules.LADDERS[a] - a ? b : a;
    });
    const worstSnake = snakes.reduce(function (a, b) {
      return a - Rules.SNAKES[a] > b - Rules.SNAKES[b] ? a : b;
    });
    const ladderTo = function (target) {
      return ladders.filter(function (s) { return Rules.LADDERS[s] === target; })[0];
    };
    const snakeTo = function (target) {
      return snakes.filter(function (s) { return Rules.SNAKES[s] === target; })[0];
    };

    const questions = [
      {
        text: "Which square has the biggest ladder on the board?",
        options: squareOptions(biggest, pool),
        answer: biggest,
        note: "Square <b>" + biggest + "</b> climbs you to <b>" + Rules.LADDERS[biggest] +
          "</b> — a jump of " + (Rules.LADDERS[biggest] - biggest) + " squares."
      },
      {
        text: "The ladder on square 28 takes you to…",
        options: squareOptions(84, pool),
        answer: 84,
        note: "The 28 → 84 ladder is the biggest on the board. Land on 28 and you are nearly at the finish."
      },
      {
        text: "The snake on square 62 slides you down to…",
        options: squareOptions(19, pool),
        answer: 19,
        note: "Square 62 drops you back <b>43 squares</b> to 19 — the longest slide on the board."
      },
      {
        text: "How many ladders are on the board?",
        options: countOptions(ladderCount),
        answer: ladderCount,
        note: "There are <b>" + ladderCount + " ladders</b> and <b>" + snakeCount + " snakes</b>."
      },
      {
        text: "How many snakes are on the board?",
        options: countOptions(snakeCount),
        answer: snakeCount,
        note: "There are <b>" + snakeCount + " snakes</b> and <b>" + ladderCount + " ladders</b>."
      },
      {
        text: "Which square drops you down to 75?",
        options: squareOptions(snakeTo(75), pool),
        answer: snakeTo(75),
        note: "The snake on square <b>" + snakeTo(75) + "</b> slides you back 20 squares to 75."
      },
      {
        text: "Which square takes you all the way to 98?",
        options: squareOptions(ladderTo(98), pool),
        answer: ladderTo(98),
        note: "The ladder on square <b>" + ladderTo(98) + "</b> is your back door to the finish."
      },
      {
        text: "Which snake sends you back the furthest?",
        options: squareOptions(worstSnake, pool),
        answer: worstSnake,
        note: "The snake on square <b>" + worstSnake + "</b> sends you back " +
          (worstSnake - Rules.SNAKES[worstSnake]) + " squares."
      }
    ];

    return shuffle(questions).slice(0, 8);
  }

  function render() {
    const host = document.getElementById("quizBox");
    if (!host || !quiz) return;
    const current = quiz.questions[quiz.index];
    const total = quiz.questions.length;
    host.innerHTML = "";

    const progress = document.createElement("div");
    progress.className = "quiz-progress";
    progress.innerHTML = "<span>Question " + (quiz.index + 1) + " of " + total + "</span>" +
      '<span class="quiz-track"><span style="width:' +
      Math.round(quiz.index / total * 100) + '%"></span></span>';
    host.appendChild(progress);

    const question = document.createElement("p");
    question.className = "quiz-q";
    question.textContent = current.text;
    host.appendChild(question);

    const options = document.createElement("div");
    options.className = "quiz-options";
    current.options.forEach(function (value) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quiz-option";
      button.textContent = String(value);
      button.addEventListener("click", function () { answer(value, button, options); });
      options.appendChild(button);
    });
    host.appendChild(options);

    const note = document.createElement("p");
    note.className = "quiz-note";
    note.id = "quizNote";
    note.style.display = "none";
    host.appendChild(note);

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    actions.id = "quizActions";
    host.appendChild(actions);
  }

  function answer(value, button, options) {
    if (!quiz || quiz.answered) return;
    quiz.answered = true;
    const current = quiz.questions[quiz.index];
    const right = value === current.answer;
    if (right) { quiz.score++; Fx.play("quizRight"); } else { Fx.play("quizWrong"); }

    Array.prototype.forEach.call(options.children, function (b) {
      b.disabled = true;
      if (Number(b.textContent) === current.answer) b.classList.add("right");
      else if (b === button) b.classList.add("wrong");
    });

    const note = document.getElementById("quizNote");
    if (note) {
      note.style.display = "";
      note.innerHTML = (right ? "✅ Correct. " : "❌ Not quite. ") + current.note;
    }

    const actions = document.getElementById("quizActions");
    if (!actions) return;
    actions.innerHTML = "";
    const next = document.createElement("button");
    next.type = "button";
    next.textContent = quiz.index + 1 < quiz.questions.length ? "Next question →" : "See my score";
    next.addEventListener("click", function () {
      quiz.index++;
      quiz.answered = false;
      if (quiz.index < quiz.questions.length) render();
      else finish();
    });
    actions.appendChild(next);
  }

  function finish() {
    const host = document.getElementById("quizBox");
    if (!host || !quiz) return;
    const total = quiz.questions.length;
    host.innerHTML = "";

    const score = document.createElement("div");
    score.className = "quiz-score";
    score.innerHTML = "You scored <b>" + quiz.score + " / " + total + "</b>";
    host.appendChild(score);

    const note = document.createElement("p");
    note.className = "quiz-note";
    note.textContent = quiz.score === total
      ? "Perfect! You know this board better than the snakes do."
      : quiz.score >= total / 2
        ? "Good job — a couple of squares are still a mystery. Have another look at the board above."
        : "Worth another look at the board above, then come back for the badge.";
    host.appendChild(note);

    if (quiz.score === total) Rewards.unlock("quiz-ace");

    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    const again = document.createElement("button");
    again.type = "button";
    again.textContent = "Play again";
    again.addEventListener("click", start);
    actions.appendChild(again);
    const share = document.createElement("button");
    share.type = "button";
    share.className = "ghost";
    share.textContent = "Share my score";
    share.addEventListener("click", shareScore);
    actions.appendChild(share);
    host.appendChild(actions);
  }

  function shareScore() {
    if (!quiz) return;
    const text = "I scored " + quiz.score + "/" + quiz.questions.length +
      " on the Snake & Ladder board quiz! 🧠🎲";
    const url = new URL("index.html#quizSection", location.href.split("#")[0]).toString();
    if (navigator.share) {
      navigator.share({ title: "Snake & Ladder board quiz", text: text, url: url }).catch(function () {});
      return;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text + " " + url).catch(function () {});
    }
  }

  function start() {
    quiz = { questions: buildQuiz(), index: 0, score: 0, answered: false };
    render();
  }

  function init() {
    const host = document.getElementById("quizBox");
    if (!host) return;
    host.innerHTML = "";
    const intro = document.createElement("p");
    intro.className = "quiz-note";
    intro.textContent = "Eight questions about the ladders and snakes on the board above. " +
      "A perfect score earns the Quiz Ace badge.";
    host.appendChild(intro);
    const actions = document.createElement("div");
    actions.className = "quiz-actions";
    const startButton = document.createElement("button");
    startButton.type = "button";
    startButton.textContent = "Start the quiz";
    startButton.addEventListener("click", start);
    actions.appendChild(startButton);
    host.appendChild(actions);
  }

  root.BoardQuiz = { init: init, start: start };
})(window);
