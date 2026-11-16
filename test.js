
const R = require("./rules.js");

let passed = 0, failed = 0;
function check(name, cond, extra) {
  if (cond) { passed++; console.log("  PASS  " + name); }
  else { failed++; console.log("  FAIL  " + name + (extra !== undefined ? "  -> " + JSON.stringify(extra) : "")); }
}
function eq(name, actual, expected) {
  check(name, actual === expected, { actual, expected });
}

console.log("Coord mapping");
eq("square 1 is bottom-left", JSON.stringify(R.coord(1)), JSON.stringify({ row: 0, col: 0 }));
eq("square 10 is bottom-right", JSON.stringify(R.coord(10)), JSON.stringify({ row: 0, col: 9 }));
eq("square 11 is one row up, right side", JSON.stringify(R.coord(11)), JSON.stringify({ row: 1, col: 9 }));
eq("square 20 is row 1, left side", JSON.stringify(R.coord(20)), JSON.stringify({ row: 1, col: 0 }));
eq("square 100 is top-left", JSON.stringify(R.coord(100)), JSON.stringify({ row: 9, col: 0 }));
eq("square 91 is top-right", JSON.stringify(R.coord(91)), JSON.stringify({ row: 9, col: 9 }));

console.log("\nAll 100 squares map to unique grid positions");
{
  const seen = new Set();
  for (let n = 1; n <= R.TOTAL; n++) {
    const c = R.coord(n);
    seen.add(c.row + ":" + c.col);
  }
  eq("100 unique positions", seen.size, 100);
  let inRange = true;
  for (let n = 1; n <= R.TOTAL; n++) {
    const c = R.coord(n);
    if (c.row < 0 || c.row > 9 || c.col < 0 || c.col > 9) inRange = false;
  }
  check("all positions inside the 10x10 grid", inRange);
}

console.log("\nLadders and snakes");
eq("ladder 1 climbs to 38", R.resolve(1).square, 38);
eq("ladder 28 climbs to 84", R.resolve(28).square, 84);
eq("snake 16 drops to 6", R.resolve(16).square, 6);
eq("snake 87 drops to 24", R.resolve(87).square, 24);
eq("square 50 has no jump", R.resolve(50).jumps.length, 0);
eq("ladder reports its source", R.resolve(1).jumps[0].from, 1);
eq("ladder reports its target", R.resolve(1).jumps[0].to, 38);
check("no jump target exceeds 100", Object.values(R.JUMPS).every(v => v <= 100 && v >= 1));
check("no jump source equals its target", Object.keys(R.JUMPS).every(k => R.JUMPS[k] !== Number(k)));

console.log("\nMovement");
{
  const s = R.step({ pos: 10 }, 3, 0);
  eq("moves forward by the roll", s.pos, 13);
  eq("no bonus without a 6", s.bonus, false);
  eq("not a win", s.won, false);
}
{
  const s = R.step({ pos: 97 }, 3, 0);
  eq("exact 100 wins", s.pos, 100);
  eq("win flag set", s.won, true);
}
{
  const s = R.step({ pos: 98 }, 5, 0);
  eq("overshooting 100 does not move", s.pos, 98);
  eq("overshoot flag set", s.overshoot, true);
  eq("overshoot is not a win", s.won, false);
}
{
  const s = R.step({ pos: 0 }, 3, 0);
  eq("leaving start works", s.pos, 3);
}
{
  const s = R.step({ pos: 0 }, 4, 0);
  eq("landing on 4 climbs the ladder to 14", s.pos, 14);
  eq("ladder jump recorded", s.jumps.length, 1);
}
{
  const s = R.step({ pos: 0 }, 1, 0);
  eq("landing on 1 climbs the ladder to 38", s.pos, 38);
  eq("ladder jump recorded from 1", s.jumps.length, 1);
}
{
  const s = R.step({ pos: 12 }, 4, 0);
  eq("landing on 16 slides down the snake to 6", s.pos, 6);
  eq("snake jump recorded", s.jumps.length, 1);
}
{
  const s = R.step({ pos: 90 }, 6, 0);
  eq("six grants a bonus turn", s.bonus, true);
  eq("six counter increments", s.sixes, 1);
}{
  const s = R.step({ pos: 90 }, 6, 2);
  eq("three sixes reset to square 1", s.pos, 1);
  eq("three sixes flagged", s.tripleSix, true);
  eq("three sixes clears the counter", s.sixes, 0);
}
{
  const s = R.step({ pos: 90 }, 4, 2);
  eq("a non-six resets the six counter", s.sixes, 0);
}
{
  const s = R.step({ pos: 1 }, 6, 0);
  eq("rolling a 6 from 1 lands on 7", s.pos, 7);
  eq("no ladder triggered from 7", s.jumps.length, 0);
}

console.log("\nThe sixes counter belongs to the player");
{
  const p = { pos: 90, sixes: 2 };
  const s = R.step(p, 6);
  eq("a player's own counter triggers the triple six", s.tripleSix, true);
  eq("triple six sends the player back to 1", s.pos, 1);
  eq("the counter is cleared after a triple six", s.sixes, 0);
}
{

  const s = R.step({ pos: 97, sixes: 0 }, 6);
  eq("a six that overshoots does not move the player", s.pos, 97);
  eq("a six that overshoots is flagged as an overshoot", s.overshoot, true);
  eq("a six that overshoots does not grant a bonus turn", s.bonus, false);
  eq("a six that overshoots still counts towards the counter", s.sixes, 1);
}
{

  const a = { pos: 10, sixes: 1 };
  const b = { pos: 10, sixes: 0 };
  const ra = R.step(a, 6);
  eq("step does not mutate the player", a.sixes, 1);
  a.sixes = ra.sixes;
  const sb = R.step(b, 6);
  eq("a second player starts their own counter", sb.sixes, 1);
  eq("the first player keeps their counter", a.sixes, 2);
}
{
  let threw = false;
  try { R.step({ pos: 0 }, 7); } catch (e) { threw = e instanceof RangeError; }
  check("an impossible roll is rejected", threw);
  threw = false;
  try { R.step({ pos: 0 }, 2.5); } catch (e) { threw = e instanceof RangeError; }
  check("a fractional roll is rejected", threw);
}

console.log("\nBoard data helpers");
{
  eq("nine ladders on the board", Object.keys(R.LADDERS).length, 9);
  eq("six snakes on the board", Object.keys(R.SNAKES).length, 6);
  eq("JUMPS is the union of ladders and snakes", Object.keys(R.JUMPS).length, 15);
  eq("square 1 is a ladder", R.isLadder(1), true);
  eq("square 16 is a snake", R.isSnake(16), true);
  eq("square 50 is neither", R.isLadder(50) || R.isSnake(50), false);
  eq("square 50 describes as plain", R.describeSquare(50).type, "plain");
  eq("square 1 describes as a ladder", R.describeSquare(1).type, "ladder");
  eq("square 1 climbs to 38", R.describeSquare(1).to, 38);
  eq("square 62 describes as a snake", R.describeSquare(62).type, "snake");
  eq("square 62 drops to 19", R.describeSquare(62).to, 19);
  check("no square is both a ladder and a snake",
    Object.keys(R.LADDERS).every(k => R.SNAKES[k] === undefined));
}

console.log("\nFull game simulation (500 randomized games)");
{
  let finished = 0, stuck = 0, maxRounds = 0, totalRounds = 0;
  for (let g = 0; g < 500; g++) {
    const players = [{ pos: 0 }, { pos: 0 }];
    let turn = 0, sixes = 0, rounds = 0, done = false;
    while (rounds < 4000 && !done) {
      rounds++;
      const roll = 1 + Math.floor(Math.random() * 6);
      const res = R.step(players[turn], roll, sixes);
      players[turn].pos = res.pos;
      sixes = res.sixes;
      if (res.won) { done = true; finished++; break; }
      if (!res.bonus) { turn = (turn + 1) % 2; sixes = 0; }
    }
    if (!done) stuck++;
    totalRounds += rounds;
    if (rounds > maxRounds) maxRounds = rounds;
  }
  check("every game finishes (no infinite loop)", stuck === 0, { stuck });
  check("average game under 400 rounds", totalRounds / 500 < 400, { avg: Math.round(totalRounds / 500) });
  console.log("  INFO  finished=" + finished + " avgRounds=" + Math.round(totalRounds / 500) + " maxRounds=" + maxRounds);
}

console.log("\nNo position can ever exceed 100");
{
  let ok = true;
  for (let g = 0; g < 300; g++) {
    let pos = 0, sixes = 0;
    for (let i = 0; i < 500; i++) {
      const res = R.step({ pos }, 1 + Math.floor(Math.random() * 6), sixes);
      pos = res.pos; sixes = res.sixes;
      if (pos > R.TOTAL || pos < 0) ok = false;
    }
  }
  check("positions always within 0..100", ok);
}

console.log("\nSeeded RNG (daily challenge)");
{
  const a = R.mulberry32(12345);
  const b = R.mulberry32(12345);
  const seqA = Array.from({ length: 20 }, () => a());
  const seqB = Array.from({ length: 20 }, () => b());
  check("same seed produces the same sequence", JSON.stringify(seqA) === JSON.stringify(seqB));
  check("all values are within [0, 1)", seqA.every(v => v >= 0 && v < 1));
  check("values are not all identical", new Set(seqA).size > 1);

  const c = R.mulberry32(12346);
  const seqC = Array.from({ length: 20 }, () => c());
  check("different seeds produce different sequences", JSON.stringify(seqA) !== JSON.stringify(seqC));

  eq("hashSeed is deterministic", R.hashSeed("2026-11-14"), R.hashSeed("2026-11-14"));
  check("hashSeed differs per date", R.hashSeed("2026-11-14") !== R.hashSeed("2026-11-15"));
  check("hashSeed is a 32-bit unsigned int",
    R.hashSeed("2026-11-14") >= 0 && R.hashSeed("2026-11-14") <= 0xffffffff);
}
{

  const date = "2026-11-14";
  const rngA = R.mulberry32(R.hashSeed(date));
  const rngB = R.mulberry32(R.hashSeed(date));
  const rollsA = Array.from({ length: 30 }, () => 1 + Math.floor(rngA() * 6));
  const rollsB = Array.from({ length: 30 }, () => 1 + Math.floor(rngB() * 6));
  check("daily challenge dice are identical for every player",
    JSON.stringify(rollsA) === JSON.stringify(rollsB));
  check("all challenge rolls are between 1 and 6", rollsA.every(v => v >= 1 && v <= 6));
}

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);