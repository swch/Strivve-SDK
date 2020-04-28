const express = require('express')
const app = express()
const port = 3000
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

app.get('/create_user', function (req, res) {
    const app_name = "CardUpdatr Demo";
    const app_username = "cardupdatr_demo";
  
    const app_key = "[REDACTED]";
    const app_password = "[REDACTED]";
    const cardsavr_server = "https://api.localhost.cardsavr.io";
  
    const cardholder_data = require("./cardholder.json");
    const address_data = require("./address.json");
    const card_data = require("./card.json");
    
    CardsavrHelper.getInstance().setAppSettings(cardsavr_server, app_name, app_key);
    CardsavrHelper.getInstance().createCard(app_username, app_password, cardholder_data, address_data, card_data)
        .then(response => {
            const queryString = Object.keys(response).map(key => key + '=' + encodeURIComponent(response[key])).join('&');
            console.log(queryString);
            res.redirect("/#" + queryString);
        }).catch(err => console.log(err));
    
})

app.use(express.static('../dist'))

app.listen(port, () => console.log(`Example app listening at http://static.mbudos.cardsarv.io:${port}`))