FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates curl tzdata
COPY bin/mangohub /app/mangohub
RUN chmod +x /app/mangohub
ENV GIN_MODE=release
ENV MANGOHUB_LISTEN=0.0.0.0:25774
ENV KOMARI_LISTEN=0.0.0.0:25774
EXPOSE 25774
CMD ["/app/mangohub", "server"]
