#!/usr/bin/env node  --unhandled-rejections=strict
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");
const { exit } = require("process");
const rl = require("readline-sync");
require('log-timestamp');

const instance = rl.question("Instance: ");

const config = require("./strivve_creds.json");
const {app_name, app_key, app_username, app_password, cardsavr_server } = getFromEnv(config[instance ? instance : config.instance], process.env);

function getFromEnv(config, env) {
    return Object.fromEntries(Object.entries(config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
}

const cardholder_data = getFromEnv(require("./cardholder.json"), process.env);
const address_data = getFromEnv(require("./address.json"), process.env);
const card_data = getFromEnv(require("./card.json"), process.env);
const creds_data = getFromEnv(require("./account.json"), process.env);

placeCard().then(() => {
    console.log("STARTUP");
}).catch((e) => console.log(e));

async function placeCard() {
    const ch = CardsavrHelper.getInstance();
    //Setup the settings for the application
    ch.setAppSettings(cardsavr_server, app_name, app_key);

    const merchant_site = rl.question("Merchant hostname: ");

    //Create a session for the application user (cardholder agent)
    if (await ch.loginAndCreateSession(app_username, app_password)) {

        if (merchant_site) {
            const site = await ch.lookupMerchantSite(app_username, merchant_site);
            creds_data.merchant_site_id = site.id;
        }
        
        const job = await ch.placeCardOnSiteSingleCall(app_username, "default", cardholder_data, creds_data, address_data, card_data);
        await ch.loginAndCreateSession(job.user.username, undefined, job.user.credential_grant);

        creds_data.username = rl.question("Username: ");
        creds_data.password = rl.question("Password: ", { hideEchoBack: true });
        delete creds_data.merchant_site_id; //can't be posted

        const job_start = new Date().getTime(); let vbs_start = null;

        await ch.pollOnJob(job.user.username, job.id, (message) => {
            if (message.type == "job_status") {
                update = message.message;
                if (!vbs_start) {
                    vbs_start = new Date().getTime();
                    console.log("VBS startup: " + Math.round(((vbs_start - job_start) / 1000)) + " seconds");
                }
                console.log(`${update.status} ${update.percent_complete}% - ${update.completed_state_name}, Time remaining: ${update.job_timeout}`);
                if (update.termination_type) {
                    console.log(update.termination_type);
                }
            } else if (message.type == 'tfa_request') {
                const tfa = rl.question("Please enter a tfa code: ");
                console.log("Posting TFA");
                ch.postTFA(job.user.username, tfa, job.id, message.envelope_id);
            } else if (message.type == 'credential_request') {
                creds_data.username = rl.question("Please re-enter your username: ");
                creds_data.password = rl.question("Please re-enter your password: ", { hideEchoBack: true });
                ch.postCreds(job.user.username, creds_data, job.id, message.envelope_id);
                console.log("Saving credentials");
            } else if (message.type == 'tfa_message') {
                console.log("Please check your device for a verification link.");
            }
        }, 2000);
    }
}

