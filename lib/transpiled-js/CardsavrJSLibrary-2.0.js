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
import JSLibraryError from "./JSLibraryError";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import * as CardsavrSessionUtilities from "./CardsavrSessionUtilities";
import * as CardsavrCrypto from "./CardsavrSessionCrypto";
import { Agent as HTTPSAgent } from "https";
import axios from "axios";
var CardsavrSession = /** @class */ (function () {
    function CardsavrSession(baseUrl, sessionKey, appName, userName, password, userCredentialGrant, cardsavrCert) {
        var _this = this;
        this.setSessionHeaders = function (headersObject) {
            Object.assign(_this.sessionData.headers, headersObject);
        };
        this.makeTraceHeader = function (traceHeaderObject) {
            var stringifiedTrace = JSON.stringify(traceHeaderObject);
            return { "swch-persistent-trace": stringifiedTrace };
        };
        this.setIdentificationHeader = function (idString) {
            if (typeof idString != "string") {
                throw new JSLibraryError(null, "Identification header value must be a string.");
            }
            _this.setSessionHeaders({ "swch-client-application": idString });
        };
        this.removeSessionHeader = function () {
            var headerKeys = [];
            for (var _i = 0; _i < arguments.length; _i++) {
                headerKeys[_i] = arguments[_i];
            }
            if (!_this.sessionData.headers) {
                throw new JSLibraryError(null, "You have not set any header values.");
            }
            else {
                var self = _this;
                headerKeys.forEach(function (headerKey) {
                    if (!self.sessionData.headers.hasOwnProperty(headerKey)) {
                        throw new JSLibraryError(null, "Header value could not be found.");
                    }
                    delete self.sessionData.headers[headerKey];
                });
            }
        };
        this._makeSafeKeyHeader = function (safeKey) {
            return { 'cardholder-safe-key': safeKey };
        };
        this.sendRequest = function (path, method, requestBody, headersToAdd, cookiesEnforced) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            if (cookiesEnforced === void 0) { cookiesEnforced = true; }
            return __awaiter(_this, void 0, void 0, function () {
                var headers, authHeaders, cookieKeys, x, key, requestConfig, response, self_1, _a, err_1, _b;
                return __generator(this, function (_c) {
                    switch (_c.label) {
                        case 0:
                            headers = Object.assign({}, this.sessionData.headers, headersToAdd);
                            if (!this.sessionData.encryptionOn) return [3 /*break*/, 4];
                            if (!requestBody) return [3 /*break*/, 2];
                            return [4 /*yield*/, CardsavrCrypto.Encryption.encryptRequest(this.sessionData.sessionKey, requestBody)];
                        case 1:
                            requestBody = _c.sent();
                            _c.label = 2;
                        case 2: return [4 /*yield*/, CardsavrCrypto.Signing.signRequest(path, this.sessionData.appName, this.sessionData.sessionKey, requestBody)];
                        case 3:
                            authHeaders = _c.sent();
                            Object.assign(headers, authHeaders);
                            _c.label = 4;
                        case 4:
                            if (typeof window === "undefined" && cookiesEnforced) {
                                if (this.sessionData.cookies && Object.keys(this.sessionData.cookies).length > 0) {
                                    cookieKeys = Object.keys(this.sessionData.cookies);
                                    headers['cookie'] = '';
                                    for (x = 0; x < cookieKeys.length; x++) {
                                        key = cookieKeys[x];
                                        headers['cookie'] += (key + "=" + this.sessionData.cookies[key]);
                                    }
                                }
                                else {
                                    throw new JSLibraryError(null, "Couldn't find cookie. Can't send request.");
                                }
                            }
                            requestConfig = {
                                baseURL: this.sessionData.baseUrl,
                                url: path,
                                timeout: 10000,
                                headers: headers,
                                method: method,
                                data: requestBody,
                                withCredentials: true
                            };
                            // Trust the shared cardsavr cert
                            if (this.cardsavrCert) {
                                requestConfig.httpsAgent = new HTTPSAgent({ ca: this.cardsavrCert });
                            }
                            _c.label = 5;
                        case 5:
                            _c.trys.push([5, 8, , 12]);
                            return [4 /*yield*/, axios.request(requestConfig)];
                        case 6:
                            response = _c.sent();
                            if (response.headers["set-cookie"] && typeof window === "undefined") {
                                self_1 = this;
                                //iterate through set-cookie array and save cookies in sessionData.cookies
                                response.headers["set-cookie"].forEach(function (rawCookie) {
                                    //grab cookie key/value
                                    var cookiePart = rawCookie.split(';')[0];
                                    var arr = cookiePart.split('=');
                                    var cookieKey = arr[0];
                                    var cookieValue = arr[1];
                                    //set cookie in sessionData.cookies if it has a value
                                    if (cookieValue) {
                                        self_1.sessionData.cookies[cookieKey] = cookieValue;
                                    }
                                });
                            }
                            _a = response;
                            return [4 /*yield*/, CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, response.data)];
                        case 7:
                            _a.data = _c.sent();
                            return [2 /*return*/, new CardsavrSessionResponse(response.status, response.statusText, response.headers, response.data)];
                        case 8:
                            err_1 = _c.sent();
                            console.log(err_1);
                            if (!err_1.response) return [3 /*break*/, 10];
                            _b = err_1.response;
                            return [4 /*yield*/, CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, err_1.response.data)];
                        case 9:
                            _b.data = _c.sent();
                            throw new CardsavrSessionResponse(err_1.response.status, err_1.response.statusText, err_1.response.headers, err_1.response.data);
                        case 10: throw new Error(err_1.message);
                        case 11: return [3 /*break*/, 12];
                        case 12: return [2 /*return*/];
                    }
                });
            });
        };
        this.get = function (path, filter, headersToAdd, cookiesEnforced) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            if (cookiesEnforced === void 0) { cookiesEnforced = true; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            path = CardsavrSessionUtilities.formatPath(path, filter);
                            return [4 /*yield*/, this.sendRequest(path, 'GET', null, headersToAdd, cookiesEnforced)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.post = function (path, body, headersToAdd, cookiesEnforced) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            if (cookiesEnforced === void 0) { cookiesEnforced = true; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            path = CardsavrSessionUtilities.formatPath(path, null);
                            return [4 /*yield*/, this.sendRequest(path, 'POST', body, headersToAdd, cookiesEnforced)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.put = function (path, id, body, headersToAdd, cookiesEnforced) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            if (cookiesEnforced === void 0) { cookiesEnforced = true; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            path = CardsavrSessionUtilities.formatPath(path, id);
                            return [4 /*yield*/, this.sendRequest(path, 'PUT', body, headersToAdd, cookiesEnforced)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.delete = function (path, id, headersToAdd, cookiesEnforced) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            if (cookiesEnforced === void 0) { cookiesEnforced = true; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            path = CardsavrSessionUtilities.formatPath(path, id);
                            return [4 /*yield*/, this.sendRequest(path, 'DELETE', null, headersToAdd, cookiesEnforced)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this._startSession = function (headers) { return __awaiter(_this, void 0, void 0, function () {
            var startResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.sessionData.cookies = {};
                        return [4 /*yield*/, this.get('/session/start', null, headers, false)];
                    case 1:
                        startResponse = _a.sent();
                        this.sessionData.encryptionOn = startResponse.body.encryptionOn;
                        return [2 /*return*/, startResponse];
                }
            });
        }); };
        this._login = function (sessionSalt, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var encryptedLoginBody, keyPair, clientPublicKey, passwordKey, _a, _b, loginResponse, _c, unencryptedLoginBody;
                return __generator(this, function (_d) {
                    switch (_d.label) {
                        case 0:
                            if (!this.sessionData.encryptionOn) return [3 /*break*/, 9];
                            return [4 /*yield*/, CardsavrCrypto.Keys.makeECDHkeyPair()];
                        case 1:
                            keyPair = _d.sent();
                            return [4 /*yield*/, CardsavrCrypto.Keys.makeECDHPublicKey(keyPair)];
                        case 2:
                            clientPublicKey = _d.sent();
                            encryptedLoginBody = { userName: this.sessionData.userName, clientPublicKey: clientPublicKey };
                            if (!this.sessionData.userAuthenticator.hasOwnProperty('password')) return [3 /*break*/, 5];
                            return [4 /*yield*/, CardsavrCrypto.Keys.generatePasswordKey(this.sessionData.userName, this.sessionData.userAuthenticator.password)];
                        case 3:
                            passwordKey = _d.sent();
                            _a = encryptedLoginBody;
                            _b = 'signedSalt';
                            return [4 /*yield*/, CardsavrCrypto.Signing.signSaltWithPasswordKey(sessionSalt, passwordKey)];
                        case 4:
                            _a[_b] = _d.sent();
                            return [3 /*break*/, 6];
                        case 5:
                            encryptedLoginBody['userCredentialGrant'] = this.sessionData.userAuthenticator.userCredentialGrant;
                            _d.label = 6;
                        case 6: return [4 /*yield*/, this.sendRequest('/session/login', 'post', encryptedLoginBody, headersToAdd)];
                        case 7:
                            loginResponse = _d.sent();
                            _c = this.sessionData;
                            return [4 /*yield*/, CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.serverPublicKey, keyPair)];
                        case 8:
                            _c.sessionKey = _d.sent();
                            return [2 /*return*/, loginResponse];
                        case 9:
                            unencryptedLoginBody = { userName: this.sessionData.userName };
                            if (this.sessionData.userAuthenticator.hasOwnProperty('password')) {
                                unencryptedLoginBody.password = this.sessionData.userAuthenticator.password;
                            }
                            else {
                                unencryptedLoginBody.userCredentialGrant = this.sessionData.userAuthenticator.userCredentialGrant;
                            }
                            _d.label = 10;
                        case 10: return [2 /*return*/];
                    }
                });
            });
        };
        this.init = function (headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var startResponse;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this._startSession(headersToAdd)];
                        case 1:
                            startResponse = _a.sent();
                            return [4 /*yield*/, this._login(startResponse.body.sessionSalt, headersToAdd)];
                        case 2: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getAccounts = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get("/cardsavr_accounts", filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createAccount = function (body, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.post("/cardsavr_accounts", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updateAccount = function (id, body, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.put("/cardsavr_accounts", id, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.deleteAccount = function (id, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.delete("/cardsavr_accounts", id, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getAddresses = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/cardsavr_addresses', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createAddress = function (body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.post("/cardsavr_addresses", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updateAddress = function (id, body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.put("/cardsavr_addresses", id, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.deleteAddress = function (id, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.delete("/cardsavr_addresses", id, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getBins = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/cardsavr_bins', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createBin = function (body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.post("/cardsavr_bins", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updateBin = function (id, body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.put("/cardsavr_bins", id, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.deleteBin = function (id, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.delete("/cardsavr_bins", id, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getCards = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/cardsavr_cards', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createCard = function (body, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.post("/cardsavr_cards", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updateCard = function (id, body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.put("/cardsavr_cards", id, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.deleteCard = function (id, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.delete("/cardsavr_cards", id, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getCardPlacementResults = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/card_placement_results', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getIntegrators = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get("/integrators", filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createIntegrator = function (body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.post("/integrators", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updateIntegrator = function (id, body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.put("/integrators", id, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.deleteIntegrator = function (id, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.delete("/integrators", id, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getMerchantSites = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/sites', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.registerForJobStatusUpdates = function (jobId, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.post("/messages/place_card_on_single_site_jobs/" + jobId + "/vbs_status_updates/registrations", { job_id: jobId }, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getJobStatusUpdate = function (jobId, cardsavrMessagingAccessKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            headersToAdd = Object.assign({ 'cardsavr-messaging-access-key': cardsavrMessagingAccessKey }, headersToAdd);
                            return [4 /*yield*/, this.get("/messages/place_card_on_single_site_jobs/" + jobId + "/vbs_status_updates", null, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getJobInformationRequest = function (jobId, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get("/messages/place_card_on_single_site_jobs/" + jobId + "/vbs_requests", null, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.sendJobInformation = function (jobId, envelope_id, type, message, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                var body;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            body = { envelope_id: envelope_id, type: type, message: message };
                            return [4 /*yield*/, this.post("/messages/place_card_on_single_site_jobs/" + jobId + "/client_responses", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getUsers = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/cardsavr_users', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getCredentialGrant = function (id, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get("/cardsavr_users/" + id + "/credential_grant/", null, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createUser = function (body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.post("/cardsavr_users", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updateUser = function (id, body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.put("/cardsavr_users", id, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.updatePassword = function (id, body, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.put("/cardsavr_users/" + id + "/update_password", null, body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.deleteUser = function (id, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.delete("/cardsavr_users", id, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getMultipleSitesJobs = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get('/place_card_on_multiple_sites_jobs', filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createMultipleSitesJob = function (body, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.post("/place_card_on_multiple_sites_jobs", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.getSingleSiteJobs = function (filter, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, this.get("/place_card_on_single_site_jobs", filter, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.createSingleSiteJob = function (body, safeKey, headersToAdd) {
            if (headersToAdd === void 0) { headersToAdd = {}; }
            return __awaiter(_this, void 0, void 0, function () {
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
                            return [4 /*yield*/, this.post("/place_card_on_single_site_jobs", body, headersToAdd)];
                        case 1: return [2 /*return*/, _a.sent()];
                    }
                });
            });
        };
        this.cardsavrCert = cardsavrCert;
        if (!password && !userCredentialGrant) {
            throw new JSLibraryError(null, "Must include either password or user credential grant to initialize session.");
        }
        var userAuthenticator = password ? { password: password } : { userCredentialGrant: userCredentialGrant };
        this.sessionData = { baseUrl: baseUrl, sessionKey: sessionKey, appName: appName, userName: userName, userAuthenticator: userAuthenticator, cookies: null, encryptionOn: true, headers: {} };
    }
    return CardsavrSession;
}());
export { CardsavrSession };
;
//# sourceMappingURL=CardsavrJSLibrary-2.0.js.map