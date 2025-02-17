"use strict";

import { CardsavrSession, paging_header } from "./CardsavrJSLibrary-2.0";
import CardsavrSessionResponse from "./CardsavrSessionResponse";
import { generateRandomPar, localStorageAvailable, generateUniqueUsername } from "./CardsavrSessionUtilities";
import CardsavrSDKError from "./CardsavrSDKError";
import CardsavrRestError from "./CardsavrRestError";

type MessageHandler = (message: jobMessage) => void;
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

interface jobMessage {
    type: string, 
    job_id: number, 
    message?: {
        status : string, 
        percent_complete : number, 
        termination_type? : string,
        status_message : string,
        job_duration : number
    },
    error_message? : string,
    account_link?: { key_name : string, type : string, secret : string, label : string }[]
}

interface placeCardOnSiteParams extends placeCardParams {
    job_data : job_data
}

interface placeCardOnSitesParams extends placeCardParams {
    jobs_data : job_data[]
}

interface createCardParams {
    agent_username : string, 
    financial_institution? : string, 
    card : card_data, 
    safe_key? : string
}

interface postCredsParams {
    username: string, 
    account_link: {[k: string]: string}, 
    job_id: number, 
    envelope_id: string,
    safe_key?: string
}

export class CardsavrHelper {
    
    private static instance: CardsavrHelper;

    private _sessions: { [key:string]:CardsavrSession; } = {};

    private cardsavr_server = "";
    private app_name = "";
    private app_key = "";
    private cert?: string;
    private proxy?: string;
    private reject_unauthorized = true;
    private debug = false;

    public setAppSettings(cardsavr_server: string, app_name: string, app_key: string, reject_unauthorized = true, cert?: string, proxy?: string, debug = false) : CardsavrHelper {
        this.cardsavr_server = cardsavr_server;
        this.app_name = app_name;
        this.app_key = app_key;
        if (!app_name) {
            throw new CardsavrSDKError([], "No app_name provided.");
        } else if (!app_key) {
            throw new CardsavrSDKError([], "No app_key provided.");
        }
        this.cert = cert;
        this.proxy = proxy;
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
                    throw err;
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
            card_data_copy.address = address_data_copy;
            card_data_copy.cardholder = cardholder_data_copy;
            if (!card_data_copy.par) {
                card_data_copy.par = generateRandomPar(card_data_copy.pan, card_data_copy.expiration_month, card_data_copy.expiration_year, cardholder_data_copy.cuid);
            }

            const headers : {[k: string]: string} = 
                {"x-cardsavr-hydration" : JSON.stringify(["cardholder"])};
            if (financial_institution) {
                headers["x-cardsavr-financial-institution"] = financial_institution;
            }

            const card_response = await agent_session.createCard(card_data_copy, safe_key, headers);     

            return card_response.body;
    
        } catch(err) {
            this.handleError(err);
        }
        return null;
    }

    public async placeCardOnSiteSingleCall(place_card_config: placeCardOnSiteParams) : Promise<unknown> {
        const { username, job_data, financial_institution = null, safe_key = null } = place_card_config;
        const job_data_copy = JSON.parse(JSON.stringify(job_data));
        const { cardholder, card, account } = job_data_copy;
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
            
            const headers : {[k: string]: string | null} = 
                {"x-cardsavr-hydration" : JSON.stringify(["cardholder", "account", "card"])};
            if (financial_institution) {
                headers["x-cardsavr-financial-institution"] = financial_institution;
            }
            const response = await agent_session.createSingleSiteJob(job_data_copy, safe_key, headers);
            return response.body;
        } catch(err) {
            this.handleError(err);
        }
        return null;
    }

    private crawlErrors(obj : any ) : string[] {
        const ret: any[] = [];
        if (obj._errors) {
            obj._errors.map((error: any) => {
                ret.push(error);
            });
        }
        Object.keys(obj).filter((item: string) => {
            return obj[item]?._errors !== undefined;
        }).forEach(hydrated => {
            ret.push(this.crawlErrors(obj[hydrated]));
        });
        return ret;
    }

    private handleError(err: any) {
        if (err instanceof CardsavrRestError || (err.type && err.type === "CardsavrRestError")) {
            //check for error object on response
            //if it's an array, walk each element
            //also check the child elements of each object
            if (err.errors) {
                console.log("Errors returned from REST API : " + err.response.call);
                err = err.response;
                if (err.body._errors) {
                    console.log(this.crawlErrors(err.body));
                } else if (Array.isArray(err.body)) {
                    err.body.map((obj: { _errors: any[]; }) => {
                        console.log(this.crawlErrors(obj));
                    });
                }
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
                return await session.createSingleSiteJobs(jobs, safe_key, {"x-cardsavr-hydration" : JSON.stringify(["account"])});
            } catch(err) {
                console.log("Exception(s) caught in placeCardOnSites");
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

    public async postCreds(post_creds_config : postCredsParams) : Promise<void> {
        const { username, account_link, job_id, envelope_id, safe_key = undefined } = post_creds_config;
        const session = this.getSession(username);
        return await session.updateSingleSiteJob( 
            job_id,
            { account : { account_link } }, 
            safe_key,
            envelope_id ? { "x-cardsavr-envelope-id" : envelope_id } : undefined
        );
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

    public createCardholderQuery(username: string, cardholder_id : number) : CardholderQuery {
        const session = this.getSession(username);
        return new CardholderQuery(cardholder_id, session);
    }

} 

export class CardholderQuery {

    cardholder_id: number;
    session: CardsavrSession;
    interval: number;
    event_emitter: EventEmitter;
    private _user_probe?: ReturnType<typeof setTimeout>;
    private creds_callbacks: { [key: number] : MessageHandler } = {};
    
    constructor(cardholder_id: number, 
                session : CardsavrSession,
                interval = 2000) {
        this.cardholder_id = cardholder_id;
        this.session = session;
        this.interval = interval;
        this.event_emitter = new EventEmitter();
    }

    public resetSession(session : CardsavrSession) : void {
        this.session = session;
    }

    private async credsRequestHandler(message : jobMessage) {
        if (message.message?.status.startsWith("PENDING") && !message.account_link) {
            let tries = 2;
            while (tries-- >= 0) {
                const job = await this.session.getSingleSiteJobs(message.job_id, {} as paging_header, {"x-cardsavr-hydration" : JSON.stringify(["credential_requests"]) });
                if (job.body.credential_requests[0]) {
                    if (message.message?.status.toLowerCase() !== "pending") {
                        this.event_emitter.emit(`${message.job_id}:${message.message?.status.toLowerCase()}`, job.body.credential_requests[0]);
                    }
                    this.event_emitter.emit(`${message.job_id}:pending`, job.body.credential_requests[0]);
                    this.event_emitter.emit(`${message.job_id}:`, job.body.credential_requests[0]);
                    break;
                } else if (tries == 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    this.event_emitter.emit(`${message.job_id}:${message.message?.status.toLowerCase()}`, 
                        { job_id : message.job_id, type : "error", error_message : "No credential requests for this job." }
                    );
                }
            }
        } else if (message.message?.termination_type && this.creds_callbacks[message.job_id]) {
            this.removeListener(message.job_id,  this.creds_callbacks[message.job_id], "job_status");
            delete this.creds_callbacks[message.job_id];
        }
    }

    public addListener(job_id : number, 
        handler : MessageHandler,
        type?: string) : void { 
        this.event_emitter.on(`${job_id}:${type ?? ""}`, handler);

        if (!this.creds_callbacks[job_id]) {
            this.creds_callbacks[job_id] = ((message : jobMessage) => this.credsRequestHandler(message));
            this.addListener(job_id, this.creds_callbacks[job_id], "job_status");
        }
        if (Object.keys(this.event_emitter.callbacks).length > 0) {
            this.runProbe();
        }
    }

    public removeListeners(job_id : number) : void {
        Object.keys(this.event_emitter.callbacks).map(key => {
            const [job_id_str, type] = key.split(":");
            if (job_id_str === `${job_id}`) {
                this.event_emitter.callbacks[key].map(handler => {
                    this.removeListener(job_id, handler, type);
                });
            }
        });
    }

    public removeListener(job_id : number, 
        handler : MessageHandler,
        type?: string) : void { 
        this.event_emitter.remove(`${job_id}:${type ?? ""}`, handler);
        if (Object.keys(this.event_emitter.callbacks).length === 0) {
            this.stopProbe();
        }
    }

    public removeAll() : void {
        this.event_emitter.removeAll();
        this.stopProbe();
    }

    private stopProbe() {
        if (this._user_probe) {
            clearInterval(this._user_probe);
            this._user_probe = undefined;
        }
    }

    private runProbe() {
        if (this._user_probe) {
            return;
        }
        let tries = 0;
        this._user_probe = setInterval(async () => { 
            try {
                //if (!this.event_emitter.callbacks?.legnth) {
                //    return;
                //}
                const messages = await this.session.getCardholderMessages(this.cardholder_id);
                // if there's an error, we should say so, stop the probe, and send a status message that says the message channel is no longer available.
                tries = 0;
                if (messages.body) {
                    messages.body.map(async (item: jobMessage) => {
                        this.event_emitter.emit(`${item.job_id}:${item.type}`, item);
                        this.event_emitter.emit(`${item.job_id}:`, item);
                    });
                }
            } catch (err) {
                if (tries++ > 10) {
                    this.event_emitter.emitAll({ job_id : -1, type : "error", error_message : `CardSavr connection no longer available for cardholder_id: ${this.cardholder_id}.` });
                    this.removeAll();
                }
            }
        }, this.interval);
    }
}

export class EventEmitter {
    
    callbacks: {[k: string]: MessageHandler[]};
    
    constructor() {
        this.callbacks = {};
    }

    on (event: string, cb: MessageHandler) : void {
        if (!this.callbacks[event]) this.callbacks[event] = [];
        this.callbacks[event].push(cb);
        //console.log(this.callbacks);
    }

    remove (event: string, cb: MessageHandler) : void {
        //console.log("REMOVE: " + event);
        if (this.callbacks[event]) {
            //console.log("FOUND CALLBACKS FOR: " + event);
            this.callbacks[event] = this.callbacks[event].filter(item => item != cb);
            
            if (this.callbacks[event].length === 0) {
                //console.log("DELETE: " + event);
                delete this.callbacks[event];
            }
            //console.log(this.callbacks);
        }
    }

    emitAll (data : jobMessage) : void {
        Object.values(this.callbacks).map(cbs => cbs.forEach(cb => {
           return cb(data);
        }));
    }

    removeAll () : void {
        this.callbacks = {};
    }

    emit (event: string, data: jobMessage) : void {
        const cbs = this.callbacks[event];
        if(cbs){
            cbs.forEach(cb => {
                return cb(data);
            });
        }
    }
}
