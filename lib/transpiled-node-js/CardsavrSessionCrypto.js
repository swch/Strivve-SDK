"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const isNode = true;
var WebConversions;
(function (WebConversions) {
    WebConversions.arrayBufferToBase64 = (arrayBuffer) => {
        let binary = '';
        let bytes = new Uint8Array(arrayBuffer);
        for (var i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };
    WebConversions.base64ToArrayBuffer = (b64string) => {
        var binaryString = window.atob(b64string);
        var bytes = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };
    WebConversions.stringToArrayBuffer = (string) => {
        //   if (window.TextEncoder) {
        //     return new TextEncoder('utf-8').encode(string);
        //   }
        var utf8String = unescape(encodeURIComponent(string));
        var result = new Uint8Array(utf8String.length);
        for (var i = 0; i < utf8String.length; i++) {
            result[i] = utf8String.charCodeAt(i);
        }
        return result;
    };
})(WebConversions = exports.WebConversions || (exports.WebConversions = {}));
var Encryption;
(function (Encryption) {
    Encryption.encryptRequest = async (key, body) => {
        return await Encryption.encryptAES256(key, JSON.stringify(body));
    };
    Encryption.encryptAES256 = (b64Key, clearText) => {
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
        };
        return newBody;
    };
    Encryption.decryptResponse = async (key, body) => {
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
        return await Encryption.decryptAES256(stringParts[0], stringParts[1], key);
    };
    Encryption.decryptAES256 = (b64cipherText, b64IV, b64Key) => {
        //   if (isNode) {
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
        //   }
        //   else {
        //       let decryptKey = await subtleCrypto.importKey(
        //           "raw",
        //           parentObject.webConversions.base64ToArrayBuffer(b64Key),
        //           { "name": "AES-CBC" },
        //           false,
        //           ["decrypt"]
        //         )
        //         let clearTextBuffer = await subtleCrypto.decrypt(
        //           {
        //             name: "AES-CBC",
        //             iv: parentObject.webConversions.base64ToArrayBuffer(b64IV)
        //           },
        //           decryptKey,
        //           parentObject.webConversions.base64ToArrayBuffer(b64cipherText)
        //         );
        //         let clearText = new TextDecoder().decode(clearTextBuffer);
        //         return JSON.parse(clearText);
        //   }
    };
})(Encryption = exports.Encryption || (exports.Encryption = {}));
var Signing;
(function (Signing) {
    Signing.sha256Hash = (inputString) => {
        //   if (isNode) {
        let hashMethods = crypto.createHash('sha256');
        hashMethods.update(inputString);
        return hashMethods.digest();
        //   }
        //   else {
        //     return subtleCrypto.digest('SHA-256', parentObject.webConversions.stringToArrayBuffer(inputString));
        //   }
    };
    Signing.signRequest = async (path, appName, sessionKey, body) => {
        let date = new Date();
        let nonce = date.getTime().toString(10);
        let authorization = 'SWCH-HMAC-SHA256 Credentials=' + appName;
        let bodyString = body ? JSON.stringify(body) : ``;
        let stringToSign = decodeURIComponent(path) + authorization + nonce + bodyString;
        let signature = await Signing.hmacSign(stringToSign, sessionKey);
        return { authorization, nonce, signature };
    };
    Signing.verifySignature = async (url, headers, b64appKey, body) => {
        let bodyString = body ? JSON.stringify(body) : ``;
        let stringToVerify = decodeURIComponent(url) + headers.authorization + headers.nonce + bodyString;
        let verified = await Signing.hmacVerify(stringToVerify, b64appKey, headers.signature);
        return verified;
    };
    Signing.signSaltWithPasswordKey = async (sessionSalt, passwordKey) => {
        return await Signing.hmacSign(sessionSalt, passwordKey, true);
    };
    Signing.hmacSign = async (inputString, b64Key, b64InputString = false) => {
        //   if (isNode) {
        var stringToSign;
        if (b64InputString) {
            stringToSign = Buffer.alloc(32);
            stringToSign.write(inputString, 'base64');
        }
        else {
            stringToSign = inputString;
        }
        let binaryKey = Buffer.alloc(32);
        binaryKey.write(b64Key, 'base64');
        let hmac = crypto.createHmac('sha256', binaryKey);
        hmac.update(stringToSign);
        return hmac.digest('base64');
        //   }
        //   else {
        //     var stringToSign = isSalt ? parentObject.webConversions.base64ToArrayBuffer(inputString) : parentObject.webConversions.stringToArrayBuffer(inputString);
        //     let signingKey = await subtleCrypto.importKey(
        //       "raw",
        //       parentObject.webConversions.base64ToArrayBuffer(b64Key),
        //       {
        //         "name": "HMAC",
        //         hash: { name: "SHA-256" },
        //       },
        //       false,
        //       ["sign"]
        //     );
        //     let signature = await subtleCrypto.sign(
        //       { "name": "HMAC" },
        //       signingKey,
        //       stringToSign
        //     );
        //     return parentObject.webConversions.arrayBufferToBase64(signature);
        //   }
    };
    Signing.hmacVerify = async (inputString, b64Key, verificationSignature) => {
        //   if (isNode) {
        let binaryKey = Buffer.alloc(32);
        binaryKey.write(b64Key, 'base64');
        let hmac = crypto.createHmac('sha256', binaryKey);
        hmac.update(inputString);
        let signature = hmac.digest('base64');
        return signature === verificationSignature;
        //   }
        //   else {
        //     let signingKey = await subtleCrypto.importKey(
        //       "raw",
        //       parentObject.webConversions.base64ToArrayBuffer(b64Key),
        //       {
        //         "name": "HMAC",
        //         hash: { name: "SHA-256" },
        //       },
        //       false,
        //       ["verify"]
        //     );
        //     return await subtleCrypto.verify(
        //       { "name": "HMAC" },
        //       signingKey,
        //       parentObject.webConversions.base64ToArrayBuffer(verificationSignature),
        //       parentObject.webConversions.stringToArrayBuffer(inputString)
        //     );
        //   }
    };
})(Signing = exports.Signing || (exports.Signing = {}));
var Keys;
(function (Keys) {
    Keys.generatePasswordKey = async (userName, clearTextPassword) => {
        let salt = await Signing.sha256Hash(userName);
        let key = await Keys.sha256pbkdf2(clearTextPassword, salt, 5000);
        return isNode ? key.toString('base64') : WebConversions.arrayBufferToBase64(key);
    };
    Keys.generateCardholderSafeKey = (username) => {
        //   if (isNode) {
        let saltedCardholderSafeKey = crypto.pbkdf2Sync(crypto.randomBytes(32), username, 5000, 32, 'sha256');
        return saltedCardholderSafeKey.toString('base64');
        //   }
        //   else {
        //     let binaryCardholderSafeKey = new Uint8Array(32);
        //     crypto.getRandomValues(binaryCardholderSafeKey);
        //     let baseKey = await subtleCrypto.importKey("raw", binaryCardholderSafeKey, { "name": "PBKDF2" }, false, ["deriveBits", "deriveKey"]);
        //     let aesKey = await subtleCrypto.deriveKey(
        //       {
        //         "name": "PBKDF2",
        //         "salt": this.webConversions.stringToArrayBuffer(username),
        //         "iterations": 5000,
        //         "hash": "SHA-256"
        //       },
        //       baseKey,
        //       {
        //         "name": "AES-CBC",
        //         "length": 256
        //       },
        //       true,
        //       ["encrypt", "decrypt"]
        //     );
        //     let rawKey = await subtleCrypto.exportKey("raw", aesKey);
        //     return parentObject.webConversions.arrayBufferToBase64(rawKey);
        //   }
    };
    Keys.makeECDHkeyPair = () => {
        //   if (isNode) {
        let keyPair = crypto.createECDH('prime256v1');
        keyPair.generateKeys();
        return keyPair;
        //   }
        //   else {
        //     return await subtleCrypto.generateKey(
        //       {
        //         name: "ECDH",
        //         namedCurve: "P-256"
        //       },
        //       true,
        //       ["deriveKey", "deriveBits"]
        //     )
        //   }
    };
    Keys.makeECDHPublicKey = (myKeyPair) => {
        //   if (isNode) {
        return myKeyPair.getPublicKey('base64', 'uncompressed');
        //   }
        //   else {
        //     let publicKey = await subtleCrypto.exportKey("raw", myKeyPair.publicKey);
        //     return parentObject.webConversions.arrayBufferToBase64(publicKey);
        //   }
    };
    Keys.makeECDHSecretKey = (b64serverPublicKey, myKeyPair) => {
        //   if (isNode) {
        return myKeyPair.computeSecret(b64serverPublicKey, 'base64', 'base64');
        //   }
        //   else {
        //     let key = parentObject.webConversions.base64ToArrayBuffer(b64serverPublicKey)
        //     let importedServerKey = await subtleCrypto.importKey(
        //       "raw",
        //       key,
        //       {
        //         name: "ECDH",
        //         namedCurve: "P-256"
        //       },
        //       true,
        //       []
        //     );
        //     let binaryPublicKey = await subtleCrypto.deriveBits(
        //       {
        //         name: "ECDH",
        //         namedCurve: "P-256",
        //         public: importedServerKey
        //       },
        //       myKeyPair.privateKey,
        //       256
        //     );
        //     return parentObject.webConversions.arrayBufferToBase64(binaryPublicKey);
        //   }
    };
    Keys.sha256pbkdf2 = (clearTextPassword, salt, rounds) => {
        //   if (isNode) {
        return crypto.pbkdf2Sync(clearTextPassword, salt, rounds, 32, 'sha256');
        //   }
        //   else {
        //     let baseKey = await subtleCrypto.importKey(
        //       "raw",
        //       parentObject.webConversions.stringToArrayBuffer(clearTextPassword),
        //       { "name": "PBKDF2" },
        //       false,
        //       ["deriveBits", "deriveKey"]
        //     );
        //     let aesKey = await subtleCrypto.deriveKey(
        //       {
        //         "name": "PBKDF2",
        //         "salt": salt,
        //         "iterations": rounds,
        //         "hash": "SHA-256"
        //       },
        //       baseKey,
        //       {
        //         "name": "AES-CBC",
        //         "length": 256
        //       },
        //       true,
        //       ["encrypt", "decrypt"]
        //     );
        //     return await subtleCrypto.exportKey("raw", aesKey);
        //   }
    };
})(Keys = exports.Keys || (exports.Keys = {}));
//# sourceMappingURL=CardsavrSessionCrypto.js.map