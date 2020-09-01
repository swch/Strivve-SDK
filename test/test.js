"use strict";

const expect = require("chai").expect;
const { CardsavrHelper } = require("../lib/cardsavr/CardsavrHelper");
const { generateRandomPar, formatPath } = require("../lib/cardsavr/CardsavrSessionUtilities");

describe("#formatPath", function() {

    it("path with multiple ids and no filters", function() {
        const result = formatPath("merchant_sites", {top_hosts: "walmart.com,amazon.com,apple.com", exclude_hosts: "walmart.com"});
        expect(result).to.be.a('string');
        expect(result).to.equal("/merchant_sites?top_hosts=walmart.com,amazon.com,apple.com&exclude_hosts=walmart.com");
        console.log(result);
    });
    it("path with multiple hosts and no filters", function() {
        const result = formatPath("merchant_sites", {top_hosts: ["walmart.com,amazon.com", "apple.com"], exclude_hosts: ["walmart.com"]});
        expect(result).to.be.a('string');
        expect(result).to.equal("/merchant_sites?top_hosts=walmart.com,amazon.com&top_hosts=apple.com&exclude_hosts=walmart.com");
        console.log(result);
    });
    it("path with id and no filters", function() {
        const result = formatPath("merchant_sites", 1);
        expect(result).to.equal("/merchant_sites/1");
    });
    it("path with ids and no filters", function() {
        const result = formatPath("merchant_sites", {"ids": "1,2"});
        expect(result).to.equal("/merchant_sites?ids=1,2");
    });
    it("path with hostnames and no filters", function() {
        const result = formatPath("merchant_sites", {"hosts": ["amazon.com","apple.com"]});
        expect(result).to.equal("/merchant_sites?hosts=amazon.com&hosts=apple.com");
    });

});

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
