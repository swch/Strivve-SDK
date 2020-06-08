import * as crypto from 'crypto';

//@ts-ignore TS2551
const browserCrypto = (typeof window === 'undefined') ? false : (window.crypto || window.msCrypto);

export namespace WebConversions {

    export const arrayBufferToBase64 = (arrayBuffer: any) => {

        let binary = '';
        let bytes = new Uint8Array(arrayBuffer);

        for (var i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }

        return window.btoa(binary);
    }

    export const base64ToArrayBuffer = (b64string: string) => {

        var binaryString = window.atob(b64string);

        var bytes = new Uint8Array(binaryString.length);

        for (var i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        return bytes.buffer;
    }

    export const stringToArrayBuffer = (string: string) => {

        if (window.TextEncoder) {
            return new TextEncoder().encode(string);
        }

        var utf8String = unescape(encodeURIComponent(string));
        var result = new Uint8Array(utf8String.length);

        for (var i = 0; i < utf8String.length; i++) {
            result[i] = utf8String.charCodeAt(i);
        }

        return result;
    }
}

export namespace Encryption {

    export const encryptRequest = async(key: string, body: Object) => {

        return await encryptAES256(key, JSON.stringify(body));

    }

    export const encryptAES256 = async(b64Key: string, clearText: string) => {

        if (!browserCrypto) {

            let binaryEncryptionKey = Buffer.alloc(32);
            binaryEncryptionKey.write(b64Key, 'base64');

            //  Create an Initialization Vector (IV) for encryption
            let IV = crypto.randomBytes(16);

            // Create buffer out of clear text for use in encryption
            //let bufferJSON = Buffer.alloc(clearText.length);
            //bufferJSON.write(clearText, 'utf8');
            const bufferJSON = Buffer.from(clearText, 'utf8');

            // Encrypt body using shared secret key and IV
            let encryptor = crypto.createCipheriv('aes-256-cbc', binaryEncryptionKey, IV);

            let encryptedJSON = Buffer.concat([encryptor.update(bufferJSON), encryptor.final()]);

            // Create new body to be placed in request payload (with $IV appended for additional uniqueness)
            let newBody = {
                'encryptedBody': encryptedJSON.toString('base64') + '$' + IV.toString('base64')
            }

            return newBody;
        } else {

            // Generate an Initialization Vector
            let iv = new Uint8Array(16);
            browserCrypto.getRandomValues(iv);

            // Convert the encryption key from base64 and import it
            let encryptionKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key),
                "AES-CBC",
                false, // Not extractable
                ["encrypt"]
            );

            // Encrypt the password key using the secret key
            let encryptedKey = await browserCrypto.subtle.encrypt({
                    name: 'AES-CBC',
                    iv: iv
                },
                encryptionKey,
                WebConversions.stringToArrayBuffer(clearText)
            );

            // Create new body to be placed in request payload (with $IV appended for additional uniqueness)
            let newBody = {
                'encryptedBody': WebConversions.arrayBufferToBase64(encryptedKey) + '$' + WebConversions.arrayBufferToBase64(iv)
            }

            return newBody;

        }
 
    }

    export const encryptSafeKeys = (headers: any, b64Key: string) => {

        const safe_key_headers = ["new-cardholder-safe-key", "cardholder-safe-key"];
        safe_key_headers.map(async(safe_key_header) => {
            if (headers[safe_key_header]) {

                let encryptedObj = await encryptAES256(b64Key, headers[safe_key_header]);
                headers[safe_key_header] = encryptedObj.encryptedBody

            }
        });
        return;
    }

    export const decryptResponse = async(key: string, body: any) => {

        //handle bodies that don't have an encryptedBody property
        if (!body || !body.hasOwnProperty('encryptedBody')) {
            return body;
        }

        // Parse tuple string into encrypted body and IV components
        let stringParts = body.encryptedBody.split('$');
        if (stringParts[1].length != 24) {
            // Not a proper 16-byte base64-encoded IV
            throw new Error("Response body is not properly encrypted.");
        }

        return await decryptAES256(stringParts[0], stringParts[1], key);
    }

    export const decryptAES256 = async(b64cipherText: string, b64IV: string, b64Key: string) => {

        if (!browserCrypto) {

            let binaryEncryptionKey = Buffer.alloc(32);
            binaryEncryptionKey.write(b64Key, 'base64');

            let n = b64cipherText.length;
            let l = (n / 4) * 3;
            let equalsIndex = b64cipherText.indexOf('=');
            let length = equalsIndex > -1 ? l - (b64cipherText.length - equalsIndex) : l;

            let bodyBuffer = Buffer.alloc(length);
            bodyBuffer.write(b64cipherText, 'base64');

            let iv = Buffer.alloc(16);
            iv.write(b64IV, 'base64');

            let decryptor = crypto.createDecipheriv('aes-256-cbc', binaryEncryptionKey, iv);
            let decryptedJSON = Buffer.concat([decryptor.update(bodyBuffer), decryptor.final()]);
            let decryptedString = decryptedJSON.toString("utf8");

            return JSON.parse(decryptedString);
        } else {

            let decryptKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key),
                "AES-CBC",
                false, ["decrypt"]
            )

            let clearTextBuffer = await browserCrypto.subtle.decrypt({
                    name: "AES-CBC",
                    iv: WebConversions.base64ToArrayBuffer(b64IV)
                },
                decryptKey,
                WebConversions.base64ToArrayBuffer(b64cipherText)
            );

            let clearText = new TextDecoder().decode(clearTextBuffer);
            return JSON.parse(clearText);
        }
    }
}

export namespace Signing {

    export const sha256Hash = async(inputString: string) => {

        if (!browserCrypto) {
            let hashMethods = crypto.createHash('sha256');
            hashMethods.update(inputString);

            return hashMethods.digest();
        } else {
            return await browserCrypto.subtle.digest('SHA-256', WebConversions.stringToArrayBuffer(inputString));
        }
    }

    export const signRequest = async(path: string, appName: string, sessionKey: string, body ? : any) => {

        let date = new Date();
        let nonce = date.getTime().toString(10);
        let authorization = 'SWCH-HMAC-SHA256 Credentials=' + appName;

        let bodyString = body ? JSON.stringify(body) : ``;
        let stringToSign = decodeURIComponent(path) + authorization + nonce + bodyString;

        let signature = await hmacSign(stringToSign, sessionKey);

        return {
            authorization,
            nonce,
            signature
        };
    }

    export const verifySignature = async(url: string, headers: any, b64appKey: string, body: any) => {

        let bodyString = body ? JSON.stringify(body) : ``;
        let stringToVerify = decodeURIComponent(url) + headers.authorization + headers.nonce + bodyString;
        let verified = await hmacVerify(stringToVerify, b64appKey, headers.signature);

        return verified;
    }

    export const signSaltWithPasswordKey = async(sessionSalt: string, passwordKey: string) => {

        return await hmacSign(sessionSalt, passwordKey, true);
    }

    export const hmacSign = async(inputString: any, b64Key: string, b64InputString = false) => {

        if (!browserCrypto) {

            var stringToSign;

            if (b64InputString) {
                stringToSign = Buffer.alloc(32);
                stringToSign.write(inputString, 'base64');
            } else {
                stringToSign = inputString;
            }

            let binaryKey = Buffer.alloc(32);
            binaryKey.write(b64Key, 'base64');

            let hmac = crypto.createHmac('sha256', binaryKey);
            hmac.update(stringToSign);

            return hmac.digest('base64');
        } else {

            var stringToSign: any = b64InputString ? WebConversions.base64ToArrayBuffer(inputString) : WebConversions.stringToArrayBuffer(inputString);

            let signingKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key), {
                    "name": "HMAC",
                    hash: {
                        name: "SHA-256"
                    },
                },
                false, ["sign"]
            );

            let signature = await browserCrypto.subtle.sign(
                "HMAC",
                signingKey,
                stringToSign
            );

            return WebConversions.arrayBufferToBase64(signature);
        }
    }

    export const hmacVerify = async(inputString: string, b64Key: string, verificationSignature: string) => {

        if (!browserCrypto) {

            let binaryKey = Buffer.alloc(32);
            binaryKey.write(b64Key, 'base64');

            let hmac = crypto.createHmac('sha256', binaryKey);
            hmac.update(inputString);
            let signature = hmac.digest('base64');

            return signature === verificationSignature;
        } else {

            let signingKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.base64ToArrayBuffer(b64Key), {
                    "name": "HMAC",
                    hash: {
                        name: "SHA-256"
                    },
                },
                false, ["verify"]
            );

            return await browserCrypto.subtle.verify(
                "HMAC",
                signingKey,
                WebConversions.base64ToArrayBuffer(verificationSignature),
                WebConversions.stringToArrayBuffer(inputString)
            );
        }
    }
}

export namespace Keys {

    export const generatePasswordKey = async(userName: string, clearTextPassword: string) => {

        let salt = await Signing.sha256Hash(userName);
        let key = await sha256pbkdf2(clearTextPassword, salt, 5000);

        return !browserCrypto ? (key as Buffer).toString('base64') : WebConversions.arrayBufferToBase64(key);
    }

    export const generateCardholderSafeKey = async(username: string) => {

        if (!browserCrypto) {

            let saltedCardholderSafeKey = crypto.pbkdf2Sync(crypto.randomBytes(32), username, 5000, 32, 'sha256');
            return saltedCardholderSafeKey.toString('base64');
        } else {

            let binaryCardholderSafeKey = new Uint8Array(32);
            browserCrypto.getRandomValues(binaryCardholderSafeKey);

            let baseKey = await browserCrypto.subtle.importKey("raw", binaryCardholderSafeKey, "PBKDF2", false, ["deriveBits", "deriveKey"]);

            let aesKey = await browserCrypto.subtle.deriveKey({
                    "name": "PBKDF2",
                    "salt": WebConversions.stringToArrayBuffer(username),
                    "iterations": 5000,
                    "hash": "SHA-256"
                },
                baseKey, {
                    "name": "AES-CBC",
                    "length": 256
                },
                true, ["encrypt", "decrypt"]
            );

            let rawKey = await browserCrypto.subtle.exportKey("raw", aesKey);
            return WebConversions.arrayBufferToBase64(rawKey);
        }
    }

    export const makeECDHkeyPair = async() => {

        if (!browserCrypto) {

            let keyPair = crypto.createECDH('prime256v1');
            keyPair.generateKeys();
            return keyPair;
        } else {

            return await browserCrypto.subtle.generateKey({
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true, ["deriveKey", "deriveBits"]
            )
        }
    }

    export const makeECDHPublicKey = async(myKeyPair: any) => {

        if (!browserCrypto) {
            return myKeyPair.getPublicKey('base64', 'uncompressed');
        } else {

            let publicKey = await browserCrypto.subtle.exportKey("raw", myKeyPair.publicKey);
            return WebConversions.arrayBufferToBase64(publicKey);
        }
    }

    export const makeECDHSecretKey = async(b64serverPublicKey: any, myKeyPair: any) => {

        if (!browserCrypto) {
            return myKeyPair.computeSecret(b64serverPublicKey, 'base64', 'base64');
        } else {

            let key = WebConversions.base64ToArrayBuffer(b64serverPublicKey)

            let importedServerKey = await browserCrypto.subtle.importKey(
                "raw",
                key, {
                    name: "ECDH",
                    namedCurve: "P-256"
                },
                true, []
            );

            let binaryPublicKey = await browserCrypto.subtle.deriveBits({
                    name: "ECDH",
                    public: importedServerKey
                },
                myKeyPair.privateKey,
                256
            );

            return WebConversions.arrayBufferToBase64(binaryPublicKey);
        }
    };

    export const sha256pbkdf2 = async(clearTextPassword: string, salt: any, rounds: number) => {

        if (!browserCrypto) {
            return crypto.pbkdf2Sync(clearTextPassword, salt, rounds, 32, 'sha256');
        } else {

            let baseKey = await browserCrypto.subtle.importKey(
                "raw",
                WebConversions.stringToArrayBuffer(clearTextPassword),
                "PBKDF2",
                false, ["deriveBits", "deriveKey"]
            );

            let aesKey = await browserCrypto.subtle.deriveKey({
                    "name": "PBKDF2",
                    "salt": salt,
                    "iterations": rounds,
                    "hash": "SHA-256"
                },
                baseKey, {
                    "name": "AES-CBC",
                    "length": 256
                },
                true, ["encrypt", "decrypt"]
            );

            return await browserCrypto.subtle.exportKey("raw", aesKey);
        }
    }
}