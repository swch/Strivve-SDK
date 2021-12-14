#!/usr/bin/env node  --unhandled-rejections=strict
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");
const { generateUniqueUsername } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrSessionUtilities");
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

const card_data = getFromEnv(require("./card.json"), process.env);
const creds_data = require("./account.json");

(async () => {
placeCard().then(() => {
    console.log("STARTUP");
}).catch((e) => console.log(e));
})();

async function placeCard(username, jobs_data) {
    const ch = CardsavrHelper.getInstance();
    ch.setAppSettings(cardsavr_server, app_name, app_key, false, null, process.env.HTTP_PROXY, false);

    const merchant_sites = creds_data;

    //Create a session for the application user (cardholder agent)
    const session = await ch.loginAndCreateSession(app_username, app_password);
    if (session) {
        const card = await ch.createCard({agent_username: app_username, card: card_data});
        const jobs_data = await Promise.all(merchant_sites.map(async merchant_site => {
            const site = await ch.lookupMerchantSite(app_username, merchant_site.host);
            merchant_site.cardholder_id = card.cardholder_id;
            return {
                account : merchant_site,
                card_id: card.id,
                cardholder_id: card.cardholder_id
            }
        }));

            const response = await ch.placeCardOnSites({username: app_username, jobs_data});
            response.body.map((job, site) => {
                merchant_sites[site].job_id = job.id;
                merchant_sites[site].account_id = job.account_id;
                merchant_sites[site].state = "SUBMITTED";
                return merchant_sites[site];
            });

        await ch.pollOnCardholder({username : app_username, 
                                   cardholder_id : card.cardholder_id,
                                   callback : (message) => {
            if (message.type == "job_status") {
                const update = message.message;
                console.log(`${update.status} ${update.percent_complete}% - ${message.job_id}, Time remaining: ${update.job_timeout}`);
                if (update.termination_type) {
                    console.log(update.termination_type);
                }
            }
        }});
    }
}

