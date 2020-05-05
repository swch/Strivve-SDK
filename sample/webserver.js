const express = require('express')
const app = express()
const port = 3000
const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

app.get('/create_user', function (req, res) {
    const app_name = "CardUpdatr Demo";
    const app_username = "cardupdatr_demo";
  
    const app_key = "oqLSC5V/R4w42crQT7x0HjcM5NnS2tiyTzWSxnOVZdU=";
    const app_password = "eyYhGC#n!89r";
    const cardsavr_server = "https://api.localhost.cardsavr.io";
    //const app_key = "TGSEjt4TuK0j55TeF7x1cao88Bc1j8nyHeaBHueT5gQ=";
    //const app_password = "uLa64$#Rf8bh";
    //const cardsavr_server = "https://api.mbudos.cardsavr.io";
  
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