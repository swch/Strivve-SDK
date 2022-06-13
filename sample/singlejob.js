#!/usr/bin/env node  --unhandled-rejections=strict
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");
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

const cardholder_data = Object.seal(getFromEnv(require("./cardholder.json"), process.env));
const address_data = getFromEnv(require("./address.json"), process.env);
const card_data = getFromEnv(require("./card.json"), process.env);
const creds_data = getFromEnv(require("./account.json"), process.env);

(async function() {
    try {
        await placeCard();
    } catch (err) {
        console.log(err);
    }
})();

async function placeCard() {
    const ch = CardsavrHelper.getInstance();
    //Setup the settings for the application
    ch.setAppSettings(cardsavr_server, app_name, app_key, false, null, process.env.HTTP_PROXY, false);

    const merchant_site = rl.question("Merchant hostname: ");

    //Create a session for the application user (cardholder agent)
    const session = await ch.loginAndCreateSession(app_username, app_password);
    if (session) {

        if (merchant_site) {
            const site = await ch.lookupMerchantSite(app_username, merchant_site);
            creds_data.merchant_site_id = site.id;
        }

        card_data.address = address_data;
        const safe_key = cardholder_data.type === "persistent" ? "MBNL8Chib96EYdXNt3+etblMg2RAHUYM1d7ScSd8nf8=" : "";
        if (cardholder_data.cuid) {
            creds_data.customer_key = creds_data.merchant_site_id + "$" + cardholder_data.cuid;
        }
        const job = await ch.placeCardOnSiteSingleCall({ 
            username: app_username, 
            job_data: {
                cardholder: cardholder_data, 
                account: creds_data, 
                card: card_data,
                //type_override: "RPA_LOOPBACK:CARD_PLACEMENT"
            },
            safe_key
        });
        creds_data.username = rl.question("Username: ");
        creds_data.password = rl.question("Password: ", { hideEchoBack: true });
        const job_start = new Date().getTime(); let vbs_start = null;

        const query = ch.createCardholderQuery(app_username, job.cardholder_id);

        const status_handler = async (message) => {
            const update = message.message;
            if (!vbs_start) {
                vbs_start = new Date().getTime();
                console.log("VBS startup: " + Math.round(((vbs_start - job_start) / 1000)) + " seconds");
                session.updateAccount(job.account.id, { account_identification: { username: creds_data.username, password: creds_data.password } }, null, safe_key).catch(err => console.log(err));
            }
            console.log(`${update.status} ${update.percent_complete}% - ${message.job_id}, Time remaining: ${update.job_timeout}`);
            if (update.termination_type) {
                console.log("TERMINATE WITH: " + update.termination_type);
                query.removeListener(job.id, status_handler, "job_status");
                query.removeListener(job.id, tfa_handler, "pending_tfa");
                query.removeListener(job.id, new_creds_handler, "pending_newcreds");
                await new Promise(resolve => setTimeout(resolve, 5000));
                placeCard();
            }
        }

        const tfa_handler = async (message) => {
            const tfa = rl.question("Please enter a tfa code: ");
            ch.postTFA({username: app_username, tfa, job_id: message.job_id, envelope_id: message.envelope_id});
            console.log("Posting TFA");
        }

        const new_creds_handler = async (message) => {
            creds_data.username = rl.question("Please re-enter your username: ");
            creds_data.password = rl.question("Please re-enter your password: ", { hideEchoBack: true });
            ch.postCreds({username: app_username, merchant_creds: { username: creds_data.username, password: creds_data.password }, job_id: message.job_id, envelope_id: message.envelope_id});
            console.log("Posting New Creds");
        }

        query.addListener(job.id, status_handler, "job_status");
        query.addListener(job.id, tfa_handler, "pending_tfa");
        query.addListener(job.id, new_creds_handler, "pending_newcreds");
    }
}

