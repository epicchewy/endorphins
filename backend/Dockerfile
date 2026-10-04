FROM golang:1.27.1-alpine AS build
WORKDIR /src/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/cmd ./cmd
COPY backend/internal ./internal
ARG GO_BUILD_TAGS=""
RUN CGO_ENABLED=0 go build -tags="${GO_BUILD_TAGS}" -o /api ./cmd/api \
    && CGO_ENABLED=0 go build -o /migrate ./cmd/migrate

FROM alpine:3.22
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /api /migrate ./
COPY exercises ./exercises
USER 10001:10001
ENV API_ADDRESS=0.0.0.0:8088 EXERCISE_DIR=/app/exercises
EXPOSE 8088
CMD ["./api"]
