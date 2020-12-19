
REPO_ROOT=$(git rev-parse --show-toplevel)

mkdir -vp $REPO_ROOT/node_build
cd $REPO_ROOT/node_build

npm install csv-parser moment lodash

cp ../server/update.js .
node update.js

cp incidenceData.json ../server
git add ../server/incidenceData.json
git commit -m "automatic update - $(date)"
git push
