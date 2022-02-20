set -e

USERNAME=$1
REPO=$2

if [[ -z "$USERNAME" ]] ; then
    echo 'No docker hub username provided'
    exit 0
fi

# extract name from package.json
TAG=$(sed 's/.*"name": "\(.*\)".*/\1/;t;d' ../package.json)
# extract version from package.json
VERSION=$(sed 's/.*"version": "\(.*\)".*/\1/;t;d' ../package.json)

echo "Project version: $VERSION"
echo "Using image tag: $TAG"

if [[ $# -eq 1 ]] ; then
    echo
    REPO='discord-bot'
    echo "No docker repo provided, using default."
fi
echo "Using docker repo: $REPO"
echo

echo "docker login -u '$USERNAME' docker.io"
echo

docker login -u "$USERNAME" docker.io

docker_repo="$USERNAME/$REPO"
image="$docker_repo:$TAG$VERSION"

echo  "Building: $image"
echo

docker build -f ../.dockerenv/Dockerfile ../ -t $image

echo
echo  "Pushing: $image"
docker push $image

