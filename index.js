const chalk = require('chalk');
const { Client } = require('discord-rpc');
let client = new Client({
    transport: 'ipc'
});

const config = require('./config.json');

const SUCCESS = chalk.hex('#43B581');
const ERROR = chalk.hex('#F04747');
const INFO = chalk.hex('#FF73FA');
const LOG = chalk.hex('#44DDBF');

/* Adds [LOG] and [dd/mm/yyyy | hh:mm:ss UTC] prefix to all console.log's */

let originalConsoleLog = console.log;
console.log = function () {
    args = [];
    let date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let hours = date.getUTCHours().toString().padStart(2, '0');
    let minutes = date.getUTCMinutes().toString().padStart(2, '0');
    let seconds = date.getUTCSeconds().toString().padStart(2, '0');
    args.push(`${LOG(`[LOG]`)} ${INFO(`[${day}/${month}/${year} | ${hours}:${minutes}:${seconds} UTC]`)}`);
    for (let i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    originalConsoleLog.apply(console, args);
}

/* Adds [ERROR] and [dd/mm/yyyy | hh:mm:ss UTC] prefix to all console.error's */

let originalConsoleError = console.error;
console.error = function () {
    args = [];
    let date = new Date();
    let day = date.getDate();
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let hours = date.getUTCHours().toString().padStart(2, '0');
    let minutes = date.getUTCMinutes().toString().padStart(2, '0');
    let seconds = date.getUTCSeconds().toString().padStart(2, '0');
    args.push(`${ERROR(`[ERROR]`)} ${INFO(`[${day}/${month}/${year} | ${hours}:${minutes}:${seconds} UTC]`)}`);
    for (let i = 0; i < arguments.length; i++) {
        args.push(arguments[i]);
    }
    originalConsoleError.apply(console, args);
}

let retryDuration = 1; // Retry in 15 seconds by default

console.log(LOG(`Attempting to connect to Discord, please wait ${retryDuration} seconds...`));

connectToDiscord();

let protocol = new RegExp('^(http|https)://');
let startTimestamp = new Date();
let rpc = config.rich_presence;

let initialTasks = [updatePresence],
    i = 0;

/* Consecutively execute initialTasks before updating the user's profile (onStartup only) */

function onStartup() {
    initialTasks[i++]();
    if (i < initialTasks.length) {
        setTimeout(onStartup, 5 * 1000); // 5 seconds
    }
}



function updatePresence() {
    let buttons = [];
    let buttonObj = Object.values(rpc.buttons);
    buttonObj.forEach((button) => {
        if (button.label && button.url !== null) {
            buttons.push(button);
        }
    });
    if (!buttons.length) {
        buttons = false;
    }
    console.log(INFO(`Successfully updated ${client.user.username}#${client.user.discriminator}'s Rich Presence!`));
    return client.request('SET_ACTIVITY', {
        pid: process.pid,
        activity: {
            details: rpc.details ? rpc.details : undefined,
            type:rpc.type ? rpc.type : undefined,
            state: rpc.state ? rpc.state : undefined,
            assets: {
                large_text: rpc.assets.largeImageText ? rpc.assets.largeImageText : undefined,
                large_image: rpc.assets.largeImageKey ? rpc.assets.largeImageKey : undefined,
                small_text: rpc.assets.smallImageText ? rpc.assets.smallImageText : undefined,
                small_image: rpc.assets.smallImageKey ? rpc.assets.smallImageKey : undefined
            },
            buttons: buttons ? buttons : undefined,
            timestamps: {
                start: rpc.timestamps.useTimer ? Number(rpc.timestamps.startTimestamp) || Number(startTimestamp) : undefined,
                end: rpc.timestamps.useTimer && rpc.timestamps.endTimestamp !== null ? Number(rpc.timestamps.endTimestamp) : undefined
            },
            instance: true
        }
    });
}

/* Login using the user's Discord Developer Application ID */

function connectToDiscord() {
    /* If a previous attempt was made, destroy the client before retrying */
    if (client) {
        client.destroy();
    }
    client = new Client({
        transport: 'ipc'
    });
    /* Once the client is ready, call onStartup() to execute initialTasks */
    client.on('ready', async () => {
        console.log(SUCCESS(`Successfully authorised as ${client.user.username}#${client.user.discriminator}`));
        onStartup();
    });
    /* Handle when Discord unexpectedly closes, attempt to reconnect if this happens */
    client.transport.once('close', () => {
        i = 0; // Reset initialTasks
        console.log(ERROR(`Connection to Discord closed. Attempting to reconnect...`));
        console.log(LOG(`Automatically retrying to connect, please wait ${retryDuration} seconds...`));
        connectToDiscord();
    });
    /* If the client fails to connect, automatically retry in duration specified */
    setTimeout(() => {
        client.login({ clientId: config.clientId });
    }, retryDuration * 1000)
}

/* Handle 'Could not connect' error, proceed to retry if attempt fails */

process.on('unhandledRejection', err => {
    if (err.message === 'Could not connect') {
        console.log(ERROR(`Unable to connect to Discord. Is Discord running and logged-in in the background?`));
        console.log(LOG(`Automatically retrying to connect, please wait ${retryDuration} seconds...`));
        connectToDiscord();
    }
});