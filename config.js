const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const config = require('./config.json');
const { writeFile } = require('fs');

const question = (query) => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
};
const askCountry = async () => {
    let answer = await question('Do you want to input a country? (y/n): ');
    if(answer != '-1') config.country = answer.toLowerCase() == 'y' ? 1 : 0;
    if(config.country){
        answer = await question('What country code? (US, ES, JP, etc.): ');
        if(answer != '-1') config.country = answer;
    }
    await askGamemode();
};

const askGamemode = async () => {
    let answer = await question('What gamemode? (0 = osu, 1 = mania, 2 = taiko, 3 = catch): ');
    if(answer != '-1') while(answer < 0 || answer > 3) answer = await question('What gamemode? (0 = osu, 1 = mania, 2 = taiko, 3 = catch): ');
    if(answer != '-1') switch(answer){
        case '0':
            config.gamemode = 'osu';
            break;
        case '1':
            config.gamemode = 'mania';
            break;
        case '2':
            config.gamemode = 'taiko';
            break;
        case '3':
            config.gamemode = 'fruits';
            break;
    }
    await askStartDate();
};

const askStartDate = async () => {
    let answer = await question("Do you want to input a start date? (if you don't, you'll be asked for the amount of time) (y/n): ");
    if(answer != '-1') config.time.absolute_s = answer.toLowerCase() == 'y' ? 1 : 0;
    if(config.time.absolute_s){
        answer = await question('What is the start date? (YYYY-MM-DD): ');
        if(answer != '-1') config.time.start = Date.parse(answer);
    } else {
        answer = await question('What is the length of the timeframe? (input number and type of length (y, m, w, d or h), for example 20d): ');
        if(answer != '-1') config.time.start = Date.now() - parseTime(answer);
    }
    await askFinishDate();
};

const askFinishDate = async () => {
    let answer = await question("Do you want to input a finish date (if you don't, the program will check using the time and date you ran it as the finishing time) (y/n): ");
    if(answer !== '-1') config.time.absolute_f = answer.toLowerCase() == 'y' ? 1 : 0;
    if(config.time.absolute_f){
        answer = await question('What is the finish date? (YYYY-MM-DD): ');
        if(answer != '-1') config.time.finish = Date.parse(answer);
    } else config.time.finish = 0;
    await askPages();
};

const askPages = async () => {
    let answer = await question('How many pages of ranking do you want to look? (1 page = 50 players): ');
    if(answer !== '-1') config.pages = answer;
};

const askLogging = async () => {
    let answer = await question('Would you like to log output to a file? (y/n): ');
    if(answer !== '-1' && answer.toLowerCase() === 'y') {
        config.logging = config.logging || {};
        config.logging.enabled = true;
        answer = await question('Log file path (default pprecordy.log): ');
        if(answer !== '-1' && answer.trim() !== '') {
            config.logging.file = answer.trim();
        } else if(!config.logging.file) {
            config.logging.file = 'pprecordy.log';
        }
    } else if(answer !== '-1') {
        config.logging = { enabled: false };
    }
};

const parseTime = (timeString) => {
    const value = parseInt(timeString);
    const unit = timeString[timeString.length - 1];
    const multiplier = unit === 'y' ? 365 * 24 * 60 * 60 * 1000 :
                       unit === 'm' ? 30 * 24 * 60 * 60 * 1000 :
                       unit === 'w' ? 7 * 24 * 60 * 60 * 1000 :
                       unit === 'd' ? 24 * 60 * 60 * 1000 :
                       unit === 'h' ? 60 * 60 * 1000 : 0;
    return value * multiplier;
}

const questionArc = async () => {
    config.onboarded != true ? console.log('Welcome to the onboarding process!\n') : console.log('Welcome to the config editor! You can skip questions by typing -1\n');
    let answer = await question('What is your client id? (you can generate one of those on https://osu.ppy.sh/home/account/edit#oauth): ');
    if(answer != '-1') config.api_key.client = answer;
    answer = await question('What is your client secret?: ');
    if(answer != '-1') config.api_key.secret = answer;
    await askCountry();
    await askLogging();
    config.onboarded = true;
    writeFile('./config.json', JSON.stringify(config, null, "\t"), (err) => {
        if (err) throw err;
        console.log('Config saved! Remember that you can bring up this menu again by typing \'node config.js\'!');
        rl.close();
    });
}

questionArc();