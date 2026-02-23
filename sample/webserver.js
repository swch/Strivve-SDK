const express = require('express');
const { CardsavrHelper, CardLinksHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

const app = express();
const port = process.env.PORT || 3000;

app.get("/create_user", function (req, res) {
 
    const cardholder_data = getFromEnv(getFromEnv(require("./cardholder.json"), process.env), req.query);
    const address_data = getFromEnv(getFromEnv(require("./address.json"), process.env), req.query);
    const card_data = getFromEnv(getFromEnv(require("./card.json"), process.env), req.query);
    (async() => {
        let cu = cardsavr_server.replace("cardsavr.io", "cardupdatr.app").replace("//api.", "//") + "/select-merchants";
        if (req.query.rd) {
            cu = req.query.rd;
        }
        try {
            const ch = CardsavrHelper.getInstance();
            //Setup the settings for the application
            ch.setAppSettings(cardsavr_server, app_name, app_key, false, null, process.env.HTTP_PROXY);
            //Create a session for the application user (cardholder agent)
            if (await ch.loginAndCreateSession(app_username, app_password)) {

                //Save the card on a behalf of a temporary cardholder - return their username, grant, card par
                card_data.address = address_data;
                card_data.cardholder = cardholder_data;
                const card_response = await ch.createCard({agent_username: app_username, card: card_data});
                const handoff = { grant : card_response.cardholder.grant, card_id : card_response.id };
                const queryString = Object.keys(handoff).map(key => key + "=" + encodeURIComponent(handoff[key])).join("&");
                res.redirect(cu + "#" + queryString);
            }
        } catch (err) {
            console.log(err);
            console.log(err.body._errors);
    }
    })();      
});


app.post("/card_links/ondemand", function (req, res) {
    console.log("Inside card_links/ondemand");

    const cardholder_data = getFromEnv(getFromEnv(require("./cardholder.json"), process.env), req.query);
    const address_data = getFromEnv(getFromEnv(require("./address.json"), process.env), req.query);
    const card_data = getFromEnv(getFromEnv(require("./card.json"), process.env), req.query);
    const auth_data = getFromEnv(getFromEnv(require("./strivve_creds_localhost.json"), process.env), req.query);
    (async() => {
        let cu = cardsavr_server.replace("cardsavr.io", "cardupdatr.app").replace("//api.", "//") + "/select-merchants";
        if (req.query.rd) {
            cu = req.query.rd;
        }
        try {
            const cl_helper = new CardLinksHelper();

            const auth = {
                cardsavr_server : auth_data.cardsavr_server,
                app_key : auth_data.app_key,
                app_name : auth_data.app_name,
                username: auth_data.app_username,
                password: auth_data.app_password
            }

            const cardholder = {
                cuid: cardholder_data.cuid,
                first_name: "Praveen",
                last_name: "Kumar"
            }

            const card = {
                pan: card_data.pan,
                expiration_month: card_data.expiration_month,
                expiration_year: card_data.expiration_year,
                cvv: card_data.cvv,
                name_on_card: card_data.name_on_card,
                nickname: "my_card"
            }

            const address = {
                is_primary : address_data.is_primary,
                address1 : address_data.address1,
                "city" : address_data.city,
                "subnational" : address_data.subnational,
                "postal_code" : address_data.postal_code,
                "country" : address_data.country,
                "email": address_data.email,
                "phone_number" : address_data.phone_number,
                "first_name" : address_data.first_name,
                "last_name" : address_data.last_name
            }

            const response = await cl_helper.createCardLink(auth, cardholder, card, address, "testing");
            res.status(200).send(response);
        } catch (err) {
            console.log(err);
            console.log(err.body._errors);
        }
    })();
});

const static_dir = process.env.npm_package_config_static_dir || "../dist";
app.use(express.static(static_dir));

app.listen(port, () => console.log(`CardUpdatr Demo app listening at ${port}`));

const config = require("./strivve_creds_localhost.json");
const instance = config.instance;
const {app_name, app_key, app_username, app_password, cardsavr_server } = 
    getFromEnv(instance && config.instances ? 
               config.instances.find(item => (item.instance === instance)) :
               config, 
               process.env);

function getFromEnv(top_config, env) {
    return Object.fromEntries(Object.entries(top_config).map(([key, value]) => env[key] ? [key, env[key]] : [key, value]));
}
