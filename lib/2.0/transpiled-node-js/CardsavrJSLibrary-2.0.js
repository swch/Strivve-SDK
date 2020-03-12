"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const JSLibraryError_1 = require("./JSLibraryError");
const CardsavrSessionResponse_1 = require("./CardsavrSessionResponse");
const CardsavrSessionUtilities = require("./CardsavrSessionUtilities");
const CardsavrCrypto = require("./CardsavrSessionCrypto");
const https_1 = require("https");
const axios_1 = require("axios");
class CardsavrSession {
    constructor(baseUrl, sessionKey, appName, userName, password, userCredentialGrant, cardsavrCert) {
        this.setSessionHeaders = (headersObject) => {
            Object.assign(this.sessionData.headers, headersObject);
        };
        this.makeTraceHeader = (traceHeaderObject) => {
            let stringifiedTrace = JSON.stringify(traceHeaderObject);
            return { "swch-persistent-trace": stringifiedTrace };
        };
        this.setIdentificationHeader = (idString) => {
            if (typeof idString != "string") {
                throw new JSLibraryError_1.default(null, "Identification header value must be a string.");
            }
            this.setSessionHeaders({ "swch-client-application": idString });
        };
        this.removeSessionHeader = (...headerKeys) => {
            if (!this.sessionData.headers) {
                throw new JSLibraryError_1.default(null, "You have not set any header values.");
            }
            else {
                var self = this;
                headerKeys.forEach(function (headerKey) {
                    if (!self.sessionData.headers.hasOwnProperty(headerKey)) {
                        throw new JSLibraryError_1.default(null, "Header value could not be found.");
                    }
                    delete self.sessionData.headers[headerKey];
                });
            }
        };
        this._makeSafeKeyHeader = (safeKey) => {
            return { 'cardholder-safe-key': safeKey };
        };
        this.sendRequest = async (path, method, requestBody, headersToAdd = {}, cookiesEnforced = true) => {
            var headers = Object.assign({}, this.sessionData.headers, headersToAdd);
            if (this.sessionData.encryptionOn) {
                if (requestBody) {
                    requestBody = await CardsavrCrypto.Encryption.encryptRequest(this.sessionData.sessionKey, requestBody);
                }
                let authHeaders = await CardsavrCrypto.Signing.signRequest(path, this.sessionData.appName, this.sessionData.sessionKey, requestBody);
                Object.assign(headers, authHeaders);
            }
            if (typeof window === "undefined" && cookiesEnforced) {
                if (this.sessionData.cookies && Object.keys(this.sessionData.cookies).length > 0) {
                    //if there are cookies stored, sends them all in cookie header 
                    var cookieKeys = Object.keys(this.sessionData.cookies);
                    headers['cookie'] = '';
                    for (var x = 0; x < cookieKeys.length; x++) {
                        var key = cookieKeys[x];
                        headers['cookie'] += (key + "=" + this.sessionData.cookies[key]);
                    }
                }
                else {
                    throw new JSLibraryError_1.default(null, "Couldn't find cookie. Can't send request.");
                }
            }
            var requestConfig = {
                baseURL: this.sessionData.baseUrl,
                url: path,
                timeout: 10000,
                headers,
                method,
                data: requestBody,
                withCredentials: true
            };
            // Trust the shared cardsavr cert
            if (this.cardsavrCert) {
                requestConfig.httpsAgent = new https_1.Agent({ ca: this.cardsavrCert });
            }
            try {
                var response = await axios_1.default.request(requestConfig);
                if (response.headers["set-cookie"] && typeof window === "undefined") {
                    let self = this;
                    //iterate through set-cookie array and save cookies in sessionData.cookies
                    response.headers["set-cookie"].forEach(function (rawCookie) {
                        //grab cookie key/value
                        let cookiePart = rawCookie.split(';')[0];
                        let arr = cookiePart.split('=');
                        let cookieKey = arr[0];
                        let cookieValue = arr[1];
                        //set cookie in sessionData.cookies if it has a value
                        if (cookieValue) {
                            self.sessionData.cookies[cookieKey] = cookieValue;
                        }
                    });
                }
                response.data = await CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, response.data);
                return new CardsavrSessionResponse_1.default(response.status, response.statusText, response.headers, response.data);
            }
            catch (err) {
                console.log(err);
                if (err.response) {
                    err.response.data = await CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, err.response.data);
                    throw new CardsavrSessionResponse_1.default(err.response.status, err.response.statusText, err.response.headers, err.response.data);
                }
                else {
                    throw new Error(err.message);
                }
            }
        };
        this.get = async (path, filter, headersToAdd = {}, cookiesEnforced = true) => {
            path = CardsavrSessionUtilities.formatPath(path, filter);
            return await this.sendRequest(path, 'GET', null, headersToAdd, cookiesEnforced);
        };
        this.post = async (path, body, headersToAdd = {}, cookiesEnforced = true) => {
            path = CardsavrSessionUtilities.formatPath(path, null);
            return await this.sendRequest(path, 'POST', body, headersToAdd, cookiesEnforced);
        };
        this.put = async (path, id, body, headersToAdd = {}, cookiesEnforced = true) => {
            path = CardsavrSessionUtilities.formatPath(path, id);
            return await this.sendRequest(path, 'PUT', body, headersToAdd, cookiesEnforced);
        };
        this.delete = async (path, id, headersToAdd = {}, cookiesEnforced = true) => {
            path = CardsavrSessionUtilities.formatPath(path, id);
            return await this.sendRequest(path, 'DELETE', null, headersToAdd, cookiesEnforced);
        };
        this._startSession = async (headers) => {
            this.sessionData.cookies = {};
            let startResponse = await this.get('/session/start', null, headers, false);
            this.sessionData.encryptionOn = startResponse.body.encryptionOn;
            return startResponse;
        };
        this._login = async (sessionSalt, headersToAdd = {}) => {
            if (this.sessionData.encryptionOn) {
                var encryptedLoginBody;
                var keyPair = await CardsavrCrypto.Keys.makeECDHkeyPair();
                var clientPublicKey = await CardsavrCrypto.Keys.makeECDHPublicKey(keyPair);
                encryptedLoginBody = { userName: this.sessionData.userName, clientPublicKey };
                if (this.sessionData.userAuthenticator.hasOwnProperty('password')) {
                    var passwordKey = await CardsavrCrypto.Keys.generatePasswordKey(this.sessionData.userName, this.sessionData.userAuthenticator.password);
                    encryptedLoginBody['signedSalt'] = await CardsavrCrypto.Signing.signSaltWithPasswordKey(sessionSalt, passwordKey);
                }
                else {
                    encryptedLoginBody['userCredentialGrant'] = this.sessionData.userAuthenticator.userCredentialGrant;
                }
                let loginResponse = await this.sendRequest('/session/login', 'post', encryptedLoginBody, headersToAdd);
                this.sessionData.sessionKey = await CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.serverPublicKey, keyPair);
                return loginResponse;
            }
            else {
                var unencryptedLoginBody;
                unencryptedLoginBody = { userName: this.sessionData.userName };
                if (this.sessionData.userAuthenticator.hasOwnProperty('password')) {
                    unencryptedLoginBody.password = this.sessionData.userAuthenticator.password;
                }
                else {
                    unencryptedLoginBody.userCredentialGrant = this.sessionData.userAuthenticator.userCredentialGrant;
                }
            }
        };
        this.init = async (headersToAdd = {}) => {
            let startResponse = await this._startSession(headersToAdd);
            return await this._login(startResponse.body.sessionSalt, headersToAdd);
        };
        this.getAccounts = async (filter, headersToAdd = {}) => {
            return await this.get(`/cardsavr_accounts`, filter, headersToAdd);
        };
        this.createAccount = async (body, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.post(`/cardsavr_accounts`, body, headersToAdd);
        };
        this.updateAccount = async (id, body, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.put(`/cardsavr_accounts`, id, body, headersToAdd);
        };
        this.deleteAccount = async (id, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.delete(`/cardsavr_accounts`, id, headersToAdd);
        };
        this.getAddresses = async (filter, headersToAdd = {}) => {
            return await this.get('/cardsavr_addresses', filter, headersToAdd);
        };
        this.createAddress = async (body, headersToAdd = {}) => {
            return await this.post(`/cardsavr_addresses`, body, headersToAdd);
        };
        this.updateAddress = async (id, body, headersToAdd = {}) => {
            return await this.put(`/cardsavr_addresses`, id, body, headersToAdd);
        };
        this.deleteAddress = async (id, headersToAdd = {}) => {
            return await this.delete(`/cardsavr_addresses`, id, headersToAdd);
        };
        this.getBins = async (filter, headersToAdd = {}) => {
            return await this.get('/cardsavr_bins', filter, headersToAdd);
        };
        this.createBin = async (body, headersToAdd = {}) => {
            return await this.post(`/cardsavr_bins`, body, headersToAdd);
        };
        this.updateBin = async (id, body, headersToAdd = {}) => {
            return await this.put(`/cardsavr_bins`, id, body, headersToAdd);
        };
        this.deleteBin = async (id, headersToAdd = {}) => {
            return await this.delete(`/cardsavr_bins`, id, headersToAdd);
        };
        this.getCards = async (filter, headersToAdd = {}) => {
            return await this.get('/cardsavr_cards', filter, headersToAdd);
        };
        this.createCard = async (body, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.post(`/cardsavr_cards`, body, headersToAdd);
        };
        this.updateCard = async (id, body, headersToAdd = {}) => {
            return await this.put(`/cardsavr_cards`, id, body, headersToAdd);
        };
        this.deleteCard = async (id, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.delete(`/cardsavr_cards`, id, headersToAdd);
        };
        this.getCardPlacementResults = async (filter, headersToAdd = {}) => {
            return await this.get('/card_placement_results', filter, headersToAdd);
        };
        this.getIntegrators = async (filter, headersToAdd = {}) => {
            return await this.get(`/integrators`, filter, headersToAdd);
        };
        this.createIntegrator = async (body, headersToAdd = {}) => {
            return await this.post(`/integrators`, body, headersToAdd);
        };
        this.updateIntegrator = async (id, body, headersToAdd = {}) => {
            return await this.put(`/integrators`, id, body, headersToAdd);
        };
        this.deleteIntegrator = async (id, headersToAdd = {}) => {
            return await this.delete(`/integrators`, id, headersToAdd);
        };
        this.getMerchantSites = async (filter, headersToAdd = {}) => {
            return await this.get('/sites', filter, headersToAdd);
        };
        this.registerForJobStatusUpdates = async (jobId, headersToAdd = {}) => {
            return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/vbs_status_updates/registrations`, { job_id: jobId }, headersToAdd);
        };
        this.getJobStatusUpdate = async (jobId, cardsavrMessagingAccessKey, headersToAdd = {}) => {
            headersToAdd = Object.assign({ 'cardsavr-messaging-access-key': cardsavrMessagingAccessKey }, headersToAdd);
            return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/vbs_status_updates`, null, headersToAdd);
        };
        this.getJobInformationRequest = async (jobId, headersToAdd = {}) => {
            return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/vbs_requests`, null, headersToAdd);
        };
        this.sendJobInformation = async (jobId, envelope_id, type, message, headersToAdd = {}) => {
            let body = { envelope_id, type, message };
            return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/client_responses`, body, headersToAdd);
        };
        this.getUsers = async (filter, headersToAdd = {}) => {
            return await this.get('/cardsavr_users', filter, headersToAdd);
        };
        this.getCredentialGrant = async (id, headersToAdd = {}) => {
            return await this.get(`/cardsavr_users/${id}/credential_grant/`, null, headersToAdd);
        };
        this.createUser = async (body, headersToAdd = {}) => {
            return await this.post(`/cardsavr_users`, body, headersToAdd);
        };
        this.updateUser = async (id, body, headersToAdd = {}) => {
            return await this.put(`/cardsavr_users`, id, body, headersToAdd);
        };
        this.updatePassword = async (id, body, headersToAdd = {}) => {
            return await this.put(`/cardsavr_users/${id}/update_password`, null, body, headersToAdd);
        };
        this.deleteUser = async (id, headersToAdd = {}) => {
            return await this.delete(`/cardsavr_users`, id, headersToAdd);
        };
        this.getMultipleSitesJobs = async (filter, headersToAdd = {}) => {
            return await this.get('/place_card_on_multiple_sites_jobs', filter, headersToAdd);
        };
        this.createMultipleSitesJob = async (body, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.post(`/place_card_on_multiple_sites_jobs`, body, headersToAdd);
        };
        this.getSingleSiteJobs = async (filter, headersToAdd = {}) => {
            return await this.get(`/place_card_on_single_site_jobs`, filter, headersToAdd);
        };
        this.createSingleSiteJob = async (body, safeKey, headersToAdd = {}) => {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
            return await this.post(`/place_card_on_single_site_jobs`, body, headersToAdd);
        };
        this.cardsavrCert = cardsavrCert;
        if (!password && !userCredentialGrant) {
            throw new JSLibraryError_1.default(null, "Must include either password or user credential grant to initialize session.");
        }
        var userAuthenticator = password ? { password } : { userCredentialGrant };
        this.sessionData = { baseUrl, sessionKey, appName, userName, userAuthenticator, cookies: null, encryptionOn: true, headers: {} };
    }
}
exports.CardsavrSession = CardsavrSession;
;
//# sourceMappingURL=CardsavrJSLibrary-2.0.js.map