# syntax=docker/dockerfile:1

FROM golang:1.26-alpine AS build
WORKDIR /src

RUN apk add --no-cache ca-certificates git

ENV GOPRIVATE=github.com/lrndwy/gokil
ENV GONOSUMCHECK=github.com/lrndwy/gokil
ENV GONOSUMDB=github.com/lrndwy/gokil

COPY go.mod go.sum ./
RUN go mod download

COPY . .

ARG PROJECT=backend
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/app ./cmd/${PROJECT}

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates

COPY --from=build /out/app /app/app

EXPOSE 8080
ENTRYPOINT ["/app/app"]
CMD ["serve"]
