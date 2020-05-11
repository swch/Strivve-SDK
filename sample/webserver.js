const express = require('express')
const app = express()
const port = 3000
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

app.get('/create_user', function (req, res) {
 
    const {app_name, app_key, app_username, app_password, cardsavr_server } = require("./strivve_creds_mark.json");
    const cardholder_data = require("./cardholder.json");
    const address_data = require("./address.json");
    const card_data = require("./card.json");
    
    (async() => {

        try {
            const ch = CardsavrHelper.getInstance();
            ch.setAppSettings(cardsavr_server, app_name, app_key);

            await ch.loginAndCreateSession(app_username, app_password);
            const handoff = await ch.createCard(app_username, cardholder_data, address_data, card_data);

            const queryString = Object.keys(handoff).map(key => key + '=' + encodeURIComponent(handoff[key])).join('&');
            res.redirect("/#" + queryString);

        } catch (err) {
            console.log(err);
        }
            
    })();
      
})

app.use(express.static('../dist'))

app.listen(port, () => console.log(`Example app listening at http://static.mbudos.cardsarv.io:${port}`))