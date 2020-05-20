"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import { generateRandomPar } from "./CardsavrSessionUtilities";
import * as crypto from 'crypto';
import JSLibraryError from "./JSLibraryError";

interface SessionLogin {
    session: CardsavrSession, 
    cardholder_safe_key: string, 
    user_id: number,
    account_map: { [key:number]:number; }
}

export class CardsavrHelper {
    
    private static instance: CardsavrHelper;

    private sessions: { [key:string]:SessionLogin; } = {};

    private cardsavr_server = "";
    private app_name = "";
    private app_key = "";

    private constructor() { 
    }

    public setAppSettings(cardsavr_server: string, app_name: string, app_key: string) : CardsavrHelper {
        this.cardsavr_server = cardsavr_server;
        this.app_name = app_name;
        this.app_key = app_key;
        return this;
    }
    
    public async loginAndCreateSession(username: string, 
                                       password?: string,
                                       grant?: string,
                                       trace?: any) {
        if (this.sessions[username]) {
            console.log(null, "Session already created for " + username + ", use getSession() instead of loginAndCreateSession()");
            return this.sessions[username];
        }
        try {
            trace = (trace ? trace : username);
            const session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, username, password, grant);
            session.setIdentificationHeader(this.app_name);
            session.setSessionHeaders(session.makeTraceHeader({key: trace}));
            const login_data = await session.init();
            this.sessions[username] = { session: session, user_id: login_data.body.user_id, cardholder_safe_key: login_data.body.cardholder_safe_key, account_map: {} }; 
            return this.sessions[username];
        } catch(err) {
            if (err.body && err.body._errors) {
                console.log("Errors returned from REST API");
                err.body._errors.map((item: string) => console.log(item));
            } else {
                console.log("no _errors, exception stack below:");
                console.log(err.stack);
            }
        }
    }

    public getSession(username: string) : CardsavrSession {
        if (!this.sessions[username]) {
            throw new JSLibraryError(null, "Must login and create session before using it.")
        }
        return this.sessions[username].session;
    }

    public getCardholderSafeKey(username: string) : string {
        if (!this.sessions[username]) {
            throw new JSLibraryError(null, "Must login and create session before accessing safe key.")
        }
        return this.sessions[username].cardholder_safe_key;
    }

    public static getInstance(): CardsavrHelper {
        if (!CardsavrHelper.instance) {
            CardsavrHelper.instance = new CardsavrHelper();
        }
        return CardsavrHelper.instance;
    }

    public async createCard(agent_username: string, cardholder_data: any, address_data: any, card_data: any) {
    
        try {
            //don't need the login data
            cardholder_data.username = this.generate_alphanumeric_string(40);

            await this.getSession(agent_username);
            //await this.loginAndCreateSession(agent_username, agent_password, undefined, cardholder_data.username);

            cardholder_data.cardholder_safe_key =  crypto.randomBytes(32).toString("base64"); 
            cardholder_data.role = "cardholder";
    
            //set the missing settings for cardupdatr model
            if (!cardholder_data.first_name) cardholder_data.first_name = card_data.first_name;
            if (!cardholder_data.last_name) cardholder_data.last_name = card_data.last_name;
            if (!card_data.name_on_card) card_data.name_on_card = card_data.first_name + card_data.last_name;
    
            const agent_session = this.getSession(agent_username);
            const cardholder_response = await agent_session.createUser(cardholder_data, cardholder_data.cardholder_safe_key);
            const cardholder_id = cardholder_response.body.id;
            const grant_response = await agent_session.getCredentialGrant(cardholder_id);
            const grant = grant_response.body.user_credential_grant;
            await this.loginAndCreateSession(cardholder_data.username, undefined, grant);
            const session_user = this.getSession(cardholder_data.username);

            const address_response = await session_user.createAddress(address_data);
    
            card_data.cardholder_id = cardholder_id;
            card_data.address_id = address_response.body.id;
            card_data.user_id = cardholder_id;
            card_data.par = generateRandomPar(card_data.pan, card_data.expiration_month, card_data.expiration_year, cardholder_data.username);
            const card_response = await session_user.createCard(card_data, cardholder_data.cardholder_safe_key);
    
            //eventually these will be one time grants
            const grant_response_handoff = await this.getSession(agent_username).getCredentialGrant(cardholder_id);
            const grant_handoff = grant_response_handoff.body.user_credential_grant;
    
            return { grant: grant_handoff, username: cardholder_data.username, card_id: card_response.body.id } ;
    
        } catch(err) {
            if (err.body && err.body._errors) {
                console.log("Errors returned from REST API");
                err.body._errors.map((item: string) => console.log(item));
            } else {
                console.log("no _errors, exception stack below:");
                console.log(err.stack);
            }
        }
        if (false) {  //this is only for testing
            this.deleteAccount(agent_username, card_data.cardholder_id);
        }
    }

    public async placeCardOnSite(username: string, merchant_creds: any, callback: any, interval: number = 5000) {
    
        try {
            //const login = await this.loginAndCreateSession(username, undefined, grant);
            const session = this.getSession(username);
            const login = this.sessions[username];

            if (login) {
                //create the account and get all the users cards
                const [account, cards] = await Promise.all(
                    [session.createAccount( 
                        {cardholder_id: login.user_id,
                        username: merchant_creds.username, 
                        password: merchant_creds.password, 
                        site_hostname: merchant_creds.site_hostname}, login.cardholder_safe_key ),
                    session.getCards({})]
                );
                //use the first card the user has (we only created one)
                if (account.body && cards.body.length == 1) {
                    var job_params = {
                        user_id: login.user_id,
                        card_id: cards.body[0].id,
                        account_id: account.body.id,
                        site_hostname: merchant_creds.site_hostname,
                        requesting_brand: "staging",
                        //queue_name: "vbs_queue", //garbage
                        user_is_present: true
                    };
                    var job_data = await session.createSingleSiteJob(job_params, login.cardholder_safe_key);
                    var job_id = job_data.body.id;
                    login.account_map[job_id] = account.body.id;
                    var subscription = await session.registerForJobStatusUpdates(job_id);
                    var request_probe = setInterval(async (message) => { 
                        var request = await session.getJobInformationRequest(job_data.body.id);
                        if (request.body) {
                            callback({job_id: job_id, type: request.body.type, envelope_id: request.body.envelope_id});
                        }
                    }, interval < 1000 ? 1000 : interval);
                    var broadcast_probe = setInterval(async (message) => { 
                        var update = await session.getJobStatusUpdate(job_data.body.id, subscription.body.access_key);
                        if (update.body) {
                            callback({job_id: update.body.id, type: update.body.type, message: update.body.message});  
                            if (update.body.type == "job_status" &&
                                update.body.message.status == "COMPLETED") {
                                clearInterval(broadcast_probe);
                                clearInterval(request_probe);
                            }
                            if (update.body.type == "job_status" && 
                                update.body.message.status == "UPDATING") {
                                clearInterval(request_probe);
                            }
                        }
                    }, interval < 1000 ? 1000 : interval);
                }
            }
        } catch(err) {
            if (err.body && err.body._errors) {
                console.log("Errors returned from REST API");
                err.body._errors.map((item: string) => console.log(item));
            } else {
                console.log("no _errors, exception stack below:");
                console.log(err.stack);
            }
        }
    }

    public async postTFA(username: string, tfa: string, job_id: number, envelope_id: string) {
    
        try {
            const session = this.getSession(username); //session should already be loaded
            session.sendJobInformation(job_id, envelope_id, "tfa_response", tfa);
        } catch(err) {
            if (err.body && err.body._errors) {
                console.log("Errors returned from REST API");
                err.body._errors.map((item: string) => console.log(item));
            } else {
                console.log("no _errors, exception stack below:");
                console.log(err.stack);
            }
        }
    }

    public async postCreds(username: string, merchant_creds: any, job_id: number, envelope_id: string) {
        try {
            const session = this.getSession(username);
            const login = this.sessions[username];
            session.updateAccount( 
                login.account_map[job_id],
                {username: merchant_creds.username, 
                password: merchant_creds.password}, login.cardholder_safe_key );
            session.sendJobInformation(job_id, envelope_id, "credential_response", "submitted");
        } catch(err) {
            if (err.body && err.body._errors) {
                console.log("Errors returned from REST API");
                err.body._errors.map((item: string) => console.log(item));
            } else {
                console.log("no _errors, exception stack below:");
                console.log(err.stack);
            }
        }
    }

    public async deleteAccount (agent_username: string, cardholder_id: number) {
    
        try {
            const session = this.getSession(agent_username);
            if (cardholder_id > 0) {
                session.deleteUser(cardholder_id);
            }
        } catch(err) {
            if (err.body && err.body._errors) {
                console.log("Errors returned from REST API");
                err.body._errors.map((item: string) => console.log(item));
            } else {
                console.log("no _errors, exception stack below:");
                console.log(err.stack);
            }
        }
    }
      
    private generate_alphanumeric_string(length: number, current: string = ""): string {

        const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        if (current.length == length) {
            return current;
        }
        current += characters.charAt(Math.floor(Math.random() * characters.length));
        return this.generate_alphanumeric_string(length, current);
    }
    
} 



