"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import { generateRandomPar, createMetaKey, localStorageAvailable } from "./CardsavrSessionUtilities";
import JSLibraryError from "./JSLibraryError";
import { Keys } from "./CardsavrSessionCrypto";

type MessageHandler = (str: string) => void;

export class CardsavrHelper {
    
    private static instance: CardsavrHelper;

    private _sessions: { [key:string]:CardsavrSession; } = {};

    private _safe_keys: { [key:string]:string; } = {};

    private cardsavr_server = "";
    private app_name = "";
    private app_key = "";
    private cert?: string;

    public setAppSettings(cardsavr_server: string, app_name: string, app_key: string, cert?: string) : CardsavrHelper {
        this.cardsavr_server = cardsavr_server;
        this.app_name = app_name;
        this.app_key = app_key;
        this.cert = cert;
        return this;
    }
    
    public async loginAndCreateSession(username: string, 
                                       password?: string,
                                       grant?: string,
                                       trace?: {[k: string]: unknown}) : Promise<CardsavrSession | null> {

        let session : CardsavrSession | undefined = this._sessions[username];
        if (session) {
            return session;
        } else if ((session = this.restoreSession(username))) {
            session.setTrace(username, trace);
            return session;
        }

        try {
            session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, this.cert);
            await session.init(username, password, grant, trace);
            this.saveSession(username, session);
            return session;
        } catch(err) {
            this.handleError(err);
        }
        return null;
    }

    private async saveSession(username: string, session: CardsavrSession) {
        this._sessions[username] = session;
        if(localStorageAvailable()) {
            window.localStorage.setItem(`session[${username}]`, session.sessionData.sessionKey);
        }
    }

    public getSession(username : string) : CardsavrSession {
        const session = this._sessions[username]; 
        if (session) {
            return session;
        }
        throw new JSLibraryError(null, "Must login and create session before accessing session by username.");
    }

    private restoreSession(username: string) : CardsavrSession | undefined {
        if (localStorageAvailable()) {
            const sessionKey = window.localStorage.getItem(`session[${username}]`);
            if (sessionKey) {
                const session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, this.cert);
                session._sessionData = {"sessionKey" : sessionKey};
                this.saveSession(username, session);
                return session;
            }
        }
    }

    public static getInstance(): CardsavrHelper {
        if (!CardsavrHelper.instance) {
            CardsavrHelper.instance = new CardsavrHelper();
        }
        return CardsavrHelper.instance;
    }

    public async createCard(agent_username: string, financial_institution: string, cardholder_data: any, address_data: {[k: string]: string}, card_data: any, safe_key?: string) : Promise<unknown> {
    
        try {
            //don't need the login data
            const cardholder_data_copy = { ...cardholder_data };
            
            cardholder_data_copy.role = "cardholder";
            //set the missing settings for model
            if (!cardholder_data.first_name) cardholder_data_copy.first_name = card_data.first_name;
            if (!cardholder_data.last_name) cardholder_data_copy.last_name = card_data.last_name;
            if (!card_data.name_on_card) card_data.name_on_card = `${card_data.first_name} ${card_data.last_name}`;
            const meta_key: string = createMetaKey(card_data, address_data.postal_code);
            if (!cardholder_data_copy.custom_data) {
                cardholder_data_copy.custom_data = {};
            }
            cardholder_data_copy.custom_data.cardsavr_card_data = { meta_key : meta_key };
            if (!safe_key) { //generate a safe_key if one isn't passed in
                safe_key = await Keys.generateCardholderSafeKey(cardholder_data.email + card_data.name_on_card);
                cardholder_data_copy.cardholder_safe_key = safe_key; 
            }
    
            const agent_session = this.getSession(agent_username);
            const cardholder_response = await agent_session.createUser(cardholder_data_copy, safe_key, financial_institution);
            const cardholder_id = cardholder_response?.body?.id;
            //eventually these will be one time grants
            const grant_response_login = await agent_session.getCredentialGrant(cardholder_id);
            const grant_login = grant_response_login?.body?.user_credential_grant;
            const grant_response_handoff = await agent_session.getCredentialGrant(cardholder_id);
            const grant_handoff = grant_response_handoff?.body?.user_credential_grant;

            await this.loginAndCreateSession(cardholder_data_copy.username, undefined, grant_login);
            const session_user = this.getSession(cardholder_data_copy.username);

            const address_response = await session_user.createAddress(address_data);
    
            card_data.cardholder_id = cardholder_id;
            card_data.address_id = address_response?.body?.id;
            card_data.par = generateRandomPar(card_data.pan, card_data.expiration_month, card_data.expiration_year, cardholder_data_copy.username);
            const card_response = await session_user.createCard(card_data, safe_key);
    
            return { grant : grant_handoff, cardholder : cardholder_response.body, card : card_response.body, address : address_response.body } ;
    
        } catch(err) {
            this.handleError(err);
        }
        // eslint-disable-next-line no-constant-condition
        if (false) {  //this is only for testing
            this.deleteAccount(agent_username, card_data.cardholder_id);
        }
        return null;
    }

    private handleError(err: any) {
        if (err.body && err.body._errors) {
            console.log("Errors returned from REST API : " + err.call);
            err.body._errors.map((item: string) => console.log(item));
        } else if (err.body && err.body.message) {
            console.log("Message returned from REST API: " + err.body.message);
        } else if (err.stack) {
            console.log("no _errors from REST API, exception stack below:");
            console.log(err.stack);
        } else {
            console.log("no _errors from REST API, full error below:");
            console.log(err);
        }
    }

    private async lookupMerchantSite(username: string, host: string) {
        const session = this.getSession(username);
        const sites: CardsavrSessionResponse = await session.getMerchantSites({"host" : host});
        if (!sites || !sites.body || sites.body.length === 0 ) {
            return null;
        }
        const site : any = sites.body[0];
        if (!site ) {
            return null;
        }
        return site;
    }

    public async placeCardOnSite(username: string, merchant_creds: any, status = "REQUESTED", safe_key? : string) : Promise<any> {
        //const login = await this.loginAndCreateSession(username, undefined, grant);
        const session = this._sessions[username];
        if (session) {
            try {
                let merchant_site_id: number = merchant_creds.merchant_site_id;
                if (!merchant_site_id && merchant_creds.site_hostname) {
                    const site: any = await this.lookupMerchantSite(username, merchant_creds.site_hostname);
                    if (site) {
                        merchant_site_id = site.id;
                    }
                }
                const user_json = await session.getUsers({username : username});
                //create the account and get all the users cards
                const [account, cards] = await Promise.all(
                    [session.createAccount( 
                        {cardholder_id : user_json.body[0].id,
                        username : merchant_creds.username, 
                        password : merchant_creds.password, 
                        merchant_site_id : merchant_site_id}, safe_key ),
                    session.getCards({})]
                );
                //use the first card the user has (we only created one)
                if (account && account.body && cards && cards.body && cards.body.length == 1) {
                    const job_params = {
                        user_id : user_json.body[0].id,
                        card_id : cards.body[0].id,
                        account_id : account.body.id,
                        user_is_present : true,
                        status : status
                    };
                    return await session.createSingleSiteJob(job_params, safe_key);
                }
            } catch(err) {
                this.handleError(err);
            }
        } else {
            throw new JSLibraryError(null, `No session established for: ${username}.  Need to call loginAndCreateSession?`);
        }
    }

    public endSession(username: string) : void {
        const session = this.getSession(username);
        session.end();
        delete this._sessions[username];
        if(localStorageAvailable()) {
            window.localStorage.removeItem(`session[${username}]`);
        }
     }

    public async pollOnJob(username: string, job_id: number, callback: MessageHandler, interval = 5000) : Promise<void> {
        try {
            const session = this.getSession(username);
            
            const subscription = await session.registerForJobStatusUpdates(job_id);
            const request_probe = setInterval(async (_message) => { 
                const request = await session.getJobInformationRequest(job_id);
                if (request.body) {
                    callback(request.body);
                }
            }, interval < 1000 ? 1000 : interval);
            const broadcast_probe = setInterval(async (_message) => { 
                const update = await session.getJobStatusUpdate(job_id, subscription.body.access_key);
                if (update.status_code == 401) {
                    clearInterval(broadcast_probe);
                    clearInterval(request_probe);
                } else if (update.body) {
                    //this is temporary until we can guarantee that messages are arrays
                    const arr = []; 
                    if (!Array.isArray(update.body)) {
                        arr.push(update.body);
                    } else {
                        arr.push(...update.body);
                    }
                    arr.map(item => {
                        callback(item);
                        if (update.body.type === "job_status") {
                            if (update.body.message.terminal_type || update.body.message.status === "COMPLETED") {
                                clearInterval(broadcast_probe);
                                clearInterval(request_probe);
                            } else if (update.body.message.status === "UPDATING") {
                                clearInterval(request_probe);
                            }
                        }
                    });
                }
            }, interval < 1000 ? 1000 : interval);
        } catch(err) {
            this.handleError(err);
        }
    }

    public async placeCardOnSiteAndPoll(username: string, merchant_creds: any, callback: any, interval = 5000) : Promise<void> {
        try {
            const job_data = await this.placeCardOnSite(username, merchant_creds);
            if (job_data) {
                this.pollOnJob(username, job_data.body.id, callback, interval);
            }
        } catch(err) {
            this.handleError(err);
        }
    }

    public async postTFA(username: string, tfa: string, job_id: number, envelope_id: string) : Promise<void> {
    
        try {
            const session = this.getSession(username); //session should already be loaded
            session.sendJobInformation(job_id, envelope_id, "tfa_response", tfa);
        } catch(err) {
            this.handleError(err);
        }
    }

    public async postCreds(username: string, merchant_creds: any, job_id: number, envelope_id: string) : Promise<void> {
        try {
            const session = this.getSession(username);
            const acct = await session.getSingleSiteJobs(job_id);
            if (acct && acct.body && acct.body.account_id) {
                session.updateAccount( 
                    acct.body.account_id,
                    {username : merchant_creds.username, 
                    password : merchant_creds.password}, this._safe_keys[username] );
                session.sendJobInformation(job_id, envelope_id, "credential_response", "submitted");
            }
        } catch(err) {
            this.handleError(err);
        }
    }

    public async deleteAccount (agent_username: string, cardholder_id: number) : Promise<void> {
    
        try {
            const session = this.getSession(agent_username);
            if (cardholder_id > 0) {
                session.deleteUser(cardholder_id);
            }
        } catch(err) {
            this.handleError(err);
        }
    }
    
} 
