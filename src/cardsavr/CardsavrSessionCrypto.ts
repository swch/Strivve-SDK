import * as crypto from "crypto";

//browserCrypto will be false for both node AND IE11 AND Advancial because they are destroying window.crypto contents
const browserCrypto = (typeof window === "undefined" || !window.crypto?.subtle) ? false : window.crypto;

class WebConversions {

    static arrayBufferToBase64(arrayBuffer: any) {

        let binary = "";
        const bytes = new Uint8Array(arrayBuffer);

        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return window.btoa(binary);
    }

    static base64ToArrayBuffer(b64string: string) {

        const binaryString = window.atob(b64string);

        const bytes = new Uint8Array(binaryString.length);

        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer;
    }

    static stringToArrayBuffer (string: string) {

        if (window.TextEncoder) {
            return new TextEncoder().encode(string);
        }

        const utf8String = unescape(encodeURIComponent(string));
        const result = new Uint8Array(utf8String.length);

        for (let i = 0; i < utf8String.length; i++) {
            result[i] = utf8String.charCodeAt(i);
        }

        return result;
    }
}

export class Encryption {

    static async encryptRequest(key: string, body: unknown) {

        return await this.encryptAES256(key, JSON.stringify(body));

    }

    static async encryptAES256(b64Key: string, clearText: string) {

        if (!browserCrypto) {

            const binaryEncryptionKey = Buffer.alloc(32);
            binaryEncryptionKey.write(b64Key, "base64");

            //  Create an Initialization Vector (IV) for encryption
            const IV = crypto.randomBytes(16);

            // Create buffer out of clear text for use in encryption
            //let bufferJSON = Buffer.alloc(clearText.length);
            //bufferJSON.write(clearText, 'utf8');
            const bufferJSON = Buffer.from(clearText, "utf8");

            // Encrypt body using shared secret key and IV
            const encryptor = crypto.createCipheriv("aes-256-cbc", binaryEncryptionKey, IV);

            const encryptedJSON = Buffer.concat([encryptor.update(bufferJSON), encryptor.final()]);

            // Create new body to be placed in request payload (with $IV appended for additional uniqueness)
            const newBody = {
                "encrypted_body" : encryptedJSON.toString("base64") + "$" + IV.toString("base64")
            };

            return newBody;
        } else {

            // Generate an Initialization Vector
            const iv = new Uint8Array(16);
            browserCrypto.getRandomValues(iv);

            // Convert the encryption key from base64 and import it
            const encryptionKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key),
                "AES-CBC",
                false, // Not extractable
                ["encrypt"]
            );

            // Encrypt the password key using the secret key
            const encryptedKey = await browserCrypto.subtle.encrypt({
                    name : "AES-CBC",
                    iv : iv
                },
                encryptionKey,
                WebConversions.stringToArrayBuffer(clearText)
            );

            // Create new body to be placed in request payload (with $IV appended for additional uniqueness)
            const newBody = {
                "encrypted_body" : WebConversions.arrayBufferToBase64(encryptedKey) + "$" + WebConversions.arrayBufferToBase64(iv)
            };

            return newBody;

        }
 
    }

    static encryptSafeKeys(headers: any, b64Key: string) {

        const safe_key_headers = ["x-cardsavr-new-cardholder-safe-key", "x-cardsavr-cardholder-safe-key"];
        safe_key_headers.forEach(async(safe_key_header) => {
            if (headers[safe_key_header]) {

                const encryptedObj = await this.encryptAES256(b64Key, headers[safe_key_header]);
                headers[safe_key_header] = encryptedObj.encrypted_body;

            }
        });
    }

    static async decryptResponse(key: string, body: any) {

        //handle bodies that don't have an encrypted_body property
        if (!body || !Object.prototype.hasOwnProperty.call(body, "encrypted_body")) {
            return body;
        }

        // Parse tuple string into encrypted body and IV components
        const stringParts = body.encrypted_body.split("$");
        if (stringParts[1].length != 24) {
            // Not a proper 16-byte base64-encoded IV
            throw new Error("Response body is not properly encrypted.");
        }
        const req = this.decryptAES256(stringParts[0], stringParts[1], key);
        return await req;
    }

    static async decryptAES256(b64cipherText: string, b64IV: string, b64Key: string) {

        if (!browserCrypto) {

            const binaryEncryptionKey = Buffer.alloc(32);
            binaryEncryptionKey.write(b64Key, "base64");

            const n = b64cipherText.length;
            const l = (n / 4) * 3;
            const equalsIndex = b64cipherText.indexOf("=");
            const length = equalsIndex > -1 ? l - (b64cipherText.length - equalsIndex) : l;

            const bodyBuffer = Buffer.alloc(length);
            bodyBuffer.write(b64cipherText, "base64");

            const iv = Buffer.from(b64IV, "base64");

            const decryptor = crypto.createDecipheriv("aes-256-cbc", binaryEncryptionKey, iv);
            const decryptedJSON = Buffer.concat([decryptor.update(bodyBuffer), decryptor.final()]);
            const decryptedString = decryptedJSON.toString("utf8");

            return JSON.parse(decryptedString);
        } else {

            const decryptKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key),
                "AES-CBC",
                false, ["decrypt"]
            );

            const clearTextBuffer = await browserCrypto.subtle.decrypt({
                    name : "AES-CBC",
                    iv : WebConversions.base64ToArrayBuffer(b64IV)
                },
                decryptKey,
                WebConversions.base64ToArrayBuffer(b64cipherText)
            );

            const clearText = new TextDecoder().decode(clearTextBuffer);
            return JSON.parse(clearText);
        }
    }
}

export class Signing {

    static async sha256Hash(inputString: string) {

        if (!browserCrypto) {
            const hashMethods = crypto.createHash("sha256");
            hashMethods.update(inputString);

            return hashMethods.digest();
        } else {
            return await browserCrypto.subtle.digest("SHA-256", WebConversions.stringToArrayBuffer(inputString));
        }
    }

    static async signRequest(path: string, appName: string, sessionKey: string, body? : { [key: string] : unknown }) : Promise<{[k: string]: string}> {

        const date = new Date();
        const nonce = date.getTime().toString(10);
        const authorization = "SWCH-HMAC-SHA256 Credentials=" + appName;

        const stringToSign = decodeURIComponent(path) + authorization + nonce + (body ? JSON.stringify(body) : "");
        const signature = await this.hmacSign(stringToSign, sessionKey);

        return {
            "x-cardsavr-authorization" : authorization,
            "x-cardsavr-nonce" : nonce,
            "x-cardsavr-signature" : signature
        };
    }

    static async verifySignature(headers: {[k: string]: string}, path: string, appName: string, keys: string[], body? : object) : Promise<boolean> {

        const authorization = headers["x-cardsavr-authorization"];
        if ("SWCH-HMAC-SHA256 Credentials=" + appName !== authorization) {
            throw new Error(`Authorization header not passed properly, should be: "SWCH-HMAC-SHA256 Credentials=${appName}" not "${authorization}"`);
        }
        const nonce = headers["x-cardsavr-nonce"];
        if (!nonce) {
            throw new Error("No nonce header provided.");
        }
        const signature = headers["x-cardsavr-signature"];
        if (!signature) {
            throw new Error("No signature header provided.");
        }
    
        const stringToSign = decodeURIComponent(path) + authorization + nonce + (body ? JSON.stringify(body) : "");
        for (const key of keys) {
            if ((await Signing.hmacSign(stringToSign, key)) === signature) {
                return true;
            }
        }
        throw new Error("Invalid signature.");
    }

    static async signSaltWithPasswordKey(sessionSalt: string, passwordKey: string) : Promise<string> {

        return await this.hmacSign(sessionSalt, passwordKey, true);
    }

    static async hmacSign(inputString: string, b64Key: string, b64InputString = false) : Promise<string> {

        if (!browserCrypto) {
            let stringToSign;

            if (b64InputString) {
                stringToSign = Buffer.alloc(32);
                stringToSign.write(inputString, "base64");
            } else {
                stringToSign = inputString;
            }

            const binaryKey = Buffer.alloc(32);
            binaryKey.write(b64Key, "base64");

            const hmac = crypto.createHmac("sha256", binaryKey);
            hmac.update(stringToSign);
            return hmac.digest("base64");
        } else {

            const stringToSign: any = b64InputString ? WebConversions.base64ToArrayBuffer(inputString) : WebConversions.stringToArrayBuffer(inputString);

            const signingKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key), {
                    "name" : "HMAC",
                    hash : {
                        name : "SHA-256"
                    },
                },
                false, ["sign"]
            );

            const signature = await browserCrypto.subtle.sign(
                "HMAC",
                signingKey,
                stringToSign
            );

            return WebConversions.arrayBufferToBase64(signature);
        }
    }
}

export class Keys {

    static async generatePasswordKey(username: string, clearTextPassword: string) : Promise<string> {

        const salt = await Signing.sha256Hash(username);
        const key = await this.sha256pbkdf2(clearTextPassword, salt, 5000);

        return !browserCrypto ? (key as Buffer).toString("base64") : WebConversions.arrayBufferToBase64(key);
    }

    static async generateCardholderSafeKey(username: string) : Promise<string> {

        if (!browserCrypto) {

            const saltedCardholderSafeKey = crypto.pbkdf2Sync(crypto.randomBytes(32), username, 5000, 32, "sha256");
            return saltedCardholderSafeKey.toString("base64");
        } else {

            const binaryCardholderSafeKey = new Uint8Array(32);
            browserCrypto.getRandomValues(binaryCardholderSafeKey);

            const baseKey = await browserCrypto.subtle.importKey("raw", binaryCardholderSafeKey, "PBKDF2", false, ["deriveBits", "deriveKey"]);

            const aesKey = await browserCrypto.subtle.deriveKey({
                    "name" : "PBKDF2",
                    "salt" : WebConversions.stringToArrayBuffer(username),
                    "iterations" : 5000,
                    "hash" : "SHA-256"
                },
                baseKey, {
                    "name" : "AES-CBC",
                    "length" : 256
                },
                true, ["encrypt", "decrypt"]
            );

            const rawKey = await browserCrypto.subtle.exportKey("raw", aesKey);
            return WebConversions.arrayBufferToBase64(rawKey);
        }
    }

    static async makeECDHkeyPair() {

        if (!browserCrypto) {

            const keyPair = crypto.createECDH("prime256v1");
            keyPair.generateKeys();
            return keyPair;
        } else {

            return await browserCrypto.subtle.generateKey({
                    name : "ECDH",
                    namedCurve : "P-256"
                },
                true, ["deriveKey", "deriveBits"]
            );
        }
    }

    static async makeECDHPublicKey(myKeyPair: any) {

        if (!browserCrypto) {
            return myKeyPair.getPublicKey("base64", "uncompressed");
        } else {

            const publicKey = await browserCrypto.subtle.exportKey("raw", myKeyPair.publicKey);
            return WebConversions.arrayBufferToBase64(publicKey);
        }
    }

    static async makeECDHSecretKey(b64serverPublicKey: any, myKeyPair: any) {

        if (!browserCrypto) {
            return myKeyPair.computeSecret(b64serverPublicKey, "base64", "base64");
        } else {

            const key = WebConversions.base64ToArrayBuffer(b64serverPublicKey);

            const importedServerKey = await browserCrypto.subtle.importKey(
                "raw",
                key, {
                    name : "ECDH",
                    namedCurve : "P-256"
                },
                true, []
            );

            const binaryPublicKey = await browserCrypto.subtle.deriveBits({
                    name : "ECDH",
                    public : importedServerKey
                },
                myKeyPair.privateKey,
                256
            );

            return WebConversions.arrayBufferToBase64(binaryPublicKey);
        }
    }

    static async sha256pbkdf2(clearTextPassword: string, salt: any, rounds: number) : Promise<ArrayBuffer> {

        if (!browserCrypto) {
            return crypto.pbkdf2Sync(clearTextPassword, salt, rounds, 32, "sha256");
        } else {

            const baseKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.stringToArrayBuffer(clearTextPassword),
                "PBKDF2",
                false, ["deriveBits", "deriveKey"]
            );

            const aesKey = await browserCrypto.subtle.deriveKey({
                    "name" : "PBKDF2",
                    "salt" : salt,
                    "iterations" : rounds,
                    "hash" : "SHA-256"
                },
                baseKey, {
                    "name" : "AES-CBC",
                    "length" : 256
                },
                true, ["encrypt", "decrypt"]
            );

            return await browserCrypto.subtle.exportKey("raw", aesKey);
        }
    }
}