# Strivve-SDK

This library is an implementation of the CardSavr API for Node.js or web applications. It contains methods for session management; security and cryptography; and resource retrieval, creation, updating, and deleting. By mangaging CardSavr's complex security requirements automatically, the JavaScript library greatly simplifies the implementation of CardSavr in your own app.

Please note: most methods in this library are asynchronous and therefore return resolved promises. Each method's individual documentation will specify if it is asynchronous.  Take a look at the Quick Start guide to get up and running with the CardSavr library.

## Quick Start Guide

The Strivve Javascript SDK library is built around a class, CardsavrSession. To start using the library, you must instantiate a new CardsavrSession object and pass in your base URL, initial shared secret key, app name, username, and password.

        var app_name = "CardUpdatr Demo";
        var app_key = "oqLSC5V/R4w42crQT7x0HjcM5NnS2tiyTzWSxnOVZdU="
        var cardsavr_server = "https://api.localhost.cardsavr.io";
        //var app_key = "TGSEjt4TuK0j55TeF7x1cao88Bc1j8nyHeaBHueT5gQ=";
        //var cardsavr_server = "https://api.mbudos.cardsavr.io";

        result = get_hash_key_values();
        var session = new strivvesdk.CardsavrSession(cardsavr_server, app_key, app_name, result.username, null, result.grant);
        var user = await session.init();

To start a session and log in to CardSavr, call .init on your CardsavrSession instance.

let sessionStarted = await mySession.init()
.init(), like all CardSavr session methods, returns either a CardsavrSessionResponse object (in case of success) or a JSLibraryError object (if the JS library catches an error before the request is sent to CardSavr).
