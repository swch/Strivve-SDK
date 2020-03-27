"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_1 = __importDefault(require("lodash"));
var ref_json_1 = __importDefault(require("./ref.json"));
function numToWord(num) {
    return lodash_1.default.reduce(ref_json_1.default, function (accum, ref) {
        return ref.num === num ? ref.word : accum;
    }, '');
}
exports.numToWord = numToWord;
function wordToNum(word) {
    return lodash_1.default.reduce(ref_json_1.default, function (accum, ref) {
        return ref.word === word && word.toLowerCase() ? ref.num : accum;
    }, -1);
}
exports.wordToNum = wordToNum;
