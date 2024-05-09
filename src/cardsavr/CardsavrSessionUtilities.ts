import CardsavrSDKError from  "./CardsavrSDKError";
import * as crypto from "crypto";

export const generateHydrationHeader = (hydrationArray: any) : any => {
    const stringifiedHeader = JSON.stringify(hydrationArray);
    return {"x-cardsavr-hydration" : stringifiedHeader};
};

const _stringReplaceAll = function (string: any, find: string, replace: string) {
    if (!string) {
        return string;
    }
  
    let replaced_string = string;
    while (replaced_string.includes(find)) {
        replaced_string = replaced_string.replace(find, replace);
    }
  
    return replaced_string;
};

export const generateTraceValue = (bytes? : number) : string => {
    if (!bytes) {
        bytes = 16;
    }

    const rb64 = crypto.randomBytes(bytes).toString("base64");

    let traceValue = rb64;
    traceValue = _stringReplaceAll(traceValue, "+", "-");
    traceValue = _stringReplaceAll(traceValue, "/", "_");
    traceValue = _stringReplaceAll(traceValue, "=", "");

    return traceValue;
};
  
const stringIdPaths = ["/card_placement_results","/merchant_sites"];

export type APIFilter = number | {[key: string]: number [] | number | string | string[]} | null;

export const formatPath = (path : string, filter : APIFilter) : string => {

    const validationErrors = [];

    if (!path.startsWith("/")) {
        path = "/" + path;
    }
    if (path.endsWith("/")) {
        path = path.substring(0, path.length - 1);
    }
    if (filter) {
        // runtime check
        if (typeof filter === "number") {
            path = `${path}/${filter}`;
        }
        else if (typeof filter === "object" && !Array.isArray(filter)) {
            path += "?" + Object.keys(filter).map(k => 
                Array.isArray(filter[k]) ?
                (filter[k] as string[]).map((o: string) => `${k}=${o}`).join("&") : 
                `${k}=${filter[k]}`)
                .join("&");
        }
        else {
            validationErrors.push("Valid ID or filter not found in provided path: " + filter + " type: " + (typeof filter));
            throw new CardsavrSDKError(validationErrors);
        }
    }
    return path;
};

export const createMetaKey = (first_name: string, last_name: string, pan: string, postal_code: string) => {
    const validationErrors: string[] = [];
    if (!first_name || first_name.length === 0) { validationErrors.push("Can't create meta_key, no first name on card"); }
    if (!last_name || last_name.length === 0) { validationErrors.push("Can't create meta_key, no last name on card"); }
    if (!postal_code || postal_code.length < 5) { validationErrors.push("Can't create meta_key, invalid postal code"); }
    if (!pan || pan.length === 0) { validationErrors.push("Can't create meta_key, no pan on card"); }
    if (validationErrors.length > 0) {
        throw new CardsavrSDKError(validationErrors);
    }
    return first_name[0] + last_name[0] + postal_code.substring(0, 5) + pan.slice(-2);
};

export const generateUniqueUsername = (): string => {
    const length = 20;
    return [...Array(length)].map(() => (~~(Math.random() * 36)).toString(36)).join("");
};

export const generateRandomPar = (pan: string, exp_month: string, exp_year: string, salt: string) : string => {
    const paramsArray = {"pan" : pan, "exp_month" : exp_month, "exp_year" : exp_year, "salt" : salt};
    const validationErrors = [];

    Object.entries(paramsArray).filter(param => !param[1]).forEach(param => validationErrors.push("Missing required parameter: " + param[0]));
    
    if (exp_month && (exp_month.length != 2) || isNaN(+exp_month) || (+exp_month > 12)) {
        validationErrors.push("Invalid expiration month received: " + exp_month);
    }

    if (exp_year && (exp_year.length != 2) || isNaN(+exp_year)) {
        validationErrors.push("Invalid expiration year received: " + exp_year);
    }

    if (validationErrors.length > 0){
      throw new CardsavrSDKError(validationErrors);
    }

    // Hash up the salt for use as salt
    const hashS = crypto.createHash("sha256");
    hashS.update(salt + exp_month + exp_year);
    const salt_buffer = hashS.digest();

    // Hashup the PAN into 128bits
    const hashP = crypto.createHash("md5");
    hashP.update(pan);
    const panHash = hashP.digest();
    const PARHash = crypto.pbkdf2Sync(panHash.toString("utf8"), salt_buffer, 5000, 20, "sha1");
    const PAR = "C" + PARHash.toString("base64");

    return PAR;
};

export const getCardBrand = function(pan:string) {

    const validationErrors = [];

    pan = pan.toString();

    const brandRegexes: { [key: string]: RegExp } = {
      "visa" : /^4[0-9]{12}(?:[0-9]{3})?$/,
      "mastercard" : /^5[1-5][0-9]{14}$/,
      "amex" : /^3[47][0-9]{5,}$/,
      "discover" : /^6(?:011|5[0-9]{2})[0-9]{12}$/
    };

    const brands = Object.keys(brandRegexes);

    for(const brand of brands){

      const regex = brandRegexes[brand];

      if(pan.match(regex)){
        return brand;
      }
    }

    validationErrors.push("Card number could not be matched to a recognized brand.");

    throw new CardsavrSDKError(validationErrors);
};

export const get_host_config = function get_host_config(fi_override?: string, api_port_override? : string, api_instance_override? : string) {
    const hostname = window.location.hostname;
    let fi_lookup;
    let instance_root;
    let instance;
    if (!hostname.endsWith(".cardupdatr.app")) {
        //varomoney garbage which we don't even use anymore -- csapi.varomoney.com and updatecard.varomoney.com
        instance_root = hostname.replace(/^\w+\./, "");
        fi_lookup = hostname;
    } else {
        const nodes = hostname.split(".");
        if (nodes.length === 4) {
            fi_lookup = fi_override ?? nodes[0];
            nodes.shift();
        } else {
            fi_lookup = fi_override ?? "default";
        }
        instance = nodes[0] = api_instance_override || nodes[0];
        instance_root = nodes.join(".");
    }
    return { api_url : `https://csapi.${instance_root}${api_port_override ? `:${api_port_override}` : ""}/`, instance, fi_lookup };
};

export const localStorageAvailable = function() : boolean {
    if (typeof window === "undefined") {
        return false;
    }
    let storage;
    try {
        storage = window["sessionStorage"];
        const x = "__storage_test__";
        storage.setItem(x, x);
        storage.removeItem(x);
        return true;
    }
    catch(e) {
        return e instanceof DOMException && (
            // everything except Firefox
            e.code === 22 ||
            // Firefox
            e.code === 1014 ||
            // test name field too, because code might not be present
            // everything except Firefox
            e.name === "QuotaExceededError" ||
            // Firefox
            e.name === "NS_ERROR_DOM_QUOTA_REACHED") &&
                // acknowledge QuotaExceededError only if there's something already stored
                (storage !== undefined && storage.length !== 0);
    }
};
