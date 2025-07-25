const path = require('path');

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';
  const clientPort = process.env.CLIENT_PORT || (parseInt(process.env.PORT || '3000') + 1);

  return {
  entry: './src/client/main.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            configFile: 'tsconfig.client.json',
            transpileOnly: false, // Enable type checking in dev mode
          }
        },
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
        staticOptions: {
          ignore: ['**/dist/**'] // Ignore static dist files to serve webpack in-memory bundle
        }
      }
    ],
    port: clientPort,
    hot: true,
    liveReload: true,
    watchFiles: ['client/**/*', 'src/**/*'],
    open: false,
    devMiddleware: {
      writeToDisk: false, // Keep files in memory for faster reloads
    },
  },
  mode: 'development',
  devtool: 'source-map',
  };
};