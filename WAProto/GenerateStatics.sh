sed -i 's/required /optional /g' WAProto.proto
pbjs -t static-module --no-beautify -w es6 --no-bundle --no-delimited --no-verify --no-comments -o ./index.js ./WAProto.proto;
node ./fix-imports.js
