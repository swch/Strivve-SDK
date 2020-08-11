"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import { generateRandomPar, createMetaKey } from "./CardsavrSessionUtilities";
import JSLibraryError from "./JSLibraryError";
import { Keys } from "./CardsavrSessionCrypto";

interface SessionLogin {
    session: CardsavrSession, 
    cardholder_safe_key: string, 
    user_id: number,
    account_map: { [key:number]:number; }
}

type MessageHandler = (str: string) => void;

export class CardsavrHelper {
    
    private static instance: CardsavrHelper;

    private sessions: { [key:string]:SessionLogin; } = {};

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
                                       trace?: unknown) : Promise<SessionLogin | null> {
        if (this.sessions[username]) {
            return this.sessions[username];
        }
        try {
            const session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, username, password, grant, this.cert, trace);
            const login_data = await session.init();
            this.sessions[username] = { session : session, user_id : login_data.body.user_id, cardholder_safe_key : login_data.body.cardholder_safe_key, account_map : {} }; 
            return this.sessions[username];
        } catch(err) {
            this.handleError(err);
        }
        return null;
    }

    public getSession(username: string) : CardsavrSession {
        if (!this.sessions[username]) {
            throw new JSLibraryError(null, "Must login and create session before using it.");
        }
        return this.sessions[username].session;
    }

    public getCardholderSafeKey(username: string) : string {
        if (!this.sessions[username]) {
            throw new JSLibraryError(null, "Must login and create session before accessing safe key.");
        }
        return this.sessions[username].cardholder_safe_key;
    }

    public static getInstance(): CardsavrHelper {
        if (!CardsavrHelper.instance) {
            CardsavrHelper.instance = new CardsavrHelper();
        }
        return CardsavrHelper.instance;
    }

    public async createCard(agent_username: string, financial_institution: string, cardholder_data: any, address_data: Record<string, string>, card_data: any) : Promise<unknown> {
    
        try {
            //don't need the login data
            const cardholder_data_copy = { ...cardholder_data };
            
            cardholder_data_copy.role = "cardholder";
            //set the missing settings for model
            if (!cardholder_data.first_name) cardholder_data_copy.first_name = card_data.first_name;
            if (!cardholder_data.last_name) cardholder_data_copy.last_name = card_data.last_name;
            if (!card_data.name_on_card) card_data.name_on_card = card_data.first_name + card_data.last_name;
            const meta_key: string = createMetaKey(card_data, address_data.postal_code);
            cardholder_data_copy.custom_data = { reporting_id : meta_key, cardsavr_card_data : { meta_key : meta_key } };
            cardholder_data_copy.cardholder_safe_key =  await Keys.generateCardholderSafeKey(cardholder_data.email + card_data.name_on_card); 
    
            const agent_session = this.getSession(agent_username);
            const cardholder_response = await agent_session.createUser(cardholder_data_copy, cardholder_data_copy.cardholder_safe_key, financial_institution);
            const cardholder_id = cardholder_response.body.id;
            //eventually these will be one time grants
            const grant_response_login = await agent_session.getCredentialGrant(cardholder_id);
            const grant_login = grant_response_login.body.user_credential_grant;
            const grant_response_handoff = await agent_session.getCredentialGrant(cardholder_id);
            const grant_handoff = grant_response_handoff.body.user_credential_grant;

            await this.loginAndCreateSession(cardholder_data_copy.username, undefined, grant_login);
            const session_user = this.getSession(cardholder_data_copy.username);

            const address_response = await session_user.createAddress(address_data);
    
            card_data.cardholder_id = cardholder_id;
            card_data.address_id = address_response.body.id;
            card_data.par = generateRandomPar(card_data.pan, card_data.expiration_month, card_data.expiration_year, cardholder_data_copy.username);
            const card_response = await session_user.createCard(card_data, cardholder_data_copy.cardholder_safe_key);
    
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

        const sites: CardsavrSessionResponse = await session.getSites({}, { page_length : 200, sort : "host" } );
        if (!sites || !sites.body || sites.body.length === 0 ) {
            return null;
        }
        const site : any = sites.body.find((site: any) => site.host === host);
        if (!site ) {
            return null;
        }
        return site;
    }

    public async placeCardOnSite(username: string, merchant_creds: any, requesting_brand  = "staging", status = "REQUESTED") {
        //const login = await this.loginAndCreateSession(username, undefined, grant);
        const login = this.sessions[username];
        if (login) {
            try {
                const session = login.session;
                let merchant_site_id: number = merchant_creds.merchant_site_id;
                if (!merchant_site_id && merchant_creds.site_hostname) {
                    const site: any = await this.lookupMerchantSite(username, merchant_creds.site_hostname);
                    if (site) {
                        merchant_site_id = site.id;
                    }
                }
                //create the account and get all the users cards
                const [account, cards] = await Promise.all(
                    [session.createAccount( 
                        {cardholder_id : login.user_id,
                        username : merchant_creds.username, 
                        password : merchant_creds.password, 
                        merchant_site_id : merchant_site_id}, login.cardholder_safe_key ),
                    session.getCards({})]
                );
                //use the first card the user has (we only created one)
                if (account && account.body && cards && cards.body && cards.body.length == 1) {
                    const job_params = {
                        user_id : login.user_id,
                        card_id : cards.body[0].id,
                        account_id : account.body.id,
                        requesting_brand : requesting_brand,
                        //queue_name: "vbs_queue", //garbage
                        user_is_present : true,
                        status : status
                    };
                    const job_data = await session.createSingleSiteJob(job_params);
                    const job_id = job_data.body.id;
                    login.account_map[job_id] = account.body.id;
                    return job_data;
                }
            } catch(err) {
                this.handleError(err);
            }
        } else {
            throw new JSLibraryError(null, "No session established for: " + username + ".  Need to call loginAndCreateSession?");
        }
    }

    public endSession(username: string) {
        const session = this.getSession(username);
        session.end();
        delete this.sessions[username];
    }

    public async pollOnJob(username: string, job_id: number, callback: MessageHandler, interval = 5000) {
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
                        console.log(item);
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

    public async placeCardOnSiteAndPoll(username: string, merchant_creds: any, requesting_brand = "staging", callback: any, interval = 5000) {
        try {
            const job_data = await this.placeCardOnSite(username, merchant_creds, requesting_brand);
            if (job_data) {
                this.pollOnJob(username, job_data.body.id, callback, interval);
            }
        } catch(err) {
            this.handleError(err);
        }
    }

    public async postTFA(username: string, tfa: string, job_id: number, envelope_id: string) {
    
        try {
            const session = this.getSession(username); //session should already be loaded
            session.sendJobInformation(job_id, envelope_id, "tfa_response", tfa);
        } catch(err) {
            this.handleError(err);
        }
    }

    public async postCreds(username: string, merchant_creds: any, job_id: number, envelope_id: string) {
        try {
            const session = this.getSession(username);
            const login = this.sessions[username];
            session.updateAccount( 
                login.account_map[job_id],
                {username : merchant_creds.username, 
                password : merchant_creds.password}, login.cardholder_safe_key );
            session.sendJobInformation(job_id, envelope_id, "credential_response", "submitted");
        } catch(err) {
            this.handleError(err);
        }
    }

    public async deleteAccount (agent_username: string, cardholder_id: number) {
    
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
