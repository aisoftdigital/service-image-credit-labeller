docker build -t mssb-cms-image-processing:latest .
docker run --rm --publish 3000:3000 --name mssb-cms-image-processing mssb-cms-image-processing:latest