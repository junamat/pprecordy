const { v2, auth } = require('osu-api-extended')
const fs = require('fs');
const config = require('./config.json');

// simple logger that prints to console and optionally to file
const log = (message, level = 'log') => {
  const text = `[${new Date().toISOString()}] ${message}`;
  console[level](text);
  if (config.logging && config.logging.enabled && config.logging.file) {
    try {
      fs.appendFileSync(config.logging.file, text + '\n');
    } catch (e) {
      console.error(`failed to write log to ${config.logging.file}:`, e);
    }
  }
};

const login = async () => {
  await auth.login(config.api_key.client, config.api_key.secret, ['public']);
}

const GetRanking = async () => {
  const userIds = []
  for (let i = 1; i <= config.pages; i++) {
    const ranking = await (await v2.site.ranking.details(config.gamemode, 'performance', { country: config.country, "cursor[page]": i })).ranking
    for (user in ranking) {
      userIds.push(ranking[user].user.id)
    }
  }
  return Promise.resolve(userIds)
}

// token-bucket rate limiter factory
const createRateLimiter = (rpm = 60, burst = rpm) => {
  const ratePerMs = rpm / 60000; // tokens per ms
  // start with burst capacity so we don't immediately block, but default
  // burst is equal to rpm to avoid huge initial floods.
  let tokens = burst;
  let last = Date.now();

  const removeToken = async () => {
    while (true) {
      const now = Date.now();
      const elapsed = now - last;
      if (elapsed > 0) {
        tokens = Math.min(burst, tokens + elapsed * ratePerMs);
        last = now;
      }
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      // ms until enough tokens accumulate for one request
      const msToNext = Math.ceil((1 - tokens) / ratePerMs);
      await new Promise((r) => setTimeout(r, Math.max(1, msToNext)));
    }
  };

  const drain = () => {
    tokens = 0;
  };

  return { removeToken, drain };
};

const RecentTopPlays = async (userIds) => {
  // allow overriding via config.rateLimit { rpm, burst }
  const rpm = (config.rateLimit && config.rateLimit.rpm) || 300;
  const burst = (config.rateLimit && config.rateLimit.burst) || 200;
  const limiter = createRateLimiter(rpm, burst);

  // helper to request with retries/backoff
  const fetchWithRetry = async (userId, idx, attempts = 3) => {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
          await limiter.removeToken();
        const res = await v2.scores.user.category(userId, 'best', { mode: config.gamemode, limit: 100 });
        // some responses come back as HTML string when rate limited rather than throwing
        if (typeof res === 'string' && res.includes('429 Too Many Requests')) {
          const err = new Error('HTML 429 response');
          err.status = 429;
          throw err;
        }
        return res;
      } catch (err) {
        lastError = err;
        const msg = err && err.message ? err.message : '';
        const status429 = err && (err.status === 429 || msg.includes('429'));
        if (status429) {
          // simple backoff notification
          log(`Backed off due to 429 (user ${userId} idx ${idx})`, 'warn');
          // clear tokens and wait 30s
          if (typeof limiter.drain === 'function') limiter.drain();
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (attempt < attempts) {
          const backoff = 1000 * Math.pow(2, attempt - 1);
          log(`request for user ${userId} (index ${idx}) failed (attempt ${attempt}), retrying in ${backoff}ms`, 'warn');
          await new Promise((r) => setTimeout(r, backoff));
          continue;
        }
      }
    }
    throw lastError;
  };

  let completed = 0; // track how many requests have finished
  const requests = userIds.map((userId, i) => (async () => {
    try {
      const recentPlays = await fetchWithRetry(userId, i+1);
      let playsArray = [];
      if (Array.isArray(recentPlays)) {
        playsArray = recentPlays;
      } else if (recentPlays && Array.isArray(recentPlays.scores)) {
        playsArray = recentPlays.scores;
      } else if (recentPlays && Array.isArray(recentPlays.data)) {
        playsArray = recentPlays.data;
      } else if (recentPlays && recentPlays.length === 0) {
        playsArray = [];
      } else {
        if (typeof recentPlays === 'string' && recentPlays.includes('429 Too Many Requests')) {
          log(`Backed off due to HTML 429 for user ${userId} (idx ${i+1})`, 'warn');
        } else {
          log(`Unexpected response shape for user ${userId}: ${JSON.stringify(recentPlays)}`, 'warn');
        }
        playsArray = [];
      }

      const filtered = playsArray.filter((score) => {
        const scoreCreationTimestamp = Date.parse(score.created_at);
        return scoreCreationTimestamp >= config.time.start &&
          (!config.time.absolute_f || scoreCreationTimestamp <= config.time.finish);
      });

      completed += 1;
      log(`completed ${completed}/${userIds.length} (index ${i+1}, user ${userId})`);
      return filtered;
    } catch (err) {
      completed += 1;
      log(`Error fetching plays for user ${userId} (index ${i+1}): ${err}`, 'error');
      log(`completed ${completed}/${userIds.length} (index ${i+1}, user ${userId})`);
      return [];
    }
  })());

  const recentTopPlays = await Promise.all(requests);
  return recentTopPlays;
}

//read out loud recent top plays
// const readOutLoud = async (RecentTopPlays) => {
//   for(let i = 0; i < RecentTopPlays.length; i++){
//     for(let j = 0; j < RecentTopPlays[i].length; j++){
//       console.log(RecentTopPlays[i][j].beatmap)
//     }
//   }
// }

const exportcsv = async (RecentTopPlays) => {
  const fs = require('fs')
  const csvWriter = require('csv-writer').createObjectCsvWriter({
    path: 'out.csv',
    header: [
      { id: 'beatmap', title: 'Beatmap' },
      { id: 'pp', title: 'PP' },
      { id: 'accuracy', title: 'Accuracy' },
      { id: 'max_combo', title: 'Max Combo' },
      { id: 'mods', title: 'Mods' },
      { id: 'rank', title: 'Rank' },
      { id: 'user', title: 'User' },
      { id: 'date', title: 'Date' },
      { id: 'replay', title: 'Replay' },
      { id: 'score', title: 'Score Link' },
    ]
  })
  const records = []
  for (let i = 0; i < RecentTopPlays.length; i++) {
    for (let j = 0; j < RecentTopPlays[i].length; j++) {
      records.push({
        beatmap: "https://osu.ppy.sh/b/" + RecentTopPlays[i][j].beatmap.id,
        pp: RecentTopPlays[i][j].pp,
        accuracy: RecentTopPlays[i][j].accuracy,
        max_combo: RecentTopPlays[i][j].max_combo,
        mods: RecentTopPlays[i][j].mods,
        rank: RecentTopPlays[i][j].rank,
        user: RecentTopPlays[i][j].user.username,
        date: RecentTopPlays[i][j].created_at,
        replay: RecentTopPlays[i][j].replay,
        score: "https://osu.ppy.sh/scores/" + config.gamemode + "/" + RecentTopPlays[i][j].id,
      })
    }
  }
  csvWriter.writeRecords(records)
    .then(() => {
      log('...Done');
    })
}

const main = async () => {
  if (!config.onboarded) { //read config.json parameters from the user
    require('./config.js')
  } else {
    (config.time.finish ? "" : config.time.finish = Date.now());
    await login();
    const userIds = await GetRanking();
    const topPlays = await RecentTopPlays(userIds);
    exportcsv(topPlays)
  }
}

main()
