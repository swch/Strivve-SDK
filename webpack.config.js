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
        extensions : [".ts", ".js", ".json"]
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
        axios : {
            commonjs : "axios",
            commonjs2 : "axios",
            amd : "axios",
            root : "axios",
        },
        crypto : {
            commonjs : "crypto",
            commonjs2 : "crypto",
            amd : "crypto",
            root : "crypto",
        },
        https : {
            commonjs : "https",
            commonjs2 : "https",
            amd : "https",
            root : "https",
        }
    },
};