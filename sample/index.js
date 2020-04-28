const { CardsavrHelper } = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelper");

async function provisionUser() {

  const app_name = "CardUpdatr Demo";
  const app_username = "cardupdatr_demo";

  const app_key = "[REDACTED]";
  const app_password = "[REDACTED]";
  const cardsavr_server = "https://api.localhost.cardsavr.io";

  const cardholder_data = require("./cardholder.json");
  const address_data = require("./address.json");
  const card_data = require("./card.json");
  
  CardsavrHelper.getInstance().setAppSettings(cardsavr_server, app_name, app_key);
  response = await CardsavrHelper.getInstance().createCard(app_username, app_password, cardholder_data, address_data, card_data);
  
  const queryString = Object.keys(response).map(key => key + '=' + encodeURIComponent(response[key])).join('&');
  console.log(queryString);

  //helper_functions.deleteAccount(app_name, app_key, app_username, app_password, cardsavr_server);
}

provisionUser();

