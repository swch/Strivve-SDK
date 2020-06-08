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

    sessionData: any;

    constructor(baseUrl: string, sessionKey: string, appName: string, userName: string, password ? : string, userCredentialGrant ? : string, cardsavrCert ? : string, trace ? : any) {

        this.sessionData = {
            baseUrl,
            sessionKey,
            appName,
            userName,
            password,
            userCredentialGrant,
            cookies: null,
            headers: {},
            cardsavrCert
        };

        //if the user doesn't supply a trace (likely) or doesn't supply a trace key, just use the username
        if (!trace) {
            trace = {}
        }
        if (!trace.key) {
            trace.key = userName
        }

        this.setSessionHeaders({
            'trace': JSON.stringify(trace)
        });
        this.setSessionHeaders({
            'client-application': appName
        });
    }

    setSessionHeaders = (headersObject: {
        [key: string]: string;
    }) => {
        Object.assign(this.sessionData.headers, headersObject);
    };

    removeSessionHeader = (...headerKeys: string[]) => {

        if (!this.sessionData.headers) {
            throw new JSLibraryError(null, "You have not set any header values.");
        } else {
            var self = this;

            headerKeys.forEach(function(headerKey) {
                if (!self.sessionData.headers.hasOwnProperty(headerKey)) {
                    throw new JSLibraryError(null, "Header value could not be found.");
                }
                delete self.sessionData.headers[headerKey];
            });
        }
    };

    private _makeSafeKeyHeader = (safeKey: string, newKey: boolean = false): any => {
        return newKey ? {
            'new-cardholder-safe-key': safeKey
        } : {
            'cardholder-safe-key': safeKey
        };
    };

    sendRequest = async(path: string, method: "get" | "GET" | "delete" | "DELETE" | "head" | "HEAD" | "options" | "OPTIONS" | "post" | "POST" | "put" | "PUT" | "patch" | "PATCH" | undefined, requestBody ? : any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        var headers = Object.assign({}, this.sessionData.headers, headersToAdd);

        // Encrypt the cardholder-safe-header(s) if they are in this request
        CardsavrCrypto.Encryption.encryptSafeKeys(headers, this.sessionData.sessionKey);

        if (requestBody) {
            requestBody = await CardsavrCrypto.Encryption.encryptRequest(this.sessionData.sessionKey, requestBody);
        }
        let authHeaders = await CardsavrCrypto.Signing.signRequest(path, this.sessionData.appName, this.sessionData.sessionKey, requestBody);
        Object.assign(headers, authHeaders);

        if (typeof window === "undefined" && cookiesEnforced) {
            if (this.sessionData.cookies && Object.keys(this.sessionData.cookies).length > 0) {
                //if there are cookies stored, sends them all in cookie header 
                var cookieKeys = Object.keys(this.sessionData.cookies);
                headers['cookie'] = '';
                for (var x = 0; x < cookieKeys.length; x++) {
                    var key = cookieKeys[x];
                    headers['cookie'] += (key + "=" + this.sessionData.cookies[key])
                }
            } else {
                throw new JSLibraryError(null, "Couldn't find cookie. Can't send request.")
            }
        }

        var requestConfig: AxiosRequestConfig = {
            //httpsAgent: new HTTPSAgent({
            //  rejectUnauthorized: false
            //}),
            baseURL: this.sessionData.baseUrl,
            url: path,
            timeout: 10000,
            headers,
            method,
            data: requestBody,
            withCredentials: true
        };

        // Trust the shared cardsavr cert
        if (this.sessionData.cardsavrCert) {
            requestConfig.httpsAgent = new HTTPSAgent({
                ca: this.sessionData.cardsavrCert
            });
        }

        try {
            var response = await axios.request(requestConfig);

            if (response.headers["set-cookie"] && typeof window === "undefined") {
                let self = this;
                //iterate through set-cookie array and save cookies in sessionData.cookies
                response.headers["set-cookie"].forEach(function(rawCookie: any) {
                    //grab cookie key/value
                    let cookiePart = rawCookie.split(';')[0]
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
            return new CardsavrSessionResponse(response.status, response.statusText, response.headers, response.data, path);
        } catch (err) {
            if (err.response) {
                err.response.data = await CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, err.response.data);
                throw new CardsavrSessionResponse(err.response.status, err.response.statusText, err.response.headers, err.response.data, path);
            } else {
                throw new Error(err.message);
            }
        }
    };

    get = async(path: string, filter: any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, filter);

        return await this.sendRequest(path, 'GET', null, headersToAdd, cookiesEnforced);
    };

    post = async(path: string, body: any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, null);

        return await this.sendRequest(path, 'POST', body, headersToAdd, cookiesEnforced);
    };

    put = async(path: string, id: any, body: any, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, id);

        return await this.sendRequest(path, 'PUT', body, headersToAdd, cookiesEnforced);
    };

    delete = async(path: string, id: number, headersToAdd = {}, cookiesEnforced = true): Promise < any > => {

        path = CardsavrSessionUtilities.formatPath(path, id);

        return await this.sendRequest(path, 'DELETE', null, headersToAdd, cookiesEnforced);
    };

    private _startSession = async(headers: any): Promise < any > => {

        this.sessionData.cookies = {};

        let startResponse = await this.get('/session/start', null, headers, false);

        return startResponse;
    };

    private _login = async(sessionSalt: string, headersToAdd = {}): Promise < any > => {

        interface EncryptedLoginBody {
            signedSalt ? : string,
                userCredentialGrant ? : string,
                clientPublicKey: string,
                userName: string
        }

        var encryptedLoginBody: EncryptedLoginBody;

        var keyPair = await CardsavrCrypto.Keys.makeECDHkeyPair();
        var clientPublicKey = await CardsavrCrypto.Keys.makeECDHPublicKey(keyPair);

        encryptedLoginBody = {
            userName: this.sessionData.userName,
            clientPublicKey
        };

        if (this.sessionData.password) {
            var passwordKey = await CardsavrCrypto.Keys.generatePasswordKey(this.sessionData.userName, this.sessionData.password);
            encryptedLoginBody['signedSalt'] = await CardsavrCrypto.Signing.signSaltWithPasswordKey(sessionSalt, passwordKey);
        } else if (this.sessionData.userCredentialGrant) {
            encryptedLoginBody['userCredentialGrant'] = this.sessionData.userCredentialGrant;
        } else {
            throw new JSLibraryError(null, "Must include either password or user credential grant to initialize session.");
        }

        let loginResponse = await this.sendRequest('/session/login', 'post', encryptedLoginBody, headersToAdd);
        this.sessionData.sessionKey = await CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.serverPublicKey, keyPair);
        return loginResponse;
    };

    init = async(headersToAdd = {}): Promise < any > => {

        let startResponse = await this._startSession(headersToAdd);
        return await this._login(startResponse.body.sessionSalt, headersToAdd);
    };

    end = async(headersToAdd = {}): Promise < any > => {

        return await this.get(`/session/end`, null, headersToAdd);
    };

    getAccounts = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get(`/cardsavr_accounts`, filter, headersToAdd);
    };

    createAccount = async(body: any, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.post(`/cardsavr_accounts`, body, headersToAdd);
    };

    updateAccount = async(id: number, body: any, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.put(`/cardsavr_accounts`, id, body, headersToAdd);
    };

    deleteAccount = async(id: number, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.delete(`/cardsavr_accounts`, id, headersToAdd);
    };

    getAddresses = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get('/cardsavr_addresses', filter, headersToAdd);
    };

    createAddress = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post(`/cardsavr_addresses`, body, headersToAdd);
    };

    updateAddress = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/cardsavr_addresses`, id, body, headersToAdd);
    };

    deleteAddress = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete(`/cardsavr_addresses`, id, headersToAdd);
    };

    getFinancialInstitutions = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get('/financial_institutions', filter, headersToAdd);
    };

    createFinancialInstitution = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post(`/financial_institutions`, body, headersToAdd);
    };

    updateFinancialInstitution = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/financial_institutions`, id, body, headersToAdd);
    };

    deleteFinancialInstitution = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete(`/financial_institutions`, id, headersToAdd);
    };

    getCards = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get('/cardsavr_cards', filter, headersToAdd);
    };

    createCard = async(body: any, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.post(`/cardsavr_cards`, body, headersToAdd);
    };

    updateCard = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/cardsavr_cards`, id, body, headersToAdd);
    };

    deleteCard = async(id: number, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.delete(`/cardsavr_cards`, id, headersToAdd);
    };

    getCardPlacementResults = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get('/card_placement_results', filter, headersToAdd);
    };

    getIntegrators = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get(`/integrators`, filter, headersToAdd);
    };

    createIntegrator = async(body: any, headersToAdd = {}): Promise < any > => {
        return await this.post(`/integrators`, body, headersToAdd);
    };

    updateIntegrator = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/integrators`, id, body, headersToAdd);
    };

    deleteIntegrator = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete(`/integrators`, id, headersToAdd);
    };

    getSites = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get(`/merchant_sites`, filter, headersToAdd);
    }

    registerForJobStatusUpdates = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/broadcasts/registrations`, {
            job_id: jobId
        }, headersToAdd);
    };

    getJobStatusUpdate = async(jobId: number, cardsavrMessagingAccessKey: string, headersToAdd = {}): Promise < any > => {

        headersToAdd = Object.assign({
            'cardsavr-messaging-access-key': cardsavrMessagingAccessKey
        }, headersToAdd);
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/broadcasts`, null, headersToAdd);
    };

    getJobInformationRequest = async(jobId: number, headersToAdd = {}): Promise < any > => {
        return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/credential_requests`, null, headersToAdd);
    };

    sendJobInformation = async(jobId: number, envelope_id: string, type: string, message: string, headersToAdd = {}): Promise < any > => {
        let body = {
            envelope_id,
            type,
            message
        };
        return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/credential_responses`, body, headersToAdd);
    };

    getUsers = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get('/cardsavr_users', filter, headersToAdd);
    };

    getCredentialGrant = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.get(`/cardsavr_users/${id}/credential_grant/`, null, headersToAdd);
    };

    createUser = async(body: any, newSafeKey: string, financial_institution: string = "default", headersToAdd = {}): Promise < any > => {

        if (body.role == "cardholder" && !body.username) {
            const length: number = 20;
            body.username = [...Array(length)].map(i => (~~(Math.random() * 36)).toString(36)).join('')
        }
        Object.assign(headersToAdd, this._makeSafeKeyHeader(newSafeKey, true));
        Object.assign(headersToAdd, {
            "financial-institution": financial_institution
        });
        return await this.post(`/cardsavr_users`, body, headersToAdd);
    };

    updateUser = async(id: number, body: any, newSafeKey: string | null = null, safeKey: string | null = null, headersToAdd = {}): Promise < any > => {
        if (newSafeKey != null) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(newSafeKey, true));
        }
        if (safeKey != null) {
            Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey, false));
        }
        return await this.put(`/cardsavr_users`, id, body, headersToAdd);
    };

    updatePassword = async(id: number, body: any, headersToAdd = {}): Promise < any > => {
        return await this.put(`/cardsavr_users/${id}/update_password`, null, body, headersToAdd);
    };

    deleteUser = async(id: number, headersToAdd = {}): Promise < any > => {
        return await this.delete(`/cardsavr_users`, id, headersToAdd);
    };

    getMultipleSitesJobs = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get('/place_card_on_multiple_sites_jobs', filter, headersToAdd);
    };

    createMultipleSitesJob = async(body: any, safeKey: string, headersToAdd = {}): Promise < any > => {
        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.post(`/place_card_on_multiple_sites_jobs`, body, headersToAdd);
    };

    getSingleSiteJobs = async(filter: any, pagingHeader = {}, headersToAdd = {}): Promise < any > => {
        if (Object.keys(pagingHeader).length > 0) {
            pagingHeader = {
                paging: JSON.stringify(pagingHeader)
            };
            Object.assign(headersToAdd, pagingHeader);
        }
        return await this.get(`/place_card_on_single_site_jobs`, filter, headersToAdd);
    };

    createSingleSiteJob = async(body: any, safeKey: string, headersToAdd = {}): Promise < any > => {
        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.post(`/place_card_on_single_site_jobs`, body, headersToAdd);
    };

    updateSingleSiteJob = async(id: number, body: any, safeKey: string, headersToAdd = {}): Promise < any > => {

        Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
        return await this.put(`/place_card_on_single_site_jobs`, id, body, headersToAdd);
    };

};