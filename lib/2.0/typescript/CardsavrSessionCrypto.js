"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var crypto = require("crypto");
var isNode = true;
var WebConversions;
(function (WebConversions) {
    WebConversions.arrayBufferToBase64 = function (arrayBuffer) {
        var binary = '';
        var bytes = new Uint8Array(arrayBuffer);
        for (var i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    };
    WebConversions.base64ToArrayBuffer = function (b64string) {
        var binaryString = window.atob(b64string);
        var bytes = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    };
    WebConversions.stringToArrayBuffer = function (string) {
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
    var _this = this;
    Encryption.encryptRequest = function (key, body) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Encryption.encryptAES256(key, JSON.stringify(body))];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    Encryption.encryptAES256 = function (b64Key, clearText) {
        var binaryEncryptionKey = Buffer.alloc(32);
        binaryEncryptionKey.write(b64Key, 'base64');
        //  Create an Initialization Vector (IV) for encryption
        var IV = crypto.randomBytes(16);
        // Create buffer out of clear text for use in encryption
        //let bufferJSON = Buffer.alloc(clearText.length);
        //bufferJSON.write(clearText, 'utf8');
        var bufferJSON = Buffer.from(clearText, 'utf8');
        // Encrypt body using shared secret key and IV
        var encryptor = crypto.createCipheriv('aes-256-cbc', binaryEncryptionKey, IV);
        var encryptedJSON = Buffer.concat([encryptor.update(bufferJSON), encryptor.final()]);
        // Create new body to be placed in request payload (with $IV appended for additional uniqueness)
        var newBody = {
            'encryptedBody': encryptedJSON.toString('base64') + '$' + IV.toString('base64')
        };
        return newBody;
    };
    Encryption.decryptResponse = function (key, body) { return __awaiter(_this, void 0, void 0, function () {
        var stringParts;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    //handle bodies that don't have an encryptedBody property
                    if (!body || !body.hasOwnProperty('encryptedBody')) {
                        return [2 /*return*/, body];
                    }
                    stringParts = body.encryptedBody.split('$');
                    if (stringParts[1].length != 24) {
                        // Not a proper 16-byte base64-encoded IV
                        throw new Error("Response body is not properly encrypted.");
                    }
                    return [4 /*yield*/, Encryption.decryptAES256(stringParts[0], stringParts[1], key)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    Encryption.decryptAES256 = function (b64cipherText, b64IV, b64Key) {
        //   if (isNode) {
        var binaryEncryptionKey = Buffer.alloc(32);
        binaryEncryptionKey.write(b64Key, 'base64');
        var n = b64cipherText.length;
        var l = (n / 4) * 3;
        var equalsIndex = b64cipherText.indexOf('=');
        var length = equalsIndex > -1 ? l - (b64cipherText.length - equalsIndex) : l;
        var bodyBuffer = Buffer.alloc(length);
        bodyBuffer.write(b64cipherText, 'base64');
        var iv = Buffer.alloc(16);
        iv.write(b64IV, 'base64');
        var decryptor = crypto.createDecipheriv('aes-256-cbc', binaryEncryptionKey, iv);
        var decryptedJSON = Buffer.concat([decryptor.update(bodyBuffer), decryptor.final()]);
        var decryptedString = decryptedJSON.toString("utf8");
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
    var _this = this;
    Signing.sha256Hash = function (inputString) {
        //   if (isNode) {
        var hashMethods = crypto.createHash('sha256');
        hashMethods.update(inputString);
        return hashMethods.digest();
        //   }
        //   else {
        //     return subtleCrypto.digest('SHA-256', parentObject.webConversions.stringToArrayBuffer(inputString));
        //   }
    };
    Signing.signRequest = function (path, appName, sessionKey, body) { return __awaiter(_this, void 0, void 0, function () {
        var date, nonce, authorization, bodyString, stringToSign, signature;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    date = new Date();
                    nonce = date.getTime().toString(10);
                    authorization = 'SWCH-HMAC-SHA256 Credentials=' + appName;
                    bodyString = body ? JSON.stringify(body) : "";
                    stringToSign = decodeURIComponent(path) + authorization + nonce + bodyString;
                    return [4 /*yield*/, Signing.hmacSign(stringToSign, sessionKey)];
                case 1:
                    signature = _a.sent();
                    return [2 /*return*/, { authorization: authorization, nonce: nonce, signature: signature }];
            }
        });
    }); };
    Signing.verifySignature = function (url, headers, b64appKey, body) { return __awaiter(_this, void 0, void 0, function () {
        var bodyString, stringToVerify, verified;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    bodyString = body ? JSON.stringify(body) : "";
                    stringToVerify = decodeURIComponent(url) + headers.authorization + headers.nonce + bodyString;
                    return [4 /*yield*/, Signing.hmacVerify(stringToVerify, b64appKey, headers.signature)];
                case 1:
                    verified = _a.sent();
                    return [2 /*return*/, verified];
            }
        });
    }); };
    Signing.signSaltWithPasswordKey = function (sessionSalt, passwordKey) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Signing.hmacSign(sessionSalt, passwordKey, true)];
                case 1: return [2 /*return*/, _a.sent()];
            }
        });
    }); };
    Signing.hmacSign = function (inputString, b64Key, b64InputString) {
        if (b64InputString === void 0) { b64InputString = false; }
        return __awaiter(_this, void 0, void 0, function () {
            var stringToSign, binaryKey, hmac;
            return __generator(this, function (_a) {
                if (b64InputString) {
                    stringToSign = Buffer.alloc(32);
                    stringToSign.write(inputString, 'base64');
                }
                else {
                    stringToSign = inputString;
                }
                binaryKey = Buffer.alloc(32);
                binaryKey.write(b64Key, 'base64');
                hmac = crypto.createHmac('sha256', binaryKey);
                hmac.update(stringToSign);
                return [2 /*return*/, hmac.digest('base64')];
            });
        });
    };
    Signing.hmacVerify = function (inputString, b64Key, verificationSignature) { return __awaiter(_this, void 0, void 0, function () {
        var binaryKey, hmac, signature;
        return __generator(this, function (_a) {
            binaryKey = Buffer.alloc(32);
            binaryKey.write(b64Key, 'base64');
            hmac = crypto.createHmac('sha256', binaryKey);
            hmac.update(inputString);
            signature = hmac.digest('base64');
            return [2 /*return*/, signature === verificationSignature];
        });
    }); };
})(Signing = exports.Signing || (exports.Signing = {}));
var Keys;
(function (Keys) {
    var _this = this;
    Keys.generatePasswordKey = function (userName, clearTextPassword) { return __awaiter(_this, void 0, void 0, function () {
        var salt, key;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, Signing.sha256Hash(userName)];
                case 1:
                    salt = _a.sent();
                    return [4 /*yield*/, Keys.sha256pbkdf2(clearTextPassword, salt, 5000)];
                case 2:
                    key = _a.sent();
                    return [2 /*return*/, isNode ? key.toString('base64') : WebConversions.arrayBufferToBase64(key)];
            }
        });
    }); };
    Keys.generateCardholderSafeKey = function (username) {
        //   if (isNode) {
        var saltedCardholderSafeKey = crypto.pbkdf2Sync(crypto.randomBytes(32), username, 5000, 32, 'sha256');
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
    Keys.makeECDHkeyPair = function () {
        //   if (isNode) {
        var keyPair = crypto.createECDH('prime256v1');
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
    Keys.makeECDHPublicKey = function (myKeyPair) {
        //   if (isNode) {
        return myKeyPair.getPublicKey('base64', 'uncompressed');
        //   }
        //   else {
        //     let publicKey = await subtleCrypto.exportKey("raw", myKeyPair.publicKey);
        //     return parentObject.webConversions.arrayBufferToBase64(publicKey);
        //   }
    };
    Keys.makeECDHSecretKey = function (b64serverPublicKey, myKeyPair) {
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
    Keys.sha256pbkdf2 = function (clearTextPassword, salt, rounds) {
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
