FROM alpine:3.21

WORKDIR /app

# Docker buildx 会在构建时自动填充这些变量
ARG TARGETOS
ARG TARGETARCH

COPY --chmod=755 mangohub-agent-${TARGETOS}-${TARGETARCH}* /app/mangohub-agent

RUN ln -sf /app/mangohub-agent /app/mango-agent && \
    touch /.mangohub-agent-container /.mango-agent-container

ENTRYPOINT ["/app/mangohub-agent"]
# 运行时请指定参数
# Please specify parameters at runtime.
# eg: docker run mangohub-agent -e example.com -t token
CMD ["--help"]
