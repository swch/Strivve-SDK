const express = require('express');
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");
const fetch = require('node-fetch');
const app = express();
const port = process.env.PORT || 3000;

app.get("/create_user", function (req, res) {
 
    const cardholder_data = getFromEnv(getFromEnv(require("./cardholder.json"), process.env), req.query);
    const address_data = getFromEnv(getFromEnv(require("./address.json"), process.env), req.query);
    const card_data = getFromEnv(getFromEnv(require("./card.json"), process.env), req.query);
    (async() => {
        let cu = cardsavr_server.replace("cardsavr.io", "cardupdatr.app").replace("//api.", "//");
        if (req.query.rd) {
            cu = req.query.rd;
        }
        const config_res = await fetch(cu + "/config.json");
        const config = await config_res.json();
        const {username, password, name, key} = config;
        console.log("Config: ", config);
        try {
            const ch = CardsavrHelper.getInstance();
            //Setup the settings for the application
            ch.setAppSettings(cardsavr_server, name, key);
            //Create a session for the application user (cardholder agent)
            if (await ch.loginAndCreateSession(username, password)) {

                //Save the card on a behalf of a temporary cardholder - return their username, grant, card par
                const card_response = await ch.createCard(username, "default", cardholder_data, address_data, card_data);
                const handoff = { grant : card_response.cardholder.credential_grant, username : card_response.cardholder.username, card_id : card_response.id };
                const queryString = Object.keys(handoff).map(key => key + "=" + encodeURIComponent(handoff[key])).join("&");
                res.redirect(cu + "/select-merchants.html#" + queryString);
            }
        } catch (err) {
            console.log(err);
            console.log(err.body._errors);
    }
    })();      
});

const static_dir = process.env.npm_package_config_static_dir || "../dist";
app.use(express.static(static_dir));

app.listen(port, () => console.log(`CardUpdatr Demo app listening at ${port}`));

const config = require("./strivve_creds.json");
const {cardsavr_server } = getFromEnv(config, process.env);

function getFromEnv(config, env) {
    return Object.fromEntries(Object.entries(config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
}
