var webpack = require('webpack');
var path = require('path');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

module.exports = {
    entry: 'visualization_source',
    resolve: {
        root: [
            path.join(__dirname, 'src'),
        ],
        alias: {
            jquery: "jquery/src/jquery",
            'jquery-ui': './contrib/jquery-ui-1.12.1.custom',
        }
    },
    output: {
        filename: 'visualization.js',
        libraryTarget: 'amd'
    },
    plugins: [
        new webpack.ProvidePlugin({
            $: "jquery",
            jQuery: "jquery",
            "window.jQuery": "jquery"
        }),
        new ExtractTextPlugin("visualization.css"),
    ],
    module: {
        loaders: [
            { test: /\.css$/, loader: ExtractTextPlugin.extract("style-loader", "css-loader") },
            { test: /\.(jpg|png)$/, loader: 'file' },
        ]
    },
    externals: [
        'splunkjs/mvc/searchmanager',
        'splunkjs/mvc',
        'api/SplunkVisualizationBase',
        'api/SplunkVisualizationUtils'
    ]
};
