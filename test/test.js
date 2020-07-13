"use strict";

const expect = require("chai").expect;
const { CardsavrHelper } = require("../lib/cardsavr/CardsavrHelper");
const { generateRandomPar } = require("../lib/cardsavr/CardsavrSessionUtilities");

describe("#CardsavrHelper", function() {

    it("should initialize settings", function() {
        const result = CardsavrHelper.getInstance().setAppSettings("api.localhost.cardsavr.com", "myapp", "mykey");
        expect(result).instanceof(CardsavrHelper);
        expect(result.app_name).equal("myapp");
        expect(result.app_key).equal("mykey");
        expect(result.cardsavr_server).equal("api.localhost.cardsavr.com");
    });

});

describe("#CardsavrSessionUtilities", function() {

    it("generateRandomPAR should be consistent", function() {
        const PAR = generateRandomPar("4111111111111111", "12", "24", "markbudos");
        expect(PAR).equal("C1PdrJAa7yl1bcor6cpx59TgXaFc=");
    });

});
