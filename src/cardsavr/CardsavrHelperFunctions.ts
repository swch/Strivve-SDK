"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import { generateRandomPar } from "./CardsavrSessionUtilities";
import * as crypto from 'crypto';

export async function createAccount(
    app_name: string, app_key: string, app_username: string, app_password: string, cardsavr_server: string, 
    cardholder_data: any, address_data: any, card_data: any) {

    const session = new CardsavrSession(cardsavr_server, app_key, app_name, app_username, app_password);

    try {
        await session.init();
        cardholder_data.username = generate_alphanumeric_string(40);
        cardholder_data.cardholder_safe_key =  crypto.randomBytes(32).toString("base64"); 
        cardholder_data.role = "cardholder";

        //set the missing settings for cardupdatr model
        if (!cardholder_data.first_name) cardholder_data.first_name = card_data.first_name;
        if (!cardholder_data.last_name) cardholder_data.last_name = card_data.last_name;
        if (!card_data.name_on_card) card_data.name_on_card = card_data.first_name + card_data.last_name;

        const cardholder_response = await session.createUser(cardholder_data);
        const cardholder_id = cardholder_response.body.id;
        const grant_response = await session.getCredentialGrant(cardholder_id);
        const grant = grant_response.body.user_credential_grant;

        //Theorietically, this user should be looking up the bins, creating the address, and adding the card.
        //But then we need to create a new grant in here somewhere.
        const session_user = new CardsavrSession(cardsavr_server, app_key, app_name, cardholder_data.username, undefined, grant);
        const resp = await session_user.init();

        /* let's run the address creation and bin lookup together */
        const address_response = await session_user.createAddress(address_data);

        card_data.bin_id = 1
        card_data.cardholder_id = cardholder_id;
        card_data.address_id = address_response.body.id;
        card_data.user_id = cardholder_id;
        card_data.par = generateRandomPar(card_data.pan, card_data.expiration_month, card_data.expiration_year, cardholder_data.username);
        const card_response = await session_user.createCard(card_data, cardholder_data.cardholder_safe_key);

        //eventually these will be one time grants
        const grant_response_handoff = await session.getCredentialGrant(cardholder_id);
        const grant_handoff = grant_response_handoff.body.user_credential_grant;

        return { grant: grant_handoff, username: cardholder_data.username, card_id: card_response.body.id } ;

    } catch(err) {
        if (err.body && err.body._errors) {
            console.log("Errors returned from REST API");
            err.body._errors.map((item: string) => console.log(item));
        } else {
            console.log("no _errors, exception stack below:");
            console.log(err.stack);
        }
    }
    if (false) {  //this is only for testing
        deleteAccount(app_name, app_key, app_username, app_password, cardsavr_server, card_data.cardholder_id);
    }
}

export async function deleteAccount (
    app_name: string, app_key: string, app_username: string, app_password: string, cardsavr_server: string, 
    cardholder_id: number) {

    const session = new CardsavrSession(cardsavr_server, app_key, app_name, app_username, app_password);
    await session.init();
    try {
        if (cardholder_id > 0) {
            session.deleteUser(cardholder_id);
        }
    } catch(err) {
        if (err.body && err.body._errors) {
            console.log("Errors returned from REST API");
            err.body._errors.map((item: string) => console.log(item));
        } else {
            console.log("no _errors, exception stack below:");
            console.log(err.stack);
        }
    }
}
  
function generate_alphanumeric_string(length: number, current: string = ""): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    if (current.length == length) {
        return current;
    }
    current += characters.charAt(Math.floor(Math.random() * characters.length));
    return generate_alphanumeric_string(length, current);
}

