# Strivve-SDK

This library is an implementation of the CardSavr API for Node.js or web applications. It contains methods for session management; security and cryptography; and resource retrieval, creation, updating, and deleting. By mangaging CardSavr's complex security requirements automatically, the JavaScript library greatly simplifies the implementation of CardSavr in your own app.

Please note: most methods in this library are asynchronous and therefore return resolved promises. Each method's individual documentation will specify if it is asynchronous.  Take a look at the Quick Start guide to get up and running with the CardSavr library.

## Installation

Beging by cloning the repository

```bash
git clone https://github.com/swch/Strivve-SDK.git
```

To try out the SDK, cd to the sample directory, and:

```bash
npm install
```

To build a webpack binary, run:

```bash
npm run dev (debug)
```

```bash
npm run prod (slightly smaller)
```


The webpack bundle is exported the dist/ folder and should be checked in with corresponding code changes.  It is possible that future devs might not be using NPM and may want to simply use the SDK in the client.

To build the commonjs version:

```bash
npm run build
```

As the npm module is in typescript, the lib directory is not checked into source control.  Upon making changes, the version number can be incremented and uploaded to npmjs.org

```bash
npm publish --access public
```

(You will need access to publish the npm module)

See [The sample setup](sample/) for a way to set up a sample backend server and client application using the webpack bundle.  