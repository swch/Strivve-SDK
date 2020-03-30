const helper_functions = require("@strivve/strivve-sdk/lib/cardsavr/CardsavrHelperFunctions");

async function splitStart() {

  const app_name = "Hopenware";
  const app_key = "TwPdMV4EN4stSaRGIw1sNBaOJ+aBF2wuinDzyB36Wac=";
  const app_username = "hopenware";
  const app_password = "93oWf^N0fH%q";
  const cardsavr_server = "https://api.staging.cardsavr.io";

  const cardholder_data = require("./cardholder.json");
  const address_data = require("./address.json");
  const card_data = require("./card.json");

  response = await helper_functions.createAccount(
    app_name, app_key, app_username, app_password, cardsavr_server, 
    cardholder_data, address_data, card_data);
  
  console.dir(response)

  helper_functions.deleteAccount(app_name, app_key, app_username, app_password, cardsavr_server);
}

splitStart();

