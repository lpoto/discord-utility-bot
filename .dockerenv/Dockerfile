FROM python:alpine3.15 AS BUILDER

WORKDIR /app

COPY requirements.txt requirements.txt

RUN \
 apk add --no-cache python3 postgresql-libs && \
 apk add --no-cache --virtual .build-deps gcc python3-dev musl-dev postgresql-dev && \
 python3 -m pip install -r requirements.txt --no-cache-dir && \
 apk --purge del .build-deps


COPY . .

CMD ["python3", "-m", "main"]
