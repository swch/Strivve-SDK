'use strict';

var expect = require('chai').expect;
var { CardsavrHelper } = require('../lib/cardsavr/CardsavrHelper');

describe('#CardsavrHelper', function() {

    it('should initialize settings', function() {
        var result = CardsavrHelper.getInstance().setAppSettings("api.localhost.cardsavr.com", "myapp", "mykey");
        expect(result).instanceof(CardsavrHelper);
        expect(result.app_name).equal("myapp");
        expect(result.app_key).equal("mykey");
        expect(result.cardsavr_server).equal("api.localhost.cardsavr.com");
    });

});
