"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import { generateRandomPar, createMetaKey, localStorageAvailable, generateUniqueUsername } from "./CardsavrSessionUtilities";
import CardsavrSDKError from "./CardsavrSDKError";
import CardsavrRestError from "./CardsavrRestError";

type MessageHandler = (str: string) => void;
type cardholder_data = {[k: string]: any};
type merchant_creds = {[k: string]: any};
type address_data = {[k: string]: any};
type card_data = {[k: string]: any};

interface job_data {
    user_id : number,
    card_id? : number,
    account : merchant_creds,
    user_is_present : boolean,
    status? : string,
    type? : string
}

interface jobParams {
    merchant_creds : merchant_creds, 
    card_id? : number, 
    status? : string
}

interface placeCardOnSiteParams {
    username : string,  
    merchant_creds : merchant_creds, 
    card_id? : number, 
    status? : string, 
    safe_key? : string,
    type? : string
}

interface placeCardOnSitesParams {
    username : string,  
    jobs_data : jobParams[],
    safe_key? : string,
    type? : string
}

interface placeCardOnSiteSingleCallParams {
    agent_username : string, 
    financial_institution : string, 
    cardholder_data: cardholder_data, 
    merchant_creds : merchant_creds, 
    address_data? : address_data, 
    card_data? : card_data, 
    safe_key? : string,
    type? : string
}

interface placeCardOnSiteAndPollParams {
    username : string, 
    merchant_creds : merchant_creds, 
    callback : any, 
    card_id? : number, 
    interval? : number,
    type? : string
}

interface pollOnJobParams {
    username : string, 
    job_id : number,
    callback : MessageHandler, 
    user_id? : number,
    interval? : number
}

interface createCardParams {
    agent_username : string, 
    financial_institution : string, 
    cardholder_data : cardholder_data, 
    address_data : address_data, 
    card_data : card_data, 
    safe_key? : string
}

interface postTFAParams {
    username: string, 
    tfa: string, 
    job_id: number, 
    envelope_id: string
}

interface postCredsParams {
    username: string, 
    merchant_creds: any, 
    job_id: number, 
    envelope_id: string,
    safe_key?: string
}

export class CardsavrHelper {
    
    private static instance: CardsavrHelper;

    private _sessions: { [key:string]:CardsavrSession; } = {};

    private _jobs = new Map<number, MessageHandler>();

    private _user_probe!: ReturnType<typeof setTimeout>;

    private cardsavr_server = "";
    private app_name = "";
    private app_key = "";
    private cert?: string;
    private reject_unauthorized = true;

    public setAppSettings(cardsavr_server: string, app_name: string, app_key: string, reject_unauthorized = true, cert?: string) : CardsavrHelper {
        this.cardsavr_server = cardsavr_server;
        this.app_name = app_name;
        this.app_key = app_key;
        this.cert = cert;
        this.reject_unauthorized = reject_unauthorized;
        return this;
    }
    
    public async loginAndCreateSession(username: string, 
                                       password: string,
                                       trace?: {[k: string]: unknown}) : Promise<CardsavrSession> {

        let session : CardsavrSession | null = this._sessions[username];
        if (session) {
            return session;
        } else if ((session = await this.restoreSession(username, trace))) {
            return session;
        }
        session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, this.reject_unauthorized, this.cert);
        await session.init(username, password, trace);
        this.saveSession(username, session);
        return session;
    }

    private async saveSession(username: string, session: CardsavrSession) {
        this._sessions[username] = session;
        if(localStorageAvailable()) {
            window.sessionStorage.setItem(`session_v2.3.1[${username}]`, session.getSerializedSessionData());
        }
    }

    public getSession(username : string) : CardsavrSession {
        const session = this._sessions[username]; 
        if (session) {
            return session;
        }
        throw new CardsavrSDKError([], "Must login and create session before accessing session by username.");
    }

    private async restoreSession(username: string, trace?: {[k: string]: unknown}) : Promise<CardsavrSession | null> {
        if (localStorageAvailable()) {
            const session_cache_data = <string>window.sessionStorage.getItem(`session_v2.3.1[${username}]`);
            if (session_cache_data) {
                const session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, this.reject_unauthorized, this.cert);
                session.setTrace(username, trace);
                try {
                    session.deserializeSessionData(session_cache_data);
                    await session.refresh();
                } catch (err) {
                    window.sessionStorage.clear();
                    if (err.body && err.body._errors) {
                        err.body._errors.map((item: string) => console.log(item));
                    }
                    return null;
                }
                this.saveSession(username, session);
                return session;
            }
        }
        return null;
    }

    public static getInstance(): CardsavrHelper {
        if (!CardsavrHelper.instance) {
            CardsavrHelper.instance = new CardsavrHelper();
        }
        return CardsavrHelper.instance;
    }

    public async createCard(create_card_config : createCardParams) : Promise<unknown> {
        const { cardholder_data, address_data, card_data, agent_username, financial_institution, safe_key = null } = create_card_config;
        try {
            //don't need the login data
            const cardholder_data_copy = { ...cardholder_data };
            const address_data_copy = { ...address_data };
            const card_data_copy = { ...card_data };
            
            cardholder_data_copy.cuid = generateUniqueUsername();
            //set the missing settings for model
            if (!cardholder_data.first_name) cardholder_data_copy.first_name = address_data.first_name;
            if (!cardholder_data.last_name) cardholder_data_copy.last_name = address_data.last_name;
            if (!card_data.name_on_card) card_data_copy.name_on_card = `${card_data.first_name} ${card_data.last_name}`;
            const meta_key: string = createMetaKey(address_data.first_name, address_data.last_name, card_data.pan, address_data.postal_code);
            if (!cardholder_data.custom_data) {
                cardholder_data_copy.custom_data = {};
            }
            cardholder_data_copy.custom_data.cardsavr_card_data = { meta_key : meta_key };
    
            const agent_session = this.getSession(agent_username);

            //card requires a user id
            address_data_copy.cardholder_ref = {"cuid" : cardholder_data_copy.cuid };
            card_data_copy.address = address_data_copy;
            card_data_copy.cardholder = cardholder_data_copy;
            if (!card_data_copy.par) {
                card_data_copy.par = generateRandomPar(card_data_copy.pan, card_data_copy.expiration_month, card_data_copy.expiration_year, cardholder_data_copy.cuid);
            }

            const headers : {[k: string]: string} = 
                {"financial-institution" : financial_institution, 
                "hydration" : JSON.stringify(["cardholder"])};

            const card_response = await agent_session.createCard(card_data_copy, safe_key, headers);     
     
            return card_response.body;
    
        } catch(err) {
            this.handleError(err);
        }
        // eslint-disable-next-line no-constant-condition
        if (false) {  //this is only for testing
            this.deleteAccount(agent_username, card_data.cardholder_id);
        }
        return null;
    }

    public async placeCardOnSiteSingleCall(place_card_config: placeCardOnSiteSingleCallParams) : Promise<unknown> {
    try {
        const { cardholder_data, card_data, merchant_creds, address_data, agent_username, financial_institution, safe_key = null, type = null } = place_card_config;
        //set the missing settings for model
        if (!cardholder_data.first_name && address_data) cardholder_data.first_name = address_data.first_name;
        if (!cardholder_data.last_name && address_data) cardholder_data.last_name = address_data.last_name;
        if (!cardholder_data.cuid) cardholder_data.cuid = generateUniqueUsername();
        if (card_data && !card_data.name_on_card) card_data.name_on_card = `${cardholder_data.first_name} ${cardholder_data.last_name}`;

        if (card_data && !card_data.par) {
            card_data.par = generateRandomPar(card_data.pan, card_data.expiration_month, card_data.expiration_year, cardholder_data.cuid);
        }
        merchant_creds.cardholder_ref = {"cuid" : cardholder_data.cuid };

        if (address_data && card_data) {
            const meta_key: string = createMetaKey(address_data.first_name, address_data.last_name, card_data.pan, address_data.postal_code);
            if (!cardholder_data.custom_data) {
                cardholder_data.custom_data = {};
            }
            cardholder_data.custom_data.cardsavr_card_data = { meta_key : meta_key };
            address_data.cardholder_ref = card_data.cardholder_ref = merchant_creds.cardholder_ref;
            card_data.address = address_data;
        }
        const agent_session = this.getSession(agent_username);
        const job_data = {"status" : "REQUESTED", "caardholder" : cardholder_data, "card" : card_data, "account" : merchant_creds, type};

        const headers : {[k: string]: string} = 
            {"financial-institution" : financial_institution, 
             "hydration" : JSON.stringify(["user", "account"])};

        const response = await agent_session.createSingleSiteJob(job_data, safe_key);
        return response.body;
    } catch(err) {
        this.handleError(err);
    }
    return null;
}

    private handleError(err: any) {
        console.log(err);
        if (err instanceof CardsavrRestError) {
            if (err.errors) {
                console.log("Errors returned from REST API : " + err.response.call);
                err = err.response;
                err.body._errors.map((obj: any) => {
                    console.log(obj);
                });
                Object.keys(err.body).filter((item: string) => err.body[item]._errors !== undefined).map(obj => {
                    console.log("For entity: " + obj);
                    console.log(err.body[obj]._errors);
                });
            } else if (err.response.body && err.response.body.message) {
                console.log("Message returned from REST API: " + err.response.body.message);
            }
        } else if (err instanceof CardsavrSDKError) {
            console.log("SDK errors, exception stack below:");
            console.log(err.errors);
            console.log(err.stack);
        } else {
            console.log("no errors from REST API, full error below:");
            console.log(err);
        }
    }

    private async lookupMerchantSite(username: string, host: string) {
        const session = this.getSession(username);
        const sites: CardsavrSessionResponse = await session.getMerchantSites({"host" : host});
        if (!sites || !sites.body || sites.body.length === 0 ) {
            return null;
        }
        const site = sites.body[0];
        if (!site ) {
            return null;
        }
        return site;
    }

    public async placeCardOnSites(place_card_config : placeCardOnSitesParams) : Promise<any> {
        const { username, jobs_data, safe_key = undefined, type = undefined } = place_card_config;
        const session = this._sessions[username];
        const jobs : job_data[] = [];
        if (session) {
            try {
                jobs_data.forEach(job => {
                    const account = {cardholder_id : session.getSessionUserId(),
                        username : job.merchant_creds.username, 
                        password : job.merchant_creds.password, 
                        merchant_site_id : job.merchant_creds.merchant_site_id};

                    jobs.push({
                        user_id : session.getSessionUserId(),
                        card_id : job.card_id,
                        account : account,
                        user_is_present : true,
                        status : job.status,
                        type    
                    });
                });
                return await session.createSingleSiteJobs(jobs, safe_key);
            } catch(err) {
                this.handleError(err);
            }
        } else {
            throw new CardsavrSDKError([], `No session established for: ${username}.  Need to call loginAndCreateSession?`);
        }
    }

    public async placeCardOnSite(place_card_config : placeCardOnSiteParams) : Promise<any> {
        const { username, merchant_creds, card_id = undefined, status = "REQUESTED", safe_key = undefined, type = undefined } = place_card_config;
        const session = this._sessions[username];
        if (session) {
            try {
                let merchant_site_id: number = parseInt(merchant_creds.merchant_site_id);
                if (!merchant_site_id && merchant_creds.site_hostname) {
                    const site: any = await this.lookupMerchantSite(username, merchant_creds.site_hostname);
                    if (site) {
                        merchant_site_id = site.id;
                    }
                }
                return await this.placeCardOnSites({username, jobs_data : [{merchant_creds, card_id, status}], safe_key, type });
            } catch(err) {
                this.handleError(err);
            }
        } else {
            throw new CardsavrSDKError([], `No session established for: ${username}.  Need to call loginAndCreateSession?`);
        }
    }

    public endSession(username: string) : void {
        const session = this.getSession(username);
        session.end();
        delete this._sessions[username];
         if(localStorageAvailable()) {
            window.sessionStorage.removeItem(`session_v2.3.1[${username}]`);
        }
     }

    public removeJob(jobId: number) : void {
        this._jobs.delete(jobId);
        if (this._jobs.size === 0) {
            clearInterval(this._user_probe);
        }
    }

    public async pollOnJob(poll_on_job_config: pollOnJobParams) : Promise<void> {
        const session = this.getSession(poll_on_job_config.username);
        const params = {...poll_on_job_config, user_id : session.getSessionUserId()};
        this.pollOnUserJob(params);
    }
    
    public async pollOnUserJob(poll_on_job_config : pollOnJobParams) : Promise<void> {
        const { username, job_id, user_id, callback, interval = 5000 } = poll_on_job_config;
        try {
            const session = this.getSession(username);
            
            if (this._jobs.size === 0 && user_id) {
                this._user_probe = setInterval(async () => { 
                    const messages = await session.getUserMessages(user_id);
                    if (messages.body) {
                        messages.body.map((item: any) => {
                            const handler = this._jobs.get(+item.job_id);
                            if (handler) { handler(item); }
                            
                            if (item.type === "job_status") {
                                if (item.message.termination_type || item.message.percent_complete == 100) { //job is completed, stop probing
                                    this.removeJob(+item.job_id);
                                }
                            }
                        });
                    }
                }, interval < 1000 ? 1000 : interval);
            }
            this._jobs.set(job_id, callback);
        } catch(err) {
            this.handleError(err);
        }
    }   

    public async placeCardOnSiteAndPoll(place_card_config : placeCardOnSiteAndPollParams) : Promise<void> {
        const { username, merchant_creds, card_id = undefined, callback, interval = 5000, type = undefined } = place_card_config;
        try {
            const job_data = await this.placeCardOnSite({username, merchant_creds, card_id, type});
            if (job_data) {
                this.pollOnJob({username, job_id : job_data.body.id, callback, interval});
            }
        } catch(err) {
            this.handleError(err);
        }
    }

    public async postTFA(post_tfa_config : postTFAParams) : Promise<void> {
        const { username, tfa, job_id, envelope_id } = post_tfa_config;
        try {
            const session = this.getSession(username); //session should already be loaded
            session.sendJobInformation(job_id, envelope_id, "tfa_response", tfa);
        } catch(err) {
            this.handleError(err);
        }
    }

    public async postCreds(post_creds_config : postCredsParams) : Promise<void> {
        const { username, merchant_creds, job_id, envelope_id, safe_key = undefined } = post_creds_config;
        try {
            const session = this.getSession(username);
            const acct = await session.getSingleSiteJobs(job_id);
            if (acct && acct.body && acct.body.account_id) { 
                session.updateAccount( 
                    acct.body.account_id,
                    {username : merchant_creds.username, password : merchant_creds.password}, 
                    envelope_id,
                    safe_key);
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
