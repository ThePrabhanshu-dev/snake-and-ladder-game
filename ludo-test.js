/* Node test suite for the Ludo rules. Run: node ludo-test.js */
const R = require("./ludo-rules.js");

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
function eq(name, actual, expected) {
  check(name, actual === expected, { actual, expected });
}

console.log("Board layout");
{
  eq("the board is 15 x 15", R.SIZE, 15);
  eq("the track has 56 squares", R.TRACK_LEN, 56);
  eq("the home column has 6 squares", R.HOME_LEN, 6);
  eq("the centre is the last square of a path", R.CENTER_INDEX, 63);
  eq("a yard slot is marked with -1", R.YARD, -1);

  const seen = new Set();
  let unique = true;
  R.TRACK.forEach(c => {
    const k = R.cellKey(c);
    if (seen.has(k)) unique = false;
    seen.add(k);
  });
  check("all 56 track squares are unique", unique);
  check("all track squares sit inside the board", R.TRACK.every(c => c[0] >= 0 && c[0] < 15 && c[1] >= 0 && c[1] < 15));
  check("the centre square is the middle of the board", R.CENTER[0] === 7 && R.CENTER[1] === 7);
}

console.log("\nEvery colour has a valid path");
{
  R.COLORS.forEach(c => {
    const path = R.pathFor(c.id);
    eq(c.id + " has 64 path squares", path.length, 64);
    const start = R.startCell(c.id);
    eq(c.id + " starts on its own start square", R.cellKey(path[0]), R.cellKey(start));
    check(c.id + " start square is on the track", R.TRACK.some(t => t[0] === start[0] && t[1] === start[1]));
    eq(c.id + " home column has 6 squares", c.home.length, 6);
    check(c.id + " home column ends next to the centre",
      Math.abs(c.home[5][0] - 7) + Math.abs(c.home[5][1] - 7) === 1);
    check(c.id + " home column is entered from the start square",
      Math.abs(c.home[0][0] - start[0]) + Math.abs(c.home[0][1] - start[1]) === 1);
    check(c.id + " yard holds four slots",
      [0, 1, 2, 3].every(i => { const s = R.yardSlot(c.id, i); return s[0] >= c.yard.r0 && s[0] <= c.yard.r1 && s[1] >= c.yard.c0 && s[1] <= c.yard.c1; }));
  });
}

console.log("\nSafe squares");
{
  eq("there are eight safe squares", R.SAFE_TRACK_INDEXES.length + R.COLORS.length, 8);
  check("every start square is safe", R.COLORS.every(c => R.isSafeCell(R.startCell(c.id))));
  check("the safe squares sit on the track",
    R.SAFE_TRACK_INDEXES.every(i => R.TRACK[i].every((v, idx) => v === R.TRACK[i][idx])));
  check("a plain track square is not safe", !R.isSafeCell([7, 7]));
}

console.log("\nPlayer counts");
{
  eq("two players use red and yellow", R.colorsFor(2).join(","), "red,yellow");
  eq("three players add blue", R.colorsFor(3).join(","), "red,blue,yellow");
  eq("four players use every colour", R.colorsFor(4).length, 4);
  eq("a silly count is clamped to two", R.colorsFor(1).length, 2);
  eq("a silly count is clamped to four", R.colorsFor(9).length, 4);
}

console.log("\nLeaving the yard");
{
  const g = R.newGame(["red", "blue"]);
  const moves = R.legalMoves(g, 0, 3);
  eq("a token cannot leave the yard without a six", moves.length, 0);
  const sixMoves = R.legalMoves(g, 0, 6);
  eq("a six lets any yard token out", sixMoves.length, 4);
  eq("the token lands on the start square", sixMoves[0].to, 0);
  eq("the token came from the yard", sixMoves[0].from, R.YARD);
}

console.log("\nBlocking");
{
  const bluePath = R.pathFor("blue");
  const redPath = R.pathFor("red");
  // Two blue tokens sitting together on one square block red's road.
  const blockCell = bluePath[0];
  let blockIndex = -1;
  for (let i = 0; i < redPath.length; i++) {
    if (R.cellKey(redPath[i]) === R.cellKey(blockCell)) { blockIndex = i; break; }
  }
  check("the block square is on the red path", blockIndex !== -1);
  if (blockIndex !== -1) {
    const g2 = R.newGame(["red", "blue"]);
    g2.players[0].tokens = [blockIndex - 1, R.YARD, R.YARD, R.YARD];
    g2.players[1].tokens = [0, 0, R.YARD, R.YARD];
    eq("a token cannot land on a pair of opponents", R.legalMoves(g2, 0, 1).length, 0);

    // A token that would have to jump over the pair is not allowed either.
    const g3 = R.newGame(["red", "blue"]);
    g3.players[0].tokens = [blockIndex - 1, R.YARD, R.YARD, R.YARD];
    g3.players[1].tokens = [0, 0, R.YARD, R.YARD];
    eq("a token cannot jump over a pair of opponents", R.legalMoves(g3, 0, 3).length, 0);

    // One opponent alone on the square can be captured.
    const g4 = R.newGame(["red", "blue"]);
    g4.players[0].tokens = [blockIndex - 1, R.YARD, R.YARD, R.YARD];
    g4.players[1].tokens = [0, R.YARD, R.YARD, R.YARD];
    eq("a lone opponent on the square can be landed on", R.legalMoves(g4, 0, 1).length, 1);
  }
}

console.log("\nCaptures");
{
  const g = R.newGame(["red", "blue"]);
  const redPath = R.pathFor("red");
  const bluePath = R.pathFor("blue");
  // Put a blue token on the square red's token is about to reach.
  const target = redPath[6];
  let blueIndex = -1;
  for (let i = 0; i < bluePath.length; i++) {
    if (R.cellKey(bluePath[i]) === R.cellKey(target)) { blueIndex = i; break; }
  }
  check("the target square is on the blue path", blueIndex !== -1);
  g.players[0].tokens = [5, R.YARD, R.YARD, R.YARD];
  g.players[1].tokens = [blueIndex, R.YARD, R.YARD, R.YARD];
  const moves = R.legalMoves(g, 0, 1);
  eq("landing on a single opponent is allowed", moves.length, 1);
  check("the move reports a capture", !!moves[0].capture);
  eq("the capture points at the blue token", moves[0].capture.player, 1);

  const res = R.applyMove(g, 0, moves[0]);
  eq("the red token moved", g.players[0].tokens[0], 6);
  eq("the captured token goes back to the yard", g.players[1].tokens[0], R.YARD);
  eq("applyMove reports the capture", res.captured.player, 1);
  eq("applyMove reports the mover", res.player, 0);
}

console.log("\nSafe squares cannot be captured");
{
  const g = R.newGame(["red", "blue"]);
  const redPath = R.pathFor("red");
  const bluePath = R.pathFor("blue");
  // Red's start square is safe; put a blue token right before it.
  const redStart = R.startCell("red");
  let blueIndex = -1;
  for (let i = 0; i < bluePath.length; i++) {
    if (R.cellKey(bluePath[i]) === R.cellKey(redStart)) { blueIndex = i; break; }
  }
  g.players[0].tokens = [R.YARD, R.YARD, R.YARD, R.YARD];
  g.players[1].tokens = [blueIndex, R.YARD, R.YARD, R.YARD];
  const moves = R.legalMoves(g, 0, 6);
  eq("a token may still enter a safe square", moves.length, 4);
  check("but it captures nobody", moves.every(m => m.capture === null));
  void redPath;
}

console.log("\nThe home column and the centre");
{
  const g = R.newGame(["red", "blue"]);
  // Put a red token on the last home column square (index 62).
  g.players[0].tokens = [62, R.YARD, R.YARD, R.YARD];
  const moves = R.legalMoves(g, 0, 1);
  eq("an exact roll reaches the centre", moves.length, 1);
  eq("the token lands on the centre", moves[0].to, R.CENTER_INDEX);
  const res = R.applyMove(g, 0, moves[0]);
  eq("applyMove reports the token is home", res.home, true);

  const g2 = R.newGame(["red", "blue"]);
  g2.players[0].tokens = [61, R.YARD, R.YARD, R.YARD];
  eq("overshooting the centre is not allowed", R.legalMoves(g2, 0, 3).length, 0);
  eq("the exact roll to the centre is allowed", R.legalMoves(g2, 0, 2).length, 1);
}

console.log("\nA token has to visit its start square again");
{
  const g = R.newGame(["red", "blue"]);
  // The last track square before the start square again is index 55.
  g.players[0].tokens = [55, R.YARD, R.YARD, R.YARD];
  const moves = R.legalMoves(g, 0, 1);
  eq("one step lands on the start square", moves[0].to, R.START_AGAIN);
  const g2 = R.newGame(["red", "blue"]);
  g2.players[0].tokens = [55, R.YARD, R.YARD, R.YARD];
  eq("a bigger roll cannot skip the start square", R.legalMoves(g2, 0, 2).length, 0);
  eq("a six may only bring a yard token out", R.legalMoves(g2, 0, 6).length, 3);
  check("no move skips the start square", R.legalMoves(g2, 0, 6).every(m => m.from !== 55));
}

console.log("\nWinning");
{
  const g = R.newGame(["red", "blue"]);
  g.players[0].tokens = [R.CENTER_INDEX, R.CENTER_INDEX, 20, R.YARD];
  eq("a player with tokens still out has not won", R.hasWon(g.players[0]), false);
  eq("two tokens are home", R.atHome(g.players[0]), 2);
  eq("one token is still in the yard", R.inYard(g.players[0]), 1);
  g.players[0].tokens = [R.CENTER_INDEX, R.CENTER_INDEX, R.CENTER_INDEX, R.CENTER_INDEX];
  eq("four tokens at home is a win", R.hasWon(g.players[0]), true);
}

console.log("\nIllegal input");
{
  let threw = false;
  try { R.legalMoves(R.newGame(["red", "blue"]), 0, 7); } catch (e) { threw = e instanceof RangeError; }
  check("a roll above six is rejected", threw);
  threw = false;
  try { R.legalMoves(R.newGame(["red", "blue"]), 0, 2.5); } catch (e) { threw = e instanceof RangeError; }
  check("a fractional roll is rejected", threw);
  threw = false;
  try { R.pathFor("purple"); } catch (e) { threw = e instanceof Error; }
  check("an unknown colour is rejected", threw);
  threw = false;
  try { R.applyMove(R.newGame(["red", "blue"]), 0, { token: 9, from: 0, to: 1 }); } catch (e) { threw = e instanceof RangeError; }
  check("an unknown token is rejected", threw);
}

console.log("\nFull game simulation (300 randomized games)");
{
  let finished = 0, stuck = 0, maxRounds = 0, totalRounds = 0, illegal = 0;
  for (let g = 0; g < 300; g++) {
    const count = 2 + (g % 3);
    const state = R.newGame(R.colorsFor(count));
    let rounds = 0, done = false;
    while (rounds < 6000 && !done) {
      rounds++;
      const roll = 1 + Math.floor(Math.random() * 6);
      const moves = R.legalMoves(state, state.turn, roll);
      if (!moves.length) {
        state.turn = (state.turn + 1) % state.players.length;
        continue;
      }
      const move = moves[Math.floor(Math.random() * moves.length)];
      R.applyMove(state, state.turn, move);
      if (R.hasWon(state.players[state.turn])) { done = true; finished++; break; }
      state.turn = (state.turn + 1) % state.players.length;
    }
    if (!done) stuck++;
    else {
      const winner = state.players.find(p => R.hasWon(p));
      if (!winner || winner.tokens.some(t => t !== R.CENTER_INDEX)) illegal++;
    }
    totalRounds += rounds;
    if (rounds > maxRounds) maxRounds = rounds;
  }
  check("every game finishes (no infinite loop)", stuck === 0, { stuck });
  check("every winner owns all four tokens at the centre", illegal === 0, { illegal });
  check("average game under 700 rounds", totalRounds / 300 < 700, { avg: Math.round(totalRounds / 300) });
  console.log("  INFO  finished=" + finished + " avgRounds=" + Math.round(totalRounds / 300) + " maxRounds=" + maxRounds);
}

console.log("\nNo token can ever leave the board");
{
  let ok = true;
  for (let g = 0; g < 200; g++) {
    const state = R.newGame(R.colorsFor(4));
    for (let i = 0; i < 400; i++) {
      const roll = 1 + Math.floor(Math.random() * 6);
      const moves = R.legalMoves(state, state.turn, roll);
      if (!moves.length) { state.turn = (state.turn + 1) % state.players.length; continue; }
      const move = moves[Math.floor(Math.random() * moves.length)];
      R.applyMove(state, state.turn, move);
      state.players.forEach(p => p.tokens.forEach(t => {
        if (t < R.YARD || t > R.CENTER_INDEX) ok = false;
      }));
      state.turn = (state.turn + 1) % state.players.length;
    }
  }
  check("every token stays between the yard and the centre", ok);
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
