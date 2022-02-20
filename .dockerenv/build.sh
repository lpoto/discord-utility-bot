set -e

USERNAME=$1
REPO=$2
TAG=$3

if [[ -z "$USERNAME" ]] ; then
    echo 'No docker hub username provided'
    exit 0
fi

# extract name from package.json

# extract version from package.json
VERSION=$(sed "s/__version__ = '\(.*\)'.*/\1/;t;d" ../version.py)

echo "Project version: $VERSION"
echo "Using image tag: $TAG"

if [[ $# -eq 1 ]] ; then
    echo
    REPO="discord-bot"
    TAG="utility-bot"
    echo "No docker repo provided, using default."
    echo "No image tag provided, using default."
elif [[ $# -eq 2 ]] ; then
    TAG="utility-bot"
    echo "No image tag provided, using default."
fi

echo "Using docker repo: $REPO"
echo "Using image tag: $TAG"
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

