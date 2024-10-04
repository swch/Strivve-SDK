const express = require('express');
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

const app = express();
const port = process.env.PORT || 3000;

const async_wrapper = fn =>
    (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            console.log(`Unexpected Error: ${JSON.stringify(err)}`);
            res.status(500).json("An unexpected error occurred.");
        });
    };

app.get("/link/:link", async_wrapper(async (req, res, next) => {
    const rd = await executeCardsavrFunction(async (session, link) => {
        const card_link = await session.post("/card_links/verify", { cardholder_long_token : link });
        return "/authorize/" + encodeURIComponent(card_link.body.cardholder_short_token);
    }, req.params.link);
    res.redirect(rd);
}));

app.get("/authorize/:link", async_wrapper(async (req, res, next) => {
    const rd = await executeCardsavrFunction(async (session, link) => {
        const card_response = await session.post("/card_links/verify", { cardholder_short_token : link, cvv : "467" });
        const handoff = { grant : card_response.body.cardholder.grant, card_id : card_response.body.id };
        const cu = cardsavr_server.replace("cardsavr.io", "cardupdatr.app").replace("//api.", "//") + "/select-merchants";
        const queryString = Object.keys(handoff).map(key => key + "=" + encodeURIComponent(handoff[key])).join("&");
        return cu + "#" + queryString;
    }, req.params.link);
    res.redirect(rd);
}));

app.listen(port, () => console.log(`CardUpdatr Demo app listening at ${port}`));

const config = require("./strivve_creds.json");
const instance = config.instance;
const {app_name, app_key, app_username, app_password, cardsavr_server } = 
    getFromEnv(instance && config.instances ? 
               config.instances.find(item => (item.instance == instance)) : 
               config, 
               process.env);

function getFromEnv(top_config, env) {
    return Object.fromEntries(Object.entries(top_config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
}

async function executeCardsavrFunction(csFunc, link) {
    const ch = CardsavrHelper.getInstance();
    //Setup the settings for the application
    ch.setAppSettings(cardsavr_server, app_name, app_key, false, null, process.env.HTTP_PROXY);
    //Create a session for the application user (cardholder agent)
    if (await ch.loginAndCreateSession(app_username, app_password)) {
        const session = ch.getSession(app_username);
        try {
            return await csFunc(session, link);
        } catch (err) {
            console.log(err);
            console.log(err.body._errors);
        }
    }
}

