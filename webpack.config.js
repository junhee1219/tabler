// webpack.config.js
const path = require('path');

module.exports = {
  entry: {
    background: './src/background.js',
    content:    './src/content.js',
    popup:      './src/popup/popup.js'
  },
  output: {
    filename: '[name].js',
    path:     path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: { 
          loader: 'babel-loader',
          options: { presets: ['@babel/preset-env'] }
        }
      }
    ]
  }
};
