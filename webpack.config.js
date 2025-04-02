const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development', // Use 'production' for production builds
  entry: './renderer/src/index.js', // Entry point of our React app
  target: 'electron-renderer', // Target Electron's renderer process
  devtool: 'cheap-module-source-map', // Recommended source map for development
  output: {
    path: path.resolve(__dirname, 'renderer/dist'), // Ensure output is in renderer/dist
    filename: 'renderer.bundle.js', // Output bundle file name
    publicPath: './', // Set publicPath for relative asset loading
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/, // Match .js and .jsx files
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-react'] // Use the React preset
          }
        }
      },
      {
        test: /\.css$/i, // Match .css files
        use: ['style-loader', 'css-loader'], // Process CSS files
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i, // Add rule for images
        type: 'asset/resource', // Use Asset Modules
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './renderer/index.html' // Use our existing HTML as a template
    }),
    new webpack.DefinePlugin({
      'process.env.CLIENT_BUILD_TIME': JSON.stringify(new Date().toLocaleString()),
    })
  ],
  resolve: {
    extensions: ['.js', '.jsx'], // Allow importing .js and .jsx without specifying the extension
  },
}; 