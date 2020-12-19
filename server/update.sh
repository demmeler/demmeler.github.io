
REPO_ROOT=$(git rev-parse --show-toplevel)

mkdir -vp $REPO_ROOT/node_build
cd $REPO_ROOT/node_build

# copy RKI data
#cp ../server/RKI_COVID19.csv .

# install node modules
cp ../server/update.js .

npm install csv-parser moment lodash

node update.js
