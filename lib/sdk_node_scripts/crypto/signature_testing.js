const crypto = require("../2.0/transpiled-node-js/CardsavrSessionCrypto.js");

let app_key = process.env.app_key;
let app_name = process.env.app_name;
let path = process.env.path;
let body = process.env.body;

async function signature_test(){

    let date = new Date();
    let nonce = date.getTime().toString(10);
    let authorization = 'SWCH-HMAC-SHA256 Credentials=' + app_name;

    let bodyString = body ? JSON.stringify(body) : ``;
    let stringToSign = decodeURIComponent(path) + authorization + nonce + bodyString;

    console.log(`The string being signed is: ${stringToSign}`)

    let headers = await crypto.Signing.signRequest(path, app_name, app_key, body);

    console.log("the generated headers are: ")
    console.log(headers)
}

signature_test();

