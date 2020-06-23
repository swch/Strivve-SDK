const express = require('express')
const app = express()
const port = process.env.PORT || 3000;
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

app.get('/create_user', function (req, res) {
 
    const {app_name, app_key, app_username, app_password, cardsavr_server } = require("./strivve_creds.json");
    const cardholder_data = require("./cardholder.json");
    const address_data = require("./address.json");
    const card_data = require("./card.json");
    
    (async() => {

        const cu = cardsavr_server.replace("cardsavr.io", "cardupdatr.app").replace("//api.", "//");
        try {
            const ch = CardsavrHelper.getInstance();
            //Setup the settings for the application
            ch.setAppSettings(cardsavr_server, app_name, app_key);
            //Create a session for the application user (cardholder agent)
            if (await ch.loginAndCreateSession(app_username, app_password)) {
                //Save the card on a behalf of a temporary cardholder - return their username and a grant
                const data = await ch.createCard(app_username, 'default', cardholder_data, address_data, card_data);
                await ch.endSession(data.cardholder.username);
                handoff = { grant: data.grant, username: data.cardholder.username, card_id: data.card.id }
                const queryString = Object.keys(handoff).map(key => key + '=' + encodeURIComponent(handoff[key])).join('&');
                res.redirect(cu + "#select-merchants&" + queryString);
            }
        } catch (err) {
            console.log(err);
        }
            
    })();
      
})

app.use(express.static('../dist'))

app.listen(port, () => console.log(`Example app listening at ${port}`))