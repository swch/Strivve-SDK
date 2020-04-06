"use strict";

import JSLibraryError from  "./JSLibraryError";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import * as CardsavrSessionUtilities from "./CardsavrSessionUtilities";
import * as CardsavrCrypto from "./CardsavrSessionCrypto";
import { Agent as HTTPSAgent } from "https";
import axios, {AxiosRequestConfig} from "axios";

export class CardsavrSession { 

  sessionData : any;
  cardsavrCert?: string;

  constructor(baseUrl: string, sessionKey: string, appName: string, userName: string, password?: string, userCredentialGrant?: string, cardsavrCert?: string){
    this.cardsavrCert = cardsavrCert;

    if(!password && !userCredentialGrant){
      throw new JSLibraryError(null, "Must include either password or user credential grant to initialize session.");
    }

    var userAuthenticator = password ? {password} : {userCredentialGrant};

    this.sessionData = { baseUrl, sessionKey, appName, userName, userAuthenticator, cookies: null, encryptionOn: true, headers: {}};
  }

  setSessionHeaders = (headersObject: any) => {
    Object.assign(this.sessionData.headers, headersObject);
  };

  makeTraceHeader = (traceHeaderObject: any) => {
    let stringifiedTrace = JSON.stringify(traceHeaderObject);
    return {"swch-persistent-trace": stringifiedTrace}
  };

  setIdentificationHeader = (idString: string) => {
    if(typeof idString != "string"){
      throw new JSLibraryError(null, "Identification header value must be a string.");
    }
    this.setSessionHeaders({"swch-client-application": idString});
  };

  removeSessionHeader = (...headerKeys: string[]) => {

    if(!this.sessionData.headers){
      throw new JSLibraryError(null, "You have not set any header values.");
    }
    else{
      var self = this;

      headerKeys.forEach(function(headerKey){
        if(!self.sessionData.headers.hasOwnProperty(headerKey)){
          throw new JSLibraryError(null, "Header value could not be found.");
        }
        delete self.sessionData.headers[headerKey];
      });
    }
  };

  private _makeSafeKeyHeader = (safeKey: string) : any => {

    return {'cardholder-safe-key': safeKey};
  };

  sendRequest = async (path: string, method: "get" | "GET" | "delete" | "DELETE" | "head" | "HEAD" | "options" | "OPTIONS" | "post" | "POST" | "put" | "PUT" | "patch" | "PATCH" | undefined, requestBody?: any, headersToAdd = {}, cookiesEnforced = true) : Promise<any> => {

    var headers = Object.assign({}, this.sessionData.headers, headersToAdd);
    if (this.sessionData.encryptionOn) {
        if (requestBody) {
            requestBody = await CardsavrCrypto.Encryption.encryptRequest(this.sessionData.sessionKey, requestBody);
        }
        let authHeaders = await CardsavrCrypto.Signing.signRequest(path, this.sessionData.appName, this.sessionData.sessionKey, requestBody);
        Object.assign(headers, authHeaders);
    }

    if(typeof window === "undefined" && cookiesEnforced){
      if (this.sessionData.cookies && Object.keys(this.sessionData.cookies).length > 0) {
          //if there are cookies stored, sends them all in cookie header 
          var cookieKeys = Object.keys(this.sessionData.cookies);
          headers['cookie'] = '';
          for(var x = 0; x < cookieKeys.length; x++){
              var key = cookieKeys[x];
              headers['cookie'] += (key + "=" + this.sessionData.cookies[key])
          }
      }
      else{
          throw new JSLibraryError(null, "Couldn't find cookie. Can't send request.")
      }
    }

    var requestConfig : AxiosRequestConfig = {
      httpsAgent: new HTTPSAgent({
        rejectUnauthorized: false
      }),
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
      requestConfig.httpsAgent = new HTTPSAgent( { ca : this.cardsavrCert } );
    }

    try {
        var response = await axios.request(requestConfig);

        if(response.headers["set-cookie"] && typeof window === "undefined"){
            let self = this;
            //iterate through set-cookie array and save cookies in sessionData.cookies
             response.headers["set-cookie"].forEach(function(rawCookie:any){
                //grab cookie key/value
                let cookiePart = rawCookie.split(';')[0]
                let arr = cookiePart.split('=');
                let cookieKey = arr[0];
                let cookieValue = arr[1];
                //set cookie in sessionData.cookies if it has a value
                if(cookieValue){
                    self.sessionData.cookies[cookieKey] = cookieValue;
                }            
           });
         }
        response.data = await CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, response.data);
        return new CardsavrSessionResponse(response.status, response.statusText, response.headers, response.data);
    }
    catch (err) {
        if (err.response) {
            err.response.data = await CardsavrCrypto.Encryption.decryptResponse(this.sessionData.sessionKey, err.response.data);
            throw new CardsavrSessionResponse(err.response.status, err.response.statusText, err.response.headers, err.response.data);
        }
        else {
            throw new Error(err.message);
        }
    }
  };

  get = async (path: string, filter: any, headersToAdd = {}, cookiesEnforced = true) : Promise<any> => {

    path = CardsavrSessionUtilities.formatPath(path, filter);

    return await this.sendRequest(path, 'GET', null, headersToAdd, cookiesEnforced);
  };

  post = async (path: string, body: any, headersToAdd = {}, cookiesEnforced = true) : Promise<any> => {

    path = CardsavrSessionUtilities.formatPath(path,null);

    return await this.sendRequest(path, 'POST', body, headersToAdd, cookiesEnforced);
  };

  put = async (path: string, id: any, body: any, headersToAdd = {}, cookiesEnforced = true) : Promise<any> => {

    path = CardsavrSessionUtilities.formatPath(path, id);

    return await this.sendRequest(path, 'PUT', body, headersToAdd, cookiesEnforced);
  };

  delete = async (path: string, id: number, headersToAdd = {}, cookiesEnforced = true) : Promise<any> => {

    path = CardsavrSessionUtilities.formatPath(path, id);

    return await this.sendRequest(path, 'DELETE', null, headersToAdd, cookiesEnforced);
  };

  private _startSession = async (headers: any) : Promise<any> => {

    this.sessionData.cookies = {};

    let startResponse = await this.get('/session/start', null, headers, false);
    this.sessionData.encryptionOn = startResponse.body.encryptionOn;

    return startResponse;
  };

  private _login = async (sessionSalt: string, headersToAdd = {}) : Promise<any> => {

    interface EncryptedLoginBody {
      signedSalt?: string, 
      userCredentialGrant?: string, 
      clientPublicKey: string, 
      userName: string
    }

    interface UnencryptedLoginBody {
      password?: string, 
      userCredentialGrant?: string, 
      userName: string
    }

    if (this.sessionData.encryptionOn) {

      var encryptedLoginBody : EncryptedLoginBody ;

      var keyPair = await CardsavrCrypto.Keys.makeECDHkeyPair();
      var clientPublicKey = await CardsavrCrypto.Keys.makeECDHPublicKey(keyPair);

      encryptedLoginBody = {userName: this.sessionData.userName, clientPublicKey};

      if(this.sessionData.userAuthenticator.hasOwnProperty('password')){
        var passwordKey = await CardsavrCrypto.Keys.generatePasswordKey(this.sessionData.userName, this.sessionData.userAuthenticator.password);
        encryptedLoginBody['signedSalt'] = await CardsavrCrypto.Signing.signSaltWithPasswordKey(sessionSalt, passwordKey);
      }
      else {
          encryptedLoginBody['userCredentialGrant'] = this.sessionData.userAuthenticator.userCredentialGrant;
      }

      let loginResponse = await this.sendRequest('/session/login', 'post', encryptedLoginBody, headersToAdd);
      this.sessionData.sessionKey = await CardsavrCrypto.Keys.makeECDHSecretKey(loginResponse.body.serverPublicKey,keyPair);
      return loginResponse;
    }
    else{

      var unencryptedLoginBody : UnencryptedLoginBody ;
      unencryptedLoginBody = {userName: this.sessionData.userName};

      if(this.sessionData.userAuthenticator.hasOwnProperty('password')){
        unencryptedLoginBody.password = this.sessionData.userAuthenticator.password;
      }
      else{
        unencryptedLoginBody.userCredentialGrant = this.sessionData.userAuthenticator.userCredentialGrant;
      }
    }
  };

  init = async (headersToAdd = {}) : Promise<any> => {

    let startResponse = await this._startSession(headersToAdd);
    return await this._login(startResponse.body.sessionSalt, headersToAdd);
  };

  getAccounts = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get(`/cardsavr_accounts`, filter, headersToAdd);
  };

  createAccount = async (body: any, safeKey: string, headersToAdd = {}) : Promise<any> => {

    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.post(`/cardsavr_accounts`, body, headersToAdd);
  };

  updateAccount = async (id: number, body: any, safeKey: string, headersToAdd = {}) : Promise<any> => {

    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.put(`/cardsavr_accounts`, id, body, headersToAdd);
  };

  deleteAccount = async (id: number, safeKey: string, headersToAdd = {}) : Promise<any> => {

    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.delete(`/cardsavr_accounts`, id, headersToAdd);
  };

  getAddresses = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/cardsavr_addresses', filter, headersToAdd);
  };

  createAddress = async (body: any, headersToAdd = {}) : Promise<any> => {
    return await this.post(`/cardsavr_addresses`, body, headersToAdd);
  };

  updateAddress = async (id: number, body: any, headersToAdd = {}) : Promise<any> => {
    return await this.put(`/cardsavr_addresses`, id, body, headersToAdd);
  };

  deleteAddress = async (id: number, headersToAdd = {}) : Promise<any> => {
    return await this.delete(`/cardsavr_addresses`, id, headersToAdd);
  };

  getBins = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/cardsavr_bins', filter, headersToAdd);
  };

  createBin = async (body: any, headersToAdd = {}) : Promise<any> => {
    return await this.post(`/cardsavr_bins`, body, headersToAdd);
  };

  updateBin = async (id: number, body: any, headersToAdd = {}) : Promise<any> => {
    return await this.put(`/cardsavr_bins`, id, body, headersToAdd);
  };

  deleteBin = async (id: number, headersToAdd = {}) : Promise<any> => {
    return await this.delete(`/cardsavr_bins`, id, headersToAdd)
  };

  getCards = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/cardsavr_cards', filter, headersToAdd);
  };

  createCard = async (body: any, safeKey: string, headersToAdd = {}) : Promise<any> => {

    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.post(`/cardsavr_cards`, body, headersToAdd);
  };

  updateCard = async (id: number, body: any, headersToAdd = {}) : Promise<any> => {
    return await this.put(`/cardsavr_cards`, id, body, headersToAdd);
  };

  deleteCard = async (id: number,  safeKey: string, headersToAdd = {}) : Promise<any> => {

    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.delete(`/cardsavr_cards`, id, headersToAdd);
  };

  getCardPlacementResults =  async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/card_placement_results', filter, headersToAdd);
  };

  getIntegrators = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get(`/integrators`, filter, headersToAdd);
  };

  createIntegrator = async (body: any, headersToAdd = {}) : Promise<any> => {
    return await this.post(`/integrators`, body, headersToAdd);
  };

  updateIntegrator = async (id: number, body: any, headersToAdd = {}) : Promise<any> => {
    return await this.put(`/integrators`, id, body, headersToAdd);
  };

  deleteIntegrator = async (id: number, headersToAdd = {}) : Promise<any> => {
    return await this.delete(`/integrators`, id, headersToAdd);
  };

  getMerchantSites = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/sites', filter, headersToAdd);
  };

  registerForJobStatusUpdates = async (jobId: number, headersToAdd = {}) : Promise<any> => {
    return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/vbs_status_updates/registrations`, {job_id: jobId}, headersToAdd);
  };

  getJobStatusUpdate = async (jobId: number, cardsavrMessagingAccessKey: string, headersToAdd = {}) : Promise<any> => {
    headersToAdd = Object.assign({'cardsavr-messaging-access-key': cardsavrMessagingAccessKey}, headersToAdd);
    return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/vbs_status_updates`, null, headersToAdd);
  };

  getJobInformationRequest = async (jobId: number, headersToAdd = {}) : Promise<any> => {
    return await this.get(`/messages/place_card_on_single_site_jobs/${jobId}/vbs_requests`, null, headersToAdd);
  };

  sendJobInformation = async (jobId: number, envelope_id: string, type: string, message: string, headersToAdd = {}) : Promise<any> => {
    let body = {envelope_id, type, message};
    return await this.post(`/messages/place_card_on_single_site_jobs/${jobId}/client_responses`, body, headersToAdd);
  };

  getUsers = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/cardsavr_users', filter, headersToAdd);
  };

  getCredentialGrant = async (id: number, headersToAdd = {}) : Promise<any> => {
    return await this.get(`/cardsavr_users/${id}/credential_grant/`, null, headersToAdd);
  };

  createUser = async (body: any, headersToAdd = {}) : Promise<any> => {
    return await this.post(`/cardsavr_users`, body, headersToAdd);
  };

  updateUser = async (id: number, body: any, headersToAdd = {}) : Promise<any> => {
    return await this.put(`/cardsavr_users`, id, body, headersToAdd);
  };

  updatePassword = async (id: number, body: any, headersToAdd = {}) : Promise<any> => {
    return await this.put(`/cardsavr_users/${id}/update_password`, null, body, headersToAdd);
  };

  deleteUser = async (id: number, headersToAdd = {}) : Promise<any> => {
    return await this.delete(`/cardsavr_users`, id, headersToAdd);
  };

  getMultipleSitesJobs = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get('/place_card_on_multiple_sites_jobs', filter, headersToAdd);
  };

  createMultipleSitesJob = async (body: any, safeKey: string, headersToAdd = {}) : Promise<any> => {
    
    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.post(`/place_card_on_multiple_sites_jobs`, body, headersToAdd);
  };
 
  getSingleSiteJobs = async (filter: any, headersToAdd = {}) : Promise<any> => {
    return await this.get(`/place_card_on_single_site_jobs`, filter, headersToAdd);
  };

  createSingleSiteJob = async (body: any, safeKey: string, headersToAdd = {}) : Promise<any> => {
    
    Object.assign(headersToAdd, this._makeSafeKeyHeader(safeKey));
    return await this.post(`/place_card_on_single_site_jobs`, body, headersToAdd);
  };

};
