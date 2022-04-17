set -e

USERNAME=$1

if [[ -z "$USERNAME" ]] ; then
    read -p "Docker-hub username: "  USERNAME
fi
echo $USERNAME

# extract name from package.json
TAG=$(sed 's/.*"name": "\(.*\)".*/\1/;t;d' ../package.json)
# extract version from package.json
VERSION=$(sed 's/.*"version": "\(.*\)".*/\1/;t;d' ../package.json)

REPO="discord-bot"
echo "Project version: $VERSION"
echo "Using image tag: $TAG"
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

