#!/usr/bin/env node  --unhandled-rejections=strict
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");
const { exit } = require("process");
const rl = require("readline-sync");
require('log-timestamp');

const config = require("./strivve_creds.json");

let instance = rl.question("Instance: ");
instance = instance ? instance : config.instance;

const {app_name, app_key, app_username, app_password, cardsavr_server, financial_institution } = 
    getFromEnv(instance && config.instances ? 
               config.instances.find(item => (item.instance == instance)) : 
               config, 
               process.env);

function getFromEnv(top_config, env) {
    return Object.fromEntries(Object.entries(top_config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
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
    ch.setAppSettings(cardsavr_server, app_name, app_key, false, null, process.env.HTTP_PROXY, false);

    const merchant_site = rl.question("Merchant hostname: ");

    //Create a session for the application user (cardholder agent)
    const session = await ch.loginAndCreateSession(app_username, app_password);
    if (session) {

        if (merchant_site) {
            const site = await ch.lookupMerchantSite(app_username, merchant_site); // get id from the hostname
            creds_data.merchant_site_id = site.id;
        }

        card_data.address = address_data;
        
        // call ch.createCard() to create card once- pass in cardholder, address, etc. then don't include "card: card_data" inside of job_data?
        // ch.placeCardOnSite() that will give you everything you need, instead of calling ch.placeCardOnSiteSingleCall?
        const job = await ch.placeCardOnSiteSingleCall({username: app_username, 
                                                        job_data: {
                                                            cardholder: cardholder_data, 
                                                            account: creds_data, 
                                                            card: card_data
                                                            // create one card and reuse it
                                                        }});

        creds_data.username = rl.question("Username: "); // delete
        creds_data.password = rl.question("Password: ", { hideEchoBack: true }); // delete
        delete creds_data.merchant_site_id; //can't be posted

        const job_start = new Date().getTime(); let vbs_start = null;

        await ch.pollOnJob({username : app_username, 
                            cardholder_id : job.cardholder_id,
                            job_id : job.id, // poll on cardholder instead
                            callback : (message) => {
            if (message.type == "job_status") {
                const update = message.message;
                if (!vbs_start) {
                    vbs_start = new Date().getTime();
                    console.log("VBS startup: " + Math.round(((vbs_start - job_start) / 1000)) + " seconds");
                    session.updateAccount(job.account.id, creds_data).catch(err => console.log(err.body._errors));
                    console.log("Quickstart - Saving credentials");
                }
                console.log(`${update.status} ${update.percent_complete}% - ${update.completed_state_name}, Time remaining: ${update.job_timeout}`);
                if (update.termination_type) {
                    console.log(update.termination_type);
                }
            } else if (message.type == 'tfa_request') {
                const tfa = rl.question("Please enter a tfa code: ");
                console.log("Posting TFA");
                ch.postTFA({username: app_username, tfa, job_id: job.id, envelope_id: message.envelope_id});
            } else if (message.type == 'credential_request') {
                creds_data.username = rl.question("Please re-enter your username: ");
                creds_data.password = rl.question("Please re-enter your password: ", { hideEchoBack: true });
                ch.postCreds({username: app_username, merchant_creds: creds_data, job_id: job.id, envelope_id: message.envelope_id});
                console.log("Saving credentials");
            } else if (message.type == 'tfa_message') {
                console.log("Please check your device for a verification link.");
                ch.postTFA({username: app_username, tfa: "acknowledged", job_id: job.id, envelope_id: message.envelope_id});
            }
        }, 
        interval : 2000});
    }
}