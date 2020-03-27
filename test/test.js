'use strict';

var expect = require('chai').expect;
var { numToWord, wordToNum } = require('../lib/index');

describe('#numFormatter', function() {

    it('should convert one', function() {
        var result = numToWord(1);
        expect(result).to.equal('One');
    });
    it('should convert two', function() {
        var result = numToWord(2);
        expect(result).to.equal('Two');
    });
    it('should convert three', function() {
        var result = numToWord(3);
        expect(result).to.equal('Three');
    });
    it('should convert 1', function() {
        var result = wordToNum('One');
        expect(result).to.equal(1);
    });
    it('should convert 2', function() {
        var result = wordToNum('Two');
        expect(result).to.equal(2);
    });
    it('should convert 3', function() {
        var result = wordToNum('Three');
        expect(result).to.equal(3);
    });

});
