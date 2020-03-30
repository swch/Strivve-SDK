"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import { generateRandomPar } from "./CardsavrSessionUtilities";

export async function createAccount(
    app_name: string, app_key: string, app_username: string, app_password: string, cardsavr_server: string, 
    cardholder_data: any, address_data: any, card_data: any) {

    const safe_key = generate_alphanumeric_string(44);
  
    const session = new CardsavrSession(cardsavr_server, app_key, app_name, app_username, app_password);

    let cardholder_id = -1;
    try {
        await session.init();
        cardholder_data.username = generate_alphanumeric_string(40);
        cardholder_data.cardholder_safe_key = safe_key; //eventually this just gets saved in cardsavr
        const cardholder_response = await session.createUser(cardholder_data);
        cardholder_id = cardholder_response.body.id;
        const grant_response = await session.getCredentialGrant(cardholder_id);
        const grant = grant_response.body.user_credential_grant;

        //Theorietically, this user should be looking up the bins, creating the address, and adding the card.
        //But then we need to create a new grant in here somewhere.
        //const session_user = new CardsavrSession(cardsavr_server, app_key, app_name, cardholder_data.username, undefined, grant);
        //await session_user.init();

        /* let's run the address creation and bin lookup together */
        const [ address_response, bin_id ] = await Promise.all([
            session.createAddress(address_data),
            lookupBin(session, card_data.pan.substring(0, 6))]);

        card_data.bin_id = bin_id;
        card_data.cardholder_id = cardholder_id;
        card_data.address_id = address_response.body.id;
        card_data.user_id = cardholder_id;
        card_data.par = generateRandomPar(card_data.pan, card_data.expiration_month, card_data.expiration_year, cardholder_data.username);
        const card_response = await session.createCard(card_data, safe_key);

        return { grant: grant, username: cardholder_data.username, card_id: card_response.body.id} ;

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
        deleteAccount(app_name, app_key, app_username, app_password, cardsavr_server, cardholder_id);
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

async function lookupBin(session: any, bin: string) {
    let bin_data = null;
    try {
        bin_data = await session.getBins( { bank_identification_numbers: bin} );
    } catch(err) {
        if (err.body && err.body._errors) {
            console.log("Errors returned from REST API");
            err.body._errors.map((item: any) => console.log(item));
        } else {
            console.log("no _errors, exception stack below:");
            console.log(err.stack);
        }
        bin_data = await session.createBin({ bank_identification_number: bin });
    }
    return bin_data.body.shift().id;
}
  
  
function generate_alphanumeric_string(length: number, current: string = ""): string {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    if (current.length == length) {
        return current;
    }
    current += characters.charAt(Math.floor(Math.random() * characters.length));
    return generate_alphanumeric_string(length, current);
}

