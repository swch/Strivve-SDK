# Strivve-SDK

This library is an implementation of the CardSavr API for Node.js or web applications. It contains methods for session management; security and cryptography; and resource retrieval, creation, updating, and deleting. By mangaging CardSavr's complex security requirements automatically, the JavaScript library greatly simplifies the implementation of CardSavr in your own app.

Please note: most methods in this library are asynchronous and therefore return resolved promises. Each method's individual documentation will specify if it is asynchronous.  Take a look at the Quick Start guide to get up and running with the CardSavr library.

## Quick Start Guide

The Strivve Javascript SDK library is built around a class, CardsavrSession. To start using the library, you must instantiate a new CardsavrSession object.  This requires the following items:

1. API url (e.g. api.acmebank.cardsavr.io)
1. App name (app_name) and integrator key (app_key) - these can be obtained by contacting developer-support@strivve.com
1. App username and password - also obtained from a CardSavr administrator.  Simple applications (like the quick start) require a cardholder agent, while more complex applications may require a customer agent.

```javascript
var app_name = "CardUpdatr Demo"; //This can be anything
var app_key = "oqLSC5V/R4w42crQT7x0HjcM5NnS2tiyTzWSxnOVZdU=". //from administrator
var cardsavr_server = "https://api.acmebank.cardsavr.io";  //please use acmebank for demonstration purposes 

result = get_hash_key_values();
var session = new strivvesdk.CardsavrSession(cardsavr_server, app_key, app_name, result.username, null, result.grant);
var user = await session.init();
```

To start a session and log in to CardSavr, call .init on your CardsavrSession instance.

let sessionStarted = await mySession.init()
.init(), like all CardSavr session methods, returns either a CardsavrSessionResponse object (in case of success) or a JSLibraryError object (if the JS library catches an error before the request is sent to CardSavr).
