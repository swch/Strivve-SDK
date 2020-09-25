"use strict";

import JSLibraryError from "./JSLibraryError";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import * as CardsavrSessionUtilities from "./CardsavrSessionUtilities";
import * as CardsavrCrypto from "./CardsavrSessionCrypto";
import {
    Agent as HTTPSAgent
} from "https";
import axios, {
    AxiosRequestConfig
} from "axios";

export class CardsavrSession {

    _sessionData: { [key: string]: string; };
    _headers: { [key: string]: string; };
    _cardsavrCert : string | undefined;
    _baseUrl : string;
    _appName : string;
    _debug : boolean;

    constructor(baseUrl: string, sessionKey: string, appName: string, cardsavrCert ? : string) {

        this._headers = {}; 
        this._cardsavrCert = cardsavrCert;
        this._baseUrl = baseUrl;
        this._appName = appName;
        this._debug = false;

        this._sessionData = {};

        this._sessionData.sessionKey = sessionKey; 
        this.setSessionToken("null");

        this.setSessionHeaders({
            "client-application" : appName,
        });
    }

    setSessionHeaders = (headersObject: {
            [key: string]: string;
        }) : void => { 
        Object.assign(this._headers, headersObject);
    };

    removeSessionHeader = (...headerKeys: string[]) : void => {

        if (!this._headers) {
            throw new JSLibraryError(null, "You have not set any header values.");
        } else {
            headerKeys.map(headerKey => {
                if (!Object.prototype.hasOwnProperty.call(this._headers, headerKey)) {
                    throw new JSLibraryError(null, "Header value could not be found.");
                }
                delete this._headers[headerKey];
            });
        }
    };

    private _makeSafeKeyHeader = (safeKey: string, newKey = false): {[key: string]: string} => {
        return newKey ? {
            "new-cardholder-safe-key" : safeKey
        } : {
            "cardholder-safe-key" : safeKey
        };
    };

    getSerializedSessionData = () : string => {
        return JSON.stringify(this._sessionData);
    }

    deserializeSessionData = (json: string) : void => {
        this._sessionData = JSON.parse(json);
        this.setSessionHeaders({
            "x-cardsavr-session-jwt" : this._sessionData.sessionToken
        });
    }

    private setSessionToken = (key: string): void  => {
        this._sessionData.sessionToken = key;
        this.setSessionHeaders({
            "x-cardsavr-session-jwt" : key
        });
    }

    sendRequest = async(path: string, method: "get" | "GET" | "delete" | "DELETE" | "head" | "HEAD" | "options" | "OPTIONS" | "post" | "POST" | "put" | "PUT" | "patch" | "PATCH" | undefined, requestBody ? : any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        const headers = Object.assign({}, this._headers, headersToAdd);
        const unencryptedBody = requestBody;
        const sessionKey = this._sessionData.sessionKey;

        // Encrypt the cardholder-safe-header(s) if they are in this request
        CardsavrCrypto.Encryption.encryptSafeKeys(headers, sessionKey);
        if (requestBody) {
            requestBody = await CardsavrCrypto.Encryption.encryptRequest(sessionKey, requestBody);
        }
        const authHeaders = await CardsavrCrypto.Signing.signRequest(path, this._appName, sessionKey, requestBody);
        Object.assign(headers, authHeaders);

        if (this._debug) {
            console.log(method + " " + path);
            console.log(headers);
            if (requestBody) {
                console.log(unencryptedBody);
            }
        }

        const requestConfig: AxiosRequestConfig = {
            /*
            httpsAgent : new HTTPSAgent({
              rejectUnauthorized : false
            }),
            */
            baseURL : this._baseUrl,
            url : path,
            timeout : 10000,
            headers,
            method,
            data : requestBody,
            withCredentials : true
        };

        // Trust the shared cardsavr cert
        if (this._cardsavrCert) {
            requestConfig.httpsAgent = new HTTPSAgent({
                ca : this._cardsavrCert
            });
        }

        try {
            const response = await axios.request(requestConfig);
            response.data = await CardsavrCrypto.Encryption.decryptResponse(sessionKey, response.data);
            return new CardsavrSessionResponse(response.status, response.statusText, response.headers, response.data, path);
        } catch (err) {
            if (err.response) {
                err.response.data = await CardsavrCrypto.Encryption.decryptResponse(sessionKey, err.response.data);
                throw new CardsavrSessionResponse(err.response.status, err.response.statusText, err.response.headers, err.response.data, path);
            } else {
                throw new Error(err.message);
            }
        }
    };

    get = async(path: string, filter: any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, filter);

        return await this.sendRequest(path, "GET", null, headersToAdd, cookiesEnforced);
    };

    post = async(path: string, body: any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, null);

        return await this.sendRequest(path, "POST", body, headersToAdd, cookiesEnforced);
    };

    put = async(path: string, id: any, body: any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, id);

        return await this.sendRequest(path, "PUT", body, headersToAdd, cookiesEnforced);
    };

    delete = async(path: string, id: number, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, id);

        return await this.sendRequest(path, "DELETE", null, headersToAdd, cookiesEnforced);
    };

    private _startSession = async(): Promise < any > => {

        //if the user doesn't supply a trace (likely) or doesn't supply a trace key, just use the username
        const startResponse = await this.get("/session/start", null, {}, false);
        this.setSessionToken(startResponse.body.sessionToken);
        return startResponse;
    };

    private _login = async(sessionSalt: string, username: string, password? : string, grant? : string): Promise <unknown> => {

        interface EncryptedLoginBody {
            signedSalt ? : string,
            userCredentialGrant ? : string,
            clientPublicKey: string,
            userName: string
        }

        const keyPair = await CardsavrCrypto.Keys.makeECDHkeyPair();
        const clientPublicKey = await CardsavrCrypto.Keys.makeECDHPublicKey(keyPair);

        const encryptedLoginBody : EncryptedLoginBody = {
            userName : username,
            clientPublicKey : clientPublicKey
        };

        if (password) {
            const passwordKey = await CardsavrCrypto.Keys.generatePasswordKey(username, password);
            encryptedLoginBody["signedSalt"] = await CardsavrCrypto.Signing.signSaltWithPasswordKey(sessionSalt, passwordKey);
        } else if (grant) {
            encryptedLoginBody["userCredentialGrant"] = grant;
        } else {
            throw new JSLibraryError(null, "Must include either password or user credential grant to initialize session.");
        }

        const loginResponse = await this.sendRequest("/session/login", "post", encryptedLoginBody);
        this._sessionData.sessionKey = await CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.serverPublicKey, keyPair);
        return loginResponse;
    };

    setTrace = (username: string, trace?: {[k: string]: unknown}) : void => {
        if (!trace) 
            trace = {};
        if (trace instanceof Object && !trace.key)
            trace.key = username;
        this.setSessionHeaders({ "trace" : JSON.stringify(trace) });
    }

    init = async(username : string, password ? : string, grant ? : string, trace ? : {[k: string]: unknown}): Promise < any > => {
        this.setTrace(username, trace);
        const startResponse = await this._startSession();
        return await this._login(startResponse.body.sessionSalt, username, password, grant);
    };

    end = async(): Promise < any > => {

        return await this.get("/session/end", null);
    };

    refresh = async(): Promise < any > => {

        return await this.get("/session/refresh", null);
    };

    getAccounts = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/cardsavr_accounts", filter, headersToAdd);
    };

    createAccount = async(body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {

        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/cardsavr_accounts", body, headersToAdd);
    };

    updateAccount = async(id: number, body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {

        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.put("/cardsavr_accounts", id, body, headersToAdd);
    };

    deleteAccount = async(id: number, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.delete("/cardsavr_accounts", id, headersToAdd);
    };

    getAddresses = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/cardsavr_addresses", filter, headersToAdd);
    };

    createAddress = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post("/cardsavr_addresses", body, headersToAdd);
    };

    updateAddress = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put("/cardsavr_addresses", id, body, headersToAdd);
    };

    deleteAddress = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/cardsavr_addresses", id, headersToAdd);
    };

    getFinancialInstitutions = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/financial_institutions", filter, headersToAdd);
    };

    createFinancialInstitution = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post("/financial_institutions", body, headersToAdd);
    };

    updateFinancialInstitution = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put("/financial_institutions", id, body, headersToAdd);
    };

    deleteFinancialInstitution = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/financial_institutions", id, headersToAdd);
    };

    getCards = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/cardsavr_cards", filter, headersToAdd);
    };

    createCard = async(body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/cardsavr_cards", body, headersToAdd);
    };

    updateCard = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put("/cardsavr_cards", id, body, headersToAdd);
    };

    deleteCard = async(id: number, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.delete("/cardsavr_cards", id, headersToAdd);
    };

    getCardPlacementResults = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/card_placement_results", filter, headersToAdd);
    };

    getIntegrators = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/integrators", filter, headersToAdd);
    };

    createIntegrator = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post("/integrators", body, headersToAdd);
    };

    updateIntegrator = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put("/integrators", id, body, headersToAdd);
    };

    deleteIntegrator = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/integrators", id, headersToAdd);
    };

    getSites = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        return this.getMerchantSites(filter, pagingHeader, headersToAdd);
    };

    getMerchantSites = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/merchant_sites", filter, headersToAdd);
    }

    registerForJobStatusUpdates = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/broadcasts/registrations`, {
            job_id : jobId
        }, headersToAdd);
    };

    getJobStatusUpdate = async(jobId: number, cardsavrMessagingAccessKey: string, headersToAdd = {}): Promise < any > => {

        headersToAdd = Object.assign({
            "cardsavr-messaging-access-key" : cardsavrMessagingAccessKey
        }, headersToAdd);
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/broadcasts`, null, headersToAdd);
    };

    getJobInformationRequest = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/credential_requests`, null, headersToAdd);
    };

    sendJobInformation = async(jobId: number, envelope_id: string, type: string, message: string, headersToAdd = {}): Promise < any > => {
        const body = {
            envelope_id,
            type,
            message
        };
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/credential_responses`, body, headersToAdd);
    };

    getUsers = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/cardsavr_users", filter, headersToAdd);
    };

    getCredentialGrant = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.get(`/cardsavr_users/${id}/credential_grant/`, null, headersToAdd);
    };

    createUser = async(body: any, newSafeKey: string, financial_institution = "default", headersToAdd = {}): Promise < any > => {

        if (body && body.role == "cardholder" && !body.username) {
            body.username = CardsavrSessionUtilities.generateUniqueUsername();
        }
        Object.assign(headersToAdd, this._makeSafeKeyHeader(newSafeKey, true));
        Object.assign(headersToAdd, {
            "financial-institution" : financial_institution
        });
        return await this.post("/cardsavr_users", body, headersToAdd);
    };

    updateUser = async(id: number, body: any, newSafeKey: string | null = null, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (newSafeKey != null) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(newSafeKey, true));
        }
        if (safeKey != null) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey, false));
        }
        return await this.put("/cardsavr_users", id, body, headersToAdd);
    };

    updatePassword = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/cardsavr_users/${id}/update_password`, null, body, headersToAdd);
    };

    deleteUser = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/cardsavr_users", id, headersToAdd);
    };

    getMultipleSitesJobs = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/place_card_on_multiple_sites_jobs", filter, headersToAdd);
    };

    createMultipleSitesJob = async(body: any, safeKey: string, headersToAdd = {}): Promise < any > => {
        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.post("/place_card_on_multiple_sites_jobs", body, headersToAdd);
    };

    getSingleSiteJobs = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging : JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get("/place_card_on_single_site_jobs", filter, headersToAdd);
    };

    createSingleSiteJob = async(body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/place_card_on_single_site_jobs", body, headersToAdd);
    };

    updateSingleSiteJob = async(id: number, body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {

        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.put("/place_card_on_single_site_jobs", id, body, headersToAdd);
    };

}