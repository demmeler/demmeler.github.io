BASEDIR=$(dirname "$0")
pushd $BASEDIR

docker build --tag nodedev .

popd