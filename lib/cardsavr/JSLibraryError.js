"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var JSLibraryError = /** @class */ (function () {
    function JSLibraryError(validationErrors, otherErrors) {
        this.validationErrors = validationErrors;
        this.otherErrors = otherErrors;
    }
    return JSLibraryError;
}());
exports.default = JSLibraryError;
;
