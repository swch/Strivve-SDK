#!/usr/bin/env node
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

(async() => {
    //let cu = cardsavr_server.replace("cardsavr.io", "cardupdatr.app").replace("//api.", "//");
    //if (req.query.rd) {
    //    cu = req.query.rd;
    //}
    try {
        const ch = CardsavrHelper.getInstance();
        //Setup the settings for the application
        ch.setAppSettings(cardsavr_server, app_name, app_key);
        //Create a session for the application user (cardholder agent)
        if (await ch.loginAndCreateSession(app_username, app_password)) {
            const job = await ch.placeCardOnSiteSingleCall(app_username, "default", cardholder_data, address_data, card_data, creds_data);
            //const grant = job.user.credential_grant;
            const grant = (await ch.getSession(app_username).getCredentialGrant(job.user.id)).body.user_credential_grant;  //replace
            //const access_key = job.access_key;
            const access_key = (await ch.getSession(app_username).registerForJobStatusUpdates(job.id)).body.access_key;  //replace
            const username = job.user.username;
            const job_id = job.id;

            await ch.loginAndCreateSession(username, undefined, grant);
            ch.pollOnJob(username, job_id, (message) => {
                console.log(message);
            }, access_key);
        }
    } catch (err) {
        console.log(err);
    }
})();
