const path = require('path');

module.exports = {
    entry: './src/cardsavr/CardsavrJSLibrary-2.0.ts',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js', '.json']
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: 'strivve-sdk.js',
        library: 'strivvesdk',
        libraryTarget: 'umd',
    },
    externals: {
        lodash: {
            commonjs: 'lodash',
            commonjs2: 'lodash',
            amd: 'lodash',
            root: '_',
        },
        axios: {
            commonjs: 'axios',
            commonjs2: 'axios',
            amd: 'axios',
            root: 'axios',
        },
    },
};