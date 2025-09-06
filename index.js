const { v2, auth } = require('osu-api-extended')
const config = require('./config.json');
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

const RecentTopPlays = async (userIds) => {
  const RecentTopPlays = []
  for (let i = 0; i < userIds.length; i++) {
    const recentPlays = await v2.scores.user.category(userIds[i], 'best', { mode: config.gamemode, limit: 100 });
    RecentTopPlays.push(
      recentPlays.filter(
        (score) => {
          const scoreCreationTimestamp = Date.parse(score.created_at);
          return scoreCreationTimestamp >= config.time.start && (!config.time.absolute_f || scoreCreationTimestamp <= config.time.finish)
        }
      )
    )
    console.log("User " + (i + 1) + " out of " + userIds.length + " done")
  }
  return Promise.resolve(RecentTopPlays);
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
      console.log('...Done')
    })
}

const main = async () => {
  if (!config.onboarded) { //read config.json parameters from the user
    require('./config.js')
  } else {
    (config.time.finish ? "" : config.time.finish = Date.now())
    await login()
    const userIds = await GetRanking()
    const topPlays = await RecentTopPlays(userIds)
    exportcsv(topPlays)
  }
}

main()
