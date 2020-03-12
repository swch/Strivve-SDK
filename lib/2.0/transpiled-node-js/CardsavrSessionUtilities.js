"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const JSLibraryError_1 = require("./JSLibraryError");
const crypto = require("crypto");
exports.generateHydrationHeader = (hydrationArray) => {
    let stringifiedHeader = JSON.stringify(hydrationArray);
    return { "hydration": stringifiedHeader };
};
const _stringReplaceAll = function (string, find, replace) {
    if (!string) {
        return string;
    }
    let replaced_string = string;
    while (replaced_string.includes(find)) {
        replaced_string = replaced_string.replace(find, replace);
    }
    return replaced_string;
};
exports.generateTraceValue = (bytes) => {
    if (bytes || typeof bytes !== "number") {
        bytes = 16;
    }
    const rb64 = crypto.randomBytes(bytes).toString("base64");
    let traceValue = rb64;
    traceValue = _stringReplaceAll(traceValue, "+", "-");
    traceValue = _stringReplaceAll(traceValue, "/", "_");
    traceValue = _stringReplaceAll(traceValue, "=", "");
    return traceValue;
};
const stringIdPaths = ['/card_placement_results', '/sites'];
exports.formatPath = (path, filter) => {
    let validationErrors = [];
    if (!path.startsWith('/')) {
        path = '/' + path;
    }
    if (path.endsWith('/')) {
        path = path.substring(0, path.length - 1);
    }
    if (filter) {
        if (!isNaN(filter) || (typeof filter == 'string' && stringIdPaths.includes(path))) {
            path = `${path}/${filter}`;
        }
        else if (typeof filter === 'object' && !Array.isArray(filter)) {
            let filterProperties = Object.keys(filter);
            for (var x = 0; x < filterProperties.length; x++) {
                if (x == 0) {
                    path = path + "?";
                }
                path = path + filterProperties[x] + "=" + filter[filterProperties[x]];
                if (x != filterProperties.length - 1) {
                    path = path + ',';
                }
            }
        }
        else {
            validationErrors.push("Valid ID or filter not found in provided path.");
            throw new JSLibraryError_1.default(validationErrors, null);
        }
    }
    return path;
};
exports.generateRandomPar = (pan, exp_month, exp_year, salt) => {
    let paramsArray = [pan, exp_month, exp_year, salt];
    let validationErrors = [];
    for (var param of paramsArray) {
        if (!param) {
            validationErrors.push("Missing required parameter: " + param);
        }
    }
    pan = pan.toString();
    var exp_month_string = exp_month.toString();
    var exp_year_string = exp_year.toString();
    salt = salt.toString();
    if (pan.length !== 15 && pan.length !== 16) {
        validationErrors.push("Invalid PAN length (PAN must be 15 or 16 integers), received length of: " + pan.length);
    }
    if ((exp_month_string.length != 2) || isNaN(exp_month) || (exp_month > 12)) {
        validationErrors.push("Invalid expiration month received: " + exp_month);
    }
    if ((exp_year_string.length != 2) || isNaN(exp_year)) {
        validationErrors.push("Invalid expiration year received: " + exp_year);
    }
    if (validationErrors.length > 0) {
        throw new JSLibraryError_1.default(validationErrors, null);
    }
    // Hash up the salt for use as salt
    const hashS = crypto.createHash("sha256");
    hashS.update(salt + exp_month + exp_year);
    const salt_buffer = hashS.digest();
    // Hashup the PAN into 128bits
    const hashP = crypto.createHash("md5");
    hashP.update(pan);
    const panHash = hashP.digest();
    const PARHash = crypto.pbkdf2Sync(panHash, salt_buffer, 5000, 16, "md5");
    const PAR = "CSAVR" + PARHash.toString('base64');
    return PAR;
};
exports.getCardBrand = function (pan) {
    let validationErrors = [];
    pan = pan.toString();
    const brandRegexes = {
        "visa": /^4[0-9]{12}(?:[0-9]{3})?$/,
        "mastercard": /^5[1-5][0-9]{14}$/,
        "amex": /^3[47][0-9]{5,}$/,
        "discover": /^6(?:011|5[0-9]{2})[0-9]{12}$/
    };
    let brands = Object.keys(brandRegexes);
    for (var brand of brands) {
        let regex = brandRegexes[brand];
        if (pan.match(regex)) {
            return brand;
        }
    }
    validationErrors.push("Card number could not be matched to a recognized brand.");
    throw new JSLibraryError_1.default(validationErrors, null);
};
//# sourceMappingURL=CardsavrSessionUtilities.js.map