const path = require("path");

module.exports = {
    entry : "./src/cardsavr/CardsavrHelper.ts",
    module : {
        rules : [
            {
                test : /\.tsx?$/,
                use : "ts-loader",
                exclude : /node_modules/,
            },
        ],
    },
    resolve : {
        extensions : [".ts", ".js", ".json"],
        fallback: {
            "http" : false,
            "https" : false,
            "net" : false,
            "tls" : false,
            "assert" : false,
            "url" : false
        }
    },
    output : {
        path : path.resolve(__dirname, "dist"),
        filename : "strivve-sdk.js",
        library : "strivvesdk",
        libraryTarget : "umd",
    },
    externals : {
        lodash : {
            commonjs : "lodash",
            commonjs2 : "lodash",
            amd : "lodash",
            root : "_",
        },
        "node-fetch" : {
            commonjs : "node-fetch",
            commonjs2 : "node-fetch",
            amd : "node-fetch",
            root : "node-fetch",
        },
        crypto : {
            commonjs : "crypto",
            commonjs2 : "crypto",
            amd : "crypto",
            root : "crypto",
        }
    },
};