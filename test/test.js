'use strict';

var expect = require('chai').expect;
var { CardsavrHelper } = require('../lib/cardsavr/CardsavrHelper');
var { generateRandomPar } = require('../lib/cardsavr/CardsavrSessionUtilities');

describe('#CardsavrHelper', function() {

    it('should initialize settings', function() {
        var result = CardsavrHelper.getInstance().setAppSettings("api.localhost.cardsavr.com", "myapp", "mykey");
        expect(result).instanceof(CardsavrHelper);
        expect(result.app_name).equal("myapp");
        expect(result.app_key).equal("mykey");
        expect(result.cardsavr_server).equal("api.localhost.cardsavr.com");
    });

});

describe('#CardsavrSessionUtilities', function() {

    it('generateRandomPAR should be consistent', function() {
        var PAR = generateRandomPar("4111111111111111", "12", "24", "markbudos");
        expect(PAR).equal("C1PdrJAa7yl1bcor6cpx59TgXaFc=");
    });

});

