FROM golang:1.25.11-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /out/server ./cmd/server

FROM alpine:3.22.2
RUN adduser -D -u 10001 wakala && mkdir /data && chown wakala /data
COPY --from=build /out/server /usr/local/bin/server
USER wakala
ENV PORT=8082 WAKALA_SQLITE_PATH=/data/wakala.db
VOLUME /data
EXPOSE 8082
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
ENTRYPOINT ["server"]
