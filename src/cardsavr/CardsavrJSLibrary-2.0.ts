"use strict";

import CardsavrSDKError from "./CardsavrSDKError";
import CardsavrRestError from "./CardsavrRestError";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import { formatPath, APIFilter, generateUniqueUsername }  from "./CardsavrSessionUtilities";
import * as CardsavrCrypto from "./CardsavrSessionCrypto";
import {version} from "../../package.json";
//import { Agent, ProxyAgent } from 'undici';
import fetch from "node-fetch";
import { Agent as HTTPSAgent } from "https";
import { HttpsProxyAgent } from "https-proxy-agent";

type http_method =
    "get" | "GET" | "delete" | "DELETE" | "head" | "HEAD" | "options" | "OPTIONS" | "post" | "POST" | "put" | "PUT" | "patch" | "PATCH"

export type paging_key =
    "page" | "page_length" | "sort" | "is_descending" | "total_results";

export type paging_header = { [key in paging_key]?: string | number | boolean }

interface session_data {
    sessionToken? : string,
    sessionKey : string,
    userId : number
}

export class CardsavrSession {

    _sessionData: session_data;
    _headers: { [key: string]: string; };
    _cardsavrCert : string | undefined;
    _baseUrl : string;
    _appName : string;
    _debug : boolean;
    _rejectUnauthorized : boolean;
    _proxy : string | undefined;

    constructor(baseUrl: string, sessionKey: string, appName: string, rejectUnauthorized = true, cardsavrCert? : string, proxy? : string, debug = false) {

        this._headers = {}; 
        this._cardsavrCert = cardsavrCert;
        this._baseUrl = baseUrl;
        this._appName = appName;
        this._debug = debug;
        this._rejectUnauthorized = rejectUnauthorized;
        this._proxy = proxy;

        if (this._proxy && this._cardsavrCert) {
            throw new CardsavrSDKError(["Shouldn't be providing explicit certificate with proxy configuration."]);
        }

        this._sessionData = { sessionKey, sessionToken : "", userId : -1 }; 
        this.setSessionToken("null");

        this.setSessionHeaders({
            "x-cardsavr-client-application" : `${appName} - Strivve SDK v${version}`,
        });
    }

    setSessionHeaders = (headersObject: {
            [key: string]: string;
        }) : void => { 
        Object.assign(this._headers, headersObject);
    };

    removeSessionHeader = (...headerKeys: string[]) : void => {

        if (!this._headers) {
            throw new CardsavrSDKError([], "You have not set any header values.");
        } else {
            headerKeys.forEach(headerKey => {
                if (!Object.prototype.hasOwnProperty.call(this._headers, headerKey)) {
                    throw new CardsavrSDKError([], "Header value could not be found.");
                }
                delete this._headers[headerKey];
            });
        }
    };

    private _makeSafeKeyHeader = (safeKey: string, newKey = false): {[key: string]: string} => {
        return newKey ? {
            "x-cardsavr-new-cardholder-safe-key" : safeKey
        } : {
            "x-cardsavr-cardholder-safe-key" : safeKey
        };
    };

    getSessionUserId() : number | undefined {
        return +this._sessionData?.userId;
    }

    getSerializedSessionData = () : string => {
        return JSON.stringify(this._sessionData);
    };

    deserializeSessionData = (json: string) : void => {
        if (json && this._sessionData.sessionToken) {
            this._sessionData = JSON.parse(json);
            this.setSessionHeaders({
                "x-cardsavr-session-jwt" : this._sessionData.sessionToken as string
            });
        }
    };

    private setSessionToken = (key: string): void  => {
        if (key) {
            this._sessionData.sessionToken = key;
            this.setSessionHeaders({
                "x-cardsavr-session-jwt" : key
            });
        }
    };

    sendRequest = async(path: string, method: http_method, requestBody ? : { [key: string] : unknown }, headersToAdd : { [key: string] : string } = {}): Promise < any > => {

        const headers = Object.assign({}, this._headers, headersToAdd);
        const unencryptedBody = requestBody;

        if (!this._sessionData.sessionKey) {
            throw new CardsavrSDKError(["Can't send request with a terminated session."]); 
        }

        const sessionKey = this._sessionData.sessionKey;

        // Encrypt the cardholder-safe-header(s) if they are in this request
        CardsavrCrypto.Encryption.encryptSafeKeys(headers, sessionKey);
        if (requestBody) {
            requestBody = await CardsavrCrypto.Encryption.encryptRequest(sessionKey, requestBody);
            headers["content-type"] = "application/json";
        }
        const authHeaders = await CardsavrCrypto.Signing.signRequest(path, this._appName, sessionKey, requestBody);
        Object.assign(headers, authHeaders);

        if (this._debug) {
            console.log("REQUEST " + method + " " + path);
            console.log(headers);
            if (requestBody) {
                console.log(unencryptedBody);
            }
        }

        let config = {
            headers,
            method : method as unknown as string,
            body : requestBody ? JSON.stringify(requestBody) : undefined
        };
        let response : any;
        if (typeof window === "undefined") {
            //node
            const agent = (this._proxy) ?
                new HttpsProxyAgent(this._proxy) :
                new HTTPSAgent({
                    rejectUnauthorized : this._rejectUnauthorized,
                    ...(this._cardsavrCert && {ca : this._cardsavrCert})});
                config = Object.assign(config, {
                    agent,
                    timeout : 10000
                });
            /*
            const agent_config = { 
                connectTimeout : 10000,
                connect : {
                    rejectUnauthorized : this._rejectUnauthorized,
                    ...(this._cardsavrCert && {ca : this._cardsavrCert})
                }};

            const dispatcher = this._proxy ?  
                new ProxyAgent({ uri : this._proxy, ...agent_config}) :
                new Agent(agent_config);

            const config = { 
                    dispatcher,
                    ...config
                } as any;

            */
            response = await fetch(new URL(path, this._baseUrl).toString(), config);
        } else {
            response = await window.fetch(new URL(path, this._baseUrl).toString(), config);
        }

        const body = response.headers.get("content-type")?.startsWith("application/json") ? (await response.json()) : null;

        if (response.status <= 400 && response.headers.get("x-cardsavr-authorization")) {
            const response_headers : {[k: string]: string} = {};
            response_headers["x-cardsavr-authorization"] = response.headers.get("x-cardsavr-authorization");
            response_headers["x-cardsavr-nonce"] = response.headers.get("x-cardsavr-nonce");
            response_headers["x-cardsavr-signature"] = response.headers.get("x-cardsavr-signature");           
            await CardsavrCrypto.Signing.verifySignature(response_headers, path, this._appName, [sessionKey], body);
        }

        const csr = new CardsavrSessionResponse(
            response.status, 
            response.statusText, 
            response.headers, 
            await CardsavrCrypto.Encryption.decryptResponse(sessionKey, body), 
            path);

        if (csr.statusCode >= 400) { 
            if (csr.statusCode === 401) {
                this._sessionData = { sessionKey, sessionToken : "", userId : -1 }; 
            }
            throw new CardsavrRestError(csr); 
        }

        if (this._debug) {
            console.log("RESPONSE");
            console.log(csr.statusCode);
            console.log(csr.headers);
            if (csr.body) {
                console.log(csr.body);
            }
        }

        return csr;
    };

    get = async(path: string, filter: APIFilter, headersToAdd = {}): Promise < any > => {

        path = formatPath(path, filter);

        return await this.sendRequest(path, "GET", undefined, headersToAdd);
    };

    post = async(path: string, body: any, headersToAdd = {}): Promise < any > => {

        path = formatPath(path, null);
        
        return await this.sendRequest(path, "POST", body, headersToAdd);
    };

    put = async(path: string, filter: APIFilter, body: any, headersToAdd = {}): Promise < any > => {

        path = formatPath(path, filter);

        return await this.sendRequest(path, "PUT", body, headersToAdd);
    };

    delete = async(path: string, filter: APIFilter, headersToAdd = {}): Promise < any > => {

        path = formatPath(path, filter);

        return await this.sendRequest(path, "DELETE", undefined, headersToAdd);
    };

    private _login = async(username: string, password : string): Promise <unknown> => {

        interface EncryptedLoginBody {
            password_proof ? : string,
            client_public_key: string,
            username: string
        }
        const key_pair = await CardsavrCrypto.Keys.makeECDHkeyPair();
        const client_public_key = await CardsavrCrypto.Keys.makeECDHPublicKey(key_pair);

        const encrypted_login_body : EncryptedLoginBody = {
            username,
            client_public_key
        };

        if (password) {
            const passwordKey = await CardsavrCrypto.Keys.generatePasswordKey(username, password);
            encrypted_login_body["password_proof"] = await CardsavrCrypto.Signing.signSaltWithPasswordKey(this._sessionData.sessionKey, passwordKey);
        } else {
            throw new CardsavrSDKError([], "Must include password to initialize session.");
        }

        const loginResponse = await this.sendRequest("/session/login", "post", encrypted_login_body as unknown as { [key: string]: unknown; });
        this._sessionData.sessionKey = await CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.server_public_key, key_pair);
        this._sessionData.userId = loginResponse.body.user_id;
        this.setSessionToken(loginResponse.body.session_token);
        return loginResponse;
    };

    setTrace = (username: string, trace?: {[k: string]: unknown}) : void => {
        if (!trace) 
            trace = {};
        if (trace instanceof Object && !trace.key)
            trace.key = username;
        this.setSessionHeaders({ "x-cardsavr-trace" : JSON.stringify(trace) });
    };

    init = async(username : string, password : string, trace ? : {[k: string]: unknown}): Promise < any > => {
        this.setTrace(username, trace);
        return await this._login(username, password);
    };

    assume = async(username : string, trace ? : {[k: string]: unknown}): Promise <any> => {

        const test_user = (await this.getUsers({username}))?.body?.[0];

        if (!test_user) {
            throw new CardsavrSDKError([], `username ${username} cannot be assumed.`);
        }

        interface EncryptedLoginBody {
            client_public_key: string,
        }

        const key_pair = await CardsavrCrypto.Keys.makeECDHkeyPair();
        const client_public_key = await CardsavrCrypto.Keys.makeECDHPublicKey(key_pair);
        const encrypted_login_body : EncryptedLoginBody = {
            client_public_key
        };

        const loginResponse = await this.sendRequest(`/session/assume/${test_user.id}`, "post", encrypted_login_body as { [key: string]: any; });
        const assumed_session = new CardsavrSession(this._baseUrl, "", this._appName, this._rejectUnauthorized, this._cardsavrCert, this._proxy, this._debug);
        assumed_session._sessionData = {
            sessionKey : await CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.server_public_key, key_pair),
            userId : loginResponse.body.user_id,
        };
        assumed_session.setTrace(username, trace);
        assumed_session.setSessionToken(loginResponse.body.session_token);
        return assumed_session;
    }

    end = async(): Promise < any > => {

        let ret = null;
        try {
            ret = await this.get("/session/end", null);
        } catch (err) { /* this is fine, we shouldn't throw an exception ending a session. */}
        this._sessionData = { sessionKey : "", sessionToken : "", userId : -1 }; 
        return ret;
    };

    refresh = async(): Promise < any > => {

        return await this.put("/session/refresh", null, {});
    };

    getAccounts = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/cardsavr_accounts", filter, headersToAdd);
    };

    createAccount = async(body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {

        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/cardsavr_accounts", body, headersToAdd);
    };

    updateAccount = async(id: number, body: any, envelope_id: string | null = null, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {

        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        if (envelope_id) { //envelope_id required to send a credential_re
            Object.assign(headersToAdd, { "x-cardsavr-envelope-id" : envelope_id });
        }
        return await this.put("/cardsavr_accounts", id, body, headersToAdd);
    };

    deleteAccount = async(id: number, headersToAdd = {}): Promise < any > => {

        return await this.delete("/cardsavr_accounts", id, headersToAdd);
    };

    getAddresses = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
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

    getBins = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/cardsavr_bins", filter, headersToAdd);
    };

    createBin = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post("/cardsavr_bins", body, headersToAdd);
    };

    updateBin = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put("/cardsavr_bins", id, body, headersToAdd);
    };

    deleteBin = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/cardsavr_bins", id, headersToAdd);
    };

    getFinancialInstitutions = async(filter: APIFilter, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
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

    getCards = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/cardsavr_cards", filter, headersToAdd);
    };

    createCard = async(body: APIFilter, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/cardsavr_cards", body, headersToAdd);
    };

    updateCard = async(id: number, body: any, safeKey: string | null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.put("/cardsavr_cards", id, body, headersToAdd);
    };

    deleteCard = async(id: number, headersToAdd = {}): Promise < any > => {

        return await this.delete("/cardsavr_cards", id, headersToAdd);
    };

    getCardPlacementResults = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/card_placement_results", filter, headersToAdd);
    };

    getIntegrators = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
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

    getSites = async(filter: APIFilter, pagingHeader : paging_header, headersToAdd = {}): Promise < any > => {
        return this.getMerchantSites(filter, pagingHeader, headersToAdd);
    };

    getMerchantSites = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/merchant_sites", filter, headersToAdd);
    };

    registerForJobStatusUpdates = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/broadcasts/registrations`, {
            job_id : jobId
        }, headersToAdd);
    };

    getCardholderMessages = async(cardholderId: number, cardsavrMessagingAccessKey?: string, headersToAdd = {}): Promise < any > => {
        if (cardsavrMessagingAccessKey) {
            headersToAdd = Object.assign({
                "x-cardsavr-cardsavr-messaging-access-key" : cardsavrMessagingAccessKey
            }, headersToAdd);
        }
        return await this.get("/messages/cardholders", cardholderId, headersToAdd);
    };

    getJobStatusUpdate = async(jobId: number, cardsavrMessagingAccessKey: string, headersToAdd = {}): Promise < any > => {

        headersToAdd = Object.assign({
            "x-cardsavr-cardsavr-messaging-access-key" : cardsavrMessagingAccessKey
        }, headersToAdd);
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/broadcasts`, null, headersToAdd);
    };

    getJobInformationRequest = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/credential_requests`, null, headersToAdd);
    };

    getJobInformationResponse = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/credential_responses`, null, headersToAdd);
    };

    requestJobInformation = async(jobId: number, type: string, message: string, account_link: { [key: string] : string|boolean }[],headersToAdd = {}, current_request_count:number = 0): Promise < any > => {
        const body = {
            jobId,
            type,
            message,
            account_link,
            current_request_count
        };
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/credential_requests`, body, headersToAdd);
    };

    sendJobInformation = async(jobId: number, envelope_id: string, type: string, message: string, headersToAdd = {}): Promise < any > => {
        const body = {
            envelope_id,
            type,
            message
        };
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/credential_responses`, body, headersToAdd);
    };

    getUsers = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/cardsavr_users", filter, headersToAdd);
    };

    createUser = async(body: any, financial_institution = null, headersToAdd = {}): Promise < any > => {
        if (financial_institution) {
            Object.assign(headersToAdd, {
                "x-cardsavr-financial-institution" : financial_institution
            });
        }
        return await this.post("/cardsavr_users", body, headersToAdd);
    };

    updateUser = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put("/cardsavr_users", id, body, headersToAdd);
    };

    updatePassword = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/cardsavr_users/${id}/update_password`, null, body, headersToAdd);
    };

    deleteUser = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/cardsavr_users", id, headersToAdd);
    };

    authorizeCardholder = async(grant: string, source : { type : string, category : string, device : string, integration : string, sub_category? : string}, headersToAdd = {}): Promise < any > => {
        return await this.post("/cardholders/authorize", { grant, source }, headersToAdd);
    };

    updateCardholderSession = async( filter: APIFilter, body : { cuid : string, clickstream : { url : string, timestamp : string }[]} ): Promise < any > => {
        return await this.put("/cardholder_sessions", filter, body);
    };

    getCardholder = async(filter: number, safeKey: string | null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.get("/cardholders", filter, headersToAdd);
    };

    getCardholders = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/cardholders", filter, headersToAdd);
    };

    createCardholder = async(body: any, safeKey: string | null = null, financial_institution: string | null = null, headersToAdd = {}): Promise < any > => {

        if (body && !body.cuid) {
            body.cuid = generateUniqueUsername();
        }

        if (financial_institution) {
            Object.assign(headersToAdd, {
                "x-cardsavr-financial-institution" : financial_institution
            });
        }
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/cardholders", body, headersToAdd);
    };

    updateCardholder = async(id: number, body: any, newSafeKey: string | null = null, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (newSafeKey != null) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(newSafeKey, true));
        }
        if (safeKey != null) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey, false));
        }
        return await this.put("/cardholders", id, body, headersToAdd);
    };

    deleteCardholder = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete("/cardholders", id, headersToAdd);
    };

    deleteCardholders = async(filter: APIFilter, headersToAdd = {}): Promise < any > => {
        return await this.delete("/cardholders", filter, headersToAdd);
    };

    getSingleSiteJobs = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/place_card_on_single_site_jobs", filter, headersToAdd);
    };

    createSingleSiteJob = async(body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/place_card_on_single_site_jobs", body, headersToAdd);
    };

    createSingleSiteJobs = async(body: any[], safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.post("/place_card_on_single_site_jobs", body, headersToAdd);
    };

    updateSingleSiteJob = async(id: number | null, body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.put("/place_card_on_single_site_jobs", id, body, headersToAdd);
    };

    updateSingleSiteJobs = async(filter: {[key: string]: string}, body: any, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {

        if (safeKey) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        }
        return await this.put("/place_card_on_single_site_jobs", filter, body, headersToAdd);
    };

    getJobResults = async(filter: APIFilter, pagingHeader : paging_header = {} as paging_header, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            Object.assign(headersToAdd, {
                "x-cardsavr-paging" : JSON.stringify(pagingHeader)
            });
        }
        return await this.get("/card_placement_results", filter, headersToAdd);
    };
}
