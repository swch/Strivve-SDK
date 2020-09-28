#!/usr/bin/env node  --unhandled-rejections=strict
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

const static_dir = process.env.npm_package_config_static_dir || "../dist";

const {app_name, app_key, app_username, app_password, cardsavr_server } = getFromEnv(require("./strivve_creds.json"), process.env);

function getFromEnv(config, env) {
    return Object.fromEntries(Object.entries(config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
}

const cardholder_data = getFromEnv(require("./cardholder.json"), process.env);
const address_data = getFromEnv(require("./address.json"), process.env);
const card_data = getFromEnv(require("./card.json"), process.env);
const creds_data = getFromEnv(require("./account.json"), process.env);

placeCard().then(() => {
    console.log("SUCCESS");
}).catch((e) => console.log(e));

async function placeCard() {
    const ch = CardsavrHelper.getInstance();
    //Setup the settings for the application
    ch.setAppSettings(cardsavr_server, app_name, app_key);
    //Create a session for the application user (cardholder agent)
    if (await ch.loginAndCreateSession(app_username, app_password)) {
        const job = await ch.placeCardOnSiteSingleCall(app_username, "default", cardholder_data, address_data, card_data, creds_data);
        await ch.loginAndCreateSession(job.user.username, undefined, job.user.credential_grant);
        //const access_key = ch.getSession(job.user.username).registerForJobStatusUpdates(job.id);
        await ch.pollOnJob(job.user.username, job.id, (message) => {
            console.log(message);
        }, job.access_key);
    }
}

