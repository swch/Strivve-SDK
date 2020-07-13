import { Signing } from "../../../lib/cardsavr/CardsavrSessionCrypto.js";

const app_key = process.env.app_key;
const app_name = process.env.app_name;
const path = process.env.path;
const body = process.env.body;

async function signature_test(){

    const date = new Date();
    const nonce = date.getTime().toString(10);
    const authorization = "SWCH-HMAC-SHA256 Credentials=" + app_name;

    const bodyString = body ? JSON.stringify(body) : "";
    const stringToSign = decodeURIComponent(path) + authorization + nonce + bodyString;

    console.log(`The string being signed is: ${stringToSign}`);

    const headers = await Signing.signRequest(path, app_name, app_key, body);

    console.log("the generated headers are: ");
    console.log(headers);
}

signature_test();
