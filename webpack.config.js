const path = require('path');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'src/popup/popup.js'),  // 번들링 시작 파일 경로
  output: {
    path: path.resolve(__dirname, 'dist'),               // 번들 파일이 생성될 폴더
    filename: 'popup.bundle.js',                         // 생성될 번들 파일 이름
    clean: true                                          // dist 폴더 정리 옵션 (Webpack 5 이상)
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',                          // ES6+ 코드 변환
          options: {
            presets: ['@babel/preset-env']                // 브라우저 호환성을 위한 설정
          }
        }
      }
    ]
  },
  resolve: {
    extensions: ['.js']                                  // 확장자 자동 해석
  }
};