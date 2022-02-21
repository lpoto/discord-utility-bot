FROM python:3.10-slim-buster AS BUILDER

RUN apt-get update && \
    apt-get install -y --no-install-recommends gcc mono-mcs && \
    rm -rf /var/lib/apt/lists/* && \
    apt-get purge --auto-remove && \
    apt-get clean

WORKDIR /app

COPY requirements.txt requirements.txt

RUN pip3 --no-cache-dir install -r requirements.txt

RUN apt-get remove -y gcc mono-mcs && apt-get -y autoremove

COPY . .

CMD ["python3", "-m", "main"]
