const path = require('path');

module.exports = {
  entry: './src/client/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@client': path.resolve(__dirname, 'src/client'),
    },
  },
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'client/dist'),
    publicPath: '/dist/',
  },
  devServer: {
    static: [
      {
        directory: path.join(__dirname, 'client'),
        publicPath: '/',
      }
    ],
    port: 3001,
    hot: true,
    open: false,
  },
  mode: 'development',
  devtool: 'source-map',
};