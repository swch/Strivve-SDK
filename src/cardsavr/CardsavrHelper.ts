"use strict";

import { CardsavrSession } from "./CardsavrJSLibrary-2.0";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import { generateRandomPar, localStorageAvailable, generateUniqueUsername } from "./CardsavrSessionUtilities";
import CardsavrSDKError from "./CardsavrSDKError";
import CardsavrRestError from "./CardsavrRestError";

type MessageHandler = (str: string) => void;
type cardholder_data = {[k: string]: any};
type account = {[k: string]: any};
type card_data = {[k: string]: any};

interface job_data {
    account : account,
    user_is_present? : boolean,
    cardholder?: cardholder_data, 
    cardholder_id? : number,
    card? : card_data,
    card_id? : number,
    status? : string,
    type? : string,
    queue_name? : string
}

interface placeCardParams {
    username : string,  
    financial_institution? : string, 
    safe_key? : string,
}

interface placeCardOnSiteParams extends placeCardParams {
    job_data : job_data,
}

interface placeCardOnSitesParams extends placeCardParams {
    jobs_data : job_data[]
}

interface pollOnEstablishedJob extends pollOnJob {
    cardholder_id: number
    job_id: number,
}

interface pollOnJob {
    username : string,  
    callback : MessageHandler, 
    interval? : number
}

interface placeCardOnSiteAndPollParams extends placeCardOnSiteParams, pollOnJob {
}

interface createCardParams {
    agent_username : string, 
    financial_institution : string, 
    card : card_data, 
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
    private proxy?: string;
    private reject_unauthorized = true;
    private debug = false;

    public setAppSettings(cardsavr_server: string, app_name: string, app_key: string, reject_unauthorized = true, cert?: string, debug = false) : CardsavrHelper {
        this.cardsavr_server = cardsavr_server;
        this.app_name = app_name;
        this.app_key = app_key;
        if (!app_name) {
            throw new CardsavrSDKError([], "No app_name provided.");
        } else if (!app_key) {
            throw new CardsavrSDKError([], "No app_key provided.");
        }
        this.cert = cert;
        this.reject_unauthorized = reject_unauthorized;
        this.debug = debug;
        return this;
    }
    
    public async loginAndCreateSession(username: string, 
                                       password: string,
                                       trace?: {[k: string]: unknown}) : Promise<CardsavrSession> {

        let session : CardsavrSession | null = this._sessions[username];
        if (session || (session = await this.restoreSession(username, trace))) {
            return session;
        }
        session = new CardsavrSession(this.cardsavr_server, this.app_key, this.app_name, this.reject_unauthorized, this.cert, this.proxy, this.debug);
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
        const { card, agent_username, financial_institution, safe_key = null } = create_card_config;
        try {
            //don't need the login data
            const cardholder_data_copy = { ...card?.cardholder };
            const address_data_copy = { ...card?.address };
            const card_data_copy = { ...card };

            if (!cardholder_data_copy.cuid) {
                cardholder_data_copy.cuid = generateUniqueUsername();
            }
            //set the missing settings for model
            if (!cardholder_data_copy.first_name) cardholder_data_copy.first_name = address_data_copy.first_name;
            if (!cardholder_data_copy.last_name) cardholder_data_copy.last_name = address_data_copy.last_name;
            if (!cardholder_data_copy.name_on_card) card_data_copy.name_on_card = `${card_data_copy.first_name} ${card_data_copy.last_name}`;
            
            const agent_session = this.getSession(agent_username);

            //card requires a user id
            address_data_copy.cardholder_ref = {"cuid" : cardholder_data_copy.cuid };
            address_data_copy.user_ref = {"username" : cardholder_data_copy.username };
            card_data_copy.address = address_data_copy;
            card_data_copy.cardholder = cardholder_data_copy;
            if (!card_data_copy.par) {
                card_data_copy.par = generateRandomPar(card_data_copy.pan, card_data_copy.expiration_month, card_data_copy.expiration_year, cardholder_data_copy.cuid);
            }

            const headers : {[k: string]: string} = 
                {"x-cardsavr-financial-institution" : financial_institution, 
                "x-cardsavr-hydration" : JSON.stringify(["cardholder"])};

            const card_response = await agent_session.createCard(card_data_copy, safe_key, headers);     
     
            return card_response.body;
    
        } catch(err) {
            this.handleError(err);
        }
        return null;
    }

    public async placeCardOnSiteSingleCall(place_card_config: placeCardOnSiteParams) : Promise<unknown> {
        const { username, job_data, financial_institution = "default", safe_key = null } = place_card_config;
        const { cardholder, card, account } = place_card_config.job_data;
        const address = card?.address;
        if (!cardholder) {
            throw new CardsavrSDKError([], "Cannot create a job without a cardholder.");
        }
        try {
            //set the missing settings for model
            if (!cardholder.first_name && address) cardholder.first_name = address.first_name;
            if (!cardholder.last_name && address) cardholder.last_name = address.last_name;
            if (!cardholder.cuid) cardholder.cuid = generateUniqueUsername();
            if (card && !card.name_on_card) card.name_on_card = `${cardholder.first_name} ${cardholder.last_name}`;
            place_card_config.job_data.type = place_card_config.job_data.type ?? "CARD_PLACEMENT";

            if (card && !card.par) {
                card.par = generateRandomPar(card.pan, card.expiration_month, card.expiration_year, cardholder.cuid);
            }
            account.cardholder_ref = {"cuid" : cardholder.cuid };

            if (card) {
                card.cardholder_ref = account.cardholder_ref;
            }
            if (address)  {
                address.cardholder_ref = account.cardholder_ref;
            }
            const agent_session = this.getSession(username);
            
            const headers : {[k: string]: string} = 
                {"x-cardsavr-financial-institution" : financial_institution, 
                 "x-cardsavr-hydration" : JSON.stringify(["user", "account"])};

            const response = await agent_session.createSingleSiteJob(job_data, safe_key, headers);
            return response.body;
        } catch(err) {
            this.handleError(err);
        }
        return null;
    }

    private handleError(err: any) {
        if (err instanceof CardsavrRestError || (err.type && err.type === "CardsavrRestError")) {
            if (err.errors) {
                console.log("Errors returned from REST API : " + err.response.call);
                err = err.response;
                err.body._errors.map((obj: any) => {
                    console.log(obj);
                });
                Object.keys(err.body).filter((item: string) => err.body[item]._errors !== undefined).forEach(obj => {
                    console.log("For entity: " + obj);
                    console.log(err.body[obj]._errors);
                });
            } else if (err.response.body) {
                console.log(err.response);
                console.log("Message returned from REST API: " + err.response.body.message);
            }
        } else if (err instanceof CardsavrSDKError || (err.type && err.type === "CardsavrSDKError")) {
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

    // Assumption is the card and cardholder are already created.
    public async placeCardOnSites(place_card_config : placeCardOnSitesParams) : Promise<any> {

        const { username, jobs_data, safe_key = null } = place_card_config;

        const session = this._sessions[username];
        const jobs : job_data[] = [];
        if (session) {
            try {
                jobs_data.forEach(job => {
                    job.account.cardholder_id = job.account.cardholder_id ?? job.cardholder_id;
                    jobs.push(job);
                });
                return await session.createSingleSiteJobs(jobs, safe_key);
            } catch(err) {
                console.log("Exception caught in placeCardOnSites");
                this.handleError(err);
            }
        } else {
            throw new CardsavrSDKError([], `No session established for: ${username}.  Need to call loginAndCreateSession?`);
        }
    }

    public async placeCardOnSite(place_card_config : placeCardOnSiteParams) : Promise<any> {

        const { username, job_data, safe_key = undefined } = place_card_config;
        const { account } = place_card_config.job_data;

        const session = this._sessions[username];
        if (session) {
            try {
                if (!account.merchant_site_id && account.site_hostname) {
                    const site: any = await this.lookupMerchantSite(username, account.site_hostname);
                    if (site) {
                        account.merchant_site_id = site.id;
                    }
                }
                return await this.placeCardOnSites({username, jobs_data : [job_data], safe_key });
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

    public async pollOnJob(poll_on_job_config: pollOnEstablishedJob) : Promise<void> {
        
        this.pollOnCardholderJob(poll_on_job_config);
    }

    public async pollOnCardholderJob(poll_on_job_config : pollOnEstablishedJob) : Promise<void> {
        const { username, job_id, cardholder_id, callback, interval = 5000 } = poll_on_job_config;
        if (!job_id) {
            throw new CardsavrSDKError([], "Can't poll a cardholder without a job.");
        }
        try {
            const session = this.getSession(username);
            
            if (this._jobs.size === 0 && cardholder_id) {
                this._user_probe = setInterval(async () => { 
                    try {
                        const messages = await session.getCardholderMessages(cardholder_id);
                        if (messages.body) {
                            messages.body.map(async (item: any) => {
                                if (item.type === "job_status") {
                                    const handler = this._jobs.get(+item.job_id);
                                    if (handler) { 
                                        handler(item); 
                                        if (item.message.status.startsWith("PENDING_NEWCREDS") || item.message.status.startsWith("PENDING_TFA")) {
                                            let tries = 2;
                                            while (tries-- >= 0) {
                                                const job = await session.getSingleSiteJobs(item.job_id, {}, {"x-cardsavr-hydration" : JSON.stringify(["credential_requests"]) });
                                                if (job.body.credential_requests[0]) {
                                                    console.log("JOB IS PENDING " + item.message.status + " and there are " + job.body.credential_requests.length + " credential requests returned for this job");
                                                    handler(job.body.credential_requests[0]);
                                                    break;
                                                } else if (tries == 1) {
                                                    console.log("JOB IS PENDING " + item.message.status + " and there are no credential requests, let's try one more time");
                                                    await new Promise(resolve => setTimeout(resolve, 2000));
                                                } else {
                                                    throw new CardsavrSDKError([], "Fatal error, no credential request found for this job.");
                                                }
                                            }
                                        }
                                    }
                                    if (item.message.termination_type || item.message.percent_complete == 100) { //job is completed, stop probing
                                        this.removeJob(+item.job_id);
                                    }
                                }
                            });
                        }
                    } catch (err) {
                        this._jobs.clear();
                    }
                }, interval < 2000 ? 2000 : interval);
            }
            this._jobs.set(job_id, callback);
        } catch(err) {
            this.handleError(err);
        }
    }   

    public async placeCardOnSiteAndPoll(place_card_config : placeCardOnSiteAndPollParams) : Promise<void> {
        try {
            const job = await this.placeCardOnSite(place_card_config);
            if (job) {
                this.pollOnJob({...place_card_config, job_id : job.job_id, cardholder_id : job.cardholder_id});
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
