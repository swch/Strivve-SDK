#!/usr/bin/env node  --unhandled-rejections=strict
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");
const { exit } = require("process");
const rl = require("readline-sync");
require('log-timestamp');

const config = require("./strivve_creds.json");

const instance = "varomoney";

const {app_name, app_key, app_username, app_password,  cardsavr_server, financial_institution } = 
    getFromEnv(instance && config.instances ? 
               config.instances.find(item => (item.instance == instance)) : 
               config, 
               process.env);

function getFromEnv(top_config, env) {
    return Object.fromEntries(Object.entries(top_config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
}

var fs = require('fs');
fs.readFile("./data.csv", function (err, data) {
  if (err) {
    throw err; 
  }
  upload_data(data).then(() => {
        console.log("STARTUP");
    }).catch((e) => console.log(e));
});


async function upload_data(data) {
    const ch = CardsavrHelper.getInstance();
    //Setup the settings for the application
    ch.setAppSettings(cardsavr_server, app_name, app_key, false);

    const session = await ch.loginAndCreateSession(app_username, app_password);
    site_map = {};
    if (session) {
        const sites = await ch.getSession("testing_user").getMerchantSites(null, { page_length: 200 } );
        sites.body.map(item => {
            site_map[item.host] = item.id;
        });
        let headers = [];
        const arr = data.toString().split("\r\n");
        for (var idx = 0; idx < arr.length; idx++) {
            const item = arr[idx];
            const columns = item.split(",");
            const row = {};
            if (columns[0] === "_messagetime") {
                columns.map(item => {
                    headers.push(item);
                });
            } else {
                if (idx < 100 || true) {
                    columns.map((item, idx) => {
                        row[headers[idx]] = item;
                    });
                    row.custom_data = {"user": row["custom_data"]};
                    row.bin_id = 35;
                    row.financial_institution_id = 34;
                    row.bank_identification_number = 487917;
                    row.fi_name = "Varo Bank";
                    row.fi_lookup_key = "default";
                    row.merchant_site_id = site_map[row.site_hostname];
                    try {
                        const result = await ch.getSession("testing_user").post("/card_placement_results", row);
                        console.log(result);
                    } catch (err) {
                        console.log(err);
                    }
                }
            }
        }
    }
}

